import { memo } from 'react'

import { buildPinecrestColliders, PC_POWER_LINES, PINECREST_ENTITIES, PINECREST_FURNITURE, PINECREST_GLASS, pinecrestHouseOf } from '../../../shared/mapPinecrest.js'
import House from '../acres/house.jsx'
import { Furniture, StoneWall, WoodPile } from '../acres/props.jsx'
import { Car, Jeep } from '../acres/vehicles.jsx'
import { Pole, PowerLines } from '../decor.jsx'
import GlassPanes from '../GlassPanes.jsx'
import MapColliders from '../MapColliders.jsx'
import { Crate } from '../palmwood/props.jsx'
import { AmmoCrate } from '../props.jsx'
import StaticBatcher from '../StaticBatcher.jsx'
import PinecrestBackdrop from './backdrop.jsx'
import PinecrestGround from './ground.jsx'
import { pc } from './materials.js'
import { Boat, Boulder, CreekStones, Deck, Footbridge, Greenhouse, Log, Planks, Pylons, RoadBridge, Stairs, Stump, Substation, Tree, Undergrowth } from './props.jsx'
import PinecrestWater from './water.jsx'

const PcHouse = (props) => <House {...props} of={pinecrestHouseOf} />
const PcFurniture = () => <Furniture list={PINECREST_FURNITURE} cacheKey="pc:furniture" />
const Lines = () => <PowerLines lines={PC_POWER_LINES} />
/** The undergrowth, and the stones in the creek with it. */
const Plants = () => (
  <>
    <Undergrowth />
    <CreekStones />
  </>
)

// (The deck's renderer draws the dock too; the perimeter is only walls, unseen.)
const RENDERERS = {
  pcGround: PinecrestGround,
  pcWater: PinecrestWater,
  house: PcHouse,
  greenhouse: Greenhouse,
  roadBridge: RoadBridge,
  footbridge: Footbridge,
  planks: Planks,
  pcStairs: Stairs,
  deck: Deck,
  substation: Substation,
  pole: Pole,
  powerLines: Lines,
  pylons: Pylons,
  stoneWall: StoneWall,
  car: Car,
  jeep: Jeep,
  boat: Boat,
  log: Log,
  crate: Crate,
  woodPile: WoodPile,
  boulder: Boulder,
  tree: Tree,
  stump: Stump,
  undergrowth: Plants,
  furniture: PcFurniture,
  ammoCrate: AmmoCrate,
  pcBackdrop: PinecrestBackdrop,
}

/**
 * Pinecrest Lodge: every entity of the shared map drawn by its renderer,
 * merged by the static batcher (one cell holds the whole arena), plus the
 * physics and the glasshouse's glass (GlassPanes: it breaks). Like the other
 * maps it has no lights of its own, so switching maps compiles nothing.
 */
export const PinecrestMap = memo(function PinecrestMap({ physics = true }) {
  return (
    <group>
      {physics && <MapColliders colliders={buildPinecrestColliders} />}
      <GlassPanes panes={PINECREST_GLASS} material={pc.glass()} physics={physics} />
      <StaticBatcher cell={128}>
        {PINECREST_ENTITIES.map((e, i) => {
          const Renderer = RENDERERS[e.type]
          return Renderer ? <Renderer key={i} {...e} /> : null
        })}
      </StaticBatcher>
    </group>
  )
})

export default PinecrestMap
