import { Quaternion, Vector3 } from 'three'

import { boxGeo } from '../materials.js'
import { pw } from './materials.js'

/** Ground layer heights: a few centimetres apart, each also depth-offset by its material (pw.layer). */
export const GROUND_Y = { jungle: -0.02, earth: 0, grass: 0.012, track: 0.02, loop: 0.026, floor: 0.036 }

const _q = new Quaternion()
const _x = new Vector3()
const _y = new Vector3()

/**
 * Corrugated sheets laid on a tilted slab (from rampBox), in strips ~0.9 m wide
 * of mixed colours, alternate strips lifted a hair so the laps never flicker.
 */
export function addSheets(P, slab, colors, rand, width = 0.9) {
  const [W, T, L] = slab.size
  const n = Math.max(1, Math.round(W / width))
  const sw = W / n
  _q.set(slab.q[0], slab.q[1], slab.q[2], slab.q[3])
  _x.set(1, 0, 0).applyQuaternion(_q)
  _y.set(0, 1, 0).applyQuaternion(_q)
  for (let i = 0; i < n; i++) {
    const off = -W / 2 + sw * (i + 0.5)
    const lift = (i % 2) * 0.012
    const color = colors[Math.floor(rand() * colors.length)]
    const p = [slab.p[0] + _x.x * off + _y.x * lift, slab.p[1] + _x.y * off + _y.y * lift, slab.p[2] + _x.z * off + _y.z * lift]
    P.add(pw.tin(color), boxGeo(sw + 0.04, T, L, 1.6), p, _q.clone())
  }
}

