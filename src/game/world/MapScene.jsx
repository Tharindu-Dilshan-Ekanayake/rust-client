import { memo, useEffect } from 'react'

import { useActiveMap } from '../../store/gameStore.js'
import AcresMap from './acres/AcresMap.jsx'
import BrambleMap from './bramble/BrambleMap.jsx'
import DustlineMap from './DustlineMap.jsx'
import HollowMap from './hollow/HollowMap.jsx'
import PalmwoodMap from './palmwood/PalmwoodMap.jsx'
import PinecrestMap from './pinecrest/PinecrestMap.jsx'
import { prewarmOtherMaps } from './prewarm.js'
import QuarterMap from './quarter/QuarterMap.jsx'
import TerminalMap from './terminal/TerminalMap.jsx'

const SCENES = { dustline: DustlineMap, acres: AcresMap, palmwood: PalmwoodMap, hollow: HollowMap, quarter: QuarterMap, bramble: BrambleMap, terminal: TerminalMap, pinecrest: PinecrestMap }

/**
 * The map on screen (the room's, or the one picked in the menus): its art and
 * its physics. Switching maps unmounts one and mounts the other, colliders and
 * all.
 */
export const MapScene = memo(function MapScene({ physics = true }) {
  const map = useActiveMap()
  const Scene = SCENES[map.id] ?? DustlineMap
  // A few seconds after the first map is up, get the others' textures ready.
  useEffect(() => {
    const t = setTimeout(() => prewarmOtherMaps(map.id), 4000)
    return () => clearTimeout(t)
  }, [map.id])
  return <Scene key={map.id} physics={physics} />
})

export default MapScene
