import { Quaternion, Vector3 } from 'three'

import { sfx } from '../audio/sfx.js'
import { decodeBroken, glassRayHit } from '../shared/glass.js'
import { fx } from './fx/fxApi.js'

/**
 * The client's side of breakable glass (shared/glass.js). The room's state
 * says which panes are broken; a shot of ours that hits a whole pane breaks
 * it at once (the server breaks the same pane from the same shot), so the
 * shooter sees and hears it without waiting. The pane meshes and colliders
 * (GlassPanes) follow along through `onChange`.
 */

/** A break we made ourselves the server hasn't confirmed yet is undone after this long. */
const CONFIRM_MS = 1500

export const glass = {
  /** The active map's panes. */
  panes: [],
  broken: new Set(),
  /** Panes we broke ourselves: index -> when (performance.now()). */
  predicted: new Map(),
  /** Called with (index, broken) when a pane breaks or is mended. */
  listeners: new Set(),
  /** The server's last word ('' = all whole); null before the first. */
  server: null,
}

function notify(i, broken) {
  for (const fn of glass.listeners) fn(i, broken)
}

/** A new map: every pane whole. */
export function setGlassMap(panes) {
  if (glass.panes === panes) return
  glass.panes = panes ?? []
  glass.broken.clear()
  glass.predicted.clear()
  glass.server = null
}

/** The first whole pane along a ray within `maxT`: { i, t } or null. */
export function glassAlong(o, d, maxT) {
  return glassRayHit(glass.panes, glass.broken, o, d, maxT)
}

const _q = new Quaternion()
const _u = new Vector3()
const _v = new Vector3()

/** Shatters pane `i`: gone from the world, glass bursting out of the frame, the crash of it. */
export function shatter(i, { dir = null, quiet = false } = {}) {
  if (glass.broken.has(i) || !glass.panes[i]) return
  glass.broken.add(i)
  notify(i, true)
  if (quiet) return
  const g = glass.panes[i]
  // The pane's face: its two longest axes.
  _q.set(g.q[0], g.q[1], g.q[2], g.q[3])
  const axes = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)].map((a, k) => ({ a: a.applyQuaternion(_q), h: g.half[k] }))
  axes.sort((p, q) => q.h - p.h)
  _u.copy(axes[0].a).multiplyScalar(axes[0].h)
  _v.copy(axes[1].a).multiplyScalar(axes[1].h)
  const area = axes[0].h * axes[1].h * 4
  const n = Math.min(44, Math.max(10, Math.round(area * 7)))
  const points = []
  for (let k = 0; k < n; k++) {
    const a = Math.random() * 2 - 1
    const b = Math.random() * 2 - 1
    points.push([g.p[0] + _u.x * a + _v.x * b, g.p[1] + _u.y * a + _v.y * b, g.p[2] + _u.z * a + _v.z * b])
  }
  fx.glass?.(points, dir)
  sfx.play('glassBreak', { pos: g.p, volume: 1, ref: 5 })
}

/** Mends pane `i` (a new round, or a break of ours the server never made). */
function mend(i) {
  if (!glass.broken.delete(i)) return
  glass.predicted.delete(i)
  notify(i, false)
}

/** One of our bullets hit pane `i` (travelling along `dir`): break it now, ahead of the server. */
export function shatterLocal(i, dir) {
  if (glass.broken.has(i)) return
  glass.predicted.set(i, performance.now())
  shatter(i, { dir })
}

/**
 * The room's state changed: `hex` is its broken set. New breaks shatter
 * (quietly on the first sync, which is just catching up), panes it doesn't
 * list are mended unless we broke them a moment ago and the server's yet to.
 */
export function syncGlass(hex) {
  const first = glass.server === null
  glass.server = hex ?? ''
  const now = decodeBroken(glass.server)
  for (const i of now) {
    glass.predicted.delete(i)
    shatter(i, { quiet: first })
  }
  const t = performance.now()
  for (const i of [...glass.broken]) {
    if (now.has(i)) continue
    const at = glass.predicted.get(i)
    if (at !== undefined && t - at < CONFIRM_MS) continue
    mend(i)
  }
}

/** Left the room: the glass is whole again (offline play starts from a whole map). */
export function resetGlass() {
  for (const i of [...glass.broken]) mend(i)
  glass.predicted.clear()
  glass.server = null
}

/** Breaks of ours the server still hasn't confirmed after a while are undone (online only). */
export function expirePredictions(online) {
  if (!online || !glass.predicted.size) return
  const t = performance.now()
  for (const [i, at] of glass.predicted) if (t - at > CONFIRM_MS && !decodeBroken(glass.server ?? '').has(i)) mend(i)
}
