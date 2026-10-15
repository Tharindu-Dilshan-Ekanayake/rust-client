import { useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute } from 'three'

import { CREEK, creekBedY, FALL_RUN, GROUND_REACH, inCreek, LAKE, onRock, pinecrestGround, TREES } from '../../../shared/mapPinecrest.js'
import { once } from '../acres/pieces.js'
import { farGroundY, gravelAt, rockUV, smooth } from './kit.js'
import { pc } from './materials.js'

/**
 * The ground of Pinecrest Lodge: the shared ground mesh (the physics walk on
 * the very same triangles), in two materials. Wherever it's steep, and over
 * the outcrops, granite; everywhere else one splatted ground: fallen leaves
 * under the trees, dry meadow grass in the open, gravel on the road, the
 * paths and the yards, and down in the creek's bed and the lake's. Vertex
 * colours darken it where it's wet and under the trees. Past the edge, a
 * coarser mesh carries on the same way: the hills, the lake bed and its far
 * shore, all of it under the woods. Three draws in all.
 */

const clamp01 = (v) => Math.min(1, Math.max(0, v))
/** Steeper than this (a face's normal's y), it's rock: the cliff, the fall's step, the outcrops' sides, the bluff. */
const ROCK_SLOPE = 0.6

/** Planar UVs, 4 m a tile (the forest floor's; the grass and gravel are scaled in the shader). */
function planarUV(pos) {
  const uv = new Float32Array((pos.length / 3) * 2)
  for (let i = 0, j = 0; i < pos.length; i += 3, j += 2) {
    uv[j] = pos[i] / 4
    uv[j + 1] = -pos[i + 2] / 4
  }
  return uv
}

function smoothNormals(pos, idx) {
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setIndex(new Uint32BufferAttribute(idx, 1))
  g.computeVertexNormals()
  const n = g.getAttribute('normal').array
  g.dispose()
  return n
}

/** Splits a mesh's triangles into rock and soil. */
function splitRock(pos, idx, isRock) {
  const rock = []
  const soil = []
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3
    const b = idx[t + 1] * 3
    const c = idx[t + 2] * 3
    const ux = pos[b] - pos[a]
    const uy = pos[b + 1] - pos[a + 1]
    const uz = pos[b + 2] - pos[a + 2]
    const vx = pos[c] - pos[a]
    const vy = pos[c + 1] - pos[a + 1]
    const vz = pos[c + 2] - pos[a + 2]
    const nx = uy * vz - uz * vy
    const ny = uz * vx - ux * vz
    const nz = ux * vy - uy * vx
    const slope = Math.abs(ny) / (Math.hypot(nx, ny, nz) || 1)
    const cx = (pos[a] + pos[b] + pos[c]) / 3
    const cz = (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3
    ;(isRock(slope, cx, cz) ? rock : soil).push(idx[t], idx[t + 1], idx[t + 2])
  }
  return { rock, soil }
}

function geometry(pos, nor, uv, idx, extra = {}) {
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  for (const [name, [array, size]] of Object.entries(extra)) g.setAttribute(name, new Float32BufferAttribute(array, size))
  g.setIndex(new Uint32BufferAttribute(idx, 1))
  g.computeBoundingSphere()
  return g
}

/** The arena's ground: the shared mesh, split into rock and soil, the soil splatted and tinted. */
function nearGround() {
  const g = pinecrestGround()
  const pos = g.positions
  const idx = g.indices
  const nor = smoothNormals(pos, idx)
  // (The hills rising at the edge are wooded, however steep.)
  // (And the fall's chute, under the water pouring down it.)
  const chute = (x, z) => Math.abs(x - CREEK.fallX) < FALL_RUN / 2 + 0.4 && inCreek(x, z, 0.3)
  const { rock, soil } = splitRock(pos, idx, (slope, x, z) => onRock(x, z) || chute(x, z) || (slope < ROCK_SLOPE && Math.max(-z, z, x) < 46.5))
  // Soil touching rock turns to scree.
  const scree = new Uint8Array(pos.length / 3)
  for (const i of rock) scree[i] = 1
  const count = pos.length / 3
  const splat = new Float32Array(count * 2)
  const color = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const x = pos[i * 3]
    const y = pos[i * 3 + 1]
    const z = pos[i * 3 + 2]
    let near = Infinity
    for (const t of TREES) near = Math.min(near, Math.hypot(t.p[0] - x, t.p[2] - z) - (t.kind === 'pine' ? 1.2 : 0))
    // Gravel on the paths and yards, the creek's bed, the lake's shore; scree by the rock.
    let gravel = gravelAt(x, z)
    const creek = inCreek(x, z)
    const wetCreek = creek ? smooth((creekBedY(x) + 0.5 - y) / 0.5) : 0
    const wetLake = smooth((LAKE.shore + 0.5 - y) / 0.6)
    gravel = Math.max(gravel, wetCreek, wetLake, scree[i] ? 0.75 : 0)
    // Grass in the open; leaves under the trees and down the banks.
    const patch = 0.35 * Math.sin(x * 0.11 + 1.3) * Math.sin(z * 0.09 + 0.4) + 0.15 * Math.sin(x * 0.31 + z * 0.23)
    // (None up the wooded hills at the edge.)
    const edge = Math.max(-z - 46, z - 46, x - 46)
    let grass = (smooth((near - 3.5) / 6) * 0.7 + patch - 0.08) * (1 - smooth(edge / 2.5))
    if (inCreek(x, z, 0.6)) grass *= 0.35
    splat[i * 2] = clamp01(grass)
    splat[i * 2 + 1] = clamp01(gravel)
    // Darker where it's wet and under the trees; broad patches lighter and darker.
    const k = (0.94 + 0.08 * Math.sin(x * 0.07 + z * 0.05) * Math.cos(z * 0.08 - x * 0.03)) * (1 - 0.38 * Math.max(wetCreek, wetLake)) * (1 - 0.16 * (1 - smooth((near - 0.6) / 3)))
    color[i * 3] = k
    color[i * 3 + 1] = k
    color[i * 3 + 2] = k * (1 + 0.04 * Math.max(wetCreek, wetLake))
  }
  // The rock's own UVs, along the way each vertex faces.
  const rockUVs = new Float32Array(count * 2)
  for (let i = 0; i < count; i++) rockUVs.set(rockUV(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]), i * 2)
  return {
    soil: geometry(pos, nor, planarUV(pos), soil, { color: [color, 3], splat: [splat, 2] }),
    rock: geometry(pos, nor, rockUVs, rock),
  }
}

/** The land past the edge: a grid 6 m apart round the arena, out to 330 m, tucked under the arena's own mesh where they overlap. */
const FAR = { step: 6, reach: 330, inner: 54 }

function farGround() {
  const n = Math.round((FAR.reach * 2) / FAR.step) + 1
  const pos = new Float32Array(n * n * 3)
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < n; k++) {
      const x = -FAR.reach + i * FAR.step
      const z = -FAR.reach + k * FAR.step
      const j = (i * n + k) * 3
      const inside = Math.abs(x) <= GROUND_REACH && Math.abs(z) <= GROUND_REACH
      pos[j] = x
      pos[j + 1] = farGroundY(x, z) - (inside ? 1 : 0)
      pos[j + 2] = z
    }
  }
  const idx = []
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < n - 1; k++) {
      const x0 = -FAR.reach + i * FAR.step
      const z0 = -FAR.reach + k * FAR.step
      // (Cells wholly under the arena's mesh are left out.)
      if (x0 >= -FAR.inner && x0 + FAR.step <= FAR.inner && z0 >= -FAR.inner && z0 + FAR.step <= FAR.inner) continue
      const a = i * n + k
      const b = (i + 1) * n + k
      idx.push(a, a + 1, b + 1, a, b + 1, b)
    }
  }
  const nor = smoothNormals(pos, idx)
  const count = n * n
  const color = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const x = pos[i * 3]
    const y = pos[i * 3 + 1]
    const z = pos[i * 3 + 2]
    const wet = smooth((LAKE.shore + 0.5 - y) / 0.6)
    // Shaded under the woods on the hills: dark, a little green with the moss and the needles, in broad patches.
    const k = 0.5 * (1 - 0.3 * wet) * (0.9 + 0.12 * Math.sin(x * 0.05 + 0.7) * Math.sin(z * 0.04 + 1.9))
    color[i * 3] = k
    color[i * 3 + 1] = k * 1.06
    color[i * 3 + 2] = k * 0.86
  }
  // (All of it wooded: no bare rock out there.)
  return geometry(pos, nor, planarUV(pos), idx, { color: [color, 3] })
}

export function PinecrestGround() {
  const g = useMemo(() => once('pc:ground', () => ({ near: nearGround(), far: farGround() })), [])
  return (
    <group>
      <mesh geometry={g.near.soil} material={pc.ground()} receiveShadow />
      {/* The outcrops and the banks below the fall throw their shadows. */}
      <mesh geometry={g.near.rock} material={pc.rock()} castShadow receiveShadow />
      <mesh geometry={g.far} material={pc.farGround()} />
    </group>
  )
}

export default PinecrestGround
