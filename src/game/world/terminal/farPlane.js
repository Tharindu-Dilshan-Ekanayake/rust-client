import { BufferGeometry, CylinderGeometry, Float32BufferAttribute } from 'three'

import { fuselageAt, PLANE, wingAt } from '../../../shared/mapTerminal.js'
import { loftGeometry, ringAngles } from './kit.js'
import { tm } from './materials.js'

/**
 * A jet for the backdrop: the same shape and livery as the one at the gate,
 * built cheaply (fewer sections, no cabin, flat wings), for the planes parked
 * at the other concourse and taxiing out past the fence. Kept apart from the
 * components (react-refresh wants component files to export only components).
 */

/** A flat tapered panel between span stations, `thick` thick (top and bottom faces and the edges). */
function wingPanel(side, root, tip, at) {
  const pos = []
  const idx = []
  // Wound so its face looks along `want`, whichever order the corners come in.
  const quad = (a, b, c, d, want) => {
    const k = pos.length / 3
    pos.push(...a, ...b, ...c, ...d)
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    if (n[0] * want[0] + n[1] * want[1] + n[2] * want[2] >= 0) idx.push(k, k + 1, k + 2, k, k + 2, k + 3)
    else idx.push(k, k + 2, k + 1, k, k + 3, k + 2)
  }
  const s0 = at(root)
  const s1 = at(tip)
  const x0 = side * root
  const x1 = side * tip
  const top = (s, x) => [
    [x, s.top, s.le],
    [x, s.top, s.te],
  ]
  const bot = (s, x) => [
    [x, s.top - s.thick, s.le],
    [x, s.top - s.thick, s.te],
  ]
  const [t0le, t0te] = top(s0, x0)
  const [t1le, t1te] = top(s1, x1)
  const [b0le, b0te] = bot(s0, x0)
  const [b1le, b1te] = bot(s1, x1)
  quad(t0le, t1le, t1te, t0te, [0, 1, 0])
  quad(b0le, b0te, b1te, b1le, [0, -1, 0])
  quad(t0le, b0le, b1le, t1le, [0, 0, -1])
  quad(t0te, t1te, b1te, b0te, [0, 0, 1])
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Adds a backdrop jet to `P` in the gate jet's own frame (nose towards -z, centreline x = 0). */
export function addFarPlane(P) {
  const zs = []
  for (let i = 0; i <= 6; i++) zs.push(PLANE.nose + (PLANE.body0 - PLANE.nose) * (1 - Math.cos((i / 6) * (Math.PI / 2))))
  for (let z = PLANE.body0 + 4; z < PLANE.body1; z += 4) zs.push(z)
  for (let i = 0; i <= 6; i++) zs.push(PLANE.body1 + (PLANE.tail - PLANE.body1) * Math.sin((i / 6) * (Math.PI / 2)))
  const stations = [...new Set(zs.map((z) => +z.toFixed(3)))].sort((a, b) => a - b).map((z) => ({ z, ...fuselageAt(z) }))
  P.add(tm.livery(), loftGeometry(stations, ringAngles(20), { uz0: PLANE.nose, uz1: PLANE.tail }), [0, 0, 0])
  const skin = tm.paint('#d9dcdf', 0.4, 0.3)
  for (const side of [-1, 1]) {
    P.add(skin, wingPanel(side, PLANE.wing.root, PLANE.wing.tip, wingAt), [0, 0, 0])
    const e = PLANE.engine
    P.add(tm.paint('#eef0f2', 0.35, 0.2), new CylinderGeometry(e.r, e.r * 0.85, e.z1 - e.z0, 14), [side * e.x, e.y, (e.z0 + e.z1) / 2], [Math.PI / 2, 0, 0])
    // Tailplane: a small flat panel.
    const tp = PLANE.tailplane
    const at = (d) => {
      const f = (d - tp.root) / (tp.tip - tp.root)
      return { le: tp.le[0] + (tp.le[1] - tp.le[0]) * f, te: tp.te[0] + (tp.te[1] - tp.te[0]) * f, top: tp.y + tp.thick[0] / 2, thick: tp.thick[0] }
    }
    P.add(skin, wingPanel(side, tp.root, tp.tip, at), [0, 0, 0])
    // Main gear.
    P.add(tm.rubber(), new CylinderGeometry(0.6, 0.6, 0.8, 10), [side * PLANE.mainGear.x, 0.6, PLANE.mainGear.z], [0, 0, Math.PI / 2])
  }
  // The fin, its mark on both sides.
  const f = PLANE.fin
  const fin = new BufferGeometry()
  const pos = []
  const uv = []
  const pts = [
    [f.root[0], f.y0],
    [f.root[1], f.y0],
    [f.tipZ[1], f.y1],
    [f.tipZ[0], f.y1],
  ]
  const zMin = f.root[0]
  const zMax = f.tipZ[1]
  for (const s of [-1, 1]) for (const [z, y] of pts) {
    pos.push((s * f.thick) / 3, y, z)
    uv.push((z - zMin) / (zMax - zMin), (y - f.y0) / (f.y1 - f.y0))
  }
  fin.setAttribute('position', new Float32BufferAttribute(pos, 3))
  fin.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  // Left face (points 0-3) looks -x, right face (4-7) +x.
  fin.setIndex([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6])
  fin.computeVertexNormals()
  P.add(tm.fin(), fin, [0, 0, 0])
  P.add(tm.rubber(), new CylinderGeometry(0.45, 0.45, 0.6, 10), [0, 0.45, PLANE.noseGear.z], [0, 0, Math.PI / 2])
}
