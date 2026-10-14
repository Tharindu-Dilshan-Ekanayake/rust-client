import { useMemo } from 'react'
import { ConeGeometry, CylinderGeometry, PlaneGeometry, SphereGeometry } from 'three'

import { TB, TERMINAL_HALF } from '../../../shared/mapTerminal.js'
import { seededRandom } from '../../../shared/math.js'
import { Merged } from '../acres/merge.jsx'
import { once, Pieces } from '../acres/pieces.js'
import { addBar } from '../quarter/kit.js'
import { addFarPlane } from './farPlane.js'
import { addSign, GROUND_Y } from './kit.js'
import { tm } from './materials.js'

/**
 * The fence round the apron, and the airport past it: the taxiway and the
 * runway beyond the southern fence with a jet taxiing out, the other
 * concourse to the west with two jets at its gates, the control tower and a
 * hangar to the east, the fuel farm, belts of pines; past them the smoke
 * haze hides everything. None of it is reachable; it's drawn without shadows.
 */

const H = TERMINAL_HALF

/* ---------------------------------------------------------------------------
 * Perimeter fence
 * ------------------------------------------------------------------------- */

function addFence(P, a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const ux = (b[0] - a[0]) / len
  const uz = (b[1] - a[1]) / len
  const yaw = Math.atan2(-uz, ux)
  const h = 3.0
  const post = tm.paint('#9aa0a8', 0.45, 0.6)
  const cx = (a[0] + b[0]) / 2
  const cz = (a[1] + b[1]) / 2
  // The mesh (one long panel), its top rail and the concrete footing.
  const mesh = new PlaneGeometry(len, h - 0.2)
  const uv = mesh.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len, uv.getY(i) * (h - 0.2))
  P.add(tm.chainLink(), mesh, [cx, 0.2 + (h - 0.2) / 2, cz], [0, yaw, 0])
  P.box(post, cx, h, cz, len, 0.05, 0.05, 1, [0, yaw, 0])
  P.box(tm.concrete('#bdbab2'), cx, 0.1, cz, len, 0.2, 0.25, 2, [0, yaw, 0])
  const n = Math.max(1, Math.round(len / 3))
  for (let i = 0; i <= n; i++) {
    const x = a[0] + (b[0] - a[0]) * (i / n)
    const z = a[1] + (b[1] - a[1]) * (i / n)
    P.box(post, x, h / 2 + 0.2, z, 0.08, h + 0.4, 0.08, 1)
    // The barbed wire's arm leaning out.
    const ox = -uz
    const oz = ux
    addBar(P, post, [x, h + 0.35, z], [x + ox * 0.45, h + 0.8, z + oz * 0.45], 0.04, 0.04)
  }
  // Three strands along the arms.
  for (let k = 1; k <= 3; k++) {
    const off = (k / 3) * 0.45
    const y = h + 0.35 + (k / 3) * 0.45
    addBar(P, tm.paint('#6a6e74', 0.5, 0.6), [a[0] - uz * off, y, a[1] + ux * off], [b[0] - uz * off, y, b[1] + ux * off], 0.012, 0.012)
  }
}

function buildPerimeter() {
  const P = new Pieces()
  const E = H + 0.15
  // South, then the west and east sides (they run up to the terminal's back corners), and behind the two strips at its ends.
  addFence(P, [E, E], [-E, E])
  addFence(P, [-E, E], [-E, -E])
  addFence(P, [E, -E], [E, E])
  addFence(P, [-E, -E], [TB.x0, -E])
  addFence(P, [TB.x1, -E], [E, -E])
  return P.build()
}

export function TerminalPerimeter() {
  const parts = useMemo(() => once('tm:perimeter', buildPerimeter), [])
  return <Merged parts={parts} />
}

/* ---------------------------------------------------------------------------
 * Beyond the fence
 * ------------------------------------------------------------------------- */

function addControlTower(P, x, z) {
  const concrete = tm.concrete('#d6d4ce')
  P.box(tm.cladding('#e8eaec'), x, 4.5, z + 6, 18, 9, 12, 3)
  P.add(concrete, new CylinderGeometry(2.4, 3.0, 40, 16), [x, 20, z])
  // The cab: a floor, an eight-sided glass room leaning out, a roof, antennas and the radar.
  P.add(concrete, new CylinderGeometry(5.4, 3.0, 2.0, 8), [x, 41, z])
  P.add(tm.paint('#20262e', 0.1, 0.6), new CylinderGeometry(5.6, 5.0, 4.0, 8, 1, true), [x, 44, z])
  P.add(tm.paint('#2a2c30', 0.5, 0.4), new CylinderGeometry(5.8, 5.6, 0.6, 8), [x, 46.3, z])
  P.add(concrete, new CylinderGeometry(3.0, 5.8, 1.2, 8), [x, 47.2, z])
  for (const [dx, h] of [[-1.2, 7], [1.4, 5]]) P.box(tm.paint('#c0392b', 0.5), x + dx, 47.8 + h / 2, z, 0.2, h, 0.2, 1)
  P.add(tm.glow('#ff3a2a'), new SphereGeometry(0.3, 8, 6), [x - 1.2, 55.0, z])
  P.box(tm.paint('#e8eaec', 0.5), x + 0.2, 49.0, z - 1.6, 4.0, 1.4, 0.3, 1)
}

function addHangar(P, x, z, w, d, h) {
  const clad = tm.cladding('#9fb0c0')
  P.box(clad, x, h / 2, z, w, h, d, 4)
  // The arched roof: half a cylinder (the half on its +x side) laid along x, its arch squashed low.
  P.add(clad, new CylinderGeometry(d / 2, d / 2, w, 24, 1, false, 0, Math.PI), [x, h, z], [0, 0, Math.PI / 2], [0.35, 1, 1])
  // The big door on its long side facing the apron, and the airport's name over it.
  P.box(tm.cladding('#6f7e8c'), x, h * 0.45, z - d / 2 - 0.05, w - 8, h * 0.9, 0.2, 4)
  addSign(P, 'logo', [x, h + 2.2, z - d / 2 - 0.2], 24, 3, Math.PI)
}

function addConcourse(P, x0, x1, z0, z1, h, rand) {
  P.box(tm.cladding('#eef0f2'), (x0 + x1) / 2, h / 2, (z0 + z1) / 2, x1 - x0, h, z1 - z0, 4)
  P.box(tm.paint('#20262e', 0.1, 0.6), (x0 + x1) / 2, h * 0.55, z1 + 0.02, x1 - x0 - 4, h * 0.5, 0.06, 1)
  P.box(tm.cladding('#d6dadf'), (x0 + x1) / 2, h + 0.4, (z0 + z1) / 2, x1 - x0 + 1, 0.8, z1 - z0 + 1, 4)
  // Jet bridges at its gates, and the jets at two of them.
  const gates = []
  for (let gx = x1 - 22; gx > x0 + 10; gx -= 40) gates.push(gx)
  gates.forEach((gx, i) => {
    addBar(P, tm.brushed('#c9ccd0'), [gx - 6, 4.6, z1], [gx - 6, 3.8, z1 + 10], 2.6, 2.6)
    P.add(tm.paint('#8d9196', 0.45, 0.5), new CylinderGeometry(0.4, 0.4, 3.4, 8), [gx - 6, 1.7, z1 + 9])
    if (i < 2) P.withFrame([gx, 0, z1 + 16.4], (rand() - 0.5) * 0.05, addFarPlane)
  })
}

function buildBackdrop() {
  const P = new Pieces()
  const rand = seededRandom(9901)
  // Grass all round (under the apron too, a few centimetres down), the taxiway and the runway.
  const S = 1300
  const grass = new PlaneGeometry(S, S)
  const guv = grass.getAttribute('uv')
  for (let i = 0; i < guv.count; i++) guv.setXY(i, (guv.getX(i) * S) / 20, (guv.getY(i) * S) / 20)
  P.add(tm.concrete('#7f8c66'), grass.rotateX(-Math.PI / 2), [0, GROUND_Y.grass, 0])
  const strip = (z0, z1, x0, x1, tint) => {
    const g = new PlaneGeometry(x1 - x0, z1 - z0)
    const uv = g.getAttribute('uv')
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * (x1 - x0)) / 5, (uv.getY(i) * (z1 - z0)) / 5)
    P.add(tint ? tm.concrete(tint) : tm.tarmac(), g.rotateX(-Math.PI / 2), [(x0 + x1) / 2, GROUND_Y.grass + 0.012, (z0 + z1) / 2])
  }
  // The apron carries on past the fence a little (so the fence doesn't stand in grass), then the taxiway and the runway.
  strip(H, 96, -260, 260)
  strip(-H, H, -110, -H)
  strip(-H, H, H, 160)
  strip(150, 200, -900, 900, '#5a5a58')
  const paint = (x0, z0, x1, z1, tint) => P.add(tm.paint(tint, 0.75), new PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), [(x0 + x1) / 2, GROUND_Y.grass + 0.02, (z0 + z1) / 2])
  paint(-260, 79.9, 260, 80.1, '#e8b42a')
  for (let x = -880; x < 880; x += 60) paint(x, 174.6, x + 30, 175.4, '#eeeeea')
  for (const z of [151.5, 198.5]) paint(-900, z - 0.3, 900, z + 0.3, '#eeeeea')
  // Blue taxiway edge lights.
  for (let x = -250; x < 250; x += 25) for (const z of [67.5, 92.5]) P.box(tm.glow('#3a6aff'), x, 0.25, z, 0.12, 0.3, 0.12, 1)

  // A jet taxiing out along the taxiway (nose east).
  P.withFrame([-70, 0, 80], -Math.PI / 2, addFarPlane)
  // The other concourse to the west, its jets at the gates.
  addConcourse(P, -230, -72, -60, -26, 10, rand)
  // The control tower and a hangar to the east, the fuel farm behind.
  addControlTower(P, 96, -46)
  addHangar(P, 140, 40, 72, 46, 22)
  for (const [x, z] of [[150, -120], [175, -110], [160, -90]]) P.add(tm.paint('#eef0f2', 0.45, 0.3), new CylinderGeometry(9, 9, 11, 20), [x, 5.5, z])

  // Belts of pines, darker further off.
  const pine = tm.paint('#2f4a32', 0.9)
  const bark = tm.paint('#4a3a2a', 0.9)
  const tree = (x, z, s) => {
    P.add(bark, new CylinderGeometry(0.25 * s, 0.35 * s, 3 * s, 6), [x, 1.5 * s, z])
    P.add(pine, new ConeGeometry(2.4 * s, 9 * s, 8), [x, 6.5 * s, z])
  }
  for (let i = 0; i < 70; i++) tree(-420 + i * 12 + rand() * 6, 230 + rand() * 30, 1 + rand() * 0.6)
  for (let i = 0; i < 30; i++) tree(-300 - rand() * 60, -200 + i * 14 + rand() * 6, 1 + rand() * 0.6)
  for (let i = 0; i < 30; i++) tree(300 + rand() * 60, -200 + i * 14 + rand() * 6, 1 + rand() * 0.6)

  return P.build()
}

export function TerminalBackdrop() {
  const parts = useMemo(() => once('tm:backdrop', buildBackdrop), [])
  return <Merged parts={parts} shadow={false} />
}
