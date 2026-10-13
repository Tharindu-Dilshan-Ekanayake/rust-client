import { useMemo } from 'react'
import { BufferGeometry, CircleGeometry, CylinderGeometry, Float32BufferAttribute, Path, RingGeometry, Shape, ShapeGeometry } from 'three'

import { CREEK, GRAVEYARD, HOLLOW_HALF, STREETS } from '../../../shared/mapHollow.js'
import { Merged } from '../acres/merge.jsx'
import { once, Pieces } from '../acres/pieces.js'
import { creekLine, GROUND_K, GROUND_Y, smooth } from './kit.js'
import { hc } from './materials.js'

/**
 * The ground of Hollow Creek: leaf-strewn lawns everywhere, Main Street and
 * the two lanes in asphalt with their sidewalks, the roundabout and its raised
 * island, the church plaza's cobbles, muddy paths through the graveyard and
 * the park, the barn yard, and the creek: dark water between mud banks,
 * passing under the lanes through culverts. Past the town, forest floor.
 *
 * Layers sit a few millimetres apart and each is depth-offset by its material
 * (hc.layer), so none of them flickers against the one under it.
 */

const H = HOLLOW_HALF

/** Flat shape (drawn in x / -z) at height `y`, UVs one tile per `tile` m. */
function flat(shape, y, tile) {
  const g = new ShapeGeometry(shape, 32)
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

/** A disc or ring round (cx, cz), UVs at world scale. */
function ring(cx, cz, r0, r1, y, tile) {
  const g = r0 > 0 ? new RingGeometry(r0, r1, 64, 1) : new CircleGeometry(r1, 64)
  const pos = g.getAttribute('position')
  const uv = g.getAttribute('uv')
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + cx) / tile, (pos.getY(i) - cz) / tile)
  g.rotateX(-Math.PI / 2)
  g.translate(cx, y, cz)
  return g
}

/**
 * A strip of `width` along a polyline of [x, z] points (u across, v along: one
 * texture length per `tile` m), lying at `y`.
 */
function ribbon(points, width, y, tile) {
  const n = points.length
  const lens = [0]
  for (let i = 1; i < n; i++) lens.push(lens[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]))
  const pos = []
  const nor = []
  const uv = []
  const idx = []
  for (let i = 0; i < n; i++) {
    const p = points[i]
    const prev = points[Math.max(0, i - 1)]
    const next = points[Math.min(n - 1, i + 1)]
    let tx = next[0] - prev[0]
    let tz = next[1] - prev[1]
    const l = Math.hypot(tx, tz) || 1
    tx /= l
    tz /= l
    const nx = tz
    const nz = -tx
    const h = width / 2
    pos.push(p[0] + nx * h, y, p[1] + nz * h, p[0] - nx * h, y, p[1] - nz * h)
    nor.push(0, 1, 0, 0, 1, 0)
    uv.push(0, lens[i] / tile, width / tile, lens[i] / tile)
    if (i > 0) {
      const a = (i - 1) * 2
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

/** Muddy paths: polylines and widths. */
const PATHS = [
  // From Main Street down through the park to the bridge, and on to the watchtower.
  { width: 1.7, points: [[-0.8, 6.0], [-1.4, 10.0], [-0.6, 14.4], [-1.2, 18.6], [-1.9, 22.4]] },
  { width: 1.6, points: [[-1.3, 29.6], [-2.6, 31.2], [-4.4, 32.0]] },
  // Graveyard: the south gate to the crypt, the west gate across.
  { width: 1.3, points: [[8.9, -23.0], [8.8, -27.4], [9.0, -31.6], [9.0, -35.2]] },
  { width: 1.1, points: [[6.4, -27.2], [8.8, -27.4]] },
  // Churchyard: the side door to the lane gate.
  { width: 1.2, points: [[-5.0, -19.0], [-8.2, -21.6], [-10.2, -26.6], [-11.6, -29.5]] },
  // The cottages' front paths to the lanes.
  { width: 1.2, points: [[-24.6, 13.6], [-21.0, 13.6]] },
  { width: 1.2, points: [[24.6, 13.6], [21.0, 13.6]] },
]

export function HollowGround() {
  const parts = useMemo(
    () =>
      once('hc:ground', () => {
        const P = new Pieces()
        const L = (name) => hc.layer(name, GROUND_K[name === 'asphalt' ? 'road' : name === 'sidewalk' || name === 'cobble' || name === 'concrete' ? 'walk' : name])
        const { main, lanes, walk, circle } = STREETS
        // Lawn over the whole town.
        P.add(hc.lawn(), flat(rect(-H - 1.5, -H - 1.5, H + 1.5, H + 1.5), GROUND_Y.lawn, 5), [0, 0, 0])

        /* ---- Mud: creek banks, paths, the barn yard ------------------------- */
        const mud = hc.layer('mud', GROUND_K.mud)
        P.add(mud, ribbon(creekLine(), CREEK.width + 2.2, GROUND_Y.mud, 3), [0, 0, 0])
        for (const p of PATHS) P.add(mud, ribbon(smooth(p.points, 2), p.width, GROUND_Y.mud, 3), [0, 0, 0])
        P.add(mud, ring(7.5, 21.0, 0, 3.6, GROUND_Y.mud, 3), [0, 0, 0])
        P.add(mud, flat(rect(5.4, 18.0, 9.6, 19.6), GROUND_Y.mud, 3), [0, 0, 0])
        P.add(mud, flat(rect(6.2, 6.0, 8.8, 8.0), GROUND_Y.mud, 3), [0, 0, 0])
        // Bare earth under the watchtower and round the pumpkin patch.
        P.add(mud, ring(-6.5, 33.4, 0, 3.0, GROUND_Y.mud, 3), [0, 0, 0])
        P.add(mud, ring(-6.8, 14.8, 0, 3.4, GROUND_Y.mud, 3), [0, 0, 0])

        /* ---- The creek ------------------------------------------------------ */
        P.add(hc.layer('water', GROUND_K.water), ribbon(creekLine(), CREEK.width, GROUND_Y.water, 4), [0, 0, 0])

        /* ---- Sidewalks, plaza, driveways ------------------------------------ */
        const sidewalk = L('sidewalk')
        P.add(sidewalk, flat(rect(-H - 1.5, main.z0 - walk, H + 1.5, main.z0), GROUND_Y.walk, 2), [0, 0, 0])
        P.add(sidewalk, flat(rect(-H - 1.5, main.z1, H + 1.5, main.z1 + walk), GROUND_Y.walk, 2), [0, 0, 0])
        for (const l of lanes) {
          P.add(sidewalk, flat(rect(l.x0 - walk, -H - 1.5, l.x0, H + 1.5), GROUND_Y.walk, 2), [0, 0, 0])
          P.add(sidewalk, flat(rect(l.x1, -H - 1.5, l.x1 + walk, H + 1.5), GROUND_Y.walk, 2), [0, 0, 0])
        }
        P.add(sidewalk, ring(0, 0, circle.r, circle.walk, GROUND_Y.walk, 2), [0, 0, 0])
        // The church plaza in cobbles, half a layer over the sidewalks: it laps
        // the ring's outer edge, and the two must not flicker where they meet.
        P.add(hc.layer('cobble', GROUND_K.plaza), flat(rect(-6.4, -17.0, 6.4, -11.4), GROUND_Y.plaza, 2.6), [0, 0, 0])
        // Driveway from the east house's garage to the lane; the west carport has its own slab.
        P.add(hc.layer('concrete', GROUND_K.walk), flat(rect(21.0, -29.8, 23.4, -24.4), GROUND_Y.walk, 2), [0, 0, 0])

        /* ---- Asphalt ---------------------------------------------------------- */
        const asphalt = hc.layer('asphalt', GROUND_K.road)
        P.add(asphalt, flat(rect(-H - 1.5, main.z0, H + 1.5, main.z1), GROUND_Y.road, 6), [0, 0, 0])
        for (const l of lanes) P.add(asphalt, flat(rect(l.x0, -H - 1.5, l.x1, H + 1.5), GROUND_Y.road, 6), [0, 0, 0])
        P.add(asphalt, ring(0, 0, 0, circle.r, GROUND_Y.road, 6), [0, 0, 0])

        /* ---- Road lines: dashed down the middles, broken at the junctions ----- */
        const line = hc.layer('roadLine', GROUND_K.line)
        const dash = (x0, z0, x1, z1) => P.add(line, flat(rect(x0, z0, x1, z1), GROUND_Y.line, 1), [0, 0, 0])
        for (let x = -H + 1; x < H - 1; x += 3.2) {
          const inJunction = Math.abs(x) < circle.r + 1.4 || lanes.some((l) => x + 1.6 > l.x0 - 1 && x < l.x1 + 1)
          if (!inJunction) dash(x, -0.06, x + 1.6, 0.06)
        }
        for (const l of lanes) {
          const cx = (l.x0 + l.x1) / 2
          for (let z = -H + 1; z < H - 1; z += 3.2) {
            if (z + 1.6 > main.z0 - walk - 0.6 && z < main.z1 + walk + 0.6) continue
            dash(cx - 0.06, z, cx + 0.06, z + 1.6)
          }
        }

        /* ---- The island: a curb ring, lawn on top ---------------------------- */
        const curb = new CylinderGeometry(circle.island, circle.island, circle.curb, 64, 1, true)
        P.add(hc.paint('#9a968c', 0.9), curb, [0, circle.curb / 2, 0])
        P.add(hc.layer('mud', GROUND_K.mud), ring(0, 0, 0, circle.island, circle.curb + 0.001, 3), [0, 0, 0])
        P.add(hc.layer('lawn', 2), ring(0, 0, 0, circle.island - 0.5, circle.curb + 0.006, 5), [0, 0, 0])

        /* ---- Graveyard: the plots' worn grass ----------------------------------- */
        const g = GRAVEYARD
        P.add(hc.layer('mud', GROUND_K.mud), flat(rect(g.x0 + 0.3, g.z0 + 0.3, g.x0 + 0.9, g.z1 - 0.3), GROUND_Y.mud, 3), [0, 0, 0])

        /* ---- Past the town: forest floor all round ------------------------------ */
        const far = rect(-400, -400, 400, 400)
        const hole = new Path()
        const E = H + 1.5
        hole.moveTo(-E, E)
        hole.lineTo(E, E)
        hole.lineTo(E, -E)
        hole.lineTo(-E, -E)
        hole.closePath()
        far.holes.push(hole)
        P.add(hc.mud(), flat(far, GROUND_Y.forest, 8), [0, 0, 0])
        return P.build()
      }),
    [],
  )
  return <Merged parts={parts} shadow={false} />
}

export default HollowGround
