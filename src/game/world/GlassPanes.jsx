import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { useEffect, useMemo, useRef } from 'react'
import { BoxGeometry, DynamicDrawUsage, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three'

import { net } from '../../net/network.js'
import { GROUP, interactionGroups } from '../../shared/constants.js'
import { expirePredictions, glass, setGlassMap } from '../glass.js'

/**
 * A map's breakable glass (map.glass, see game/glass.js): every pane drawn as
 * one instance of a single mesh (a broken one shrinks to nothing), and, in a
 * physics world, a collider for each pane still whole that stops you walking
 * through it (bullets are tested against the panes apart, like the server's).
 */

/** Drawn panes are thin whatever their collider's thickness. */
const DRAWN = 0.02
const HIDDEN = new Matrix4().makeScale(0, 0, 0)
const _m = new Matrix4()
const _p = new Vector3()
const _q = new Quaternion()
const _s = new Vector3()

function paneMatrix(g) {
  const min = Math.min(...g.half)
  _s.set(...g.half.map((h) => (h === min ? DRAWN : h * 2)))
  return _m.compose(_p.set(...g.p), _q.set(...g.q), _s)
}

function GlassColliders({ panes }) {
  const { world, rapier } = useRapier()
  useEffect(() => {
    const make = (i) => {
      const g = panes[i]
      return world.createCollider(
        rapier.ColliderDesc.cuboid(g.half[0], g.half[1], g.half[2])
          .setTranslation(g.p[0], g.p[1], g.p[2])
          .setRotation({ x: g.q[0], y: g.q[1], z: g.q[2], w: g.q[3] })
          .setCollisionGroups(interactionGroups(GROUP.MOVE_ONLY, 0xffff))
          .setFriction(0.8),
      )
    }
    const remove = (c) => {
      try {
        world.removeCollider(c, false)
      } catch {
        // World already torn down.
      }
    }
    const colliders = panes.map((_, i) => (glass.broken.has(i) ? null : make(i)))
    const onChange = (i, broken) => {
      if (broken && colliders[i]) {
        remove(colliders[i])
        colliders[i] = null
      } else if (!broken && !colliders[i]) colliders[i] = make(i)
    }
    glass.listeners.add(onChange)
    return () => {
      glass.listeners.delete(onChange)
      for (const c of colliders) if (c) remove(c)
    }
  }, [world, rapier, panes])
  return null
}

export function GlassPanes({ panes, material, physics = true }) {
  // (Before the children's effects run: they read which panes are broken.)
  setGlassMap(panes)
  const mesh = useMemo(() => {
    const m = new InstancedMesh(new BoxGeometry(1, 1, 1), material, panes.length)
    m.instanceMatrix.setUsage(DynamicDrawUsage)
    // One draw for the lot; the panes are all over the map, so cull none.
    m.frustumCulled = false
    m.castShadow = false
    m.receiveShadow = false
    return m
  }, [panes, material])

  useEffect(() => {
    panes.forEach((g, i) => mesh.setMatrixAt(i, glass.broken.has(i) ? HIDDEN : paneMatrix(g)))
    mesh.instanceMatrix.needsUpdate = true
    const onChange = (i, broken) => {
      mesh.setMatrixAt(i, broken ? HIDDEN : paneMatrix(panes[i]))
      mesh.instanceMatrix.needsUpdate = true
    }
    glass.listeners.add(onChange)
    return () => glass.listeners.delete(onChange)
  }, [mesh, panes])
  useEffect(() => () => mesh.geometry.dispose(), [mesh])

  // Breaks of ours the server never confirmed are mended after a moment.
  const tick = useRef(0)
  useFrame((_, dt) => {
    tick.current += dt
    if (tick.current < 0.5) return
    tick.current = 0
    expirePredictions(Boolean(net.room))
  })

  return (
    <>
      <primitive object={mesh} />
      {physics && <GlassColliders panes={panes} />}
    </>
  )
}

export default GlassPanes
