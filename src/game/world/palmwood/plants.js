import { BufferGeometry, ConeGeometry, CylinderGeometry, Euler, Float32BufferAttribute, Quaternion, SphereGeometry } from 'three'

import { seededRandom } from '../../../shared/math.js'
import { palmYaw } from '../../../shared/mapPalmwood.js'
import { pw } from './materials.js'
import { FOLIAGE_UV } from './textures.js'

/**
 * Plants of Palmwood, as geometry added to a Pieces: banana plants (kehel),
 * coconut palms, broad-leafed bushes and grass tufts. Every leaf is a bent
 * strip mapped into the one foliage atlas, so all the foliage in the map is
 * drawn with a single material.
 */

/**
 * A leaf (or frond) as a strip bent along its length: it leaves `base` heading
 * `yaw` (0 = +z) at elevation `e0` and droops by `droop` radians to the tip.
 * Folded along the middle: `crease` > 0 lifts the edges (a palm frond's V),
 * < 0 lets them hang (a banana leaf). UVs: along = u, across = v in `uv`.
 */
export function leafStrip({ base, yaw, length, width, e0, droop, crease = 0, uv, segs = 6, twist = 0 }) {
  const [u0, v0, u1, v1] = uv
  const hx = Math.sin(yaw)
  const hz = Math.cos(yaw)
  const ax = Math.cos(yaw)
  const az = -Math.sin(yaw)
  const pos = []
  const uvs = []
  const idx = []
  let x = base[0]
  let y = base[1]
  let z = base[2]
  const ds = length / segs
  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    // Edges roll a little as the leaf twists toward the tip.
    const roll = twist * t
    const hw = width / 2
    const ex = ax * Math.cos(roll) * hw
    const ez = az * Math.cos(roll) * hw
    const ey = Math.sin(roll) * hw
    const c = crease * hw * (0.4 + t * 0.6)
    pos.push(x + ex, y + ey + c, z + ez, x, y, z, x - ex, y - ey + c, z - ez)
    const u = u0 + (u1 - u0) * t
    uvs.push(u, v1, u, (v0 + v1) / 2, u, v0)
    if (i < segs) {
      const e = e0 - droop * (t + 0.5 / segs)
      x += hx * Math.cos(e) * ds
      z += hz * Math.cos(e) * ds
      y += Math.sin(e) * ds
    }
    if (i > 0) {
      const a = (i - 1) * 3
      const b = i * 3
      idx.push(a, a + 1, b, a + 1, b + 1, b, a + 1, a + 2, b + 1, a + 2, b + 2, b + 1)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** A cylinder with its UVs at world scale (u twice round, v one tile per `tile` m). */
export function trunk(rTop, rBottom, h, segments = 8, tile = 1) {
  const g = new CylinderGeometry(rTop, rBottom, h, segments, 1, true)
  const uv = g.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, (uv.getY(i) * h) / tile)
  return g
}

/** Banana plant at `p`, scaled `s`: a pseudo-stem, a crown of broad leaves, sometimes a bunch. */
export function addBanana(P, p, s, seed) {
  const rand = seededRandom(seed)
  const H = (1.7 + rand() * 0.5) * s
  const leanX = (rand() - 0.5) * 0.12
  const leanZ = (rand() - 0.5) * 0.12
  P.add(pw.bananaStem(), trunk(0.085 * s, 0.14 * s, H, 8, 1.2), [p[0] + (leanX * H) / 2, H / 2, p[2] + (leanZ * H) / 2], [leanZ, 0, -leanX])
  const top = [p[0] + leanX * H, H, p[2] + leanZ * H]
  const n = 7 + Math.floor(rand() * 3)
  const yaw0 = rand() * Math.PI * 2
  const foliage = pw.foliage()
  for (let i = 0; i < n; i++) {
    const old = i >= n - 2
    const yaw = yaw0 + (i / n) * Math.PI * 2 + (rand() - 0.5) * 0.5
    // Young leaves stand up, old ones hang.
    const e0 = old ? -0.2 - rand() * 0.4 : 0.55 + rand() * 0.6
    const droop = old ? 0.9 : 0.9 + rand() * 0.6
    const length = (old ? 1.3 : 1.6 + rand() * 0.5) * s
    // Petiole up to the blade.
    const stalk = 0.35 * s
    const sx = Math.sin(yaw) * Math.cos(e0) * stalk
    const sz = Math.cos(yaw) * Math.cos(e0) * stalk
    const sy = Math.sin(e0) * stalk
    // Pitched up (about its own x), then turned to its heading.
    const q = new Quaternion().setFromEuler(new Euler(-e0, yaw, 0, 'YXZ'))
    P.box(pw.bananaStem(), top[0] + sx / 2, top[1] + sy / 2, top[2] + sz / 2, 0.035 * s, 0.035 * s, stalk, 1, q)
    P.add(
      foliage,
      leafStrip({
        base: [top[0] + sx, top[1] + sy, top[2] + sz],
        yaw,
        length,
        width: 0.62 * s,
        e0,
        droop,
        crease: -0.18,
        uv: old ? FOLIAGE_UV.bananaOld : FOLIAGE_UV.banana,
        segs: 6,
        twist: (rand() - 0.5) * 0.9,
      }),
      [0, 0, 0],
    )
  }
  // A hanging bunch and its purple flower on some plants.
  if (rand() < 0.45) {
    const a = rand() * Math.PI * 2
    const bx = top[0] + Math.sin(a) * 0.22 * s
    const bz = top[2] + Math.cos(a) * 0.22 * s
    P.add(pw.paint('#7d9a3c', 0.7), new ConeGeometry(0.17 * s, 0.5 * s, 8), [bx, top[1] - 0.45 * s, bz], [Math.PI, 0, 0])
    P.box(pw.bananaStem(), bx, top[1] - 0.85 * s, bz, 0.03, 0.4 * s, 0.03, 1)
    P.add(pw.paint('#6e2a4c', 0.7), new SphereGeometry(0.09 * s, 8, 6), [bx, top[1] - 1.1 * s, bz], null, [1, 1.6, 1])
  }
}

/** Coconut palm: a leaning, tapering trunk (as its collider), a crown of fronds and coconuts. */
export function addPalm(P, p, h, lean, seed, { fronds = 11, coconuts = true } = {}) {
  const rand = seededRandom(seed)
  const yaw = palmYaw(p)
  const c = Math.cos(yaw)
  const sn = Math.sin(yaw)
  // The trunk bends further over as it rises (the same curve the colliders follow).
  const n = 8
  let x = 0
  let y = 0
  for (let i = 0; i < n; i++) {
    const ang = lean * ((i + 0.5) / n) * 1.6
    const seg = h / n
    const mx = x + Math.sin(ang) * seg * 0.5
    const my = y + Math.cos(ang) * seg * 0.5
    const r0 = 0.21 - (i / n) * 0.07
    const r1 = 0.21 - ((i + 1) / n) * 0.07
    // Lean is along local +x; turned by the palm's yaw about y.
    P.add(pw.palmBark(), trunk(r1, r0, seg + 0.06, 8, 1), [p[0] + mx * c, my, p[2] - mx * sn], [0, yaw, -ang])
    x += Math.sin(ang) * seg
    y += Math.cos(ang) * seg
  }
  const top = [p[0] + x * c, y, p[2] - x * sn]
  const foliage = pw.foliage()
  for (let i = 0; i < fronds; i++) {
    const fy = (i / fronds) * Math.PI * 2 + rand() * 0.4
    const e0 = 0.35 + rand() * 0.45
    P.add(
      foliage,
      leafStrip({
        base: top,
        yaw: fy,
        length: 3.1 + rand() * 1.0,
        width: 1.5,
        e0,
        droop: 1.5 + rand() * 0.5,
        crease: 0.35,
        uv: FOLIAGE_UV.frond,
        segs: 7,
      }),
      [0, 0, 0],
    )
  }
  // A tuft of young fronds straight up, and the coconuts under the crown.
  P.add(pw.palmBark(), trunk(0.05, 0.15, 0.5, 6, 1), [top[0], top[1] + 0.2, top[2]])
  if (coconuts) {
    const nut = pw.paint('#5a4a2a', 0.8)
    const green = pw.paint('#6a7a30', 0.7)
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + rand()
      P.add(k % 2 ? nut : green, new SphereGeometry(0.13, 8, 6), [top[0] + Math.cos(a) * 0.2, top[1] - 0.18, top[2] + Math.sin(a) * 0.2])
    }
  }
}

/** A low clump of broad leaves (taro and young banana suckers). */
export function addBush(P, p, s, seed) {
  const rand = seededRandom(seed)
  const n = 5 + Math.floor(rand() * 3)
  const foliage = pw.foliage()
  for (let i = 0; i < n; i++) {
    const yaw = (i / n) * Math.PI * 2 + rand() * 0.6
    P.add(
      foliage,
      leafStrip({
        base: [p[0] + Math.sin(yaw) * 0.08, 0.05, p[2] + Math.cos(yaw) * 0.08],
        yaw,
        length: (0.7 + rand() * 0.4) * s,
        width: 0.36 * s,
        e0: 0.9 + rand() * 0.4,
        droop: 1.6,
        crease: -0.2,
        uv: rand() < 0.2 ? FOLIAGE_UV.bananaOld : FOLIAGE_UV.banana,
        segs: 4,
      }),
      [0, 0, 0],
    )
  }
}

/** A grass tuft: two crossed upright planes. */
export function addTuft(P, p, s, yaw) {
  const [u0, v0, u1, v1] = FOLIAGE_UV.tuft
  const w = 0.7 * s
  const h = 0.55 * s
  for (const a of [yaw, yaw + Math.PI / 2]) {
    const dx = (Math.cos(a) * w) / 2
    const dz = (-Math.sin(a) * w) / 2
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute([p[0] - dx, 0, p[2] - dz, p[0] + dx, 0, p[2] + dz, p[0] + dx, h, p[2] + dz, p[0] - dx, h, p[2] - dz], 3))
    g.setAttribute('normal', new Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3))
    g.setAttribute('uv', new Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v1], 2))
    g.setIndex([0, 1, 2, 0, 2, 3])
    P.add(pw.foliage(), g, [0, 0, 0])
  }
}
