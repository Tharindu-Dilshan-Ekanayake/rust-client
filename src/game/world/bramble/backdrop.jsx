import { CylinderGeometry, SphereGeometry } from 'three'

import { BRAMBLE_HALF, brambleGroundY, CREEK_END, creekSection } from '../../../shared/mapBramble.js'
import { seededRandom } from '../../../shared/math.js'
import { Merged } from '../acres/merge.jsx'
import { once, Pieces } from '../acres/pieces.js'
import { addTree } from './kit.js'
import { br } from './materials.js'

/**
 * The tumbledown stone wall round the farm and the woods past it: a thick
 * belt of trees right up against the wall, more behind, two old silos showing
 * over them, and green hills far off. Where the creek runs out under the wall
 * at each end, the wall goes down into the ditch over a culvert.
 */

export function BramblePerimeter() {
  const parts = once('br:perimeter', () => {
    const P = new Pieces()
    const rand = seededRandom(9401)
    const E = BRAMBLE_HALF + 0.3
    const stone = br.stone()
    for (const [axis, fixed] of [['x', -E], ['x', E], ['z', -E], ['z', E]]) {
      for (let c = -E; c < E; c += 1.6) {
        const h = 1.1 + rand() * 0.35
        // Down to the ground under it (the creek's bed, where the wall crosses it).
        const foot = axis === 'x' ? 0 : Math.min(0, ...[0, 0.8, 1.62].map((d) => brambleGroundY(Math.sign(fixed) * CREEK_END, c + d)))
        const y0 = foot < 0 ? foot - 0.1 : 0
        const at = axis === 'x' ? [c + 0.8, (h + y0) / 2, fixed] : [fixed, (h + y0) / 2, c + 0.8]
        // Neighbours overlap a little; every other one a touch thicker, so their faces never share a plane.
        const t = 0.55 + (Math.round((c + E) / 1.6) % 2) * 0.035
        P.box(stone, ...at, axis === 'x' ? 1.62 : t, h - y0, axis === 'x' ? t : 1.62, 1.4)
      }
    }
    // The culverts: a concrete pipe's mouth in the wall at each end of the creek, dark inside.
    for (const sx of [-1, 1]) {
      const s = creekSection(sx * CREEK_END)
      const z = s.z - s.shift
      const y = -s.depth - s.dip + 0.5
      const x = sx * (E - 0.3)
      P.add(br.concrete(), new CylinderGeometry(0.62, 0.62, 0.3, 18), [x, y, z], [0, 0, Math.PI / 2])
      P.add(br.paint('#14120f', 1), new CylinderGeometry(0.5, 0.5, 0.36, 18), [x, y, z], [0, 0, Math.PI / 2])
    }
    return P.build()
  })
  return <Merged parts={parts} />
}

/** A rounded hill: a dome roughened into ridges, flat shaded. */
function hillGeometry(rand, radius, height) {
  const g = new SphereGeometry(1, 20, 6, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed()
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

export function BrambleBackdrop() {
  const parts = once('br:backdrop', () => {
    const P = new Pieces()
    const rand = seededRandom(9451)
    const E = BRAMBLE_HALF
    // The tree belt: close and thick along the wall, sparser behind.
    for (const [from, to, gap, clumps] of [[E + 1.2, E + 6, 4.2, 9], [E + 8, E + 26, 6.5, 7]]) {
      for (const side of [0, 1, 2, 3]) {
        for (let c = -E - 10; c < E + 10; c += gap * (0.8 + rand() * 0.4)) {
          const off = from + rand() * (to - from)
          const p = side === 0 ? [c, 0, -off] : side === 1 ? [c, 0, off] : side === 2 ? [-off, 0, c] : [off, 0, c]
          addTree(P, p, 10 + rand() * 7, Math.floor(rand() * 1e6), { ivy: false, clumps, autumn: rand() < 0.12 })
        }
      }
    }
    // Two old silos and a farm roof over the trees to the north-east.
    for (const [x, z, r, h] of [[60, -58, 3.2, 16], [66, -54, 2.6, 13]]) {
      P.add(br.paint('#9a948a', 0.8, 0.3), new CylinderGeometry(r, r, h, 20), [x, h / 2, z])
      P.add(br.rust(), new SphereGeometry(r, 20, 6, 0, Math.PI * 2, 0, Math.PI / 2), [x, h, z])
    }
    // Low rolling hills all round (long and low, so none looms over the
    // trees), greener near, bluer with distance.
    const tints = ['#4a5e3c', '#546848', '#62765e', '#728676']
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + rand() * 0.2
      const d = 170 + rand() * 100
      P.add(br.paint(tints[Math.min(3, Math.floor((d - 170) / 26))], 0.95), hillGeometry(rand, 65 + rand() * 45, 14 + rand() * 16), [Math.cos(a) * d, -4, Math.sin(a) * d], [0, rand() * 6, 0])
    }
    return P.build()
  })
  return <Merged parts={parts} shadow={false} />
}
