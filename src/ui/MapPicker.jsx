import { useMemo } from 'react'

import { DEFAULT_MAP, MAP_IDS, MAPS } from '../shared/maps.js'
import { useGameStore } from '../store/gameStore.js'
import { drawMapPlan } from './mapPlan.js'
import { uiClick, uiHover } from './uiUtils.js'

/** One map to pick: its plan from above, name and size. */
function MapTile({ id, on, onPick }) {
  const map = MAPS[id]
  const plan = useMemo(() => drawMapPlan(map, 128).canvas.toDataURL(), [map])
  return (
    <button type="button" role="radio" aria-checked={on} className={`dl-maptile ${on ? 'on' : ''}`} onMouseEnter={uiHover} onClick={onPick}>
      <img src={plan} alt="" />
      <span className="text">
        <strong>{map.name}</strong>
        <small>
          {map.tagline} · {map.size}
        </small>
      </span>
      {id === DEFAULT_MAP && <span className="dl-tag new">New</span>}
    </button>
  )
}

/**
 * Which map to play (saved, and shown behind the menus): quick play and private
 * rooms both use it. `compact` stacks the tiles for the main menu's map card.
 */
export function MapPicker({ compact = false }) {
  const choice = useGameStore((s) => s.mapChoice)
  const setMapChoice = useGameStore((s) => s.setMapChoice)
  return (
    <div className={`dl-mappick ${compact ? 'compact' : 'dl-slide-up'}`} role="radiogroup" aria-label="Map">
      {MAP_IDS.map((id) => (
        <MapTile
          key={id}
          id={id}
          on={choice === id}
          onPick={() => {
            if (choice === id) return
            uiClick()
            setMapChoice(id)
          }}
        />
      ))}
    </div>
  )
}

export default MapPicker
