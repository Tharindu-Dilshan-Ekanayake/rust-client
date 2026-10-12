import { useGameStore } from '../../store/gameStore.js'
import * as acres from './acres/textures.js'
import * as palmwood from './palmwood/textures.js'
import * as dustline from './textures.js'

const SETS = { acres, dustline, palmwood }
let started = false

/**
 * Paints the other maps' procedural textures ahead of time, one at a time in
 * idle moments while you're in the menus, so picking another map later
 * doesn't have to (Dustline's take ~0.65 s, Atomic Acres' ~0.2 s). Stops for
 * good once you're in a match, so it never costs a frame there.
 */
export function prewarmOtherMaps(activeId) {
  if (started || typeof window === 'undefined') return
  started = true
  const jobs = []
  for (const [id, mod] of Object.entries(SETS)) {
    if (id === activeId) continue
    for (const [name, make] of Object.entries(mod)) {
      if (name.endsWith('Texture') && typeof make === 'function' && make.length === 0) jobs.push(make)
    }
  }
  const idle = window.requestIdleCallback ?? ((cb) => setTimeout(() => cb({ timeRemaining: () => 10 }), 60))
  const step = (deadline) => {
    const state = useGameStore.getState().gameState
    // Still loading: wait for the menu. In a room: stop.
    if (state === 'loading') return void idle(step, { timeout: 1500 })
    if (state !== 'menu') return
    while (jobs.length && deadline.timeRemaining() > 6) jobs.shift()()
    if (jobs.length) idle(step, { timeout: 1500 })
  }
  idle(step, { timeout: 1500 })
}
