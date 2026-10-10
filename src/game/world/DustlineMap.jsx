import { useRapier } from '@react-three/rapier'
import { memo, useEffect } from 'react'

import { interactionGroups } from '../../shared/constants.js'
import { buildColliders, ENTITIES } from '../../shared/map.js'
import { runtime } from '../runtime.js'
import {
  AmmoCrate,
  Backdrop,
  Barrel,
  Barrier,
  Crate,
  Desk,
  Generator,
  Lockers,
  Palm,
  Pumpjack,
  Sandbags,
  Scrap,
  Truck,
} from './props.jsx'
import { Apc, CamoNet, Culvert, Decor, Lamp, Pole, PowerLines, Rock } from './decor.jsx'
import { DeckTank, Ground } from './ground.jsx'
import { Ruin } from './ruins.jsx'
import StaticBatcher from './StaticBatcher.jsx'
import { Catwalk, Container, Landing, Perimeter, Pipeline, Shack, Stairs, Tank, Tower } from './structures.jsx'

const RENDERERS = {
  tower: Tower,
  tank: Tank,
  catwalk: Catwalk,
  stairs: Stairs,
  landing: Landing,
  pipeline: Pipeline,
  ruin: Ruin,
  apc: Apc,
  culvert: Culvert,
  rock: Rock,
  pole: Pole,
  powerlines: PowerLines,
  lamp: Lamp,
  camonet: CamoNet,
  decor: Decor,
  deckTank: DeckTank,
  ground: Ground,
  container: Container,
  crate: Crate,
  shack: Shack,
  desk: Desk,
  lockers: Lockers,
  ammoCrate: AmmoCrate,
  pumpjack: Pumpjack,
  barrier: Barrier,
  barrel: Barrel,
  sandbags: Sandbags,
  generator: Generator,
  truck: Truck,
  scrap: Scrap,
  palm: Palm,
  perimeter: Perimeter,
}

/**
 * Builds the map's static colliders straight into the Rapier world from the shared
 * collider list — the exact list the server raycasts against.
 */
function MapColliders() {
  const { world, rapier } = useRapier()
  useEffect(() => {
    const created = buildColliders().map((c) => {
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
  }, [world, rapier])
  return null
}

/**
 * Everything static: entities, ground, backdrop and their physics. The visuals
 * are batched into a few hundred merged meshes after mounting.
 */
export const DustlineMap = memo(function DustlineMap({ physics = true }) {
  return (
    <group>
      {physics && <MapColliders />}
      <StaticBatcher>
        <Backdrop />
        {ENTITIES.map((e, i) => {
          const Renderer = RENDERERS[e.type]
          return Renderer ? <Renderer key={i} {...e} /> : null
        })}
      </StaticBatcher>
    </group>
  )
})

export default DustlineMap
