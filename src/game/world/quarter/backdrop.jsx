import { CylinderGeometry, SphereGeometry } from 'three'

import { QUARTER_HALF } from '../../../shared/mapQuarter.js'
import { seededRandom } from '../../../shared/math.js'
import { Merged } from '../acres/merge.jsx'
import { once, Pieces } from '../acres/pieces.js'
import { addPalm } from '../palmwood/plants.js'
import { addBar } from './kit.js'
import { oq } from './materials.js'

/**
 * The wall round the quarter and the town past it: rows of flat-roofed
 * houses, their windows dark, tanks and dishes on the roofs, palms between
 * them, two tower cranes over the skyline, and bare tan hills far off.
 */

const TINTS = ['#dcc9a3', '#e4d3b0', '#cdb698', '#d8bf98', '#e8dcc0', '#c9b48c', '#d6c4a6']

export function QuarterPerimeter() {
  const parts = once('oq:perimeter', () => {
    const P = new Pieces()
    const E = QUARTER_HALF + 0.12
    const H = 4.0
    const wall = oq.stucco('#d2c2a2')
    const coping = oq.concrete('#dad3c4')
    for (const [axis, fixed] of [['x', -E], ['x', E], ['z', -E], ['z', E]]) {
      const at = (c, y) => (axis === 'x' ? [c, y, fixed] : [fixed, y, c])
      const size = (a, h, b) => (axis === 'x' ? [a, h, b] : [b, h, a])
      const L = E * 2 + 0.4
      P.box(wall, ...at(0, H / 2, 0), ...size(L, H, 0.4), 2.5)
      // Piers every 8 m and a coping along the top (the piers' caps stand above it).
      P.box(coping, ...at(0, H + 0.04, 0), ...size(L + 0.1, 0.08, 0.5), 1)
      for (let c = -E + 4; c < E; c += 8) P.box(coping, ...at(c, H + 0.2, 0), ...size(0.62, 0.24, 0.62), 1)
    }
    return P.build()
  })
  return <Merged parts={parts} shadow={false} />
}

/** A bare hill: a dome roughened into ridges, flat shaded. */
function hillGeometry(rand, radius, height) {
  const g = new SphereGeometry(1, 14, 5, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed()
  const pos = g.getAttribute('position')
  const phase = [rand() * 6, rand() * 6]
  const moved = new Map()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`
    if (!moved.has(key)) {
      const a = Math.atan2(z, x)
      const ridge = 1 + 0.18 * Math.sin(a * 3 + phase[0]) + 0.08 * Math.sin(a * 7 + phase[1]) + (rand() - 0.5) * 0.1
      moved.set(key, [x * radius * ridge, y * height * (1 + (rand() - 0.5) * 0.15), z * radius * ridge])
    }
    const [nx, ny, nz] = moved.get(key)
    pos.setXYZ(i, nx, ny, nz)
  }
  g.computeVertexNormals()
  return g
}

/** A tower crane: a lattice mast (drawn as a box with cross bracing), the jib and its counterweight. */
function addCrane(P, x, z, h, yaw, rand) {
  const yellow = oq.paint('#d9a521', 0.6)
  const dark = oq.paint('#3a3a38', 0.6, 0.5)
  const m = 1.4
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(yellow, x + (sx * m) / 2, h / 2, z + (sz * m) / 2, 0.12, h, 0.12, 1)
  for (let y = 0; y < h - 1; y += 2.4) {
    for (const s of [-1, 1]) {
      addBar(P, yellow, [x - m / 2, y, z + (s * m) / 2], [x + m / 2, y + 2.4, z + (s * m) / 2], 0.06, 0.06)
      addBar(P, yellow, [x + (s * m) / 2, y, z - m / 2], [x + (s * m) / 2, y + 2.4, z + m / 2], 0.06, 0.06)
    }
  }
  P.box(dark, x, h + 1.0, z, 2.0, 2.0, 2.0, 1)
  const jib = 26 + rand() * 8
  const back = 9
  const dx = Math.cos(yaw)
  const dz = -Math.sin(yaw)
  const at = (d, y) => [x + dx * d, y, z + dz * d]
  addBar(P, yellow, at(-back, h + 2.2), at(jib, h + 2.2), 0.9, 0.9)
  addBar(P, yellow, at(0, h + 6.5), at(jib * 0.7, h + 2.7), 0.08, 0.08)
  addBar(P, yellow, at(0, h + 6.5), at(-back, h + 2.7), 0.08, 0.08)
  addBar(P, yellow, at(0, h + 2.0), at(0, h + 6.6), 0.4, 0.4)
  const cw = at(-back + 1.4, h + 1.2)
  P.box(oq.concrete('#9a958a'), cw[0], cw[1], cw[2], 2.4, 1.6, 2.4, 1)
  const hook = at(jib * 0.55, h)
  addBar(P, dark, [hook[0], h + 2.0, hook[2]], [hook[0], h - 8, hook[2]], 0.03, 0.03)
}

export function QuarterBackdrop() {
  const parts = once('oq:backdrop', () => {
    const P = new Pieces()
    const rand = seededRandom(8151)
    const E = QUARTER_HALF
    const dark = oq.paint('#3a332c', 0.9)
    // Rows of houses round the wall, taller further out so the roofline steps up.
    for (let ring = 0; ring < 2; ring++) {
      for (const side of ['n', 's', 'w', 'e']) {
        let c = -E - 12 + rand() * 4
        while (c < E + 12) {
          const w = 6 + rand() * 8
          const d = 7 + rand() * 5
          const h = (ring === 0 ? 4.5 : 8) + rand() * (ring === 0 ? 5 : 9)
          const off = E + 2.5 + ring * 14 + rand() * 3 + d / 2
          const mid = c + w / 2
          const [x, z] = side === 'n' ? [mid, -off] : side === 's' ? [mid, off] : side === 'w' ? [-off, mid] : [off, mid]
          const alongX = side === 'n' || side === 's'
          const tint = TINTS[Math.floor(rand() * TINTS.length)]
          P.box(oq.stucco(tint), x, h / 2, z, alongX ? w : d, h, alongX ? d : w, 2.5)
          P.box(oq.concrete('#dad3c4'), x, h + 0.05, z, (alongX ? w : d) + 0.1, 0.1, (alongX ? d : w) + 0.1, 1)
          // Windows on the face toward town, a row per storey.
          const facing = side === 'n' ? d / 2 : side === 's' ? -d / 2 : side === 'w' ? d / 2 : -d / 2
          const rows = Math.floor((h - 1) / 3.2)
          const cols = Math.max(1, Math.floor(w / 2.6))
          for (let r = 0; r < rows; r++) {
            for (let k = 0; k < cols; k++) {
              if (rand() < 0.2) continue
              const a = -w / 2 + (w * (k + 0.5)) / cols
              const y = 1.4 + r * 3.2
              if (alongX) P.box(dark, x + a, y, z + facing + Math.sign(facing) * 0.02, 1.0, 1.2, 0.04, 1)
              else P.box(dark, x + facing + Math.sign(facing) * 0.02, y, z + a, 0.04, 1.2, 1.0, 1)
            }
          }
          if (rand() < 0.45) P.add(oq.paint('#e8e4da', 0.6), new CylinderGeometry(0.55, 0.55, 1.1, 10), [x + (rand() - 0.5) * w * 0.5, h + 0.65, z + (rand() - 0.5) * d * 0.5])
          c += w + 0.5 + rand() * 3
        }
      }
    }
    // Palms between the roofs.
    for (let i = 0; i < 26; i++) {
      const a = rand() * Math.PI * 2
      const d = E + 6 + rand() * 24
      addPalm(P, [Math.cos(a) * d * 1.05, 0, Math.sin(a) * d * 1.05], 9 + rand() * 4, 0.15 + rand() * 0.3, 8800 + i, { fronds: 9, coconuts: false })
    }
    addCrane(P, -52, -64, 34, 0.4, rand)
    addCrane(P, 70, 30, 30, 2.6, rand)
    // Bare hills far off.
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rand() * 0.2
      const d = 170 + rand() * 120
      P.add(oq.concrete(['#b9a27c', '#c4ae88', '#cbb894'][i % 3]), hillGeometry(rand, 60 + rand() * 50, 22 + rand() * 26), [Math.cos(a) * d, -3, Math.sin(a) * d], [0, rand() * 6, 0])
    }
    return P.build()
  })
  return <Merged parts={parts} shadow={false} />
}
