import { useState } from 'react'

import { net } from '../net/network.js'
import { useGameStore } from '../store/gameStore.js'
import { uiClick, uiHover } from './uiUtils.js'

/** Themed button with hover/click ticks. */
export function Button({ className = '', onClick, children, ...props }) {
  return (
    <button
      type="button"
      className={`dl-btn ${className}`}
      onMouseEnter={props.disabled ? undefined : uiHover}
      onClick={(e) => {
        uiClick()
        onClick?.(e)
      }}
      {...props}
    >
      {children}
    </button>
  )
}

/* ---------------------------------------------------------------------------
 * Weapon / equipment silhouettes (kill feed, HUD, class cards)
 * ------------------------------------------------------------------------- */

const PATHS = {
  ar: 'M2 9h6l1-2h20l1 1h12v2h4v2H42l-2 1H31l-3 6h-4l2-6h-4l-2 2h-3l1-3H9l-4 3H2l2-4z',
  sniper: 'M1 9h7l2-2h14l1-1h10v1h4l1 1h16v2H42l-3 1H29l-2 5h-4l1-5h-6l-6 4H6l3-4H2z',
  pistol: 'M4 5h22v4H16l-3 9H7l3-9H4z',
  viper: 'M1 5h17V4h7l2 1v4l-1 1v2l-3 7h-5l2-6h-3l-1 2h-2v-3H9V8H1z',
  hornet: 'M3 5h25v4h-8l-1 2h-3l-1 10h-5l1-10H9V9H3z',
  knife: 'M2 9h9l1-2h2v2h22l-6 4H14v1h-2l-1-2H2z',
  frag: 'M10 4h4v2h2a6 6 0 1 1-8 0h2z',
  flash: 'M8 3h8v2h-1v12h1v2H8v-2h1V5H8z',
  smoke: 'M8 3h8v2h-1v12h1v2H8v-2h1V5H8zM11 8h2v6h-2z',
  fall: 'M10 2l6 8h-4v10h-4V10H4z',
  skull: 'M12 2a8 8 0 0 0-8 8v4l3 2v4h10v-4l3-2v-4a8 8 0 0 0-8-8zm-3 9a2 2 0 1 1 0 .1zm6 0a2 2 0 1 1 0 .1z',
}
const VIEWBOX = {
  ar: '0 0 50 20',
  sniper: '0 0 60 20',
  pistol: '0 0 28 20',
  viper: '0 0 30 20',
  hornet: '0 0 30 22',
  knife: '0 0 38 20',
  frag: '0 0 24 22',
  flash: '0 0 24 22',
  smoke: '0 0 24 22',
  fall: '0 0 20 22',
  skull: '0 0 24 22',
}

export function Icon({ name, height = 16, color = 'currentColor', style }) {
  const d = PATHS[name] ?? PATHS.ar
  return (
    <svg viewBox={VIEWBOX[name] ?? VIEWBOX.ar} height={height} style={{ fill: color, display: 'block', ...style }} aria-hidden>
      <path d={d} />
    </svg>
  )
}

/** "ROOM KEY · ABC123" with a copy button, shown only inside private rooms. */
export function RoomKey({ style }) {
  const code = useGameStore((s) => s.roomCode)
  const [copied, setCopied] = useState(false)
  if (!code) return null
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked: the key is on screen to read out anyway.
    }
  }
  return (
    <div className="dl-roomkey" style={style}>
      <span className="dl-label">Room key</span>
      <span className="code">{code}</span>
      <button type="button" onClick={copy}>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

/**
 * Private-room warm-up banner. Everyone sees that the clock hasn't started; the
 * host also gets the Start button (`onStart` runs after the match is started).
 */
export function WarmupBar({ onStart, compact = false }) {
  const phase = useGameStore((s) => s.room.phase)
  const host = useGameStore((s) => s.room.host)
  const myId = useGameStore((s) => s.myId)
  const hostName = useGameStore((s) => s.room.players.find((p) => p.id === s.room.host)?.name ?? '')
  if (phase !== 'warmup') return null
  const isHost = host === myId
  return (
    <div className={`dl-warmup ${compact ? 'compact' : ''}`}>
      <div>
        <div className="dl-label" style={{ color: 'var(--accent)' }}>
          Warm-up
        </div>
        <div className="text">
          {isHost ? 'Your friends can join with the room key. Start when everyone is in.' : `Waiting for ${hostName || 'the host'} to start the match.`}
        </div>
      </div>
      {isHost && (
        <Button
          className="primary small"
          onClick={() => {
            net.startMatch()
            onStart?.()
          }}
        >
          Start match
        </Button>
      )}
    </div>
  )
}
