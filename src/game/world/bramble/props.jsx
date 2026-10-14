import { useMemo } from 'react'
import { ConeGeometry, CylinderGeometry, DodecahedronGeometry, Quaternion, SphereGeometry, TorusGeometry } from 'three'

import { houseWallBoxes, towerDeckPieces } from '../../../shared/mapAcres.js'
import {
  BOARDWALK,
  BR_POWER_LINES,
  BRAMBLE_FURNITURE,
  BRAMBLE_HALF,
  brambleGroundY,
  BRIDGE,
  bridgePieces,
  boardwalkPosts,
  buildBrambleColliders,
  CREEK,
  CREEK_END,
  creekSection,
  FIELD,
  FUEL_TANK,
  HOUSES,
  inCreek,
  puddleLevel,
  ROADS,
  RUINS,
  ruinPieces,
  SHACKS,
  TANK,
  TRACTOR,
  WATER_TOWER,
} from '../../../shared/mapBramble.js'
import { buildingWallBoxes } from '../../../shared/mapPalmwood.js'
import { rampBox } from '../../../shared/mapKit.js'
import { rotate3, seededRandom } from '../../../shared/math.js'
import { Merged } from '../acres/merge.jsx'
import { once, Pieces } from '../acres/pieces.js'
import { boxGeo } from '../materials.js'
import { addSegment } from '../hollow/kit.js'
import { addSheets } from '../palmwood/kit.js'
import { addBar } from '../quarter/kit.js'
import { addTree, crossedCards, flatCard, ivyPatch } from './kit.js'
import { br } from './materials.js'
import { BR_UV } from './textures.js'

/**
 * Bramblewood's props: trees, the undergrowth and the ivy, the ruin, rail
 * fences, the burnt-out tank, the tractor, the fuel tank, the covered
 * boardwalk, the water tower, and the furniture. Each is merged into a few
 * meshes and cached; the static batcher merges them all by material, so
 * every leaf in the map is one draw.
 */

function useParts(key, build) {
  return useMemo(() => once(key, build), [key]) // eslint-disable-line react-hooks/exhaustive-deps
}
const keyOf = (kind, p, extra = '') => `br:${kind}:${p[0].toFixed(2)}:${p[2].toFixed(2)}:${extra}`
const _q = new Quaternion()

export function Tree({ p, h, seed, autumn }) {
  const parts = useParts(keyOf('tree', p, `${h}:${seed}`), () => {
    const P = new Pieces()
    addTree(P, p, h, seed, { autumn })
    return P.build()
  })
  return <Merged parts={parts} />
}

/* ---------------------------------------------------------------------------
 * The undergrowth: bushes, ferns and tall grass; the creek's reeds and stones
 * ------------------------------------------------------------------------- */

/** True if (x, z) is within `margin` of anything solid standing on the ground. */
function blocked(colliders, x, z, margin) {
  for (const c of colliders) {
    if (c.p[1] - (c.half ? c.half[1] : c.halfHeight) > 0.6 || c.p[1] > 40) continue
    if (c.shape === 'box') {
      const inv = [-c.q[0], -c.q[1], -c.q[2], c.q[3]]
      const l = rotate3([x - c.p[0], 0, z - c.p[2]], inv)
      if (Math.abs(l[0]) < c.half[0] + margin && Math.abs(l[2]) < c.half[2] + margin) return true
    } else if (Math.hypot(x - c.p[0], z - c.p[2]) < c.r + margin) return true
  }
  return false
}

function distToPath(points, x, z) {
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

/** The ground's height at (x, z) and how steeply it slopes there (rise per metre). */
function groundAt(x, z) {
  const y = brambleGroundY(x, z)
  const gx = (brambleGroundY(x + 0.25, z) - brambleGroundY(x - 0.25, z)) / 0.5
  const gz = (brambleGroundY(x, z + 0.25) - brambleGroundY(x, z - 0.25)) / 0.5
  return [y, Math.hypot(gx, gz)]
}

/** The water standing at x, if a puddle's there (its level), else -Infinity. */
const waterAt = (x) => {
  const p = CREEK.puddles.find(([a, b]) => x > a - 1.5 && x < b + 1.5)
  return p ? puddleLevel(p) : -Infinity
}

/**
 * Bushes, ferns and tall grass, thickest along the walls, fences and trees,
 * the creek and the field's edges; never indoors, on the boardwalk or the
 * bridge, in the middle of a road or under water. Each stands on the ground
 * where it is (down the creek's banks and along its bed), sunk a little on a
 * slope so its downhill edge doesn't float. Then the creek's own: reeds round
 * the puddles, dry grass and ferns down the banks, stones in the bed.
 */
export function Undergrowth({ seed }) {
  const parts = useParts(`br:undergrowth:${seed}`, () => {
    const P = new Pieces()
    const rand = seededRandom(seed)
    const colliders = buildBrambleColliders().filter((c) => c.shape !== 'mesh' && !(c.shape === 'box' && (c.half[0] > 30 || c.half[2] > 30)))
    const H = BRAMBLE_HALF - 0.4
    const inside = (x, z, r, m) => x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m
    const ok = (x, z, onRoad) => {
      if (HOUSES.some((b) => inside(x, z, b, 0.15)) || SHACKS.some((b) => inside(x, z, b, 0.15))) return false
      if (inside(x, z, BOARDWALK, 0.3) || inside(x, z, BRIDGE, 0.3)) return false
      if (!onRoad && ROADS.some((r) => distToPath(r.points, x, z) < r.width / 2 - 0.4)) return false
      return true
    }
    const tint = () => ['#ffffff', '#eef4e2', '#dfe8cc', '#f6f2dc'][Math.floor(rand() * 4)]
    /** Where a plant `w` wide stands: on the ground, sunk by its slope; null if under water. */
    const foot = (x, z, w) => {
      const [y, slope] = groundAt(x, z)
      if (y < waterAt(x) + 0.03) return null
      return y - Math.min(0.4, slope * w * 0.5) - 0.02
    }
    let grass = 0
    let ferns = 0
    let bushes = 0
    for (let tries = 0; tries < 26000 && (grass < 1900 || ferns < 260 || bushes < 250); tries++) {
      const x = (rand() * 2 - 1) * H
      const z = (rand() * 2 - 1) * H
      if (!ok(x, z, false)) continue
      if (blocked(colliders, x, z, 0.25)) continue
      const creek = inCreek(x, z, 1.5)
      const near = creek || blocked(colliders, x, z, 2.0) || Math.abs(x) > H - 3 || Math.abs(z) > H - 3
      const inField = inside(x, z, FIELD, -0.5)
      const kind = rand()
      if (kind < 0.12 && bushes < 250 && (near || rand() < 0.25) && !inField && !(creek && rand() < 0.5)) {
        const s = 1.1 + rand() * 0.9
        const y = foot(x, z, s * 1.3)
        if (y === null) continue
        const t = tint()
        P.add(br.foliage(t), crossedCards([x, y - 0.1, z], s * 1.3, s, rand() * Math.PI, BR_UV.leaves, 3), [0, 0, 0])
        P.add(br.foliage(t), flatCard([x, y + s * 0.7, z], s * 1.1, rand() * 6, 0.25, BR_UV.leaves), [0, 0, 0])
        bushes++
      } else if (kind < 0.24 && ferns < 260 && (near || rand() < 0.3) && !inField) {
        const s = 0.8 + rand() * 0.6
        const y = foot(x, z, s * 1.4)
        if (y === null) continue
        P.add(br.foliage(tint()), crossedCards([x, y, z], s * 1.4, s, rand() * Math.PI, BR_UV.fern, 2), [0, 0, 0])
        ferns++
      } else if (grass < 1900 && (near || rand() < (inField ? 0.12 : 0.45))) {
        const s = 0.7 + rand() * 0.6
        const y = foot(x, z, s * 0.9)
        if (y === null) continue
        P.add(br.foliage(tint()), crossedCards([x, y, z], s * 0.9, s, rand() * Math.PI, BR_UV.grass, 2), [0, 0, 0])
        grass++
      }
    }
    // The creek: a point `o` off its middle line (north +) at x, on the ground.
    const across = (x, o) => {
      const s = creekSection(x)
      const z = s.z - o
      return [x, brambleGroundY(x, z), z, s]
    }
    const clear = (x, z) => ok(x, z, true) && !blocked(colliders, x, z, 0.2)
    // Reeds thick round the puddles, standing in the shallows and along the bed's edges.
    for (const [a, b] of CREEK.puddles) {
      const level = puddleLevel([a, b])
      for (let i = 0; i < 46; i++) {
        const x = a - 1 + rand() * (b - a + 2)
        const s0 = creekSection(x)
        const o = s0.shift + (rand() < 0.5 ? -1 : 1) * s0.bed * (0.35 + rand() * 0.75)
        const [, y, z] = across(x, o)
        if (!clear(x, z)) continue
        const s = 1.0 + rand() * 0.7
        P.add(br.foliage('#e4ecc8'), crossedCards([x, Math.max(y, level) - 0.05, z], s * 0.7, s * 1.3, rand() * Math.PI, BR_UV.grass, 2), [0, 0, 0])
      }
    }
    // Dry grass along the bed, ferns down the banks.
    for (let i = 0; i < 520; i++) {
      const x = (rand() * 2 - 1) * (CREEK_END - 1)
      const s0 = creekSection(x)
      const bank = rand() < 0.45
      const o = bank ? (rand() < 0.5 ? 1 : -1) * (s0.bed + 0.2 + rand() * (s0.top - s0.bed - 0.6)) + s0.shift * 0.5 : s0.shift + (rand() * 2 - 1) * s0.bed * 0.95
      const [, , z] = across(x, o)
      if (!clear(x, z)) continue
      const s = bank ? 0.7 + rand() * 0.5 : 0.5 + rand() * 0.5
      const y = foot(x, z, s)
      if (y === null) continue
      if (bank) P.add(br.foliage(tint()), crossedCards([x, y, z], s * 1.3, s, rand() * Math.PI, BR_UV.fern, 2), [0, 0, 0])
      else P.add(br.foliage('#f2e6c0'), crossedCards([x, y, z], s * 0.9, s * 0.8, rand() * Math.PI, BR_UV.grass, 2), [0, 0, 0])
    }
    // Stones: scattered down the bed, a few bigger ones bedded in the banks.
    const stone = new DodecahedronGeometry(1, 0)
    for (let i = 0; i < 260; i++) {
      const x = (rand() * 2 - 1) * (CREEK_END - 1)
      const s0 = creekSection(x)
      const big = rand() < 0.15
      const o = big ? (rand() < 0.5 ? 1 : -1) * (s0.bed + rand() * (s0.top - s0.bed) * 0.7) + s0.shift : s0.shift + (rand() * 2 - 1) * s0.bed
      const [, y, z] = across(x, o)
      if (!clear(x, z)) continue
      const r = big ? 0.16 + rand() * 0.14 : 0.05 + rand() * 0.1
      P.add(br.pebble(), stone, [x, y + r * 0.15, z], [rand() * 6, rand() * 6, rand() * 6], [r * (1 + rand() * 0.5), r * 0.6, r])
    }
    return P.build()
  })
  return <Merged parts={parts} shadow={false} />
}

/* ---------------------------------------------------------------------------
 * Ivy: up the walls, the poles and the water tower's legs
 * ------------------------------------------------------------------------- */

const OUT = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }

export function Ivy({ seed }) {
  const parts = useParts(`br:ivy:${seed}`, () => {
    const P = new Pieces()
    const rand = seededRandom(seed)
    const ivy = (t) => br.foliage(t)
    const tints = ['#ffffff', '#e6eedc', '#d4e0c4']
    // Walls of the houses, the barn and the sheds: patches climbing from the ground.
    const walls = [...HOUSES.flatMap((h) => houseWallBoxes(h)), ...SHACKS.flatMap((s) => buildingWallBoxes(s))]
    for (const w of walls) {
      if (w.side === 'inner' || w.y0 > 0.05 || w.garage) continue
      const len = w.axis === 'x' ? w.size[0] : w.size[2]
      if (len < 0.8 || rand() < 0.35) continue
      const n = len > 3.5 && rand() < 0.5 ? 2 : 1
      for (let k = 0; k < n; k++) {
        const pw = Math.min(len - 0.2, 0.9 + rand() * 1.8)
        const ph = Math.min(w.y1 - 0.1, 1.2 + rand() * 3.2)
        const along = w.axis === 'x' ? [1, 0] : [0, 1]
        const off = (rand() - 0.5) * (len - pw)
        const [ox, oz] = OUT[w.side]
        const t = w.size[w.axis === 'x' ? 2 : 0]
        const base = [w.p[0] + along[0] * off + ox * (t / 2), 0, w.p[2] + along[1] * off + oz * (t / 2)]
        P.add(ivy(tints[Math.floor(rand() * 3)]), ivyPatch(base, along, [ox, oz], pw, ph, BR_UV.ivy), [0, 0, 0])
      }
    }
    // The ruin's walls, both faces.
    for (const r of RUINS) {
      for (const s of ruinPieces(r)) {
        if (rand() < 0.45 || s.h < 0.8) continue
        const along = [Math.cos(s.yaw), -Math.sin(s.yaw)]
        for (const side of [-1, 1]) {
          if (rand() < 0.4) continue
          const out = [-along[1] * side, along[0] * side]
          const base = [s.p[0] + out[0] * 0.16, 0, s.p[2] + out[1] * 0.16]
          P.add(ivy(tints[Math.floor(rand() * 3)]), ivyPatch(base, along, out, 0.95, s.h * (0.5 + rand() * 0.5), BR_UV.ivy), [0, 0, 0])
        }
      }
    }
    // Poles and the tower's legs, wrapped.
    const poles = new Map()
    for (const line of BR_POWER_LINES) for (const [x, z] of line) poles.set(`${x}:${z}`, [x, z, 7])
    const t = WATER_TOWER
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) poles.set(`leg${sx}${sz}`, [t.p[0] + sx * t.leg, t.p[2] + sz * t.leg, t.deck])
    for (const [x, z, top] of poles.values()) {
      if (rand() < 0.25) continue
      const h = top * (0.45 + rand() * 0.45)
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2 + rand()
        const out = [Math.cos(a), Math.sin(a)]
        P.add(ivy(tints[Math.floor(rand() * 3)]), ivyPatch([x + out[0] * 0.13, 0, z + out[1] * 0.13], [-out[1], out[0]], out, 0.55, h * (0.8 + rand() * 0.2), BR_UV.ivy), [0, 0, 0])
      }
    }
    return P.build()
  })
  return <Merged parts={parts} shadow={false} />
}

/* ---------------------------------------------------------------------------
 * The ruin and rubble, rail fences
 * ------------------------------------------------------------------------- */

export function Ruin({ i }) {
  const parts = useParts(`br:ruin:${i}`, () => {
    const P = new Pieces()
    const rand = seededRandom(7700 + i)
    for (const s of ruinPieces(RUINS[i])) {
      P.withFrame([s.p[0], 0, s.p[2]], s.yaw, () => {
        P.box(br.brick(), 0, s.h / 2, 0, s.size[0], s.h, s.size[2], 1.2)
        // Broken top: a couple of bricks' worth higher here and there.
        if (s.h > 0.6 && rand() < 0.7) {
          const w = 0.2 + rand() * 0.4
          P.box(br.brick(), (rand() - 0.5) * (s.size[0] - w), s.h + 0.08, 0, w, 0.16, s.size[2] - 0.04, 1.2)
        }
      })
    }
    return P.build()
  })
  return <Merged parts={parts} />
}

export function Rubble({ p, r, h }) {
  const parts = useParts(keyOf('rubble', p, `${r}`), () => {
    const P = new Pieces()
    const rand = seededRandom(Math.round(p[0] * 13 + p[2] * 7))
    const g = new DodecahedronGeometry(1, 0)
    for (let i = 0; i < 9; i++) {
      const a = rand() * Math.PI * 2
      const d = rand() * r * 0.7
      const s = r * (0.25 + rand() * 0.25)
      P.add(i % 3 ? br.brick() : br.concrete(), g, [p[0] + Math.cos(a) * d, s * 0.3, p[2] + Math.sin(a) * d], [rand(), rand(), rand()], [s, s * (h / r) * 1.4, s])
    }
    return P.build()
  })
  return <Merged parts={parts} />
}

/** A post-and-rail fence: weathered posts every couple of metres, two rails. */
export function RailFence({ a, b }) {
  const parts = useParts(keyOf('railFence', [a[0], 0, a[1]], `${b[0]}:${b[1]}`), () => {
    const P = new Pieces()
    const wood = br.wood('#a49a88')
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const n = Math.max(1, Math.round(len / 2.2))
    const rand = seededRandom(Math.round(a[0] * 7 + a[1] * 11))
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const x = a[0] + (b[0] - a[0]) * t
      const z = a[1] + (b[1] - a[1]) * t
      P.box(wood, x, 0.6, z, 0.12, 1.2 + rand() * 0.1, 0.12, 1, [0, rand() * 0.3, (rand() - 0.5) * 0.06])
    }
    for (const y of [0.55, 1.0]) addBar(P, wood, [a[0], y, a[1]], [b[0], y + (rand() - 0.5) * 0.06, b[1]], 0.1, 0.06)
    return P.build()
  })
  return <Merged parts={parts} />
}

/* ---------------------------------------------------------------------------
 * Vehicles: the burnt-out tank, the tractor; the fuel tank
 * ------------------------------------------------------------------------- */

export function Tank({ p, rotY }) {
  const parts = useParts(keyOf('tank', p), () => {
    const P = new Pieces()
    const charred = br.paint('#2a2622', 0.95)
    const steel = br.paint('#3c3630', 0.8, 0.45)
    const rust = br.rust()
    const olive = br.paint('#4f4d36', 0.9)
    const { length: L, width: W, hull, turret } = TANK
    P.withFrame(p, rotY, () => {
      // Tracks either side: the belt round the sprocket and idler, cleats on
      // the top run, rusted road wheels; armour skirts hung outside, two of
      // them blown off and one hanging.
      for (const s of [-1, 1]) {
        const x = s * (W / 2 - 0.42)
        P.box(steel, x, 0.1, 0, 0.6, 0.2, L - 1.0, 1)
        P.box(steel, x, 0.86, 0, 0.6, 0.1, L - 1.0, 1)
        for (const z of [-(L / 2 - 0.5), L / 2 - 0.5]) P.add(steel, new CylinderGeometry(0.43, 0.43, 0.6, 14), [x, 0.5, z], [0, 0, Math.PI / 2])
        for (let k = 0; k < 14; k++) P.box(charred, x, 0.92, -(L / 2 - 0.6) + (k * (L - 1.2)) / 13, 0.62, 0.04, 0.1, 1)
        for (let k = 0; k < 5; k++) P.add(rust, new CylinderGeometry(0.32, 0.32, 0.5, 12), [x, 0.42, -2.0 + k * 1.0], [0, 0, Math.PI / 2])
        const xs = s * (W / 2 - 0.04)
        for (let k = 0; k < 5; k++) {
          if ((s > 0 && k === 1) || (s < 0 && k === 3)) continue
          const z = -(L / 2 - 0.9) + k * ((L - 1.8) / 4)
          const hang = s < 0 && k === 0 ? 0.35 : 0
          P.box(olive, xs, 0.82 - hang * 0.3, z, 0.05, 0.86, 1.18, 1, [hang, 0, 0])
        }
      }
      // Hull: the deck over the tracks, the glacis sloping down at the front,
      // the engine deck's grille and the exhaust across the back.
      P.box(olive, 0, hull - 0.2, 0.3, W - 0.1, 0.4, L - 1.6, 1)
      const glacis = rampBox([0, hull, -(L / 2 - 1.1)], [0, 0.55, -L / 2 + 0.05], W - 0.2, 0.12)
      _q.set(...glacis.q)
      P.add(olive, boxGeo(...glacis.size, 1), glacis.p, _q.clone())
      P.box(charred, 0, 0.75, 0.3, W - 1.4, 0.9, L - 1.4, 1)
      for (let k = 0; k < 5; k++) P.box(charred, 0, hull + 0.01, 1.4 + k * 0.26, 1.6, 0.03, 0.12, 1)
      P.add(rust, new CylinderGeometry(0.2, 0.2, 1.5, 10), [0, 0.95, L / 2 - 0.62], [0, 0, Math.PI / 2])
      for (const sx of [-0.5, 0.5]) addBar(P, charred, [sx, 0.95, L / 2 - 0.6], [sx, 1.4, L / 2 - 0.45], 0.08, 0.08)
      // Turret, knocked askew; the gun drooping, its muzzle brake still on.
      P.withFrame([0, 0, -0.4], 0.35, () => {
        P.add(olive, new CylinderGeometry(1.0, 1.25, turret, 8), [0, hull + turret / 2, 0], [0, Math.PI / 8, 0])
        P.box(charred, 0, hull + turret / 2, -1.2, 0.8, 0.62, 0.45, 1)
        addBar(P, charred, [0, hull + 0.55, -1.4], [0, hull + 0.15, -5.4], 0.15, 0.15)
        P.add(charred, new CylinderGeometry(0.15, 0.15, 0.4, 10), [0, hull + 0.15, -5.4], [Math.PI / 2 - 0.1, 0, 0])
        // The commander's cupola, its hatch open, embers glowing inside.
        P.add(olive, new CylinderGeometry(0.42, 0.42, 0.24, 12), [0.4, hull + turret + 0.12, 0.2])
        P.add(br.ember(), new CylinderGeometry(0.34, 0.34, 0.06, 10), [0.4, hull + turret + 0.23, 0.2])
        P.box(charred, 0.4, hull + turret + 0.55, 0.62, 0.7, 0.06, 0.6, 1, [1.2, 0, 0])
      })
    })
    return P.build()
  })
  return <Merged parts={parts} />
}

export function Tractor({ p, rotY }) {
  const parts = useParts(keyOf('tractor', p), () => {
    const P = new Pieces()
    const red = br.paint('#9a3a2a', 0.8)
    const dark = br.paint('#2a2826', 0.7)
    const { width: W } = TRACTOR
    P.withFrame(p, rotY, () => {
      // Engine and hood forward (local -z), the body, the cab behind.
      P.box(red, 0, 1.05, -0.8, 0.9, 0.85, 2.0, 1)
      P.box(dark, 0, 0.7, -1.82, 0.84, 0.6, 0.06, 1)
      P.box(red, 0, 0.9, 0.7, 1.1, 0.9, 1.4, 1)
      for (const sx of [-1, 1]) for (const sz of [0.15, 1.3]) P.box(dark, sx * 0.55, 2.0, sz, 0.06, 1.3, 0.06, 1)
      P.box(red, 0, 2.66, 0.72, 1.3, 0.06, 1.4, 1)
      P.box(dark, 0, 1.55, 0.95, 0.5, 0.15, 0.5, 1)
      addBar(P, dark, [0.3, 1.4, -1.2], [0.3, 2.4, -1.2], 0.08, 0.08)
      // Big wheels behind, small in front.
      const tyre = br.rubber()
      for (const s of [-1, 1]) {
        P.add(tyre, new TorusGeometry(0.56, 0.24, 8, 18), [s * (W / 2 - 0.12), 0.8, 0.9], [0, Math.PI / 2, 0])
        P.add(red, new CylinderGeometry(0.4, 0.4, 0.3, 14), [s * (W / 2 - 0.12), 0.8, 0.9], [0, 0, Math.PI / 2])
        P.add(tyre, new TorusGeometry(0.3, 0.14, 8, 14), [s * (W / 2 - 0.25), 0.44, -1.25], [0, Math.PI / 2, 0])
      }
    })
    return P.build()
  })
  return <Merged parts={parts} />
}

export function FuelTank({ p, rotY }) {
  const parts = useParts(keyOf('fuelTank', p), () => {
    const P = new Pieces()
    const { r, length: L, lift } = FUEL_TANK
    const paint = br.paint('#cfcabb', 0.7)
    P.withFrame(p, rotY, () => {
      P.add(paint, new CylinderGeometry(r, r, L, 20), [0, lift + r, 0], [0, 0, Math.PI / 2])
      for (const s of [-1, 1]) P.add(paint, new SphereGeometry(r, 16, 8), [s * (L / 2), lift + r, 0], null, [0.25, 1, 1])
      P.add(br.rust(), new CylinderGeometry(r + 0.01, r + 0.01, 0.4, 20, 1, true), [-L * 0.15, lift + r, 0], [0, 0, Math.PI / 2])
      for (const s of [-1, 1]) P.box(br.concrete(), s * L * 0.3, (lift + 0.4) / 2, 0, 0.5, lift + 0.4, 2.0, 1)
      P.add(br.paint('#6a6a64', 0.5, 0.6), new CylinderGeometry(0.3, 0.3, 0.2, 12), [0.8, lift + r * 2 + 0.06, 0])
    })
    return P.build()
  })
  return <Merged parts={parts} />
}

/* ---------------------------------------------------------------------------
 * The covered boardwalk, the water tower
 * ------------------------------------------------------------------------- */

export function Boardwalk({ x0, x1, z0, z1, y, roof }) {
  const parts = useParts(`br:boardwalk:${x0}:${z0}`, () => {
    const P = new Pieces()
    const rand = seededRandom(9301)
    const plank = br.wood('#a08870')
    const post = br.wood('#7a6650')
    const cx = (x0 + x1) / 2
    const cz = (z0 + z1) / 2
    const s = creekSection(cx)
    const lipN = s.z - s.top
    const lipS = s.z + s.top
    // Planks across, on three bearers; boarded in down to the ground where it rests on the banks.
    for (let z = z0 + 0.1; z < z1 - 0.05; z += 0.21) P.box(plank, cx, y - 0.03, z, x1 - x0, 0.06, 0.19, 1, [0, 0, (rand() - 0.5) * 0.01])
    for (const x of [x0 + 0.2, cx, x1 - 0.2]) P.box(post, x, 0.19, cz, 0.16, 0.14, z1 - z0, 1)
    for (const [a, b] of [[z0, lipN], [lipS, z1]]) {
      // Hung just outside the posts and the deck's ends (clear of their faces).
      for (const x of [x0 - 0.035, x1 + 0.035]) P.box(post, x, 0.13, (a + b) / 2, 0.05, 0.26, b - a, 1)
      P.box(post, cx, 0.13, a === z0 ? z0 - 0.035 : z1 + 0.035, x1 - x0, 0.26, 0.05, 1)
    }
    // Posts from the ground up to the roof (stilts where they stand in the ditch), the rails along the sides.
    const { side, middle } = boardwalkPosts({ x0, x1, z0, z1 })
    for (const [x, z] of side) {
      const y0 = brambleGroundY(x, z) - 0.1
      P.box(post, x, (roof + y0) / 2, z, 0.14, roof - y0, 0.14, 1)
    }
    for (const [x, z] of middle) {
      const y0 = brambleGroundY(x, z) - 0.1
      P.box(post, x, (0.12 + y0) / 2, z, 0.16, 0.12 - y0, 0.16, 1)
      // A ledger across under the deck, tying the stilts together.
      P.box(post, cx, 0.02, z, x1 - x0, 0.16, 0.12, 1)
    }
    for (const x of [x0 + 0.08, x1 - 0.08]) {
      for (const h of [0.5, 1.0]) P.box(post, x, y + h, cz, 0.06, 0.08, z1 - z0 - 3.0, 1)
      P.box(post, x, roof - 0.06, cz, 0.14, 0.12, z1 - z0, 1)
    }
    // Tin roof, two pitches.
    for (const sd of [-1, 1]) {
      const slab = rampBox([cx, roof + 0.35, cz], [sd < 0 ? x0 - 0.4 : x1 + 0.4, roof, cz], z1 - z0 + 0.6, 0.06)
      addSheets(P, slab, ['rust', 'galvanized', 'rust', 'brown'], rand)
    }
    return P.build()
  })
  return <Merged parts={parts} />
}

/** The farm track's bridge: a concrete deck, low parapets mossed and ivied on their outer faces, abutments in the ditch. */
export function Bridge(b) {
  const parts = useParts(`br:bridge:${b.x0}:${b.z0}`, () => {
    const P = new Pieces()
    const rand = seededRandom(9331)
    const concrete = br.concrete()
    for (const piece of bridgePieces(b)) P.box(concrete, ...piece.p, ...piece.size, 1.5)
    // Coping along the parapets, a little proud of them.
    for (const x of [b.x0 + b.wallT / 2, b.x1 - b.wallT / 2]) P.box(br.stone(), x, b.top + b.wall + 0.04, (b.z0 + b.z1) / 2, b.wallT + 0.06, 0.08, b.z1 - b.z0 + 0.06, 1)
    // Ivy over the parapets' outer faces.
    for (const [x, out] of [[b.x0, -1], [b.x1, 1]]) {
      for (let i = 0; i < 4; i++) {
        const z = b.z0 + 0.8 + rand() * (b.z1 - b.z0 - 1.6)
        P.add(br.foliage(['#ffffff', '#e6eedc'][i % 2]), ivyPatch([x, b.top - 0.3, z], [0, 1], [out, 0], 0.9 + rand() * 1.2, b.wall + 0.3 + rand() * 0.2, BR_UV.ivy), [0, 0, 0])
      }
    }
    return P.build()
  })
  return <Merged parts={parts} />
}

/** A log fallen into the creek's bed: bark round it, pale sawn-off ends. */
export function CreekLog({ a, b, r }) {
  const parts = useParts(keyOf('creekLog', a, `${b[0]}`), () => {
    const P = new Pieces()
    addSegment(P, br.bark(), a, b, r, r * 0.9, 9)
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const dz = b[2] - a[2]
    const len = Math.hypot(dx, dy, dz)
    const yaw = Math.atan2(-dz, dx)
    const pitch = Math.asin(dy / len)
    for (const [p, rr] of [[a, r], [b, r * 0.9]]) P.add(br.wood('#b89a74'), new CylinderGeometry(rr * 0.98, rr * 0.98, 0.02, 9), p, [0, yaw, Math.PI / 2 + pitch])
    return P.build()
  })
  return <Merged parts={parts} />
}

export function WaterTower() {
  const parts = useParts('br:waterTower', () => {
    const P = new Pieces()
    const t = WATER_TOWER
    const [cx, , cz] = t.p
    const steel = br.paint('#6a625a', 0.6, 0.6)
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        P.box(steel, cx + sx * t.leg, t.deck / 2, cz + sz * t.leg, 0.34, t.deck, 0.34, 1)
        P.box(br.concrete(), cx + sx * t.leg, 0.2, cz + sz * t.leg, 0.8, 0.4, 0.8, 1)
      }
    }
    const span = t.leg * 2
    const diag = Math.hypot(span, t.deck / 2)
    const ang = Math.atan2(span, t.deck / 2)
    for (const y of [t.deck * 0.25, t.deck * 0.75]) {
      for (const s of [-1, 1]) {
        for (const k of [-1, 1]) {
          P.box(steel, cx, y, cz + s * t.leg, 0.06, diag, 0.06, 1, [0, 0, k * ang])
          P.box(steel, cx + s * t.leg, y, cz, 0.06, diag, 0.06, 1, [k * ang, 0, 0])
        }
      }
    }
    const { deck, rails } = towerDeckPieces(t)
    const grate = br.paint('#5a5650', 0.7, 0.5)
    for (const d of deck) P.box(grate, d.p[0], d.p[1], d.p[2], d.size[0], d.size[1], d.size[2], 1, [0, d.yaw, 0])
    P.box(grate, cx, t.deck - 0.1, cz, t.ringIn * 2, 0.2, t.ringIn * 2, 1)
    for (const r of rails) {
      P.box(steel, r.p[0], t.deck + 0.15, r.p[1], r.len, 0.3, 0.04, 1, [0, r.yaw, 0])
      P.box(steel, r.p[0], t.deck + 1.0, r.p[1], r.len, 0.05, 0.05, 1, [0, r.yaw, 0])
      const ex = Math.cos(r.yaw) * (r.len / 2)
      const ez = -Math.sin(r.yaw) * (r.len / 2)
      for (const s of [-1, 1]) P.box(steel, r.p[0] + s * ex, t.deck + 0.5, r.p[1] + s * ez, 0.05, 1.0, 0.05, 1)
    }
    // The tank, streaked with rust; its conical roof; moss on the rim.
    const { r, h, roof } = t.tank
    P.add(br.paint('#9a9284', 0.8, 0.3), new CylinderGeometry(r, r, h, 32), [cx, t.deck + h / 2, cz])
    P.add(br.rust(), new CylinderGeometry(r + 0.01, r + 0.01, 0.9, 32, 1, true), [cx, t.deck + 0.6, cz])
    P.add(br.rust(), new ConeGeometry(r + 0.15, roof, 32), [cx, t.deck + h + roof / 2, cz])
    P.add(br.foliage('#dfe8cc'), crossedCards([cx + r * 0.6, t.deck + h - 0.1, cz], 1.4, 0.9, 0.5, BR_UV.ivy, 2), [0, 0, 0])
    return P.build()
  })
  return <Merged parts={parts} />
}

/* ---------------------------------------------------------------------------
 * Furniture: low cover in the rooms
 * ------------------------------------------------------------------------- */

export function Furniture() {
  const parts = useParts('br:furniture', () => {
    const P = new Pieces()
    const wood = br.wood('#7a5e44')
    for (const f of BRAMBLE_FURNITURE) {
      const [w, h, d] = f.size
      P.withFrame(f.p, f.rotY, () => {
        switch (f.kind) {
          case 'table':
          case 'bench':
            P.box(wood, 0, h - 0.03, 0, w, 0.06, d, 1)
            for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(wood, sx * (w / 2 - 0.06), (h - 0.06) / 2, sz * (d / 2 - 0.06), 0.06, h - 0.06, 0.06, 1)
            break
          case 'sofa':
            P.box(br.paint('#5a4a3a', 0.9), 0, 0.22, 0, w, 0.44, d, 1)
            P.box(br.paint('#5a4a3a', 0.9), 0, 0.55, d / 2 - 0.12, w, 0.5, 0.24, 1)
            break
          case 'bed':
            P.box(wood, 0, 0.18, 0, w, 0.24, d, 1)
            P.box(br.paint('#b8ae94', 0.9), 0, 0.38, 0, w - 0.08, 0.18, d - 0.08, 1)
            break
          case 'bales':
            P.box(br.hay(), 0, h / 2, 0, w, h, d, 0.8)
            break
          case 'crates':
            P.box(br.wood('#9a7a52'), 0, h * 0.3, 0, w, h * 0.6, d, 1)
            P.box(br.wood('#8a6a48'), 0.05, h * 0.8, -0.04, w * 0.7, h * 0.4, d * 0.7, 1, [0, 0.3, 0])
            break
          default:
            P.box(wood, 0, h / 2, 0, w, h, d, 1)
        }
      })
    }
    return P.build()
  })
  return <Merged parts={parts} />
}
