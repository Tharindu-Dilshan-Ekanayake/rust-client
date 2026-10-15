import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute } from 'three'

import { CREEK, creekSection, creekWaterY, creekZ, FALL_RUN, LAKE } from '../../../shared/mapPinecrest.js'
import { once } from '../acres/pieces.js'
import { smooth } from './kit.js'
import { pc } from './materials.js'

/**
 * Pinecrest's water: the lake out past the boathouse (one sheet at its
 * level, as far as the far shore: the ground hides it everywhere else), the
 * creek running down its bed, the waterfall where the bed drops over the
 * rock step and the foam where it lands. Only the textures move (the
 * ripples drift on the lake and run downstream in the creek; the fall pours),
 * so it costs nothing but its four draws.
 */

function indexed(pos, nor, uv, idx) {
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}

function lakeGeometry() {
  const [x0, x1, z0, z1] = [-700, -40, -700, 700]
  const y = LAKE.level
  return indexed([x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1], [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], [x0 / 16, -z0 / 16, x1 / 16, -z0 / 16, x1 / 16, -z1 / 16, x0 / 16, -z1 / 16], [0, 2, 1, 0, 3, 2])
}

/** Where the creek's surface is at x (sinking into the lake at its mouth). */
function surfaceY(x) {
  const y = creekWaterY(x)
  return x > -40 ? y : y + (LAKE.level - 0.05 - y) * smooth((-40 - x) / 4)
}

/** The creek's surface from x = a down to x = b (a > b): a strip across the bed, tucked under the banks either side. */
function creekStrip(a, b, P) {
  const step = 0.5
  let along = 0
  let prev = null
  for (let x = a; x >= b - 1e-6; x -= step) {
    const z = creekZ(x)
    const dz = creekZ(x - 0.25) - creekZ(x + 0.25)
    const l = Math.hypot(0.5, dz)
    // Across the flow (it runs toward -x).
    const ax = dz / l
    const az = 0.5 / l
    const half = creekSection(x).bed + 0.9
    const y = surfaceY(x)
    if (prev) along += Math.hypot(x - prev[0], z - prev[1])
    prev = [x, z]
    const k = P.pos.length / 3
    P.pos.push(x - ax * half, y, z - az * half, x + ax * half, y, z + az * half)
    P.nor.push(0, 1, 0, 0, 1, 0)
    P.uv.push(0, along / 1.6, (half * 2) / 1.6, along / 1.6)
    if (x < a) P.idx.push(k - 2, k, k - 1, k - 1, k, k + 1)
  }
}

function creekGeometry() {
  const P = { pos: [], nor: [], uv: [], idx: [] }
  // Above the fall and below it (the fall itself is its own sheet).
  creekStrip(58, CREEK.fallX + FALL_RUN / 2 + 0.05, P)
  creekStrip(CREEK.fallX - FALL_RUN / 2 - 0.05, -46, P)
  return indexed(P.pos, P.nor, P.uv, P.idx)
}

/** The flow's direction and the line across it, at the fall. */
function fallFrame() {
  const f = CREEK.fallX
  const dz = creekZ(f - 0.5) - creekZ(f + 0.5)
  const l = Math.hypot(1, dz)
  return { d: [-1 / l, dz / l], s: [dz / l, 1 / l] }
}

/** The waterfall: a sheet over the lip, bulging out a little as it pours down the chute to the pool. */
function fallGeometry() {
  const f = CREEK.fallX
  const { d, s } = fallFrame()
  const h = FALL_RUN / 2
  const top = [f + h + 0.15, surfaceY(f + h + 0.15) + 0.03, creekZ(f + h + 0.15)]
  const foot = [f - h - 0.1, surfaceY(f - h - 0.1) + 0.02, creekZ(f - h - 0.1)]
  const half = creekSection(f).bed + 0.3
  const pos = []
  const nor = []
  const uv = []
  const idx = []
  const rows = 10
  const cols = 6
  for (let r = 0; r <= rows; r++) {
    const t = r / rows
    const bulge = Math.sin(Math.PI * t)
    const cx = top[0] + (foot[0] - top[0]) * t + d[0] * 0.15 * bulge
    const cz = top[2] + (foot[2] - top[2]) * t + d[1] * 0.15 * bulge
    const cy = top[1] + (foot[1] - top[1]) * t + 0.1 * bulge
    for (let c = 0; c <= cols; c++) {
      const u = c / cols - 0.5
      pos.push(cx + s[0] * half * 2 * u, cy, cz + s[1] * half * 2 * u)
      nor.push(d[0] * 0.7, 0.7, d[1] * 0.7)
      uv.push((c / cols) * 1.5, t * 1.2)
      if (r > 0 && c > 0) {
        const k = r * (cols + 1) + c
        idx.push(k - cols - 2, k - cols - 1, k, k - cols - 2, k, k - 1)
      }
    }
  }
  return indexed(pos, nor, uv, idx)
}

/** Foam on the pool under the fall. */
function foamGeometry() {
  const f = CREEK.fallX
  const { d, s } = fallFrame()
  const at = f - FALL_RUN / 2 - 0.9
  const c = [at, surfaceY(at) + 0.015, creekZ(at)]
  const L = 2.0
  const W = 1.7
  const corner = (a, b) => [c[0] + d[0] * L * a + s[0] * W * b, c[1], c[2] + d[1] * L * a + s[1] * W * b]
  return indexed([...corner(-1, -1), ...corner(1, -1), ...corner(1, 1), ...corner(-1, 1)], [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], [0, 0, 1, 0, 1, 1, 0, 1], [0, 1, 2, 0, 2, 3])
}

export function PinecrestWater() {
  const g = useMemo(() => once('pc:water', () => ({ lake: lakeGeometry(), creek: creekGeometry(), fall: fallGeometry(), foam: foamGeometry() })), [])
  useFrame((_, dt) => {
    const lake = pc.lake().normalMap.offset
    lake.set((lake.x + dt * 0.006) % 1, (lake.y + dt * 0.004) % 1)
    const creek = pc.creek().normalMap.offset
    creek.y = (creek.y + dt * 0.4) % 1
    const fall = pc.fall().map.offset
    fall.y = (fall.y + dt * 1.3) % 1
  })
  return (
    <group>
      <mesh geometry={g.lake} material={pc.lake()} receiveShadow />
      <mesh geometry={g.creek} material={pc.creek()} receiveShadow />
      <mesh geometry={g.fall} material={pc.fall()} />
      <mesh geometry={g.foam} material={pc.foam()} />
    </group>
  )
}

export default PinecrestWater
