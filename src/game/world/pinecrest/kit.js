import { BufferGeometry, Float32BufferAttribute } from 'three'

import { GROUND_REACH, hillY, LAKE, pinecrestGroundY, shoreX } from '../../../shared/mapPinecrest.js'
import { seededRandom } from '../../../shared/math.js'
import { crossedCards, flatCard } from '../bramble/kit.js'
import { addSegment } from '../hollow/kit.js'
import { pc } from './materials.js'
import { PC_UV } from './textures.js'

/**
 * Building blocks for Pinecrest Lodge: the paths and yards worn into the
 * ground (drawn only), the land past the edge, and the plants: birches,
 * pines and the undergrowth, all leaf cards mapped into the foliage atlas.
 * Kept apart from the components (react-refresh wants component files to
 * export only components).
 */

export const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))

/** Granite metres a tile. */
const ROCK_TILE = 3.2
/**
 * Rock's UVs at a point facing (nx, ny, nz): laid on along whichever axis it
 * faces most (from above, the side, the front), offset apart, so cliffs,
 * banks and boulders all take the granite at one scale, never stretched.
 */
export function rockUV(x, y, z, nx, ny, nz) {
  const ax = Math.abs(nx)
  const ay = Math.abs(ny)
  const az = Math.abs(nz)
  if (ay >= ax && ay >= az) return [x / ROCK_TILE, z / ROCK_TILE]
  if (ax >= az) return [z / ROCK_TILE + 0.37, y / ROCK_TILE]
  return [x / ROCK_TILE + 0.71, y / ROCK_TILE]
}
const ORIGIN = [0, 0, 0]

/* ---------------------------------------------------------------------------
 * Paths and yards: gravel and bare earth blended into the ground
 * ------------------------------------------------------------------------- */

/** The dirt road and the footpaths: points [x, z], width. */
export const PATHS = Object.freeze([
  // The road: in from the north woods past the workshop, over the bridge, into the courtyard.
  { points: [[14.6, -48.5], [13, -40], [10.5, -28], [8.6, -16], [8, -4], [8, 9.5], [8, 12]], width: 4.2 },
  // Off it to the cabin's door.
  { points: [[7.6, -8.6], [4.2, -5.6], [1.6, -4.2]], width: 1.8 },
  // The courtyard west to the footbridge; over it, the track on to the boathouse.
  { points: [[-12, 13], [-15.6, 12.8], [-18, 11.8]], width: 2.0 },
  { points: [[-18, -2.6], [-21.5, -5.6], [-25, -8.6], [-28.6, -9.2]], width: 2.6 },
  // Up from that track to the substation's south gate.
  { points: [[-26.4, -8.8], [-27.6, -16], [-27.6, -24], [-25.8, -33]], width: 1.6 },
  // Along the bluff over the lake.
  { points: [[-31, -13.6], [-35.5, -16.2], [-38.6, -21], [-38.2, -30]], width: 1.5 },
  // The lodge's yard round to the stable's, through the gap in the wall.
  { points: [[-12.6, 14.6], [-17.4, 16.6], [-17.6, 20.6], [-21, 24]], width: 2.0 },
  // The courtyard east to the glasshouse.
  { points: [[13.6, 13.4], [15.0, 16.0], [15.3, 20.0]], width: 1.8 },
  // Out the lodge's back door to the woodshed.
  { points: [[-8.6, 33.6], [-10.6, 37.8], [-13, 41.6]], width: 1.5 },
])

/** Gravel yards: [x0, x1, z0, z1]. */
export const YARDS = Object.freeze([
  // The courtyard in front of the lodge, the workshop's apron, the substation, the stable yard, the glasshouse's floor.
  [-14, 15, 10.8, 16.2],
  [-7, 9, -32, -24.5],
  [-34, -18, -47, -33],
  [-23, -18.5, 21, 27],
  [16.3, 27.7, 16.3, 23.7],
])

export function distToPath(points, x, z) {
  let best = Infinity
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)))
    best = Math.min(best, Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t))
  }
  return best
}

/** How much gravel at (x, z): 1 on a path or in a yard, fading out over a metre or so past its edge. */
export function gravelAt(x, z) {
  let g = 0
  for (const p of PATHS) g = Math.max(g, 1 - smooth((distToPath(p.points, x, z) - p.width / 2 + 0.5) / 1.3))
  for (const [x0, x1, z0, z1] of YARDS) g = Math.max(g, 1 - smooth((Math.max(x0 - x, x - x1, z0 - z, z - z1) + 0.4) / 1.4))
  return g
}

/* ---------------------------------------------------------------------------
 * The land past the edge: the hills on three sides, the lake on the fourth
 * and the far shore across it
 * ------------------------------------------------------------------------- */

/** The lake past the arena: how wide (to its far shore) and how long (it closes at ±LEN). */
const LAKE_W = 150
const LAKE_LEN = 300

/** The ground's height anywhere, past the edge too (inside the shared mesh, its own height). */
export function farGroundY(x, z) {
  if (Math.abs(x) <= GROUND_REACH && Math.abs(z) <= GROUND_REACH) return pinecrestGroundY(x, z)
  const edge = Math.max(-z - 47, z - 47, x - 47)
  let land = 0
  if (edge > 0) {
    land = hillY(edge) + Math.max(0, edge - 25) * 0.16
    if (edge > 6) land += 1.5 * Math.sin(x * 0.07 + 1) * Math.sin(z * 0.06 + 2)
    if (edge > 20) land += 5 * Math.sin(x * 0.023 + 0.5) * Math.sin(z * 0.019 + 1.7)
  }
  const near = shoreX(z)
  const far = near - LAKE_W * Math.sqrt(Math.max(0, 1 - (z / LAKE_LEN) ** 2))
  // (Gentle shores near the arena, steeper far off where the hills come down to the water.)
  const blend = 5 + Math.max(0, Math.abs(z) - 50) * 0.25
  if (x >= near) return x - near >= blend ? land : LAKE.shore + (land - LAKE.shore) * smooth((x - near) / blend)
  if (x > far) return LAKE.shore - Math.min(4, Math.min(near - x, x - far) * 0.3)
  const d = far - x
  const west = Math.max(Math.min(28, d * 0.32) + 3 * Math.sin(z * 0.031 + 0.8) * smooth(d / 30), land)
  return LAKE.shore + (west - LAKE.shore) * smooth(d / blend)
}

/* ---------------------------------------------------------------------------
 * Plants
 * ------------------------------------------------------------------------- */

const pick = (rand, list) => list[Math.floor(rand() * list.length)]

/** Leaf tints over the atlas's own colours. Birches: gold, warmer, paler; in their own shade lower down. */
const BIRCH_TINTS = ['#ffffff', '#fff0d4', '#ffe2b0', '#f6f4d2', '#ffd8a4']
const BIRCH_SHADE = ['#c8b290', '#baa27e', '#c2a886']
const PINE_TINTS = ['#e8eee2', '#d8e2d2', '#e4e6da']
const PINE_SHADE = ['#a8b6a2', '#b2bead']
const SHRUB_TINTS = ['#9cb47c', '#aab882', '#c8a070', '#a6aa78', '#b89a6c']
const FERN_TINTS = ['#e8d4b4', '#dcc6a4', '#f0dcbc', '#d0bc9c']
const GRASS_TINTS = ['#ffffff', '#f0ecd8', '#e4e8cc']

/**
 * One pine bough: a strip out from the trunk at `c`, `R` long, sagging
 * `droop` at its tip, `yaw` round, narrow at the trunk and `wOut` wide at
 * the tip, folded along its middle like a roof (its twigs hang down either
 * side of it), so seen from the side half of it still faces you rather than
 * thinning to an edge. Its normals tip outward and up, so the tree is lit
 * like a cone.
 */
function bough(c, R, droop, yaw, wIn, wOut, [u0, v0, u1, v1]) {
  const dx = Math.cos(yaw)
  const dz = Math.sin(yaw)
  const pos = []
  const nor = []
  const uv = []
  const rows = [
    [0.08, 0.12, wIn, v1],
    [0.55, -droop * 0.28, (wIn + wOut) * 0.48, v0 + (v1 - v0) * 0.45],
    [1, -droop, wOut, v0],
  ]
  const nl = Math.hypot(0.55, 1)
  for (const [f, dy, w, v] of rows) {
    const x = c[0] + dx * R * f
    const z = c[2] + dz * R * f
    // Left edge, the ridge (raised), right edge.
    for (const s of [-1, 0, 1]) {
      pos.push(x - dz * s * (w / 2), c[1] + dy + (s ? -w * 0.22 : 0), z + dx * s * (w / 2))
      nor.push((dx * 0.55) / nl, 1 / nl, (dz * 0.55) / nl)
      uv.push(u0 + ((s + 1) / 2) * (u1 - u0), v)
    }
  }
  const idx = []
  for (let r = 0; r < 2; r++) {
    for (let k = 0; k < 2; k++) {
      const a = r * 3 + k
      idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

/**
 * A pine into `P`: a straight trunk bare to a little over head height, then
 * tiers of drooping boughs, wide at the bottom, narrowing to the leader.
 * `tiers` fewer for the ones far off.
 */
export function addPine(P, p, h, seed, { tiers, far = false } = {}) {
  const rand = seededRandom(seed)
  const r = 0.14 + h * 0.008
  addSegment(P, pc.pineBark(), [p[0], p[1] - 0.15, p[2]], [p[0], p[1] + h * 0.9, p[2]], r, r * 0.2, far ? 5 : 7)
  const n = tiers ?? Math.round(6 + h * 0.18)
  const base = Math.max(2.6, h * 0.24)
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const y = p[1] + base + (h * 0.95 - base) * t ** 0.92
    const R = Math.max(0.4, h * 0.21 * (1 - t * 0.86) * (0.88 + rand() * 0.24))
    const k = far ? (R > 1.4 ? 5 : 4) : R > 1.8 ? 7 : R > 1.0 ? 6 : 4
    const yaw0 = rand() * Math.PI * 2
    const tint = pick(rand, t < 0.4 ? PINE_SHADE : PINE_TINTS)
    for (let j = 0; j < k; j++) {
      const yaw = yaw0 + (j / k) * Math.PI * 2 + (rand() - 0.5) * 0.35
      const len = R * (0.85 + rand() * 0.3)
      P.add(pc.foliage(tint), bough([p[0], y, p[2]], len, len * (0.42 + rand() * 0.2), yaw, 0.35, ((2 * Math.PI * len) / k) * 1.45, PC_UV.pine), ORIGIN)
    }
  }
  // The leader.
  P.add(pc.foliage(PINE_TINTS[0]), crossedCards([p[0], p[1] + h * 0.88, p[2]], 0.9, h * 0.15, rand() * Math.PI, PC_UV.pine, 2), ORIGIN)
}

/**
 * A birch into `P`: a slender white trunk (often two from one root) leaning a
 * little, a few limbs, and a narrow crown of small gold leaves.
 */
export function addBirch(P, p, h, seed, { clumps } = {}) {
  const rand = seededRandom(seed)
  const bark = pc.birchBark()
  const stems = rand() < 0.35 ? 2 : 1
  for (let s = 0; s < stems; s++) {
    const sh = s ? h * (0.76 + rand() * 0.12) : h
    const r = 0.08 + sh * 0.008
    const a = rand() * Math.PI * 2
    const foot = s ? [p[0] + Math.cos(a) * 0.3, p[2] + Math.sin(a) * 0.3] : [p[0], p[2]]
    const lean = s ? [Math.cos(a) * 0.9, Math.sin(a) * 0.9] : [(rand() - 0.5) * 0.8, (rand() - 0.5) * 0.8]
    const at = (t) => [foot[0] + lean[0] * t, p[1] + sh * 0.9 * t, foot[1] + lean[1] * t]
    const mid = at(0.5)
    mid[0] += (rand() - 0.5) * 0.2
    mid[2] += (rand() - 0.5) * 0.2
    const top = at(1)
    addSegment(P, bark, [foot[0], p[1] - 0.12, foot[1]], mid, r * 1.2, r * 0.85, 7)
    addSegment(P, bark, mid, top, r * 0.85, r * 0.3, 6)
    const crownR = sh * 0.16
    const ends = []
    for (let k = 0; k < 4; k++) {
      const b = ((k + rand() * 0.6) / 4) * Math.PI * 2
      const from = at(0.55 + rand() * 0.3)
      const end = [from[0] + Math.cos(b) * crownR * 0.9, from[1] + sh * 0.1, from[2] + Math.sin(b) * crownR * 0.9]
      addSegment(P, bark, from, end, r * 0.32, r * 0.12, 4)
      ends.push(end)
    }
    const n = clumps ?? Math.round(7 + sh * 0.3)
    for (let i = 0; i < n; i++) {
      const size = sh * (0.2 + rand() * 0.09)
      let c
      if (i < ends.length) c = ends[i]
      else {
        const t = 0.45 + rand() * 0.55
        const b = rand() * Math.PI * 2
        const d = crownR * (0.25 + rand() * 0.75) * (1 - Math.abs(t - 0.72) * 1.3)
        const o = at(t)
        c = [o[0] + Math.cos(b) * d, o[1], o[2] + Math.sin(b) * d]
      }
      const shade = c[1] < p[1] + sh * 0.62
      P.add(pc.foliage(pick(rand, shade ? BIRCH_SHADE : BIRCH_TINTS)), crossedCards([c[0], c[1] - size * 0.5, c[2]], size, size, rand() * Math.PI, PC_UV.birch, 2), ORIGIN)
    }
    P.add(pc.foliage(BIRCH_TINTS[0]), flatCard([top[0], top[1] + sh * 0.02, top[2]], sh * 0.3, rand() * 6, 0.3, PC_UV.birch), ORIGIN)
  }
}

/** Undergrowth, each a few crossed cards standing at `p` (its foot): bracken, dry grass, a shrub. */
export function addFern(P, p, s, rand) {
  P.add(pc.foliage(pick(rand, FERN_TINTS)), crossedCards(p, s * 1.4, s * 1.1, rand() * Math.PI, PC_UV.fern, 2), ORIGIN)
}
export function addGrass(P, p, s, rand) {
  P.add(pc.foliage(pick(rand, GRASS_TINTS)), crossedCards(p, s * 0.9, s, rand() * Math.PI, PC_UV.grass, 2), ORIGIN)
}
export function addShrub(P, p, s, rand) {
  const t = pick(rand, SHRUB_TINTS)
  P.add(pc.foliage(t), crossedCards([p[0], p[1] - 0.1, p[2]], s * 1.3, s, rand() * Math.PI, PC_UV.birch, 3), ORIGIN)
  P.add(pc.foliage(t), flatCard([p[0], p[1] + s * 0.7, p[2]], s * 1.1, rand() * 6, 0.25, PC_UV.birch), ORIGIN)
}
