import { BufferGeometry, Float32BufferAttribute, PlaneGeometry } from 'three'

import { signUV } from './textures.js'
import { tm } from './materials.js'

/**
 * Building blocks for Skyport Terminal's art, kept apart from the components
 * (react-refresh wants component files to export only components): ground
 * layer heights, signs from the atlas, glass panels in their frames, and the
 * loft that skins the jet.
 */

/** Ground layers, a few millimetres apart, each also depth-offset by its material (tm.layer). */
export const GROUND_Y = { grass: -0.03, tarmac: 0, asphalt: 0.008, paint: 0.014, kerb: 0.0, floor: 0.03 }
export const GROUND_K = { asphalt: 1, paint: 2, floor: 3 }

/** A sign from the atlas: a quad `w` x `h` centred on `p`, facing `yaw` (0 faces +z). */
export function addSign(P, name, p, w, h, yaw = 0) {
  const g = new PlaneGeometry(w, h)
  const [u0, v0, u1, v1] = signUV(name)
  const uv = g.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + (u1 - u0) * uv.getX(i), v0 + (v1 - v0) * uv.getY(i))
  P.add(tm.signs(), g, p, [0, yaw, 0])
}

/**
 * A hanging (or wall-mounted) sign: a dark box with the sign on its faces,
 * `faces` 1 (front only, facing `yaw`) or 2 (both ways).
 */
export function addSignBox(P, name, p, w, h, yaw = 0, faces = 2, hang = 0) {
  const d = 0.1
  const s = Math.sin(yaw)
  const c = Math.cos(yaw)
  P.box(tm.paint('#1c1d20', 0.6), p[0], p[1], p[2], Math.abs(c) * (w + 0.06) + Math.abs(s) * d, h + 0.06, Math.abs(s) * (w + 0.06) + Math.abs(c) * d, 1)
  const off = d / 2 + 0.004
  addSign(P, name, [p[0] + s * off, p[1], p[2] + c * off], w, h, yaw)
  if (faces > 1) addSign(P, name, [p[0] - s * off, p[1], p[2] - c * off], w, h, yaw + Math.PI)
  // Rods up to the ceiling.
  if (hang > 0) {
    for (const k of [-0.4, 0.4]) {
      const x = p[0] + c * w * k
      const z = p[2] - s * w * k
      P.box(tm.paint('#8a8c90', 0.4, 0.8), x, p[1] + h / 2 + hang / 2, z, 0.02, hang, 0.02, 1)
    }
  }
}

/**
 * Glass between two points along a straight line on the ground plan (x, z),
 * from `y0` to `y1`: the pane, and the frame round it (posts every `pitch`,
 * a rail top and bottom) in `frame` paint. `pane: false` draws just the
 * frame (glass that breaks is drawn by the glass system).
 */
export function addGlazing(P, a, b, y0, y1, { pitch = 1.5, frame = '#2e3136', post = 0.06, depth = 0.1, rails = true, glass = '#a9c4d4', pane = true } = {}) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  if (len < 0.02) return
  const ux = (b[0] - a[0]) / len
  const uz = (b[1] - a[1]) / len
  const yaw = Math.atan2(-uz, ux)
  const cx = (a[0] + b[0]) / 2
  const cz = (a[1] + b[1]) / 2
  if (pane) P.box(tm.glass(glass), cx, (y0 + y1) / 2, cz, len, y1 - y0, 0.02, 1, [0, yaw, 0])
  const paint = tm.paint(frame, 0.45, 0.6)
  const n = Math.max(1, Math.round(len / pitch))
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const x = a[0] + (b[0] - a[0]) * t
    const z = a[1] + (b[1] - a[1]) * t
    P.box(paint, x, (y0 + y1) / 2, z, post, y1 - y0, depth, 1, [0, yaw, 0])
  }
  if (rails) {
    for (const y of [y0 + post / 2, y1 - post / 2]) P.box(paint, cx, y, cz, len, post, depth, 1, [0, yaw, 0])
  }
}

/**
 * A lofted surface round an axis along z: `stations` [{ z, yc, r }] and a
 * list of `angles` (radians, round from +x towards +y); quads whose middle
 * falls inside a `hole` ({ a0, a1, z0, z1 }) are left out. UV: u along the
 * whole length (`u0`..`u1` over `uz0`..`uz1`), v = angle / 2π. `inward` turns
 * the faces to look inside (a lining).
 */
export function loftGeometry(stations, angles, { holes = [], inward = false, uz0 = 0, uz1 = 1, vRepeat = 1, uScale = null, x = 0 } = {}) {
  const pos = []
  const nor = []
  const uv = []
  const idx = []
  const ring = (s, a) => [x + Math.cos(a) * s.r, s.yc + Math.sin(a) * s.r, s.z]
  for (let i = 0; i < stations.length - 1; i++) {
    const s0 = stations[i]
    const s1 = stations[i + 1]
    for (let k = 0; k < angles.length - 1; k++) {
      const a0 = angles[k]
      const a1 = angles[k + 1]
      const am = (a0 + a1) / 2
      const zm = (s0.z + s1.z) / 2
      if (holes.some((h) => zm > h.z0 && zm < h.z1 && am > h.a0 && am < h.a1)) continue
      const base = pos.length / 3
      const pts = [ring(s0, a0), ring(s1, a0), ring(s1, a1), ring(s0, a1)]
      const ns = [
        [Math.cos(a0), Math.sin(a0)],
        [Math.cos(a0), Math.sin(a0)],
        [Math.cos(a1), Math.sin(a1)],
        [Math.cos(a1), Math.sin(a1)],
      ]
      // Normals: radial, tipped by how fast the radius (and the centre) change along z (cones, the nose's droop).
      const dz = Math.max(1e-6, s1.z - s0.z)
      const dr = (s1.r - s0.r) / dz
      const dy = (s1.yc - s0.yc) / dz
      const zs = [s0.z, s1.z, s1.z, s0.z]
      const us = zs.map((z) => (uScale ? z * uScale : (z - uz0) / (uz1 - uz0)))
      const vs = [a0, a0, a1, a1].map((a) => (a / (Math.PI * 2)) * vRepeat)
      for (let j = 0; j < 4; j++) {
        pos.push(...pts[j])
        const nx = ns[j][0]
        const ny = ns[j][1]
        const nz = -(dr + dy * ny)
        const l = Math.hypot(nx, ny, nz) * (inward ? -1 : 1)
        nor.push(nx / l, ny / l, nz / l)
        uv.push(us[j], vs[j])
      }
      if (inward) idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
      else idx.push(base, base + 2, base + 1, base, base + 3, base + 2)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

/** Evenly spaced angles round a circle (0..2π, `n` steps), with extra break points added in (door edges). */
export function ringAngles(n, extra = []) {
  const out = []
  for (let i = 0; i <= n; i++) out.push((i / n) * Math.PI * 2)
  for (const a of extra) out.push(((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2))
  return [...new Set(out.map((a) => +a.toFixed(5)))].sort((p, q) => p - q)
}

/**
 * A flat shape (a list of [u, v] points, convex, counter-clockwise) swept
 * straight along `from` -> `to`, `uAxis` giving which way u points across it.
 * Used for the container's chamfered side, the bins, the wing's ribs.
 */
export function prismGeometry(shape, depth) {
  const pos = []
  const nor = []
  const uv = []
  const idx = []
  const n = shape.length
  // Caps.
  for (const [z, s] of [
    [-depth / 2, -1],
    [depth / 2, 1],
  ]) {
    const base = pos.length / 3
    for (const [x, y] of shape) {
      pos.push(x, y, z)
      nor.push(0, 0, s)
      uv.push(x, y)
    }
    for (let i = 1; i < n - 1; i++) {
      if (s > 0) idx.push(base, base + i, base + i + 1)
      else idx.push(base, base + i + 1, base + i)
    }
  }
  // Sides.
  for (let i = 0; i < n; i++) {
    const [x0, y0] = shape[i]
    const [x1, y1] = shape[(i + 1) % n]
    const len = Math.hypot(x1 - x0, y1 - y0)
    const nx = (y1 - y0) / len
    const ny = -(x1 - x0) / len
    const base = pos.length / 3
    pos.push(x0, y0, -depth / 2, x1, y1, -depth / 2, x1, y1, depth / 2, x0, y0, depth / 2)
    for (let k = 0; k < 4; k++) nor.push(nx, ny, 0)
    uv.push(0, 0, len, 0, len, depth, 0, depth)
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}
