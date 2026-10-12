import { useMemo } from 'react'
import { ExtrudeGeometry, Path, Quaternion, Shape, ShapeGeometry } from 'three'

import { ACRES_HALF, POOL, STREET } from '../../../shared/mapAcres.js'
import { rampBox } from '../../../shared/mapKit.js'
import { seededRandom } from '../../../shared/math.js'
import { boxGeo } from '../materials.js'
import { acres } from './materials.js'
import { Merged } from './merge.jsx'
import { once, Pieces } from './pieces.js'

/**
 * Layer heights (a few centimetres apart: feet can't tell, the depth buffer can),
 * each also depth-offset by its material (acres.layer).
 */
const Y = { desert: -0.02, lawn: 0, dirt: 0.02, asphalt: 0.03, slab: 0.035, line: 0.04 }

/**
 * The ground of Atomic Acres: mown lawns, the asphalt cul-de-sac and the road
 * out, raised sidewalks with their curbs, driveways and paths, the pool sunk
 * into its deck, dusty lots toward the edges and the desert beyond.
 *
 * Shapes are drawn in the x / -z plane and laid flat (shape y = -world z).
 */

/** Flat shape geometry laid on the ground at height `y`, UVs one tile per `tile` m. */
function flat(shape, y, tile) {
  const g = new ShapeGeometry(shape, 48)
  scaleUv(g, tile)
  g.rotateX(-Math.PI / 2)
  g.translate(0, y, 0)
  return g
}

/** A shape extruded up by `depth` from `y` (walls of its own: curbs). */
function raised(shape, y, depth, tile) {
  const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 48 })
  scaleUv(g, tile)
  g.rotateX(-Math.PI / 2)
  g.translate(0, y, 0)
  return g
}

function scaleUv(g, tile) {
  const uv = g.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / tile, uv.getY(i) / tile)
}

/** Axis-aligned rectangle as a shape (world x0..x1, z0..z1). */
function rect(x0, z0, x1, z1) {
  const s = new Shape()
  s.moveTo(x0, -z0)
  s.lineTo(x1, -z0)
  s.lineTo(x1, -z1)
  s.lineTo(x0, -z1)
  s.closePath()
  return s
}

/** Irregular blob (a dusty patch) round (x, z). */
function blob(x, z, r, seed) {
  const rand = seededRandom(seed)
  const s = new Shape()
  const n = 18
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const k = r * (0.72 + rand() * 0.4)
    const px = x + Math.cos(a) * k
    const pz = z + Math.sin(a) * k
    if (i === 0) s.moveTo(px, -pz)
    else s.lineTo(px, -pz)
  }
  s.closePath()
  return s
}

/** The asphalt: the circle and the road south out of it, as one outline. */
function streetShape() {
  const { r, road } = STREET
  const zMouth = Math.sqrt(r * r - road.x * road.x)
  const s = new Shape()
  s.moveTo(road.x, -zMouth)
  s.lineTo(road.x, -road.z1)
  s.lineTo(-road.x, -road.z1)
  s.lineTo(-road.x, -zMouth)
  // Round the circle the long way, from the road's west edge to its east edge.
  const a0 = Math.atan2(-zMouth, -road.x)
  const a1 = Math.atan2(-zMouth, road.x)
  s.absarc(0, 0, r, a0, a1 + Math.PI * 2, true)
  s.closePath()
  return s
}

/** Sidewalk ring round the circle, open where the road leaves it. */
function ringWalkShape() {
  const { r, walk, road } = STREET
  const inner = r
  const outer = walk
  const ai = Math.asin(road.x / inner)
  const ao = Math.asin(road.walk / outer)
  // Shape angle of "south" (world +z) is -90°.
  const s = new Shape()
  const start = -Math.PI / 2 + ao
  const end = -Math.PI / 2 - ao + Math.PI * 2
  s.absarc(0, 0, outer, start, end, false)
  s.lineTo(Math.cos(-Math.PI / 2 - ai) * inner, Math.sin(-Math.PI / 2 - ai) * inner)
  s.absarc(0, 0, inner, -Math.PI / 2 - ai + Math.PI * 2, -Math.PI / 2 + ai, true)
  s.closePath()
  return s
}

export function AcresGround() {
  const parts = useMemo(() => once('acres:ground', () => {
    const P = new Pieces()
    const H = ACRES_HALF + 1.5
    const { x0, x1, z0, z1, floor } = POOL

    // Lawn over the whole arena, with the pool cut out.
    const lawn = rect(-H, -H, H, H)
    const hole = new Path()
    hole.moveTo(x0, -z0)
    hole.lineTo(x0, -z1)
    hole.lineTo(x1, -z1)
    hole.lineTo(x1, -z0)
    hole.closePath()
    lawn.holes.push(hole)
    P.add(acres.grass(), flat(lawn, Y.lawn, 4.5), [0, 0, 0])

    // Dusty lots toward the edges and a dirt margin along the fence.
    // (Patches overlapping each other share material, height and world-space UVs: no flicker.)
    const dirt = acres.layer('dirt', 1)
    for (const [x, z, r, seed] of [[-31, -31, 10, 1], [35, -37, 7, 2], [-36, 36, 6, 3], [37, 36, 5, 4], [-8, -38, 5, 5], [24, 38, 4.5, 6], [-24, -19, 3.5, 7]]) {
      P.add(dirt, flat(blob(x, z, r, seed), Y.dirt, 6), [0, 0, 0])
    }
    for (const [ax, az, bx, bz] of [[-H, -H, H, -H + 2.4], [-H, H - 2.4, H, H], [-H, -H, -H + 2.4, H], [H - 2.4, -H, H, H]]) {
      P.add(dirt, flat(rect(ax, az, bx, bz), Y.dirt, 6), [0, 0, 0])
    }

    // Street, its centre line, and the sidewalks (raised, so their edges are the curbs).
    P.add(acres.layer('asphalt', 2), flat(streetShape(), Y.asphalt, 7), [0, 0, 0])
    const line = acres.layer('roadLine', 4)
    for (let z = STREET.r + 2; z < 33; z += 3) {
      for (const x of [-0.09, 0.09]) P.add(line, flat(rect(x - 0.05, z - 0.8, x + 0.05, z + 0.8), Y.line, 1), [0, 0, 0])
    }
    const walk = acres.sidewalk()
    P.add(walk, raised(ringWalkShape(), 0, 0.1, 1.5), [0, 0, 0])
    // The road's walks start on the same slanted line the ring's ends stop on,
    // so the two never overlap.
    const { road, r: inR, walk: outR } = STREET
    const zIn = Math.sqrt(inR * inR - road.x * road.x)
    const zOut = Math.sqrt(outR * outR - road.walk * road.walk)
    for (const s of [-1, 1]) {
      const strip = new Shape()
      strip.moveTo(s * road.x, -zIn)
      strip.lineTo(s * road.walk, -zOut)
      strip.lineTo(s * road.walk, -road.z1)
      strip.lineTo(s * road.x, -road.z1)
      strip.closePath()
      P.add(walk, raised(strip, 0, 0.1, 1.5), [0, 0, 0])
    }

    // Driveways, front walks, patios.
    const concrete = acres.layer('concrete', 3)
    const slabs = [
      [-19.4, 5.6, -11.4, 10.8], // yellow carport drive
      [-19.0, -1.9, -14.1, -0.1], // yellow front walk
      [11.0, -12.0, 19.4, -6.2], // green garage drive
      [14.1, 0.1, 19.0, 1.9], // green front walk
      [-15.0, 24.4, -6.6, 26.0], // cottage walk
      [-11.0, 26.6, -6.6, 32.0], // cottage drive
      [13.6, -25.0, 27.6, -22.9], // orange house terrace
      [-33.2, 0.2, -30.0, 4.2], // yellow back patio
      [30.0, -3.4, 33.4, 0.8], // green back patio
      [25.6, 23.4, 32.6, 24.0], // pool house step
    ]
    for (const [ax, az, bx, bz] of slabs) P.add(concrete, flat(rect(ax, az, bx, bz), Y.slab, 2), [0, 0, 0])

    // Pool deck and coping round the hole; inside: tiled walls, floor and steps.
    const deck = rect(x0 - 2.2, z0 - 2.0, x1 + 2.2, z1 + 2.0)
    const deckHole = new Path()
    deckHole.moveTo(x0 - 0.3, -(z0 - 0.3))
    deckHole.lineTo(x0 - 0.3, -(z1 + 0.3))
    deckHole.lineTo(x1 + 0.3, -(z1 + 0.3))
    deckHole.lineTo(x1 + 0.3, -(z0 - 0.3))
    deckHole.closePath()
    deck.holes.push(deckHole)
    P.add(concrete, flat(deck, Y.slab, 2), [0, 0, 0])
    const coping = acres.curb()
    P.aabb(coping, x0 - 0.3, 0, z0 - 0.3, x1 + 0.3, 0.05, z0, 1)
    P.aabb(coping, x0 - 0.3, 0, z1, x1 + 0.3, 0.05, z1 + 0.3, 1)
    P.aabb(coping, x0 - 0.3, 0, z0, x0, 0.05, z1, 1)
    P.aabb(coping, x1, 0, z0, x1 + 0.3, 0.05, z1, 1)
    const tile = acres.tile()
    P.aabb(tile, x0, floor - 0.02, z0, x1, floor, z1, 1)
    P.aabb(tile, x0 - 0.05, floor, z0, x0, 0, z1, 1)
    P.aabb(tile, x1, floor, z0, x1 + 0.05, 0, z1, 1)
    P.aabb(tile, x0, floor, z0 - 0.05, x1, 0, z0, 1)
    P.aabb(tile, x0, floor, z1, x1, 0, z1 + 0.05, 1)
    const st = POOL.steps
    const ramp = rampBox([x0 - 0.05, 0, st.z], [x0 + st.run, floor, st.z], st.width, 0.2)
    P.add(tile, boxGeo(ramp.size[0], ramp.size[1], ramp.size[2], 1), ramp.p, quat(ramp.q))
    // A puddle of rainwater in the deep end.
    P.add(acres.layer('water', 1), flat(rect(x1 - 2.6, z0 + 0.2, x1 - 0.1, z1 - 0.2), floor + 0.03, 2), [0, 0, 0])
    // Pool ladder at the deep end.
    const chrome = acres.chrome()
    for (const dz of [-0.3, 0.3]) P.box(chrome, x1 - 0.12, (floor + 0.9) / 2, (z0 + z1) / 2 + dz, 0.05, 0.9 - floor, 0.05, 1)

    // The desert past the fence (round the lawn, not under it: the pool is sunk below).
    const desert = rect(-450, -450, 450, 450)
    const inner = new Path()
    inner.moveTo(-H, H)
    inner.lineTo(H, H)
    inner.lineTo(H, -H)
    inner.lineTo(-H, -H)
    inner.closePath()
    desert.holes.push(inner)
    P.add(acres.dirt(), flat(desert, Y.desert, 10), [0, 0, 0])
    return P.build()
  }), [])
  return <Merged parts={parts} shadow={false} />
}

const quat = (q) => new Quaternion(q[0], q[1], q[2], q[3])

export default AcresGround
