import { useMemo } from 'react'
import { ExtrudeGeometry, PlaneGeometry, Quaternion, Shape, Vector3 } from 'three'

import { rampBox } from '../../../shared/mapKit.js'
import {
  buildingOf,
  buildingOpenings,
  buildingWallBoxes,
  eaveOfBuilding,
  landingRails,
  PW_ROOF_T,
  PW_SLAB_T,
  PW_WALL_T,
  roofOf,
  stairPieces,
} from '../../../shared/mapPalmwood.js'
import { seededRandom } from '../../../shared/math.js'
import { boxGeo } from '../materials.js'
import { Merged } from '../acres/merge.jsx'
import { once, Pieces } from '../acres/pieces.js'
import { addSheets, GROUND_Y } from './kit.js'
import { PAINT, pw } from './materials.js'
import { MARK_GLYPHS } from './textures.js'

/**
 * A Palmwood building from its shared description (shared/mapPalmwood.js):
 * the same wall pieces its colliders are made of, dressed. Plywood (or tin)
 * outside, darker plywood inside, a painted band, timber corner posts and
 * frames round the openings, plywood shutters propped open over some windows,
 * floors, the roof in sheets of mixed tin on rafters, gable infill, the
 * veranda, the Frame's stairs, open top floor, joists and safety mesh, and the
 * stencilled marks on the walls.
 */

const OUT = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }
const INSIDE = '#b89a74'
const TIMBER = '#caa57a'
const BAND = [1.0, 1.22]

const _q = new Quaternion()
const _x = new Vector3()
const _y = new Vector3()

function wallLook(look) {
  if (look.walls === 'tin') return { out: pw.tin(look.wallTint ?? 'galvanized'), inside: pw.tin('galvanized'), tile: 1.6 }
  if (look.walls === 'painted') return { out: pw.plywood(PAINT[look.paint] ?? look.paint), inside: pw.plywood(INSIDE), tile: 2.44 }
  return { out: pw.plywood(), inside: pw.plywood(INSIDE), tile: 2.44 }
}

/** A plane `w` x `h` with its UVs at world scale (one tile per `tile` m). */
function plane(w, h, tile) {
  const g = new PlaneGeometry(w, h)
  const uv = g.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * h) / tile)
  return g
}

/** A flat shape (x along, y up) extruded `depth`, turned `rotY`, placed at `at`. */
function prism(points, depth) {
  const s = new Shape()
  points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)))
  s.closePath()
  const g = new ExtrudeGeometry(s, { depth, bevelEnabled: false })
  const uv = g.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2.44, uv.getY(i) / 2.44)
  return g
}

/** Places a prism drawn along a wall: `axis` 'x' runs along world x, 'z' along world z; it spans [at, at+depth] across. */
function addAlongWall(P, material, points, depth, axis, at, from) {
  const g = prism(points, depth)
  if (axis === 'x') P.add(material, g, [from, 0, at], [0, 0, 0])
  // Turned -90° about y: shape x runs along +z, the extrusion toward -x.
  else P.add(material, g, [at + depth, 0, from], [0, -Math.PI / 2, 0])
}

function addFrames(P, b, timber, rand) {
  const jw = 0.07
  for (const o of buildingOpenings(b)) {
    if (o.bay) continue
    const along = o.axis === 'x' ? [1, 0] : [0, 1]
    const [cx, cz] = o.at
    const w = o.width
    const depth = o.t + 0.04
    const box = (a, y0, y1, len, d = depth) => {
      const x = cx + along[0] * a
      const z = cz + along[1] * a
      const sx = o.axis === 'x' ? len : d
      const sz = o.axis === 'x' ? d : len
      P.box(timber, x, (y0 + y1) / 2, z, sx, y1 - y0, sz, 1)
    }
    // Jambs inside the opening, the head between them, a sill under windows.
    for (const s of [-1, 1]) box(s * (w / 2 - jw / 2), o.y0, o.y1, jw)
    box(0, o.y1 - jw, o.y1, w - jw * 2)
    if (!o.door) box(0, o.y0, o.y0 + 0.05, w + 0.16, o.t + 0.1)
    // Plywood shutter propped open over some outside windows.
    if (!o.door && o.side !== 'inner' && rand() < 0.5) {
      const [ox, oz] = OUT[o.side]
      const tilt = 0.95
      const h = o.y1 - o.y0
      // Hinged at the top, swung out and up.
      const hx = cx + ox * (o.t / 2 + 0.02)
      const hz = cz + oz * (o.t / 2 + 0.02)
      const out = Math.sin(tilt) * h * 0.5
      const down = Math.cos(tilt) * h * 0.5
      const yaw = o.axis === 'x' ? 0 : Math.PI / 2
      const pitch = (o.axis === 'x' ? -oz : ox) * tilt
      const rot = o.axis === 'x' ? [pitch, yaw, 0] : [0, 0, -pitch]
      const sx = o.axis === 'x' ? w : 0.025
      const sz = o.axis === 'x' ? 0.025 : w
      P.add(pw.plywood(), boxGeo(sx, h, sz, 2.44), [hx + ox * out, o.y1 - down, hz + oz * out], rot)
      // The prop stick.
      P.box(timber, hx + ox * out * 1.1, o.y1 - h * 0.55, hz + oz * out * 1.1, 0.03, h * 0.75, 0.03, 1)
    }
  }
}

function addStairs(P, st, timber, tread) {
  const s = stairPieces(st)
  const Y = st.top[1]
  const dx = st.top[0] - st.bottom[0]
  const dz = st.top[2] - st.bottom[2]
  const run = Math.hypot(dx, dz)
  const ux = dx / run
  const uz = dz / run
  const N = Math.round(Y / 0.18)
  const lat = [-uz, ux]
  const at = (f, l, y) => [st.bottom[0] + ux * run * f + lat[0] * l, y, st.bottom[2] + uz * run * f + lat[1] * l]
  const alongX = Math.abs(ux) > 0.5
  // Treads and risers.
  for (let i = 0; i < N; i++) {
    const top = (Y * (i + 1)) / N
    const p = at((i + 0.5) / N, 0, top - 0.025)
    const len = run / N + 0.03
    P.box(tread, p[0], p[1], p[2], alongX ? len : st.width, 0.05, alongX ? st.width : len, 1)
    const r = at(i / N, 0, top - Y / N / 2 - 0.025)
    P.box(timber, r[0], r[1], r[2], alongX ? 0.03 : st.width - 0.04, Y / N, alongX ? st.width - 0.04 : 0.03, 1)
  }
  // Stringers either side.
  const q = (r) => new Quaternion(r.q[0], r.q[1], r.q[2], r.q[3])
  for (const l of [-1, 1]) {
    const off = l * (st.width / 2 - 0.03)
    const top = [st.top[0] + lat[0] * off, Y + 0.06, st.top[2] + lat[1] * off]
    const bottom = [st.bottom[0] + lat[0] * off, 0.06, st.bottom[2] + lat[1] * off]
    const r = rampBox(top, bottom, 0.06, 0.3)
    P.add(timber, boxGeo(...r.size, 1), r.p, q(r))
  }
  // Plywood skirt down the open side (it's solid under the flight).
  const side = s.side
  const openSign = Math.sign(side[0] * lat[0] + side[1] * lat[1]) || 1
  const theta = Math.atan2(-uz, ux)
  const ext = [Math.sin(theta), Math.cos(theta)]
  const outward = Math.sign(ext[0] * side[0] + ext[1] * side[1]) > 0
  const l0 = openSign * (st.width / 2) - (outward ? openSign * 0.025 : 0)
  const base = [st.bottom[0] + lat[0] * l0, st.bottom[2] + lat[1] * l0]
  const skirt = prism([[0.1, 0], [run, 0], [run, Y - 0.24], [0.1, 0.02]], 0.025)
  P.add(pw.plywood(), skirt, [base[0], 0, base[1]], [0, theta, 0])
  // Rail on the open side: posts, a sloped top rail and mid rail.
  const railOff = openSign * (st.width / 2 - 0.04)
  for (let f = 0.08; f < 1; f += 0.3) {
    const p = at(f, railOff, Y * f + 0.5)
    P.box(timber, p[0], p[1], p[2], 0.05, 1.0, 0.05, 1)
  }
  for (const h of [1.0, 0.5]) {
    const top = [st.top[0] + lat[0] * railOff, Y + h, st.top[2] + lat[1] * railOff]
    const bottom = [st.bottom[0] + lat[0] * railOff, h, st.bottom[2] + lat[1] * railOff]
    const r = rampBox(top, bottom, 0.05, 0.05)
    P.add(timber, boxGeo(...r.size, 1), r.p, q(r))
  }
  // Landing, its posts and rails.
  const L = s.landing
  P.aabb(tread, L.x0, L.y - 0.15, L.z0, L.x1, L.y, L.z1, 1)
  const ox = st.open === 'e' ? L.x1 - 0.08 : L.x0 + 0.08
  for (const z of [L.z0 + 0.08, L.z1 - 0.08]) P.box(timber, ox, (L.y - 0.15) / 2, z, 0.12, L.y - 0.15, 0.12, 1)
  for (const r of landingRails(st)) {
    const alongRailX = Math.abs(r.b[0] - r.a[0]) > Math.abs(r.b[1] - r.a[1])
    const len = Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1])
    const mx = (r.a[0] + r.b[0]) / 2
    const mz = (r.a[1] + r.b[1]) / 2
    for (const h of [1.0, 0.5]) P.box(timber, mx, r.y + h, mz, alongRailX ? len : 0.05, 0.05, alongRailX ? 0.05 : len, 1)
    for (const e of [r.a, r.b]) P.box(timber, e[0], r.y + 0.5, e[1], 0.05, 1.0, 0.05, 1)
  }
}

function buildBuilding(b) {
  const P = new Pieces()
  const rand = seededRandom(b.id.split('').reduce((h, ch) => h * 31 + ch.charCodeAt(0), 7))
  const t = PW_WALL_T
  const look = b.look
  const walls = wallLook(look)
  const timber = pw.wood(TIMBER)
  const band = look.band ? pw.paint(PAINT[look.band], 0.6) : null
  const eave = eaveOfBuilding(b)

  /* ---- Walls ------------------------------------------------------------ */
  for (const w of buildingWallBoxes(b)) {
    const [sx, sy, sz] = w.size
    if (w.side === 'inner') {
      P.box(walls.inside, ...w.p, sx, sy, sz, 2.44)
      continue
    }
    const [ox, oz] = OUT[w.side]
    const half = w.axis === 'x' ? [sx, sy, t / 2] : [t / 2, sy, sz]
    P.box(walls.out, w.p[0] + (ox * t) / 4, w.p[1], w.p[2] + (oz * t) / 4, ...half, walls.tile)
    P.box(walls.inside, w.p[0] - (ox * t) / 4, w.p[1], w.p[2] - (oz * t) / 4, ...half, walls.tile)
    // The painted band round the ground floor.
    if (band && w.floor === 0 && w.y0 <= BAND[0] + 1e-3 && w.y1 >= BAND[1] - 1e-3) {
      const bt = 0.025
      if (w.axis === 'x') {
        let a = w.p[0] - sx / 2
        let c = w.p[0] + sx / 2
        if (Math.abs(a - b.x0) < 0.01) a -= bt
        if (Math.abs(c - b.x1) < 0.01) c += bt
        const z = oz < 0 ? b.z0 - bt / 2 : b.z1 + bt / 2
        P.box(band, (a + c) / 2, (BAND[0] + BAND[1]) / 2, z, c - a, BAND[1] - BAND[0], bt, 1)
      } else {
        const x = ox < 0 ? b.x0 - bt / 2 : b.x1 + bt / 2
        P.box(band, x, (BAND[0] + BAND[1]) / 2, w.p[2], bt, BAND[1] - BAND[0], sz, 1)
      }
    }
    // A timber cap along the top of the open floor's parapets.
    if (!b.roof && w.floor > 0 && w.y1 < eave - 0.01) {
      P.box(timber, w.p[0], w.y1 + 0.025, w.p[2], w.axis === 'x' ? sx : t + 0.04, 0.05, w.axis === 'x' ? t + 0.04 : sz, 1)
    }
  }
  // Corner posts up the outside corners.
  for (const [x, z] of [[b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1]]) {
    const px = x === b.x0 ? x + 0.01 : x - 0.01
    const pz = z === b.z0 ? z + 0.01 : z - 0.01
    P.box(timber, px, eave / 2, pz, 0.12, eave, 0.12, 1)
  }
  addFrames(P, b, timber, rand)

  /* ---- Floors ----------------------------------------------------------- */
  if (look.floor) {
    const m = look.floor === 'concrete' ? pw.layer('concrete', 5) : pw.layer('wood', 5)
    P.add(m, plane(b.x1 - b.x0 - t * 2, b.z1 - b.z0 - t * 2, look.floor === 'concrete' ? 3 : 1.5).rotateX(-Math.PI / 2), [(b.x0 + b.x1) / 2, GROUND_Y.floor, (b.z0 + b.z1) / 2])
  }
  if (b.slab) {
    const y = b.slab.y
    P.aabb(pw.wood('#d9b48a'), b.x0 + t, y - PW_SLAB_T, b.z0 + t, b.x1 - t, y, b.z1 - t, 1.5)
    // Joists under it, across the short way.
    const alongZ = b.x1 - b.x0 > b.z1 - b.z0
    if (alongZ) for (let x = b.x0 + t + 0.3; x < b.x1 - t - 0.1; x += 0.6) P.box(timber, x, y - PW_SLAB_T - 0.08, (b.z0 + b.z1) / 2, 0.06, 0.16, b.z1 - b.z0 - t * 2, 1)
    else for (let z = b.z0 + t + 0.3; z < b.z1 - t - 0.1; z += 0.6) P.box(timber, (b.x0 + b.x1) / 2, y - PW_SLAB_T - 0.08, z, b.x1 - b.x0 - t * 2, 0.16, 0.06, 1)
  }

  /* ---- Roof ------------------------------------------------------------- */
  const roof = roofOf(b)
  if (roof) {
    const colors = look.tarp ? null : look.tin ?? ['galvanized']
    for (const sheet of roof.sheets) {
      if (colors) addSheets(P, sheet, colors, rand)
      else {
        _q.set(sheet.q[0], sheet.q[1], sheet.q[2], sheet.q[3])
        P.add(pw.tarp(typeof look.tarp === 'string' ? look.tarp : 'blue'), boxGeo(sheet.size[0], 0.03, sheet.size[2], 2), sheet.p, _q.clone())
      }
    }
    // Rafters under the sheets, and the ridge.
    const cx = (b.x0 + b.x1) / 2
    const cz = (b.z0 + b.z1) / 2
    if (roof.type === 'gable') {
      const alongX = roof.axis === 'x'
      const len = alongX ? b.x1 - b.x0 : b.z1 - b.z0
      const half = alongX ? (b.z1 - b.z0) / 2 : (b.x1 - b.x0) / 2
      const drop = PW_ROOF_T + 0.004
      const seat = eave + 0.08 - drop
      for (let k = 0.3; k < len - 0.1; k += 1.2) {
        for (const s of [-1, 1]) {
          const top = alongX ? [b.x0 + k, roof.ridge - drop, cz] : [cx, roof.ridge - drop, b.z0 + k]
          const bottom = alongX ? [b.x0 + k, seat, cz + s * (half - t)] : [cx + s * (half - t), seat, b.z0 + k]
          const r = rampBox(top, bottom, 0.07, 0.12)
          P.add(timber, boxGeo(...r.size, 1), r.p, new Quaternion(...r.q))
        }
      }
      P.box(timber, cx, roof.ridge - drop - 0.08, cz, alongX ? len : 0.1, 0.16, alongX ? 0.1 : len, 1)
      P.box(pw.tin('galvanized'), cx, roof.ridge + 0.02, cz, alongX ? len + 1.0 : 0.34, 0.04, alongX ? 0.34 : len + 1.0, 1.6)
    } else {
      const sheet = roof.sheets[0]
      const [W] = sheet.size
      _q.set(sheet.q[0], sheet.q[1], sheet.q[2], sheet.q[3])
      _x.set(1, 0, 0).applyQuaternion(_q)
      _y.set(0, 1, 0).applyQuaternion(_q)
      for (let k = -W / 2 + 0.6; k < W / 2 - 0.3; k += 1.2) {
        const d = 0.06 + PW_ROOF_T / 2 + 0.004
        const p = [sheet.p[0] + _x.x * k - _y.x * d, sheet.p[1] + _x.y * k - _y.y * d, sheet.p[2] + _x.z * k - _y.z * d]
        P.add(timber, boxGeo(0.07, 0.12, sheet.size[2] - 0.2, 1), p, _q.clone())
      }
    }
    // Gable infill: triangles (gable roofs) or the slanted tops of the side walls (shed roofs).
    for (const g of roof.gables) {
      const span = g.to - g.from
      const h = g.y1 - g.y0
      const pts =
        roof.type === 'gable'
          ? [[0, g.y0], [span, g.y0], [span / 2, g.y0 + h]]
          : g.highAt === 'from'
            ? [[0, g.y0], [span, g.y0], [0, g.y0 + h]]
            : [[0, g.y0], [span, g.y0], [span, g.y0 + h]]
      const inward = g.side === 'n' || g.side === 'w'
      const at = inward ? g.at : g.at - t
      addAlongWall(P, walls.out, pts, t, g.axis, at, g.from)
    }
    for (const k of roof.knees) P.box(walls.out, ...k.p, ...k.size, walls.tile)
  }

  /* ---- Awning over a stall's counter ----------------------------------- */
  if (look.awning) {
    const cx = (b.x0 + b.x1) / 2
    const r = rampBox([cx, eave - 0.02, b.z0 - 0.02], [cx, eave - 0.48, b.z0 - 1.35], b.x1 - b.x0 + 0.3, 0.025)
    P.add(pw.tarp(look.awning), boxGeo(...r.size, 2), r.p, new Quaternion(...r.q))
  }

  /* ---- Veranda ---------------------------------------------------------- */
  if (b.veranda) {
    const v = b.veranda
    const wallX = v.side === 'w' ? b.x0 : b.x1
    const x = v.side === 'w' ? b.x0 - v.depth : b.x1 + v.depth
    const zc = (v.from + v.to) / 2
    const r = rampBox([wallX, v.high, zc], [x, v.low, zc], v.to - v.from, PW_ROOF_T)
    addSheets(P, r, look.tin ?? ['galvanized'], rand)
    const px = x + (v.side === 'w' ? 0.1 : -0.1)
    for (const z of v.posts) P.box(timber, px, (v.low - 0.1) / 2, z, 0.14, v.low - 0.1, 0.14, 1)
    P.box(timber, px, v.low - 0.17, zc, 0.12, 0.14, v.to - v.from, 1)
  }

  /* ---- Stairs, the open floor's mesh ------------------------------------- */
  for (const st of b.stairs ?? []) addStairs(P, st, timber, pw.wood('#d9b48a'))
  if (look.mesh) {
    for (const o of buildingOpenings(b)) {
      if (!o.bay || o.door || o.floor === 0 || rand() < 0.35) continue
      const [ox, oz] = OUT[o.side]
      const h = o.y1 - o.y0 - 0.06
      const p = [o.at[0] + ox * (o.t / 2 + 0.03), o.y0 + 0.05 + h / 2, o.at[1] + oz * (o.t / 2 + 0.03)]
      P.add(pw.mesh(), plane(o.width + 0.1, h, 1), p, [0, o.axis === 'x' ? 0 : Math.PI / 2, 0])
    }
  }

  /* ---- Stencilled marks -------------------------------------------------- */
  for (const [side, along, y, glyph] of look.marks ?? []) {
    const i = Math.max(0, MARK_GLYPHS.indexOf(glyph))
    const u0 = (i % 4) / 4
    const r = Math.floor(i / 4)
    const v1 = 1 - r * 0.25
    const g = new PlaneGeometry(0.66, 0.66)
    const uv = g.getAttribute('uv')
    for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * 0.25, v1 - 0.25 + uv.getY(k) * 0.25)
    const [ox, oz] = OUT[side]
    const face = side === 'n' ? b.z0 : side === 's' ? b.z1 : side === 'w' ? b.x0 : b.x1
    const off = 0.006 + (band && y > BAND[0] && y < BAND[1] ? 0.025 : 0)
    const p = side === 'n' || side === 's' ? [along, y, face + oz * off] : [face + ox * off, y, along]
    const yaw = { n: Math.PI, s: 0, w: -Math.PI / 2, e: Math.PI / 2 }[side]
    P.add(pw.marks(), g, p, [0, yaw, 0])
  }
  return P.build()
}

export function Building({ id }) {
  const parts = useMemo(() => once(`pw:building:${id}`, () => buildBuilding(buildingOf(id))), [id])
  return <Merged parts={parts} />
}

export default Building
