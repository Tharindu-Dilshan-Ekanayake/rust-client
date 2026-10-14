import { useMemo } from 'react'

import { MAP_IDS, MAPS } from '../shared/maps.js'
import { useGameStore } from '../store/gameStore.js'
import { drawMapPlan } from './mapPlan.js'
import { uiClick, uiHover } from './uiUtils.js'

/** One map to pick: its plan from above, name and size (the short name in the quick-play row, five across). */
function MapTile({ id, on, onPick, compact }) {
  const map = MAPS[id]
  const plan = useMemo(() => drawMapPlan(map, 128).canvas.toDataURL(), [map])
  return (
    <button type="button" role="radio" aria-checked={on} aria-label={map.name} title={map.name} className={`dl-maptile ${on ? 'on' : ''}`} onMouseEnter={uiHover} onClick={onPick}>
      <img src={plan} alt="" />
      <span className="text">
        <strong>{compact ? map.name : map.short ?? map.name}</strong>
        <small>
          {map.tagline} · {map.size}
        </small>
      </span>
      {map.isNew && <span className="dl-tag new">New</span>}
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
          compact={compact}
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
