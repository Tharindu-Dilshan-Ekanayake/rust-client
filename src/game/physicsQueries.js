import { BULLET_GROUPS } from '../shared/constants.js'
import { runtime } from './runtime.js'

let ray = null

/**
 * Raycast against the map using the same collision groups as the server.
 * @returns {{ toi: number, normal: {x:number,y:number,z:number} | null } | null}
 */
export function castMap(origin, dir, maxDist, groups = BULLET_GROUPS, withNormal = false) {
  const { world, rapier } = runtime
  if (!world || !rapier) return null
  if (!ray) ray = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 })
  ray.origin = { x: origin[0] ?? origin.x, y: origin[1] ?? origin.y, z: origin[2] ?? origin.z }
  ray.dir = { x: dir[0] ?? dir.x, y: dir[1] ?? dir.y, z: dir[2] ?? dir.z }
  const collider = runtime.local.collider ?? undefined
  if (withNormal) {
    const hit = world.castRayAndGetNormal(ray, maxDist, true, undefined, groups, collider)
    return hit ? { toi: hit.timeOfImpact, normal: hit.normal } : null
  }
  const hit = world.castRay(ray, maxDist, true, undefined, groups, collider)
  return hit ? { toi: hit.timeOfImpact, normal: null } : null
}

/** True when nothing solid blocks the straight line a -> b. */
export function lineClear(a, b, slack = 0.1) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const dz = b[2] - a[2]
  const len = Math.hypot(dx, dy, dz)
  if (len < 1e-4) return true
  const hit = castMap(a, [dx / len, dy / len, dz / len], len)
  return !hit || hit.toi >= len - slack
}
