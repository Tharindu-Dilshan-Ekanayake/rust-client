import { useMemo } from 'react'
import { PlaneGeometry } from 'three'

import { TB, TERMINAL_HALF } from '../../../shared/mapTerminal.js'
import { Merged } from '../acres/merge.jsx'
import { once, Pieces } from '../acres/pieces.js'
import { GROUND_Y } from './kit.js'
import { tm } from './materials.js'
import { signUV } from './textures.js'

/**
 * The ground: the apron's concrete slabs (5 m each) over the whole arena, the
 * kerbside road and pavement outside the terminal's west end; and the paint
 * on the apron: the taxilane and the stand's lead-in line curving in to the
 * nose, the stop bar, the stand number, the red line round the stand, the
 * hatched box under the jet bridge, the service road's lines and arrows.
 *
 * Each layer sits a few millimetres over the last (and its material is
 * depth-offset too), and no two colours of paint ever overlap, so nothing
 * flickers.
 */

const H = TERMINAL_HALF

function buildGround() {
  const P = new Pieces()
  const S = (H + 4) * 2
  const g = new PlaneGeometry(S, S)
  const uv = g.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * S) / 5, (uv.getY(i) * S) / 5)
  P.add(tm.tarmac(), g.rotateX(-Math.PI / 2), [0, GROUND_Y.tarmac, 0])
  // The kerbside road outside the west end, the pavement along the terminal, a kerb between.
  const west = TB.x0
  P.aabb(tm.layer('asphalt', 1), -H, 0, TB.z0, west - 2.6, GROUND_Y.asphalt, TB.z1 - 0.2, 4)
  P.aabb(tm.layer('concrete', 1, '#bdbab2'), west - 2.6, 0, TB.z0, west, GROUND_Y.asphalt + 0.004, TB.z1 - 0.2, 2)
  P.aabb(tm.concrete('#d0cdc4'), west - 2.75, 0, TB.z0, west - 2.55, 0.1, TB.z1 - 0.2, 1)
  // Bollards along the kerb.
  for (let z = TB.z0 + 2; z < TB.z1 - 1; z += 2.4) P.box(tm.paint('#3a3c40', 0.5, 0.4), west - 2.3, 0.45, z, 0.16, 0.9, 0.16, 1)
  return P.build()
}

export function TerminalGround() {
  const parts = useMemo(() => once('tm:ground', buildGround), [])
  return <Merged parts={parts} shadow={false} />
}

/* ---------------------------------------------------------------------------
 * Paint
 * ------------------------------------------------------------------------- */

const YELLOW = '#e8b42a'
const RED = '#c0392b'
const WHITE = '#eeeeea'

/** A painted stripe from a to b ([x, z]), `w` wide. */
function stripe(P, material, a, b, w) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  if (len < 1e-3) return
  const yaw = Math.atan2(-(b[1] - a[1]), b[0] - a[0])
  P.box(material, (a[0] + b[0]) / 2, GROUND_Y.paint / 2, (a[1] + b[1]) / 2, len + w * 0.02, GROUND_Y.paint, w, 1, [0, yaw, 0])
}

/** A dashed stripe: `dash` painted, `gap` bare. */
function dashed(P, material, a, b, w, dash, gap) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const ux = (b[0] - a[0]) / len
  const uz = (b[1] - a[1]) / len
  for (let d = 0; d < len; d += dash + gap) {
    const e = Math.min(len, d + dash)
    stripe(P, material, [a[0] + ux * d, a[1] + uz * d], [a[0] + ux * e, a[1] + uz * e], w)
  }
}

/** A curve of stripes round `c` from angle a0 to a1 at radius r. */
function arc(P, material, c, r, a0, a1, w, n = 14) {
  for (let i = 0; i < n; i++) {
    const t0 = a0 + ((a1 - a0) * i) / n
    const t1 = a0 + ((a1 - a0) * (i + 1)) / n
    stripe(P, material, [c[0] + r * Math.cos(t0), c[1] + r * Math.sin(t0)], [c[0] + r * Math.cos(t1), c[1] + r * Math.sin(t1)], w)
  }
}

/** A stencil from the sign atlas painted flat on the apron, its top towards `yaw` (0 = north). */
function stencil(P, name, x, z, size, yaw, tint) {
  const g = new PlaneGeometry(size, size)
  const [u0, v0, u1, v1] = signUV(name)
  const uv = g.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + (u1 - u0) * uv.getX(i), v0 + (v1 - v0) * uv.getY(i))
  g.rotateX(-Math.PI / 2)
  g.rotateY(yaw)
  P.add(tm.stencil(tint), g, [x, GROUND_Y.paint + 0.002, z])
}

function buildMarkings() {
  const P = new Pieces()
  const yellow = tm.paintLine(YELLOW)
  const red = tm.paintLine(RED)
  const white = tm.paintLine(WHITE)

  // The taxilane along the south of the apron, and the stand's lead-in up to the nose (with a curve in from the east).
  stripe(P, yellow, [-H, 46], [H, 46], 0.2)
  stripe(P, yellow, [0, 45.9], [0, -12.6], 0.2)
  arc(P, yellow, [10, 36], 10, Math.PI, Math.PI / 2, 0.2)
  // The stop bar where the nose gear stands, and the alignment bar ahead of it.
  stripe(P, yellow, [-1.4, -12.9], [1.4, -12.9], 0.35)
  stripe(P, yellow, [-0.6, -15.2], [0.6, -15.2], 0.2)
  // The stand number beside the lead-in.
  stencil(P, 'stand', -3.4, 40.5, 4.0, 0, YELLOW)

  // The red line round the stand (broken where the lead-in crosses it).
  const [x0, x1, z0, z1] = [-24, 24, -17.4, 35.6]
  // (Its north side also broken round the hatched box under the jet bridge.)
  stripe(P, red, [x0, z0], [-9.0, z0], 0.15)
  stripe(P, red, [-3.2, z0], [-0.5, z0], 0.15)
  stripe(P, red, [0.5, z0], [x1, z0], 0.15)
  stripe(P, red, [x0, z1], [-0.5, z1], 0.15)
  stripe(P, red, [0.5, z1], [x1, z1], 0.15)
  stripe(P, red, [x0, z0], [x0, z1], 0.15)
  stripe(P, red, [x1, z0], [x1, z1], 0.15)

  // The hatched box under the jet bridge (no parking), with its border.
  const hx0 = -8.8
  const hx1 = -3.4
  const hz0 = -19.6
  const hz1 = -10.4
  const hatch = new PlaneGeometry(hx1 - hx0, hz1 - hz0)
  const huv = hatch.getAttribute('uv')
  for (let i = 0; i < huv.count; i++) huv.setXY(i, (huv.getX(i) * (hx1 - hx0)) / 1.6, (huv.getY(i) * (hz1 - hz0)) / 1.6)
  hatch.rotateX(-Math.PI / 2)
  P.add(tm.hatch(YELLOW), hatch, [(hx0 + hx1) / 2, GROUND_Y.paint / 2, (hz0 + hz1) / 2])
  stripe(P, yellow, [hx0, hz0], [hx1, hz0], 0.15)
  stripe(P, yellow, [hx0, hz1], [hx1, hz1], 0.15)
  stripe(P, yellow, [hx0, hz0 + 0.075], [hx0, hz1 - 0.075], 0.15)
  stripe(P, yellow, [hx1, hz0 + 0.075], [hx1, hz1 - 0.075], 0.15)

  // The service road along the south edge: edge lines, a dashed middle, arrows.
  stripe(P, white, [-H, 47.6], [H, 47.6], 0.15)
  stripe(P, white, [-H, 55.0], [H, 55.0], 0.15)
  dashed(P, white, [-H, 51.3], [H, 51.3], 0.12, 3, 3)
  stencil(P, 'arrow', -24, 49.5, 2.2, -Math.PI / 2, WHITE)
  stencil(P, 'arrow', 24, 53.1, 2.2, Math.PI / 2, WHITE)
  // Parking boxes for the equipment beside the terminal.
  for (const [cx, cz, w, d] of [[-27.0, -13.0, 8.0, 4.4], [22.4, -13.0, 7.2, 4.4], [-40.6, 6.0, 6.4, 4.8], [35.8, 17.0, 6.4, 4.4]]) {
    const a = [cx - w / 2, cz - d / 2]
    const b = [cx + w / 2, cz + d / 2]
    stripe(P, white, [a[0], a[1]], [b[0], a[1]], 0.12)
    stripe(P, white, [a[0], b[1]], [b[0], b[1]], 0.12)
    stripe(P, white, [a[0], a[1] + 0.06], [a[0], b[1] - 0.06], 0.12)
    stripe(P, white, [b[0], a[1] + 0.06], [b[0], b[1] - 0.06], 0.12)
  }
  // The kerbside road: a dashed white line down the middle, a zebra crossing to the doors.
  dashed(P, white, [-51.3, TB.z0 + 1], [-51.3, TB.z1 - 1], 0.12, 2, 2)
  for (let x = -55.6; x < -46.8; x += 0.9) stripe(P, white, [x, -35.0], [x + 0.45, -35.0], 2.6)
  return P.build()
}

export function Markings() {
  const parts = useMemo(() => once('tm:markings', buildMarkings), [])
  return <Merged parts={parts} shadow={false} />
}
