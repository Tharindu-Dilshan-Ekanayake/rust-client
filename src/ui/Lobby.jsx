import { useEffect, useRef, useState } from 'react'

import { sfx } from '../audio/sfx.js'
import { requestLock } from '../game/player/input.js'
import { net } from '../net/network.js'
import { MATCH_RULES, MODE_LABELS, TEAM_LABELS, TEAMS } from '../shared/constants.js'
import { EQUIPMENT, WEAPONS } from '../shared/weapons.js'
import { toWireClass, useGameStore } from '../store/gameStore.js'
import { Button, Icon, RoomKey, WarmupBar } from './common.jsx'
import { goFullscreen } from './mobile.js'
import { useAnimationFrame } from './uiUtils.js'

function useSecondsLeft(deadline) {
  const [left, setLeft] = useState(() => Math.max(0, Math.ceil((deadline - performance.now()) / 1000)))
  useAnimationFrame(() => {
    const v = Math.max(0, Math.ceil((deadline - performance.now()) / 1000))
    if (v !== left) setLeft(v)
  })
  return left
}

function PingTag({ p }) {
  if (p.isBot) return <span className="ping">BOT</span>
  const color = p.ping < 80 ? 'var(--good)' : p.ping < 160 ? 'var(--accent)' : 'var(--bad)'
  return (
    <span className="ping" style={{ color }}>
      {p.ping} ms
    </span>
  )
}

export function Connecting() {
  const connection = useGameStore((s) => s.connection)
  const mode = useGameStore((s) => s.mode)
  const failed = connection.status === 'error'
  return (
    <div className="dl-screen dark">
      <div className="dl-center" style={{ flexDirection: 'column', gap: 18, textAlign: 'center' }}>
        {!failed && <div className="dl-loader" />}
        <div className="dl-h" style={{ fontSize: 34 }}>
          {failed ? 'Connection failed' : 'Connecting…'}
        </div>
        <div className="dl-label">{MODE_LABELS[mode]}</div>
        {!failed && connection.note && (
          <div className="dl-muted" style={{ fontSize: 13 }}>
            {connection.note}
          </div>
        )}
        {failed && (
          <>
            <div className="dl-muted" style={{ maxWidth: 460, fontSize: 13 }}>
              {connection.error}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button className="primary small" onClick={() => (net.retry ? net.retry() : net.join(mode))}>
                Retry
              </Button>
              <Button className="small" onClick={() => net.leave()}>
                Back
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function humansOn(players, team) {
  return players.filter((p) => !p.isBot && p.team === team).length
}

/** Humans per team: half the room (4 in public rooms, less in small private ones). */
const teamSizeOf = (maxPlayers) => Math.ceil((maxPlayers || MATCH_RULES.tdm.teamSize * 2) / 2)

/** Mirrors the server rule: you can't join a team that would end up 2+ humans bigger. */
function canJoin(players, team, teamSize) {
  const mine = humansOn(players, team)
  const theirs = humansOn(players, team === TEAMS.ALPHA ? TEAMS.BRAVO : TEAMS.ALPHA)
  return mine < teamSize && mine + 1 - theirs <= 1
}

function Roster({ players, myId }) {
  return (
    <div className="dl-roster">
      {players.length === 0 && <div className="dl-muted" style={{ fontSize: 13 }}>No players yet</div>}
      {players.map((p, i) => (
        <div key={p.id} className={`row ${p.id === myId ? 'you' : ''} ${p.isBot ? 'bot' : ''}`} style={{ animationDelay: `${i * 40}ms` }}>
          <span>
            {p.name}
            {p.id === myId ? '  (YOU)' : ''}
          </span>
          <PingTag p={p} />
        </div>
      ))}
    </div>
  )
}

export function TeamSelect() {
  const room = useGameStore((s) => s.room)
  const myId = useGameStore((s) => s.myId)
  const deadline = useGameStore((s) => s.teamSelect.deadline)
  const teamSize = teamSizeOf(useGameStore((s) => s.maxPlayers))
  const left = useSecondsLeft(deadline)
  const players = room.players
  const [hover, setHover] = useState('')

  const choose = (team) => net.send('choose_team', { team })
  const undecided = players.filter((p) => !p.isBot && !p.team)

  const renderTeam = (team, i) => {
    const roster = players.filter((p) => p.team === team).sort((a, b) => Number(a.isBot) - Number(b.isBot))
    const humans = humansOn(players, team)
    const ok = canJoin(players, team, teamSize)
    const color = team === TEAMS.ALPHA ? 'var(--alpha)' : 'var(--bravo)'
    return (
      <div
        key={team}
        className={`dl-panel dl-team ${team} dl-slide-up`}
        style={{ animationDelay: `${i * 70}ms`, boxShadow: hover === team && ok ? `0 0 0 1px ${color}, 0 0 26px ${color}55` : undefined }}
        onMouseEnter={() => setHover(team)}
        onMouseLeave={() => setHover('')}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 className="dl-h" style={{ color }}>
            {TEAM_LABELS[team]}
          </h2>
          <span className="count">
            {humans}/{teamSize}
          </span>
        </div>
        <Roster players={roster} myId={myId} />
        <Button disabled={!ok} onClick={() => choose(team)} style={{ borderColor: ok ? color : undefined }}>
          Join {TEAM_LABELS[team]}
        </Button>
        {!ok && <div className="dl-tooltip">Team full - unbalanced</div>}
      </div>
    )
  }

  return (
    <div className="dl-screen dark">
      <div className="dl-center" style={{ flexDirection: 'column', gap: 22 }}>
        <div style={{ textAlign: 'center' }}>
          <div className="dl-label">Team deathmatch · {room.players.length} in lobby</div>
          <div className="dl-h" style={{ fontSize: 40 }}>
            Choose your side
          </div>
          <RoomKey style={{ justifyContent: 'center', marginTop: 8 }} />
        </div>
        <div className="dl-teams">
          {renderTeam(TEAMS.ALPHA, 0)}
          <div className="dl-middle">
            <div className="dl-countdown">{left}</div>
            <div className="dl-label">Auto assign in</div>
            <Button className="primary" style={{ textAlign: 'center' }} onClick={() => choose('auto')}>
              Auto assign
            </Button>
            <div className="dl-label" style={{ color: 'var(--accent)' }}>
              Recommended
            </div>
            {undecided.length > 1 && <div className="dl-muted" style={{ fontSize: 11 }}>{undecided.length - 1} other player(s) choosing</div>}
          </div>
          {renderTeam(TEAMS.BRAVO, 1)}
        </div>
      </div>
    </div>
  )
}

function classLine(c) {
  return `${WEAPONS[c.primary].name} · ${WEAPONS[c.secondary]?.short ?? 'P9'} · ${EQUIPMENT[c.tactical].name}`
}

export function DeploySelect() {
  const classes = useGameStore((s) => s.classes)
  const selectedId = useGameStore((s) => s.selectedClassId)
  const selectClass = useGameStore((s) => s.selectClass)
  const deadline = useGameStore((s) => s.deployDeadline)
  const room = useGameStore((s) => s.room)
  const myId = useGameStore((s) => s.myId)
  const team = useGameStore((s) => s.team)
  const mode = useGameStore((s) => s.mode)
  const left = useSecondsLeft(deadline)
  const deployed = useRef(false)
  const lastTick = useRef(left)

  const deploy = (gesture) => {
    if (deployed.current) return
    deployed.current = true
    const s = useGameStore.getState()
    const cls = s.getClass(s.selectedClassId)
    net.send('spawn_request', { classData: toWireClass(cls) })
    sfx.play('uiDeploy')
    if (gesture) {
      goFullscreen()
      requestLock()
    }
  }

  useEffect(() => {
    deployed.current = false
  }, [deadline])

  useEffect(() => {
    if (left !== lastTick.current && left > 0 && left <= 3) sfx.play('countdown')
    lastTick.current = left
    if (left === 0) deploy(false)
  }, [left])

  const players = [...room.players].filter((p) => p.state !== 'selecting')
  const mates = mode === 'tdm' ? players.filter((p) => p.team === team) : players
  const others = mode === 'tdm' ? players.filter((p) => p.team && p.team !== team) : []
  const color = team === TEAMS.ALPHA ? 'var(--alpha)' : team === TEAMS.BRAVO ? 'var(--bravo)' : 'var(--accent)'

  return (
    <div className="dl-screen dim">
      <div className="dl-frame" style={{ justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <div className="dl-label">
              {MODE_LABELS[mode]}
              {mode === 'tdm' && team && (
                <>
                  {' · '}
                  <span style={{ color }}>TEAM {TEAM_LABELS[team]}</span>
                </>
              )}
            </div>
            <div className="dl-h" style={{ fontSize: 40 }}>
              Select class
            </div>
            <RoomKey style={{ marginTop: 4 }} />
            <WarmupBar compact />
          </div>
          <div className="dl-panel" style={{ padding: 14, minWidth: 300, maxHeight: 260, overflowY: 'auto' }}>
            <div className="dl-label" style={{ marginBottom: 8 }}>
              {mode === 'tdm' ? 'Your team' : 'Lobby'} · {players.length} players
            </div>
            <Roster players={mates} myId={myId} />
            {others.length > 0 && (
              <>
                <div className="dl-label" style={{ margin: '10px 0 6px' }}>
                  Enemy
                </div>
                <Roster players={others} myId={myId} />
              </>
            )}
          </div>
        </div>
        <div className="dl-class-strip">
          {classes.map((c, i) => (
            <Button
              key={c.id}
              className={`dl-class-chip dl-slide-up ${c.id === selectedId ? 'selected' : ''}`}
              style={{ animationDelay: `${i * 35}ms` }}
              onClick={() => selectClass(c.id)}
              onDoubleClick={() => deploy(true)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <span className="name">{c.name}</span>
                <Icon name={c.primary} height={14} />
              </div>
              <div className="line">{classLine(c)}</div>
            </Button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button className="primary" style={{ fontSize: 26, padding: '14px 40px' }} onClick={() => deploy(true)}>
            Deploy
          </Button>
          <div>
            <div className="dl-label">Auto-deploy in</div>
            <div className="dl-h" style={{ fontSize: 30, color: 'var(--accent)' }}>
              {left}s
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <Button className="small ghost" onClick={() => net.leave()}>
            Leave
          </Button>
        </div>
      </div>
    </div>
  )
}
