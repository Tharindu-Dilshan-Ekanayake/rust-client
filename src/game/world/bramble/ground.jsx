import { useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute, Path, Shape, ShapeGeometry } from 'three'

import { BRAMBLE_HALF, brambleGround, BRIDGE, CREEK, creekSection, FIELD, puddleLevel, ROADS, smoothLine } from '../../../shared/mapBramble.js'
import { Merged } from '../acres/merge.jsx'
import { once, Pieces } from '../acres/pieces.js'
import { GROUND_K, GROUND_Y } from './kit.js'
import { br } from './materials.js'

/**
 * The ground of Bramblewood: the shared ground mesh (the physics walk on the
 * very same triangles), wild grass on the flat and over the creek's lips,
 * bare earth down its banks and dry cracked mud along its bed, with water
 * lying in the dips; the field's old furrows and the rutted dirt road and
 * tracks on top. Past the wall, more grass.
 *
 * The flat layers sit a few millimetres apart, each depth-offset by its
 * material (br.layer). The roads cross each other, and their ruts follow each
 * one's curve, so each road is its own layer; the farm track stops at the
 * bridge's deck.
 */

function flat(shape, y, tile) {
  const g = new ShapeGeometry(shape, 12)
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

function indexed(pos, nor, uv, idx) {
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

/** A strip `width` wide along a polyline: u across (0..1), v along (one tile per `tile` m). */
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
    const h = width / 2
    pos.push(p[0] + tz * h, y, p[1] - tx * h, p[0] - tz * h, y, p[1] + tx * h)
    nor.push(0, 1, 0, 0, 1, 0)
    uv.push(0, lens[i] / tile, 1, lens[i] / tile)
    if (i > 0) {
      const a = (i - 1) * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  return indexed(pos, nor, uv, idx)
}

/** A polyline cut into the runs that stay off a rectangle (resampled finely, so each run ends right at its edge). */
function clipOff(points, r, step = 0.1) {
  const runs = [[]]
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i]
    const [bx, bz] = points[i + 1]
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step))
    for (let k = i === 0 ? 0 : 1; k <= n; k++) {
      const x = ax + ((bx - ax) * k) / n
      const z = az + ((bz - az) * k) / n
      if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) {
        if (runs[runs.length - 1].length) runs.push([])
      } else runs[runs.length - 1].push([x, z])
    }
  }
  return runs.filter((run) => run.length > 1)
}

/** The shared ground mesh, one geometry per surface, normals smoothed across all of it, UVs from above. */
function groundSurfaces() {
  const g = brambleGround()
  const pos = Array.from(g.positions)
  const all = [...g.grass, ...g.bank, ...g.bed]
  const whole = new BufferGeometry()
  whole.setAttribute('position', new Float32BufferAttribute(pos, 3))
  whole.setIndex(all)
  whole.computeVertexNormals()
  const nor = Array.from(whole.getAttribute('normal').array)
  whole.dispose()
  const planar = (tile) => {
    const uv = []
    for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] / tile, -pos[i + 2] / tile)
    return uv
  }
  return [
    [br.grass(), indexed(pos, nor, planar(4.5), g.grass)],
    [br.bank(), indexed(pos, nor, planar(3), g.bank)],
    [br.creekBed(), indexed(pos, nor, planar(4), g.bed)],
  ]
}

/** Water lying in the bed's dips: flat sheets across the bed, showing only where it sinks below them. */
function puddle([a, b]) {
  const y = puddleLevel([a, b])
  const pts = []
  for (let x = a - 1.5; x <= b + 1.5 + 1e-6; x += 0.5) {
    const s = creekSection(x)
    pts.push([x, s.z - s.shift])
  }
  return ribbon(pts, CREEK.bed + 0.6, y, 4)
}

export function BrambleGround() {
  const parts = useMemo(
    () =>
      once('br:ground', () => {
        const P = new Pieces()
        const H = BRAMBLE_HALF + 1.5
        for (const [m, g] of groundSurfaces()) P.add(m, g, [0, 0, 0])
        for (const p of CREEK.puddles) P.add(br.water(), puddle(p), [0, 0, 0])
        // The field.
        P.add(br.layer('furrows', GROUND_K.field), flat(rect(FIELD.x0, FIELD.z0, FIELD.x1, FIELD.z1), GROUND_Y.field, 8), [0, 0, 0])
        // The roads and tracks, each its own layer (they cross), off the bridge.
        ROADS.forEach((r, i) => {
          for (const run of clipOff(smoothLine(r.points, 2), BRIDGE)) P.add(br.layer('track', GROUND_K.track + i), ribbon(run, r.width, GROUND_Y.track + i * 0.004, 9), [0, 0, 0])
        })
        // Past the wall.
        const far = rect(-450, -450, 450, 450)
        const hole = new Path()
        hole.moveTo(-H, H)
        hole.lineTo(H, H)
        hole.lineTo(H, -H)
        hole.lineTo(-H, -H)
        hole.closePath()
        far.holes.push(hole)
        P.add(br.grass(), flat(far, GROUND_Y.forest, 9), [0, 0, 0])
        return P.build()
      }),
    [],
  )
  return <Merged parts={parts} shadow={false} />
}

export default BrambleGround
