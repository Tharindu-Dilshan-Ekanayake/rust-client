import { memo } from 'react'

import { BR_POWER_LINES, BRAMBLE_ENTITIES, brambleHouseOf, brambleShackOf, buildBrambleColliders } from '../../../shared/mapBramble.js'
import House from '../acres/house.jsx'
import { Hedge, OilDrums, Tyres } from '../acres/props.jsx'
import { Car } from '../acres/vehicles.jsx'
import { Pole, PowerLines } from '../decor.jsx'
import { Hay } from '../hollow/props.jsx'
import MapColliders from '../MapColliders.jsx'
import Building from '../palmwood/buildings.jsx'
import { Barrels, Crate, Sandbags, TinFence } from '../palmwood/props.jsx'
import { AmmoCrate } from '../props.jsx'
import StaticBatcher from '../StaticBatcher.jsx'
import { Ladder } from '../structures.jsx'
import { CarWreck } from '../wrecks.jsx'
import { BrambleBackdrop, BramblePerimeter } from './backdrop.jsx'
import BrambleGround from './ground.jsx'
import { br } from './materials.js'
import { Boardwalk, Bridge, CreekLog, FuelTank, Furniture, Ivy, RailFence, Ruin, Rubble, Tank, Tractor, Tree, Undergrowth, WaterTower } from './props.jsx'

const BrHouse = (props) => <House {...props} of={brambleHouseOf} />
const Shack = (props) => <Building {...props} of={brambleShackOf} />
const RustyLadder = (props) => <Ladder {...props} material={br.paint('#5a524a', 0.6, 0.6)} />
const Lines = () => <PowerLines lines={BR_POWER_LINES} />

const RENDERERS = {
  brGround: BrambleGround,
  house: BrHouse,
  shack: Shack,
  ruin: Ruin,
  rubble: Rubble,
  hay: Hay,
  tractor: Tractor,
  waterTower: WaterTower,
  boardwalk: Boardwalk,
  bridge: Bridge,
  creekLog: CreekLog,
  tank: Tank,
  fuelTank: FuelTank,
  carWreck: CarWreck,
  car: Car,
  railFence: RailFence,
  hedge: Hedge,
  tinFence: TinFence,
  sandbags: Sandbags,
  crate: Crate,
  barrels: Barrels,
  tyres: Tyres,
  oilDrums: OilDrums,
  ammoCrate: AmmoCrate,
  pole: Pole,
  powerLines: Lines,
  tree: Tree,
  undergrowth: Undergrowth,
  ivy: Ivy,
  ladder: RustyLadder,
  furniture: Furniture,
  brPerimeter: BramblePerimeter,
  brBackdrop: BrambleBackdrop,
}

/**
 * Bramblewood: every entity of the shared map drawn by its renderer, merged by
 * the static batcher (one cell holds the whole farm), plus the physics. Like
 * the other maps it has no lights of its own, so switching maps compiles
 * nothing.
 */
export const BrambleMap = memo(function BrambleMap({ physics = true }) {
  return (
    <group>
      {physics && <MapColliders colliders={buildBrambleColliders} />}
      <StaticBatcher cell={96}>
        {BRAMBLE_ENTITIES.map((e, i) => {
          const Renderer = RENDERERS[e.type]
          return Renderer ? <Renderer key={i} {...e} /> : null
        })}
      </StaticBatcher>
    </group>
  )
})

export default BrambleMap
