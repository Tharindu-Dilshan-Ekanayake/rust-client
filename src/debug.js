import { emit, runtime } from './game/runtime.js'
import { input } from './game/player/input.js'
import { sfx } from './audio/sfx.js'
import { net } from './net/network.js'
import { DEFAULT_CLASS } from './shared/weapons.js'
import { useGameStore } from './store/gameStore.js'

/**
 * `?debug` exposes game internals on window.__dl for console poking and
 * automated tests. Nothing here runs unless the flag is present.
 */
if (new URLSearchParams(window.location.search).has('debug')) {
  window.__dl = {
    runtime,
    input,
    net,
    store: useGameStore,
    sfx,
    /**
     * Offline movement sandbox: spawns the local player at `p` with no server,
     * so you can walk the map, climb the ladder etc. without anyone correcting you.
     */
    sandbox(p = [0, 0, 4], yaw = 0, cls = DEFAULT_CLASS) {
      useGameStore.setState({ gameState: 'playing', overlay: null, mode: 'ffa', team: 'ffa' })
      runtime.local.alive = true
      // Give LocalPlayer a moment to mount before it hears the spawn.
      setTimeout(() => emit('spawn', { p, yaw, seq: 1, classData: cls, ammo: null }), 150)
    },
    /** Adds XP as if the server had awarded it (rank-ups, unlocks, banners). */
    grantXp(n = 1000, why = 'kill') {
      const promoted = useGameStore.getState().addXp(n, why)
      if (promoted) {
        net.room?.send('rank', { r: promoted })
        sfx.play('rankUp', { volume: 0.9 })
      }
      return promoted
    },
  }
}
