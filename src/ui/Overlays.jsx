import { useState } from 'react'

import { requestLock } from '../game/player/input.js'
import { net, weaponName } from '../net/network.js'
import { TEAM_LABELS, TEAMS } from '../shared/constants.js'
import { EQUIPMENT, WEAPONS } from '../shared/weapons.js'
import { toWireClass, useGameStore } from '../store/gameStore.js'
import { Button, Icon, RoomKey, WarmupBar } from './common.jsx'
import { useAnimationFrame } from './uiUtils.js'
import { ScoreTable } from './HUD.jsx'
import { SettingsPanel } from './Menus.jsx'

const closeOverlayAndResume = () => {
  const s = useGameStore.getState()
  useGameStore.setState({ overlay: null })
  // Clicking a button is a user gesture, so the browser allows re-locking here.
  if (s.gameState === 'playing' || s.gameState === 'dead') requestLock()
}

/* ---------------------------------------------------------------------------
 * Death
 * ------------------------------------------------------------------------- */

export function DeathScreen() {
  const death = useGameStore((s) => s.death)
  const mode = useGameStore((s) => s.mode)
  const pending = useGameStore((s) => s.pendingClass)
  const openOverlay = useGameStore((s) => s.openOverlay)
  const [left, setLeft] = useState(5)
  useAnimationFrame(() => {
    if (!death) return
    const v = Math.max(0, Math.ceil((death.respawnAt - performance.now()) / 1000))
    if (v !== left) setLeft(v)
  })
  if (!death) return null
  const killerColor =
    mode === 'tdm' ? (death.killerTeam === TEAMS.ALPHA ? 'var(--alpha)' : 'var(--bravo)') : 'var(--bad)'
  const iconName = WEAPONS[death.weapon] || EQUIPMENT[death.weapon] ? death.weapon : death.weapon === 'fall' ? 'fall' : 'skull'

  return (
    <div className="dl-death">
      <div className="dl-panel accent killer dl-slide-up">
        <div className="dl-label">{death.self ? 'You died' : 'Killed by'}</div>
        {!death.self && (
          <div className="dl-h" style={{ fontSize: 38, color: killerColor }}>
            {death.killerName}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 6 }}>
          <Icon name={iconName} height={18} />
          <span className="dl-h" style={{ fontSize: 18 }}>
            {weaponName(death.weapon)}
          </span>
          {death.headshot && (
            <span className="dl-tag" style={{ color: 'var(--accent)' }}>
              Headshot
            </span>
          )}
        </div>
        {!death.self && (
          <div className="dl-label" style={{ marginTop: 10 }}>
            Killer health <span style={{ color: 'var(--text)', fontSize: 16 }}>{death.killerHp}</span>
          </div>
        )}
      </div>
      <div style={{ textAlign: 'center' }}>
        <div className="dl-label">Respawn in</div>
        <div className="big">{left}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }} className="dl-interactive">
        <Button className="small" onClick={() => openOverlay('classPicker')}>
          [B] Change class
        </Button>
        {pending && <div className="dl-pending" style={{ fontFamily: 'var(--head)' }}>NEXT SPAWN: {pending.name}</div>}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * Match end
 * ------------------------------------------------------------------------- */

export function MatchEnd() {
  const matchEnd = useGameStore((s) => s.matchEnd)
  const room = useGameStore((s) => s.room)
  const mode = useGameStore((s) => s.mode)
  const team = useGameStore((s) => s.team)
  const myId = useGameStore((s) => s.myId)
  const [staying, setStaying] = useState(false)
  if (!matchEnd) return null

  let title
  let color = 'var(--text)'
  if (mode === 'tdm') {
    if (matchEnd.winner === 'draw') title = 'Draw'
    else if (matchEnd.winner === team) {
      title = 'Victory'
      color = team === TEAMS.ALPHA ? 'var(--alpha)' : 'var(--bravo)'
    } else {
      title = 'Defeat'
      color = 'var(--bad)'
    }
  } else if (matchEnd.winner === myId) {
    title = 'Victory'
    color = 'var(--accent)'
  } else {
    title = 'Defeat'
    color = 'var(--bad)'
  }
  const mvp = room.players.find((p) => p.id === matchEnd.mvp)
  const winnerName = mode === 'ffa' ? room.players.find((p) => p.id === matchEnd.winner)?.name : TEAM_LABELS[matchEnd.winner]

  return (
    <div className="dl-screen dark">
      <div className="dl-end">
        <div className="dl-banner" style={{ color, textShadow: `0 0 40px ${color}` }}>
          {title}
        </div>
        <div className="dl-label">
          {mode === 'tdm'
            ? `ALPHA ${room.scoreAlpha} — ${room.scoreBravo} BRAVO`
            : winnerName
              ? `${winnerName} wins`
              : ''}
        </div>
        {mvp && (
          <div className="dl-panel accent dl-mvp dl-slide-up">
            <span className="dl-tag" style={{ color: 'var(--accent)' }}>
              MVP
            </span>
            <span className="dl-h" style={{ fontSize: 26 }}>
              {mvp.name}
            </span>
            <span className="dl-label" style={{ color: 'var(--text)' }}>
              {mvp.kills} kills · {mvp.deaths} deaths
            </span>
          </div>
        )}
        <div className="dl-panel" style={{ padding: 18, width: 'min(880px, 92vw)' }}>
          <div className="dl-board" style={{ position: 'static', transform: 'none', width: '100%', padding: 0 }}>
            <ScoreTable highlightMvp />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Button className="primary" disabled={staying} onClick={() => setStaying(true)}>
            {staying ? `Next match in ${room.restartIn}s` : 'Play again'}
          </Button>
          <Button onClick={() => net.leave()}>Main menu</Button>
        </div>
        {!staying && (
          <div className="dl-muted" style={{ fontSize: 12 }}>
            Next match starts in {room.restartIn}s — teams are re-balanced.
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * ESC menu (the match keeps running behind it)
 * ------------------------------------------------------------------------- */

export function PauseMenu() {
  const openOverlay = useGameStore((s) => s.openOverlay)
  return (
    <div className="dl-screen overlay">
      <div className="dl-center">
        <div className="dl-panel accent dl-menu-panel dl-slide-up">
          <div className="dl-label">Match in progress — you can still be shot</div>
          <div className="dl-h" style={{ fontSize: 34, marginBottom: 8 }}>
            Menu
          </div>
          <RoomKey />
          <WarmupBar compact onStart={() => useGameStore.setState({ overlay: null })} />
          <Button className="primary" onClick={closeOverlayAndResume}>
            Resume
          </Button>
          <Button onClick={() => openOverlay('classPicker')}>Change class</Button>
          <Button onClick={() => openOverlay('settings')}>Settings</Button>
          <Button onClick={() => net.leave()}>Leave match</Button>
        </div>
      </div>
    </div>
  )
}

export function SettingsOverlay() {
  return (
    <div className="dl-screen dark">
      <SettingsPanel onBack={() => useGameStore.setState({ overlay: 'pause' })} />
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * In-game class picker (C). Never pauses; a change applies on the next spawn.
 * ------------------------------------------------------------------------- */

export function ClassPicker() {
  const classes = useGameStore((s) => s.classes)
  const activeClass = useGameStore((s) => s.activeClass)
  const pending = useGameStore((s) => s.pendingClass)
  const gameState = useGameStore((s) => s.gameState)
  const selectClass = useGameStore((s) => s.selectClass)
  const alive = gameState === 'playing'

  const pick = (c) => {
    selectClass(c.id)
    net.send('set_class', { classData: toWireClass(c) })
    if (alive && c.name !== activeClass?.name) {
      useGameStore.getState().pushNotice(`CLASS CHANGE WILL APPLY ON NEXT SPAWN: ${c.name}`, 2600)
    }
    useGameStore.setState({ pendingClass: { name: c.name } })
    closeOverlayAndResume()
  }

  return (
    <div className="dl-screen overlay">
      <div className="dl-frame" style={{ justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div className="dl-label">
              {alive ? 'Applies on your next spawn — the match keeps running' : 'Applies to your next spawn'}
            </div>
            <div className="dl-h" style={{ fontSize: 38 }}>
              Change class
            </div>
          </div>
          <Button className="small" onClick={closeOverlayAndResume}>
            Close
          </Button>
        </div>
        <div className="dl-class-strip">
          {classes.map((c, i) => {
            const current = activeClass?.name === c.name
            const queued = pending?.name === c.name
            return (
              <Button key={c.id} className={`dl-class-chip dl-slide-up ${queued || (!pending && current) ? 'selected' : ''}`} style={{ animationDelay: `${i * 30}ms` }} onClick={() => pick(c)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <span className="name">{c.name}</span>
                  <Icon name={c.primary} height={14} />
                </div>
                <div className="line">
                  {WEAPONS[c.primary].short} · {WEAPONS[c.secondary]?.short} · {EQUIPMENT[c.tactical].name}
                </div>
                {current && <div className="line" style={{ color: 'var(--accent)' }}>CURRENT</div>}
                {queued && !current && <div className="line" style={{ color: 'var(--accent)' }}>NEXT SPAWN</div>}
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
