import { useEffect, useRef, useState } from 'react'

import { releaseLock, touchAiming, touchLook, touchMouse, touchMove, touchPress, touchRelease, touchSwap } from '../game/player/input.js'
import { useGameStore } from '../store/gameStore.js'

/**
 * On-screen controls for phones and tablets, laid over the game while you play.
 *
 *  - Left side: a floating stick, wherever your thumb lands. Pushed all the way
 *    forward, you sprint.
 *  - Right side: drag anywhere to look. The fire button looks too while held,
 *    so you can shoot and track at once.
 *  - A cluster round the fire button (aim, jump, crouch, reload, swap, grenades,
 *    knife), a second fire button on the left, and pause / scores up top.
 *
 * Sizes are in `--u` (1% of the screen height, capped for tablets) and placed
 * clear of the HUD, which the touch layout moves out of their way (ui.css,
 * `.dl-touch`). Everything feeds the same input state the keyboard and mouse
 * do (game/player/input.js).
 */

/** Finger drag to view turn, relative to the same distance of mouse movement. */
const LOOK_GAIN = 1.6
/** Stick travel, in --u. */
const STICK_RADIUS = 11
/** How far forward (0..1) and how hard the stick must be pushed to sprint. */
const SPRINT_AT = 0.8

const unit = () => Math.min(window.innerHeight / 100, 5.2)

/** The cluster round the fire button: centres and radii in --u from the bottom-right corner. */
const RIGHT = [
  { id: 'fire', cx: 20, cy: 22, r: 10, label: 'Fire', icon: 'fire' },
  { id: 'aim', cx: 37.5, cy: 11, r: 6.5, label: 'Aim', icon: 'aim' },
  { id: 'crouch', cx: 8, cy: 8, r: 6, label: 'Crouch', icon: 'crouch', code: 'Touch:crouch' },
  { id: 'jump', cx: 7, cy: 37, r: 6, label: 'Jump', icon: 'jump', code: 'Touch:jump' },
  { id: 'reload', cx: 34, cy: 31, r: 5.5, label: 'Reload', icon: 'reload', code: 'Touch:reload' },
  { id: 'swap', cx: 20, cy: 44, r: 5.5, label: 'Swap', icon: 'swap' },
  { id: 'lethal', cx: 33, cy: 46, r: 5, label: 'Frag', icon: 'frag', code: 'Touch:lethal' },
  { id: 'tactical', cx: 45, cy: 39, r: 5, label: 'Tac', icon: 'tactical', code: 'Touch:tactical' },
  { id: 'knife', cx: 47, cy: 24, r: 5, label: 'Knife', icon: 'knife', code: 'Touch:knife' },
]
/** The left fire button: from the bottom-left corner. */
const LEFT_FIRE = { id: 'fireL', cx: 10, cy: 40, r: 6, label: 'Fire', icon: 'fire' }

const PATHS = {
  fire: 'M12 3v5M12 16v5M3 12h5M16 12h5M12 12h.01M17.5 12a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z',
  aim: 'M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  crouch: 'M6 9l6 6 6-6',
  jump: 'M6 15l6-6 6 6',
  reload: 'M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5',
  swap: 'M7 7h12l-3-3M17 17H5l3 3',
  frag: 'M12 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM10 9V6h4v3M14 6l3-2',
  tactical: 'M8 9h8v11H8zM10 6h4v3h-4z',
  knife: 'M4 20l9-9M13 11l7-7-1 6-6 4',
  pause: 'M8 5v14M16 5v14',
  scores: 'M4 6h16M4 12h16M4 18h16',
}

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  )
}

/** Where a cluster button sits, as inline style. */
const place = ({ cx, cy, r }, side = 'right') => ({
  [side]: `calc(var(--u) * ${cx - r})`,
  bottom: `calc(var(--u) * ${cy - r})`,
  width: `calc(var(--u) * ${r * 2})`,
  height: `calc(var(--u) * ${r * 2})`,
})

export function TouchControls({ scale }) {
  const surface = useRef(null)
  const base = useRef(null)
  const knob = useRef(null)
  const st = useRef({ stick: null, look: null, fire: new Map() })
  const [aiming, setAiming] = useState(false)
  const scoreboardOpen = useGameStore((s) => s.scoreboardOpen)

  // Clean slate on the way in and out (an overlay, death, leaving the match).
  useEffect(() => {
    touchMouse('right', false)
    return () => {
      touchMouse('left', false)
      touchMouse('right', false)
      touchMove(0, 0)
      touchRelease('Touch:sprint')
      useGameStore.setState({ scoreboardOpen: false })
    }
  }, [])

  const showStick = (x, y, kx = 0, ky = 0) => {
    const b = base.current
    const k = knob.current
    if (!b || !k) return
    b.style.opacity = '1'
    b.style.transform = `translate(${x}px, ${y}px)`
    k.style.transform = `translate(${x + kx}px, ${y + ky}px)`
    k.style.opacity = '1'
  }
  const hideStick = () => {
    if (base.current) base.current.style.opacity = '0'
    if (knob.current) knob.current.style.opacity = '0'
  }

  /** The background: left side drives the stick, right side looks. */
  const onSurfaceDown = (e) => {
    if (e.target !== surface.current) return
    const s = st.current
    e.currentTarget.setPointerCapture(e.pointerId)
    if (e.clientX < window.innerWidth * 0.45) {
      if (s.stick) return
      s.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY }
      showStick(e.clientX, e.clientY)
    } else if (!s.look) {
      s.look = { id: e.pointerId, x: e.clientX, y: e.clientY }
    }
  }
  const onSurfaceMove = (e) => {
    const s = st.current
    if (s.stick?.id === e.pointerId) {
      const R = STICK_RADIUS * unit()
      let dx = e.clientX - s.stick.ox
      let dy = e.clientY - s.stick.oy
      const len = Math.hypot(dx, dy)
      // Past the rim the stick's base follows the thumb, so it never needs re-planting.
      if (len > R) {
        s.stick.ox += (dx / len) * (len - R)
        s.stick.oy += (dy / len) * (len - R)
        dx = e.clientX - s.stick.ox
        dy = e.clientY - s.stick.oy
      }
      touchMove(dx / R, -dy / R)
      const sprint = -dy / R > SPRINT_AT && Math.hypot(dx, dy) > R * 0.95
      if (sprint) touchPress('Touch:sprint')
      else touchRelease('Touch:sprint')
      showStick(s.stick.ox, s.stick.oy, dx, dy)
    } else if (s.look?.id === e.pointerId) {
      touchLook((e.clientX - s.look.x) * LOOK_GAIN, (e.clientY - s.look.y) * LOOK_GAIN)
      s.look.x = e.clientX
      s.look.y = e.clientY
    }
  }
  const onSurfaceUp = (e) => {
    const s = st.current
    if (s.stick?.id === e.pointerId) {
      s.stick = null
      touchMove(0, 0)
      touchRelease('Touch:sprint')
      hideStick()
    } else if (s.look?.id === e.pointerId) {
      s.look = null
    }
  }

  /** A button: press on touch, release on lift (the pointer is captured, so sliding off doesn't drop it). */
  const button = (b, side = 'right') => {
    const down = (e) => {
      e.stopPropagation()
      e.currentTarget.setPointerCapture(e.pointerId)
      e.currentTarget.classList.add('on')
      if (b.code) touchPress(b.code)
      else if (b.icon === 'fire') {
        st.current.fire.set(e.pointerId, { x: e.clientX, y: e.clientY })
        touchMouse('left', true)
      } else if (b.id === 'aim') {
        const on = !touchAiming()
        touchMouse('right', on)
        setAiming(on)
      } else if (b.id === 'swap') {
        touchSwap()
      }
    }
    const move = (e) => {
      // Held fire also looks, so you can track a target while shooting.
      const f = st.current.fire.get(e.pointerId)
      if (!f) return
      touchLook((e.clientX - f.x) * LOOK_GAIN, (e.clientY - f.y) * LOOK_GAIN)
      f.x = e.clientX
      f.y = e.clientY
    }
    const up = (e) => {
      e.stopPropagation()
      e.currentTarget.classList.remove('on')
      if (b.code) touchRelease(b.code)
      else if (b.icon === 'fire') {
        st.current.fire.delete(e.pointerId)
        if (!st.current.fire.size) touchMouse('left', false)
      }
    }
    return (
      <div
        key={b.id}
        className={`dl-tc-btn ${b.id === 'fire' || b.id === 'fireL' ? 'fire' : ''} ${b.id === 'aim' && aiming ? 'latched' : ''}`}
        style={place(b, side)}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <Icon name={b.icon} />
        {b.r >= 6 && <span>{b.label}</span>}
      </div>
    )
  }

  // Pause and scores sit between the portal's own buttons (top-left) and the score bar.
  const topLeft = `calc(50% - ${Math.round(215 * scale) + 8}px - var(--u) * 21)`

  return (
    <div
      className="dl-tc"
      ref={surface}
      onPointerDown={onSurfaceDown}
      onPointerMove={onSurfaceMove}
      onPointerUp={onSurfaceUp}
      onPointerCancel={onSurfaceUp}
    >
      <div className="dl-tc-stick" ref={base} />
      <div className="dl-tc-knob" ref={knob} />
      {RIGHT.map((b) => button(b))}
      {button(LEFT_FIRE, 'left')}
      <div className="dl-tc-top" style={{ left: topLeft }}>
        <div
          className="dl-tc-small"
          onPointerDown={(e) => {
            e.stopPropagation()
            releaseLock()
          }}
        >
          <Icon name="pause" />
        </div>
        <div
          className={`dl-tc-small ${scoreboardOpen ? 'latched' : ''}`}
          onPointerDown={(e) => {
            e.stopPropagation()
            useGameStore.setState((s) => ({ scoreboardOpen: !s.scoreboardOpen }))
          }}
        >
          <Icon name="scores" />
        </div>
      </div>
    </div>
  )
}

export default TouchControls
