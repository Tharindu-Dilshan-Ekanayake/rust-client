import { memo } from 'react'

import { ACRES_ENTITIES, buildAcresColliders } from '../../../shared/mapAcres.js'
import { Barrier, AmmoCrate } from '../props.jsx'
import { Pole, PowerLines } from '../decor.jsx'
import MapColliders from '../MapColliders.jsx'
import StaticBatcher from '../StaticBatcher.jsx'
import { Ladder } from '../structures.jsx'
import AcresGround from './ground.jsx'
import House from './house.jsx'
import { acres } from './materials.js'
import {
  BoxPile,
  Bbq,
  Bench,
  Clothesline,
  DivingBoard,
  Doghouse,
  Furniture,
  GlobeLamp,
  Hedge,
  Hydrant,
  Lounger,
  Mailbox,
  Mannequin,
  OilDrums,
  PatioSet,
  PicketFence,
  PicnicTable,
  Pillar,
  Planter,
  PrivacyFence,
  Sawhorse,
  Shelter,
  Slide,
  StoneWall,
  StreetSign,
  SwingSet,
  TrashCans,
  Tree,
  Tyres,
  Umbrella,
  WelcomeSign,
  Wire,
  WoodPile,
} from './props.jsx'
import { AcresBackdrop, AcresPerimeter, WaterTower } from './structures.jsx'
import { Car, Jeep, SchoolBus, Semi } from './vehicles.jsx'

const SteelLadder = (props) => <Ladder {...props} material={acres.steel()} />

const RENDERERS = {
  acresGround: AcresGround,
  house: House,
  bus: SchoolBus,
  semi: Semi,
  jeep: Jeep,
  car: Car,
  waterTower: WaterTower,
  ladder: SteelLadder,
  privacyFence: PrivacyFence,
  picketFence: PicketFence,
  stoneWall: StoneWall,
  pillar: Pillar,
  planter: Planter,
  hedge: Hedge,
  tree: Tree,
  globeLamp: GlobeLamp,
  pole: Pole,
  powerlines: PowerLines,
  streetSign: StreetSign,
  welcomeSign: WelcomeSign,
  mailbox: Mailbox,
  hydrant: Hydrant,
  barrier: Barrier,
  wire: Wire,
  sawhorse: Sawhorse,
  picnicTable: PicnicTable,
  swingSet: SwingSet,
  slide: Slide,
  shelter: Shelter,
  bench: Bench,
  bbq: Bbq,
  clothesline: Clothesline,
  patioSet: PatioSet,
  doghouse: Doghouse,
  trashCans: TrashCans,
  lounger: Lounger,
  umbrella: Umbrella,
  divingBoard: DivingBoard,
  boxPile: BoxPile,
  tyres: Tyres,
  oilDrums: OilDrums,
  woodPile: WoodPile,
  ammoCrate: AmmoCrate,
  mannequin: Mannequin,
  furniture: Furniture,
  acresPerimeter: AcresPerimeter,
  acresBackdrop: AcresBackdrop,
}

/**
 * Atomic Acres: every entity of the shared map drawn by its renderer (the pool
 * is part of the ground), merged by the static batcher, plus the physics.
 *
 * One warm lamp lights the yellow house's living room. Dustline has one point
 * light too (in the shack): with the same number of lights on both maps,
 * switching maps reuses every compiled shader instead of rebuilding them all.
 */
export const AcresMap = memo(function AcresMap({ physics = true }) {
  return (
    <group>
      {physics && <MapColliders colliders={buildAcresColliders} />}
      <pointLight position={[-21.8, 2.7, 1.2]} color="#ffd9a0" intensity={5} distance={8} decay={1.6} />
      <mesh position={[-21.8, 3.0, 1.2]} material={acres.lampGlass()}>
        <sphereGeometry args={[0.18, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
      </mesh>
      <StaticBatcher cell={96}>
        {ACRES_ENTITIES.map((e, i) => {
          const Renderer = RENDERERS[e.type]
          return Renderer ? <Renderer key={i} {...e} /> : null
        })}
      </StaticBatcher>
    </group>
  )
})

export default AcresMap
