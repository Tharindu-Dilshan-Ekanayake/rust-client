import { memo } from 'react'

import { buildColliders, ENTITIES } from '../../shared/map.js'
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
import MapColliders from './MapColliders.jsx'
import { Refinery } from './refinery.jsx'
import { Ruin } from './ruins.jsx'
import { CarWreck, PipeStack, Tanker } from './wrecks.jsx'
import StaticBatcher from './StaticBatcher.jsx'
import { Catwalk, Container, Ladder, Landing, Perimeter, Pipeline, Shack, Stairs, Tank, Tower } from './structures.jsx'

const RENDERERS = {
  tower: Tower,
  refinery: Refinery,
  tank: Tank,
  catwalk: Catwalk,
  stairs: Stairs,
  ladder: Ladder,
  landing: Landing,
  pipeline: Pipeline,
  ruin: Ruin,
  apc: Apc,
  tanker: Tanker,
  car: CarWreck,
  pipeStack: PipeStack,
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
 * Everything static: entities, ground, backdrop and their physics. The visuals
 * are batched into a few hundred merged meshes after mounting.
 */
export const DustlineMap = memo(function DustlineMap({ physics = true }) {
  return (
    <group>
      {physics && <MapColliders colliders={buildColliders} />}
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
