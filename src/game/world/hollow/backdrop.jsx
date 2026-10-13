import { useMemo } from 'react'
import { ConeGeometry, SphereGeometry } from 'three'

import { HOLLOW_HALF } from '../../../shared/mapHollow.js'
import { seededRandom } from '../../../shared/math.js'
import { acres } from '../acres/materials.js'
import { Merged } from '../acres/merge.jsx'
import { once, Pieces } from '../acres/pieces.js'
import { addPine } from './kit.js'
import { hc } from './materials.js'

/**
 * The edge of town and the night past it: a low fieldstone wall round the
 * town, a dark pine forest thick beyond it, black hills against the sky, and
 * on the northern hill an old house with a few windows lit.
 */

const H = HOLLOW_HALF

export function HollowPerimeter() {
  const parts = useMemo(
    () =>
      once('hc:perimeter', () => {
        const P = new Pieces()
        const stone = acres.stone()
        const cap = hc.granite('#7e7c76')
        const rand = seededRandom(7301)
        const E = H + 0.35
        const sides = [
          { axis: 'x', fixed: -E },
          { axis: 'x', fixed: E },
          { axis: 'z', fixed: -E },
          { axis: 'z', fixed: E },
        ]
        for (const side of sides) {
          const at = (c, y) => (side.axis === 'x' ? [c, y, side.fixed] : [side.fixed, y, c])
          const size = (a, h, b) => (side.axis === 'x' ? [a, h, b] : [b, h, a])
          // Rough stretches of wall, a little uneven in height, with pier posts between.
          for (let c = -E; c < E - 0.01; c += 2.4) {
            const h = 0.85 + rand() * 0.15
            P.box(stone, ...at(c + 1.2, h / 2), ...size(2.42, h, 0.5), 1.4)
            P.box(cap, ...at(c + 1.2, h + 0.04), ...size(2.46, 0.08, 0.58), 1)
          }
          for (let c = -E; c <= E + 0.01; c += 7.2) P.box(stone, ...at(c, 0.6), ...size(0.62, 1.2, 0.62), 1.4)
        }
        return P.build()
      }),
    [],
  )
  return <Merged parts={parts} shadow={false} />
}

/** A rounded hill: a dome roughened into ridges, flat shaded. */
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

export function HollowBackdrop() {
  const parts = useMemo(
    () =>
      once('hc:backdrop', () => {
        const P = new Pieces()
        const rand = seededRandom(7351)
        // Black hills all round, a big one to the north for the old house.
        const tints = ['#1c2420', '#202a28', '#26302e', '#2c3434']
        for (let i = 0; i < 15; i++) {
          const a = (i / 15) * Math.PI * 2 + rand() * 0.2
          const d = 150 + rand() * 100
          P.add(hc.paint(tints[Math.min(3, Math.floor((d - 150) / 25))], 0.95), hillGeometry(rand, 46 + rand() * 40, 22 + rand() * 26), [Math.cos(a) * d, -3, Math.sin(a) * d], [0, rand() * 6, 0])
        }
        P.add(hc.paint('#1a201e', 0.95), hillGeometry(rand, 70, 34), [8, -4, -175], [0, 0.4, 0])
        // The old house on the hill: a tall dark block, a tower, a steep roof, windows lit.
        P.withFrame([10, 29, -168], 0.15, () => {
          const dark = hc.paint('#15161a', 0.95)
          P.box(dark, 0, 5, 0, 18, 10, 9, 1)
          P.add(dark, new ConeGeometry(11.5, 6, 4), [0, 13, 0], [0, Math.PI / 4, 0], [1, 1, 0.55])
          P.box(dark, -9.5, 8, 1, 5, 16, 5, 1)
          P.add(dark, new ConeGeometry(4.2, 7, 4), [-9.5, 19.5, 1], [0, Math.PI / 4, 0])
          for (const [x, y] of [[-5, 3], [-1.5, 6.5], [4, 3], [6.5, 6.5], [-9.5, 11]]) P.box(hc.lampGlass(), x, y, 4.56, 1.2, 1.8, 0.1, 1)
        })
        // The forest: pines packed round the town, thinning to silhouettes on the hills.
        for (let i = 0; i < 170; i++) {
          const side = i % 4
          const t = (rand() * 2 - 1) * (H + 14)
          const off = H + 2.6 + rand() * rand() * 26
          const p = side === 0 ? [t, 0, -off] : side === 1 ? [t, 0, off] : side === 2 ? [-off, 0, t] : [off, 0, t]
          addPine(P, p, 8 + rand() * 7, 20000 + i, 4)
        }
        return P.build()
      }),
    [],
  )
  return <Merged parts={parts} shadow={false} />
}
