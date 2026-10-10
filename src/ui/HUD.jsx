import { useMemo, useRef } from 'react'

import { sfx } from '../audio/sfx.js'

import { requestLock } from '../game/player/input.js'
import { runtime } from '../game/runtime.js'
import { TEAM_LABELS, TEAMS } from '../shared/constants.js'
import { buildColliders, MAP_HALF } from '../shared/map.js'
import { rotate3 } from '../shared/math.js'
import { EQUIPMENT, WEAPONS } from '../shared/weapons.js'
import { useGameStore } from '../store/gameStore.js'
import { Button, Icon } from './common.jsx'
import { fmtTime, useAnimationFrame } from './uiUtils.js'

const teamColor = (team, mode, isMe) =>
  mode === 'tdm' ? (team === TEAMS.ALPHA ? 'var(--alpha)' : team === TEAMS.BRAVO ? 'var(--bravo)' : 'var(--text)') : isMe ? 'var(--accent)' : 'var(--text)'

/* ---------------------------------------------------------------------------
 * Bottom-left: health + class
 * ------------------------------------------------------------------------- */

function HealthBox() {
  const hp = useGameStore((s) => s.hud.hp)
  const activeClass = useGameStore((s) => s.activeClass)
  const pending = useGameStore((s) => s.pendingClass)
  const low = hp < 30
  const segs = Math.ceil(hp / 10)
  return (
    <div className={`dl-hud-box dl-health ${low ? 'low' : ''}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="hp" style={{ color: low ? 'var(--bad)' : undefined }}>
          {hp}
        </span>
        <span className="dl-label">{activeClass?.name ?? ''}</span>
      </div>
      <div className="segs">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className={`seg ${i < segs ? 'on' : ''}`} />
        ))}
      </div>
      {pending && pending.name !== activeClass?.name && (
        <div className="dl-pending">CLASS CHANGE WILL APPLY ON NEXT SPAWN: {pending.name}</div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * Bottom-right: ammo + equipment
 * ------------------------------------------------------------------------- */

function AmmoBox() {
  const hud = useGameStore((s) => s.hud)
  const w = WEAPONS[hud.weapon]
  const melee = w?.fireMode === 'melee'
  const low = !melee && hud.mag >= 0 && hud.mag <= Math.ceil((hud.magSize || w?.magSize || 30) * 0.25)
  return (
    <div className="dl-hud-box dl-ammo">
      <div className="wname">
        {hud.reloading ? <span style={{ color: 'var(--accent)', animation: 'dl-pulse 700ms infinite' }}>RELOADING · </span> : null}
        {w?.name}
      </div>
      {melee ? (
        <div className="mag" style={{ fontSize: 34 }}>
          ∞
        </div>
      ) : (
        <div>
          <span className={`mag ${low ? 'low' : ''}`}>{hud.mag}</span>
          <span className="res">/ {hud.reserve}</span>
        </div>
      )}
      <div className="dl-equip">
        <div className={`item ${hud.lethal > 0 ? '' : 'empty'}`}>
          <span className="key">G</span>
          <Icon name="frag" height={16} />×{hud.lethal}
        </div>
        <div className={`item ${hud.tactical > 0 ? '' : 'empty'}`}>
          <span className="key">Q</span>
          <Icon name={hud.tacticalKind} height={16} />×{hud.tactical}
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * Top-centre: timer + score
 * ------------------------------------------------------------------------- */

function TopBar() {
  const room = useGameStore((s) => s.room)
  const mode = useGameStore((s) => s.mode)
  const team = useGameStore((s) => s.team)
  const myId = useGameStore((s) => s.myId)
  if (mode === 'tdm') {
    const cells = [
      [TEAMS.ALPHA, room.scoreAlpha],
      [TEAMS.BRAVO, room.scoreBravo],
    ]
    const cell = ([t, score]) => (
      <div className="cell" key={t} style={{ borderBottom: t === team ? `2px solid ${teamColor(t, mode)}` : '2px solid transparent' }}>
        <span className="dl-label" style={{ color: teamColor(t, mode), fontSize: 11 }}>
          {TEAM_LABELS[t]}
          {t === team ? ' · YOU' : ''}
        </span>
        <span className="score" style={{ color: teamColor(t, mode) }}>
          {score}
        </span>
        <div className="bar">
          <div style={{ width: `${(score / Math.max(1, room.scoreLimit)) * 100}%`, background: teamColor(t, mode) }} />
        </div>
      </div>
    )
    return (
      <div className="dl-top">
        {cell(cells[0])}
        <div className="cell">
          <span className="timer">{room.phase === 'warmup' ? 'WARM-UP' : fmtTime(room.timeLeft)}</span>
          <span className="dl-label" style={{ fontSize: 10 }}>
            {room.phase === 'warmup' ? 'Host starts it from Esc' : `First to ${room.scoreLimit}`}
          </span>
        </div>
        {cell(cells[1])}
      </div>
    )
  }
  const ranked = room.players.filter((p) => p.state !== 'selecting').sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
  const myRank = ranked.findIndex((p) => p.id === myId)
  return (
    <div className="dl-top">
      <div className="cell">
        <span className="timer">{room.phase === 'warmup' ? 'WARM-UP' : fmtTime(room.timeLeft)}</span>
        <span className="dl-label" style={{ fontSize: 10 }}>
          {room.phase === 'warmup' ? 'Host starts it from Esc' : `First to ${room.scoreLimit}`}
        </span>
      </div>
      <div className="cell dl-ffa-top">
        {ranked.slice(0, 3).map((p, i) => (
          <div key={p.id} className={`r ${p.id === myId ? 'me' : ''}`}>
            <span>
              {i + 1}. {p.name}
            </span>
            <b>{p.kills}</b>
          </div>
        ))}
        {myRank >= 3 && (
          <div className="r me">
            <span>
              {myRank + 1}. YOU
            </span>
            <b>{ranked[myRank].kills}</b>
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * Centre: crosshair, hitmarker, damage arcs, cook timer, scope, flash
 * ------------------------------------------------------------------------- */

function Crosshair() {
  const ref = useRef(null)
  useAnimationFrame(() => {
    const el = ref.current
    const cam = runtime.camera
    if (!el || !cam) return
    const l = runtime.local
    const hidden = l.ads > 0.6 || l.sprinting || l.climbing || l.weapon === 'knife' || runtime.view.scoped
    el.style.opacity = hidden ? '0' : '1'
    if (hidden) return
    const px = (Math.tan(runtime.view.spread) / Math.tan((cam.fov * Math.PI) / 360)) * (window.innerHeight / 2)
    const gap = Math.max(4, Math.min(80, px))
    const [t, b, lft, r] = el.children
    t.style.transform = `translate(-1px, ${-gap - 9}px)`
    b.style.transform = `translate(-1px, ${gap}px)`
    lft.style.transform = `translate(${-gap - 9}px, -1px)`
    r.style.transform = `translate(${gap}px, -1px)`
  })
  return (
    <div className="dl-crosshair" ref={ref}>
      <i className="v" />
      <i className="v" />
      <i className="h" />
      <i className="h" />
      <i className="dot" />
    </div>
  )
}

function Hitmarker() {
  const hit = useGameStore((s) => s.hitmarker)
  const ref = useRef(null)
  useAnimationFrame(() => {
    const el = ref.current
    if (!el) return
    if (!hit) {
      el.style.opacity = '0'
      return
    }
    const age = performance.now() - hit.t
    const life = hit.kill ? 420 : 200
    const k = Math.max(0, 1 - age / life)
    el.style.opacity = String(k)
    el.style.transform = `scale(${1 + (1 - k) * 0.35 + (hit.kill ? 0.2 : 0)})`
  })
  return (
    <div className={`dl-hitmarker ${hit?.kill ? 'kill' : ''}`} ref={ref} style={{ opacity: 0 }}>
      {[45, 135, 225, 315].map((a) => (
        <i key={a} style={{ transform: `rotate(${a}deg)` }} />
      ))}
    </div>
  )
}

function DamageMarks() {
  const marks = useGameStore((s) => s.damageMarks)
  const ref = useRef(null)
  useAnimationFrame(() => {
    const el = ref.current
    if (!el) return
    ;[...el.children].forEach((child) => {
      const world = Number(child.dataset.angle)
      // CSS rotates clockwise; yaw grows counter-clockwise (turning left).
      child.style.transform = `rotate(${runtime.local.yaw - world}rad)`
    })
  })
  return (
    <div className="dl-damage" ref={ref}>
      {marks.map((m) => (
        <i key={m.id} data-angle={m.angle} />
      ))}
    </div>
  )
}

function CookBar() {
  const ref = useRef(null)
  useAnimationFrame(() => {
    const el = ref.current
    if (!el) return
    const start = runtime.view.cookStart
    el.style.display = start ? 'block' : 'none'
    if (start) {
      const k = Math.min(1, (performance.now() / 1000 - start) / EQUIPMENT.frag.fuse)
      el.firstChild.style.width = `${(1 - k) * 100}%`
      el.firstChild.style.background = k > 0.7 ? 'var(--bad)' : 'var(--accent)'
    }
  })
  return (
    <div className="dl-cook" ref={ref} style={{ display: 'none' }}>
      <div />
    </div>
  )
}

function ScopeOverlay() {
  const ref = useRef(null)
  useAnimationFrame(() => {
    const el = ref.current
    if (!el) return
    const on = runtime.view.scoped && runtime.local.alive
    el.style.display = on ? 'block' : 'none'
    if (on) {
      const bar = el.querySelector('.breath > div')
      bar.style.width = `${Math.max(0, runtime.view.breath) * 100}%`
      bar.style.background = runtime.view.holdingBreath ? '#cfe8ff' : 'rgba(207,232,255,0.4)'
    }
  })
  return (
    <div className="dl-scope" ref={ref} style={{ display: 'none' }}>
      <div className="ring" />
      <div className="line-h" />
      <div className="line-v" />
      <div className="thick-h" style={{ left: 'calc(50% - 43vmin)' }} />
      <div className="thick-h" style={{ left: 'calc(50% + 13vmin)' }} />
      <div className="thick-v" />
      <div className="breath">
        <div />
      </div>
    </div>
  )
}

function FlashOverlay() {
  const ref = useRef(null)
  const last = useRef(0)
  useAnimationFrame((t) => {
    const dt = last.current ? Math.min(0.1, (t - last.current) / 1000) : 0
    last.current = t
    const v = runtime.view
    if (v.flash > 0) v.flash = Math.max(0, v.flash - dt)
    const el = ref.current
    if (!el) return
    // Pure white for the first part, then a long fade.
    const k = v.flashMax > 0 ? v.flash / v.flashMax : 0
    const o = v.flash <= 0 ? 0 : Math.min(1, k * 1.8) * Math.min(1, v.flash / 0.6 + 0.2)
    el.style.opacity = String(o)
  })
  return <div className="dl-flash" ref={ref} />
}

/* ---------------------------------------------------------------------------
 * Kill feed, notices
 * ------------------------------------------------------------------------- */

function KillFeed() {
  const feed = useGameStore((s) => s.killFeed)
  const mode = useGameStore((s) => s.mode)
  return (
    <div className="dl-feed">
      {feed.map((k) => (
        <div key={k.id} className={`row ${k.mine || k.me ? 'mine' : ''}`}>
          {k.killer && k.killer !== k.victim && <span style={{ color: teamColor(k.killerTeam, mode, k.mine) }}>{k.killer}</span>}
          <Icon name={WEAPONS[k.weapon] || EQUIPMENT[k.weapon] ? k.weapon : k.weapon === 'fall' ? 'fall' : 'skull'} height={14} />
          {k.hs && <Icon name="skull" height={13} color="var(--accent)" />}
          <span style={{ color: teamColor(k.victimTeam, mode, k.me) }}>{k.victim}</span>
        </div>
      ))}
    </div>
  )
}

function Notices() {
  const notices = useGameStore((s) => s.notices)
  return (
    <div className="dl-notices">
      {notices.map((n) => (
        <div key={n.id} className={`dl-notice ${n.tone}`}>
          {n.text}
        </div>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * Minimap (top-left): north-up, enemies only appear while firing
 * ------------------------------------------------------------------------- */

const MINIMAP_PX = 168

function Minimap() {
  const canvas = useRef(null)
  const base = useMemo(() => {
    const size = MINIMAP_PX * 2
    const c = document.createElement('canvas')
    c.width = size
    c.height = size
    const ctx = c.getContext('2d')
    const scale = size / (MAP_HALF * 2 + 3)
    const tx = (x) => size / 2 + x * scale
    ctx.fillStyle = 'rgba(214,160,106,0.10)'
    ctx.fillRect(tx(-MAP_HALF), tx(-MAP_HALF), MAP_HALF * 2 * scale, MAP_HALF * 2 * scale)
    for (const col of buildColliders()) {
      if (col.shape === 'box') {
        if (col.half[0] > 20 || col.half[2] > 20) continue
        const top = col.p[1] + col.half[1]
        ctx.fillStyle = top > 2.2 ? 'rgba(232,230,225,0.55)' : 'rgba(232,230,225,0.28)'
        ctx.beginPath()
        for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          const c3 = rotate3([sx * col.half[0], col.half[1], sz * col.half[2]], col.q)
          ctx.lineTo(tx(col.p[0] + c3[0]), tx(col.p[2] + c3[2]))
        }
        ctx.closePath()
        ctx.fill()
      } else {
        const axis = rotate3([0, 1, 0], col.q)
        if (Math.abs(axis[1]) > 0.9) {
          ctx.fillStyle = col.halfHeight * 2 > 2.2 ? 'rgba(232,230,225,0.55)' : 'rgba(232,230,225,0.28)'
          ctx.beginPath()
          ctx.arc(tx(col.p[0]), tx(col.p[2]), col.r * scale, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.strokeStyle = 'rgba(232,230,225,0.4)'
          ctx.lineWidth = col.r * 2 * scale
          ctx.lineCap = 'butt'
          ctx.beginPath()
          ctx.moveTo(tx(col.p[0] - axis[0] * col.halfHeight), tx(col.p[2] - axis[2] * col.halfHeight))
          ctx.lineTo(tx(col.p[0] + axis[0] * col.halfHeight), tx(col.p[2] + axis[2] * col.halfHeight))
          ctx.stroke()
        }
      }
    }
    ctx.strokeStyle = 'rgba(242,163,58,0.5)'
    ctx.lineWidth = 2
    ctx.strokeRect(tx(-MAP_HALF), tx(-MAP_HALF), MAP_HALF * 2 * scale, MAP_HALF * 2 * scale)
    return { canvas: c, scale, size }
  }, [])

  useAnimationFrame(() => {
    const el = canvas.current
    if (!el) return
    const ctx = el.getContext('2d')
    const { size, scale } = base
    const tx = (x) => size / 2 + x * scale
    ctx.clearRect(0, 0, size, size)
    ctx.drawImage(base.canvas, 0, 0)
    const { mode, team } = useGameStore.getState()
    const now = performance.now()
    for (const r of runtime.remotes.values()) {
      if (!r.alive) continue
      const friendly = mode === 'tdm' && r.team === team
      if (!friendly && now - (r.loudAt ?? 0) > 2500) continue
      ctx.fillStyle = friendly ? '#3FA9F5' : '#E5484D'
      ctx.beginPath()
      ctx.arc(tx(r.pos.x), tx(r.pos.z), friendly ? 5 : 6, 0, Math.PI * 2)
      ctx.fill()
    }
    const l = runtime.local
    if (l.alive) {
      ctx.save()
      ctx.translate(tx(l.feet.x), tx(l.feet.z))
      ctx.rotate(-l.yaw)
      ctx.fillStyle = '#F2A33A'
      ctx.beginPath()
      ctx.moveTo(0, -11)
      ctx.lineTo(7, 8)
      ctx.lineTo(0, 4)
      ctx.lineTo(-7, 8)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }
  })

  return <canvas ref={canvas} className="dl-minimap" width={base.size} height={base.size} />
}

/* ---------------------------------------------------------------------------
 * Scoreboard (hold Tab) — also reused on the match-end screen
 * ------------------------------------------------------------------------- */

export function ScoreTable({ highlightMvp = false }) {
  const room = useGameStore((s) => s.room)
  const mode = useGameStore((s) => s.mode)
  const myId = useGameStore((s) => s.myId)
  const players = room.players.filter((p) => p.state !== 'selecting')
  const sort = (list) => [...list].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
  const row = (p) => (
    <tr key={p.id} className={`${p.id === myId ? 'me' : ''} ${p.state === 'dead' ? 'dead' : ''}`}>
      <td style={{ color: teamColor(p.team, mode, p.id === myId) }}>
        {highlightMvp && p.id === room.mvp ? '★ ' : ''}
        {p.name}
      </td>
      <td>{p.kills}</td>
      <td>{p.deaths}</td>
      <td>{(p.kills / Math.max(1, p.deaths)).toFixed(2)}</td>
      <td className="dl-muted">{p.isBot ? 'BOT' : p.ping}</td>
    </tr>
  )
  const head = (
    <tr>
      <th>Player</th>
      <th>K</th>
      <th>D</th>
      <th>K/D</th>
      <th>Ping</th>
    </tr>
  )
  if (mode !== 'tdm') {
    return (
      <table>
        <thead>{head}</thead>
        <tbody>{sort(players).map(row)}</tbody>
      </table>
    )
  }
  return (
    <table>
      <thead>{head}</thead>
      {[TEAMS.ALPHA, TEAMS.BRAVO].map((t) => (
        <tbody key={t}>
          <tr className="teamhead">
            <td style={{ color: teamColor(t, mode) }}>{TEAM_LABELS[t]}</td>
            <td colSpan={4} style={{ color: teamColor(t, mode) }}>
              {t === TEAMS.ALPHA ? room.scoreAlpha : room.scoreBravo}
            </td>
          </tr>
          {sort(players.filter((p) => p.team === t)).map(row)}
        </tbody>
      ))}
    </table>
  )
}

function Scoreboard() {
  const open = useGameStore((s) => s.scoreboardOpen)
  const room = useGameStore((s) => s.room)
  if (!open) return null
  return (
    <div className="dl-panel dl-board">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="dl-h" style={{ fontSize: 22 }}>
          Scoreboard
        </div>
        <div className="dl-label">{fmtTime(room.timeLeft)} remaining</div>
      </div>
      <ScoreTable />
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * Misc
 * ------------------------------------------------------------------------- */

function LowHealth() {
  const hp = useGameStore((s) => s.hud.hp)
  return <div className="dl-vignette" style={{ opacity: hp < 35 ? 0.4 + (35 - hp) / 60 : 0 }} />
}

/**
 * Hurt audio: heavy, quickening breaths below 60 HP and a heartbeat below 35,
 * both fading out as health regenerates.
 */
function LowHealthAudio() {
  const next = useRef({ breath: 0, beat: 0, inhale: true })
  useAnimationFrame((t) => {
    const { hud, gameState } = useGameStore.getState()
    const n = next.current
    if (gameState !== 'playing' || hud.hp >= 60 || hud.hp <= 0) {
      n.breath = 0
      n.beat = 0
      return
    }
    const hurt = (60 - hud.hp) / 60
    if (t >= n.breath) {
      sfx.play(n.inhale ? 'breathIn' : 'breathOut', { strength: 0.4 + hurt * 0.8, volume: 0.7 })
      // Inhale-exhale pairs, quicker the more hurt you are.
      n.breath = t + (n.inhale ? 650 : 1250 - hurt * 600)
      n.inhale = !n.inhale
    }
    if (hud.hp < 35 && t >= n.beat) {
      sfx.play('heartbeat', { strength: 0.5 + hurt })
      n.beat = t + 950 - hurt * 350
    }
  })
  return null
}

function ResumePrompt() {
  const locked = useGameStore((s) => s.pointerLocked)
  const overlay = useGameStore((s) => s.overlay)
  const gameState = useGameStore((s) => s.gameState)
  if (locked || overlay || gameState !== 'playing') return null
  return (
    <div className="dl-resume">
      <Button className="primary" onClick={() => requestLock()}>
        Click to play
      </Button>
    </div>
  )
}

function Fps() {
  const ref = useRef(null)
  const frames = useRef([])
  useAnimationFrame((t) => {
    frames.current.push(t)
    while (frames.current.length && t - frames.current[0] > 1000) frames.current.shift()
    if (ref.current) ref.current.textContent = `${frames.current.length} FPS`
  })
  return <div className="dl-fps" ref={ref} />
}

export function HUD() {
  const gameState = useGameStore((s) => s.gameState)
  const showMinimap = useGameStore((s) => s.settings.minimap)
  const showFps = useGameStore((s) => s.settings.showFps)
  const alive = gameState === 'playing'

  return (
    <div className="dl-hud">
      <ScopeOverlay />
      <FlashOverlay />
      <LowHealth />
      {alive && (
        <>
          <LowHealthAudio />
          <Crosshair />
          <Hitmarker />
          <DamageMarks />
          <CookBar />
          <HealthBox />
          <AmmoBox />
        </>
      )}
      {showMinimap && <Minimap />}
      <TopBar />
      <KillFeed />
      <Notices />
      <Scoreboard />
      <ResumePrompt />
      {showFps && <Fps />}
    </div>
  )
}

export default HUD
