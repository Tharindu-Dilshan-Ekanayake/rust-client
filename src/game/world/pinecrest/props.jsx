import { useMemo } from 'react'
import { BufferGeometry, CircleGeometry, CylinderGeometry, Float32BufferAttribute, IcosahedronGeometry, Quaternion, Vector3 } from 'three'

import { rampBox } from '../../../shared/mapKit.js'
import {
  BENCHES,
  buildPinecrestColliders,
  CREEK,
  creekBedY,
  creekSection,
  DECK,
  DOCK,
  FOOTBRIDGE,
  GREENHOUSE,
  greenhouseBase,
  HOUSES,
  inCreek,
  LAKE,
  PC_STAIRS,
  PINECREST_HALF,
  pinecrestGroundY,
  PLANK_LIFT,
  PLANKS,
  PYLONS,
  ROAD_BRIDGE,
  roadBridgePieces,
  shoreX,
  SUBSTATION,
  substationFence,
  vaultPoint,
  vaultY,
} from '../../../shared/mapPinecrest.js'
import { rotate3, seededRandom } from '../../../shared/math.js'
import { Merged } from '../acres/merge.jsx'
import { once, Pieces } from '../acres/pieces.js'
import { crossedCards } from '../bramble/kit.js'
import { addSegment } from '../hollow/kit.js'
import { boxGeo } from '../materials.js'
import { addBar, addRail } from '../quarter/kit.js'
import { addBirch, addFern, addGrass, addPine, addShrub, farGroundY, gravelAt, rockUV } from './kit.js'
import { pc } from './materials.js'
import { PC_UV } from './textures.js'

/**
 * Pinecrest Lodge's props: the glasshouse's frame and benches, the bridges,
 * planks and timber stairs, the boathouse's deck and dock and its boat, the
 * substation, the pylons, rocks, logs and stumps, the trees and the
 * undergrowth. Each is merged into a few meshes and cached; the static
 * batcher merges them all by material, so every leaf in the map is one draw
 * and every rock another.
 */

function useParts(key, build) {
  return useMemo(() => once(key, build), [key]) // eslint-disable-line react-hooks/exhaustive-deps
}
const keyOf = (kind, p, extra = '') => `pc:${kind}:${p[0].toFixed(2)}:${p[2].toFixed(2)}:${extra}`
const ORIGIN = [0, 0, 0]
const _q = new Quaternion()
const quat = (q) => _q.set(q[0], q[1], q[2], q[3]).clone()

/** A rock: an icosahedron pushed about into a lumpy boulder, flat-faced, `r` across, squashed. */
function rockGeometry(seed, r, squash = 0.75) {
  const rand = seededRandom(seed)
  const g = new IcosahedronGeometry(1, 1)
  const pos = g.getAttribute('position')
  const moved = new Map()
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`
    if (!moved.has(key)) {
      const k = 0.78 + rand() * 0.38
      moved.set(key, [pos.getX(i) * r * k, pos.getY(i) * r * k * squash, pos.getZ(i) * r * k * (0.85 + rand() * 0.2)])
    }
    pos.setXYZ(i, ...moved.get(key))
  }
  const flat = g.toNonIndexed()
  g.dispose()
  flat.computeVertexNormals()
  // UVs along the way each face looks (see rockUV).
  const p = flat.getAttribute('position')
  const n = flat.getAttribute('normal')
  const uv = flat.getAttribute('uv')
  for (let i = 0; i < p.count; i++) uv.setXY(i, ...rockUV(p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i)))
  return flat
}

/* ---------------------------------------------------------------------------
 * The glasshouse
 * ------------------------------------------------------------------------- */

/**
 * Its brick base and white-painted frame: a post at every bay, sills at the
 * brick and the eaves, ribs over the vault and purlins along it, mullions and
 * door frames in the ends; inside, two potting benches full of pots and
 * plants. (The glass itself is GlassPanes': it breaks.)
 */
export function Greenhouse() {
  const parts = useParts('pc:greenhouse', () => {
    const P = new Pieces()
    const G = GREENHOUSE
    const brick = pc.brick()
    const frame = pc.frame()
    const base = greenhouseBase()
    for (const [x0, x1, z0, z1, y0, y1] of base) {
      P.aabb(brick, x0, y0, z0, x1, y1, z1, 1)
      P.aabb(pc.concrete(), x0 - 0.03, y1, z0 - 0.03, x1 + 0.03, y1 + 0.05, z1 + 0.03, 1)
    }
    const bayW = (G.x1 - G.x0) / G.bays
    const inset = (x) => Math.min(G.x1 - 0.15, Math.max(G.x0 + 0.15, x))
    const zs = [G.z0 + G.brick / 2, G.z1 - G.brick / 2]
    const t = 0.07
    for (let i = 0; i <= G.bays; i++) {
      const x = inset(G.x0 + bayW * i)
      for (const z of zs) P.box(frame, x, (G.base + G.spring) / 2, z, t, G.spring - G.base, t, 1)
      // A rib over the vault.
      for (let k = 0; k < G.arc; k++) {
        const [za, ya] = vaultPoint((Math.PI * k) / G.arc)
        const [zb, yb] = vaultPoint((Math.PI * (k + 1)) / G.arc)
        addBar(P, frame, [x, ya, za], [x, yb, zb], t, t)
      }
    }
    for (const z of zs) for (const y of [G.base + 0.08, G.spring]) P.box(frame, (G.x0 + G.x1) / 2, y, z, G.x1 - G.x0, 0.08, 0.1, 1)
    for (let k = 1; k < G.arc; k++) {
      const [z, y] = vaultPoint((Math.PI * k) / G.arc)
      P.box(frame, (G.x0 + G.x1) / 2, y, z, G.x1 - G.x0 - 0.2, 0.05, 0.05, 1)
    }
    // The ends: mullions, the door frame and its transom.
    const [d0, d1, dTop] = G.door
    for (const x of [G.x0 + G.brick / 2, G.x1 - G.brick / 2]) {
      for (const z of [d0 - 1.6, d1 + 1.6]) P.box(frame, x, (G.base + vaultY(z)) / 2, z, t, vaultY(z) - G.base, t, 1)
      for (const z of [d0, d1]) P.box(frame, x, vaultY(z) / 2, z, 0.1, vaultY(z), 0.1, 1)
      P.box(frame, x, dTop, (d0 + d1) / 2, 0.1, 0.1, d1 - d0, 1)
      P.box(frame, x, G.base + 0.08, (G.z0 + d0) / 2, 0.1, 0.08, d0 - G.z0, 1)
      P.box(frame, x, G.base + 0.08, (d1 + G.z1) / 2, 0.1, 0.08, G.z1 - d1, 1)
    }
    // The potting benches: slatted tops on legs, a shelf under, pots of plants (some long dead).
    const rand = seededRandom(7901)
    const wood = pc.wood('#a08060')
    const pot = pc.paint('#b0603e', 0.85)
    const potGeo = new CylinderGeometry(0.13, 0.1, 0.2, 8)
    for (const [x, z, len] of BENCHES) {
      P.box(wood, x, 0.86, z, len, 0.06, 0.9, 1)
      P.box(wood, x, 0.28, z, len - 0.2, 0.04, 0.8, 1)
      for (let lx = -len / 2 + 0.1; lx <= len / 2 - 0.09; lx += (len - 0.2) / 6) for (const s of [-1, 1]) P.box(wood, x + lx, 0.43, z + s * 0.38, 0.07, 0.86, 0.07, 1)
      for (let lx = -len / 2 + 0.3; lx < len / 2 - 0.2; lx += 0.42 + rand() * 0.2) {
        for (const s of [-1, 1]) {
          if (rand() < 0.2) continue
          const px = x + lx
          const pz = z + s * (0.2 + rand() * 0.06)
          P.add(pot, potGeo, [px, 0.99, pz])
          const dead = rand() < 0.3
          const h = 0.25 + rand() * 0.3
          P.add(pc.foliage(dead ? '#d8b890' : '#7a9a5a'), crossedCards([px, 1.04, pz], h * 1.1, h, rand() * Math.PI, dead ? PC_UV.fern : PC_UV.birch, 2), ORIGIN)
        }
      }
    }
    return P.build()
  })
  return <Merged parts={parts} />
}

/* ---------------------------------------------------------------------------
 * Crossings and stairs
 * ------------------------------------------------------------------------- */

/** The road's concrete bridge: its deck and low walls (shared), a steel rail along each wall, a concrete pier under each end of the span. */
export function RoadBridge() {
  const parts = useParts('pc:roadBridge', () => {
    const P = new Pieces()
    const B = ROAD_BRIDGE
    for (const b of roadBridgePieces()) P.box(pc.concrete(), ...b.p, ...b.size, 1.5)
    for (const x of [B.x0 + B.wallT / 2, B.x1 - B.wallT / 2]) addRail(P, pc.steel(), [x, B.z0 + 0.2], [x, B.z1 - 0.2], B.top + B.wall, 0.45)
    // Where the deck leaves each bank: a footing down into the ground.
    for (const z of [B.z0 + 0.5, B.z1 - 0.5]) {
      const foot = Math.min(pinecrestGroundY(B.x0, z), pinecrestGroundY(B.x1, z)) - 0.5
      P.box(pc.concrete(), (B.x0 + B.x1) / 2, (B.top - B.deck + foot) / 2, z, B.x1 - B.x0 - 0.2, B.top - B.deck - foot, 0.6, 1.5)
    }
    return P.build()
  })
  return <Merged parts={parts} />
}

/** The footbridge: planks across two stringers on posts, a timber rail each side. */
export function Footbridge() {
  const parts = useParts('pc:footbridge', () => {
    const P = new Pieces()
    const B = FOOTBRIDGE
    const wood = pc.wood('#8a6a4a')
    const deck = pc.wood('#a08466')
    const cx = (B.x0 + B.x1) / 2
    for (let z = B.z0 + 0.08; z < B.z1; z += 0.2) P.box(deck, cx, B.top - 0.03, z, B.x1 - B.x0, 0.06, 0.17, 1)
    for (const x of [B.x0 + 0.2, B.x1 - 0.2]) P.box(wood, x, B.top - 0.14, (B.z0 + B.z1) / 2, 0.12, 0.16, B.z1 - B.z0, 1)
    // Posts down to the ground every few metres.
    for (let z = B.z0 + 0.3; z <= B.z1 - 0.29; z += (B.z1 - B.z0 - 0.6) / 4) {
      for (const x of [B.x0 + 0.2, B.x1 - 0.2]) {
        const g = pinecrestGroundY(x, z) - 0.2
        if (B.top - 0.22 - g < 0.1) continue
        P.box(wood, x, (B.top - 0.22 + g) / 2, z, 0.14, B.top - 0.22 - g, 0.14, 1)
      }
    }
    for (const x of [B.x0 + 0.05, B.x1 - 0.05]) addRail(P, wood, [x, B.z0], [x, B.z1], B.top, 1.0)
    return P.build()
  })
  return <Merged parts={parts} />
}

/** Planks laid across the stream, bedded on stones at each end. */
export function Planks() {
  const parts = useParts('pc:planks', () => {
    const P = new Pieces()
    const wood = pc.wood('#7a6048')
    PLANKS.forEach(([x, z, length, rotY], i) => {
      const y = creekBedY(x) + PLANK_LIFT
      P.withFrame([x, y, z], rotY, () => {
        for (const ox of [-0.3, 0, 0.3]) P.box(wood, ox, 0.13, 0, 0.28, 0.06, length - Math.abs(ox) * 0.4, 1)
        for (const oz of [-length / 2 + 0.3, length / 2 - 0.3]) P.box(wood, 0, 0.05, oz, 0.9, 0.1, 0.12, 1)
      })
      for (const s of [-1, 1]) P.add(pc.rock(), rockGeometry(8100 + i * 2 + s, 0.4, 0.5), [x - Math.sin(rotY) * s * 0.0, y, z + s * (length / 2 - 0.3)])
    })
    return P.build()
  })
  return <Merged parts={parts} />
}

/** The timber stairs: treads on two stringers, legs down to the ground, a rail up each side. */
export function Stairs() {
  const parts = useParts('pc:stairs', () => {
    const P = new Pieces()
    const wood = pc.wood('#8a6a4a')
    const tread = pc.wood('#a08466')
    for (const s of PC_STAIRS) {
      const dx = s.bottom[0] - s.top[0]
      const dz = s.bottom[2] - s.top[2]
      const run = Math.hypot(dx, dz)
      const rise = s.top[1] - s.bottom[1]
      const ux = dx / run
      const uz = dz / run
      const yaw = Math.atan2(dx, dz)
      const n = Math.ceil(rise / 0.2)
      const at = (f, side = 0, up = 0) => [s.top[0] + dx * f - uz * side, s.top[1] - rise * f + up, s.top[2] + dz * f + ux * side]
      for (let i = 0; i < n; i++) {
        const c = at((i + 0.5) / n)
        P.add(tread, boxGeo(s.width, 0.05, run / n + 0.04, 1), [c[0], c[1] - 0.02, c[2]], [0, yaw, 0])
      }
      for (const side of [-1, 1]) {
        const o = side * (s.width / 2 - 0.04)
        const r = rampBox(at(0, o, -0.12), at(1, o, -0.12), 0.07, 0.24)
        P.add(wood, boxGeo(...r.size, 1), r.p, quat(r.q))
        // Legs to the ground, a rail post on each, the handrail along the tops.
        const legs = Math.max(2, Math.round(run / 1.6) + 1)
        for (let k = 0; k < legs; k++) {
          const p = at(k / (legs - 1), o)
          const g = pinecrestGroundY(p[0], p[2]) - 0.15
          if (p[1] - 0.2 - g > 0.1) P.box(wood, p[0], (p[1] - 0.2 + g) / 2, p[2], 0.1, p[1] - 0.2 - g, 0.1, 1)
          P.box(wood, p[0], p[1] + 0.5, p[2], 0.07, 1.0, 0.07, 1)
        }
        addBar(P, wood, at(0, o, 1.0), at(1, o, 1.0), 0.08, 0.06)
        addBar(P, wood, at(0, o, 0.5), at(1, o, 0.5), 0.05, 0.05)
      }
    }
    return P.build()
  })
  return <Merged parts={parts} />
}

/** The boathouse's deck on posts over the bluff, railed round, and the dock out on the lake. */
export function Deck() {
  const parts = useParts('pc:deck', () => {
    const P = new Pieces()
    const D = DECK
    const wood = pc.wood('#8a6a4a')
    const board = pc.wood('#9c7e62')
    for (let x = D.x0 + 0.08; x < D.x1; x += 0.18) P.box(board, x, D.top - 0.03, (D.z0 + D.z1) / 2, 0.16, 0.06, D.z1 - D.z0, 1)
    for (const z of [D.z0 + 0.15, (D.z0 + D.z1) / 2, D.z1 - 0.15]) P.box(wood, (D.x0 + D.x1) / 2, D.top - 0.15, z, D.x1 - D.x0, 0.18, 0.12, 1)
    for (const x of [D.x0 + 0.15, D.x1 - 0.4]) {
      for (const z of [D.z0 + 0.2, (D.z0 + D.z1) / 2, D.z1 - 0.2]) {
        const g = pinecrestGroundY(x, z) - 0.2
        if (D.top - 0.24 - g > 0.1) P.box(wood, x, (D.top - 0.24 + g) / 2, z, 0.16, D.top - 0.24 - g, 0.16, 1)
      }
    }
    // Rails round it (the stair leaves from the north-west corner).
    addRail(P, wood, [D.x0 + 0.04, D.z0 + 1.4], [D.x0 + 0.04, D.z1], D.top, 1.0)
    addRail(P, wood, [D.x0 + 1.3, D.z0 + 0.04], [D.x1, D.z0 + 0.04], D.top, 1.0)
    addRail(P, wood, [D.x0, D.z1 - 0.04], [D.x1, D.z1 - 0.04], D.top, 1.0)
    // The dock: boards across, on piles down into the lake bed.
    const K = DOCK
    for (let x = K.x0 + 0.1; x < K.x1; x += 0.2) P.box(board, x, K.top - 0.03, (K.z0 + K.z1) / 2, 0.18, 0.06, K.z1 - K.z0, 1)
    for (const z of [K.z0 + 0.15, K.z1 - 0.15]) P.box(wood, (K.x0 + K.x1) / 2, K.top - 0.15, z, K.x1 - K.x0, 0.18, 0.12, 1)
    for (let x = K.x0 + 0.2; x <= K.x1 - 0.19; x += (K.x1 - K.x0 - 0.4) / 3) {
      for (const z of [K.z0 + 0.1, K.z1 - 0.1]) {
        const g = pinecrestGroundY(x, z) - 0.4
        P.add(wood, new CylinderGeometry(0.11, 0.11, K.top + 0.3 - g, 8), [x, (K.top + 0.3 + g) / 2, z])
      }
    }
    // A mooring cleat and a coil of rope.
    P.box(pc.paint('#3a3a38', 0.5, 0.6), K.x0 + 1.4, K.top + 0.04, K.z0 + 0.2, 0.3, 0.08, 0.08, 1)
    return P.build()
  })
  return <Merged parts={parts} />
}

/** A hull as a surface: U-shaped sections from the transom to the bow, narrowing and rising to a point. */
function hullGeometry(L, W, depth, inside) {
  const pos = []
  const nor = []
  const uv = []
  const idx = []
  const rings = 12
  const shape = [[-1, 1], [-0.92, 0.45], [-0.55, 0.04], [0, 0], [0.55, 0.04], [0.92, 0.45], [1, 1]]
  for (let r = 0; r <= rings; r++) {
    const t = r / rings
    const z = -L / 2 + L * t
    // Full width aft, narrowing into the bow over its last third.
    const half = (W / 2) * (t < 0.6 ? 1 - 0.06 * (1 - t / 0.6) : Math.sqrt(Math.max(0, 1 - ((t - 0.6) / 0.4) ** 2)))
    const keel = -depth + (t > 0.6 ? depth * 0.8 * ((t - 0.6) / 0.4) ** 2 : 0)
    for (const [sx, sy] of shape) {
      pos.push(sx * half, keel + (0.45 - keel) * sy, z)
      nor.push(sx * 0.8 * (inside ? -1 : 1), (sy < 0.3 ? -0.6 : 0) * (inside ? -1 : 1), 0)
      uv.push(sx, z)
    }
    if (r > 0) {
      const a = (r - 1) * shape.length
      const b = r * shape.length
      for (let k = 0; k < shape.length - 1; k++) {
        if (inside) idx.push(a + k, a + k + 1, b + k, a + k + 1, b + k + 1, b + k)
        else idx.push(a + k, b + k, a + k + 1, a + k + 1, b + k, b + k + 1)
      }
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  if (inside) {
    const n = g.getAttribute('normal')
    for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i))
  }
  return g
}

/** The rowing boat at the dock: white outside, varnished inside, two thwarts, a pair of oars. */
export function Boat({ p, rotY, length, width }) {
  const parts = useParts('pc:boat', () => {
    const P = new Pieces()
    const wood = pc.wood('#9a7656')
    P.add(pc.paint('#e8e4da', 0.6), hullGeometry(length, width, 0.32, false), ORIGIN)
    P.add(wood, hullGeometry(length, width, 0.32, true), ORIGIN)
    P.add(pc.paint('#2f5a4a', 0.6), boxGeo(0.06, 0.06, length * 0.82, 1), [-width / 2 + 0.02, 0.46, -length * 0.08])
    P.add(pc.paint('#2f5a4a', 0.6), boxGeo(0.06, 0.06, length * 0.82, 1), [width / 2 - 0.02, 0.46, -length * 0.08])
    for (const z of [-0.6, 0.5]) P.box(wood, 0, 0.26, z, width - 0.16, 0.05, 0.26, 1)
    P.box(wood, 0, 0.25, -length / 2 + 0.04, width - 0.1, 0.4, 0.06, 1)
    for (const s of [-1, 1]) addBar(P, wood, [s * 0.3, 0.32, -0.9], [s * 0.45, 0.36, 1.2], 0.05, 0.03)
    return P.build()
  })
  return (
    <group position={[p[0], p[1], p[2]]} rotation={[0, rotY, 0]}>
      <Merged parts={parts} />
    </group>
  )
}

/* ---------------------------------------------------------------------------
 * The substation, the pylons
 * ------------------------------------------------------------------------- */

/** One transformer at the origin: a green tank on a concrete pad, cooling fins down its sides, bushings and a conservator tank on top. */
function addTransformer(P, x, z) {
  const green = pc.transformer()
  P.box(pc.concrete(), x, 0.075, z, 2.6, 0.15, 2.0, 1.5)
  P.box(green, x, 1.1, z, 1.9, 1.9, 1.2, 1)
  P.box(green, x, 2.08, z, 2.05, 0.08, 1.35, 1)
  for (const s of [-1, 1]) {
    for (let i = 0; i < 7; i++) P.box(green, x - 0.75 + i * 0.25, 1.05, z + s * 0.72, 0.04, 1.5, 0.26, 1)
  }
  P.add(green, new CylinderGeometry(0.2, 0.2, 1.5, 12), [x, 2.32, z - 0.35], [0, 0, Math.PI / 2])
  for (const k of [-0.6, 0, 0.6]) {
    P.add(pc.porcelain(), new CylinderGeometry(0.06, 0.08, 0.36, 8), [x + k, 2.3, z + 0.3])
    for (let r = 0; r < 3; r++) P.add(pc.porcelain(), new CylinderGeometry(0.1, 0.1, 0.03, 8), [x + k, 2.18 + r * 0.1, z + 0.3])
  }
  P.box(pc.paint('#d8c040', 0.6), x, 1.4, z + 0.62, 0.3, 0.22, 0.02, 1)
}

/**
 * The substation: a chain-link fence (barbed wire along the top, black tarps
 * hung over long stretches of it), the transformers in two rows, the control
 * cabinet, and the steel gantry the line comes in to.
 */
export function Substation() {
  const parts = useParts('pc:substation', () => {
    const P = new Pieces()
    const S = SUBSTATION
    const rand = seededRandom(7911)
    const steel = pc.steel()
    const post = new CylinderGeometry(0.045, 0.05, S.height + 0.1, 6)
    for (const [ax, az, bx, bz] of substationFence()) {
      const len = Math.hypot(bx - ax, bz - az)
      if (len < 0.1) continue
      const ux = (bx - ax) / len
      const uz = (bz - az) / len
      const yaw = Math.atan2(-uz, ux)
      const n = Math.max(1, Math.round(len / 2.5))
      for (let i = 0; i <= n; i++) P.add(steel, post, [ax + ux * len * (i / n), (S.height + 0.1) / 2, az + uz * len * (i / n)])
      addBar(P, steel, [ax, S.height, az], [bx, S.height, bz], 0.05, 0.05)
      addBar(P, steel, [ax, 0.1, az], [bx, 0.1, bz], 0.03, 0.03)
      P.add(pc.chainLink(), boxGeo(len, S.height - 0.1, 0.01, 0.25), [(ax + bx) / 2, S.height / 2 + 0.03, (az + bz) / 2], [0, yaw, 0])
      // Barbed wire on arms leaning out.
      for (const k of [0.12, 0.24, 0.36]) addBar(P, steel, [ax - uz * k * 0.6, S.height + k, az + ux * k * 0.6], [bx - uz * k * 0.6, S.height + k, bz + ux * k * 0.6], 0.012, 0.012)
      // Tarps over stretches of it, outside, sagging a little.
      for (let i = 0; i < n; i++) {
        if (rand() < 0.45) continue
        const a = (i / n) * len
        const b = ((i + 1) / n) * len
        const h = 1.6 + rand() * 0.6
        const mid = (a + b) / 2
        P.add(pc.tarp(), boxGeo(b - a + 0.05, h, 0.015, 1), [ax + ux * mid - uz * 0.05, S.height - 0.05 - h / 2, az + uz * mid + ux * 0.05], [(rand() - 0.5) * 0.04, yaw, (rand() - 0.5) * 0.03])
      }
    }
    for (const [x, z] of S.transformers) addTransformer(P, x, z)
    // The control cabinet by the south gate.
    const cab = pc.paint('#8c9290', 0.5, 0.5)
    P.box(cab, -31.6, 0.95, -33.9, 2.0, 1.9, 0.6, 1)
    for (const x of [-32.1, -31.1]) P.box(pc.paint('#5a605e', 0.5, 0.5), x, 1.0, -33.59, 0.9, 1.6, 0.02, 1)
    // The gantry the line comes in to, by the east fence.
    for (const z of [-45.6, -42.4]) {
      P.box(steel, -19.6, 3.4, z, 0.3, 6.8, 0.3, 1)
      for (let y = 0.8; y < 6.4; y += 1.2) addBar(P, steel, [-19.6, y, z - 0.14], [-19.6, y + 1.0, z + 0.14], 0.04, 0.04)
    }
    P.box(steel, -19.6, 6.6, -44, 0.3, 0.3, 3.8, 1)
    for (const z of [-45, -44, -43]) P.add(pc.porcelain(), new CylinderGeometry(0.07, 0.07, 0.6, 8), [-19.6, 6.2, z])
    // Danger signs on the gates.
    for (const [x, z, yaw] of [[-18.0, -37.2, Math.PI / 2], [-24.0, -33.0, 0], [-27.8, -33.0, 0]]) P.box(pc.paint('#e2b42a', 0.6), x, 1.5, z, 0.42, 0.3, 0.02, 1, [0, yaw, 0])
    return P.build()
  })
  return <Merged parts={parts} />
}

/** The red lattice pylons out past the edge, and the lines they carry over the valley. */
export function Pylons() {
  const parts = useParts('pc:pylons', () => {
    const P = new Pieces()
    const red = pc.pylon()
    for (const [x, z, rotY] of PYLONS) {
      const y0 = farGroundY(x, z) - 0.5
      P.withFrame([x, y0, z], rotY, () => {
        const H = 32
        const corner = (y) => {
          const w = y < 24 ? 3 - (y / 24) * 2.2 : 0.8
          return [[-w, -w], [w, -w], [w, w], [-w, w]]
        }
        const levels = [0, 4, 8, 12, 16, 20, 24, 28, H]
        for (let i = 0; i < levels.length - 1; i++) {
          const a = corner(levels[i])
          const b = corner(levels[i + 1])
          for (let k = 0; k < 4; k++) {
            const n = (k + 1) % 4
            addBar(P, red, [a[k][0], levels[i], a[k][1]], [b[k][0], levels[i + 1], b[k][1]], 0.14, 0.14)
            addBar(P, red, [b[k][0], levels[i + 1], b[k][1]], [b[n][0], levels[i + 1], b[n][1]], 0.07, 0.07)
            addBar(P, red, [a[k][0], levels[i], a[k][1]], [b[n][0], levels[i + 1], b[n][1]], 0.05, 0.05)
            addBar(P, red, [a[n][0], levels[i], a[n][1]], [b[k][0], levels[i + 1], b[k][1]], 0.05, 0.05)
          }
        }
        // Cross-arms, insulators hanging from their ends.
        for (const [y, reach] of [[24, 7], [29, 5]]) {
          for (const s of [-1, 1]) {
            addBar(P, red, [s * 0.8, y, -0.6], [s * reach, y, 0], 0.1, 0.1)
            addBar(P, red, [s * 0.8, y, 0.6], [s * reach, y, 0], 0.1, 0.1)
            addBar(P, red, [s * 0.8, y + 2, 0], [s * reach, y, 0], 0.07, 0.07)
            P.add(pc.porcelain(), new CylinderGeometry(0.12, 0.12, 1.4, 8), [s * reach, y - 0.7, 0])
          }
        }
      })
    }
    return P.build()
  })
  const wires = useMemo(
    () =>
      once('pc:pylonWires', () => {
        // Each pylon's arm tips in the world, then sagging spans between neighbours (and off past the ends).
        const tips = PYLONS.map(([x, z, rotY]) => {
          const y0 = farGroundY(x, z) - 0.5
          const out = []
          for (const [y, reach] of [[24, 7], [29, 5]]) for (const s of [-1, 1]) out.push([x + Math.cos(rotY) * s * reach, y0 + y - 1.4, z - Math.sin(rotY) * s * reach])
          return out
        })
        const ends = [tips[0].map(([x, y, z]) => [x - 160, y + 10, z - 260]), ...tips, tips[tips.length - 1].map(([x, y, z]) => [x + 40, y + 6, z + 280])]
        const pts = []
        for (let i = 0; i < ends.length - 1; i++) {
          for (let k = 0; k < ends[i].length; k++) {
            const a = ends[i][k]
            const b = ends[i + 1][k]
            const span = Math.hypot(b[0] - a[0], b[2] - a[2])
            let prev = null
            for (let j = 0; j <= 20; j++) {
              const t = j / 20
              const pt = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * span * 0.035, a[2] + (b[2] - a[2]) * t]
              if (prev) pts.push(...prev, ...pt)
              prev = pt
            }
          }
        }
        const g = new BufferGeometry()
        g.setAttribute('position', new Float32BufferAttribute(pts, 3))
        return g
      }),
    [],
  )
  return (
    <group>
      <Merged parts={parts} shadow={false} />
      <lineSegments geometry={wires}>
        <lineBasicMaterial color="#2a2624" />
      </lineSegments>
    </group>
  )
}

/* ---------------------------------------------------------------------------
 * Rocks, logs, stumps
 * ------------------------------------------------------------------------- */

export function Boulder({ p, r, seed }) {
  const parts = useParts(keyOf('boulder', p, `${r}:${seed}`), () => {
    const P = new Pieces()
    const rand = seededRandom(seed)
    P.add(pc.rock(), rockGeometry(seed, r * 1.05, 0.72), [p[0], p[1] + r * 0.32, p[2]], [0, rand() * 6, 0])
    // A smaller one leaning against it now and then.
    if (rand() < 0.5) {
      const a = rand() * Math.PI * 2
      P.add(pc.rock(), rockGeometry(seed + 1, r * 0.45, 0.7), [p[0] + Math.cos(a) * r * 1.0, p[1] + r * 0.1, p[2] + Math.sin(a) * r * 1.0], [0, rand() * 6, 0])
    }
    return P.build()
  })
  return <Merged parts={parts} />
}

/** A fallen pine: bark, pale sawn ends, a couple of broken-off branches. */
export function Log({ a, b, r }) {
  const parts = useParts(keyOf('log', a, `${b[0]}:${b[2]}`), () => {
    const P = new Pieces()
    const bark = pc.pineBark()
    addSegment(P, bark, a, b, r, r * 0.92, 10)
    const d = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize()
    const cap = new CircleGeometry(1, 10)
    for (const [end, s, rr] of [[a, -1, r], [b, 1, r * 0.92]]) {
      const q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), d.clone().multiplyScalar(s))
      P.add(pc.endGrain(), cap, end, q, [rr, rr, 1])
    }
    const rand = seededRandom(Math.round(a[0] * 100 + a[2]))
    for (let i = 0; i < 2; i++) {
      const t = 0.3 + rand() * 0.5
      const o = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + r * 0.6, a[2] + (b[2] - a[2]) * t]
      addSegment(P, bark, o, [o[0] + (rand() - 0.5) * 0.6, o[1] + 0.5 + rand() * 0.3, o[2] + (rand() - 0.5) * 0.6], r * 0.25, r * 0.12, 5)
    }
    return P.build()
  })
  return <Merged parts={parts} />
}

export function Stump({ p }) {
  const parts = useParts(keyOf('stump', p), () => {
    const P = new Pieces()
    P.add(pc.pineBark(), new CylinderGeometry(0.34, 0.42, 0.6, 10, 1, true), [p[0], p[1] + 0.2, p[2]])
    P.add(pc.endGrain(), new CircleGeometry(0.34, 10), [p[0], p[1] + 0.5, p[2]], [-Math.PI / 2, 0, 0])
    const rand = seededRandom(Math.round(p[0] * 31 + p[2] * 7))
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + rand() * 0.6
      addSegment(P, pc.pineBark(), [p[0] + Math.cos(a) * 0.25, p[1] + 0.2, p[2] + Math.sin(a) * 0.25], [p[0] + Math.cos(a) * 0.75, p[1] - 0.08, p[2] + Math.sin(a) * 0.75], 0.11, 0.05, 5)
    }
    return P.build()
  })
  return <Merged parts={parts} />
}

/* ---------------------------------------------------------------------------
 * Trees and the undergrowth
 * ------------------------------------------------------------------------- */

export function Tree({ p, h, kind, seed }) {
  const parts = useParts(keyOf('tree', p, `${h}:${seed}:${kind}`), () => {
    const P = new Pieces()
    if (kind === 'pine') addPine(P, p, h, seed)
    else addBirch(P, p, h, seed)
    return P.build()
  })
  return <Merged parts={parts} />
}

/**
 * The colliders standing on the ground, filed by 4 m cell (each in every cell
 * within 2 m of it), so placing thousands of plants only ever looks at the
 * few nearby. Returns `blocked(x, z, y, margin)`: true if (x, z) is within
 * `margin` of one standing on the ground at height y.
 */
function obstacles(colliders) {
  const CELL = 4
  const PAD = 2
  const key = (i, k) => (i + 512) * 1024 + k + 512
  const grid = new Map()
  for (const c of colliders) {
    const R = (c.shape === 'box' ? Math.hypot(c.half[0], c.half[2]) : c.r) + PAD
    for (let i = Math.floor((c.p[0] - R) / CELL); i <= Math.floor((c.p[0] + R) / CELL); i++) {
      for (let k = Math.floor((c.p[2] - R) / CELL); k <= Math.floor((c.p[2] + R) / CELL); k++) {
        const kk = key(i, k)
        if (!grid.has(kk)) grid.set(kk, [])
        grid.get(kk).push(c)
      }
    }
  }
  return (x, z, y, margin) => {
    for (const c of grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL))) ?? []) {
      if (c.p[1] - (c.half ? c.half[1] : c.halfHeight) > y + 0.6) continue
      if (c.shape === 'box') {
        const l = rotate3([x - c.p[0], 0, z - c.p[2]], [-c.q[0], -c.q[1], -c.q[2], c.q[3]])
        if (Math.abs(l[0]) < c.half[0] + margin && Math.abs(l[2]) < c.half[2] + margin) return true
      } else if (Math.hypot(x - c.p[0], z - c.p[2]) < c.r + margin) return true
    }
    return false
  }
}

/** The ground's height at (x, z) and how steeply it slopes there (rise per metre). */
function groundAt(x, z) {
  const y = pinecrestGroundY(x, z)
  const gx = (pinecrestGroundY(x + 0.25, z) - pinecrestGroundY(x - 0.25, z)) / 0.5
  const gz = (pinecrestGroundY(x, z + 0.25) - pinecrestGroundY(x, z - 0.25)) / 0.5
  return [y, Math.hypot(gx, gz)]
}

/**
 * Bracken, dry grass and shrubs, thickest round the trees, the rocks and the
 * walls, along the creek's banks and the lake's bluff; never indoors, on the
 * road or a path, in a yard or the water, nor up on the bare rock. Each
 * stands on the ground where it is, sunk a little on a slope so its downhill
 * edge doesn't float.
 */
export function Undergrowth() {
  const parts = useParts('pc:undergrowth', () => {
    const P = new Pieces()
    const rand = seededRandom(7951)
    const colliders = buildPinecrestColliders().filter((c) => c.shape !== 'mesh' && !(c.shape === 'box' && (c.half[0] > 30 || c.half[2] > 30)))
    const blocked = obstacles(colliders)
    const trees = obstacles(colliders.filter((c) => c.shape === 'cyl' && c.r <= 0.31))
    const H = PINECREST_HALF - 0.6
    const indoors = (x, z) => HOUSES.some((b) => x > b.x0 - 0.2 && x < b.x1 + 0.2 && z > b.z0 - 0.2 && z < b.z1 + 0.2) || (x > GREENHOUSE.x0 - 0.2 && x < GREENHOUSE.x1 + 0.2 && z > GREENHOUSE.z0 - 0.2 && z < GREENHOUSE.z1 + 0.2)
    const counts = { fern: 0, grass: 0, shrub: 0 }
    const max = { fern: 760, grass: 700, shrub: 130 }
    for (let tries = 0; tries < 24000 && (counts.fern < max.fern || counts.grass < max.grass || counts.shrub < max.shrub); tries++) {
      const x = (rand() * 2 - 1) * H
      const z = (rand() * 2 - 1) * H
      if (x < shoreX(z) + 0.6 || indoors(x, z)) continue
      const [y, slope] = groundAt(x, z)
      if (slope > 1.2 || y < LAKE.shore + 0.15) continue
      if (inCreek(x, z) && y < creekBedY(x) + 0.3) continue
      if (blocked(x, z, y, 0.3) || gravelAt(x, z) > 0.35) continue
      // Thicker near the trees, the banks, the walls and the edge.
      const near = trees(x, z, y, 1.9) || inCreek(x, z, 1.2) || blocked(x, z, y, 1.6) || Math.abs(x) > H - 4 || Math.abs(z) > H - 4
      if (!near && rand() < 0.6) continue
      const foot = (w) => y - Math.min(0.35, slope * w * 0.5) - 0.02
      const kind = rand()
      if (kind < 0.1 && counts.shrub < max.shrub && near) {
        const s = 0.9 + rand() * 0.7
        addShrub(P, [x, foot(s * 1.3), z], s, rand)
        counts.shrub++
      } else if (kind < 0.58 && counts.fern < max.fern) {
        const s = 0.7 + rand() * 0.55
        addFern(P, [x, foot(s * 1.4), z], s, rand)
        counts.fern++
      } else if (counts.grass < max.grass) {
        const s = 0.45 + rand() * 0.45
        addGrass(P, [x, foot(s * 0.9), z], s, rand)
        counts.grass++
      }
    }
    return P.build()
  })
  return <Merged parts={parts} shadow={false} />
}

/**
 * Stones in the creek: a scatter along its bed, some breaking the water,
 * bigger ones either side of the waterfall's lip and round its pool.
 */
export function CreekStones() {
  const parts = useParts('pc:creekStones', () => {
    const P = new Pieces()
    const rand = seededRandom(7961)
    const rock = pc.rock()
    for (let i = 0; i < 150; i++) {
      const x = -40 + rand() * 96
      if (Math.abs(x - CREEK.fallX) < 1.9) continue
      if (x > ROAD_BRIDGE.x0 - 0.5 && x < ROAD_BRIDGE.x1 + 0.5) continue
      if (PLANKS.some(([px]) => Math.abs(px - x) < 1.0)) continue
      if (Math.abs(x - 12.6) < 3) continue
      const s = creekSection(x)
      const o = (rand() * 2 - 1) * (s.bed + 0.4)
      const z = s.z - o
      const r = 0.1 + rand() ** 2 * 0.32
      P.add(rock, rockGeometry(9000 + i, r, 0.55), [x, pinecrestGroundY(x, z) + r * 0.12, z], [0, rand() * 6, 0])
    }
    const f = CREEK.fallX
    for (const [dx, side, r] of [[1.3, 1, 0.8], [1.1, -1, 0.9], [-1.6, 1, 0.7], [-2.0, -1, 0.75], [2.1, 1, 0.5], [-3.0, -1, 0.55]]) {
      const x = f + dx
      const s = creekSection(x)
      const z = s.z - side * (s.bed + 0.15)
      P.add(rock, rockGeometry(9400 + Math.round(dx * 10), r, 0.7), [x, pinecrestGroundY(x, z) + r * 0.2, z], [0, rand() * 6, 0])
    }
    return P.build()
  })
  return <Merged parts={parts} />
}
