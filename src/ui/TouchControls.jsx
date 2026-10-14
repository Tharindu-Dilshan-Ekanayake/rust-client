import { useEffect, useRef, useState } from 'react'

import { releaseLock, touchAiming, touchLook, touchMouse, touchMove, touchPress, touchRelease, touchSwap } from '../game/player/input.js'
import { runtime } from '../game/runtime.js'
import { useGameStore } from '../store/gameStore.js'
import { useAnimationFrame } from './uiUtils.js'

/**
 * On-screen controls for phones and tablets, laid over the game while you play.
 * See-through glass buttons with icons only (no labels), so they hide as little
 * of the game as possible; how solid they are is a setting (Button opacity).
 *
 *  - Left side: a stick, shown at rest bottom-left and jumping to wherever your
 *    thumb lands on that side. Pushed all the way forward, you sprint.
 *  - Right side: drag anywhere to look. The fire button looks too while held,
 *    so you can shoot and track at once.
 *  - A cluster round the fire button (aim, jump, crouch, reload, swap, grenades,
 *    knife), a second fire button on the left, and pause / scores up top.
 *  - Search & Destroy: a hold-to-plant / defuse button left of the cluster,
 *    only while you're somewhere you can use it.
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
  { id: 'fire', cx: 20, cy: 22, r: 10, label: 'Fire', icon: 'bullet' },
  { id: 'aim', cx: 37.5, cy: 11, r: 6.5, label: 'Aim', icon: 'aim' },
  { id: 'crouch', cx: 8, cy: 8, r: 6, label: 'Crouch', icon: 'crouch', code: 'Touch:crouch' },
  { id: 'jump', cx: 7, cy: 37, r: 6, label: 'Jump', icon: 'jump', code: 'Touch:jump' },
  { id: 'reload', cx: 34, cy: 31, r: 5.5, label: 'Reload', icon: 'reload', code: 'Touch:reload' },
  { id: 'swap', cx: 20, cy: 44, r: 5.5, label: 'Swap', icon: 'swap' },
  { id: 'lethal', cx: 33, cy: 46, r: 5, label: 'Lethal', icon: 'frag', code: 'Touch:lethal' },
  { id: 'tactical', cx: 45, cy: 39, r: 5, label: 'Tactical', icon: 'tactical', code: 'Touch:tactical' },
  { id: 'knife', cx: 47, cy: 24, r: 5, label: 'Knife', icon: 'knife', code: 'Touch:knife' },
]
const RIGHT_LETHAL = RIGHT.find((b) => b.id === 'lethal')
/** The left fire button: from the bottom-left corner. */
const LEFT_FIRE = { id: 'fireL', cx: 10, cy: 40, r: 6, label: 'Fire', icon: 'bullet' }
/** Where the stick rests when no thumb is on it: from the bottom-left corner, in --u. */
const STICK_REST = { cx: 22, cy: 21 }
/** Search & Destroy's plant / defuse button: from the bottom-right corner, clear of the cluster. */
const USE_BTN = { cx: 64, cy: 15, r: 8.5 }

/**
 * Icons on a 24 x 24 grid, as parts: `f` filled silhouettes (the cartridge,
 * magazine, grenade, knife, heads), the rest drawn as thick round lines.
 */
const ICONS = {
  bullet: [
    { f: 1, d: 'M12 1.8c1.9 1.7 2.9 3.9 2.9 6.4v.9H9.1v-.9c0-2.5 1-4.7 2.9-6.4z' },
    { f: 1, d: 'M9.1 10.2h5.8v9.4H9.1z' },
    { f: 1, d: 'M8.2 20.4h7.6v1.9H8.2z' },
  ],
  aim: [
    { d: 'M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14z' },
    { d: 'M12 1.8v5.4M12 16.8v5.4M1.8 12h5.4M16.8 12h5.4' },
    { f: 1, d: 'M12 13.3a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6z' },
  ],
  crouch: [
    { f: 1, d: 'M14.6 6.4a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6z' },
    { d: 'M13.6 8.6l-2.6 5.4 5 1.6v5.2M11 14l-2 5.6h3.2M12.8 10.4l5.6 1.4h3' },
  ],
  jump: [
    { f: 1, d: 'M12 6a2.3 2.3 0 1 0 0-4.6A2.3 2.3 0 0 0 12 6z' },
    { d: 'M12 8.2v6M7.6 9.6l4.4-1.4 4.4 1.4M12 14.2l-3.6 2.6.8 3.4M12 14.2l3.6 2.6-.8 3.4M4 22h4M16 22h4' },
  ],
  reload: [
    { d: 'M9.4 2.4h5.2l-.6 5c1.8 2.8 2.8 6.2 2.8 9.8v4.4H7.2v-4.4c0-3.6 1-7 2.8-9.8zM9.6 15.4h4.8' },
    { f: 1, d: 'M10.4 4.2h3.2v1.6h-3.2z' },
  ],
  swap: [{ d: 'M4 8h13.5l-3-3M20 16H6.5l3 3' }],
  frag: [
    { f: 1, d: 'M12 22.2a6.2 6.4 0 1 0 0-12.8 6.2 6.4 0 0 0 0 12.8zM9.6 6.2h4.8v3.6H9.6z' },
    { d: 'M14.4 7.2l3.6-2.6v4.4M8.4 6.4a2.4 2.4 0 1 1 1.6-2.2' },
  ],
  semtex: [
    { f: 1, d: 'M7 10h10v10.6a1.4 1.4 0 0 1-1.4 1.4H8.4A1.4 1.4 0 0 1 7 20.6zM9.4 6.4h5.2V9H9.4z' },
    { d: 'M12 6.4V3.4h3.6' },
  ],
  c4: [
    { f: 1, d: 'M2.5 12h19v8.5h-19zM8 8.4h6V12H8z' },
    { d: 'M13 8.4V3.6' },
  ],
  claymore: [
    { f: 1, d: 'M3.5 7c5.6-1.6 11.4-1.6 17 0v8.6c-5.6-1.4-11.4-1.4-17 0zM8 3.4h2v2.6H8zM14 3.4h2v2.6h-2z' },
    { d: 'M7 15.4l-2.2 6M17 15.4l2.2 6' },
  ],
  detonator: [
    { f: 1, d: 'M8 7.4h8v14.4H8zM16 10.4h2.6v4.2H16z' },
    { d: 'M13.6 7.4V2.6' },
  ],
  tactical: [
    { f: 1, d: 'M8 8.6h8v13.6H8zM9.6 5h4.8v2.6H9.6z' },
    { d: 'M14.4 6l3.4-2.6v5' },
  ],
  knife: [
    { f: 1, d: 'M6 18.2L17 6.6c1.6-1.7 3.4-3.1 5.2-4.4-.9 2.4-2.2 4.6-3.8 6.4L7.8 20z' },
    { d: 'M5.2 15.6l3.4 3.4M2.2 21.8l3.4-3.4' },
  ],
  bomb: [
    { f: 1, d: 'M3 9.5h18v10.5H3zM6 12.5v4.5h8v-4.5zM16.4 13.6v2h2v-2z' },
    { d: 'M9 9.5V7.2C9 5.4 10.4 4 12.2 4H15M18 9.5V7.5' },
  ],
  defuse: [
    { d: 'M9.4 2.6L12 9.4l2.6-6.8M12 10.6L7.6 21.4M12 10.6l4.4 10.8' },
    { f: 1, d: 'M12 12.2a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2z' },
  ],
  pause: [{ d: 'M8.5 5v14M15.5 5v14' }],
  scores: [{ d: 'M4 6h16M4 12h16M4 18h16' }],
}

/** A control's icon, as drawn on its button (the settings page lists them). */
export function TouchIcon({ name }) {
  return <Icon name={name} />
}

function Icon({ name, className }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      {ICONS[name].map((p, i) => (
        <path key={i} d={p.d} className={p.f ? 'solid' : undefined} />
      ))}
    </svg>
  )
}

/** The stick's base: a ring with an arrow at each point of the compass. */
function StickBase() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="47" className="rim" />
      <circle cx="50" cy="50" r="38" className="inner" />
      <path d="M43 17l7-7 7 7M43 83l7 7 7-7M17 43l-7 7 7 7M83 43l7 7-7 7" className="arrows" />
    </svg>
  )
}

/**
 * Hold to plant or defuse (Search & Destroy): there only while holding Use
 * would do something, with a ring that fills as the server counts it down.
 */
function UseButton() {
  const hint = useGameStore((s) => s.useHint)
  const ring = useRef(null)
  const held = useRef(false)
  const release = () => {
    if (!held.current) return
    held.current = false
    touchRelease('Touch:use')
  }
  // Let go when the button goes (planted, walked off) or the controls close.
  useEffect(() => {
    if (!hint) release()
  }, [hint])
  useEffect(() => release, [])
  useAnimationFrame(() => {
    const el = ring.current
    if (!el) return
    const s = runtime.snd
    const mine = Boolean(s.action) && s.by === useGameStore.getState().myId
    el.style.strokeDashoffset = String(100 - (mine ? s.progress : 0) * 100)
  })
  if (!hint) return null
  return (
    <div
      className={`dl-tc-btn use ${hint}`}
      style={place(USE_BTN)}
      role="button"
      aria-label={hint === 'plant' ? 'Plant the bomb' : 'Defuse the bomb'}
      onPointerDown={(e) => {
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        e.currentTarget.classList.add('on')
        held.current = true
        touchPress('Touch:use')
      }}
      onPointerUp={(e) => {
        e.stopPropagation()
        e.currentTarget.classList.remove('on')
        release()
      }}
      onPointerCancel={(e) => {
        e.currentTarget.classList.remove('on')
        release()
      }}
    >
      <svg className="dl-use-ring" viewBox="0 0 40 40" aria-hidden="true">
        <circle ref={ring} cx="20" cy="20" r="18" pathLength="100" />
      </svg>
      <Icon name={hint === 'plant' ? 'bomb' : 'defuse'} className="glyph" />
      <span className="lbl">{hint === 'plant' ? 'PLANT' : 'DEFUSE'}</span>
    </div>
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
  // The lethal button wears the class's lethal, and turns into the detonator while a C4 is out.
  const lethalKind = useGameStore((s) => s.hud.lethalKind)
  const c4Out = useGameStore((s) => s.hud.c4Out)
  const opacity = useGameStore((s) => s.settings.touchOpacity ?? 0.7)

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
    b.classList.add('active')
    k.classList.add('active')
    b.style.transform = `translate(${x}px, ${y}px)`
    k.style.transform = `translate(${x + kx}px, ${y + ky}px)`
  }
  /** Back to its resting place bottom-left, dimmed. */
  const restStick = () => {
    const b = base.current
    const k = knob.current
    if (!b || !k) return
    const u = unit()
    const x = STICK_REST.cx * u
    const y = window.innerHeight - STICK_REST.cy * u
    b.classList.remove('active')
    k.classList.remove('active')
    b.style.transform = `translate(${x}px, ${y}px)`
    k.style.transform = `translate(${x}px, ${y}px)`
  }
  // At rest from the start, and again whenever the screen turns or resizes.
  useEffect(() => {
    restStick()
    const onResize = () => {
      if (!st.current.stick) restStick()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

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
      restStick()
    } else if (s.look?.id === e.pointerId) {
      s.look = null
    }
  }

  /** A button: press on touch, release on lift (the pointer is captured, so sliding off doesn't drop it). */
  const button = (b, side = 'right') => {
    const fire = b.icon === 'bullet'
    const down = (e) => {
      e.stopPropagation()
      e.currentTarget.setPointerCapture(e.pointerId)
      e.currentTarget.classList.add('on')
      if (b.code) touchPress(b.code)
      else if (fire) {
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
      else if (fire) {
        st.current.fire.delete(e.pointerId)
        if (!st.current.fire.size) touchMouse('left', false)
      }
    }
    return (
      <div
        key={b.id}
        className={`dl-tc-btn ${fire ? 'fire' : ''} ${(b.id === 'aim' && aiming) || (b.id === 'lethal' && c4Out) ? 'latched' : ''}`}
        style={place(b, side)}
        role="button"
        aria-label={b.label}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <Icon name={b.icon} />
      </div>
    )
  }

  const lethal = { ...RIGHT_LETHAL, icon: c4Out ? 'detonator' : ICONS[lethalKind] ? lethalKind : 'frag', label: c4Out ? 'Detonate' : 'Lethal' }

  // Pause and scores sit between the portal's own buttons (top-left) and the score bar.
  const topLeft = `calc(50% - ${Math.round(215 * scale) + 8}px - var(--u) * 21)`

  return (
    <div
      className="dl-tc"
      ref={surface}
      style={{ '--tc-alpha': opacity }}
      onPointerDown={onSurfaceDown}
      onPointerMove={onSurfaceMove}
      onPointerUp={onSurfaceUp}
      onPointerCancel={onSurfaceUp}
    >
      <div className="dl-tc-stick" ref={base}>
        <StickBase />
      </div>
      <div className="dl-tc-knob" ref={knob} />
      {RIGHT.map((b) => button(b.id === 'lethal' ? lethal : b))}
      {button(LEFT_FIRE, 'left')}
      <UseButton />
      <div className="dl-tc-top" style={{ left: topLeft }}>
        <div
          className="dl-tc-small"
          role="button"
          aria-label="Pause"
          onPointerDown={(e) => {
            e.stopPropagation()
            releaseLock()
          }}
        >
          <Icon name="pause" />
        </div>
        <div
          className={`dl-tc-small ${scoreboardOpen ? 'latched' : ''}`}
          role="button"
          aria-label="Scores"
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
