import { Vector3 } from 'three'

/**
 * Mutable per-frame game state, shared between the network layer, the R3F scene
 * and the HUD's animation-frame readers.
 *
 * Deliberately not React state: these values change every frame and are read
 * inside `useFrame` / requestAnimationFrame, never rendered directly.
 */
export const runtime = {
  /** Raw Rapier world + module, set once the map's physics has mounted. */
  world: null,
  rapier: null,
  camera: null,

  local: {
    feet: new Vector3(),
    vel: new Vector3(),
    yaw: 0,
    pitch: 0,
    eyeHeight: 1.62,
    crouch: false,
    grounded: true,
    climbing: false,
    sprinting: false,
    sliding: false,
    /** The ladder being climbed (shared/map.js LADDERS entry) or null, and 0..1 hands onto it. */
    ladder: null,
    climbMount: 0,
    /** 0..1 slide intensity (1 at the start of a slide). */
    slideK: 0,
    alive: false,
    seq: 0,
    /** 0 = hip, 1 = fully aimed down sights. */
    ads: 0,
    weapon: 'ar',
    /** World-space muzzle of the first-person gun, for tracer origins. */
    muzzle: new Vector3(),
    collider: null,
  },

  view: {
    recoilPitch: 0,
    recoilYaw: 0,
    shake: 0,
    /** Seconds of flashbang whiteout remaining, and the starting amount for the fade curve. */
    flash: 0,
    flashMax: 0,
    scoped: false,
    /** Current crosshair spread in radians, for the HUD. */
    spread: 0,
    cookStart: 0,
    sway: { x: 0, y: 0 },
    breath: 1,
    holdingBreath: false,
    fps: 0,
  },

  /** id -> interpolated view of a remote player (see net/network.js). */
  remotes: new Map(),

  /** Where the death camera looks from / at. */
  death: { at: new Vector3(), killerId: '' },

  /**
   * Search & Destroy, straight from the room state on every patch (the HUD's
   * timers and progress bars read it each frame): round phase, the bomb, and
   * who is planting or defusing.
   */
  snd: {
    phase: '',
    attackers: '',
    bombState: '',
    carrier: '',
    site: '',
    x: 0,
    y: 0,
    z: 0,
    left: 0,
    action: '',
    by: '',
    progress: 0,
    /** performance.now() the freeze ends (from the round event). */
    freezeEnds: 0,
    /** Someone has picked the bomb up this round (until then it lies at the attackers' spawn). */
    taken: false,
  },
  /** Teammate the dead are watching (Search & Destroy). */
  spectateId: '',
}

/* Minimal event bus between the network layer and scene components. */
const listeners = new Map()

export function on(type, fn) {
  if (!listeners.has(type)) listeners.set(type, new Set())
  listeners.get(type).add(fn)
  return () => listeners.get(type)?.delete(fn)
}

export function emit(type, payload) {
  const set = listeners.get(type)
  if (set) for (const fn of set) fn(payload)
}
