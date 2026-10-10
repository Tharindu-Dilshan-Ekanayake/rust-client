/**
 * Imperative effects API.
 *
 * The network layer and gameplay code call `fx.*` without knowing about React;
 * `<Effects />` swaps in the real implementations when it mounts. Until then (or
 * on the menu) every call is a harmless no-op.
 */
const noop = () => {}

export const fx = {
  /** Bullet streak from `from` to `to` ([x,y,z] arrays or Vector3). */
  tracer: noop,
  /** Dust/sparks + bullet hole where a shot hit the map. normal may be null. */
  impact: noop,
  /** Red puff when a player is hit. */
  blood: noop,
  /** Muzzle flash light + sprite in the world (remote players). */
  muzzle: noop,
  /** Frag explosion: fireball, dust, debris, light. */
  explosion: noop,
  /** Small dust burst (smoke grenade pop, landing). */
  puff: noop,
}

export function registerFx(impl) {
  Object.assign(fx, impl)
  return () => {
    for (const key of Object.keys(impl)) fx[key] = noop
  }
}
