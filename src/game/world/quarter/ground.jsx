import { useMemo } from 'react'
import { Path, Shape, ShapeGeometry } from 'three'

import { QUARTER_HALF, STREETS } from '../../../shared/mapQuarter.js'
import { Merged } from '../acres/merge.jsx'
import { once, Pieces } from '../acres/pieces.js'
import { GROUND_K, GROUND_Y } from './kit.js'
import { oq } from './materials.js'

/**
 * The ground of Old Quarter: dusty earth over the whole town, stone paving on
 * the pavements and in the courtyards, and asphalt on Market Street, the east
 * lane and the car park. Past the wall, more dust.
 *
 * Layer heights a few millimetres apart, each depth-offset by its material
 * (oq.layer), so none of them flickers against the one below. Pieces of one
 * layer that meet or overlap share material, height and world UVs.
 */

/** Flat shape (drawn in x / -z) laid on the ground at height `y`, UVs one tile per `tile` m. */
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

export function QuarterGround() {
  const parts = useMemo(
    () =>
      once('oq:ground', () => {
        const P = new Pieces()
        const H = QUARTER_HALF + 1.5
        const { main, east } = STREETS
        P.add(oq.dust(), flat(rect(-H, -H, H, H), GROUND_Y.dust, 6), [0, 0, 0])

        /* ---- Paving: the pavements along Market Street, the courtyards ------- */
        const paving = oq.layer('paving', GROUND_K.paving)
        for (const [x0, z0, x1, z1] of [
          [-H, main.z1, H, main.z1 + 3.0],
          [-H, main.z0 - 1.4, H, main.z0],
          [-6.0, 20.0, 6.0, 29.0],
          [-27.0, -37.0, -22.4, -27.7],
          [-12.0, -28.0, 6.0, -26.4],
          [24.0, -29.0, 37.0, -27.0],
        ]) {
          P.add(paving, flat(rect(x0, z0, x1, z1), GROUND_Y.paving, 3), [0, 0, 0])
        }

        /* ---- Asphalt: Market Street, the east lane, the car park ------------- */
        const asphalt = oq.layer('asphalt', GROUND_K.asphalt)
        for (const [x0, z0, x1, z1] of [
          [-H, main.z0, H, main.z1],
          [east.x0, -H, east.x1, main.z0],
          [22.4, 29.6, 39.6, 39.6],
        ]) {
          P.add(asphalt, flat(rect(x0, z0, x1, z1), GROUND_Y.asphalt, 8), [0, 0, 0])
        }

        /* ---- Past the wall ------------------------------------------------------ */
        const far = rect(-450, -450, 450, 450)
        const hole = new Path()
        hole.moveTo(-H, H)
        hole.lineTo(H, H)
        hole.lineTo(H, -H)
        hole.lineTo(-H, -H)
        hole.closePath()
        far.holes.push(hole)
        P.add(oq.dust(), flat(far, GROUND_Y.forest, 9), [0, 0, 0])
        return P.build()
      }),
    [],
  )
  return <Merged parts={parts} shadow={false} />
}

export default QuarterGround
