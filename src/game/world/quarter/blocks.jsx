import { useMemo } from 'react'
import { CircleGeometry, CylinderGeometry, Euler, PlaneGeometry, Quaternion, SphereGeometry } from 'three'

import {
  balconyOf,
  blockOf,
  blockOpenings,
  blockSlabs,
  blockWallBoxes,
  flightPieces,
  OQ_COL,
  OQ_SLAB_T,
  OQ_WALL_T,
  roofLevel,
  TANK,
} from '../../../shared/mapQuarter.js'
import { seededRandom } from '../../../shared/math.js'
import { Merged } from '../acres/merge.jsx'
import { once, Pieces } from '../acres/pieces.js'
import { boxGeo } from '../materials.js'
import { addBar, addFancyRail, addRail, GROUND_K, GROUND_Y } from './kit.js'
import { oq } from './materials.js'
import { SIGNS } from './textures.js'

/**
 * An Old Quarter building from its shared description (shared/mapQuarter.js):
 * the same wall pieces, slabs and flights its colliders are made of, dressed.
 * Stucco outside and in, a concrete plinth, ledges at every floor and copings
 * on the parapets; window surrounds, sills and louvred shutters swung back
 * against the wall, roller shutters over the shopfronts, signs and striped
 * awnings; floors of worn tiles, solid concrete stairs with iron rails,
 * balconies with the square-pattern railings, and on the roof water tanks,
 * dishes and air-conditioners. The Skeleton is the bare frame: block walls,
 * columns with their rebar sticking out, raw slabs.
 */

const OUT = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }
const PLINTH = 0.45
/** Floor tiles: warm sandstone. */
const FLOOR_TINT = '#ead6b6'
const _q = new Quaternion()
const _e = new Euler()

/** Faces of a wall piece: the outside half (stucco) and the inside half. */
function addWall(P, b, w, outside, inside) {
  const t = OQ_WALL_T
  const [sx, sy, sz] = w.size
  if (w.side === 'inner') {
    P.box(inside, ...w.p, sx, sy, sz, 2.5)
    return
  }
  const [ox, oz] = OUT[w.side]
  const half = w.axis === 'x' ? [sx, sy, t / 2] : [t / 2, sy, sz]
  P.box(outside, w.p[0] + (ox * t) / 4, w.p[1], w.p[2] + (oz * t) / 4, ...half, 2.5)
  P.box(inside, w.p[0] - (ox * t) / 4, w.p[1], w.p[2] - (oz * t) / 4, ...half, 2.5)
}

/**
 * A band along the outside of a wall piece between heights y0..y1, standing
 * `out` proud of the face (plinth, ledge). Pieces at a corner of the building
 * on the north and south sides run on round it.
 */
function addBand(P, b, w, material, y0, y1, out) {
  if (w.side === 'inner' || w.y0 > y0 + 1e-3 || w.y1 < y1 - 1e-3) return
  const [ox, oz] = OUT[w.side]
  const y = (y0 + y1) / 2
  const h = y1 - y0
  if (w.axis === 'x') {
    let a = w.p[0] - w.size[0] / 2
    let c = w.p[0] + w.size[0] / 2
    if (Math.abs(a - b.x0) < 0.01) a -= out
    if (Math.abs(c - b.x1) < 0.01) c += out
    const z = oz < 0 ? b.z0 - out / 2 : b.z1 + out / 2
    P.box(material, (a + c) / 2, y, z, c - a, h, out, 1.5)
  } else {
    const x = ox < 0 ? b.x0 - out / 2 : b.x1 + out / 2
    P.box(material, x, y, w.p[2], out, h, w.size[2], 1.5)
  }
}

/** Openings on the same wall and floor, for checking a shutter leaf has room. */
function neighbours(list, o) {
  return list.filter((p) => p !== o && p.side === o.side && p.floor === o.floor && Math.abs(p.at[0] - o.at[0]) + Math.abs(p.at[1] - o.at[1]) < 20 && (o.axis === 'x' ? Math.abs(p.at[1] - o.at[1]) < 0.01 : Math.abs(p.at[0] - o.at[0]) < 0.01))
}

function addOpenings(P, b, look, rand) {
  const frame = oq.concrete('#e6e0d2')
  const sill = oq.concrete('#cfc8ba')
  const shutterTint = look.shutters ?? '#5a6a5a'
  const list = blockOpenings(b)
  for (const o of list) {
    if (o.bay || o.side === 'inner') continue
    const [ox, oz] = OUT[o.side]
    const along = o.axis === 'x' ? [1, 0] : [0, 1]
    const [cx, cz] = o.at
    const w = o.width
    // On the outside face.
    const face = (a, off) => [cx + along[0] * a + ox * (o.t / 2 + off), cz + along[1] * a + oz * (o.t / 2 + off)]
    const strip = (a, y0, y1, len, d, material = frame, off = d / 2) => {
      const [x, z] = face(a, off)
      P.box(material, x, (y0 + y1) / 2, z, o.axis === 'x' ? len : d, y1 - y0, o.axis === 'x' ? d : len, 1)
    }
    if (o.shop) {
      // Roller shutter: its box above the opening and the curtain's last slats hanging down.
      const top = o.y1
      strip(0, top + 0.02, top + 0.34, w + 0.16, 0.3, oq.tin('galvanized'), 0.15)
      strip(0, top - 0.42, top, w - 0.04, 0.03, oq.tin('galvanized'), 0.03)
      for (const s of [-1, 1]) strip(s * (w / 2 + 0.03), 0, top + 0.02, 0.06, 0.06, oq.paint('#4a4a48', 0.5, 0.6), 0.03)
      continue
    }
    // Surround: jambs and head proud of the face, a sill under windows.
    const sw = 0.09
    const y0 = o.door ? o.y0 : o.y0 + 0.04
    for (const s of [-1, 1]) strip(s * (w / 2 + sw / 2), y0, o.y1 + sw, sw, 0.03)
    strip(0, o.y1, o.y1 + sw, w, 0.03)
    if (!o.door) {
      const [x, z] = face(0, 0.02)
      const d = o.t + 0.12
      P.box(sill, x - ox * (o.t / 2), o.y0 - 0.02, z - oz * (o.t / 2), o.axis === 'x' ? w + 0.24 : d, 0.08, o.axis === 'x' ? d : w + 0.24, 1)
    }
    // Louvred shutters swung back flat against the wall, where there's room either side.
    if (!o.door && rand() < 0.6) {
      const leaf = w / 2 + 0.02
      const clear = neighbours(list, o).every((p) => {
        const d = o.axis === 'x' ? Math.abs(p.at[0] - cx) : Math.abs(p.at[1] - cz)
        return d - p.width / 2 - w / 2 > leaf + 0.25
      })
      const end = o.axis === 'x' ? Math.min(cx - w / 2 - b.x0, b.x1 - cx - w / 2) : Math.min(cz - w / 2 - b.z0, b.z1 - cz - w / 2)
      if (clear && end > leaf + 0.2) {
        const h = o.y1 - o.y0 + 0.04
        const mat = oq.louvre(shutterTint)
        for (const s of [-1, 1]) {
          const [x, z] = face(s * (w / 2 + sw + leaf / 2), 0.055)
          const g = new PlaneGeometry(leaf, h)
          const yaw = { n: Math.PI, s: 0, w: -Math.PI / 2, e: Math.PI / 2 }[o.side]
          P.add(mat, g, [x, (o.y0 + o.y1) / 2, z], [0, yaw, 0])
        }
      }
    }
    // Bars over some ground-floor windows.
    if (!o.door && o.floor === 0 && rand() < 0.35) {
      const iron = oq.paint('#2a2a28', 0.5, 0.6)
      const n = Math.max(3, Math.round(w / 0.13))
      for (let i = 1; i < n; i++) strip(-w / 2 + (w * i) / n, o.y0, o.y1, 0.018, 0.018, iron, 0.06)
      for (const y of [o.y0 + 0.1, o.y1 - 0.1]) strip(0, y - 0.015, y + 0.015, w, 0.02, iron, 0.06)
    }
  }
}

function addFlight(P, fl, look) {
  const s = flightPieces(fl)
  const concrete = oq.concrete('#cbc4b6')
  const N = Math.max(4, Math.round(s.rise / 0.18))
  const alongX = Math.abs(s.ux) > 0.5
  for (let i = 0; i < N; i++) {
    const top = fl.bottom[1] + (s.rise * (i + 1)) / N
    const f = (i + 0.5) / N
    const cx = fl.bottom[0] + s.ux * s.run * f
    const cz = fl.bottom[2] + s.uz * s.run * f
    const len = s.run / N
    const h = top - s.base
    P.box(concrete, cx, s.base + h / 2, cz, alongX ? len + 0.002 : fl.width, h, alongX ? fl.width : len + 0.002, 1.5)
  }
  if (fl.rail) {
    const side = { e: [1, 0], w: [-1, 0], s: [0, 1], n: [0, -1] }[fl.rail]
    const off = fl.width / 2 - 0.05
    const iron = oq.paint(look.rail ?? '#2c2c2c', 0.5, 0.6)
    const a0 = fl.railFrom ?? 0
    const at = (f, y) => [fl.bottom[0] + s.ux * s.run * f + side[0] * off, y, fl.bottom[2] + s.uz * s.run * f + side[1] * off]
    const y = (f) => fl.bottom[1] + s.rise * f
    for (let f = a0 + 0.02; f <= 1.001; f += Math.max(0.12, 1 / Math.ceil(s.run))) {
      const p = at(f, y(f) + 0.5)
      P.box(iron, p[0], p[1], p[2], 0.04, 1.0, 0.04, 1)
    }
    for (const h of [1.0, 0.5]) addBar(P, iron, at(a0, y(a0) + h), at(1, y(1) + h), 0.045, 0.045)
  }
}

function addRoofKit(P, b, look) {
  const kit = look.roofKit
  if (!kit) return
  const top = roofLevel(b)
  const steel = oq.paint('#6a6a66', 0.5, 0.7)
  for (const [x, z] of kit.tanks ?? []) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(steel, x + sx * TANK.r * 0.6, top + TANK.stand / 2, z + sz * TANK.r * 0.6, 0.05, TANK.stand, 0.05, 1)
    P.box(steel, x, top + TANK.stand - 0.03, z, TANK.r * 1.5, 0.06, TANK.r * 1.5, 1)
    P.add(oq.paint('#e8e4da', 0.6), new CylinderGeometry(TANK.r, TANK.r, TANK.h, 16), [x, top + TANK.stand + TANK.h / 2, z])
    P.add(oq.paint('#3a6ea8', 0.6), new CylinderGeometry(0.2, 0.2, 0.08, 12), [x, top + TANK.stand + TANK.h + 0.04, z])
  }
  for (const [x, z, yaw] of kit.dishes ?? []) {
    P.box(steel, x, top + 0.45, z, 0.06, 0.9, 0.06, 1)
    // The dish: a flattened ball (closed, so it reads from both sides), tipped up toward the sky.
    P.add(oq.paint('#e9e7e0', 0.55), new SphereGeometry(0.48, 14, 7), [x + Math.sin(yaw) * 0.12, top + 1.05, z + Math.cos(yaw) * 0.12], [-0.6, yaw, 0], [1, 1, 0.22])
    addBar(P, steel, [x, top + 0.95, z], [x + Math.sin(yaw) * 0.5, top + 1.25, z + Math.cos(yaw) * 0.5], 0.025, 0.025)
  }
  for (const [side, along, y] of kit.ac ?? []) {
    const [ox, oz] = OUT[side]
    const face = side === 'n' ? b.z0 : side === 's' ? b.z1 : side === 'w' ? b.x0 : b.x1
    const d = 0.38
    const x = side === 'n' || side === 's' ? along : face + ox * (d / 2 + 0.01)
    const z = side === 'n' || side === 's' ? face + oz * (d / 2 + 0.01) : along
    const alongX = side === 'n' || side === 's'
    P.box(oq.paint('#d8d6cc', 0.6), x, y, z, alongX ? 0.82 : d, 0.56, alongX ? d : 0.82, 1)
    const yaw = { n: Math.PI, s: 0, w: -Math.PI / 2, e: Math.PI / 2 }[side]
    P.add(oq.paint('#3a3a38', 0.6), new CircleGeometry(0.2, 14), [x + ox * (d / 2 + 0.005), y, z + oz * (d / 2 + 0.005)], [0, yaw, 0])
    // Brackets under it.
    for (const s of [-0.3, 0.3]) addBar(P, steel, [x + (alongX ? s : 0) - ox * (d / 2), y - 0.28, z + (alongX ? 0 : s) - oz * (d / 2)], [x + (alongX ? s : 0) + ox * (d / 2), y - 0.28, z + (alongX ? 0 : s) + oz * (d / 2)], 0.03, 0.03)
  }
}

function addAwnings(P, b, look) {
  for (const [side, from, to, y, tint] of look.awnings ?? []) {
    const [ox, oz] = OUT[side]
    const face = side === 'n' ? b.z0 : side === 's' ? b.z1 : side === 'w' ? b.x0 : b.x1
    const alongX = side === 'n' || side === 's'
    const depth = 1.5
    const drop = 0.55
    const mid = (from + to) / 2
    const len = to - from
    const at = (out, yy) => (alongX ? [mid, yy, face + oz * out] : [face + ox * out, yy, mid])
    const top = at(0.02, y)
    const bottom = at(depth, y - drop)
    const g = boxGeo(len, 0.02, Math.hypot(depth, drop), 2)
    const yaw = alongX ? (oz > 0 ? 0 : Math.PI) : ox > 0 ? Math.PI / 2 : -Math.PI / 2
    const pitch = Math.atan2(drop, depth)
    _q.setFromEuler(_e.set(pitch, yaw, 0, 'YXZ'))
    P.add(oq.awning(tint), g, [(top[0] + bottom[0]) / 2, (top[1] + bottom[1]) / 2, (top[2] + bottom[2]) / 2], _q.clone())
    // The valance hanging off the front edge.
    const v = at(depth + 0.01, y - drop - 0.12)
    P.box(oq.awning(tint), v[0], v[1], v[2], alongX ? len : 0.02, 0.24, alongX ? 0.02 : len, 2)
    // Arms back to the wall.
    const steel = oq.paint('#3a3a38', 0.5, 0.6)
    for (const s of [-1, 1]) {
      const k = mid + s * (len / 2 - 0.1)
      const p0 = alongX ? [k, y - 0.9, face] : [face, y - 0.9, k]
      const p1 = alongX ? [k, y - drop - 0.02, face + oz * depth] : [face + ox * depth, y - drop - 0.02, k]
      addBar(P, steel, p0, p1, 0.035, 0.035)
    }
  }
}

function addSigns(P, b, look) {
  for (const [side, along, y, word] of look.signs ?? []) {
    const i = Math.max(0, SIGNS.indexOf(word))
    const g = new PlaneGeometry(2.4, 0.6)
    const uv = g.getAttribute('uv')
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k), 1 - (i + 1) * 0.25 + uv.getY(k) * 0.25)
    const [ox, oz] = OUT[side]
    const face = side === 'n' ? b.z0 : side === 's' ? b.z1 : side === 'w' ? b.x0 : b.x1
    const yaw = { n: Math.PI, s: 0, w: -Math.PI / 2, e: Math.PI / 2 }[side]
    const p = side === 'n' || side === 's' ? [along, y, face + oz * 0.07] : [face + ox * 0.07, y, along]
    P.box(oq.paint('#3a3a38', 0.6), p[0] - ox * 0.03, p[1], p[2] - oz * 0.03, side === 'n' || side === 's' ? 2.5 : 0.05, 0.7, side === 'n' || side === 's' ? 0.05 : 2.5, 1)
    P.add(oq.signs(), g, p, [0, yaw, 0])
  }
}

function buildBlock(b) {
  const P = new Pieces()
  const rand = seededRandom(b.id.split('').reduce((h, ch) => h * 31 + ch.charCodeAt(0), 7))
  const look = b.look
  const t = OQ_WALL_T
  const outside = b.frame ? oq.block() : oq.stucco(look.tint)
  const inside = b.frame ? oq.block() : oq.stucco(look.inside ?? look.tint)
  const concrete = oq.concrete('#cbc4b6')
  const ledge = oq.concrete('#dad3c4')
  const walls = blockWallBoxes(b)

  /* ---- Walls, plinth, ledges, copings ------------------------------------ */
  const levels = [...(b.slabs ?? []).map((s) => s.y), ...(b.roof ? [roofLevel(b)] : [])]
  const roofTop = b.roof ? roofLevel(b) + b.roof.parapet : null
  for (const w of walls) {
    addWall(P, b, w, outside, inside)
    if (b.frame) continue
    addBand(P, b, w, concrete, 0, PLINTH, 0.035)
    for (const y of levels) addBand(P, b, w, ledge, y - 0.22, y + 0.05, 0.05)
    // Coping along the parapet's top (the side walls' stop short of the front and back ones' so they never overlap).
    if (roofTop !== null && w.side !== 'inner' && Math.abs(w.y1 - roofTop) < 0.01) {
      const ext = 0.05
      if (w.axis === 'x') P.box(ledge, w.p[0], roofTop + 0.03, w.p[2], w.size[0] + (Math.abs(w.p[0] - w.size[0] / 2 - b.x0) < 0.01 || Math.abs(w.p[0] + w.size[0] / 2 - b.x1) < 0.01 ? ext * 2 : 0), 0.06, t + ext * 2, 1)
      else {
        let z0 = w.p[2] - w.size[2] / 2
        let z1 = w.p[2] + w.size[2] / 2
        if (Math.abs(z0 - (b.z0 + t)) < 0.01) z0 += ext
        if (Math.abs(z1 - (b.z1 - t)) < 0.01) z1 -= ext
        P.box(ledge, w.p[0], roofTop + 0.03, (z0 + z1) / 2, t + ext * 2, 0.06, z1 - z0, 1)
      }
    }
  }
  if (!b.frame) addOpenings(P, b, look, rand)

  /* ---- Floors, slabs, the roof -------------------------------------------- */
  const tile = (k) => (look.floor === 'concrete' ? oq.layer('concrete', k) : oq.layer('floorTile', k))
  if (look.floor) {
    const w0 = b.floors[0].walls ?? {}
    const x0 = w0.w === null ? b.x0 : b.x0 + t
    const x1 = w0.e === null ? b.x1 : b.x1 - t
    const z0 = w0.n === null ? b.z0 : b.z0 + t
    const z1 = w0.s === null ? b.z1 : b.z1 - t
    const g = new PlaneGeometry(x1 - x0, z1 - z0)
    const uv = g.getAttribute('uv')
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * (x1 - x0)) / 2, (uv.getY(i) * (z1 - z0)) / 2)
    P.add(tile(GROUND_K.floor), g.rotateX(-Math.PI / 2), [(x0 + x1) / 2, GROUND_Y.floor, (z0 + z1) / 2])
  }
  for (const s of blockSlabs(b)) {
    for (const [x0, x1, z0, z1] of s.rects) {
      if (b.frame) {
        P.aabb(concrete, x0, s.y - OQ_SLAB_T, z0, x1, s.y, z1, 2.5)
        continue
      }
      // The slab plastered underneath, finished on top: tiles upstairs, concrete on a roof.
      P.aabb(s.roof ? concrete : inside, x0, s.y - OQ_SLAB_T, z0, x1, s.y - 0.03, z1, 2.5)
      const top = s.roof ? oq.concrete('#bdb5a6') : look.floor === 'concrete' ? concrete : oq.tile(FLOOR_TINT)
      P.aabb(top, x0, s.y - 0.03, z0, x1, s.y, z1, 2)
    }
  }

  /* ---- The frame: columns and their rebar ----------------------------------- */
  if (b.columns) {
    const top = b.slabs[b.slabs.length - 1].y
    const rust = oq.paint('#7a4a32', 0.9)
    for (const [x, z] of b.columns) {
      // 2 cm proud of the walls and slab edges it stands in line with (their faces would flicker).
      P.box(concrete, x, top / 2, z, OQ_COL + 0.04, top, OQ_COL + 0.04, 2)
      if (look.rebar) {
        for (const dx of [-0.12, 0.12]) {
          for (const dz of [-0.12, 0.12]) {
            const h = 0.6 + rand() * 0.7
            const lean = (rand() - 0.5) * 0.25
            addBar(P, rust, [x + dx, top, z + dz], [x + dx + lean, top + h, z + dz + lean * 0.5], 0.025, 0.025)
          }
        }
      }
    }
  }

  /* ---- Stairs, landings, banisters, balconies ----------------------------- */
  for (const fl of b.flights ?? []) addFlight(P, fl, look)
  const iron = oq.paint(look.rail ?? '#2c2c2c', 0.5, 0.6)
  for (const L of b.landings ?? []) {
    P.aabb(concrete, L.x0, 0, L.z0, L.x1, L.y, L.z1, 1.5)
    for (const [ax, az, bx, bz] of L.rails ?? []) addRail(P, iron, [ax, az], [bx, bz], L.y)
  }
  for (const [ax, az, bx, bz, y] of b.rails ?? []) addRail(P, iron, [ax, az], [bx, bz], y)
  for (const bal of b.balconies ?? []) {
    const r = balconyOf(b, bal)
    const [x0, x1, z0, z1] = r.slab
    P.aabb(ledge, x0, r.y - r.thick, z0, x1, r.y - 0.02, z1, 1.5)
    P.aabb(oq.tile('#d9b48f'), x0, r.y - 0.02, z0, x1, r.y, z1, 2)
    for (const [ax, az, bx, bz] of r.rails) addFancyRail(P, iron, [ax, az], [bx, bz], r.y)
  }

  /* ---- Awnings, signs, the roof kit ---------------------------------------- */
  addAwnings(P, b, look)
  addSigns(P, b, look)
  addRoofKit(P, b, look)
  return P.build()
}

export function Block({ id }) {
  const parts = useMemo(() => once(`oq:block:${id}`, () => buildBlock(blockOf(id))), [id])
  return <Merged parts={parts} />
}

export default Block
