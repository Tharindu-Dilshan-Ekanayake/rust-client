/**
 * Gameplay input, polled once per frame by the local player.
 *
 * Holds key/mouse state in plain objects (never React state) and records edges
 * (pressed this frame) so tap actions like reload or weapon swap fire exactly once.
 */

export const BINDS = Object.freeze({
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  /** Tap: crouch toggle. Hold: prone. While sprinting: slide. */
  crouch: ['KeyC', 'KeyZ'],
  prone: ['ControlLeft', 'ControlRight'],
  reload: ['KeyR'],
  primary: ['Digit1'],
  secondary: ['Digit2'],
  melee: ['Digit3'],
  quickMelee: ['KeyV'],
  lethal: ['KeyG'],
  tactical: ['KeyQ'],
})

const GAME_CODES = new Set(Object.values(BINDS).flat())

export const input = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),
  mouse: { left: false, right: false, leftPressed: false, rightPressed: false, wheel: 0, dx: 0, dy: 0 },
  locked: false,
}

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
  document.addEventListener('pointerlockchange', () => {
    input.locked = Boolean(document.pointerLockElement)
    if (!input.locked) releaseAll()
  })
}

/** Locks the mouse to the game canvas. Must be called from a user gesture. */
export async function requestLock() {
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
  if (document.pointerLockElement) document.exitPointerLock()
}
