import { useRapier } from '@react-three/rapier'
import { useEffect } from 'react'

import { interactionGroups } from '../../shared/constants.js'
import { runtime } from '../runtime.js'

/**
 * Builds a map's static colliders straight into the Rapier world from the shared
 * collider list (`colliders()` from shared/maps.js) — the exact list the server
 * raycasts against.
 */
export function MapColliders({ colliders }) {
  const { world, rapier } = useRapier()
  useEffect(() => {
    const created = colliders().map((c) => {
      const desc =
        c.shape === 'box'
          ? rapier.ColliderDesc.cuboid(c.half[0], c.half[1], c.half[2])
          : rapier.ColliderDesc.cylinder(c.halfHeight, c.r)
      desc
        .setTranslation(c.p[0], c.p[1], c.p[2])
        .setRotation({ x: c.q[0], y: c.q[1], z: c.q[2], w: c.q[3] })
        .setCollisionGroups(interactionGroups(c.group, 0xffff))
        .setFriction(0.8)
      return world.createCollider(desc)
    })
    runtime.world = world
    runtime.rapier = rapier
    return () => {
      for (const col of created) {
        try {
          world.removeCollider(col, false)
        } catch {
          // World already torn down.
        }
      }
      if (runtime.world === world) {
        runtime.world = null
        runtime.rapier = null
      }
    }
  }, [world, rapier, colliders])
  return null
}

export default MapColliders
