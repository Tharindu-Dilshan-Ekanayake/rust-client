import { memo } from 'react'

import { buildHollowColliders, HOLLOW_ENTITIES, HOLLOW_FURNITURE, hollowHouseOf } from '../../../shared/mapHollow.js'
import House from '../acres/house.jsx'
import { Bench, Furniture, Hedge, Hydrant, Mailbox, PicketFence, PrivacyFence, Sawhorse, StoneWall, StreetSign, TrashCans, WoodPile } from '../acres/props.jsx'
import { Car } from '../acres/vehicles.jsx'
import { Pole, PowerLines } from '../decor.jsx'
import MapColliders from '../MapColliders.jsx'
import { AmmoCrate, Barrier } from '../props.jsx'
import StaticBatcher from '../StaticBatcher.jsx'
import { Ladder } from '../structures.jsx'
import { HollowBackdrop, HollowPerimeter } from './backdrop.jsx'
import HollowGround from './ground.jsx'
import { hc } from './materials.js'
import { Bats, Glows, LightPools, Mist } from './night.jsx'
import {
  Candles,
  Cobwebs,
  DeadTree,
  GatePier,
  Hay,
  Headstones,
  IronFence,
  Lamp,
  LightPole,
  Pine,
  Pumpkins,
  Rock,
  Scarecrow,
  StringLights,
} from './props.jsx'
import { Belfry, Bridge, Cart, Crypt, Culverts, HayPile, Outhouse, Statue, Watchtower } from './structures.jsx'

const HollowHouse = (props) => <House {...props} of={hollowHouseOf} />
const HollowFurniture = () => <Furniture list={HOLLOW_FURNITURE} cacheKey="hc:furniture" />
const WoodLadder = (props) => <Ladder {...props} material={hc.wood('#5a4632')} />
const Nothing = () => null

const RENDERERS = {
  hollowGround: HollowGround,
  graveyardGround: Nothing,
  culverts: Culverts,
  house: HollowHouse,
  belfry: Belfry,
  ironFence: IronFence,
  gatePier: GatePier,
  crypt: Crypt,
  headstones: Headstones,
  statue: Statue,
  watchtower: Watchtower,
  ladder: WoodLadder,
  bridge: Bridge,
  hayPile: HayPile,
  car: Car,
  cart: Cart,
  privacyFence: PrivacyFence,
  picketFence: PicketFence,
  stoneWall: StoneWall,
  hedge: Hedge,
  deadTree: DeadTree,
  pine: Pine,
  rock: Rock,
  hay: Hay,
  scarecrow: Scarecrow,
  pumpkins: Pumpkins,
  candles: Candles,
  lamp: Lamp,
  lightPole: LightPole,
  stringLights: StringLights,
  pole: Pole,
  powerlines: PowerLines,
  streetSign: StreetSign,
  mailbox: Mailbox,
  hydrant: Hydrant,
  trashCans: TrashCans,
  bench: Bench,
  woodPile: WoodPile,
  outhouse: Outhouse,
  barrier: Barrier,
  sawhorse: Sawhorse,
  ammoCrate: AmmoCrate,
  furniture: HollowFurniture,
  mist: Nothing,
  bats: Nothing,
  hollowPerimeter: HollowPerimeter,
  hollowBackdrop: HollowBackdrop,
}

/**
 * Hollow Creek: every entity of the shared map drawn by its renderer, merged by
 * the static batcher, plus the physics. The things that move (the glows'
 * flicker, the mist, the bats) sit outside the batcher. Like the other maps it
 * has no lights of its own, so switching maps compiles nothing new for them.
 */
export const HollowMap = memo(function HollowMap({ physics = true }) {
  return (
    <group>
      {physics && <MapColliders colliders={buildHollowColliders} />}
      <StaticBatcher cell={96}>
        {HOLLOW_ENTITIES.map((e, i) => {
          const Renderer = RENDERERS[e.type]
          return Renderer ? <Renderer key={i} {...e} /> : null
        })}
        <Cobwebs />
        <LightPools />
      </StaticBatcher>
      <Glows />
      <Mist />
      <Bats />
    </group>
  )
})

export default HollowMap
