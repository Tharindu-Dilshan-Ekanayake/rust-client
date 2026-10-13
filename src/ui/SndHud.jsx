import { useEffect, useMemo, useRef } from 'react'
import { Vector3 } from 'three'

import { IS_TOUCH, isLocked } from '../game/player/input.js'
import { runtime } from '../game/runtime.js'
import { cycleSpectate, sitesOf } from '../game/snd.js'
import { weaponName } from '../net/network.js'
import { SND, TEAM_LABELS, TEAMS } from '../shared/constants.js'
import { EQUIPMENT, WEAPONS } from '../shared/weapons.js'
import { useActiveMap, useGameStore } from '../store/gameStore.js'
import { Button, Icon } from './common.jsx'
import { uiScale } from './uiScale.js'
import { fmtTime, useAnimationFrame } from './uiUtils.js'

/**
 * Search & Destroy on the HUD: the round score bar, A / B and bomb markers in
 * the world, the hold-to-plant prompt, the round banners, and the screen you
 * watch teammates from once you're out. The room state arrives through
 * net/network.js (store `room.*` for what changes rarely, runtime.snd for the
 * timers and progress read every frame).
 */

const teamVar = (t) => (t === TEAMS.ALPHA ? 'var(--alpha)' : 'var(--bravo)')

/** How a round ended: [what the winners read, what the losers read]. */
const REASONS = {
  eliminated: ['Enemy team eliminated', 'Your team was eliminated'],
  detonated: ['Bomb detonated', 'The bomb detonated'],
  defused: ['Bomb defused', 'The bomb was defused'],
  time: ['Time ran out — sites held', 'Time ran out'],
}

/** The bomb as drawn on the HUD: a charge with a timer face and a wire. */
export function BombGlyph({ size = 18 }) {
  return (
    <svg className="dl-bomb-glyph" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path className="solid" d="M3 9.5h18v10.5H3zM6 12.5v4.5h8v-4.5zM16.4 13.6v2h2v-2z" />
      <path d="M9 9.5V7.2C9 5.4 10.4 4 12.2 4H15M18 9.5V7.5" />
    </svg>
  )
}

/* ---------------------------------------------------------------------------
 * Top: rounds won, who's still standing, the round (or bomb) clock
 * ------------------------------------------------------------------------- */

/** One pip per player on the team: lit while they're alive. */
function AlivePips({ team }) {
  const players = useGameStore((s) => s.room.players)
  const list = players.filter((p) => p.team === team && p.state !== 'selecting')
  return (
    <div className="pips">
      {list.map((p) => (
        <i key={p.id} className={p.state === 'alive' ? 'on' : ''} />
      ))}
    </div>
  )
}

export function SndTopBar() {
  const room = useGameStore((s) => s.room)
  const team = useGameStore((s) => s.team)
  const myId = useGameStore((s) => s.myId)
  const bombClock = useRef(null)
  const phase = room.roundPhase
  const planted = phase === 'planted'
  useAnimationFrame(() => {
    const el = bombClock.current
    if (!el) return
    const left = Math.max(0, runtime.snd.left)
    const text = left < 10 ? left.toFixed(1) : String(Math.ceil(left))
    if (el.textContent !== text) el.textContent = text
  })

  const cell = (t, score, side) => {
    const attacking = t === room.attackers
    return (
      <div className={`cell team ${side} ${t === team ? 'mine' : ''}`} key={t} style={{ '--team': teamVar(t) }}>
        <span className="name">
          {TEAM_LABELS[t]}
          {room.attackers && <b className={`side ${attacking ? 'atk' : 'def'}`}>{attacking ? 'ATK' : 'DEF'}</b>}
        </span>
        <span className="score">{score}</span>
        <AlivePips team={t} />
      </div>
    )
  }

  let timer
  let sub
  if (!phase) {
    timer = <span className="timer">WARM-UP</span>
    sub = room.phase === 'warmup' ? 'Host starts it from Esc' : 'Starting'
  } else if (planted) {
    timer = (
      <span className="timer">
        <BombGlyph size={20} />
        <span ref={bombClock} />
      </span>
    )
    sub = `Bomb planted · ${room.bombSite}`
  } else {
    timer = <span className="timer">{fmtTime(phase === 'freeze' ? SND.roundTime : room.timeLeft)}</span>
    sub = phase === 'over' ? 'Round over' : `Round ${room.round} · first to ${SND.roundsToWin}`
  }
  const low = phase === 'live' && room.timeLeft <= 15
  const carrying = room.bombState === 'carried' && room.bombCarrier === myId
  const dropped = room.bombState === 'dropped' && team === room.attackers

  return (
    <div className="dl-top dl-snd-top">
      {cell(TEAMS.ALPHA, room.scoreAlpha, 'left')}
      <div className={`cell clock ${low ? 'low' : ''} ${planted ? 'bomb' : ''}`}>
        {timer}
        <span className="sub">{sub}</span>
      </div>
      {cell(TEAMS.BRAVO, room.scoreBravo, 'right')}
      {(carrying || dropped) && (
        <div className={`dl-snd-status ${dropped ? 'warn' : ''}`}>
          <BombGlyph size={14} />
          {carrying ? 'You have the bomb' : runtime.snd.taken ? 'Bomb dropped — pick it up' : 'Grab the bomb'}
        </div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * World markers: A / B, the bomb, the teammate carrying it
 * ------------------------------------------------------------------------- */

const _v = new Vector3()
/**
 * How far inside the screen (UI px) a marker pinned to the edge stays: below
 * the top bar, and clear of the HUD boxes and, on touch, the buttons (there the
 * edge is a band across the middle, between the minimap and health on the left
 * and the ammo on the right, above the stick and the fire cluster).
 */
function edgesFor(w, h) {
  if (IS_TOUCH) return { l: 290, r: 260, t: 140, b: h * 0.6 }
  return { l: useGameStore.getState().settings.minimap ? 215 : 48, r: 48, t: 140, b: 130 }
}

/**
 * Parts of the screen a marker mustn't sit on even when that's where its point
 * is: the HUD boxes and, on touch, the buttons (TouchControls.jsx sizes them in
 * --u, 1% of the screen height up to 5.2 px, outside the scaled UI). A marker
 * there moves to the edge band instead, like an off-screen one.
 */
function blockedAt(x, y, w, h) {
  const minimap = useGameStore.getState().settings.minimap
  if (minimap && x < 205 && y < 270) return true
  if (!IS_TOUCH) {
    // Health, ammo, the XP strip along the bottom, the kill feed.
    return (x < 330 && y > h - 115) || (x > w - 290 && y > h - 135) || y > h - 55 || (x > w - 330 && y < 160)
  }
  const u = Math.min(window.innerHeight / 100, 5.2) / uiScale()
  return (
    (x < 260 && y > 265 && y < 345) || // health, under the minimap
    (x > w - 240 && y > 140 && y < 260) || // ammo, under the kill feed
    (x > w - 54 * u && y > h - 53 * u) || // the fire cluster
    (x > w - 75 * u && y > h - 25 * u) || // plant / defuse
    (x < 36 * u && y > h - 48 * u) // the stick and the left fire button
  )
}
/** While you're out, markers this far up from the bottom (UI px) fade behind the spectating panel. */
const DEAD_PANEL = 270
/** Where the last marker went on screen (UI px). */
const _at = { x: 0, y: 0 }

/** Puts a marker where a world point shows on screen, or on the edge (EDGE) pointing at it. Returns true when it's on screen. */
function placeMarker(el, p, w, h, cam, EDGE) {
  _v.set(p[0], p[1], p[2]).project(cam)
  const behind = _v.z > 1
  const nx = behind ? -_v.x : _v.x
  const ny = behind ? -_v.y : _v.y
  let sx = (nx * 0.5 + 0.5) * w
  let sy = (-ny * 0.5 + 0.5) * h
  // On screen (and not under the top bar or a HUD box or button): right where it is.
  const inside = !behind && sx >= 20 && sx <= w - 20 && sy >= 100 && sy <= h - 40 && !blockedAt(sx, sy, w, h)
  if (!inside) {
    // Slide it out from the middle of the edge band along its direction until it meets the band's edge.
    const cx = (EDGE.l + w - EDGE.r) / 2
    const cy = (EDGE.t + h - EDGE.b) / 2
    let dx = sx - cx
    let dy = sy - cy
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) dy = 1
    const kx = dx > 0 ? (w - EDGE.r - cx) / dx : dx < 0 ? (EDGE.l - cx) / dx : Infinity
    const ky = dy > 0 ? (h - EDGE.b - cy) / dy : dy < 0 ? (EDGE.t - cy) / dy : Infinity
    const k = Math.min(kx, ky)
    sx = cx + dx * k
    sy = cy + dy * k
  }
  el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`
  _at.x = sx
  _at.y = sy
  return inside
}

export function ObjectiveMarkers() {
  const map = useActiveMap()
  const team = useGameStore((s) => s.team)
  const myId = useGameStore((s) => s.myId)
  const phase = useGameStore((s) => s.room.roundPhase)
  const attackers = useGameStore((s) => s.room.attackers)
  const bombState = useGameStore((s) => s.room.bombState)
  const carrier = useGameStore((s) => s.room.bombCarrier)
  const wrap = useRef(null)
  const els = useRef(new Map())

  const markers = useMemo(() => {
    const out = []
    if (!phase || phase === 'over' || !team) return out
    const attacking = team === attackers
    const bombAt = (up) => () => [runtime.snd.x, runtime.snd.y + up, runtime.snd.z]
    if (phase === 'planted') {
      out.push({ id: 'bomb', kind: 'bomb', tone: 'danger', label: attacking ? 'Defend' : 'Defuse', at: bombAt(0.9) })
      return out
    }
    for (const s of sitesOf(map)) {
      out.push({ id: s.id, kind: 'site', letter: s.id, tone: attacking ? 'atk' : 'def', label: attacking ? 'Plant' : 'Defend', at: () => [s.p[0], s.p[1] + 1.9, s.p[2]] })
    }
    if (attacking && bombState === 'dropped') out.push({ id: 'drop', kind: 'bomb', tone: 'warn', label: runtime.snd.taken ? 'Pick up' : 'Grab', at: bombAt(0.7) })
    if (attacking && bombState === 'carried' && carrier && carrier !== myId) {
      out.push({
        id: 'carrier',
        kind: 'bomb',
        tone: 'mate',
        small: true,
        at: () => {
          const r = runtime.remotes.get(carrier)
          return r?.alive ? [r.pos.x, r.pos.y + 2.2, r.pos.z] : null
        },
      })
    }
    return out
  }, [map, team, myId, phase, attackers, bombState, carrier])

  useAnimationFrame(() => {
    const cam = runtime.camera
    const box = wrap.current
    if (!cam || !box) return
    const w = box.clientWidth
    const h = box.clientHeight
    const ads = runtime.local.alive ? runtime.local.ads : 0
    const panelTop = useGameStore.getState().gameState === 'dead' ? h - DEAD_PANEL : Infinity
    const edges = edgesFor(w, h)
    for (const m of markers) {
      const el = els.current.get(m.id)
      if (!el) continue
      const p = m.at()
      if (!p) {
        el.style.opacity = '0'
        continue
      }
      const inside = placeMarker(el, p, w, h, cam, edges)
      const d = Math.hypot(p[0] - cam.position.x, p[2] - cam.position.z)
      const dist = el.lastChild
      if (dist?.className === 'dist') {
        const text = `${Math.round(d)} m`
        if (dist.textContent !== text) dist.textContent = text
      }
      // Close up it gets out of the way, and aiming down sights dims it.
      let o = d < 4 ? 0.25 + (d / 4) * 0.75 : 1
      if (inside) o *= 1 - ads * 0.6
      if (_at.y > panelTop) o *= 0.2
      el.style.opacity = o.toFixed(2)
      el.classList.toggle('edge', !inside)
    }
  })

  return (
    <div className="dl-objs" ref={wrap}>
      {markers.map((m) => (
        <div
          key={m.id}
          className={`dl-obj ${m.kind} ${m.tone} ${m.small ? 'small' : ''}`}
          ref={(el) => (el ? els.current.set(m.id, el) : els.current.delete(m.id))}
        >
          <div className="badge">{m.kind === 'site' ? m.letter : <BombGlyph size={m.small ? 12 : 17} />}</div>
          {m.label && <div className="lbl">{m.label}</div>}
          {!m.small && <div className="dist" />}
        </div>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * Under the crosshair: hold to plant / defuse, and how far along it is
 * ------------------------------------------------------------------------- */

export function UsePrompt() {
  const hint = useGameStore((s) => s.useHint)
  const myId = useGameStore((s) => s.myId)
  const box = useRef(null)
  const bar = useRef(null)
  useAnimationFrame(() => {
    if (!box.current || !bar.current) return
    const s = runtime.snd
    const busy = Boolean(s.action) && s.by === myId
    box.current.classList.toggle('busy', busy)
    bar.current.style.transform = `scaleX(${busy ? s.progress.toFixed(3) : 0})`
  })
  if (!hint) return null
  const plant = hint === 'plant'
  return (
    <div className={`dl-use ${hint}`} ref={box}>
      <div className="line idle">
        Hold{' '}
        {IS_TOUCH ? (
          <span className="key glyph">
            <BombGlyph size={13} />
          </span>
        ) : (
          <kbd className="key">F</kbd>
        )}{' '}
        to {plant ? 'plant the bomb' : 'defuse the bomb'}
      </div>
      <div className="line doing">{plant ? 'Planting…' : 'Defusing…'}</div>
      <div className="track">
        <div ref={bar} />
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * Round banners: the freeze before a round, GO, and how it ended
 * ------------------------------------------------------------------------- */

export function RoundBanner() {
  const banner = useGameStore((s) => s.roundBanner)
  const room = useGameStore((s) => s.room)
  const team = useGameStore((s) => s.team)
  const count = useRef(null)
  useAnimationFrame(() => {
    const el = count.current
    if (!el) return
    const n = String(Math.max(0, Math.ceil((runtime.snd.freezeEnds - performance.now()) / 1000)))
    if (el.textContent !== n) {
      el.textContent = n
      // Restart the pop on every new number.
      el.classList.remove('tick')
      void el.offsetWidth
      el.classList.add('tick')
    }
  })
  const phase = room.roundPhase
  if (!team || !phase) return null
  const attacking = team === room.attackers
  const point = SND.roundsToWin - 1
  const matchPoint = room.scoreAlpha === point || room.scoreBravo === point

  if (phase === 'freeze') {
    return (
      <div className="dl-round start" key={`start${room.round}`} style={{ '--team': teamVar(team) }}>
        <div className="count" ref={count} />
        <div className="text">
          <span className="eyebrow">
            Round {room.round}
            {matchPoint && <em> · Match point</em>}
          </span>
          <span className="big">{attacking ? 'Attack' : 'Defend'}</span>
          <span className="sub">{attacking ? 'Grab the bomb — plant it on A or B' : 'Guard A and B — stop the plant'}</span>
        </div>
      </div>
    )
  }
  if (banner?.kind === 'go' && phase !== 'over') {
    return (
      <div className="dl-round go" key="go" style={{ '--team': teamVar(team) }}>
        <span className="big">Go</span>
        <span className="sub">{attacking ? (runtime.snd.taken ? 'Plant the bomb' : 'Grab the bomb') : 'Hold the sites'}</span>
      </div>
    )
  }
  if (phase === 'over' && banner?.kind === 'end') {
    const [winText, loseText] = REASONS[banner.why] ?? ['', '']
    return (
      <div className={`dl-round end ${banner.won ? 'won' : 'lost'}`} key={`end${room.round}`}>
        <div className="text">
          <span className="eyebrow">{banner.counted ? `Round ${room.round}` : 'Not scored — the round replays'}</span>
          <span className="big">{banner.won ? 'Round won' : 'Round lost'}</span>
          <span className="sub">{banner.won ? winText : loseText}</span>
        </div>
        <div className="tally">
          <span style={{ color: 'var(--alpha)' }}>{banner.a}</span>
          <i />
          <span style={{ color: 'var(--bravo)' }}>{banner.b}</span>
        </div>
      </div>
    )
  }
  return null
}

/* ---------------------------------------------------------------------------
 * Out of the round: who got you, and the teammate you're watching
 * ------------------------------------------------------------------------- */

export function SndDeathScreen() {
  const death = useGameStore((s) => s.death)
  const spectateId = useGameStore((s) => s.spectateId)
  const players = useGameStore((s) => s.room.players)
  const team = useGameStore((s) => s.team)
  const myId = useGameStore((s) => s.myId)
  const pending = useGameStore((s) => s.pendingClass)
  const openOverlay = useGameStore((s) => s.openOverlay)

  // Click / right-click or the arrow keys switch who you watch.
  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat || e.target instanceof HTMLInputElement) return
      if (e.code === 'ArrowRight' || e.code === 'KeyD') cycleSpectate(1)
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') cycleSpectate(-1)
    }
    const onDown = (e) => {
      if (IS_TOUCH || !isLocked()) return
      if (e.button === 0) cycleSpectate(1)
      if (e.button === 2) cycleSpectate(-1)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [])

  if (!death) return null
  const watched = players.find((p) => p.id === spectateId && p.state === 'alive')
  const anyone = players.some((p) => p.team === team && p.id !== myId && p.state === 'alive')
  const icon = WEAPONS[death.weapon] || EQUIPMENT[death.weapon] || death.weapon === 'bomb' ? death.weapon : death.weapon === 'fall' ? 'fall' : 'skull'
  return (
    <div className="dl-death snd">
      {!death.waiting && (
        <div className="dl-snd-killer dl-slide-up">
          <span className="dl-label">{death.self ? 'You died' : 'Killed by'}</span>
          {!death.self && <b style={{ color: teamVar(death.killerTeam) }}>{death.killerName}</b>}
          {death.weapon && (
            <span className="weapon">
              <Icon name={icon} height={14} />
              {weaponName(death.weapon)}
            </span>
          )}
          {death.headshot && <span className="dl-tag hs">Headshot</span>}
          {!death.self && (
            <span className="dl-label">
              HP <b className="hp">{death.killerHp}</b>
            </span>
          )}
        </div>
      )}
      <div className="dl-spec dl-interactive">
        <button type="button" aria-label="Previous teammate" disabled={!anyone} onClick={() => cycleSpectate(-1)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="who">
          <span className="dl-label">{watched ? 'Spectating' : anyone ? 'Finding a teammate' : 'No teammates left'}</span>
          <b style={{ color: watched ? teamVar(watched.team) : undefined }}>{watched?.name ?? '—'}</b>
        </div>
        <button type="button" aria-label="Next teammate" disabled={!anyone} onClick={() => cycleSpectate(1)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <div className="dl-spec-note">
        {death.waiting ? 'You join at the start of the next round' : 'Out until the next round'}
        {!IS_TOUCH && anyone && <span> · click or ← → to switch</span>}
      </div>
      <div className="dl-interactive dl-spec-class">
        <Button className="small" onClick={() => openOverlay('classPicker')}>
          {IS_TOUCH ? 'Change class' : '[B] Change class'}
        </Button>
        {pending && <div className="dl-pending">NEXT ROUND: {pending.name}</div>}
      </div>
    </div>
  )
}
