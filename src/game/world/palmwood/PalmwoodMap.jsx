import { memo } from 'react'

import { buildPalmwoodColliders, PALMWOOD_ENTITIES } from '../../../shared/mapPalmwood.js'
import { Car, Jeep } from '../acres/vehicles.jsx'
import MapColliders from '../MapColliders.jsx'
import { AmmoCrate } from '../props.jsx'
import StaticBatcher from '../StaticBatcher.jsx'
import { Ladder } from '../structures.jsx'
import { PalmwoodBackdrop, PalmwoodPerimeter } from './backdrop.jsx'
import Building from './buildings.jsx'
import PalmwoodGround from './ground.jsx'
import { pw } from './materials.js'
import {
  Banana,
  Barrels,
  Boat,
  Boom,
  Bush,
  Campfire,
  Crate,
  Deck,
  Furniture,
  Generator,
  LeanTo,
  Logs,
  Palm,
  Pallets,
  PlyFence,
  Sandbags,
  TankStand,
  TinFence,
  Tower,
  Tufts,
  Washline,
} from './props.jsx'

const WoodLadder = (props) => <Ladder {...props} material={pw.wood('#9a7a52')} />

const RENDERERS = {
  pwGround: PalmwoodGround,
  building: Building,
  deck: Deck,
  tower: Tower,
  ladder: WoodLadder,
  tankStand: TankStand,
  car: Car,
  jeep: Jeep,
  boat: Boat,
  plyFence: PlyFence,
  tinFence: TinFence,
  sandbags: Sandbags,
  crate: Crate,
  barrels: Barrels,
  generator: Generator,
  logs: Logs,
  pallets: Pallets,
  boom: Boom,
  campfire: Campfire,
  washline: Washline,
  leanTo: LeanTo,
  ammoCrate: AmmoCrate,
  banana: Banana,
  palm: Palm,
  bush: Bush,
  tufts: Tufts,
  furniture: Furniture,
  pwPerimeter: PalmwoodPerimeter,
  pwBackdrop: PalmwoodBackdrop,
}

/**
 * Palmwood: every entity of the shared map drawn by its renderer, merged by the
 * static batcher (one cell holds the whole town), plus the physics. Like the
 * other maps it has no lights of its own, so switching maps compiles nothing.
 */
export const PalmwoodMap = memo(function PalmwoodMap({ physics = true }) {
  return (
    <group>
      {physics && <MapColliders colliders={buildPalmwoodColliders} />}
      <StaticBatcher cell={96}>
        {PALMWOOD_ENTITIES.map((e, i) => {
          const Renderer = RENDERERS[e.type]
          return Renderer ? <Renderer key={i} {...e} /> : null
        })}
      </StaticBatcher>
    </group>
  )
})

export default PalmwoodMap
