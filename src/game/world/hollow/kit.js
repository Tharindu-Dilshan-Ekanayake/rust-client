import { ConeGeometry, CylinderGeometry, Matrix4, Quaternion, SphereGeometry, Vector3 } from 'three'

import { CREEK, STRING_LIGHTS } from '../../../shared/mapHollow.js'
import { seededRandom } from '../../../shared/math.js'
import { once } from '../acres/pieces.js'
import { FACE_COUNT } from './textures.js'
import { hc } from './materials.js'

/**
 * Building blocks for Hollow Creek's props: ground layer heights, a cylinder
 * between two points (branches, rails), the ribbed pumpkin and its carved
 * face, candles. Kept apart from the components (react-refresh wants
 * component files to export only components).
 */

/** Ground layers, a few millimetres apart, each also depth-offset by its material (hc.layer). */
export const GROUND_Y = { forest: -0.02, lawn: 0, mud: 0.006, water: 0.012, walk: 0.018, plaza: 0.021, road: 0.024, line: 0.03 }
/** Which hc.layer offset each ground layer uses. */
export const GROUND_K = { mud: 1, water: 2, walk: 3, plaza: 3.5, road: 4, line: 5 }

const _up = new Vector3(0, 1, 0)
const _d = new Vector3()
const _q = new Quaternion()

/** A tapered cylinder from a to b (world points), `seg` sides. */
export function addSegment(P, material, a, b, r0, r1 = r0, seg = 6) {
  _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  const len = _d.length()
  if (len < 1e-4) return
  _q.setFromUnitVectors(_up, _d.normalize())
  const g = new CylinderGeometry(r1, r0, len, seg, 1, true)
  // UVs at bark scale: one tile per metre up the trunk.
  const uv = g.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), uv.getY(i) * len)
  P.add(material, g, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], _q.clone())
}

/** A unit pumpkin (0.42 m across, 0.32 tall at size 1): a squashed sphere with nine ribs. */
let pumpkinGeo = null
export function pumpkinGeometry() {
  if (pumpkinGeo) return pumpkinGeo
  const g = new SphereGeometry(0.21, 18, 10)
  const pos = g.getAttribute('position')
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const a = Math.atan2(z, x)
    const groove = Math.abs(Math.sin(a * 4.5))
    const k = 0.9 + 0.1 * Math.sqrt(groove)
    // Squashed, with a dimple top and bottom.
    const dimple = Math.sign(y) * 0.012 * (1 - Math.min(1, Math.hypot(x, z) / 0.08))
    pos.setXYZ(i, x * k, y * 0.74 - dimple, z * k)
  }
  g.computeVertexNormals()
  g.translate(0, 0.155, 0)
  pumpkinGeo = g
  return g
}

const stemGeo = new CylinderGeometry(0.012, 0.022, 0.07, 5)
/**
 * The carving: a patch of a sphere just outside the pumpkin's front (+z),
 * squashed like it, so the glowing cuts sit on the curved skin from any angle.
 */
const faceGeos = Array.from({ length: FACE_COUNT }, (_, i) => {
  const L = 1.5
  const g = new SphereGeometry(0.213, 10, 8, Math.PI / 2 - L / 2, L, 0.85, 1.45)
  g.scale(1, 0.74, 1)
  g.translate(0, 0.155, 0)
  const uv = g.getAttribute('uv')
  for (let k = 0; k < uv.count; k++) uv.setXY(k, (i + uv.getX(k)) / FACE_COUNT, uv.getY(k))
  return g
})

/**
 * A pumpkin at `p` (its foot), `s` times the size, turned `rotY` (a carved
 * one's face looks along +z turned by rotY). `face` picks the carving.
 */
export function addPumpkin(P, p, s, carved, rotY, face = 0) {
  P.add(hc.pumpkin(), pumpkinGeometry(), p, [0, rotY, 0], [s, s, s])
  P.add(hc.paint('#4a5a26', 0.9), stemGeo, [p[0], p[1] + 0.31 * s, p[2]], [0.15, rotY, 0.1], [s, s, s])
  if (carved) P.add(hc.faces(), faceGeos[face % FACE_COUNT], p, [0, rotY, 0], [s, s, s])
}

const waxGeo = new CylinderGeometry(1, 1, 1, 6)
const flameGeo = new SphereGeometry(1, 5, 4)

/** A cluster of `n` candles round `p`, of mixed heights. */
export function addCandles(P, p, n, rand) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand() * 0.8
    const r = n > 1 ? 0.1 + rand() * 0.16 : 0
    const h = 0.08 + rand() * 0.16
    const w = 0.022 + rand() * 0.014
    const x = p[0] + Math.cos(a) * r
    const z = p[2] + Math.sin(a) * r
    P.add(hc.wax(), waxGeo, [x, p[1] + h / 2, z], null, [w, h, w])
    P.add(hc.flame(), flameGeo, [x, p[1] + h + 0.025, z], null, [0.011, 0.028, 0.011])
  }
}

/** A polyline smoothed into a gentle curve (Chaikin), for the creek and the paths. */
export function smooth(points, rounds = 3) {
  let pts = points
  for (let r = 0; r < rounds; r++) {
    const out = [pts[0]]
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i]
      const [bx, bz] = pts[i + 1]
      out.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25], [ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75])
    }
    out.push(pts[pts.length - 1])
    pts = out
  }
  return pts
}

/** The creek's centre line, smoothed (shared with the culverts and the mist). */
export const creekLine = () => once('hc:creekLine', () => smooth(CREEK.points))

/** Where the creek crosses a vertical line x = at: its centre z. */
export function creekZAt(at) {
  const pts = creekLine()
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1]
    const [bx, bz] = pts[i]
    if ((ax - at) * (bx - at) <= 0 && ax !== bx) return az + ((at - ax) / (bx - ax)) * (bz - az)
  }
  return pts[0][1]
}


/** Runs `fn` with everything it adds leaned over by `angle` about the current frame's x axis (round its origin). */
export function withTilt(P, angle, fn) {
  const prev = P.frame
  const tilt = new Matrix4().makeRotationX(angle)
  P.frame = prev ? prev.clone().multiply(tilt) : tilt
  try {
    fn()
  } finally {
    P.frame = prev
  }
}

/**
 * The bulbs on the string lights: every ~0.42 m along each run's sag, hanging
 * a little under the wire, orange and purple by turns. Shared by the strings
 * and their glows (night.jsx).
 */
export const stringBulbs = () =>
  once('hc:stringBulbs', () => {
    const out = []
    let i = 0
    for (const [a, b, sag] of STRING_LIGHTS) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
      const n = Math.max(2, Math.round(len / 0.42))
      for (let k = 1; k < n; k++) {
        const t = k / n
        out.push({
          p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t) - 0.06, a[2] + (b[2] - a[2]) * t],
          color: i++ % 2 ? 'purple' : 'orange',
        })
      }
    }
    return out
  })

/** A pine into pieces (also used by the backdrop's forest). */
export function addPine(P, p, h, seed, cones = 5) {
  const rand = seededRandom(seed)
  P.add(hc.bark(), new CylinderGeometry(0.07, 0.24, h * 0.92, 7), [p[0], (h * 0.92) / 2, p[2]])
  const base = h * 0.18
  for (let i = 0; i < cones; i++) {
    const t = i / cones
    const r = (h / 4.2) * (1 - t * 0.78) * (0.92 + rand() * 0.16)
    const ch = (h / cones) * 1.55
    const y = base + t * (h - base - ch * 0.6) + ch / 2
    P.add(hc.needles(), new ConeGeometry(r, ch, 9), [p[0] + (rand() - 0.5) * 0.12, y, p[2] + (rand() - 0.5) * 0.12], [0, rand() * 3, 0])
  }
}

