/**
 * Gameplay input, polled once per frame by the local player.
 *
 * Holds key/mouse state in plain objects (never React state) and records edges
 * (pressed this frame) so tap actions like reload or weapon swap fire exactly once.
 *
 * On phones and tablets the on-screen controls (ui/TouchControls.jsx) feed the
 * same state: their buttons press "Touch:*" codes bound below, the fire and aim
 * buttons stand in for the mouse buttons, dragging to look adds to the mouse
 * deltas, and the stick sets `input.move`.
 */

/** A phone or tablet: no mouse to lock or keyboard, so the touch controls drive the game. `?touch` forces it. */
export const IS_TOUCH =
  typeof window !== 'undefined' &&
  ((typeof window.matchMedia === 'function' && window.matchMedia('(hover: none) and (pointer: coarse)').matches) ||
    new URLSearchParams(window.location.search).has('touch'))

export const BINDS = Object.freeze({
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space', 'Touch:jump'],
  sprint: ['ShiftLeft', 'ShiftRight', 'Touch:sprint'],
  /** Tap: crouch toggle. Hold: prone. While sprinting: slide. */
  crouch: ['KeyC', 'KeyZ', 'Touch:crouch'],
  prone: ['ControlLeft', 'ControlRight'],
  reload: ['KeyR', 'Touch:reload'],
  primary: ['Digit1'],
  secondary: ['Digit2'],
  melee: ['Digit3'],
  quickMelee: ['KeyV', 'Touch:knife'],
  lethal: ['KeyG', 'Touch:lethal'],
  tactical: ['KeyQ', 'Touch:tactical'],
})

const GAME_CODES = new Set(Object.values(BINDS).flat())

export const input = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),
  mouse: { left: false, right: false, leftPressed: false, rightPressed: false, wheel: 0, dx: 0, dy: 0 },
  /** The touch stick: x right, z forward, each -1..1 (0 when it's not held). */
  move: { x: 0, z: 0 },
  locked: false,
}

/** An on-screen button going down / up (codes are the "Touch:*" ones in BINDS). */
export function touchPress(code) {
  if (input.held.has(code)) return
  input.held.add(code)
  input.pressed.add(code)
}
export function touchRelease(code) {
  if (input.held.delete(code)) input.released.add(code)
}
/** The touch stick's position (x right, z forward, -1..1; 0, 0 when let go). */
export function touchMove(x, z) {
  input.move.x = x
  input.move.z = z
}
/** A finger dragged to look, in screen px (like mouse movement). */
export function touchLook(dx, dy) {
  input.mouse.dx += dx
  input.mouse.dy += dy
}
/** The on-screen fire / aim buttons standing in for the mouse's left / right buttons. */
export function touchMouse(button, down) {
  input.mouse[button] = down
  if (down) input.mouse[`${button}Pressed`] = true
}
/** Next weapon, as one notch of the mouse wheel. */
export function touchSwap() {
  input.mouse.wheel += 1
}
/** Whether aim is currently held down (the aim button latches it). */
export const touchAiming = () => input.mouse.right

export const isDown = (action) => BINDS[action].some((c) => input.held.has(c))
export const wasPressed = (action) => BINDS[action].some((c) => input.pressed.has(c))
export const wasReleased = (action) => BINDS[action].some((c) => input.released.has(c))

/** Clears per-frame edges and mouse deltas. Call at the end of each frame. */
export function endInputFrame() {
  input.pressed.clear()
  input.released.clear()
  input.mouse.leftPressed = false
  input.mouse.rightPressed = false
  input.mouse.wheel = 0
  input.mouse.dx = 0
  input.mouse.dy = 0
}

function releaseAll() {
  for (const code of input.held) input.released.add(code)
  input.held.clear()
  input.mouse.left = false
  input.mouse.right = false
  input.move.x = 0
  input.move.z = 0
}

/**
 * "Locked" means the game has the controls: the mouse is captured, or on a
 * touch device the player has tapped in (there's no pointer lock there).
 */
let touchLock = false
export const isLocked = () => touchLock || (typeof document !== 'undefined' && Boolean(document.pointerLockElement))

/** Fires `dl:lockchange` on window whenever isLocked() may have changed. */
function lockChanged() {
  input.locked = isLocked()
  if (!input.locked) releaseAll()
  window.dispatchEvent(new Event('dl:lockchange'))
}

let installed = false

export function installInput() {
  if (installed) return
  installed = true

  window.addEventListener('keydown', (e) => {
    if (!input.locked) return
    if (GAME_CODES.has(e.code)) e.preventDefault()
    if (e.repeat) return
    input.held.add(e.code)
    input.pressed.add(e.code)
  })
  window.addEventListener('keyup', (e) => {
    if (input.held.delete(e.code)) input.released.add(e.code)
  })
  window.addEventListener('mousedown', (e) => {
    if (!input.locked) return
    if (e.button === 0) {
      input.mouse.left = true
      input.mouse.leftPressed = true
    } else if (e.button === 2) {
      input.mouse.right = true
      input.mouse.rightPressed = true
    }
  })
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouse.left = false
    if (e.button === 2) input.mouse.right = false
  })
  window.addEventListener('mousemove', (e) => {
    if (!input.locked) return
    // Some browsers report a huge spurious delta right after locking.
    if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return
    input.mouse.dx += e.movementX
    input.mouse.dy += e.movementY
  })
  window.addEventListener('wheel', (e) => {
    if (input.locked) input.mouse.wheel += Math.sign(e.deltaY)
  }, { passive: true })
  window.addEventListener('contextmenu', (e) => {
    if (input.locked || e.target?.tagName === 'CANVAS') e.preventDefault()
  })
  window.addEventListener('blur', releaseAll)
  document.addEventListener('pointerlockchange', lockChanged)
}

/** Locks the mouse to the game canvas (or, on touch, hands the controls over). Must be called from a user gesture. */
export async function requestLock() {
  if (IS_TOUCH) {
    if (!touchLock) {
      touchLock = true
      lockChanged()
    }
    return true
  }
  const canvas = document.querySelector('canvas[data-game]')
  if (!canvas || document.pointerLockElement === canvas) return true
  try {
    await canvas.requestPointerLock({ unadjustedMovement: true })
    return true
  } catch {
    try {
      // Not every platform supports raw input; retry without it.
      await canvas.requestPointerLock()
      return true
    } catch {
      return false
    }
  }
}

export function releaseLock() {
  if (touchLock) {
    touchLock = false
    lockChanged()
  }
  if (document.pointerLockElement) document.exitPointerLock()
}
