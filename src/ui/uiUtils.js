import { useEffect, useLayoutEffect, useRef } from 'react'

import { sfx } from '../audio/sfx.js'
import { ATTACHMENTS } from '../shared/weapons.js'

/** Short summary of fitted attachments, e.g. "Red Dot · Suppressor". */
export function attachmentSummary(att) {
  const parts = []
  if (att?.optic && att.optic !== 'iron') parts.push(ATTACHMENTS.optic[att.optic].name)
  if (att?.muzzle && att.muzzle !== 'none') parts.push(ATTACHMENTS.muzzle[att.muzzle].name)
  if (att?.mag === 'extended') parts.push('Ext. Mag')
  return parts.join(' · ')
}

export const uiClick = () => {
  sfx.unlockAudio()
  sfx.play('uiClick')
}
export const uiHover = () => sfx.play('uiHover')

/** Runs `fn(now)` every animation frame while mounted (for per-frame HUD bits). */
export function useAnimationFrame(fn) {
  const ref = useRef(fn)
  useLayoutEffect(() => {
    ref.current = fn
  })
  useEffect(() => {
    let id = 0
    const loop = (t) => {
      ref.current(t)
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [])
}

export const fmtTime = (s) => {
  const m = Math.floor(Math.max(0, s) / 60)
  const sec = Math.floor(Math.max(0, s) % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}
