import { useMemo } from 'react'
import { Euler, ExtrudeGeometry, Quaternion, Shape } from 'three'

import { eaveOf, houseOf, houseOpenings, houseWallBoxes, ROOF_LIFT, roofSlabs, SLAB_T, WALL_T } from '../../../shared/mapAcres.js'
import { boxGeo } from '../materials.js'
import { acres, INTERIOR } from './materials.js'
import { Merged } from './merge.jsx'
import { once, Pieces } from './pieces.js'

/**
 * A house from its shared description (shared/mapAcres.js): the same wall
 * pieces the colliders are made of, dressed. Outside faces get the siding,
 * inside faces paint; doors and windows get frames, sills and shutters; floors,
 * stairs, banisters, ceilings, the roof, chimney, porch, carport and garage.
 */

const OUT = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }
const DOOR_COLORS = { yellow: '#2f8f86', green: '#f4f1e8', orange: '#6b4a32', cottage: '#b3372d', poolhouse: '#3f817b', shed: '#f4f1e8' }
const CARPET = { yellow: '#a9817c', green: '#7f97a8' }
const CURTAINS = { yellow: '#efe1bf', green: '#ecd98c', orange: '#cfd9dc', cottage: '#f5d3dc', poolhouse: '#f1e8d4', shed: '#a88a66' }

function floorMaterial(kind) {
  if (kind === 'terrazzo') return acres.terrazzo()
  if (kind === 'tile') return acres.tile()
  if (kind === 'plank') return acres.plank()
  return acres.woodFloor()
}

/** Triangle (gable end) in the x-y plane, extruded `depth` along +z, UVs at siding scale. */
function gableGeometry(x0, x1, y0, y1, depth) {
  const s = new Shape()
  s.moveTo(x0, y0)
  s.lineTo(x1, y0)
  s.lineTo((x0 + x1) / 2, y1)
  s.closePath()
  const g = new ExtrudeGeometry(s, { depth, bevelEnabled: false })
  const uv = g.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.6, uv.getY(i) / 1.6)
  return g
}

/** Rectangle a minus rectangle b, as up to four rectangles ({x0, x1, z0, z1}). */
function rectMinus(a, b) {
  const x0 = Math.max(a.x0, b.x0)
  const x1 = Math.min(a.x1, b.x1)
  const z0 = Math.max(a.z0, b.z0)
  const z1 = Math.min(a.z1, b.z1)
  if (x0 >= x1 || z0 >= z1) return [a]
  const out = []
  if (a.z0 < z0) out.push({ x0: a.x0, x1: a.x1, z0: a.z0, z1: z0 })
  if (z1 < a.z1) out.push({ x0: a.x0, x1: a.x1, z0: z1, z1: a.z1 })
  if (a.x0 < x0) out.push({ x0: a.x0, x1: x0, z0, z1 })
  if (x1 < a.x1) out.push({ x0: x1, x1: a.x1, z0, z1 })
  return out
}

/** Rectangles with the overlaps cut out (earlier ones keep their area), so no two faces coincide. */
function disjoint(rects) {
  const out = []
  for (const r of rects) {
    let pieces = [r]
    for (const prev of out) pieces = pieces.flatMap((p) => rectMinus(p, prev))
    out.push(...pieces.filter((p) => p.x1 - p.x0 > 0.001 && p.z1 - p.z0 > 0.001))
  }
  return out
}

function buildHouse(h) {
  const P = new Pieces()
  const t = WALL_T
  const look = h.look
  const colors = look.interior ?? INTERIOR[h.id] ?? ['#ece8de']
  const inside = (floor) => {
    const color = colors[Math.min(floor, colors.length - 1)]
    return look.lit ? acres.interiorLit(color, look.lit) : acres.interior(color)
  }
  const trim = acres.trim(look.trim)
  // Stone or brick walls (Hollow Creek's church) instead of siding.
  const wallOf = (name) => (name === 'stone' ? acres.stone() : name === 'brick' ? acres.brick() : acres.siding(name))
  const lowerSiding = wallOf(look.lower)
  const upperSiding = wallOf(look.upper ?? look.lower)
  const base = look.base === 'stone' ? acres.stone() : look.base === 'brick' ? acres.brick() : look.base ? acres.concrete() : null
  const garageInside = acres.interior('#d9d5cb')

  /* ---- Walls ------------------------------------------------------------ */
  for (const b of houseWallBoxes(h)) {
    const [sx, sy, sz] = b.size
    if (b.side === 'inner') {
      if (b.floor > 0 && b.y1 <= h.floors[b.floor].y + 0.001) continue
      P.box(inside(b.floor), ...b.p, sx, sy, sz, 2)
      continue
    }
    const [ox, oz] = OUT[b.side]
    const half = b.axis === 'x' ? [sx, sy, t / 2] : [t / 2, sy, sz]
    const outside = b.floor === 0 || b.garage ? lowerSiding : upperSiding
    P.box(outside, b.p[0] + (ox * t) / 4, b.p[1], b.p[2] + (oz * t) / 4, ...half, 1.6)
    P.box(b.garage ? garageInside : inside(b.floor), b.p[0] - (ox * t) / 4, b.p[1], b.p[2] - (oz * t) / 4, ...half, 2)
    // A stone (or brick) skirt round the bottom of the outside walls.
    if (base && b.floor === 0 && b.y0 < 0.01) {
      const shell = b.garage ? h.garage : h
      const bh = Math.min(0.62, b.y1)
      const off = t / 2 + 0.03
      if (b.axis === 'x') {
        let a = b.p[0] - sx / 2
        let c = b.p[0] + sx / 2
        if (Math.abs(a - shell.x0) < 0.01) a -= 0.06
        if (Math.abs(c - shell.x1) < 0.01) c += 0.06
        P.aabb(base, a, 0, b.p[2] + oz * off - 0.03, c, bh, b.p[2] + oz * off + 0.03, 1.4)
      } else {
        let a = b.p[2] - sz / 2
        let c = b.p[2] + sz / 2
        if (Math.abs(a - (shell.z0 + t)) < 0.01) a = shell.z0
        if (Math.abs(c - (shell.z1 - t)) < 0.01) c = shell.z1
        // A garage's sides stop short of the house's own band.
        if (b.garage && Math.abs(c - shell.z1) < 0.01) c = shell.z1 - 0.06
        P.aabb(base, b.p[0] + ox * off - 0.03, 0, a, b.p[0] + ox * off + 0.03, bh, c, 1.4)
      }
    }
  }
  // Corner boards up the outside corners.
  const top = eaveOf(h)
  for (const [x, z] of [[h.x0, h.z0], [h.x1, h.z0], [h.x0, h.z1], [h.x1, h.z1]]) {
    P.box(trim, x, top / 2, z, 0.14, top, 0.14, 1)
  }
  // A band of trim between the storeys.
  if (h.floors.length > 1) {
    const y = h.floors[1].y - SLAB_T / 2
    P.aabb(trim, h.x0 - 0.04, y - 0.08, h.z0 - 0.04, h.x1 + 0.04, y + 0.08, h.z0 + 0.02, 1)
    P.aabb(trim, h.x0 - 0.04, y - 0.08, h.z1 - 0.02, h.x1 + 0.04, y + 0.08, h.z1 + 0.04, 1)
    P.aabb(trim, h.x0 - 0.04, y - 0.08, h.z0 + 0.02, h.x0 + 0.02, y + 0.08, h.z1 - 0.02, 1)
    P.aabb(trim, h.x1 - 0.02, y - 0.08, h.z0 + 0.02, h.x1 + 0.04, y + 0.08, h.z1 - 0.02, 1)
  }

  /* ---- Doors and windows ------------------------------------------------ */
  const doorMat = acres.paint(look.door ?? DOOR_COLORS[h.id] ?? '#f4f1e8', 0.5)
  const shutter = look.shutters ? acres.shutter(look.shutters) : null
  // `curtains: null` leaves the windows bare; `glow` lights them from inside.
  const curtainColor = look.curtains === undefined ? CURTAINS[h.id] ?? '#d8c6a8' : look.curtains
  const curtain = curtainColor ? (look.glow ? acres.glowFabric(curtainColor) : acres.fabric(curtainColor)) : null
  for (const o of houseOpenings(h)) {
    const along = o.axis === 'x' ? [1, 0] : [0, 1]
    const normal = o.axis === 'x' ? [0, 1] : [1, 0]
    const [cx, cz] = o.at
    const sign = o.side === 'inner' ? 1 : (OUT[o.side][0] + OUT[o.side][1])
    const w = o.width
    const hgt = o.y1 - o.y0
    const ym = (o.y0 + o.y1) / 2
    // Piece along the wall (u) and across it (n) relative to the opening's centre.
    const put = (mat, u, y, n, du, dy, dn) => {
      const x = cx + along[0] * u + normal[0] * n
      const z = cz + along[1] * u + normal[1] * n
      const sx = along[0] * du + normal[0] * dn
      const sz = along[1] * du + normal[1] * dn
      P.box(mat, x, y, z, sx, dy, sz, 1)
    }
    const faces = o.side === 'inner' ? [1, -1] : [sign, -sign]
    for (const f of faces) {
      const n = f * (o.t / 2 + 0.026)
      put(trim, -w / 2 - 0.045, ym, n, 0.09, hgt + 0.02, 0.05)
      put(trim, w / 2 + 0.045, ym, n, 0.09, hgt + 0.02, 0.05)
      put(trim, 0, o.y1 + 0.06, n, w + 0.2, 0.12, 0.05)
    }
    if (o.garageDoor) {
      // Rolled up under the header.
      put(acres.paint('#f1eee6', 0.6), 0, o.y1 - 0.22, -sign * 0.35, w - 0.1, 0.36, 0.5)
      continue
    }
    if (o.door) {
      if (o.side === 'inner') continue
      // Open, swung back into the room against the hinge side.
      const leaf = w - 0.12
      put(doorMat, -w / 2 + 0.06, o.y0 + 1.04, -sign * (o.t / 2 + leaf / 2 + 0.02), 0.05, 2.06, leaf)
      put(acres.chrome(), -w / 2 + 0.11, o.y0 + 1.0, -sign * (o.t / 2 + leaf - 0.08), 0.06, 0.06, 0.06)
      // A step at the threshold of the outside doors on the ground.
      if (o.floor === 0 && !o.garage) put(acres.concrete(), 0, 0.06, sign * (o.t / 2 + 0.35), w + 0.5, 0.12, 0.7)
      continue
    }
    if (o.side === 'inner') continue
    // Window: sill outside, a valance and side curtains inside.
    put(trim, 0, o.y0 - 0.02, sign * (o.t / 2 + 0.06), w + 0.26, 0.06, 0.16)
    if (curtain) {
      put(curtain, 0, o.y1 - 0.1, -sign * (o.t / 2 + 0.05), w + 0.16, 0.18, 0.04)
      for (const s of [-1, 1]) put(curtain, s * (w / 2 - 0.02), ym - 0.08, -sign * (o.t / 2 + 0.05), 0.16, hgt - 0.22, 0.04)
    }
    if (shutter && h.look.modern !== true) {
      const sw = Math.min(0.5, Math.max(0.32, w * 0.3))
      for (const s of [-1, 1]) put(shutter, s * (w / 2 + 0.1 + sw / 2), ym, sign * (o.t / 2 + 0.04), sw, hgt, 0.04)
    }
  }

  /* ---- Floors, ceilings, stairs ------------------------------------------ */
  const f0 = h.floors[0]
  const room = { x0: h.x0 + t, x1: h.x1 - t, z0: h.z0 + t, z1: h.z1 - t }
  if (f0.kitchen) {
    const k = f0.kitchen
    P.aabb(acres.checker(), k.x0, 0, k.z0, k.x1, 0.02, k.z1, 2)
  }
  for (const r of f0.kitchen ? rectMinus(room, f0.kitchen) : [room]) P.aabb(floorMaterial(f0.floor), r.x0, 0, r.z0, r.x1, 0.02, r.z1, 1.6)
  const ceiling = look.lit ? acres.ceilingLit(look.lit) : acres.ceiling()
  for (const s of disjoint(h.slabs ?? [])) {
    const y = h.floors[1].y
    P.aabb(acres.carpet(CARPET[h.id]), s.x0, y - 0.02, s.z0, s.x1, y, s.z1, 1.5)
    P.aabb(ceiling, s.x0, y - SLAB_T, s.z0, s.x1, y - 0.02, s.z1, 2)
  }
  // (A flat roof is its own ceiling: see below.)
  if (!h.roof.flat) P.aabb(ceiling, h.x0 + t, top, h.z0 + t, h.x1 - t, top + 0.15, h.z1 - t, 2)
  for (const st of h.stairs ?? []) {
    const dx = st.top[0] - st.bottom[0]
    const dz = st.top[2] - st.bottom[2]
    const run = Math.hypot(dx, dz)
    const rise = st.top[1] - st.bottom[1]
    const steps = Math.round(rise / 0.2)
    const ux = dx / run
    const uz = dz / run
    const wood = acres.wood('#9a6a40')
    for (let i = 0; i < steps; i++) {
      const a = (i + 0.5) * (run / steps)
      const y1 = (i + 1) * (rise / steps)
      const x = st.bottom[0] + ux * a
      const z = st.bottom[2] + uz * a
      const len = run / steps
      P.box(wood, x, y1 / 2, z, Math.abs(ux) * len + Math.abs(uz) * st.width, y1, Math.abs(uz) * len + Math.abs(ux) * st.width, 0.8)
    }
    // Banister up the open side (the one away from the wall it hugs).
    const side = Math.sign(-(st.bottom[2] - (h.z0 + h.z1) / 2)) || 1
    const sideOff = Math.abs(ux) > 0.5 ? [0, side * (st.width / 2 + 0.03)] : [side * (st.width / 2 + 0.03), 0]
    const angle = Math.atan2(rise, run)
    const yaw = Math.atan2(ux, uz)
    const mid = [(st.bottom[0] + st.top[0]) / 2 + sideOff[0], rise / 2 + 0.92, (st.bottom[2] + st.top[2]) / 2 + sideOff[1]]
    // Long axis up the stairs: yaw onto the run, then pitch up it.
    const tilt = new Quaternion().setFromEuler(new Euler(-angle, yaw, 0, 'YXZ'))
    P.add(trim, boxGeo(0.06, 0.07, Math.hypot(run, rise), 1), mid, tilt)
    // Stand the rail on balusters (and a newel post at the bottom).
    for (let k = 0; k <= steps; k += 2) {
      const a = (k / steps) * run
      const y0 = (k / steps) * rise
      P.box(trim, st.bottom[0] + ux * a + sideOff[0], y0 + 0.46, st.bottom[2] + uz * a + sideOff[1], 0.035, 0.92, 0.035, 1)
    }
    P.box(trim, st.bottom[0] + sideOff[0], 0.55, st.bottom[2] + sideOff[1], 0.1, 1.1, 0.1, 1)
  }
  for (const [x0, z0, x1, z1] of h.rails ?? []) {
    const y = h.floors[1].y
    const len = Math.hypot(x1 - x0, z1 - z0)
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0)
    const mx = (x0 + x1) / 2
    const mz = (z0 + z1) / 2
    P.box(trim, mx, y + 0.95, mz, alongX ? len : 0.07, 0.07, alongX ? 0.07 : len, 1)
    P.box(trim, mx, y + 0.08, mz, alongX ? len : 0.05, 0.05, alongX ? 0.05 : len, 1)
    const n = Math.max(2, Math.round(len / 0.14))
    for (let k = 0; k <= n; k++) {
      const f = k / n
      P.box(trim, x0 + (x1 - x0) * f, y + 0.5, z0 + (z1 - z0) * f, 0.03, 0.85, 0.03, 1)
    }
  }

  /* ---- Roof -------------------------------------------------------------- */
  const roofMat = h.roof.flat ? acres.flatRoof() : acres.roof(look.roof)
  for (const r of roofSlabs(h)) {
    if (r.flat) {
      // Roofing on top, the ceiling (and soffit) underneath.
      const [x, y, z] = r.p
      const [w, th, d] = r.size
      P.box(roofMat, x, y + th / 2 - 0.03, z, w, 0.06, d, 2)
      P.box(ceiling, x, y - 0.03, z, w, th - 0.06, d, 2)
      // Fascia round the edge (the sides stop between the front and back runs).
      const fascia = acres.trim(look.trim)
      P.box(fascia, x, y, z - d / 2, w + 0.06, 0.32, 0.06, 1)
      P.box(fascia, x, y, z + d / 2, w + 0.06, 0.32, 0.06, 1)
      P.box(fascia, x - w / 2, y, z, 0.06, 0.32, d - 0.06, 1)
      P.box(fascia, x + w / 2, y, z, 0.06, 0.32, d - 0.06, 1)
      continue
    }
    P.add(roofMat, boxGeoFor(r.size), r.p, quat(r.q))
    // Fascia along the eave.
    const ex = (h.x0 + h.x1) / 2 + r.side * ((h.x1 - h.x0) / 2 + h.roof.overhang)
    P.box(trim, ex, r.low - 0.06, (h.z0 + h.z1) / 2, 0.05, 0.22, h.z1 - h.z0 + h.roof.overhang * 2 + 0.04, 1)
  }
  if (!h.roof.flat) {
    const cx = (h.x0 + h.x1) / 2
    // A band of siding round the top of the walls, up to the lifted roof.
    const band = top + ROOF_LIFT
    P.aabb(upperSiding, h.x0, top, h.z0, h.x1, band, h.z0 + t, 1.6)
    P.aabb(upperSiding, h.x0, top, h.z1 - t, h.x1, band, h.z1, 1.6)
    P.aabb(upperSiding, h.x0, top, h.z0 + t, h.x0 + t, band, h.z1 - t, 1.6)
    P.aabb(upperSiding, h.x1 - t, top, h.z0 + t, h.x1, band, h.z1 - t, 1.6)
    // Ridge cap and the gable ends.
    P.box(acres.roof(look.roof), cx, h.roof.ridge + 0.06, (h.z0 + h.z1) / 2, 0.34, 0.1, h.z1 - h.z0 + h.roof.overhang * 2 + 0.02, 1)
    const gable = gableGeometry(h.x0, h.x1, band, h.roof.ridge - 0.08, t)
    P.add(upperSiding, gable, [0, 0, h.z0])
    P.add(upperSiding, gable, [0, 0, h.z1 - t])
    // A gable vent in each end.
    for (const z of [h.z0 - 0.02, h.z1 + 0.02]) P.box(trim, cx, band + (h.roof.ridge - band) * 0.4, z, 0.5, 0.5, 0.04, 1)
  }
  if (look.modern) {
    // The roof kicks up past the front wall in a thin canopy.
    const w = h.x1 - h.x0 + 1.6
    P.box(acres.trim('concrete'), (h.x0 + h.x1) / 2, top + 0.55, h.z1 + 1.1, w, 0.16, 2.6, 2, [-0.26, 0, 0])
    for (const x of [h.x0 + 0.4, h.x1 - 0.4]) P.box(acres.steelDark(), x, (top + 0.45) / 2, h.z1 + 2.0, 0.12, top + 0.45, 0.12, 1)
  }
  // TV aerial on the two-storey family houses.
  if (h.floors.length > 1 && !look.noAerial) {
    const ax = (h.x0 + h.x1) / 2
    const az = h.z0 + 2.2
    const steel = acres.steelDark()
    P.box(steel, ax, h.roof.ridge + 1.0, az, 0.05, 2.0, 0.05, 1)
    for (const [y, w] of [[1.4, 1.6], [1.75, 1.2], [2.0, 0.8]]) P.box(steel, ax, h.roof.ridge + y, az, w, 0.03, 0.03, 1)
  }

  /* ---- Chimney, porch, carport, garage ---------------------------------- */
  if (h.chimney) {
    const c = h.chimney
    P.aabb(acres.stone(), c.x0, 0, c.z0, c.x1, c.top, c.z1, 1.4)
    P.aabb(acres.concrete(), c.x0 - 0.06, c.top, c.z0 - 0.06, c.x1 + 0.06, c.top + 0.12, c.z1 + 0.06, 1)
    P.box(acres.brick(), (c.x0 + c.x1) / 2, c.top + 0.3, (c.z0 + c.z1) / 2, 0.36, 0.36, 0.36, 1)
  }
  if (h.porch) {
    const p = h.porch
    const [ox, oz] = OUT[p.side]
    const wallAt = p.side === 'e' ? h.x1 : p.side === 'w' ? h.x0 : p.side === 's' ? h.z1 : h.z0
    const slab = acres.concrete()
    if (ox) {
      const xa = wallAt
      const xb = wallAt + ox * p.depth
      P.aabb(slab, Math.min(xa, xb), 0, p.from, Math.max(xa, xb), 0.14, p.to, 1.5)
      if (!look.modern) {
        // Little canopy on two posts.
        P.aabb(acres.roof(look.roof), Math.min(xa, xb) - 0.1, 2.62, p.from - 0.15, Math.max(xa, xb) + 0.1, 2.72, p.to + 0.15, 1.2)
        P.aabb(trim, Math.min(xa, xb) - 0.12, 2.5, p.from - 0.17, Math.max(xa, xb) + 0.12, 2.62, p.to + 0.17, 1)
        for (const z of [p.from + 0.1, p.to - 0.1]) P.box(trim, xb - ox * 0.12, 1.3, z, 0.1, 2.6, 0.1, 1)
      }
    } else {
      const za = wallAt
      const zb = wallAt + oz * p.depth
      P.aabb(slab, p.from, 0, Math.min(za, zb), p.to, 0.14, Math.max(za, zb), 1.5)
    }
  }
  if (h.carport) {
    const c = h.carport
    P.aabb(acres.concrete(), c.x0, 0, c.z0, c.x1, 0.04, c.z1, 2)
    P.aabb(acres.flatRoof(), c.x0 - 0.1, c.top - 0.04, c.z0, c.x1 + 0.1, c.top, c.z1 + 0.1, 2)
    P.aabb(ceiling, c.x0 - 0.1, c.top - 0.2, c.z0, c.x1 + 0.1, c.top - 0.04, c.z1 + 0.1, 2)
    P.aabb(trim, c.x0 - 0.14, c.top - 0.26, c.z1 + 0.06, c.x1 + 0.14, c.top + 0.02, c.z1 + 0.14, 1)
    P.aabb(trim, c.x0 - 0.14, c.top - 0.26, c.z0, c.x0 - 0.06, c.top + 0.02, c.z1 + 0.06, 1)
    P.aabb(trim, c.x1 + 0.06, c.top - 0.26, c.z0, c.x1 + 0.14, c.top + 0.02, c.z1 + 0.06, 1)
    for (const [x, z] of c.posts) P.box(trim, x, (c.top - 0.2) / 2, z, 0.14, c.top - 0.2, 0.14, 1)
  }
  if (h.garage) {
    const g = h.garage
    P.aabb(acres.concrete(), g.x0 + t, 0, g.z0 + t, g.x1 - t, 0.025, g.z1, 2)
    P.aabb(acres.flatRoof(), g.x0 - 0.1, g.top - 0.04, g.z0 - 0.1, g.x1 + 0.1, g.top, g.z1, 2)
    P.aabb(ceiling, g.x0 + t, g.h, g.z0 + t, g.x1 - t, g.top - 0.04, g.z1, 2)
    P.aabb(trim, g.x0 - 0.14, g.top - 0.26, g.z0 - 0.14, g.x1 + 0.14, g.top + 0.02, g.z0 - 0.06, 1)
    P.aabb(trim, g.x0 - 0.14, g.top - 0.26, g.z0 - 0.06, g.x0 - 0.06, g.top + 0.02, g.z1, 1)
    P.aabb(trim, g.x1 + 0.06, g.top - 0.26, g.z0 - 0.06, g.x1 + 0.14, g.top + 0.02, g.z1, 1)
  }
  return P.build()
}

const boxGeoFor = (size) => boxGeo(size[0], size[1], size[2], 1.4)
const quat = (q) => new Quaternion(q[0], q[1], q[2], q[3])

/** A house by id; `of` looks it up (Atomic Acres' houses unless another map passes its own). */
export function House({ id, of = houseOf }) {
  const parts = useMemo(() => once(`house:${id}`, () => buildHouse(of(id))), [id, of])
  return <Merged parts={parts} />
}

export default House
