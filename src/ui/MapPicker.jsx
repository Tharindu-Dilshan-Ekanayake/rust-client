import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { MAP_IDS, MAPS } from '../shared/maps.js'
import { useGameStore } from '../store/gameStore.js'
import { drawMapPlan } from './mapPlan.js'
import { uiClick, uiHover } from './uiUtils.js'

/** How many maps show at once; the rest scroll. */
const SHOWN = 3

/** One map to pick: its plan from above, name and size (the short name in the quick-play row). */
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
 * rooms both use it. However many maps there are, three show at a time and the
 * rest scroll (the wheel, a swipe, or the arrows, a page at a time), with the
 * count and which ones are showing above them; the chosen map is always
 * scrolled into view. `compact` is the main menu's map card: a column. The
 * quick-play picker is a row.
 */
export function MapPicker({ compact = false }) {
  const choice = useGameStore((s) => s.mapChoice)
  const setMapChoice = useGameStore((s) => s.setMapChoice)
  const list = useRef(null)
  const [view, setView] = useState({ first: 0, atStart: true, atEnd: MAP_IDS.length <= SHOWN })
  const total = MAP_IDS.length

  /** The list's scroll along its axis, and one tile's step (its size and the gap). */
  const measure = useCallback(() => {
    const el = list.current
    const tiles = el?.children
    if (!el || !tiles?.length) return null
    const step = tiles.length > 1 ? (compact ? tiles[1].offsetTop - tiles[0].offsetTop : tiles[1].offsetLeft - tiles[0].offsetLeft) : 1
    const pos = compact ? el.scrollTop : el.scrollLeft
    const max = compact ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth
    return { el, step, pos, max }
  }, [compact])

  const update = useCallback(() => {
    const m = measure()
    if (!m) return
    setView({ first: Math.min(total - 1, Math.round(m.pos / m.step)), atStart: m.pos <= 2, atEnd: m.pos >= m.max - 2 })
  }, [measure, total])

  // Keep the chosen map in view: when the picker opens and when the choice
  // changes (the scroll it makes updates the count above, through onScroll).
  useLayoutEffect(() => {
    const m = measure()
    if (!m) return
    const i = Math.max(0, MAP_IDS.indexOf(choice))
    const lo = m.step * i - m.step * (SHOWN - 1)
    const hi = m.step * i
    const to = Math.min(Math.max(m.pos, lo), hi)
    if (compact) m.el.scrollTop = to
    else m.el.scrollLeft = to
  }, [choice, compact, measure])

  // A mouse wheel scrolls the row sideways too.
  useEffect(() => {
    const el = list.current
    if (!el || compact) return undefined
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      e.preventDefault()
      el.scrollBy({ left: e.deltaY, behavior: 'smooth' })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [compact])

  const page = (dir) => {
    const m = measure()
    if (!m) return
    uiClick()
    const by = dir * m.step * SHOWN
    m.el.scrollBy(compact ? { top: by, behavior: 'smooth' } : { left: by, behavior: 'smooth' })
  }

  const last = Math.min(total, view.first + SHOWN)
  return (
    <div className={`dl-mappick ${compact ? 'compact' : 'row dl-slide-up'}`}>
      <div className="dl-mappick-bar">
        <span className="title">Map</span>
        <span className="count">{total} maps</span>
        {total > SHOWN && (
          <span className="nav">
            <span className="range" aria-live="polite">
              {view.first + 1}–{last} of {total}
            </span>
            <button type="button" className="arrow" aria-label={compact ? 'Earlier maps' : 'Previous maps'} disabled={view.atStart} onMouseEnter={uiHover} onClick={() => page(-1)}>
              {compact ? '▲' : '‹'}
            </button>
            <button type="button" className="arrow" aria-label={compact ? 'Later maps' : 'More maps'} disabled={view.atEnd} onMouseEnter={uiHover} onClick={() => page(1)}>
              {compact ? '▼' : '›'}
            </button>
          </span>
        )}
      </div>
      <div ref={list} className={`dl-mappick-list ${view.atStart ? '' : 'more-before'} ${view.atEnd ? '' : 'more-after'}`} role="radiogroup" aria-label="Map" onScroll={update}>
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
    </div>
  )
}

export default MapPicker
