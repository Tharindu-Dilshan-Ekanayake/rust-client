import { BufferGeometry, Float32BufferAttribute, Quaternion } from 'three'

import { rampBox } from '../../../shared/mapKit.js'
import { boxGeo } from '../materials.js'

/**
 * Building blocks for Old Quarter's art: ground layer heights, iron railings
 * (plain and the square-pattern balcony kind), a box between two points.
 * Kept apart from the components (react-refresh wants component files to
 * export only components).
 */

/** Ground layers, a few millimetres apart, each also depth-offset by its material (oq.layer). */
export const GROUND_Y = { forest: -0.02, dust: 0, paving: 0.012, asphalt: 0.02, floor: 0.03 }
export const GROUND_K = { paving: 1, asphalt: 2, floor: 3 }

const _q = new Quaternion()

/** A box from `a` to `b` (x, y, z), `w` wide and `t` thick (a rail, a brace, a rod). */
export function addBar(P, material, a, b, w = 0.04, t = w) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const dz = b[2] - a[2]
  const len = Math.hypot(dx, dy, dz)
  if (len < 1e-4) return
  const r = rampBox(dy >= 0 ? b : a, dy >= 0 ? a : b, w, t)
  // rampBox lays a slab along its run: our bar is that slab turned on edge only when it's level.
  _q.set(r.q[0], r.q[1], r.q[2], r.q[3])
  P.add(material, boxGeo(w, t, len, 1), [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], _q.clone())
}

/**
 * A plain iron railing along [ax, az] -> [bx, bz] at floor `y`: posts about a
 * metre apart, a top rail and a mid rail.
 */
export function addRail(P, material, a, b, y, h = 1.0) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const n = Math.max(1, Math.round(len / 1.0))
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const x = a[0] + (b[0] - a[0]) * t
    const z = a[1] + (b[1] - a[1]) * t
    P.box(material, x, y + h / 2, z, 0.04, h, 0.04, 1)
  }
  for (const k of [h, h * 0.5]) addBar(P, material, [a[0], y + k, a[1]], [b[0], y + k, b[1]], 0.045, 0.045)
}

/**
 * The balcony railing with the square pattern: top and bottom rails, thin
 * balusters, and every so often a square frame between them.
 */
export function addFancyRail(P, material, a, b, y, h = 1.05) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  if (len < 0.05) return
  const ux = (b[0] - a[0]) / len
  const uz = (b[1] - a[1]) / len
  const at = (d) => [a[0] + ux * d, a[1] + uz * d]
  const alongX = Math.abs(ux) > 0.5
  const bar = (d, y0, y1) => {
    const [x, z] = at(d)
    P.box(material, x, (y0 + y1) / 2, z, 0.022, y1 - y0, 0.022, 1)
  }
  const flat = (d0, d1, yy, t = 0.035) => {
    const [x0, z0] = at(d0)
    const [x1, z1] = at(d1)
    P.box(material, (x0 + x1) / 2, yy, (z0 + z1) / 2, alongX ? Math.abs(x1 - x0) : t, t, alongX ? t : Math.abs(z1 - z0), 1)
  }
  flat(0, len, y + h, 0.05)
  flat(0, len, y + 0.12)
  for (const d of [0, len]) bar(d, y, y + h)
  // Squares every 0.6 m, balusters between them.
  const step = 0.6
  const n = Math.max(1, Math.floor(len / step))
  const pad = (len - n * step) / 2
  for (let i = 0; i < n; i++) {
    const c = pad + step * (i + 0.5)
    const s = 0.28
    const mid = y + 0.12 + (h - 0.12) / 2
    flat(c - s / 2, c + s / 2, mid - s / 2, 0.022)
    flat(c - s / 2, c + s / 2, mid + s / 2, 0.022)
    bar(c - s / 2, mid - s / 2, mid + s / 2)
    bar(c + s / 2, mid - s / 2, mid + s / 2)
    bar(c, y + 0.12, mid - s / 2)
    bar(c, mid + s / 2, y + h)
    for (const k of [-0.2, 0.2]) bar(c + k * (step / 0.6) * 0.75, y + 0.12, y + h)
  }
}

/** Two crossed upright planes with a region of the leaf atlas: a grass tuft or a weed. */
export function tuftGeometry(p, w, h, yaw, uv) {
  const [u0, v0, u1, v1] = uv
  const pos = []
  const nor = []
  const uvs = []
  const idx = []
  for (const a of [yaw, yaw + Math.PI / 2]) {
    const dx = (Math.cos(a) * w) / 2
    const dz = (-Math.sin(a) * w) / 2
    const k = pos.length / 3
    pos.push(p[0] - dx, p[1], p[2] - dz, p[0] + dx, p[1], p[2] + dz, p[0] + dx, p[1] + h, p[2] + dz, p[0] - dx, p[1] + h, p[2] - dz)
    nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0)
    uvs.push(u0, v0, u1, v0, u1, v1, u0, v1)
    idx.push(k, k + 1, k + 2, k, k + 2, k + 3)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  g.setIndex(idx)
  return g
}
