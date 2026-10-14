import { BufferGeometry, Float32BufferAttribute } from 'three'

import { seededRandom } from '../../../shared/math.js'
import { addSegment } from '../hollow/kit.js'
import { br } from './materials.js'
import { BR_UV } from './textures.js'

/**
 * Building blocks for Bramblewood's plants: ground layer heights, leaf cards
 * (crossed upright planes, or one plane at any angle) mapped into the
 * foliage atlas, and whole trees built from them. Kept apart from the
 * components (react-refresh wants component files to export only components).
 */

/** Ground layers, a few millimetres apart, each also depth-offset by its material (br.layer). */
export const GROUND_Y = { forest: -0.02, grass: 0, field: 0.012, track: 0.022 }
export const GROUND_K = { field: 1, track: 3 }

/** Appends one quad (four corners, in order) with the atlas region `uv` to the arrays. */
function quad(pos, nor, uvs, idx, corners, normal, [u0, v0, u1, v1]) {
  const k = pos.length / 3
  for (const c of corners) pos.push(...c)
  for (let i = 0; i < 4; i++) nor.push(...normal)
  uvs.push(u0, v0, u1, v0, u1, v1, u0, v1)
  idx.push(k, k + 1, k + 2, k, k + 2, k + 3)
}

function geometry(pos, nor, uvs, idx) {
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  g.setIndex(idx)
  return g
}

/**
 * Upright planes crossed at a point (`n` of them, evenly turned from `yaw`):
 * a grass tuft, a fern, a bush, a clump of a tree's crown seen from the side.
 * `p` is the bottom middle; normals point up so they light like foliage.
 */
export function crossedCards(p, w, h, yaw, uv, n = 2) {
  const pos = []
  const nor = []
  const uvs = []
  const idx = []
  for (let i = 0; i < n; i++) {
    const a = yaw + (i * Math.PI) / n
    const dx = (Math.cos(a) * w) / 2
    const dz = (-Math.sin(a) * w) / 2
    quad(pos, nor, uvs, idx, [[p[0] - dx, p[1], p[2] - dz], [p[0] + dx, p[1], p[2] + dz], [p[0] + dx, p[1] + h, p[2] + dz], [p[0] - dx, p[1] + h, p[2] - dz]], [0, 1, 0], uv)
  }
  return geometry(pos, nor, uvs, idx)
}

/** A flat card lying (nearly) horizontal at `p`: the top of a tree's crown seen from above. */
export function flatCard(p, s, yaw, tilt, uv) {
  const c = Math.cos(yaw)
  const sn = Math.sin(yaw)
  const h = s / 2
  const lift = Math.sin(tilt) * h
  const corner = (a, b) => [p[0] + (a * c - b * sn) * h, p[1] + b * lift, p[2] + (a * sn + b * c) * h]
  const pos = []
  const nor = []
  const uvs = []
  const idx = []
  quad(pos, nor, uvs, idx, [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)], [0, 1, 0], uv)
  return geometry(pos, nor, uvs, idx)
}

/**
 * A patch of ivy flat on a wall: `along` and `up` are the wall's directions,
 * `out` its outward normal; the patch is `w` wide and `h` tall from `base`.
 */
export function ivyPatch(base, along, out, w, h, uv) {
  const pos = []
  const nor = []
  const uvs = []
  const idx = []
  const at = (a, y) => [base[0] + along[0] * a + out[0] * 0.035, base[1] + y, base[2] + along[1] * a + out[1] * 0.035]
  quad(pos, nor, uvs, idx, [at(-w / 2, 0), at(w / 2, 0), at(w / 2, h), at(-w / 2, h)], [out[0], 0, out[1]], uv)
  return geometry(pos, nor, uvs, idx)
}

/** Leaf tints: mostly green, some olive; the odd tree turning. The lower clumps are shaded by the crown over them. */
const LEAF_TINTS = ['#f4f8ec', '#e2eace', '#d0dcbc', '#eaf0da']
const SHADED_TINTS = ['#aebc9e', '#b8c6a6', '#a4b498']
const AUTUMN_TINTS = ['#f4d27a', '#e8b860', '#f0c46c']
const SHADED_AUTUMN = ['#c4a862', '#b89850']

/* ---------------------------------------------------------------------------
 * Trees
 * ------------------------------------------------------------------------- */

/** A broadleaf tree into `P`: a leaning trunk, a few limbs and a crown of leaf clumps (ivy up some trunks). */
export function addTree(P, p, h, seed, { autumn = false, ivy = true, clumps } = {}) {
  const rand = seededRandom(seed)
  const bark = br.bark()
  const trunkH = h * 0.46
  const r = 0.12 + h * 0.018
  const lean = [(rand() - 0.5) * 0.5, (rand() - 0.5) * 0.5]
  const top = [p[0] + lean[0], trunkH, p[2] + lean[1]]
  addSegment(P, bark, [p[0], -0.05, p[2]], top, r * 1.25, r * 0.8, 8)
  const tints = autumn ? AUTUMN_TINTS : LEAF_TINTS
  // Fewer, bigger clumps: the same crown with less overdraw (each clump is two crossed cards).
  const n = clumps ?? Math.round(7 + h * 0.4)
  const crownR = h * 0.3
  const crownY = trunkH + h * 0.2
  // Limbs out into the crown, each ending in a clump (a bare limb tip shows
  // against the sky from below).
  const ends = []
  for (let i = 0; i < 4; i++) {
    const a = ((i + rand() * 0.6) / 4) * Math.PI * 2
    const end = [top[0] + Math.cos(a) * crownR * 0.7, crownY + (rand() - 0.3) * h * 0.1, top[2] + Math.sin(a) * crownR * 0.7]
    addSegment(P, bark, [top[0], trunkH * (0.75 + rand() * 0.2), top[2]], end, r * 0.6, r * 0.25, 5)
    ends.push(end)
  }
  for (let i = 0; i < n; i++) {
    const s = h * (0.27 + rand() * 0.12)
    let c
    if (i < ends.length) c = [ends[i][0], ends[i][1] - s * 0.5, ends[i][2]]
    else {
      const a = rand() * Math.PI * 2
      const d = Math.sqrt(rand()) * crownR
      c = [top[0] + Math.cos(a) * d, crownY + (rand() - 0.5) * h * 0.34 - s * 0.45, top[2] + Math.sin(a) * d]
    }
    // Lower in the crown (the card's middle below the crown's), in its shade.
    const shade = c[1] + s * 0.5 < crownY - h * 0.04
    const pick = shade ? (autumn ? SHADED_AUTUMN : SHADED_TINTS) : tints
    P.add(br.foliage(pick[Math.floor(rand() * pick.length)]), crossedCards(c, s, s, rand() * Math.PI, BR_UV.leaves, 2), [0, 0, 0])
  }
  // A few flat clumps over the top, so it isn't see-through from above.
  for (let i = 0; i < 2; i++) {
    const a = rand() * Math.PI * 2
    const d = rand() * crownR * 0.6
    P.add(br.foliage(tints[0]), flatCard([top[0] + Math.cos(a) * d, crownY + h * 0.16 + rand() * h * 0.06, top[2] + Math.sin(a) * d], h * 0.42, rand() * 6, 0.3, BR_UV.leaves), [0, 0, 0])
  }
  // Ivy up the trunk.
  if (ivy && rand() < 0.45) {
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + rand()
      const out = [Math.cos(a), Math.sin(a)]
      P.add(br.foliage('#e0ead4'), ivyPatch([p[0] + out[0] * (r + 0.02), 0, p[2] + out[1] * (r + 0.02)], [-out[1], out[0]], out, 0.7, trunkH * (0.5 + rand() * 0.4), BR_UV.ivy), [0, 0, 0])
    }
  }
}

