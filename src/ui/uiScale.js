import { useEffect, useState } from 'react'

/**
 * The UI is laid out for a 1280 x 720 screen. Anything smaller (a phone held
 * sideways, a small tablet) gets the same layout scaled down to fit, so the
 * game view keeps most of the screen and nothing overlaps; bigger screens get
 * it at 1:1.
 */
const BASE_W = 1280
const BASE_H = 720
/** Below this the text stops being readable on a phone. */
const MIN_SCALE = 0.5

export function uiScale() {
  if (typeof window === 'undefined') return 1
  return Math.max(MIN_SCALE, Math.min(1, window.innerWidth / BASE_W, window.innerHeight / BASE_H))
}

/** Re-renders with the current scale and orientation when the window resizes or turns. */
export function useViewport() {
  const read = () => ({ scale: uiScale(), portrait: window.innerHeight > window.innerWidth })
  const [view, setView] = useState(read)
  useEffect(() => {
    const on = () => setView(read())
    window.addEventListener('resize', on)
    window.addEventListener('orientationchange', on)
    return () => {
      window.removeEventListener('resize', on)
      window.removeEventListener('orientationchange', on)
    }
  }, [])
  return view
}
