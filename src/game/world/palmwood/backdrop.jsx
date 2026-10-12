import { SphereGeometry } from 'three'

import { PALMWOOD_HALF, PW_ROOF_T } from '../../../shared/mapPalmwood.js'
import { seededRandom } from '../../../shared/math.js'
import { Merged } from '../acres/merge.jsx'
import { once, Pieces } from '../acres/pieces.js'
import { addSheets } from './kit.js'
import { pw } from './materials.js'
import { addBanana, addPalm } from './plants.js'

/**
 * The tin fence round the town and the world past it: more shacks and roofs,
 * banana groves and coconut palms thick along the fence, and green jungle
 * hills all round.
 */

export function PalmwoodPerimeter() {
  const parts = once('pw:perimeter', () => {
    const P = new Pieces()
    const rand = seededRandom(6101)
    const E = PALMWOOD_HALF + 0.25
    const H = 2.5
    const colors = ['rust', 'galvanized', 'rust', 'red', 'teal', 'white', 'rust', 'blue']
    const post = pw.wood('#9a7a52')
    const sides = [
      { axis: 'x', fixed: -E, out: -1 },
      { axis: 'x', fixed: E, out: 1 },
      { axis: 'z', fixed: -E, out: -1 },
      { axis: 'z', fixed: E, out: 1 },
    ]
    for (const side of sides) {
      const at = (c, y, n = 0) => (side.axis === 'x' ? [c, y, side.fixed + n] : [side.fixed + n, y, c])
      const size = (a, h, b) => (side.axis === 'x' ? [a, h, b] : [b, h, a])
      let i = 0
      for (let c = -E; c < E - 0.01; c += 0.9, i++) {
        const tall = H - rand() * 0.3
        const lift = (i % 2) * 0.012 * side.out
        // Now and then a plywood sheet patches the tin.
        if (rand() < 0.08) P.box(pw.plywood(), ...at(c + 0.45, tall / 2, lift), ...size(0.93, tall, 0.02), 2.44)
        else P.box(pw.tin(colors[Math.floor(rand() * colors.length)]), ...at(c + 0.45, tall / 2, lift), ...size(0.93, tall, 0.02), 1.6)
        if (i % 3 === 0) P.box(post, ...at(c, (H + 0.2) / 2, side.out * 0.06), ...size(0.1, H + 0.2, 0.1), 1)
      }
      for (const y of [0.4, H - 0.4]) P.box(post, ...at(0, y, side.out * 0.05), ...size(E * 2, 0.08, 0.05), 1)
    }
    return P.build()
  })
  return <Merged parts={parts} shadow={false} />
}

/** A rounded jungle hill: a dome roughened into ridges, flat shaded. */
function hillGeometry(rand, radius, height) {
  const g = new SphereGeometry(1, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed()
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
      const ridge = 1 + 0.16 * Math.sin(a * 3 + phase[0]) + 0.08 * Math.sin(a * 7 + phase[1]) + (rand() - 0.5) * 0.08
      moved.set(key, [x * radius * ridge, y * height * (1 + (rand() - 0.5) * 0.12), z * radius * ridge])
    }
    const [nx, ny, nz] = moved.get(key)
    pos.setXYZ(i, nx, ny, nz)
  }
  g.computeVertexNormals()
  return g
}

export function PalmwoodBackdrop() {
  const parts = once('pw:backdrop', () => {
    const P = new Pieces()
    const rand = seededRandom(6151)
    const E = PALMWOOD_HALF
    // Hills all round, greener near, bluer with distance.
    const tints = ['#4f7a3c', '#5a8442', '#6a8a5a', '#7a9472']
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + rand() * 0.2
      const d = 150 + rand() * 110
      const tint = tints[Math.min(3, Math.floor((d - 150) / 30))]
      P.add(pw.rock(tint), hillGeometry(rand, 50 + rand() * 45, 26 + rand() * 30), [Math.cos(a) * d, -3, Math.sin(a) * d], [0, rand() * 6, 0])
    }
    // Shacks and roofs past the fence.
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + rand() * 0.15
      const d = 47 + rand() * 14
      const x = Math.cos(a) * d
      const z = Math.sin(a) * d
      const w = 5 + rand() * 3
      const dd = 4 + rand() * 2
      const h = 2.4 + rand() * 0.6
      const yaw = Math.atan2(-x, -z) + (rand() - 0.5) * 0.4
      P.withFrame([x, 0, z], yaw, () => {
        P.box(rand() < 0.5 ? pw.plywood() : pw.plywood('#e4a2a6'), 0, h / 2, 0, w, h, dd, 2.44)
        const roof = { p: [0, h + 0.25, 0], size: [w + 0.8, PW_ROOF_T, dd + 0.8], q: [Math.sin(0.08), 0, 0, Math.cos(0.08)] }
        addSheets(P, roof, ['rust', 'red', 'galvanized', 'teal'], rand)
      })
    }
    // Palms and banana groves thick along the outside of the fence.
    for (let i = 0; i < 46; i++) {
      const side = i % 4
      const t = (rand() * 2 - 1) * (E + 8)
      const off = E + 3 + rand() * 18
      const p = side === 0 ? [t, 0, -off] : side === 1 ? [t, 0, off] : side === 2 ? [-off, 0, t] : [off, 0, t]
      addPalm(P, p, 8 + rand() * 4, 0.15 + rand() * 0.35, 8000 + i, { fronds: 9, coconuts: false })
    }
    for (let i = 0; i < 30; i++) {
      const side = i % 4
      const t = (rand() * 2 - 1) * (E + 4)
      const off = E + 1.6 + rand() * 4
      const p = side === 0 ? [t, 0, -off] : side === 1 ? [t, 0, off] : side === 2 ? [-off, 0, t] : [off, 0, t]
      addBanana(P, p, 0.9 + rand() * 0.4, 9000 + i)
    }
    return P.build()
  })
  return <Merged parts={parts} shadow={false} />
}
