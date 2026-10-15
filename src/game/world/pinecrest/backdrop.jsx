import { BufferGeometry, Float32BufferAttribute } from 'three'

import { LAKE, PINECREST_HALF, shoreX } from '../../../shared/mapPinecrest.js'
import { seededRandom } from '../../../shared/math.js'
import { once, Pieces } from '../acres/pieces.js'
import { addBirch, addPine, farGroundY } from './kit.js'
import { pc } from './materials.js'

/**
 * What you see past the edge of Pinecrest: the woods on the hills round
 * three sides (real trees close in, a band of silhouettes behind them), the
 * lake running off north and south with the far shore's woods across it, and
 * snow-capped mountains all round, blue with distance.
 */

const geometry = (pos, uv, idx) => {
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Texture v by height: the same for every peak, so the snow lies down to one line (see mountainTexture). */
const V_BASE = -10
const V_TOP = 220

/**
 * A mountain at (cx, cz): a cone roughened into ridges and gullies, peaking
 * `h` high, `R` round its foot, which is sunk well down. In world space, and
 * wherever it reaches in over the land past the edge it's kept under that
 * land, so only its upper slopes show, rising from behind the woods.
 */
const FOOT = -60
/** Out to here the land past the edge is drawn (see ground.jsx). */
const LAND = 330
function mountainGeometry(rand, R, h, cx, cz) {
  const segs = 28
  const rings = 7
  const phase = [rand() * 6, rand() * 6, rand() * 6]
  const pos = []
  const uv = []
  const idx = []
  // Peak first, then rings out to the foot.
  pos.push(cx, h, cz)
  uv.push(0.5, (h - V_BASE) / (V_TOP - V_BASE))
  for (let r = 1; r <= rings; r++) {
    const f = r / rings
    for (let s = 0; s <= segs; s++) {
      const a = (s / segs) * Math.PI * 2
      const ridge = 1 + 0.22 * Math.sin(a * 3 + phase[0]) + 0.12 * Math.sin(a * 7 + phase[1]) + 0.06 * Math.sin(a * 13 + phase[2])
      const d = R * f * ridge * (0.92 + rand() * 0.16)
      const x = cx + Math.cos(a) * d
      const z = cz + Math.sin(a) * d
      let y = FOOT + (h - FOOT) * (1 - f) ** 1.4 * (1 + (rand() - 0.5) * 0.08 * f)
      if (Math.max(Math.abs(x), Math.abs(z)) < LAND + 10) y = Math.min(y, farGroundY(x, z) - 8)
      pos.push(x, y, z)
      uv.push((s / segs) * 3, Math.max(0.005, (y - V_BASE) / (V_TOP - V_BASE)))
    }
  }
  const row = segs + 1
  for (let s = 0; s < segs; s++) idx.push(0, 1 + s + 1, 1 + s)
  for (let r = 1; r < rings; r++) {
    const a = 1 + (r - 1) * row
    const b = 1 + r * row
    for (let s = 0; s < segs; s++) idx.push(a + s, a + s + 1, b + s, a + s + 1, b + s + 1, b + s)
  }
  return geometry(pos, uv, idx).toNonIndexed()
}

/** A band of forest silhouettes along a polyline [[x, z], ...] (`h` tall, from the ground up), facing the middle. */
function forestBand(points, h) {
  const pos = []
  const uv = []
  const idx = []
  let along = 0
  for (let i = 0; i < points.length; i++) {
    const [x, z] = points[i]
    if (i > 0) along += Math.hypot(x - points[i - 1][0], z - points[i - 1][1])
    const y = Math.max(farGroundY(x, z), LAKE.level) - 3
    const k = pos.length / 3
    pos.push(x, y, z, x, y + h, z)
    uv.push(along / 110, 0, along / 110, 1)
    if (i > 0) idx.push(k - 2, k, k - 1, k - 1, k, k + 1)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  // Lit like a canopy (see FoliageMaterial).
  g.setAttribute('normal', new Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3))
  return g
}

/** Points round a rounded square `r` out, `step` apart (`skip` drops points by where they are). */
function ring(r, step, skip = () => false) {
  const out = []
  const n = Math.round((r * 8) / step)
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const a = t * Math.PI * 2
    // A squircle: a square with its corners rounded off.
    const c = Math.cos(a)
    const s = Math.sin(a)
    const k = r / (Math.abs(c) ** 4 + Math.abs(s) ** 4) ** 0.25
    const p = [c * k, s * k]
    if (skip(p)) out.push(null)
    else out.push(p)
  }
  // Split at the skipped points into runs.
  const runs = [[]]
  for (const p of out) {
    if (p) runs[runs.length - 1].push(p)
    else if (runs[runs.length - 1].length) runs.push([])
  }
  return runs.filter((run) => run.length > 1)
}

const inLake = ([x, z]) => farGroundY(x, z) < LAKE.level + 0.5

export function PinecrestBackdrop() {
  const { parts, bands } = once('pc:backdrop', () => {
    const P = new Pieces()
    const rand = seededRandom(7971)
    const E = PINECREST_HALF
    // The woods on the hills just past the edge: two rows of trees, the far row lighter.
    for (const [from, to, gap, far] of [[E + 2, E + 8, 4.6, false], [E + 11, E + 20, 8.5, true]]) {
      for (const side of [0, 1, 2, 3]) {
        for (let c = -E - 16; c < E + 16; c += gap * (0.8 + rand() * 0.4)) {
          const off = from + rand() * (to - from)
          const [x, z] = side === 0 ? [c, -off] : side === 1 ? [c, off] : side === 2 ? [-off, c] : [off, c]
          const y = farGroundY(x, z)
          if (y < LAKE.level + 0.6 || x < shoreX(z) + 2) continue
          const seed = Math.floor(rand() * 1e6)
          if (rand() < 0.5) addPine(P, [x, y, z], 12 + rand() * 7, seed, { tiers: far ? 4 : 6, far: true })
          else addBirch(P, [x, y, z], 10 + rand() * 5, seed, { clumps: far ? 4 : 6 })
        }
      }
    }
    // Bands of woods further out on the hills, and along the far shore of the lake.
    // (Row behind row up the hills, so they read as wooded all the way up.) Each its own
    // mesh: the batcher merges them into one and draws it depth first, so where the rows
    // overlap only the front one is lit.
    const bands = []
    for (const [r, h, step] of [[E + 30, 20, 12], [E + 48, 24, 14], [E + 72, 28, 16], [E + 104, 34, 20], [E + 190, 44, 26]]) {
      for (const run of ring(r, step, inLake)) bands.push(forestBand(run, h))
    }
    const shore = []
    for (let z = -280; z <= 280; z += 14) {
      const far = shoreX(z) - 150 * Math.sqrt(Math.max(0, 1 - (z / 300) ** 2))
      shore.push([far - 6, z])
    }
    bands.push(forestBand(shore, 26), forestBand(shore.map(([x, z]) => [x - 36, z * 1.08]), 34))
    // The mountains all round (their peaks inside the camera's reach from anywhere in the arena).
    // Each a main peak with lower shoulders either side, so they run together into ranges.
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + rand() * 0.22
      const d = 420 + rand() * 80
      const R = 230 + rand() * 70
      const h = 125 + rand() * 85
      P.add(pc.mountain(), mountainGeometry(rand, R, h, Math.cos(a) * d, Math.sin(a) * d), [0, 0, 0])
      for (const s of [-1, 1]) {
        const b = a + s * (0.08 + rand() * 0.06)
        const e = d + (rand() - 0.3) * 40
        P.add(pc.mountain(), mountainGeometry(rand, R * (0.6 + rand() * 0.2), h * (0.55 + rand() * 0.2), Math.cos(b) * e, Math.sin(b) * e), [0, 0, 0])
      }
    }
    return { parts: P.build(), bands }
  })
  // (Out past the sun's shadows: none cast or taken.)
  return (
    <group>
      {parts.map(({ material, geometry }, i) => (
        <mesh key={i} geometry={geometry} material={material} />
      ))}
      {bands.map((geometry, i) => (
        <mesh key={`band${i}`} geometry={geometry} material={pc.forestWall()} />
      ))}
    </group>
  )
}

export default PinecrestBackdrop
