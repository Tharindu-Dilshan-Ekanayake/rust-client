import { useMemo } from 'react'
import { BufferGeometry, CircleGeometry, CylinderGeometry, Float32BufferAttribute, LatheGeometry, SphereGeometry, Vector2 } from 'three'

import {
  AIRSTAIR,
  BRIDGE_WINDOW,
  bridgeSlab,
  airstairOf,
  airstairParts,
  bridgeCabBoxes,
  bridgeFloorAt,
  bridgeSlopes,
  CABIN,
  cabinSeats,
  fuselageAt,
  JET_BRIDGE,
  PLANE,
  SLIDE,
  tailplaneAt,
  wingAt,
} from '../../../shared/mapTerminal.js'
import { rampBox } from '../../../shared/mapKit.js'
import { Merged } from '../acres/merge.jsx'
import { once, Pieces } from '../acres/pieces.js'
import { addBar } from '../quarter/kit.js'
import { addSignBox, loftGeometry, prismGeometry, ringAngles } from './kit.js'
import { tm } from './materials.js'
import { CABIN_WINDOWS, WINDOW_Y } from './textures.js'

/**
 * The jet at the gate, the jet bridge, the escape slide and the airstair
 * trucks, from their shared descriptions (shared/mapTerminal.js).
 *
 * The fuselage is one lofted skin (its livery a single texture round it, the
 * door holes cut where the colliders leave them open) and, inside, the
 * cabin's lining with its windows letting the day in, the seats, the bins,
 * the galleys and lavatories. The wings and tailplane are lofted airfoils, the
 * engines turned on a lathe; the gear, the lights, the fin with the airline's
 * mark.
 */

const P0 = PLANE
const LINING_R = 2.1
const quatOf = (q) => ({ isQuaternion: true, x: q[0], y: q[1], z: q[2], w: q[3] })

/** Door edges round the section: the angle range a side door cuts at radius `r`. */
function doorAngles(side, r) {
  const lo = Math.asin((P0.floor - P0.yc) / r)
  const hi = Math.asin((P0.doorTop - P0.yc) / r)
  if (side > 0) return [lo, hi]
  return [Math.PI - hi, Math.PI - lo]
}
/** The holes a door makes in a loft at radius `r`, in the loft's 0..2π angles. */
function doorHoles(r) {
  const out = []
  for (const d of P0.doors) {
    const [a0, a1] = doorAngles(d.side, r)
    if (a0 < 0) {
      out.push({ a0: a0 + Math.PI * 2, a1: Math.PI * 2, z0: d.z0, z1: d.z1 })
      out.push({ a0: 0, a1, z0: d.z0, z1: d.z1 })
    } else out.push({ a0, a1, z0: d.z0, z1: d.z1 })
  }
  return out
}
const doorBreaks = (r) => P0.doors.flatMap((d) => doorAngles(d.side, r))

/* ---------------------------------------------------------------------------
 * Fuselage
 * ------------------------------------------------------------------------- */

function fuselageStations() {
  const zs = new Set()
  // The nose, denser towards the tip.
  for (let i = 0; i <= 14; i++) zs.add(+(P0.nose + (P0.body0 - P0.nose) * (1 - Math.cos((i / 14) * (Math.PI / 2)))).toFixed(4))
  for (let z = P0.body0; z <= P0.body1 + 1e-6; z += 1.0) zs.add(+z.toFixed(4))
  for (const d of P0.doors) {
    zs.add(d.z0)
    zs.add(d.z1)
  }
  // The tail cone, denser towards its end.
  for (let i = 1; i <= 14; i++) zs.add(+(P0.body1 + (P0.tail - P0.body1) * Math.sin((i / 14) * (Math.PI / 2))).toFixed(4))
  return [...zs].sort((a, b) => a - b).map((z) => ({ z, ...fuselageAt(z) }))
}

function addFuselage(P) {
  const stations = fuselageStations()
  const angles = ringAngles(48, doorBreaks(P0.R))
  P.add(tm.livery(), loftGeometry(stations, angles, { holes: doorHoles(P0.R), uz0: P0.nose, uz1: P0.tail, x: P0.x }), [0, 0, 0])
  // The tip of the tail cone: a dark APU exhaust; the very nose: closed by the loft.
  const end = fuselageAt(P0.tail)
  P.add(tm.paint('#3a3c40', 0.5, 0.6), new CircleGeometry(end.r, 16), [P0.x, end.yc, P0.tail + 0.002], [0, 0, 0])
  // Lights: red beacons top and bottom.
  P.add(tm.glow('#ff3a2a'), new SphereGeometry(0.09, 8, 6), [P0.x, P0.yc + P0.R + 0.05, 6.0])
  P.add(tm.glow('#ff3a2a'), new SphereGeometry(0.09, 8, 6), [P0.x, P0.yc - P0.R - 0.05, 12.0])
  // Belly fairing between the wings (above head height).
  P.box(tm.paint('#c9ccd0', 0.4, 0.2), P0.x, 2.35, 6.0, 3.2, 0.6, 9.0, 1)
  // Door frames: the jambs between the skin and the lining round every open door.
  for (const d of P0.doors) addDoorJambs(P, d)
}

/** The faces of a doorway's thickness: its sides (a strip each), the head and the sill. */
function addDoorJambs(P, d) {
  const frame = tm.paint('#c9ccd0', 0.45, 0.4)
  const n = 8
  for (const [z, facing] of [
    [d.z0, 1],
    [d.z1, -1],
  ]) {
    const pos = []
    const idx = []
    for (let i = 0; i <= n; i++) {
      const y = P0.floor + ((P0.doorTop - P0.floor) * i) / n
      const dy = y - P0.yc
      const xi = Math.sqrt(LINING_R * LINING_R - dy * dy) * d.side
      const xo = Math.sqrt(P0.R * P0.R - dy * dy) * d.side
      pos.push(P0.x + xi, y, z, P0.x + xo, y, z)
    }
    for (let i = 0; i < n; i++) {
      const a = i * 2
      // Wound to face along `facing` (into the opening).
      if (facing * d.side > 0) idx.push(a, a + 1, a + 3, a, a + 3, a + 2)
      else idx.push(a, a + 3, a + 1, a, a + 2, a + 3)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pos, 3))
    g.setAttribute('normal', new Float32BufferAttribute(pos.map((_, k) => (k % 3 === 2 ? facing : 0)), 3))
    g.setAttribute('uv', new Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2))
    g.setIndex(idx)
    P.add(frame, g, [0, 0, 0])
  }
  // The head: a strip across the top between lining and skin.
  const dy = P0.doorTop - P0.yc
  const xi = Math.sqrt(LINING_R * LINING_R - dy * dy)
  const xo = Math.sqrt(P0.R * P0.R - dy * dy)
  P.box(frame, P0.x + (d.side * (xi + xo)) / 2, P0.doorTop + 0.01, (d.z0 + d.z1) / 2, xo - xi + 0.02, 0.02, d.z1 - d.z0, 1)
  // The sill: a steel plate over the floor's edge.
  const fy = P0.floor - P0.yc
  const fi = Math.sqrt(LINING_R * LINING_R - fy * fy)
  const fo = Math.sqrt(P0.R * P0.R - fy * fy)
  P.box(tm.brushed('#c0c4c8'), P0.x + (d.side * (fi + fo - 0.1)) / 2, P0.floor + 0.004, (d.z0 + d.z1) / 2, fo - fi + 0.12, 0.008, d.z1 - d.z0, 1)
}

/* ---------------------------------------------------------------------------
 * The cabin
 * ------------------------------------------------------------------------- */

function addCabin(P) {
  // The lining: the cabin's walls and ceiling, cut for the doors, not drawn under the floor.
  const stations = []
  for (let z = P0.bulkF; z <= P0.bulkR + 1e-6; z += 1.0) stations.push(z)
  for (const d of P0.doors) stations.push(d.z0, d.z1)
  const st = [...new Set(stations.map((z) => +z.toFixed(4)))].sort((a, b) => a - b).map((z) => ({ z, yc: P0.yc, r: LINING_R }))
  const below = Math.asin((P0.floor - 0.06 - P0.yc) / LINING_R)
  const holes = [...doorHoles(LINING_R), { a0: Math.PI - below, a1: Math.PI * 2 + below, z0: -99, z1: 99 }]
  const angles = ringAngles(40, [...doorBreaks(LINING_R), Math.PI - below, Math.PI * 2 + below])
  P.add(tm.lining(), loftGeometry(st, angles, { holes, inward: true, uScale: 1 / 1.06, vRepeat: 1, x: P0.x }), [0, 0, 0])

  // Floor: carpet down the cabin (narrow enough that its edges stay inside the skin).
  const w = 3.98
  P.box(tm.plaster('#9a9a96'), P0.x, P0.floor - 0.16, (P0.bulkF + P0.bulkR) / 2, w, 0.3, P0.bulkR - P0.bulkF, 2)
  P.box(tm.carpet('#6e7e9c'), P0.x, P0.floor - 0.005, (P0.bulkF + P0.bulkR) / 2, w - 0.04, 0.01, P0.bulkR - P0.bulkF - 0.02, 2)
  P.box(tm.carpet('#b0545c'), P0.x, P0.floor + 0.003, (P0.bulkF + P0.bulkR) / 2, 0.9, 0.006, P0.bulkR - P0.bulkF - 0.4, 2)
  // Bulkheads front and back (the cockpit door in the front one).
  for (const [z, facing] of [
    [P0.bulkF, 0],
    [P0.bulkR, Math.PI],
  ]) {
    P.add(tm.plaster('#e2e0da'), new CircleGeometry(LINING_R, 32), [P0.x, P0.yc, z + (facing ? -0.002 : 0.002)], [0, facing, 0])
  }
  P.box(tm.paint('#5a5e66', 0.5, 0.3), P0.x, P0.floor + 1.0, P0.bulkF + 0.03, 0.8, 2.0, 0.04, 1)
  P.box(tm.paint('#2a2c30', 0.4), P0.x + 0.28, P0.floor + 1.0, P0.bulkF + 0.06, 0.06, 0.16, 0.03, 1)

  // Windows: the day through them, just inside the lining.
  const pos = []
  const idx = []
  const r = LINING_R - 0.02
  for (const side of [-1, 1]) {
    const a0 = Math.asin((WINDOW_Y[0] + 0.03 - P0.yc) / r)
    const a1 = Math.asin((WINDOW_Y[1] - 0.03 - P0.yc) / r)
    for (const z of CABIN_WINDOWS) {
      if (z < P0.bulkF + 0.3 || z > P0.bulkR - 0.3) continue
      const k = pos.length / 3
      const pt = (a, zz) => [P0.x + side * Math.cos(a) * r, P0.yc + Math.sin(a) * r, zz]
      pos.push(...pt(a0, z - 0.1), ...pt(a0, z + 0.1), ...pt(a1, z + 0.1), ...pt(a1, z - 0.1))
      // Facing in, towards the aisle.
      if (side > 0) idx.push(k, k + 1, k + 2, k, k + 2, k + 3)
      else idx.push(k, k + 2, k + 1, k, k + 3, k + 2)
    }
  }
  const win = new BufferGeometry()
  win.setAttribute('position', new Float32BufferAttribute(pos, 3))
  win.setAttribute('normal', new Float32BufferAttribute(pos.map((v, k) => (k % 3 === 0 ? -Math.sign(v - P0.x) : 0)), 3))
  win.setAttribute('uv', new Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2))
  win.setIndex(idx)
  P.add(tm.glow('#dff0ff'), win, [0, 0, 0])

  // Overhead bins along both sides (none over the doors), light strips over them.
  const bin = prismGeometry(
    [
      [1.02, 5.05],
      [1.62, 5.05],
      [1.78, 5.22],
      [1.32, 5.78],
      [1.02, 5.78],
    ],
    1,
  )
  const runs = []
  let cursor = P0.bulkF + 3.0
  for (const d of [...P0.doors].sort((a, b) => a.z0 - b.z0)) {
    if (d.z0 - 0.3 > cursor + 0.5) runs.push([cursor, d.z0 - 0.3])
    cursor = Math.max(cursor, d.z1 + 0.3)
  }
  if (P0.bulkR - 1.4 > cursor + 0.5) runs.push([cursor, P0.bulkR - 1.4])
  for (const [z0, z1] of runs) {
    for (const side of [-1, 1]) {
      P.add(tm.plaster('#eceae4'), bin, [P0.x, 0, (z0 + z1) / 2], side > 0 ? [0, 0, 0] : [0, Math.PI, 0], [1, 1, z1 - z0])
      P.box(tm.glow('#fff4e0'), P0.x + side * 1.0, 5.86, (z0 + z1) / 2, 0.06, 0.02, z1 - z0, 1)
    }
  }
  // Seats.
  for (const [x0, x1, z0, z1, h, kind] of cabinSeats()) addSeatPair(P, x0, x1, z0, z1, h, kind)
  // Galleys, the trolley, the lavatories.
  for (const [x0, x1, z0, z1, h, kind] of CABIN.fittings) {
    const y = P0.floor
    if (kind === 'lav') {
      P.aabb(tm.plaster('#ecebe6'), x0, y, z0, x1, y + h, z1, 2)
      const fz = z0 - 0.004
      P.box(tm.paint('#c9ccd0', 0.4, 0.3), (x0 + x1) / 2, y + 1.0, fz, x1 - x0 - 0.3, 1.9, 0.01, 1)
      P.box(tm.glow('#4cd964'), (x0 + x1) / 2, y + 2.0, fz - 0.004, 0.18, 0.06, 0.006, 1)
    } else if (kind === 'trolley') {
      P.aabb(tm.brushed('#c8ccd0'), x0, y + 0.05, z0, x1, y + h, z1, 1)
    } else {
      P.aabb(tm.brushed('#c8ccd0'), x0, y, z0, x1, y + h, z1, 1)
      P.aabb(tm.brushed('#b0b4b8'), x0, y + h + 0.5, z0, x1, y + h + 1.1, z1 - 0.2, 1)
    }
  }
  // Green exit signs over the doors.
  for (const d of P0.doors) addSignBox(P, 'exit', [P0.x + d.side * 1.2, P0.doorTop + 0.2, (d.z0 + d.z1) / 2], 0.36, 0.18, d.side > 0 ? -Math.PI / 2 : Math.PI / 2, 1, 0)
}

/** Two seats side by side over a block's footprint; business ones bigger, in leather. */
function addSeatPair(P, x0, x1, z0, z1, h, kind) {
  const y = P0.floor
  const business = kind === 'business'
  // (Light enough to read in the dusk: the cabin's lit only by the day through the windows.)
  const cover = business ? tm.paint('#6e5e58', 0.55) : tm.fabric('#5f80b0')
  const frame = tm.paint('#7a7e86', 0.45, 0.5)
  const w = (x1 - x0) / 2
  const back = z1 - 0.1
  for (let i = 0; i < 2; i++) {
    const cx = x0 + w * (i + 0.5)
    const sw = w - (business ? 0.16 : 0.08)
    // Base and legs, the cushion, the back (tipped a little), the headrest's white cover.
    P.box(frame, cx, y + 0.2, (z0 + z1) / 2, sw - 0.1, 0.06, (z1 - z0) * 0.6, 1)
    P.box(cover, cx, y + 0.45, (z0 + back) / 2 + 0.02, sw, 0.14, back - z0 - 0.06, 1)
    P.box(cover, cx, y + h / 2 + 0.25, back, sw, h - 0.5 + 0.1, 0.12, 1, [0.1, 0, 0])
    P.box(tm.paint('#f2f2ee', 0.7), cx, y + h - 0.12, back - 0.06, sw * 0.8, 0.2, 0.02, 1, [0.1, 0, 0])
  }
  // Armrests at the ends and between.
  for (let i = 0; i <= 2; i++) {
    const x = x0 + w * i + (i === 0 ? 0.03 : i === 2 ? -0.03 : 0)
    P.box(frame, x, y + 0.66, (z0 + back) / 2, 0.05, 0.05, back - z0 - 0.1, 1)
  }
}

/* ---------------------------------------------------------------------------
 * Wings, tailplane, fin
 * ------------------------------------------------------------------------- */

const AIRFOIL = [1, 0.85, 0.65, 0.45, 0.3, 0.18, 0.09, 0.035, 0.008, 0]
/** Half thickness of the airfoil at chord fraction f (a NACA 4-digit shape, max 1/2 at f ≈ 0.3). */
const yt = (f) => 5 * (0.2969 * Math.sqrt(f) - 0.126 * f - 0.3516 * f * f + 0.2843 * f ** 3 - 0.1015 * f ** 4)

/** An airfoil section at a span station: points (z, y) round it, top surface first (TE -> LE -> TE). */
function section(le, te, top, thick) {
  const c = te - le
  const mid = top - thick / 2
  const pts = []
  for (const f of AIRFOIL) pts.push([le + c * f, mid + thick * yt(f)])
  for (const f of [...AIRFOIL].reverse().slice(1)) pts.push([le + c * f, mid - thick * yt(f) * 0.75])
  return pts
}

/** A symmetric section (the fin): points (z, offset) round it, `thick` through at its thickest. */
function sectionSym(le, te, thick) {
  const c = te - le
  const pts = []
  for (const f of AIRFOIL) pts.push([le + c * f, thick * yt(f)])
  for (const f of [...AIRFOIL].reverse().slice(1)) pts.push([le + c * f, -thick * yt(f)])
  return pts
}

/**
 * A lofted lifting surface along x (a wing or a tailplane) from its
 * sections, each [x, points]; a cap closes the far end. `side` +1/-1 keeps the
 * faces outward on both sides.
 */
function surfaceGeometry(sections, side) {
  const pos = []
  const idx = []
  const n = sections[0][1].length
  for (const [x, pts] of sections) for (const [z, y] of pts) pos.push(x, y, z)
  for (let s = 0; s < sections.length - 1; s++) {
    for (let k = 0; k < n - 1; k++) {
      const a = s * n + k
      const b = (s + 1) * n + k
      if (side > 0) idx.push(a, b, b + 1, a, b + 1, a + 1)
      else idx.push(a, b + 1, b, a, a + 1, b + 1)
    }
  }
  // The tip cap: a fan from the leading edge.
  const last = (sections.length - 1) * n
  const le = AIRFOIL.length - 1
  for (let k = 0; k < n - 1; k++) {
    if (k === le || k + 1 === le) continue
    if (side > 0) idx.push(last + le, last + k, last + k + 1)
    else idx.push(last + le, last + k + 1, last + k)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(pos.flatMap((_, i) => (i % 3 === 0 ? [pos[i] / 4, pos[i + 2] / 4] : [])), 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function addWings(P) {
  const skin = tm.paint('#d9dcdf', 0.4, 0.3)
  for (const side of [-1, 1]) {
    const sections = []
    for (let d = P0.wing.root; d <= P0.wing.tip + 1e-6; d += 1) {
      const m = wingAt(d)
      sections.push([P0.x + side * d, section(m.le, m.te, m.top, m.thick)])
    }
    P.add(skin, surfaceGeometry(sections, side), [0, 0, 0])
    // Winglet: a swept blade up from the tip.
    const tip = wingAt(P0.wing.tip)
    const base = [P0.x + side * (P0.wing.tip - 0.05), tip.top - 0.05, (tip.le + tip.te) / 2 + 0.3]
    const up = [P0.x + side * (P0.wing.tip + 0.25), tip.top + 2.1, tip.te + 0.6]
    addBar(P, skin, base, up, 0.1, 1.6)
    P.add(tm.glow(side < 0 ? '#ff3a2a' : '#3aff6a'), new SphereGeometry(0.08, 8, 6), [P0.x + side * (P0.wing.tip + 0.06), tip.top - 0.05, tip.le + 0.4])
    // Flap-track fairings under the trailing edge.
    for (const d of [5.5, 10.5, 15.0]) {
      const m = wingAt(d)
      P.box(tm.paint('#c9ccd0', 0.4, 0.3), P0.x + side * d, m.top - m.thick - 0.12, m.te - 0.6, 0.3, 0.3, 2.6, 1)
    }
    // A walkway on the wing's root behind the exit: dark lines on the top.
    const w0 = wingAt(2.6)
    for (const dz of [-0.8, 0.8]) P.box(tm.paint('#2a2c30', 0.6), P0.x + side * 4.2, w0.top + 0.012, 4.9 + dz, 3.4, 0.006, 0.05, 1)
    addEngine(P, side)
    addMainGear(P, side)
  }
  // Tailplane.
  for (const side of [-1, 1]) {
    const sections = []
    const t = P0.tailplane
    for (let d = t.root; d <= t.tip + 1e-6; d += (t.tip - t.root) / 8) {
      const m = tailplaneAt(d)
      sections.push([P0.x + side * d, section(m.le, m.te, m.y + m.thick / 2, m.thick)])
    }
    P.add(skin, surfaceGeometry(sections, side), [0, 0, 0])
  }
  addFin(P)
}

/** The fin: vertical airfoil sections up from the tail, the airline's mark on both faces. */
function addFin(P) {
  const f = P0.fin
  const rows = 8
  const n = AIRFOIL.length * 2 - 1
  const pos = []
  const uv = []
  const idx = []
  const zMin = f.root[0]
  const zMax = f.tipZ[1]
  for (let r = 0; r <= rows; r++) {
    const t = r / rows
    const y = f.y0 + (f.y1 - f.y0) * t
    const le = f.root[0] + (f.tipZ[0] - f.root[0]) * t
    const te = f.root[1] + (f.tipZ[1] - f.root[1]) * t
    const thick = f.thick * (1 - t * 0.5)
    const pts = sectionSym(le, te, thick)
    for (const [z, x] of pts) {
      pos.push(P0.x + x, y, z)
      uv.push((z - zMin) / (zMax - zMin), t)
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < n - 1; k++) {
      const a = r * n + k
      const b = (r + 1) * n + k
      idx.push(a, b + 1, b, a, a + 1, b + 1)
    }
  }
  const top = rows * n
  const le = AIRFOIL.length - 1
  for (let k = 0; k < n - 1; k++) {
    if (k === le || k + 1 === le) continue
    idx.push(top + le, top + k, top + k + 1)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  P.add(tm.fin(), g, [0, 0, 0])
}

function addEngine(P, side) {
  const e = P0.engine
  const x = P0.x + side * e.x
  const len = e.z1 - e.z0
  // The cowl, turned on a lathe round the engine's axis (the lathe's y is our z: tipped over).
  const cowl = [
    [e.r - 0.14, 0],
    [e.r - 0.02, 0.06],
    [e.r, 0.3],
    [e.r, len * 0.55],
    [e.r * 0.86, len],
  ].map(([r, h]) => new Vector2(r, h))
  const tip = [Math.PI / 2, 0, 0]
  P.add(tm.paint('#eef0f2', 0.35, 0.2), new LatheGeometry(cowl, 28), [x, e.y, e.z0], tip)
  // The intake's inside (turned the other way round so it faces inwards) and the fan.
  const duct = [
    [e.r - 0.14, 0.6],
    [e.r - 0.14, 0],
  ].map(([r, h]) => new Vector2(r, h))
  P.add(tm.paint('#3a3e46', 0.4, 0.6), new LatheGeometry(duct, 28), [x, e.y, e.z0], tip)
  P.add(tm.brushed('#c8ccd0'), new LatheGeometry([new Vector2(e.r - 0.14, 0), new Vector2(e.r - 0.02, 0.06)], 28), [x, e.y, e.z0 - 0.001], tip)
  P.add(tm.fan(), new CircleGeometry(e.r - 0.15, 28), [x, e.y, e.z0 + 0.6], [0, Math.PI, 0])
  // The core nozzle and the exhaust plug out the back.
  const core = [
    [e.r * 0.86 - 0.02, len],
    [0.62, len + 0.9],
    [0.5, len + 1.3],
  ].map(([r, h]) => new Vector2(r, h))
  P.add(tm.paint('#7a7e86', 0.45, 0.7), new LatheGeometry(core, 24), [x, e.y, e.z0], tip)
  const plug = [
    [0.45, len + 1.2],
    [0.3, len + 1.8],
    [0.02, len + 2.2],
  ].map(([r, h]) => new Vector2(r, h))
  P.add(tm.paint('#3a3c40', 0.5, 0.6), new LatheGeometry(plug, 20), [x, e.y, e.z0], tip)
  // The pylon up to the wing.
  const m = wingAt(e.x)
  addBar(P, tm.paint('#d9dcdf', 0.4, 0.3), [x, e.y + e.r - 0.1, e.z0 + 1.6], [x, m.top - m.thick + 0.05, m.le + 2.4], 0.34, 0.9)
}

function addMainGear(P, side) {
  const g = P0.mainGear
  const x = P0.x + side * g.x
  const steel = tm.paint('#9aa0a8', 0.4, 0.7)
  const m = wingAt(g.x)
  addBar(P, steel, [x, m.top - m.thick, g.z], [x, 0.75, g.z], 0.26, 0.26)
  addBar(P, steel, [x, 0.7, g.z - 0.9], [x, 0.7, g.z + 0.9], 0.2, 0.24)
  for (const dz of [-0.75, 0.75]) {
    for (const dx of [-0.38, 0.38]) {
      P.add(tm.rubber(), new CylinderGeometry(0.6, 0.6, 0.36, 18), [x + dx, 0.6, g.z + dz], [0, 0, Math.PI / 2])
      P.add(tm.paint('#c0c4c8', 0.4, 0.6), new CylinderGeometry(0.32, 0.32, 0.37, 12), [x + dx, 0.6, g.z + dz], [0, 0, Math.PI / 2])
    }
  }
  // The gear door folded down beside the leg.
  P.box(tm.paint('#d9dcdf', 0.4, 0.3), x + side * 0.4, 1.9, g.z, 0.04, 1.4, 1.6, 1)
}

function addNoseGear(P) {
  const z = P0.noseGear.z
  const steel = tm.paint('#9aa0a8', 0.4, 0.7)
  const f = fuselageAt(z)
  addBar(P, steel, [P0.x, f.yc - f.r + 0.1, z], [P0.x, 0.5, z], 0.2, 0.2)
  for (const dx of [-0.3, 0.3]) {
    P.add(tm.rubber(), new CylinderGeometry(0.48, 0.48, 0.3, 16), [P0.x + dx, 0.48, z], [0, 0, Math.PI / 2])
    P.add(tm.paint('#c0c4c8', 0.4, 0.6), new CylinderGeometry(0.24, 0.24, 0.31, 12), [P0.x + dx, 0.48, z], [0, 0, Math.PI / 2])
  }
  // Chocks and the tow bar's lug (it's parked).
  for (const dz of [-0.62, 0.62]) P.box(tm.paint('#e2b22a', 0.6), P0.x + 0.75, 0.1, z + dz, 0.3, 0.2, 0.25, 1)
}

function buildPlane() {
  const P = new Pieces()
  addFuselage(P)
  addCabin(P)
  addWings(P)
  addNoseGear(P)
  return P.build()
}

export function Plane() {
  const parts = useMemo(() => once('tm:plane', buildPlane), [])
  return <Merged parts={parts} />
}

/* ---------------------------------------------------------------------------
 * The jet bridge
 * ------------------------------------------------------------------------- */

function buildBridge() {
  const P = new Pieces()
  const J = JET_BRIDGE
  // Painted steel (bare metal would read black at dusk): the lower panels, and the sheet
  // above them, no glass (you can't see in or out but at the windows).
  const panel = tm.cladding('#b4b8bc')
  const steel = tm.cladding('#a2a6ac')
  const roof = tm.paint('#b9bcbf', 0.5, 0.3)
  for (const s of bridgeSlopes()) {
    const b = s.box
    const q = quatOf(b.q)
    if (s.kind === 'floor') {
      P.box(tm.paint('#8d9196', 0.5, 0.5), b.p[0], b.p[1], b.p[2], b.size[0], b.size[1], b.size[2], 2, q)
      // Carpet along the inside (a centimetre over the floor).
      const c = rampBox([(J.x0 + J.x1) / 2, J.y0 + 0.012, J.z0], [(J.x0 + J.x1) / 2, J.y1 + 0.012, J.z1], J.x1 - J.x0 - 2 * J.wall - 0.02, 0.012)
      P.box(tm.carpet('#6e7e9c'), c.p[0], c.p[1], c.p[2], c.size[0], c.size[1], c.size[2], 2, quatOf(c.q))
    } else if (s.kind === 'wall' || s.kind === 'metal') P.box(s.kind === 'wall' ? panel : steel, b.p[0], b.p[1], b.p[2], b.size[0], b.size[1], b.size[2], 2, q)
    else P.box(roof, b.p[0], b.p[1], b.p[2], b.size[0], b.size[1], b.size[2], 2, q)
  }
  // Frames round the two windows (their glass breaks: see GlassPanes).
  const W = BRIDGE_WINDOW
  const frame = tm.paint('#3a3f46', 0.45, 0.6)
  for (const x of [J.x0 + J.wall / 2, J.x1 - J.wall / 2]) {
    for (const [f0, f1, lift, thick] of [
      [W.f0, W.f1, W.y0 + 0.02, 0.06],
      [W.f0, W.f1, W.y1 + 0.04, 0.06],
      [W.f0 - 0.006, W.f0 + 0.004, W.y1 + 0.04, W.y1 - W.y0 + 0.1],
      [W.f1 - 0.004, W.f1 + 0.006, W.y1 + 0.04, W.y1 - W.y0 + 0.1],
    ]) {
      const r = bridgeSlab(x, f0, f1, lift, J.wall + 0.03, thick)
      P.box(frame, r.p[0], r.p[1], r.p[2], r.size[0], r.size[1], r.size[2], 1, quatOf(r.q))
    }
  }
  // Inside, the corridor's walls and ceiling lined in lit panels (its own lights are on), the
  // windows left clear.
  const lining = tm.lit('#aeb2b6')
  const line = (x, f0, f1, lift, w, thick) => {
    const r = bridgeSlab(x, f0, f1, lift, w, thick)
    P.box(lining, r.p[0], r.p[1], r.p[2], r.size[0], r.size[1], r.size[2], 2, quatOf(r.q))
  }
  for (const xi of [J.x0 + J.wall + 0.006, J.x1 - J.wall - 0.006]) {
    line(xi, 0, 1, J.sill, 0.012, J.sill - 0.012)
    line(xi, 0, W.f0, J.height, 0.012, J.height - J.sill)
    line(xi, W.f1, 1, J.height, 0.012, J.height - J.sill)
    line(xi, W.f0, W.f1, W.y0, 0.012, W.y0 - J.sill)
    line(xi, W.f0, W.f1, J.height, 0.012, J.height - W.y1)
  }
  line((J.x0 + J.x1) / 2, 0, 1, J.height - 0.004, J.x1 - J.x0 - 2 * J.wall - 0.03, 0.006)
  // Light strips down the corridor's ceiling (the last gone red: the emergency supply).
  for (let f = 0.06; f < 0.97; f += 0.12) {
    const r = bridgeSlab((J.x0 + J.x1) / 2, f, f + 0.06, J.height - 0.006, 0.22, 0.012)
    P.box(tm.glow(f > 0.7 ? '#ff2a14' : '#f4ead6'), r.p[0], r.p[1], r.p[2], r.size[0], r.size[1], r.size[2], 1, quatOf(r.q))
  }
  // Ribs round the corridor where its telescoping sections overlap, and posts between the panels.
  for (let z = J.z0 + 2.6; z < J.z1 - 0.4; z += 2.6) {
    const y = bridgeFloorAt(z)
    const mid = (J.x0 + J.x1) / 2
    P.box(tm.paint('#8d9196', 0.45, 0.5), mid, y + J.height + J.roofT + 0.05, z, J.x1 - J.x0 + 0.08, 0.1, 0.12, 1)
    for (const x of [J.x0 - 0.02, J.x1 + 0.02]) P.box(tm.paint('#8d9196', 0.45, 0.5), x, y + J.height / 2 - 0.02, z, 0.06, J.height + 0.3, 0.12, 1)
  }
  for (const [x0, x1, y0, y1, z0, z1, kind] of bridgeCabBoxes()) {
    const material = kind === 'bellows' ? tm.rubber() : kind === 'roof' ? roof : kind === 'floor' ? tm.paint('#8d9196', 0.5, 0.5) : tm.lit('#a8acb0')
    P.aabb(material, x0, y0, z0, x1, y1, z1, 2)
  }
  // The bellows' folds round the door, and a carpet in the cab.
  const c = J.cab
  P.aabb(tm.carpet('#6e7e9c'), c.x0 + 0.13, J.y1, c.z0 + 0.13, c.x1 - 0.14, J.y1 + 0.012, c.z1 - 0.13, 2)
  for (let k = 0; k < 4; k++) P.aabb(tm.rubber(), c.x1 - 0.02 - k * 0.04, J.y1 + J.height - 0.08, c.z0 + 0.13, c.x1 - k * 0.04, J.y1 + J.height + 0.05, c.z1 - 0.13, 1)
  // Supports: the rotunda's column with its drum on top, the drive column's legs, bogie and wheels.
  const [rx, rz] = J.rotunda
  const under = bridgeFloorAt(rz) - J.floorT
  P.add(tm.paint('#8d9196', 0.45, 0.5), new CylinderGeometry(0.45, 0.45, under, 16), [rx, under / 2, rz])
  P.add(tm.paint('#c9ccd0', 0.45, 0.5), new CylinderGeometry(1.1, 1.1, 0.5, 20), [rx, under - 0.25, rz])
  const legTop = bridgeFloorAt(J.drive) - J.floorT
  for (const x of [J.x0 + 0.3, J.x1 - 0.3]) P.box(tm.paint('#8d9196', 0.45, 0.5), x, (0.9 + legTop) / 2, J.drive, 0.35, legTop - 0.9, 0.35, 1)
  P.box(tm.paint('#e2b22a', 0.6), (J.x0 + J.x1) / 2, 0.55, J.drive, 3.2, 0.7, 1.2, 1)
  for (const x of [J.x0 + 0.5, J.x1 - 0.5]) P.add(tm.rubber(), new CylinderGeometry(0.42, 0.42, 0.4, 16), [x, 0.42, J.drive], [0, 0, Math.PI / 2])
  // Gate 3 on the corridor's side, seen from the apron.
  addSignBox(P, 'gate3', [J.x1 + 0.06, bridgeFloorAt(-15.0) + 1.9, -15.0], 1.8, 0.45, Math.PI / 2, 1, 0)
  return P.build()
}

export function JetBridge() {
  const parts = useMemo(() => once('tm:bridge', buildBridge), [])
  return <Merged parts={parts} />
}

/* ---------------------------------------------------------------------------
 * The escape slide
 * ------------------------------------------------------------------------- */

function buildSlide() {
  const P = new Pieces()
  const s = SLIDE
  const orange = tm.paint('#f28a1c', 0.6)
  const yellow = tm.paint('#f2c230', 0.7)
  const r = rampBox(s.top, s.bottom, s.width - 0.42, 0.12)
  P.box(yellow, r.p[0], r.p[1] - 0.06, r.p[2], r.size[0], r.size[1], r.size[2], 1, quatOf(r.q))
  for (const k of [-1, 1]) {
    const lift = (p) => [p[0], p[1] + 0.12, p[2] + k * (s.width / 2 - 0.2)]
    addBar(P, orange, lift(s.top), lift(s.bottom), 0.4, 0.4)
  }
  // The pillow at its foot, the girt tube across the top.
  P.add(orange, new CylinderGeometry(0.22, 0.22, s.width, 14), [s.bottom[0] + s.toe - 0.2, 0.22, s.bottom[2]], [Math.PI / 2, 0, 0])
  P.box(yellow, s.bottom[0] + s.toe / 2 - 0.15, 0.05, s.bottom[2], s.toe - 0.3, 0.1, s.width - 0.42, 1)
  P.add(orange, new CylinderGeometry(0.18, 0.18, s.width, 14), [s.top[0] + 0.25, s.top[1] + 0.1, s.top[2]], [Math.PI / 2, 0, 0])
  return P.build()
}

export function Slide() {
  const parts = useMemo(() => once('tm:slide', buildSlide), [])
  return <Merged parts={parts} />
}

/* ---------------------------------------------------------------------------
 * Airstair trucks
 * ------------------------------------------------------------------------- */

function buildAirstairs(id) {
  const P = new Pieces()
  const a = airstairOf(id)
  const A = AIRSTAIR
  const p = airstairParts(a)
  const yaw = Math.atan2(-p.dir[1], p.dir[0])
  const steel = tm.paint('#9aa0a8', 0.45, 0.6)
  const white = tm.paint('#eef0f2', 0.45, 0.2)
  const yellow = tm.paint('#f2c230', 0.6)
  const along = (d, side, y) => p.at(d, side, y)
  // The deck on top of the front of the truck.
  const pm = along(A.platform / 2, 0, a.top[1] - 0.2)
  P.box(tm.rib('#b0b4b8'), pm[0], pm[1], pm[2], A.platform, 0.4, A.width, 1, [0, yaw, 0])
  // The truck: its cab and body under the platform and the top of the stairs, wheels.
  const cm = along(A.platform - 1.4 + A.cab / 2, 0, A.cabTop / 2)
  P.box(white, cm[0], cm[1] + 0.2, cm[2], A.cab, A.cabTop - 0.4, A.width + 0.5, 1, [0, yaw, 0])
  const glassAt = along(A.platform - 1.4 + 0.02, 0, A.cabTop - 0.55)
  P.box(tm.paint('#20262e', 0.15, 0.5), glassAt[0], glassAt[1], glassAt[2], 0.04, 0.6, A.width + 0.3, 1, [0, yaw, 0])
  for (const d of [A.platform - 1.0, A.platform + 1.1]) {
    for (const k of [-1, 1]) {
      // Axles across the truck: the cylinder laid on its side, then turned with the truck.
      const w = along(d, k * (A.width / 2 + 0.18), 0.42)
      P.add(tm.rubber(), new CylinderGeometry(0.42, 0.42, 0.3, 14), w, [0, yaw + Math.PI / 2, Math.PI / 2])
    }
  }
  // Under the stairs: two beams from the cab back to the foot.
  for (const k of [-1, 1]) addBar(P, steel, along(A.platform + 0.6, k * 0.5, 1.2), along(A.platform + A.run - 0.3, k * 0.5, 0.2), 0.12, 0.2)
  // The stairs: treads up the slope between two stringers.
  const n = Math.round((a.top[1] - A.foot) / 0.2)
  for (let i = 0; i < n; i++) {
    const f = (i + 0.5) / n
    const t = along(A.platform + A.run * (1 - f), 0, A.foot + (a.top[1] - A.foot) * f)
    P.box(tm.rib('#b0b4b8'), t[0], t[1] - 0.02, t[2], A.run / n + 0.02, 0.04, A.width - 0.12, 1, [0, yaw, 0])
  }
  for (const k of [-1, 1]) addBar(P, steel, along(A.platform, k * (A.width / 2 - 0.04), a.top[1] - 0.1), along(A.platform + A.run, k * (A.width / 2 - 0.04), A.foot - 0.1), 0.06, 0.26)
  // Handrails (yellow) up both sides and round the platform.
  for (const [u, v] of p.rails) {
    addBar(P, yellow, [u[0], u[1] + 1.0, u[2]], [v[0], v[1] + 1.0, v[2]], 0.05, 0.05)
    for (let f = 0; f <= 1.001; f += 0.25) {
      const q = [u[0] + (v[0] - u[0]) * f, u[1] + (v[1] - u[1]) * f, u[2] + (v[2] - u[2]) * f]
      P.box(yellow, q[0], q[1] + 0.5, q[2], 0.04, 1.0, 0.04, 1)
    }
  }
  for (const [u, v] of p.flat) {
    addBar(P, yellow, [u[0], u[1] + 1.0, u[2]], [v[0], v[1] + 1.0, v[2]], 0.05, 0.05)
    addBar(P, yellow, [u[0], u[1] + 0.5, u[2]], [v[0], v[1] + 0.5, v[2]], 0.04, 0.04)
    for (const q of [u, v]) P.box(yellow, q[0], q[1] + 0.5, q[2], 0.04, 1.0, 0.04, 1)
  }
  return P.build()
}

export function Airstairs({ id }) {
  const parts = useMemo(() => once(`tm:airstairs:${id}`, () => buildAirstairs(id)), [id])
  return <Merged parts={parts} />
}

export default Plane
