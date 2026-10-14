import { memo } from 'react'

import { buildTerminalColliders, TERMINAL_ENTITIES, TERMINAL_GLASS } from '../../../shared/mapTerminal.js'
import GlassPanes from '../GlassPanes.jsx'
import MapColliders from '../MapColliders.jsx'
import { AmmoCrate, Barrier } from '../props.jsx'
import StaticBatcher from '../StaticBatcher.jsx'
import { CarWreck } from '../wrecks.jsx'
import { TerminalBackdrop, TerminalPerimeter } from './backdrop.jsx'
import Terminal from './building.jsx'
import { Markings, TerminalGround } from './ground.jsx'
import { tm } from './materials.js'
import Plane, { Airstairs, JetBridge, Slide } from './plane.jsx'
import { ApronBus, Catering, Cones, Dolly, FuelTruck, Gpu, Mast, Pushback, TmCar, Tug, Uld } from './props.jsx'
import { WreckDebris, WreckEngine, WreckSection, WreckWing } from './wreck.jsx'

const RENDERERS = {
  tmGround: TerminalGround,
  markings: Markings,
  terminal: Terminal,
  plane: Plane,
  jetBridge: JetBridge,
  slide: Slide,
  airstairs: Airstairs,
  uld: Uld,
  tug: Tug,
  dolly: Dolly,
  fuelTruck: FuelTruck,
  catering: Catering,
  pushback: Pushback,
  gpu: Gpu,
  apronBus: ApronBus,
  car: TmCar,
  carWreck: CarWreck,
  wreckSection: WreckSection,
  wreckWing: WreckWing,
  wreckEngine: WreckEngine,
  wreckDebris: WreckDebris,
  barrier: Barrier,
  mast: Mast,
  cones: Cones,
  ammoCrate: AmmoCrate,
  tmPerimeter: TerminalPerimeter,
  tmBackdrop: TerminalBackdrop,
}

/**
 * Skyport Terminal: every entity of the shared map drawn by its renderer
 * (the smouldering holes in the roofs have none: they're only smoke),
 * merged by the static batcher (one cell holds the whole arena), plus the
 * physics, and the glass that breaks (GlassPanes). Like the other maps it has
 * no lights of its own, so switching maps compiles nothing.
 */
export const TerminalMap = memo(function TerminalMap({ physics = true }) {
  return (
    <group>
      {physics && <MapColliders colliders={buildTerminalColliders} />}
      <GlassPanes panes={TERMINAL_GLASS} material={tm.glass()} physics={physics} />
      <StaticBatcher cell={128}>
        {TERMINAL_ENTITIES.map((e, i) => {
          const Renderer = RENDERERS[e.type]
          return Renderer ? <Renderer key={i} {...e} /> : null
        })}
      </StaticBatcher>
    </group>
  )
})

export default TerminalMap
