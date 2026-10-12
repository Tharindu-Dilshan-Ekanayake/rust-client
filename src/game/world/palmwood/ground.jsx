import { useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute, Path, Shape, ShapeGeometry } from 'three'

import { LOOP, loopPath, PALMWOOD_HALF, TRACKS } from '../../../shared/mapPalmwood.js'
import { seededRandom } from '../../../shared/math.js'
import { Merged } from '../acres/merge.jsx'
import { once, Pieces } from '../acres/pieces.js'
import { GROUND_Y } from './kit.js'
import { pw } from './materials.js'

/**
 * The ground of Palmwood: packed red earth, patches of tropical grass, the
 * rutted mud loop round the middle of town (its ruts follow the curve: the
 * strip's texture runs along it) and the tracks off it. Past the fence,
 * jungle floor.
 *
 * Layer heights a few centimetres apart, each depth-offset by its material
 * (pw.layer), so none of them flickers against the one below.
 */

/** Flat shape (drawn in x / -z) laid on the ground at height `y`, UVs one tile per `tile` m. */
function flat(shape, y, tile) {
  const g = new ShapeGeometry(shape, 24)
  const uv = g.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / tile, uv.getY(i) / tile)
  g.rotateX(-Math.PI / 2)
  g.translate(0, y, 0)
  return g
}

function rect(x0, z0, x1, z1) {
  const s = new Shape()
  s.moveTo(x0, -z0)
  s.lineTo(x1, -z0)
  s.lineTo(x1, -z1)
  s.lineTo(x0, -z1)
  s.closePath()
  return s
}

/** Irregular blob round (x, z). */
function blob(x, z, rx, rz, seed) {
  const rand = seededRandom(seed)
  const s = new Shape()
  const n = 20
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const k = 0.74 + rand() * 0.36
    const px = x + Math.cos(a) * rx * k
    const pz = z + Math.sin(a) * rz * k
    if (i === 0) s.moveTo(px, -pz)
    else s.lineTo(px, -pz)
  }
  s.closePath()
  return s
}

/**
 * A strip of `width` along a polyline of [x, z] points: u across it (0 left,
 * 1 right), v along it (one texture length per `tile` m). Closed strips wrap,
 * with the tile length nudged so the texture meets itself.
 */
function ribbon(points, width, y, tile, closed) {
  const n = points.length
  const count = closed ? n + 1 : n
  const lens = [0]
  for (let i = 1; i < count; i++) {
    const a = points[(i - 1) % n]
    const b = points[i % n]
    lens.push(lens[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]))
  }
  const total = lens[count - 1]
  const tl = closed ? total / Math.max(1, Math.round(total / tile)) : tile
  const pos = []
  const nor = []
  const uv = []
  const idx = []
  for (let i = 0; i < count; i++) {
    const p = points[i % n]
    const prev = closed ? points[(i - 1 + n) % n] : points[Math.max(0, i - 1)]
    const next = closed ? points[(i + 1) % n] : points[Math.min(n - 1, i + 1)]
    let tx = next[0] - prev[0]
    let tz = next[1] - prev[1]
    const l = Math.hypot(tx, tz) || 1
    tx /= l
    tz /= l
    // Left of the direction of travel.
    const nx = tz
    const nz = -tx
    const h = width / 2
    pos.push(p[0] + nx * h, y, p[1] + nz * h, p[0] - nx * h, y, p[1] - nz * h)
    nor.push(0, 1, 0, 0, 1, 0)
    const v = lens[i] / tl
    uv.push(0, v, 1, v)
    if (i > 0) {
      const a = (i - 1) * 2
      // Wound to face up.
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

/** Grass patches: [x, z, rx, rz]. */
const GRASS = [
  [-11.2, -1.0, 2.6, 6.4], [9.4, 7.6, 3.4, 2.4], [-3.0, -8.4, 4.6, 2.0], [10.6, -7.8, 2.6, 2.4], [-2.4, 7.6, 3.0, 2.2],
  [-30, -34, 7, 4.5], [-6, -33, 9, 3.6], [16, -34, 7, 4], [33, -30, 4.5, 7], [34, -4, 3.8, 9],
  [34, 26, 4, 7], [17, 34, 8, 3.5], [-6, 33, 9, 3.6], [-30, 34, 6, 4], [-34, 18, 4, 6],
  [-34, -10, 3.6, 7], [-20, -26, 4, 3.4], [20, 26, 3.5, 3], [-22, 22, 3.2, 3], [21, -26, 3.4, 3.2],
  [-24.6, 12.6, 3, 2.4], [26, 18.6, 3.6, 2.6], [12.6, -20, 3.2, 2.2], [-15.6, 18.6, 3, 2.2],
  // Along the foot of the buildings and round the yards.
  [-3, -19.6, 7, 1.6], [-27.6, -15.6, 3.6, 2], [26, -23.4, 3.4, 1.8], [33.2, -1, 2.2, 8], [-22, -1.6, 1.8, 5],
  [12, 20.2, 6, 1.6], [-7, 19.4, 7, 1.5], [-33.4, 0, 2, 5], [-28, 22, 3, 1.6], [28, 30, 2.4, 3.4],
  [10, 30.6, 3.4, 2.4], [-16, 31.4, 3.4, 2.6], [-26.8, -29.6, 3, 2.2], [3, -30.4, 4, 2],
]


export function PalmwoodGround() {
  const parts = useMemo(() => once('pw:ground', () => {
    const P = new Pieces()
    const H = PALMWOOD_HALF + 1.5
    // Earth over the arena.
    P.add(pw.earth(), flat(rect(-H, -H, H, H), GROUND_Y.earth, 6), [0, 0, 0])
    // Grass in patches (overlapping ones share material, height and world UVs: no flicker).
    const grass = pw.layer('grass', 1)
    GRASS.forEach(([x, z, rx, rz], i) => P.add(grass, flat(blob(x, z, rx, rz, 600 + i), GROUND_Y.grass, 4.5), [0, 0, 0]))
    // A grassy margin along the fence.
    for (const [ax, az, bx, bz] of [[-H, -H, H, -H + 2.2], [-H, H - 2.2, H, H], [-H, -H + 2.2, -H + 2.2, H - 2.2], [H - 2.2, -H + 2.2, H, H - 2.2]]) {
      P.add(grass, flat(rect(ax, az, bx, bz), GROUND_Y.grass, 4.5), [0, 0, 0])
    }
    // Tracks off the loop, then the loop over them.
    const track = pw.layer('track', 2)
    for (const t of TRACKS) P.add(track, ribbon(t.points, t.width, GROUND_Y.track, 9, false), [0, 0, 0])
    P.add(pw.layer('track', 3), ribbon(loopPath(1), LOOP.width, GROUND_Y.loop, 9, true), [0, 0, 0])
    // Jungle floor past the fence (round the arena, not under it).
    const far = rect(-450, -450, 450, 450)
    const hole = new Path()
    hole.moveTo(-H, H)
    hole.lineTo(H, H)
    hole.lineTo(H, -H)
    hole.lineTo(-H, -H)
    hole.closePath()
    far.holes.push(hole)
    P.add(pw.grass(), flat(far, GROUND_Y.jungle, 9), [0, 0, 0])
    return P.build()
  }), [])
  return <Merged parts={parts} shadow={false} />
}

export default PalmwoodGround
