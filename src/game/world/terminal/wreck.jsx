import { useMemo } from 'react'
import { CylinderGeometry, LatheGeometry, Quaternion, Vector2, Vector3 } from 'three'

import { WRECK, WRECK_ENGINES, WRECK_SCAR, WRECK_SECTIONS, WRECK_WING, wreckAt, wreckSection, wreckWingSlab } from '../../../shared/mapTerminal.js'
import { seededRandom } from '../../../shared/math.js'
import { Merged } from '../acres/merge.jsx'
import { once, Pieces } from '../acres/pieces.js'
import { addBar } from '../quarter/kit.js'
import { GROUND_Y, loftGeometry, prismGeometry, ringAngles } from './kit.js'
import { tm } from './materials.js'

/**
 * The crashed jet (shared/mapTerminal.js: WRECK_SECTIONS and the rest): its
 * three broken sections lying on their bellies, sooty skin torn ragged at the
 * breaks, the frames showing; inside, the burnt-out cabin, seats and embers.
 * The left wing's stub, the fin, the torn-off right wing propped on its own
 * wreckage, both engines; the scar it ploughed across the apron with the
 * pieces it shed along it, and the shell craters round the apron.
 */

const W = WRECK
/** A flat disc, 1 m across: soot decals, scaled to size. */
const disc = new CylinderGeometry(0.5, 0.5, 0.001, 18)

/** Builds once per key and draws it at an entity's place. */
function Placed({ k, build, p, rotY = 0 }) {
  const parts = useMemo(() => once(k, build), [k, build])
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      <Merged parts={parts} />
    </group>
  )
}

/** A convex outline turned counter-clockwise (prismGeometry wants it so). */
function ccw(points) {
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[(i + 1) % points.length]
    area += x0 * y1 - x1 * y0
  }
  return area < 0 ? [...points].reverse() : points
}

/** A flat outline in the ground plan ([x, z] points) as a slab `t` thick, lying flat (its middle at y = 0). */
function planSlab(points, t) {
  const g = prismGeometry(ccw(points.map(([x, z]) => [x, -z])), t)
  return g.rotateX(-Math.PI / 2)
}

/* ---------------------------------------------------------------------------
 * The fuselage's sections
 * ------------------------------------------------------------------------- */

/** Below this angle range the skin's under the concrete: not drawn. */
const BURIED = { a0: 4.02, a1: 5.4, z0: -99, z1: 99 }

function buildSection(id) {
  const s = wreckSection(id)
  const P = new Pieces()
  const rand = seededRandom(9001 + id.length * 31)
  const angles = ringAngles(24)
  // Stations: through the cones, the tube, and close together at a torn end (so its edge can be ragged).
  const zs = new Set([s.z0, s.body0, s.body1, s.z1])
  for (let z = s.z0; z < s.body0; z += 0.6) zs.add(+z.toFixed(3))
  for (let z = s.body1; z < s.z1; z += 0.8) zs.add(+z.toFixed(3))
  for (let z = s.body0; z < s.body1; z += 1.5) zs.add(+z.toFixed(3))
  if (s.open[0]) for (const d of [0.25, 0.55]) zs.add(s.z0 + d)
  if (s.open[1]) for (const d of [0.25, 0.55]) zs.add(s.z1 - d)
  const stations = [...zs].sort((a, b) => a - b).map((z) => ({ z, ...wreckAt(s, z) }))
  // The torn edges: whole panels missing near each break.
  const holes = [BURIED]
  for (const [open, z0, z1] of [
    [s.open[0], s.z0, s.z0 + 0.55],
    [s.open[1], s.z1 - 0.55, s.z1],
  ]) {
    if (!open) continue
    for (let k = 0; k < angles.length - 1; k++) {
      const r = rand()
      if (r < 0.45) continue
      const deep = r > 0.8
      const a0 = angles[k]
      const a1 = angles[k + 1]
      if (z0 === s.z0) holes.push({ a0, a1, z0: z0 - 0.01, z1: deep ? z0 + 0.6 : z0 + 0.3 })
      else holes.push({ a0, a1, z0: deep ? z1 - 0.6 : z1 - 0.3, z1: z1 + 0.01 })
    }
  }
  P.add(tm.wreckSkin(), loftGeometry(stations, angles, { holes, uScale: 1 / 6 }), [0, 0, 0])
  // The lining inside (what's left of it: black), only along the tube.
  const inner = stations.filter((st) => st.z >= s.body0 - 1e-6 && st.z <= s.body1 + 1e-6).map((st) => ({ ...st, r: st.r - 0.12 }))
  P.add(tm.charred('#958a80'), loftGeometry(inner, angles, { holes, inward: true, uScale: 1 / 6 }), [0, 0, 0])
  // Frames round the torn ends: the ring the skin tore away from.
  const frame = tm.paint('#3a3430', 0.8, 0.4)
  for (const [open, z] of [
    [s.open[0], s.z0 + 0.04],
    [s.open[1], s.z1 - 0.04],
  ]) {
    if (!open) continue
    const m = wreckAt(s, z)
    for (let k = 0; k < 24; k++) {
      const a = ((k + 0.5) / 24) * Math.PI * 2
      if (a > BURIED.a0 && a < BURIED.a1) continue
      if (rand() < 0.2) continue
      const r = m.r - 0.07
      P.box(frame, Math.cos(a) * r, m.yc + Math.sin(a) * r, z, 0.08, 0.5, 0.1, 1, [0, 0, a])
    }
    // Torn panels bent out round the edge.
    for (let i = 0; i < 6; i++) {
      const a = 0.2 + rand() * 3.4
      const out = z > 0 ? 1 : -1
      const r = m.r + 0.1
      P.box(tm.wreckSkin(), Math.cos(a) * r, m.yc + Math.sin(a) * r, z + out * 0.35, 0.7, 0.04, 0.9, 1, [out * (0.5 + rand() * 0.5), 0, a + Math.PI / 2])
    }
  }
  // The floor, burnt black, and the seats on it (their frames, and what's left of the cushions).
  P.box(tm.charred('#7a7068'), 0, W.floor - 0.02, (s.body0 + s.body1) / 2, 3.3, 0.04, s.body1 - s.body0 - 0.04, 1)
  for (const [x0, x1, z0, z1, h] of s.seats) {
    const cx = (x0 + x1) / 2
    const cz = (z0 + z1) / 2
    P.box(tm.charred('#6a6058'), cx, W.floor + 0.22, cz, x1 - x0, 0.44, z1 - z0, 1)
    P.box(tm.charred('#4e4640'), cx, W.floor + h - 0.25, z1 - 0.1, x1 - x0, 0.5, 0.12, 1, [-0.2, 0, 0])
    P.box(tm.paint('#5a524a', 0.6, 0.5), cx, W.floor + 0.48, cz, x1 - x0 + 0.04, 0.04, 0.06, 1)
  }
  // Embers smouldering on the floor near the break.
  const emberZ = s.open[1] ? s.z1 - 1.4 : s.z0 + 1.4
  for (let i = 0; i < 6; i++) P.box(tm.ember(), (rand() - 0.5) * 2.2, W.floor + 0.03, emberZ + (rand() - 0.5) * 2.0, 0.3 + rand() * 0.4, 0.06, 0.25 + rand() * 0.3, 1, [0, rand() * 3, 0])
  // Windows down both sides: black holes in the soot.
  const dark = tm.paint('#0c0b0a', 0.9)
  for (const side of [-1, 1]) {
    for (let z = s.body0 + 0.6; z < s.body1 - 0.4; z += 0.53) {
      if (rand() < 0.15) continue
      const a = side > 0 ? 0.24 : Math.PI - 0.24
      const r = W.R + 0.004
      P.box(dark, Math.cos(a) * r, W.yc + Math.sin(a) * r, z, 0.02, 0.32, 0.22, 1, [0, 0, a])
    }
  }
  if (id === 'nose') {
    // The cockpit's windows, smashed out, and the nose crumpled where it hit.
    const m = wreckAt(s, s.z0 + 2.2)
    for (const a of [1.15, Math.PI / 2, Math.PI - 1.15]) P.box(dark, Math.cos(a) * (m.r + 0.02), m.yc + Math.sin(a) * (m.r + 0.02), s.z0 + 2.2, 0.55, 0.05, 0.32, 1, [0.5, 0, a - Math.PI / 2])
    for (let i = 0; i < 6; i++) P.box(tm.wreckSkin(), (rand() - 0.5) * 1.6, 0.3 + rand() * 0.8, s.z0 + 0.4 + rand() * 0.8, 0.8, 0.05, 0.6, 1, [rand() * 2, rand() * 2, rand() * 2])
  }
  if (s.wing) addStub(P, s, rand)
  if (s.fin) addFin(P, s)
  return P.build()
}

/** The left wing's stub, lying on the concrete, its torn end ragged and bars of the spar out of it. */
function addStub(P, s, rand) {
  const w = s.wing
  const at = (d) => {
    const f = (d - w.root) / (w.tip - w.root)
    return { le: w.le[0] + (w.le[1] - w.le[0]) * f, te: w.te[0] + (w.te[1] - w.te[0]) * f }
  }
  const r0 = at(w.root)
  const r1 = at(w.tip)
  P.add(tm.paint('#5e5c58', 0.55, 0.35), planSlab([[-1.4, r0.le], [-w.tip, r1.le], [-w.tip, r1.te], [-1.4, r0.te]], 0.36), [0, 0.2, 0])
  P.add(tm.scorch(), disc, [-(w.root + w.tip) / 2, 0.385, (r0.le + r0.te) / 2], [0, 0, 0], [5.0, 1, 3.6])
  // The torn end: lumps of the spar and ribs, a pipe hanging out.
  const steel = tm.paint('#4a4642', 0.7, 0.6)
  for (let i = 0; i < 6; i++) {
    const z = r1.le + rand() * (r1.te - r1.le)
    addBar(P, steel, [-w.tip + 0.1, 0.2, z], [-w.tip - 0.3 - rand() * 0.6, 0.1 + rand() * 0.4, z + (rand() - 0.5) * 0.6], 0.05, 0.05)
  }
}

/** The fin, up from the tail cone: a slab of the airline's navy, sooted. */
function addFin(P, s) {
  const f = s.fin
  const outline = [
    [f.root[0], f.y0],
    [f.root[1], f.y0],
    [f.tipZ[1], f.y1],
    [f.tipZ[0], f.y1],
  ]
  // Shape [-z, y] extruded along x (prismGeometry's z), turned a quarter about y.
  const g = prismGeometry(ccw(outline.map(([z, y]) => [-z, y])), f.thick)
  g.rotateY(Math.PI / 2)
  P.add(tm.paint('#26324a', 0.5, 0.2), g, [0, 0, 0])
  for (const side of [-1, 1]) P.add(tm.scorch(), disc, [side * (f.thick / 2 + 0.012), f.y0 + 1.6, (f.root[0] + f.root[1]) / 2 + 0.6], [0, 0, Math.PI / 2], [3.0, 1, 4.0])
}

export const WreckSection = ({ id, p, rotY }) => <Placed k={`tm:wreck:${id}`} build={() => buildSection(id)} p={p} rotY={rotY} />

/* ---------------------------------------------------------------------------
 * The torn-off wing and the engines
 * ------------------------------------------------------------------------- */

function buildWing() {
  const P = new Pieces()
  const rand = seededRandom(9101)
  const w = WRECK_WING
  const slab = wreckWingSlab()
  // In the slab's frame: x along the span (root at -x), z down the chord (leading edge at -z).
  const half = w.span / 2
  const L = slab.size[2] / 2
  const outline = [
    [-half, -L],
    [half, -L + 0.5],
    [half, L - 0.2],
    [-half, L],
  ]
  const g = planSlab(outline, w.thick)
  // The slab is placed in world space; this draws in the entity's frame (at its place, turned rotY): undo that.
  const unturn = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -w.rotY)
  const rel = unturn.clone().multiply(new Quaternion(...slab.q))
  const local = new Vector3(slab.p[0] - w.p[0], slab.p[1], slab.p[2] - w.p[2]).applyQuaternion(unturn).toArray()
  P.add(tm.paint('#5e5c58', 0.55, 0.35), g, local, rel)
  // Soot over it, its torn root end, embers under it, the wreckage it's propped on.
  const top = new Vector3(-1.6, w.thick / 2 + 0.012, 0).applyQuaternion(rel)
  P.add(tm.scorch(), disc, [local[0] + top.x, local[1] + top.y, local[2] + top.z], rel, [6.0, 1, 3.4])
  const steel = tm.paint('#4a4642', 0.7, 0.6)
  for (let i = 0; i < 7; i++) {
    // (The slab's high at its leading edge, -z, down on the concrete at its trailing edge.)
    const z = (rand() - 0.5) * 2.6
    const y = (w.lift / 2) * (1 - z / L)
    addBar(P, steel, [-half + 0.2, y, z], [-half - 0.4 - rand() * 0.7, Math.max(0.1, y - 0.2 + rand() * 0.4), z + (rand() - 0.5) * 0.5], 0.05, 0.05)
  }
  for (let i = 0; i < 5; i++) P.box(tm.ember(), -half + 0.6 + rand() * 1.4, 0.05, (rand() - 0.5) * 2.0, 0.4, 0.08, 0.3, 1, [0, rand() * 3, 0])
  // Wreckage it's propped on along its leading edge.
  for (let i = 0; i < 5; i++) P.box(tm.charred('#3a342e'), -half + 1 + i * 2.2, 0.4, -1.5, 0.7, 0.8, 0.5, 1, [rand() * 0.4, rand() * 3, rand() * 0.4])
  return P.build()
}

export const WreckWing = ({ p, rotY }) => <Placed k="tm:wreck:wing" build={buildWing} p={p} rotY={rotY} />

function buildEngine(index) {
  const P = new Pieces()
  const rand = seededRandom(9201 + index)
  const e = WRECK_ENGINES[index]
  const y = e.r - 0.15
  const len = e.length
  // The cowl, turned on a lathe (tipped over: the lathe's y is our z), crumpled at the intake.
  const cowl = [
    [e.r - 0.16, 0],
    [e.r - 0.02, 0.08],
    [e.r, 0.4],
    [e.r, len * 0.6],
    [e.r * 0.84, len],
  ].map(([r, h]) => new Vector2(r, h))
  const tip = [Math.PI / 2, 0, 0]
  P.add(tm.charred('#4a4440'), new LatheGeometry(cowl, 20), [0, y, -len / 2], tip)
  P.add(tm.charred('#141210'), new LatheGeometry([new Vector2(e.r - 0.16, 0.8), new Vector2(e.r - 0.16, 0)], 20), [0, y, -len / 2], tip)
  P.add(tm.paint('#3a3632', 0.7, 0.6), new CylinderGeometry(e.r - 0.18, e.r - 0.18, 0.06, 20), [0, y, -len / 2 + 0.8], [Math.PI / 2, 0, 0])
  // Fan blades bent back, the exhaust's cone.
  const blade = tm.paint('#5a5650', 0.5, 0.7)
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2
    P.box(blade, Math.cos(a) * 0.45, y + Math.sin(a) * 0.45, -len / 2 + 0.74, 0.12, 0.6, 0.03, 1, [rand() * 0.6, 0, a + Math.PI / 2])
  }
  P.add(tm.charred('#2a2622'), new LatheGeometry([new Vector2(e.r * 0.84 - 0.02, len), new Vector2(0.5, len + 0.8), new Vector2(0.05, len + 1.3)], 16), [0, y, -len / 2], tip)
  P.box(tm.ember(), 0, y - e.r + 0.35, -len / 2 + 1.6, 0.9, 0.06, 1.4, 1)
  P.add(tm.scorch(), disc, [0, GROUND_Y.paint + 0.01, 0.4], [0, 0, 0], [4.4, 1, 5.6])
  return P.build()
}

export const WreckEngine = ({ index, p, rotY }) => <Placed k={`tm:wreck:engine:${index}`} build={() => buildEngine(index)} p={p} rotY={rotY} />

/* ---------------------------------------------------------------------------
 * The scar, the pieces along it, the craters
 * ------------------------------------------------------------------------- */

/** Shell craters on the apron: [x, z, radius]. */
const CRATERS = [
  [16.0, 2.0, 1.6],
  [-12.0, 28.4, 1.4],
  [24.0, 34.0, 1.8],
  [-40.0, 10.4, 1.4],
  [5.0, -3.0, 1.2],
  [41.0, 28.6, 1.6],
  [-2.0, 43.6, 1.5],
  [-48.0, -14.0, 1.3],
]

function buildDebris() {
  const P = new Pieces()
  const rand = seededRandom(9301)
  const decal = disc
  const nearSection = (x, z) => WRECK_SECTIONS.some((sec) => Math.hypot(x - sec.p[0], z - sec.p[2]) < 6.6)
  const scorch = (x, z, sx, sz, yaw) => P.add(tm.scorch(), decal, [x, GROUND_Y.paint + 0.008, z], [0, yaw, 0], [sx, 1, sz])
  // The scar: soot all along it, and pieces it shed either side.
  const skin = tm.wreckSkin()
  const bits = [tm.charred('#2e2824'), tm.paint('#5e5c58', 0.6, 0.3), tm.paint('#c8b880', 0.9), tm.paint('#2a4d7a', 0.55), tm.paint('#7a2a2a', 0.55)]
  for (let i = 0; i < WRECK_SCAR.length - 1; i++) {
    const [ax, az] = WRECK_SCAR[i]
    const [bx, bz] = WRECK_SCAR[i + 1]
    const len = Math.hypot(bx - ax, bz - az)
    const yaw = Math.atan2(bx - ax, bz - az)
    for (let d = 0; d < len; d += 2.6) {
      const f = d / len
      scorch(ax + (bx - ax) * f, az + (bz - az) * f, 4.2 + rand() * 2.4, 6 + rand() * 2, yaw + (rand() - 0.5) * 0.4)
    }
    for (let k = 0; k < 18; k++) {
      const f = rand()
      const off = (rand() - 0.5) * 10 * rand()
      const x = ax + (bx - ax) * f + Math.cos(yaw) * off
      const z = az + (bz - az) * f - Math.sin(yaw) * off
      const r = rand()
      if (nearSection(x, z)) continue
      if (r < 0.4) P.box(skin, x, 0.04, z, 0.5 + rand() * 1.2, 0.04, 0.4 + rand() * 0.9, 1, [(rand() - 0.5) * 0.3, rand() * Math.PI, (rand() - 0.5) * 0.3])
      else if (r < 0.6) {
        // A seat torn out, on its side.
        P.box(tm.charred('#2e2824'), x, 0.24, z, 0.5, 0.46, 0.5, 1, [0, rand() * Math.PI, 1.3])
      } else P.box(bits[Math.floor(rand() * bits.length)], x, 0.08, z, 0.2 + rand() * 0.4, 0.14, 0.3 + rand() * 0.3, 1, [rand() * 0.4, rand() * Math.PI, rand() * 0.4])
    }
  }
  // Shell craters: a burnt ring, the concrete thrown up round it in broken slabs, the hole black.
  const slab = tm.concrete('#7a7872')
  for (const [cx, cz, r] of CRATERS) {
    scorch(cx, cz, r * 3.2, r * 3.2, rand() * 3)
    P.add(tm.charred('#141210'), decal, [cx, GROUND_Y.paint + 0.012, cz], [0, 0, 0], [r * 1.2, 1, r * 1.2])
    const n = Math.round(r * 9)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand() * 0.3
      const d = r * (0.75 + rand() * 0.35)
      const s = 0.25 + rand() * 0.35
      P.box(slab, cx + Math.cos(a) * d, 0.06, cz + Math.sin(a) * d, s * 1.4, 0.12, s, 1, [Math.sin(a) * 0.35, -a, Math.cos(a) * 0.35])
    }
    for (let i = 0; i < 12; i++) {
      const a = rand() * Math.PI * 2
      const d = r * (1.1 + rand() * 1.6)
      const s = 0.06 + rand() * 0.14
      P.box(slab, cx + Math.cos(a) * d, s * 0.3, cz + Math.sin(a) * d, s * 1.3, s * 0.7, s, 1, [rand() * 0.5, rand() * 3, rand() * 0.5])
    }
  }
  return P.build()
}

export function WreckDebris() {
  const parts = useMemo(() => once('tm:wreck:debris', buildDebris), [])
  return <Merged parts={parts} />
}
