import { Vector3 } from 'three'

import { reloadFoley } from '../audio/bank.js'
import { sfx } from '../audio/sfx.js'
import { getBloxityState, useBloxityStore } from '../bloxity/store.js'
import { fx } from '../game/fx/fxApi.js'
import { releaseLock } from '../game/player/input.js'
import { lineClear } from '../game/physicsQueries.js'
import { emit, runtime } from '../game/runtime.js'
import {
  DEPLOY_TIMEOUT,
  INTERP_DELAY_MS,
  MAX_PLAYERS,
  RESPAWN_DELAY,
  ROOM_CODE_LENGTH,
  ROOM_NAME,
  SERVER_MOVING_CODE,
  TEAM_LABELS,
  TEAM_SELECT_TIMEOUT,
} from '../shared/constants.js'
import { isMapId, MAPS } from '../shared/maps.js'
import { EQUIPMENT, WEAPONS } from '../shared/weapons.js'
import { currentRank, getGame, toWireClass, useGameStore } from '../store/gameStore.js'
import { DIRECT_URL, openRoom, USE_MATCHMAKER } from './endpoint.js'

/**
 * Colyseus connection + everything that turns server traffic into game state.
 *
 * Remote players are rendered INTERP_DELAY_MS in the past, blended between the
 * two patches around that time, so 20 Hz patches look smooth at any framerate.
 */

const ROOM_KEY_RE = new RegExp(`^[A-Z2-9]{${ROOM_CODE_LENGTH}}$`)

/** Upper-cases a typed room key and strips anything that can't be in one. */
export const normalizeRoomCode = (code) =>
  String(code ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, ROOM_CODE_LENGTH)

/** Automatic rejoins (server moved, link dropped) allowed per REJOIN_WINDOW_MS. */
const REJOIN_LIMIT = 3
const REJOIN_WINDOW_MS = 120000

const BUFFER_MAX = 32
const UI_SNAPSHOT_MS = 150

const lerpAngle = (a, b, t) => {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

function avatarPayload() {
  const { equipped, proportions } = getBloxityState()
  return { equipped: equipped ?? {}, proportions: proportions ?? {} }
}

/** Bloxity name to fall back on when no callsign was typed (works for guests too). */
function displayName({ user, guest }) {
  return user?.displayName || user?.username || guest?.displayName || guest?.username || ''
}

function releasePointer() {
  releaseLock()
}

class Network {
  room = null
  /** Times of recent automatic rejoins (see mayRejoin). */
  rejoins = []
  /** id -> [{ t, x, y, z, yaw, pitch, seq }] */
  buffers = new Map()
  selfState = ''
  leaving = false
  lastUiSnapshot = 0
  unsubAvatar = null

  get sessionId() {
    return this.room?.sessionId ?? ''
  }

  /** Public matchmaking: fill an open room of this mode on this map, or open a new one. */
  join(mode, map = getGame().mapChoice) {
    this.retry = () => this.join(mode, map)
    return this.connect(mode, '', (client, opts) => client.joinOrCreate(ROOM_NAME, { mode, map, ...opts }))
  }

  /** Opens a private room (hidden from matchmaking); friends join with its key. */
  createPrivate({ mode, maxPlayers, bots, map = getGame().mapChoice }) {
    this.retry = () => this.createPrivate({ mode, maxPlayers, bots, map })
    return this.connect(mode, '', async (client, opts) => {
      const room = await client.create(ROOM_NAME, { mode, private: true, maxPlayers, bots, map, ...opts })
      // A server from before private rooms ignores the option and hands back an
      // ordinary room with a random id: don't pretend that worked.
      if (!ROOM_KEY_RE.test(room.roomId)) {
        room.leave(true).catch(() => {})
        throw new Error('OUTDATED_SERVER')
      }
      return room
    })
  }

  /** Joins a private room by the key its host shared. */
  joinByCode(code) {
    const key = normalizeRoomCode(code)
    this.retry = () => this.joinByCode(key)
    return this.connect('', key, (client, opts) => client.joinById(key, opts))
  }

  async connect(mode, code, open) {
    const store = useGameStore
    const game = getGame()
    const cls = toWireClass(game.getClass(game.selectedClassId))
    store.setState({
      gameState: 'lobby',
      lobbyStep: 'connecting',
      overlay: null,
      mode: mode || store.getState().mode,
      roomCode: code,
      team: '',
      connection: { status: 'connecting', error: '' },
      matchEnd: null,
      death: null,
      killFeed: [],
      pendingClass: null,
      activeClass: null,
      matchXp: { total: 0, by: {} },
      xpFeed: [],
      promotion: null,
    })
    const joinOptions = {
      name: game.playerName || displayName(getBloxityState()),
      avatar: avatarPayload(),
      classData: cls,
      rank: currentRank(),
    }
    // Retrying can't fix an old server or a wrong / full room key.
    const fatal = (err) => {
      const text = String(err?.message ?? '')
      return text === 'OUTDATED_SERVER' || (Boolean(code) && /not found|invalid|no rooms|locked|full/i.test(text))
    }
    const onWait = (why) =>
      store.setState({
        connection: { status: 'connecting', error: '', note: why === 'cold' ? 'Starting a server for you…' : 'Finding a server…' },
      })
    try {
      const room = await openRoom((client) => open(client, joinOptions), { onWait, fatal })
      this.attach(room)
      store.setState({ connection: { status: 'connected', error: '' }, myId: room.sessionId })
    } catch (err) {
      console.error('[net] join failed', err)
      const text = String(err?.message ?? '')
      let error = USE_MATCHMAKER
        ? 'Could not reach a game server. Check your connection and try again.'
        : `Could not reach the game server at ${DIRECT_URL}. Is rust-server running?`
      if (text === 'OUTDATED_SERVER') {
        error = 'The game server is running an older build without private rooms. Restart rust-server (Ctrl+C, then npm start) and try again.'
      }
      if (code && /not found|invalid|no rooms/i.test(text)) error = `No room with key ${code}. Check the key and try again.`
      else if (code && /locked|full/i.test(text)) error = `Room ${code} is full.`
      store.setState({ connection: { status: 'error', error } })
    }
  }

  leave() {
    if (!this.room) {
      this.reset()
      return
    }
    this.leaving = true
    this.room.leave(true).catch(() => {})
    this.reset()
  }

  reset() {
    this.unsubAvatar?.()
    this.unsubAvatar = null
    this.room = null
    this.buffers.clear()
    runtime.remotes.clear()
    runtime.local.alive = false
    this.selfState = ''
    releasePointer()
    useGameStore.setState({
      gameState: 'menu',
      menuScreen: 'main',
      overlay: null,
      remoteIds: [],
      death: null,
      matchEnd: null,
      team: '',
      roomCode: '',
      roomMap: '',
      maxPlayers: MAX_PLAYERS,
      connection: { status: 'idle', error: '' },
    })
  }

  send(type, msg) {
    this.room?.send(type, msg)
  }

  /**
   * Keeps `clockOffset` (server ms − local ms) pointed at the freshest data:
   * newer-than-expected samples pull it up quickly, and it only creeps down if
   * the link gets slower. Remote players are drawn at server time
   * now + offset − INTERP_DELAY_MS, on the server's own timeline.
   */
  trackClock(candidate) {
    if (!Number.isFinite(candidate)) return
    if (!this.clockReady || Math.abs(candidate - this.clockOffset) > 1500) {
      this.clockOffset = candidate
      this.clockReady = true
    } else if (candidate > this.clockOffset) {
      this.clockOffset += (candidate - this.clockOffset) * 0.35
    } else {
      this.clockOffset += (candidate - this.clockOffset) * 0.004
    }
  }

  /** Host of a private room: end the warm-up and start the real match. */
  startMatch() {
    this.send('start_match', {})
  }

  /* ---------------------------------------------------------------------- */

  attach(room) {
    this.room = room
    this.leaving = false
    this.clockReady = false
    this.clockOffset = 0
    this.selfState = ''
    this.buffers.clear()
    runtime.remotes.clear()

    room.onStateChange((state) => this.onState(state))
    room.onLeave((code) => {
      if (this.room !== room) return
      const intentional = this.leaving
      const privateRoom = Boolean(useGameStore.getState().roomCode)
      const retry = this.retry
      this.reset()
      if (intentional) return
      // The server is going away (a deploy) or the link dropped: public players
      // get a fresh server from the matchmaker and carry on. A private room's key
      // died with its server, so those players go back to the menu.
      const moving = code === SERVER_MOVING_CODE
      if (!privateRoom && retry && this.mayRejoin()) {
        retry()
        useGameStore.setState((s) => ({
          connection: { ...s.connection, note: moving ? 'Server update — moving you to a new server…' : 'Connection lost — rejoining…' },
        }))
        return
      }
      const error = moving
        ? 'The server was updated, which closed this private room. Open it again (it gets a new key) or join another.'
        : `Disconnected from server (code ${code}).`
      useGameStore.setState({ connection: { status: 'error', error } })
      getGame().pushNotice('DISCONNECTED FROM SERVER', 4000, 'warn')
    })
    room.onError((code, message) => console.warn('[net] room error', code, message))

    const on = (type, fn) => room.onMessage(type, fn)
    on('welcome', (m) =>
      useGameStore.setState({
        myId: m.id,
        mode: m.mode,
        roomCode: m.code ?? '',
        maxPlayers: m.max ?? MAX_PLAYERS,
        // The room's map (a server from before maps only sends its name).
        roomMap: isMapId(m.mapId) ? m.mapId : (Object.values(MAPS).find((map) => map.name === m.map)?.id ?? 'dustline'),
      }),
    )
    on('ping', (m) => room.send('pong', { t: m.t }))
    on('notice', (m) => getGame().pushNotice(String(m.text ?? ''), Number(m.ms) || 4000, 'warn'))
    on('team_select', (m) =>
      useGameStore.setState({ teamSelect: { deadline: performance.now() + (m.timeout ?? TEAM_SELECT_TIMEOUT) * 1000, denied: '' } }),
    )
    on('team_assigned', (m) => {
      useGameStore.setState({ team: m.team })
      if (m.reason !== 'choice') getGame().pushNotice(`ASSIGNED TO TEAM ${TEAM_LABELS[m.team]}`, 2500)
    })
    on('team_denied', (m) => {
      useGameStore.setState((s) => ({ teamSelect: { ...s.teamSelect, denied: m.team } }))
      getGame().pushNotice(m.reason, 2500, 'warn')
    })
    on('team_moved', (m) => {
      useGameStore.setState({ team: m.newTeam })
      getGame().pushNotice(`YOU HAVE BEEN MOVED TO TEAM ${TEAM_LABELS[m.newTeam]} FOR BALANCE`, 5000, 'warn')
    })
    on('spawn', (m) => this.onSpawn(m))
    on('correct', (m) => emit('correct', m.p))
    on('ammo', (m) => {
      emit('ammo', m.ammo)
      if (m.msg) getGame().pushNotice(m.msg, 1800)
      sfx.play('pickup')
    })
    on('class_ack', (m) => {
      if (!m.ok) return
      useGameStore.setState({ pendingClass: { name: m.name } })
    })
    on('shot', (m) => this.onShot(m))
    on('xp', (m) => {
      const promoted = getGame().addXp(m.n, m.why)
      if (promoted) {
        room.send('rank', { r: promoted })
        sfx.play('rankUp', { volume: 0.9 })
      }
    })
    on('hit', (m) => {
      useGameStore.setState({ hitmarker: { t: performance.now(), kill: m.kill, hs: m.hs } })
      sfx.play(m.kill ? (m.hs ? 'killHead' : 'killConfirm') : m.hs ? 'headshot' : 'hitmarker')
    })
    on('damaged', (m) => this.onDamaged(m))
    on('fell', (m) => {
      // A hard landing: crunch, a jolt, and a note of how far it was.
      sfx.play('bonecrunch', { volume: Math.min(1, 0.5 + m.dmg / 80) })
      runtime.view.shake = Math.min(1, runtime.view.shake + 0.35 + m.dmg / 150)
      if (m.dmg < 100) getGame().pushNotice(`HARD LANDING · ${m.h} M`, 1600, 'warn')
    })
    on('kill', (m) => this.onKill(m))
    on('melee', (m) => {
      const r = runtime.remotes.get(m.id)
      if (!r) return
      r.meleeAt = performance.now()
      sfx.play('knifeSwing', { pos: [r.pos.x, r.pos.y + 1.2, r.pos.z], volume: 0.8 })
    })
    on('act', (m) => {
      const r = runtime.remotes.get(m.id)
      if (!r) return
      const at = [r.pos.x, r.pos.y + 1.1, r.pos.z]
      if (m.a === 'reload') {
        r.reloadAt = performance.now()
        r.reloadDur = Math.min(4000, Math.max(500, Number(m.d) || 2000))
        // You can hear an enemy reloading nearby — a real tell.
        const wid = m.w ?? r.weapon
        const w = WEAPONS[wid]
        const shell = w?.shellTime ? { start: w.shellStart, time: w.shellTime } : null
        const foley = reloadFoley(wid, Boolean(m.e), r.reloadDur / 1000, shell).map(([f, name]) => [(f * r.reloadDur) / 1000, name])
        sfx.playSequence(foley, { pos: at, volume: 0.7, ref: 2, maxDistance: 26 })
      } else if (m.a === 'throw') {
        r.throwAt = performance.now()
      }
    })
    on('explosion', (m) => this.onExplosion(m))
    on('flash', (m) => this.onFlash(m))
    on('match_end', (m) => {
      releasePointer()
      useGameStore.setState({ gameState: 'ended', overlay: null, matchEnd: { ...m, at: performance.now() } })
      this.snapshotUi(room.state, true)
    })
    on('match_start', () => {
      getGame().resetMatchXp()
      getGame().pushNotice('MATCH STARTED — GOOD LUCK', 3000)
      sfx.play('killConfirm', { volume: 0.7 })
    })
    on('match_reset', () => {
      useGameStore.setState({ matchEnd: null, death: null, killFeed: [] })
      const me = room.state.players.get(room.sessionId)
      if (me?.state === 'deploying') this.enterDeploy()
    })

    // Keep the server's copy of our avatar in sync if it changes in the portal.
    this.unsubAvatar = useBloxityStore.subscribe((s, prev) => {
      if (s.equipped !== prev.equipped || s.proportions !== prev.proportions) {
        this.send('avatar', avatarPayload())
      }
    })
  }

  /** Caps automatic rejoins so a server that keeps dropping us can't loop forever. */
  mayRejoin() {
    const now = Date.now()
    this.rejoins = this.rejoins.filter((t) => now - t < REJOIN_WINDOW_MS)
    if (this.rejoins.length >= REJOIN_LIMIT) return false
    this.rejoins.push(now)
    return true
  }

  enterDeploy() {
    runtime.local.alive = false
    releasePointer()
    useGameStore.setState({
      gameState: 'lobby',
      lobbyStep: 'deploy',
      overlay: null,
      deployDeadline: performance.now() + DEPLOY_TIMEOUT * 1000,
      death: null,
    })
  }

  onState(state) {
    const now = performance.now()
    const myId = this.room?.sessionId
    let idsChanged = false
    const seen = new Set()
    let freshest = -Infinity

    state.players.forEach((p, id) => {
      seen.add(id)
      if (id === myId) return
      let buf = this.buffers.get(id)
      if (!buf) {
        buf = []
        this.buffers.set(id, buf)
        idsChanged = true
      }
      // One sample per actual position update, stamped with the server's time for
      // it. Patches and client moves don't tick in step, so stamping with arrival
      // time (or sampling every patch) made movement stop-start.
      const last = buf[buf.length - 1]
      if (!last || last.t !== p.mt || last.seq !== p.spawnSeq) {
        buf.push({ t: p.mt, x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, seq: p.spawnSeq })
        if (buf.length > BUFFER_MAX) buf.shift()
        if (last) freshest = Math.max(freshest, p.mt - now)
      }

      let r = runtime.remotes.get(id)
      if (!r) {
        r = { id, pos: new Vector3(p.x, p.y, p.z), vel: new Vector3(), yaw: p.yaw, pitch: 0, speed: 0, firedAt: 0, loudAt: 0, meleeAt: 0, deadAt: 0 }
        runtime.remotes.set(id, r)
      }
      if (p.state === 'dead' && r.state !== 'dead') r.deadAt = now
      r.name = p.name
      r.team = p.team
      r.isBot = p.isBot
      r.state = p.state
      r.hp = p.hp
      r.weapon = p.weapon
      r.primary = p.primary
      r.kit = p.kit
      r.crouch = p.crouch
      r.prone = p.prone
      r.slide = p.slide
      r.ads = p.ads
      r.sprint = p.sprint
      r.climbing = p.climbing
      r.avatar = p.avatar
      r.seq = p.spawnSeq
    })

    this.trackClock(freshest)

    for (const id of [...this.buffers.keys()]) {
      if (!seen.has(id)) {
        this.buffers.delete(id)
        runtime.remotes.delete(id)
        idsChanged = true
      }
    }
    if (idsChanged) useGameStore.setState({ remoteIds: [...this.buffers.keys()] })

    const me = state.players.get(myId)
    if (me) {
      if (me.team && me.team !== getGame().team) useGameStore.setState({ team: me.team })
      getGame().setHud({ hp: me.hp })
      if (me.state !== this.selfState) {
        const prev = this.selfState
        this.selfState = me.state
        if (me.state === 'selecting') {
          useGameStore.setState({
            gameState: 'lobby',
            lobbyStep: 'team',
            teamSelect: { deadline: now + TEAM_SELECT_TIMEOUT * 1000, denied: '' },
          })
        } else if (me.state === 'deploying' && state.phase !== 'ended') {
          this.enterDeploy()
        } else if (me.state === 'dead' && prev === 'alive' && getGame().gameState === 'playing') {
          // Normally the kill message already did this; covers e.g. falling out.
          this.enterDeath('', 'fall', 0, false)
        }
      }
    }

    this.snapshotUi(state, now - this.lastUiSnapshot > UI_SNAPSHOT_MS)
  }

  snapshotUi(state, force) {
    if (!force) return
    this.lastUiSnapshot = performance.now()
    const players = []
    state.players.forEach((p) => {
      players.push({
        id: p.id,
        name: p.name,
        team: p.team,
        isBot: p.isBot,
        state: p.state,
        kills: p.kills,
        deaths: p.deaths,
        ping: p.ping,
        hp: p.hp,
        joinedAt: p.joinedAt,
        rank: p.rank ?? 1,
      })
    })
    useGameStore.setState({
      room: {
        players,
        phase: state.phase,
        host: state.host ?? '',
        timeLeft: state.timeLeft,
        scoreAlpha: state.scoreAlpha,
        scoreBravo: state.scoreBravo,
        scoreLimit: state.scoreLimit,
        winner: state.winner,
        mvp: state.mvp,
        restartIn: state.restartIn,
        mode: state.mode,
      },
    })
  }

  onSpawn(m) {
    runtime.local.alive = true
    useGameStore.setState({
      gameState: 'playing',
      death: null,
      activeClass: m.classData,
      pendingClass: null,
    })
    emit('spawn', m)
  }

  enterDeath(killerId, weapon, killerHp, headshot) {
    runtime.local.alive = false
    runtime.death.at.copy(runtime.local.feet)
    runtime.death.killerId = killerId
    const now = performance.now()
    const killer = killerId ? this.room?.state.players.get(killerId) : null
    useGameStore.setState({
      gameState: 'dead',
      death: {
        killerId,
        killerName: killer?.name ?? '',
        killerTeam: killer?.team ?? '',
        weapon,
        killerHp,
        headshot,
        self: !killerId || killerId === this.sessionId,
        at: now,
        respawnAt: now + RESPAWN_DELAY * 1000,
      },
    })
    emit('death')
  }

  /**
   * Someone else's round passing close: the supersonic crack and the air
   * tearing past, placed where it went by (CoD's near-miss "snap").
   */
  nearMiss(m) {
    const cam = runtime.camera
    if (!cam || !runtime.local.alive || m.id === this.sessionId || m.w === 'rpg' || !Array.isArray(m.o)) return
    const ends = Array.isArray(m.es) && m.es.length ? m.es : [m.e]
    const [lx, ly, lz] = [cam.position.x, cam.position.y, cam.position.z]
    let best = null
    for (const e of ends) {
      if (!Array.isArray(e)) continue
      const dx = e[0] - m.o[0], dy = e[1] - m.o[1], dz = e[2] - m.o[2]
      const len2 = dx * dx + dy * dy + dz * dz
      if (len2 < 1) continue
      const t = Math.min(1, Math.max(0, ((lx - m.o[0]) * dx + (ly - m.o[1]) * dy + (lz - m.o[2]) * dz) / len2))
      // Past us (not stopping at our feet) and well clear of the shooter.
      if (t > 0.97 || t * Math.sqrt(len2) < 4) continue
      const p = [m.o[0] + dx * t, m.o[1] + dy * t, m.o[2] + dz * t]
      const d = Math.hypot(p[0] - lx, p[1] - ly, p[2] - lz)
      if (d < 3.2 && (!best || d < best.d)) best = { d, p }
    }
    if (!best) return
    const pistol = m.w === 'pistol' || m.w === 'hornet' || m.w === 'smg' || m.w === 'viper'
    sfx.play('bulletCrack', { pos: best.p, volume: (pistol ? 0.55 : 0.9) * Math.min(1, 1.25 - best.d / 4), ref: 1.5, maxDistance: 12 })
  }

  onShot(m) {
    this.nearMiss(m)
    const r = runtime.remotes.get(m.id)
    const now = performance.now()
    if (r) {
      r.firedAt = now
      r.quiet = Boolean(m.q)
      // Suppressed shots never ping the minimap.
      if (!m.q) r.loudAt = now
    }
    if (m.w === 'rpg') {
      // The rocket itself flies as server state (WorldState draws it).
      fx.muzzle(m.o, m.w)
      fx.puff(m.o)
      sfx.play('rpg', { pos: m.o, ref: 10, maxDistance: 220, volume: 0.9 })
      return
    }
    // Shotgun blasts carry every pellet's end point.
    const ends = Array.isArray(m.es) && m.es.length ? m.es : [m.e]
    for (const e of ends) fx.tracer(m.o, e, m.w)
    if (!m.q) fx.muzzle(m.o, m.w)
    if (m.b) fx.blood(m.e)
    for (const e of ends) if (!m.b || e !== m.e) fx.impact(e, null)
    if (m.q) {
      sfx.play('suppressed', { pos: m.o, ref: 2, maxDistance: 40, kind: m.w === 'sniper' ? 'sniper' : m.w === 'ar' || m.w === 'lmg' || m.w === 'shotgun' ? 'rifle' : 'pistol' })
    } else {
      const big = m.w === 'sniper' || m.w === 'viper' || m.w === 'shotgun' || m.w === 'lmg'
      sfx.play(m.w, { pos: m.o, ref: big ? 10 : 5, maxDistance: big ? 220 : 160, volume: 0.9 })
    }
  }

  onDamaged(m) {
    getGame().setHud({ hp: m.hp })
    sfx.play('hurt', { volume: 0.6 })
    sfx.play('gasp', { volume: 0.8 })
    runtime.view.shake = Math.min(1, runtime.view.shake + 0.25)
    if (Array.isArray(m.from)) {
      const l = runtime.local
      const dx = m.from[0] - l.feet.x
      const dz = m.from[1] - l.feet.z
      // World-space bearing of the source (same convention as yaw); the HUD turns
      // it relative to the current view every frame so the arc tracks as you turn.
      getGame().pushDamage(Math.atan2(-dx, -dz))
    }
  }

  onKill(m) {
    const state = this.room?.state
    if (!state) return
    const killer = m.k ? state.players.get(m.k) : null
    const victim = state.players.get(m.v)
    const myId = this.sessionId
    getGame().pushKill({
      killer: killer?.name ?? '',
      killerTeam: killer?.team ?? '',
      victim: victim?.name ?? '???',
      victimTeam: victim?.team ?? '',
      weapon: m.w,
      hs: m.hs,
      mine: m.k === myId,
      me: m.v === myId,
    })
    if (m.v === myId) {
      this.enterDeath(m.k, m.w, m.khp, m.hs)
    } else if (m.k === myId) {
      getGame().pushNotice(`ELIMINATED ${victim?.name ?? ''}${m.hs ? ' · HEADSHOT' : ''}`, 1600, 'kill')
    }
  }

  onExplosion(m) {
    const p = m.p
    if (m.k === 'frag' || m.k === 'rocket') {
      fx.explosion(p)
      sfx.play('explosion', { pos: p, ref: 9, maxDistance: 160 })
      const l = runtime.local
      const d = Math.hypot(p[0] - l.feet.x, p[1] - l.feet.y, p[2] - l.feet.z)
      if (d < 18) runtime.view.shake = Math.min(1.5, runtime.view.shake + (1 - d / 18) * 1.4)
    } else if (m.k === 'smoke') {
      fx.puff(p)
      sfx.play('smokePop', { pos: p, ref: 6 })
    }
  }

  onFlash(m) {
    const p = m.p
    sfx.play('flashbang', { pos: p, ref: 8, maxDistance: 120 })
    fx.explosion(p, 'flash')
    const cam = runtime.camera
    if (!cam || !runtime.local.alive) return
    const { radius, duration, lookAwayScale } = EQUIPMENT.flash
    const eye = [cam.position.x, cam.position.y, cam.position.z]
    const dx = p[0] - eye[0]
    const dy = p[1] - eye[1]
    const dz = p[2] - eye[2]
    const d = Math.hypot(dx, dy, dz)
    if (d > radius || !lineClear(p, eye, 0.2)) return
    const fwd = new Vector3()
    cam.getWorldDirection(fwd)
    const facing = (fwd.x * dx + fwd.y * dy + fwd.z * dz) / (d || 1)
    const look = lookAwayScale + (1 - lookAwayScale) * Math.max(0, facing)
    const near = Math.min(1, Math.max(0, 1 - (d - 2) / (radius - 2)))
    const secs = duration * near * look
    if (secs < 0.2) return
    runtime.view.flash = Math.max(runtime.view.flash, secs)
    runtime.view.flashMax = runtime.view.flash
    sfx.ring(secs + 0.6, Math.min(1, secs / duration + 0.3))
  }
}

export const net = new Network()

/**
 * Interpolated transform for a remote player at `renderTime` (performance.now()
 * minus the interpolation delay). Writes into `out` and returns false if unknown.
 */
export function sampleRemote(id, renderTime, out) {
  const buf = net.buffers.get(id)
  if (!buf || buf.length === 0) return false
  let a = buf[0]
  let b = buf[0]
  const newest = buf[buf.length - 1]
  if (renderTime >= newest.t) {
    // Ran past the newest data (a late packet): carry on along the last velocity
    // for a short while instead of freezing, so a hiccup doesn't show as a stop.
    const prev = buf[buf.length - 2]
    const span = prev && prev.seq === newest.seq ? newest.t - prev.t : 0
    const ahead = Math.min(renderTime - newest.t, MAX_EXTRAPOLATE_MS)
    const k = span > 0 ? ahead / span : 0
    out.x = newest.x + (newest.x - (prev?.x ?? newest.x)) * k
    out.y = newest.y + (span > 0 ? (newest.y - prev.y) * k : 0)
    out.z = newest.z + (newest.z - (prev?.z ?? newest.z)) * k
    out.yaw = newest.yaw
    out.pitch = newest.pitch
    out.vx = span > 0 ? ((newest.x - prev.x) / span) * 1000 : 0
    out.vy = span > 0 ? ((newest.y - prev.y) / span) * 1000 : 0
    out.vz = span > 0 ? ((newest.z - prev.z) / span) * 1000 : 0
    return true
  } else if (renderTime > buf[0].t) {
    for (let i = buf.length - 2; i >= 0; i--) {
      if (buf[i].t <= renderTime) {
        a = buf[i]
        b = buf[i + 1]
        break
      }
    }
  }
  // A respawn is a teleport: never blend across it.
  if (a.seq !== b.seq) a = b
  const span = b.t - a.t
  const t = span > 0 ? Math.min(1, Math.max(0, (renderTime - a.t) / span)) : 1
  out.x = a.x + (b.x - a.x) * t
  out.y = a.y + (b.y - a.y) * t
  out.z = a.z + (b.z - a.z) * t
  out.yaw = lerpAngle(a.yaw, b.yaw, t)
  out.pitch = a.pitch + (b.pitch - a.pitch) * t
  out.vx = span > 0 ? ((b.x - a.x) / span) * 1000 : 0
  out.vy = span > 0 ? ((b.y - a.y) / span) * 1000 : 0
  out.vz = span > 0 ? ((b.z - a.z) / span) * 1000 : 0
  return true
}

/** Server-timeline moment remote players are drawn at (see trackClock). */
export const renderTime = () => performance.now() + (net.clockOffset ?? 0) - INTERP_DELAY_MS

/** Longest we'll guess ahead of the newest snapshot before holding still. */
const MAX_EXTRAPOLATE_MS = 120

/** Weapon display name, used by HUD/kill feed. */
export const weaponName = (id) =>
  WEAPONS[id]?.name ?? EQUIPMENT[id]?.name ?? (id === 'fall' ? 'Fall' : id ?? '')
