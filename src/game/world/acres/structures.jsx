import { useMemo } from 'react'
import { CircleGeometry, ConeGeometry, CylinderGeometry, PlaneGeometry, SphereGeometry } from 'three'

import { ACRES_HALF, STREET, towerDeckPieces, WATER_TOWER } from '../../../shared/mapAcres.js'
import { seededRandom } from '../../../shared/math.js'
import { acres, signs } from './materials.js'
import { Merged } from './merge.jsx'
import { once, Pieces } from './pieces.js'

/**
 * The water tower, the fence round the town, and the world past it: desert,
 * mountains, more houses down the road and the test site's tower.
 */

/* ---------------------------------------------------------------------------
 * Water tower
 * ------------------------------------------------------------------------- */

export function WaterTower() {
  const parts = useMemo(() => once('acres:waterTower', () => {
    const P = new Pieces()
    const t = WATER_TOWER
    const [cx, , cz] = t.p
    const leg = acres.paint('#b9bfc2', 0.5, 0.6)
    const brace = acres.steel()
    // Legs, footings, X-braces on every face at two levels.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        P.box(leg, cx + sx * t.leg, t.deck / 2, cz + sz * t.leg, 0.36, t.deck, 0.36, 1)
        P.box(acres.concrete(), cx + sx * t.leg, 0.2, cz + sz * t.leg, 0.8, 0.4, 0.8, 1)
      }
    }
    const span = t.leg * 2
    const diag = Math.hypot(span, t.deck / 2)
    const ang = Math.atan2(span, t.deck / 2)
    for (const y of [t.deck * 0.25, t.deck * 0.75]) {
      for (const s of [-1, 1]) {
        for (const k of [-1, 1]) {
          P.box(brace, cx, y, cz + s * t.leg, 0.06, diag, 0.06, 1, [0, 0, k * ang])
          P.box(brace, cx + s * t.leg, y, cz, 0.06, diag, 0.06, 1, [k * ang, 0, 0])
        }
      }
      P.box(brace, cx, y + t.deck * 0.25, cz - t.leg, span, 0.1, 0.1, 1)
      P.box(brace, cx, y + t.deck * 0.25, cz + t.leg, span, 0.1, 0.1, 1)
      P.box(brace, cx - t.leg, y + t.deck * 0.25, cz, 0.1, 0.1, span, 1)
      P.box(brace, cx + t.leg, y + t.deck * 0.25, cz, 0.1, 0.1, span, 1)
    }
    // Deck ring (grating) and its rail: kick plate, mid and top rails, posts.
    const { deck, rails } = towerDeckPieces(t)
    const grate = acres.paint('#8e9396', 0.6, 0.6)
    for (const d of deck) P.box(grate, d.p[0], d.p[1], d.p[2], d.size[0], d.size[1], d.size[2], 1, [0, d.yaw, 0])
    P.box(grate, cx, t.deck - 0.1, cz, t.ringIn * 2, 0.2, t.ringIn * 2, 1)
    const rail = acres.paint('#d8dcdd', 0.5, 0.5)
    for (const r of rails) {
      P.box(rail, r.p[0], t.deck + 0.15, r.p[1], r.len, 0.3, 0.04, 1, [0, r.yaw, 0])
      P.box(rail, r.p[0], t.deck + 0.55, r.p[1], r.len, 0.04, 0.04, 1, [0, r.yaw, 0])
      P.box(rail, r.p[0], t.deck + 1.0, r.p[1], r.len, 0.05, 0.05, 1, [0, r.yaw, 0])
      const ex = Math.cos(r.yaw) * (r.len / 2)
      const ez = -Math.sin(r.yaw) * (r.len / 2)
      for (const s of [-1, 1]) P.box(rail, r.p[0] + s * ex, t.deck + 0.5, r.p[1] + s * ez, 0.05, 1.0, 0.05, 1)
    }
    // Tank, conical roof with a ball on top, and a band round the middle.
    const tank = acres.tank()
    const { r, h, roof } = t.tank
    P.add(tank, new CylinderGeometry(r, r, h, 40), [cx, t.deck + h / 2, cz])
    P.add(tank, new ConeGeometry(r + 0.18, roof, 40), [cx, t.deck + h + roof / 2, cz])
    P.add(acres.paint('#2f7f77', 0.45, 0.3), new CylinderGeometry(r + 0.02, r + 0.02, 0.5, 40, 1, true), [cx, t.deck + h - 0.6, cz])
    P.add(acres.steelDark(), new SphereGeometry(0.22, 12, 8), [cx, t.deck + h + roof + 0.15, cz])
    P.add(acres.steelDark(), new CylinderGeometry(0.03, 0.03, 1.4, 6), [cx, t.deck + h + roof + 0.9, cz])
    // The clock, facing the cul-de-sac.
    const a = Math.atan2(-cx, -cz)
    const face = [cx + Math.sin(a) * (r + 0.03), t.deck + h * 0.48, cz + Math.cos(a) * (r + 0.03)]
    P.add(acres.paint('#2c2c2c', 0.5, 0.3), new CylinderGeometry(1.45, 1.45, 0.12, 32).rotateX(Math.PI / 2), face, [0, a, 0])
    P.add(signs.clock(), new CircleGeometry(1.35, 40), [face[0] + Math.sin(a) * 0.08, face[1], face[2] + Math.cos(a) * 0.08], [0, a, 0])
    return P.build()
  }), [])
  return <Merged parts={parts} />
}

/* ---------------------------------------------------------------------------
 * The fence round the town
 * ------------------------------------------------------------------------- */

export function AcresPerimeter() {
  const parts = useMemo(() => once('acres:perimeter', () => {
    const P = new Pieces()
    const E = ACRES_HALF + 0.3
    const H = 2.6
    const post = acres.paint('#a7abad', 0.45, 0.7)
    const mesh = acres.chainLink()
    const wire = acres.steelDark()
    const sides = [
      { axis: 'x', fixed: -E, out: -1 },
      { axis: 'x', fixed: E, out: 1 },
      { axis: 'z', fixed: -E, out: -1 },
      { axis: 'z', fixed: E, out: 1 },
    ]
    const at = (side, c, y, n = 0) => (side.axis === 'x' ? [c, y, side.fixed + n] : [side.fixed + n, y, c])
    const size = (side, a, h, b) => (side.axis === 'x' ? [a, h, b] : [b, h, a])
    let sign = 0
    for (const side of sides) {
      for (let c = -E; c < E - 0.01; c += 3) {
        const mid = c + 1.5
        P.box(post, ...at(side, c, (H + 0.45) / 2), ...size(side, 0.07, H + 0.45, 0.07), 1)
        P.box(mesh, ...at(side, mid, H / 2), ...size(side, 3, H, 0.01), 0.6)
        P.box(post, ...at(side, mid, H), ...size(side, 3, 0.05, 0.05), 1)
        // Barbed wire on outward-leaning arms.
        for (const k of [0, 1, 2]) P.box(wire, ...at(side, mid, H + 0.12 + k * 0.13, side.out * (0.1 + k * 0.1)), ...size(side, 3, 0.012, 0.012), 1)
        if (++sign % 7 === 3) {
          const p = at(side, mid, 1.55, -side.out * 0.03)
          const yaw = side.axis === 'x' ? (side.out > 0 ? Math.PI : 0) : side.out > 0 ? -Math.PI / 2 : Math.PI / 2
          P.add(signs.warning(), new PlaneGeometry(1.0, 0.62), p, [0, yaw, 0])
        }
      }
    }
    return P.build()
  }), [])
  return <Merged parts={parts} shadow={false} />
}

/* ---------------------------------------------------------------------------
 * Past the fence
 * ------------------------------------------------------------------------- */

/**
 * A mountain: a cone roughened into ridges and gullies (radius varies with the
 * angle round it, peaks are knocked off), flat shaded so it reads as rock.
 */
function mountainGeometry(rand, radius, height) {
  const g = new ConeGeometry(radius, height, 16, 6).toNonIndexed()
  const pos = g.getAttribute('position')
  const phase = [rand() * 6, rand() * 6, rand() * 6]
  const key = (x, y, z) => `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`
  const moved = new Map()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const k = key(x, y, z)
    if (!moved.has(k)) {
      const a = Math.atan2(z, x)
      const h = (y + height / 2) / height
      const ridge = 1 + 0.22 * Math.sin(a * 3 + phase[0]) + 0.12 * Math.sin(a * 7 + phase[1]) + (rand() - 0.5) * 0.12
      const r = ridge * (1 - h * 0.08)
      const top = h > 0.95 ? -height * (0.12 + 0.1 * Math.sin(phase[2])) : 0
      moved.set(k, [x * r, y + top + (rand() - 0.5) * height * 0.05 * h, z * r])
    }
    const [nx, ny, nz] = moved.get(k)
    pos.setXYZ(i, nx, ny, nz)
  }
  g.computeVertexNormals()
  return g
}

export function AcresBackdrop() {
  const parts = useMemo(() => once('acres:backdrop', () => {
    const P = new Pieces()
    const rand = seededRandom(1951)
    // Mountain ranges all round: a few peaks each, hazy with distance.
    const rock = acres.rock()
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + rand() * 0.25
      const d = 200 + rand() * 80
      const peaks = 3 + Math.floor(rand() * 3)
      for (let k = 0; k < peaks; k++) {
        const along = (k - (peaks - 1) / 2) * (40 + rand() * 25)
        const x = Math.cos(a) * d - Math.sin(a) * along
        const z = Math.sin(a) * d + Math.cos(a) * along
        const radius = 38 + rand() * 40
        const height = 24 + rand() * 44
        P.add(rock, mountainGeometry(rand, radius, height), [x, height / 2 - 6, z], [0, rand() * 3, 0])
      }
    }
    // The road on out of town.
    P.box(acres.asphalt(), 0, 0.008, (STREET.road.z1 + 320) / 2, STREET.road.x * 2, 0.01, 320 - STREET.road.z1, 7)
    // More of the neighbourhood outside the fence.
    const pastel = ['#e7c9c9', '#cfe0d6', '#e9dfb8', '#c9d7e6', '#f0e9dc', '#d9c2a8']
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + 0.2
      const d = 56 + (i % 3) * 9 + rand() * 6
      const x = Math.cos(a) * d
      const z = Math.sin(a) * d
      if (Math.abs(x) < 9 && z > 0) continue
      const w = 8 + rand() * 4
      const dd = 7 + rand() * 3
      const yaw = Math.atan2(-x, -z)
      const hgt = rand() < 0.5 ? 3.0 : 5.6
      P.box(acres.paint(pastel[i % pastel.length], 0.8), x, hgt / 2, z, w, hgt, dd, 2, [0, yaw, 0])
      const roof = new ConeGeometry(Math.hypot(w, dd) / 2 + 0.4, 2.0, 4, 1).rotateY(Math.PI / 4)
      P.add(acres.roof(['slate', 'red', 'charcoal', 'teal'][i % 4]), roof, [x, hgt + 1.0, z], [0, yaw, 0], [w / Math.hypot(w, dd) * 1.42, 1, dd / Math.hypot(w, dd) * 1.42])
    }
    // Power line on along the north, and down the road.
    const pole = acres.wood('#5b4632')
    for (const x of [-72, -56, 56, 72]) P.add(pole, new CylinderGeometry(0.12, 0.15, 7, 8), [x, 3.5, -40.6])
    for (const z of [54, 67, 80, 93]) P.add(pole, new CylinderGeometry(0.12, 0.15, 7, 8), [-7.2, 3.5, z])
    // The test site's shot tower far off to the north-east.
    const steel = acres.paint('#6f6a64', 0.8, 0.4)
    const tx = 120
    const tz = -170
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(steel, tx + sx * 3, 22, tz + sz * 3, 0.6, 44, 0.6, 1, [sz * 0.06, 0, -sx * 0.06])
    P.box(steel, tx, 45, tz, 5, 4, 5, 1)
    // Dead trees and scrub in the desert.
    const bark = acres.bark()
    for (let i = 0; i < 26; i++) {
      const a = rand() * Math.PI * 2
      const d = 50 + rand() * 70
      const x = Math.cos(a) * d
      const z = Math.sin(a) * d
      if (Math.abs(x) < 10 && z > 0) continue
      const h = 2 + rand() * 2.5
      P.add(bark, new CylinderGeometry(0.07, 0.15, h, 6), [x, h / 2, z], [rand() * 0.2, 0, rand() * 0.2])
      P.add(bark, new CylinderGeometry(0.04, 0.07, h * 0.5, 5), [x + 0.3, h * 0.8, z], [0, 0, -0.8])
      P.add(acres.leaves(), new SphereGeometry(0.6 + rand() * 0.5, 7, 5), [x + (rand() - 0.5) * 3, 0.3, z + (rand() - 0.5) * 3], null, [1, 0.5, 1])
    }
    return P.build()
  }), [])
  return <Merged parts={parts} shadow={false} />
}
