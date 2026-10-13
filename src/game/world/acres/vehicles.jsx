import { useMemo } from 'react'
import { CircleGeometry, CylinderGeometry, ExtrudeGeometry, PlaneGeometry, Quaternion, Shape } from 'three'

import { BUS, busSeats, CAR_MODELS, SEMI, SEMI_CARGO } from '../../../shared/mapAcres.js'
import { rampBox } from '../../../shared/mapKit.js'
import { boxGeo } from '../materials.js'
import { acres, CAR_COLORS, signs } from './materials.js'
import { Merged } from './merge.jsx'
import { once, Pieces } from './pieces.js'

/**
 * The vehicles: built in their own frame (front toward -z, right toward +x) to
 * the same measurements as their colliders in shared/mapAcres.js, then merged.
 */

const wheelGeo = (r, w) => new CylinderGeometry(r, r, w, 14).rotateZ(Math.PI / 2)
const discGeo = (r) => new CircleGeometry(r, 14)

/** A tyre with a hub (and a whitewall ring for the cars). */
function wheel(P, x, y, z, r, w, { whitewall = false, hub = 'chrome', flat = false } = {}) {
  const yy = flat ? y - r * 0.18 : y
  P.add(acres.rubber(), wheelGeo(r, w), [x, yy, z])
  const s = Math.sign(x) || 1
  if (whitewall) P.add(acres.whitewall(), discGeo(r * 0.78), [x + s * (w / 2 + 0.002), yy, z], [0, (s * Math.PI) / 2, 0])
  P.add(hub === 'chrome' ? acres.chrome() : acres.paint(hub, 0.6, 0.2), discGeo(r * 0.5), [x + s * (w / 2 + 0.004), yy, z], [0, (s * Math.PI) / 2, 0])
}

/* ---------------------------------------------------------------------------
 * School bus
 * ------------------------------------------------------------------------- */

function buildBus() {
  const P = new Pieces()
  const { length: L, width: W, floor: F, door: [d0, d1], rear: [r0, r1] } = BUS
  const half = L / 2
  const yellow = acres.carPaint('#f1b11c')
  const black = acres.paint('#151515', 0.6)
  const white = acres.carPaint('#f2efe4')
  const winBot = 1.25
  const winTop = 2.2
  const roof = 2.55
  const t = 0.08
  const sx = W / 2 - t / 2
  // Underbody, wheels, floor.
  P.box(acres.steelDark(), 0, 0.14, 0, W - 0.3, 0.2, L - 0.6, 1)
  for (const z of [-half + 1.4, half - 2.3]) for (const s of [-1, 1]) wheel(P, s * (W / 2 - 0.16), 0.5, z, 0.5, 0.3, { hub: '#e5e2da' })
  P.box(acres.rubber(), 0, F - 0.1, 0, W - 0.04, 0.2, L - 0.04, 1)
  // Sides: lower panel from the skirt up, posts between windows, band above.
  const posts = []
  for (let z = -half + 0.9; z <= half - 0.5; z += 1.05) posts.push(z)
  for (const s of [-1, 1]) {
    const x = s * sx
    const doorSide = s > 0
    const lower = doorSide ? [[-half, d0], [d1, half]] : [[-half, half]]
    for (const [a, b] of lower) {
      P.box(yellow, x, (0.22 + winBot) / 2, (a + b) / 2, t, winBot - 0.22, b - a, 1)
      P.box(black, x + s * 0.045, 0.62, (a + b) / 2, 0.02, 0.06, b - a, 1)
      P.box(black, x + s * 0.045, 1.0, (a + b) / 2, 0.02, 0.06, b - a, 1)
    }
    for (const z of posts) if (!doorSide || z < d0 - 0.1 || z > d1 + 0.1) P.box(yellow, x, (winBot + winTop) / 2, z, t, winTop - winBot, 0.12, 1)
    const upper = doorSide ? [[-half, d0], [d1, half]] : [[-half, half]]
    for (const [a, b] of upper) P.box(yellow, x, (winTop + roof) / 2, (a + b) / 2, t, roof - winTop, b - a, 1)
    if (doorSide) P.box(yellow, x, (2.35 + roof) / 2, (d0 + d1) / 2, t, roof - 2.35, d1 - d0, 1)
    // Window sashes half down, and the black seals above and below the glass line.
    for (let i = 0; i < posts.length - 1; i++) {
      const a = posts[i]
      const b = posts[i + 1]
      if (doorSide && b > d0 - 0.2 && a < d1 + 0.2) continue
      // Dropped sashes: the windows are open (bullets go through them).
      P.box(acres.chrome(), x, 1.29, (a + b) / 2, 0.03, 0.05, b - a - 0.12, 1)
      P.box(acres.chrome(), x, 2.15, (a + b) / 2, 0.03, 0.04, b - a - 0.12, 1)
    }
    P.box(black, x + s * 0.045, winBot + 0.02, 0, 0.02, 0.05, L, 1)
    P.box(black, x + s * 0.045, winTop - 0.02, 0, 0.02, 0.05, L, 1)
    // District name under the windows.
    P.add(signs.busSide(), new PlaneGeometry(5.6, 0.36), [x + s * 0.05, 1.12, 0.6], [0, (s * Math.PI) / 2, 0])
  }
  // Roof: a white crown.
  P.add(white, new CylinderGeometry(W / 2, W / 2, L, 24, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2), [0, roof, 0], null, [1, 0.24, 1])
  P.box(white, 0, roof + 0.02, 0, W, 0.06, L, 1)
  P.box(white, 0, roof + 0.3, 1.6, 0.8, 0.06, 0.8, 1)
  // Front: dash, windscreen frame, header with the sign and warning lights.
  P.box(yellow, 0, (F + winBot + 0.1) / 2, -half + t / 2, W, winBot + 0.1 - F, t, 1)
  P.box(acres.glass(), 0, (winBot + 0.1 + winTop) / 2, -half + 0.02, W - 0.3, winTop - winBot - 0.1, 0.02, 1)
  P.box(black, 0, (winBot + winTop) / 2 + 0.05, -half - 0.01, 0.06, winTop - winBot - 0.1, 0.04, 1)
  P.box(yellow, 0, (winTop + roof) / 2, -half + t / 2, W, roof - winTop, t, 1)
  P.add(signs.busFront(), new PlaneGeometry(1.4, 0.26), [0, (winTop + roof) / 2, -half - 0.01], [0, Math.PI, 0])
  for (const s of [-1, 1]) {
    P.box(acres.paint('#d13a2a', 0.4), s * 0.95, roof - 0.12, -half - 0.03, 0.16, 0.16, 0.06, 1)
    P.box(acres.paint('#f0a23a', 0.4), s * 0.72, roof - 0.12, -half - 0.03, 0.16, 0.16, 0.06, 1)
  }
  // Engine hood out front, grille, headlights, bumper, mirrors.
  P.box(yellow, 0, 0.78, -half - 0.55, W - 0.25, 0.95, 1.1, 1)
  P.box(yellow, 0, 1.22, -half - 0.6, W - 0.6, 0.12, 0.95, 1)
  P.box(acres.chrome(), 0, 0.82, -half - 1.11, 0.9, 0.62, 0.03, 1)
  for (let i = -3; i <= 3; i++) P.box(black, i * 0.12, 0.82, -half - 1.12, 0.04, 0.56, 0.02, 1)
  for (const s of [-1, 1]) {
    P.add(acres.lampGlass(), discGeo(0.11), [s * 0.82, 0.92, -half - 1.11], [0, Math.PI, 0])
    P.box(black, s * 1.15, 0.65, -half - 0.6, 0.12, 0.5, 1.15, 1)
    P.box(acres.chrome(), s * 1.35, 1.9, -half + 0.2, 0.03, 0.6, 0.03, 1)
    P.box(black, s * 1.42, 1.65, -half + 0.2, 0.06, 0.3, 0.18, 1)
  }
  P.box(black, 0, 0.36, -half - 1.18, W + 0.1, 0.22, 0.16, 1)
  // Stop arm folded against the driver's side.
  P.box(acres.paint('#c42a20', 0.5), -W / 2 - 0.05, 1.5, -half + 1.6, 0.03, 0.45, 0.45, 1)
  // Folding door, open.
  for (const k of [0, 1]) P.box(acres.glass(), W / 2 - 0.2 - k * 0.06, (F + 2.3) / 2, d0 + 0.05 + k * 0.05, 0.03, 2.25 - F, 0.04, 1)
  // Rear: wall round the open emergency door, the door swung out, sign, lights, bumper.
  P.box(yellow, (-W / 2 + r0) / 2, (0.22 + roof) / 2, half - t / 2, r0 + W / 2, roof - 0.22, t, 1)
  P.box(yellow, (r1 + W / 2) / 2, (0.22 + roof) / 2, half - t / 2, W / 2 - r1, roof - 0.22, t, 1)
  P.box(yellow, (r0 + r1) / 2, (2.35 + roof) / 2, half - t / 2, r1 - r0, roof - 2.35, t, 1)
  P.box(yellow, (r0 + r1) / 2, (0.22 + F) / 2, half - t / 2, r1 - r0, F - 0.22, t, 1)
  P.box(yellow, r1 + 0.03, (F + 2.33) / 2, half + 0.5, 0.05, 2.33 - F, 0.95, 1)
  P.box(acres.glass(), r1 + 0.06, 1.85, half + 0.5, 0.01, 0.6, 0.7, 1)
  P.add(signs.busFront(), new PlaneGeometry(1.2, 0.22), [0, 2.38, half + 0.01])
  for (const s of [-1, 1]) {
    P.add(acres.paint('#c42a20', 0.35), discGeo(0.09), [s * 0.95, 1.0, half + 0.01])
    P.add(acres.paint('#f0a23a', 0.35), discGeo(0.07), [s * 0.95, 0.75, half + 0.01])
  }
  P.box(black, 0, 0.34, half + 0.08, W + 0.1, 0.22, 0.16, 1)
  // Inside: green vinyl seats, the driver's seat and wheel.
  const vinyl = acres.paint('#2f5a3a', 0.5)
  for (const [x, z] of busSeats()) {
    P.box(vinyl, x, F + 0.45, z, 0.7, 0.14, 0.42, 1)
    P.box(vinyl, x, F + 0.72, z + 0.2, 0.7, 0.6, 0.08, 1)
    P.box(acres.steelDark(), x, F + 0.2, z, 0.6, 0.38, 0.06, 1)
  }
  P.box(vinyl, -0.6, F + 0.5, -half + 1.25, 0.55, 0.12, 0.5, 1)
  P.box(vinyl, -0.6, F + 0.8, -half + 1.5, 0.55, 0.6, 0.08, 1)
  P.add(black, new CylinderGeometry(0.22, 0.22, 0.04, 16), [-0.6, F + 0.95, -half + 0.75], [0.9, 0, 0])
  return P.build()
}

export function SchoolBus({ p, rotY }) {
  const parts = useMemo(() => once('bus', buildBus), [])
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      <Merged parts={parts} />
    </group>
  )
}

/* ---------------------------------------------------------------------------
 * Semi truck: red cab, moving trailer with its side open and a ramp down
 * ------------------------------------------------------------------------- */

function buildSemi() {
  const P = new Pieces()
  const { length: L, width: W, floor: F, top } = SEMI.trailer
  const half = L / 2
  const [o0, o1] = SEMI.opening
  const t = 0.06
  const sx = W / 2 - t / 2
  const body = acres.siding('white')
  const red = acres.carPaint('#b3262b')
  const stripe = acres.paint('#b7322b', 0.5)
  const chrome = acres.chrome()
  const dark = acres.steelDark()
  // Trailer chassis, landing legs, rear bogie.
  P.box(dark, 0, 0.8, 0, W - 0.7, 0.28, L - 0.4, 1)
  P.box(dark, 0, 1.0, 0, W - 0.05, 0.1, L, 1)
  for (const s of [-1, 1]) P.box(dark, s * 0.7, 0.45, -half + 2.2, 0.12, 0.9, 0.12, 1)
  for (const z of [half - 1.6, half - 0.6]) for (const s of [-1, 1]) wheel(P, s * (W / 2 - 0.3), 0.5, z, 0.5, 0.5, { hub: '#d9d6cf' })
  P.box(dark, 0, 0.55, half - 0.3, W, 0.28, 0.12, 1)
  // Floor, walls, roof.
  P.box(acres.wood('#a98a63'), 0, F - 0.1, 0, W - 0.02, 0.2, L - 0.02, 1)
  P.box(body, sx, (F + top) / 2, 0, t, top - F + 0.1, L, 1.6)
  P.box(body, 0, (F + top) / 2, -half + t / 2, W - 2 * t, top - F + 0.1, t, 1.6)
  P.box(body, 0, (F + top) / 2, half - t / 2, W - 2 * t, top - F + 0.1, t, 1.6)
  P.box(body, -sx, (F + top) / 2, (-half + o0) / 2, t, top - F + 0.1, o0 + half, 1.6)
  P.box(body, -sx, (F + top) / 2, (o1 + half) / 2, t, top - F + 0.1, half - o1, 1.6)
  P.box(body, -sx, (3.3 + top) / 2, (o0 + o1) / 2, t, top - 3.3, o1 - o0, 1.6)
  P.box(acres.paint('#d8d5cc', 0.5), 0, top + 0.06, 0, W + 0.02, 0.12, L + 0.02, 1)
  // Red stripe low down, and the company name on both sides.
  for (const s of [-1, 1]) {
    const x = s * (W / 2 + 0.005)
    if (s > 0) P.box(stripe, x, F + 0.2, 0, 0.01, 0.16, L, 1)
    else for (const [a, b] of [[-half, o0], [o1, half]]) P.box(stripe, x, F + 0.2, (a + b) / 2, 0.01, 0.16, b - a, 1)
    const at = s > 0 ? 0 : (o1 + half) / 2
    const w = s > 0 ? 6.4 : 3.3
    P.add(signs.trailerLogo(), new PlaneGeometry(w, w / 4), [x + s * 0.01, 2.35, at], [0, (s * Math.PI) / 2, 0])
  }
  // The roll-up side door, rolled up; rear doors shut with their lock bars.
  P.box(acres.paint('#e6e2d8', 0.6), -sx + 0.2, 3.15, (o0 + o1) / 2, 0.3, 0.3, o1 - o0, 1)
  for (const s of [-1, 1]) {
    P.box(body, s * 0.62, (F + top) / 2, half + 0.02, 1.2, top - F - 0.1, 0.03, 1.6)
    P.box(chrome, s * 0.3, (F + top) / 2, half + 0.06, 0.04, top - F - 0.2, 0.04, 1)
    P.box(chrome, s * 0.9, (F + top) / 2, half + 0.06, 0.04, top - F - 0.2, 0.04, 1)
  }
  for (const s of [-1, 1]) P.add(acres.paint('#c42a20', 0.35), discGeo(0.08), [s * 1.05, 0.85, half + 0.07])
  // Ramp from the side opening to the street: diamond-plate aluminium.
  const { z, out, width } = SEMI.ramp
  const ramp = rampBox([-W / 2 + 0.05, F, z], [-W / 2 - out, 0.02, z], width, 0.12)
  P.add(acres.steel(), boxGeo(ramp.size[0], ramp.size[1], ramp.size[2], 0.6), ramp.p, new Quaternion(...ramp.q))
  // What's packed inside.
  const cardboard = acres.cardboard()
  SEMI_CARGO.forEach(([x, cz, w, h, d], i) => {
    const y = F + h / 2
    if (i === 1) P.box(acres.paint('#eef0ea', 0.3), x, y, cz, w, h, d, 1)
    else if (i === 2) {
      P.box(acres.fabric('#c77a4a'), x, F + 0.22, cz, w, 0.44, d, 1)
      P.box(acres.fabric('#c77a4a'), x + w / 2 - 0.12, F + 0.55, cz, 0.24, 0.6, d, 1)
    } else {
      // A stack of boxes, slightly out of line.
      const n = Math.max(1, Math.round(h / 0.5))
      for (let k = 0; k < n; k++) P.box(cardboard, x + ((k % 2) - 0.5) * 0.04, F + (k + 0.5) * (h / n), cz, w * (1 - k * 0.04), h / n - 0.01, d * (1 - k * 0.03), 0.7)
    }
  })
  // Tractor: chassis and fifth wheel, fuel tanks, the cab and hood.
  const cz0 = -half - 2.45
  P.box(dark, 0, 0.52, -half - 2.6, 1.0, 0.3, 4.6, 1)
  P.box(dark, 0, 0.8, -half - 0.9, 1.6, 0.12, 1.2, 1)
  for (const s of [-1, 1]) P.add(chrome, new CylinderGeometry(0.3, 0.3, 1.2, 16).rotateX(Math.PI / 2), [s * 0.95, 0.75, -half - 1.7])
  for (const zz of [-half - 1.2, -half - 0.3]) for (const s of [-1, 1]) wheel(P, s * (W / 2 - 0.35), 0.52, zz, 0.52, 0.45, { hub: '#d9d6cf' })
  for (const s of [-1, 1]) wheel(P, s * 0.98, 0.52, -half - 4.2, 0.52, 0.32, { hub: '#d9d6cf' })
  P.box(red, 0, 1.88, cz0, 2.4, 2.25, 2.1, 1)
  P.box(red, 0, 1.36, -half - 4.35, 2.1, 1.2, 1.7, 1)
  P.box(red, 0, 1.98, -half - 4.4, 1.9, 0.08, 1.5, 1)
  // Windows: windscreen and side glass, door seams.
  P.box(acres.glass(), 0, 2.45, cz0 - 1.06, 2.1, 0.75, 0.02, 1)
  for (const s of [-1, 1]) {
    P.box(acres.glass(), s * 1.205, 2.45, cz0 - 0.3, 0.02, 0.62, 1.1, 1)
    P.box(acres.paint('#2a0e0e', 0.6), s * 1.205, 1.7, cz0 + 0.3, 0.015, 1.4, 0.02, 1)
    P.box(chrome, s * 1.21, 1.55, cz0 - 0.1, 0.02, 0.04, 0.2, 1)
    // Exhaust stacks behind the cab, mirror on a frame.
    P.add(chrome, new CylinderGeometry(0.09, 0.09, 2.9, 12), [s * 1.08, 2.05, cz0 + 1.2])
    P.box(chrome, s * 1.45, 2.4, cz0 - 0.95, 0.04, 0.6, 0.04, 1)
    P.box(dark, s * 1.48, 2.5, cz0 - 0.95, 0.08, 0.36, 0.18, 1)
    // Fenders over the steer wheels.
    P.box(dark, s * 1.0, 1.1, -half - 4.2, 0.4, 0.08, 1.2, 1)
  }
  // Chrome grille, headlights, bumper.
  P.box(chrome, 0, 1.3, -half - 5.21, 1.3, 1.0, 0.03, 1)
  for (let i = -5; i <= 5; i++) P.box(dark, i * 0.11, 1.3, -half - 5.23, 0.03, 0.9, 0.02, 1)
  for (const s of [-1, 1]) P.add(acres.lampGlass(), discGeo(0.14), [s * 0.85, 1.3, -half - 5.21], [0, Math.PI, 0])
  P.box(chrome, 0, 0.62, -half - 5.25, 2.3, 0.26, 0.18, 1)
  return P.build()
}

export function Semi({ p, rotY }) {
  const parts = useMemo(() => once('semi', buildSemi), [])
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      <Merged parts={parts} />
    </group>
  )
}

/* ---------------------------------------------------------------------------
 * Army jeep
 * ------------------------------------------------------------------------- */

function buildJeep() {
  const P = new Pieces()
  const olive = acres.carPaint('#56603b')
  const dark = acres.steelDark()
  for (const z of [-1.2, 1.15]) for (const s of [-1, 1]) wheel(P, s * 0.78, 0.38, z, 0.38, 0.26, { hub: '#56603b' })
  P.box(dark, 0, 0.45, 0, 1.2, 0.18, 3.4, 1)
  // Tub, hood, grille, fenders.
  P.box(olive, 0, 0.78, 0.55, 1.62, 0.62, 2.35, 1)
  P.box(olive, 0, 0.84, -1.2, 1.42, 0.42, 1.3, 1)
  P.box(dark, 0, 0.78, -1.86, 1.1, 0.5, 0.05, 1)
  for (let i = -4; i <= 4; i++) P.box(acres.paint('#2a2d22', 0.7), i * 0.11, 0.8, -1.89, 0.04, 0.4, 0.02, 1)
  for (const s of [-1, 1]) {
    P.add(acres.lampGlass(), discGeo(0.09), [s * 0.52, 0.92, -1.89], [0, Math.PI, 0])
    P.box(olive, s * 0.8, 0.88, -1.2, 0.26, 0.06, 1.0, 1)
    P.box(olive, s * 0.8, 0.88, 1.15, 0.26, 0.06, 0.9, 1)
  }
  P.add(signs.star(), new PlaneGeometry(0.62, 0.62), [0, 1.056, -1.2], [-Math.PI / 2, 0, 0])
  // Windscreen frame up, seats, roll bar, spare tyre and a jerry can.
  P.box(olive, 0, 1.3, -0.55, 1.5, 0.06, 0.06, 1)
  P.box(olive, 0, 1.06, -0.55, 1.5, 0.06, 0.06, 1)
  for (const s of [-1, 1]) P.box(olive, s * 0.72, 1.18, -0.55, 0.06, 0.3, 0.06, 1)
  P.box(acres.glass(), 0, 1.18, -0.55, 1.36, 0.2, 0.02, 1)
  const seat = acres.paint('#3b3a2a', 0.8)
  for (const s of [-1, 1]) {
    P.box(seat, s * 0.38, 1.12, 0.15, 0.48, 0.12, 0.5, 1)
    P.box(seat, s * 0.38, 1.38, 0.4, 0.48, 0.48, 0.1, 1)
  }
  P.box(seat, 0, 1.12, 1.2, 1.2, 0.12, 0.5, 1)
  for (const s of [-1, 1]) P.box(dark, s * 0.74, 1.5, 0.8, 0.05, 0.85, 0.05, 1)
  P.box(dark, 0, 1.92, 0.8, 1.5, 0.05, 0.05, 1)
  P.add(acres.rubber(), new CylinderGeometry(0.36, 0.36, 0.22, 18).rotateX(Math.PI / 2), [0, 0.95, 1.86])
  P.box(olive, 0.55, 0.95, 1.8, 0.18, 0.4, 0.3, 1)
  return P.build()
}

export function Jeep({ p, rotY }) {
  const parts = useMemo(() => once('jeep', buildJeep), [])
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      <Merged parts={parts} />
    </group>
  )
}

/* ---------------------------------------------------------------------------
 * 1950s cars: a side profile extruded across the width, a glasshouse on top
 * ------------------------------------------------------------------------- */

/** Side profile in (z, y), extruded along x and centred. */
function profile(points, width) {
  const s = new Shape()
  points.forEach(([z, y], i) => (i ? s.lineTo(z, y) : s.moveTo(z, y)))
  s.closePath()
  const g = new ExtrudeGeometry(s, { depth: width, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 1 })
  g.translate(0, 0, -width / 2)
  g.rotateY(-Math.PI / 2)
  const uv = g.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2, uv.getY(i) / 2)
  return g
}

function buildCar(model, color, wreck) {
  const m = CAR_MODELS[model]
  const P = new Pieces()
  const L = m.length
  const h = L / 2
  const [y0, y1] = m.body
  const [c0, c1] = m.cabin
  const paint = wreck ? acres.rust() : acres.carPaint(CAR_COLORS[color] ?? color)
  const chrome = wreck ? acres.steelDark() : acres.chrome()
  // Lower body, with fins on the coupe.
  const body = [
    [-h, y0 + 0.06], [-h, y1 - 0.2], [-h + 0.3, y1 - 0.02], [c0, y1], [h - 0.4, y1 + (model === 'coupe' ? 0.14 : 0)],
    [h - 0.05, y1 - (model === 'coupe' ? 0.0 : 0.08)], [h, y1 - 0.22], [h, y0 + 0.06],
  ]
  P.add(paint, profile(body, m.w - 0.1), [0, 0, 0])
  // Wheel arches darkened, wheels.
  const wz = [-h + 0.95, h - 1.0]
  for (const z of wz) {
    for (const s of [-1, 1]) {
      wheel(P, s * (m.w / 2 - 0.2), 0.36, z, 0.36, 0.22, { whitewall: !wreck, hub: wreck ? '#3a3632' : 'chrome', flat: wreck })
      P.box(acres.paint('#141414', 0.9), s * (m.w / 2 + 0.006), 0.62, z, 0.01, 0.3, 0.86, 1)
    }
  }
  if (m.bed) {
    // Pickup: cab glasshouse, the bed's sides and tailgate.
    P.box(paint, 0, y1 + 0.18, (c1 + h) / 2 + 0.05, m.w - 0.1, 0.06, h - c1 - 0.1, 1)
    for (const s of [-1, 1]) P.box(paint, s * (m.w / 2 - 0.08), y1 + 0.12, (c1 + h) / 2 + 0.05, 0.06, 0.24, h - c1 - 0.1, 1)
  }
  // Glasshouse: windows all round under a painted roof, pillars at the corners.
  const rake = model === 'wagon' ? 0.45 : 0.5
  const back = model === 'wagon' || m.bed ? 0.06 : 0.42
  if (m.van) {
    // A van: windscreen and cab windows up front, a panelled box behind.
    const cabEnd = c0 + 1.25
    if (!wreck) P.add(acres.glass(), profile([[c0, y1], [c0 + rake, m.cabinTop - 0.05], [cabEnd, m.cabinTop - 0.05], [cabEnd, y1]], m.cabinW - 0.12), [0, 0, 0])
    P.box(paint, 0, (y1 + m.cabinTop) / 2, (cabEnd + c1) / 2, m.cabinW, m.cabinTop - y1, c1 - cabEnd, 1)
    P.box(paint, 0, m.cabinTop - 0.02, (c0 + rake + c1) / 2, m.cabinW, 0.07, c1 - c0 - rake + 0.04, 1)
    for (const s of [-1, 1]) P.box(acres.paint('#2a2a2a', 0.6), s * (m.cabinW / 2 + 0.006), (y1 + m.cabinTop) / 2, cabEnd + 0.9, 0.01, m.cabinTop - y1 - 0.2, 0.02, 1)
  } else {
    const glass = [[c0, y1], [c0 + rake, m.cabinTop - 0.05], [c1 - back, m.cabinTop - 0.05], [c1, y1]]
    if (!wreck) P.add(acres.glass(), profile(glass, m.cabinW - 0.12), [0, 0, 0])
    P.box(paint, 0, m.cabinTop - 0.02, (c0 + rake + c1 - back) / 2, m.cabinW, 0.07, c1 - back - c0 - rake + 0.08, 1)
  }
  for (const s of [-1, 1]) {
    const x = s * (m.cabinW / 2 - 0.03)
    const pillar = (za, zb) => {
      const len = Math.hypot(zb[0] - za[0], zb[1] - za[1])
      const ang = Math.atan2(zb[0] - za[0], zb[1] - za[1])
      P.box(paint, x, (za[1] + zb[1]) / 2, (za[0] + zb[0]) / 2, 0.07, len, 0.08, 1, [ang, 0, 0])
    }
    pillar([c0, y1], [c0 + rake, m.cabinTop - 0.05])
    if (!m.van) {
      pillar([c1, y1], [c1 - back, m.cabinTop - 0.05])
      if (c1 - c0 > 2) pillar([(c0 + c1) / 2, y1], [(c0 + c1) / 2, m.cabinTop - 0.05])
    }
    // Chrome side spear.
    P.box(chrome, s * (m.w / 2 + 0.008), y1 - 0.2, 0, 0.012, 0.04, L - 1.2, 1)
  }
  // Bumpers, grille, lights.
  P.box(chrome, 0, y0 + 0.14, -h - 0.06, m.w + 0.06, 0.16, 0.14, 1)
  P.box(chrome, 0, y0 + 0.14, h + 0.06, m.w + 0.06, 0.16, 0.14, 1)
  P.box(chrome, 0, y0 + 0.4, -h - 0.02, m.w * 0.55, 0.22, 0.04, 1)
  for (const s of [-1, 1]) {
    P.add(wreck ? acres.steelDark() : acres.lampGlass(), discGeo(0.1), [s * (m.w / 2 - 0.28), y1 - 0.18, -h - 0.03], [0, Math.PI, 0])
    P.add(acres.paint('#b52a20', 0.4), discGeo(0.07), [s * (m.w / 2 - 0.25), y1 - 0.2, h + 0.03])
  }
  return P.build()
}

export function Car({ p, rotY, model, color, wreck = false }) {
  const parts = useMemo(() => once(`car:${model}:${color}:${wreck}`, () => buildCar(model, color, wreck)), [model, color, wreck])
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      <Merged parts={parts} />
    </group>
  )
}

