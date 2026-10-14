import { memo } from 'react'

import { buildQuarterColliders, OQ_POWER_LINES, QUARTER_ENTITIES, shackOf } from '../../../shared/mapQuarter.js'
import { OilDrums, Tyres } from '../acres/props.jsx'
import { Car } from '../acres/vehicles.jsx'
import { Culvert, Pole, PowerLines } from '../decor.jsx'
import MapColliders from '../MapColliders.jsx'
import Building from '../palmwood/buildings.jsx'
import { Barrels, Crate, Generator, Palm, Pallets, Sandbags, TinFence, Washline } from '../palmwood/props.jsx'
import { AmmoCrate, Barrier } from '../props.jsx'
import StaticBatcher from '../StaticBatcher.jsx'
import { Container, Ladder } from '../structures.jsx'
import { CarWreck } from '../wrecks.jsx'
import { QuarterBackdrop, QuarterPerimeter } from './backdrop.jsx'
import Block from './blocks.jsx'
import QuarterGround from './ground.jsx'
import { oq } from './materials.js'
import { BlockStack, Bulldozer, Cables, DryTufts, Fountain, Furniture, Mixer, Pile, Rebar, Scaffold, Scrub, Studs, Timber, Toilet, YardWall } from './props.jsx'

const Shack = (props) => <Building {...props} of={shackOf} />
const SteelLadder = (props) => <Ladder {...props} material={oq.paint('#3a3a38', 0.5, 0.6)} />
const Lines = () => <PowerLines lines={OQ_POWER_LINES} />

const RENDERERS = {
  oqGround: QuarterGround,
  block: Block,
  shack: Shack,
  studs: Studs,
  scaffold: Scaffold,
  bulldozer: Bulldozer,
  mixer: Mixer,
  pile: Pile,
  blockStack: BlockStack,
  rebar: Rebar,
  timber: Timber,
  toilet: Toilet,
  culvert: Culvert,
  container: Container,
  car: Car,
  carWreck: CarWreck,
  barrier: Barrier,
  pole: Pole,
  powerLines: Lines,
  cables: Cables,
  yardWall: YardWall,
  tinFence: TinFence,
  sandbags: Sandbags,
  crate: Crate,
  barrels: Barrels,
  generator: Generator,
  pallets: Pallets,
  tyres: Tyres,
  oilDrums: OilDrums,
  washline: Washline,
  fountain: Fountain,
  furniture: Furniture,
  ammoCrate: AmmoCrate,
  palm: Palm,
  scrub: Scrub,
  tufts: DryTufts,
  ladder: SteelLadder,
  oqPerimeter: QuarterPerimeter,
  oqBackdrop: QuarterBackdrop,
}

/**
 * Old Quarter: every entity of the shared map drawn by its renderer, merged by
 * the static batcher (one cell holds the whole town), plus the physics. Like
 * the other maps it has no lights of its own, so switching maps compiles
 * nothing.
 */
export const QuarterMap = memo(function QuarterMap({ physics = true }) {
  return (
    <group>
      {physics && <MapColliders colliders={buildQuarterColliders} />}
      <StaticBatcher cell={96}>
        {QUARTER_ENTITIES.map((e, i) => {
          const Renderer = RENDERERS[e.type]
          return Renderer ? <Renderer key={i} {...e} /> : null
        })}
      </StaticBatcher>
    </group>
  )
})

export default QuarterMap
