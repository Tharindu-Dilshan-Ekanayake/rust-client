import { useMemo } from 'react'
import { CircleGeometry, ConeGeometry, CylinderGeometry, LatheGeometry, Path, Quaternion, Shape, ShapeGeometry, SphereGeometry, TorusGeometry, Vector2, Vector3 } from 'three'

import { bridgeSlabs, CULVERTS, STATUE, towerParapet } from '../../../shared/mapHollow.js'
import { seededRandom } from '../../../shared/math.js'
import { acres } from '../acres/materials.js'
import { Merged } from '../acres/merge.jsx'
import { once, Pieces } from '../acres/pieces.js'
import { boxGeo } from '../materials.js'
import { addPumpkin, addSegment } from './kit.js'
import { hc } from './materials.js'

/**
 * Hollow Creek's landmarks: the church's bell tower, the crypt, the witch on
 * the roundabout with her cauldron, the burning watchtower, the footbridge,
 * the culverts under the lanes, the outhouses, the hay cart and the burning
 * hay in the barn. Each builds its pieces once into merged meshes, sized to its
 * colliders in shared/mapHollow.js.
 */

/** Builds once per key and draws the result. */
function useParts(key, build) {
  return useMemo(() => once(key, build), [key]) // eslint-disable-line react-hooks/exhaustive-deps
}

const quat = (q) => new Quaternion(q[0], q[1], q[2], q[3])
const _v = new Vector3()
/** A square pyramid (a 4-sided cone turned to sit square), `w` wide at the base, `h` tall, its base at y = 0. */
function pyramid(w, h) {
  const g = new ConeGeometry((w / 2) * Math.SQRT2, h, 4, 1)
  g.rotateY(Math.PI / 4)
  g.translate(0, h / 2, 0)
  const uv = g.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w * 1.4, uv.getY(i) * h * 0.7)
  return g
}

/* ---------------------------------------------------------------------------
 * The bell tower
 * ------------------------------------------------------------------------- */

export function Belfry({ x0, x1, z0, z1, belfry, top, spire }) {
  const parts = useParts('hc:belfry', () => {
    const P = new Pieces()
    const stone = acres.stone()
    const dark = hc.paint('#121014', 0.9)
    const cx = (x0 + x1) / 2
    const cz = (z0 + z1) / 2
    const w = x1 - x0
    const [b0, b1] = belfry
    // Shaft on a wider plinth, banded by string courses.
    P.aabb(stone, x0 - 0.12, 0, z0 - 0.12, x1 + 0.12, 0.6, z1 + 0.12, 1.4)
    P.aabb(stone, x0, 0.6, z0, x1, b0, z1, 1.4)
    for (const y of [4.0, 8.0, b0]) P.aabb(hc.granite('#8c8a84'), x0 - 0.08, y - 0.1, z0 - 0.08, x1 + 0.08, y + 0.1, z1 + 0.08, 1)
    // Slit windows, dark, up each face.
    for (const y of [5.6, 9.1]) {
      P.box(dark, cx, y, z1 + 0.012, 0.26, 1.1, 0.02, 1)
      P.box(dark, cx, y, z0 - 0.012, 0.26, 1.1, 0.02, 1)
      P.box(dark, x0 - 0.012, y, cz, 0.02, 1.1, 0.26, 1)
      P.box(dark, x1 + 0.012, y, cz, 0.02, 1.1, 0.26, 1)
    }
    // The clock, stopped at midnight, on the street side.
    P.add(acres.trim('bone'), new CircleGeometry(0.72, 24), [cx, 6.9, z1 + 0.02])
    P.add(hc.iron(), new TorusGeometry(0.72, 0.05, 6, 24), [cx, 6.9, z1 + 0.03])
    P.box(hc.iron(), cx, 7.12, z1 + 0.04, 0.06, 0.48, 0.02, 1)
    P.box(hc.iron(), cx + 0.03, 7.18, z1 + 0.05, 0.04, 0.6, 0.02, 1, [0, 0, -0.05])
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2
      P.box(hc.iron(), cx + Math.sin(a) * 0.6, 6.9 + Math.cos(a) * 0.6, z1 + 0.03, 0.05, 0.12, 0.01, 1, [0, 0, -a])
    }
    // The belfry: corner piers round open arches, the bell inside on its beam.
    const pier = 0.7
    for (const [px, pz] of [[x0, z0], [x1 - pier, z0], [x0, z1 - pier], [x1 - pier, z1 - pier]]) P.aabb(stone, px, b0, pz, px + pier, b1, pz + pier, 1.4)
    for (const [ax, az, bx, bz] of [[x0, z0, x1, z0 + pier], [x0, z1 - pier, x1, z1], [x0, z0, x0 + pier, z1], [x1 - pier, z0, x1, z1]]) P.aabb(stone, ax, b1 - 0.5, az, bx, b1, bz, 1.4)
    P.aabb(dark, x0 + pier, b0, z0 + pier, x1 - pier, b0 + 0.05, z1 - pier, 1)
    P.box(hc.wood('#3a2a1e'), cx, b1 - 0.7, cz, w - 0.2, 0.18, 0.18, 1)
    const bell = new LatheGeometry([new Vector2(0.05, 0.62), new Vector2(0.22, 0.6), new Vector2(0.3, 0.42), new Vector2(0.34, 0.18), new Vector2(0.46, 0.02), new Vector2(0.44, 0)], 16)
    P.add(hc.paint('#6a5a36', 0.45, 0.8), bell, [cx, b1 - 1.45, cz])
    // Cornice, then the slate spire, a finial and a weathervane.
    P.aabb(hc.granite('#8c8a84'), x0 - 0.2, top, z0 - 0.2, x1 + 0.2, top + 0.22, z1 + 0.2, 1)
    P.add(acres.roof('slate'), pyramid(w + 0.2, spire - top - 0.22), [cx, top + 0.22, cz])
    P.box(hc.iron(), cx, spire + 0.5, cz, 0.05, 1.0, 0.05, 1)
    P.add(hc.iron(), new SphereGeometry(0.09, 8, 6), [cx, spire + 0.1, cz])
    P.box(hc.iron(), cx, spire + 0.75, cz, 0.7, 0.04, 0.03, 1)
    P.box(hc.iron(), cx + 0.3, spire + 0.75, cz, 0.18, 0.2, 0.02, 1)
    return P.build()
  })
  return <Merged parts={parts} />
}

/* ---------------------------------------------------------------------------
 * The crypt
 * ------------------------------------------------------------------------- */

export function Crypt({ x0, x1, z0, z1, h }) {
  const parts = useParts('hc:crypt', () => {
    const P = new Pieces()
    const stone = acres.stone()
    const pale = hc.granite('#9a978e')
    const cx = (x0 + x1) / 2
    P.aabb(pale, x0 - 0.12, 0, z0 - 0.12, x1 + 0.12, 0.3, z1 + 0.12, 1)
    P.aabb(stone, x0, 0.3, z0, x1, h, z1, 1.4)
    // Gabled stone roof, a pediment over the door.
    const ridge = h + 0.75
    const half = (x1 - x0) / 2 + 0.2
    for (const s of [-1, 1]) {
      const run = Math.hypot(half, ridge - h)
      const ang = Math.atan2(ridge - h, half)
      P.box(pale, cx + (s * half) / 2, (h + ridge) / 2 + 0.06, (z0 + z1) / 2 + 0.2, run + 0.06, 0.14, z1 - z0 + 0.8, 1, [0, 0, -s * ang])
    }
    const gable = new Shape()
    gable.moveTo(-half + 0.2, 0)
    gable.lineTo(half - 0.2, 0)
    gable.lineTo(0, ridge - h - 0.08)
    gable.closePath()
    for (const z of [z0, z1 + 0.42]) P.add(stone, new ShapeGeometry(gable), [cx, h, z], [0, z === z0 ? Math.PI : 0, 0])
    // The portico: two columns, an architrave, the iron door, steps.
    for (const x of [x0 + 0.45, x1 - 0.45]) {
      P.add(pale, new CylinderGeometry(0.13, 0.15, h - 0.3, 10), [x, 0.3 + (h - 0.3) / 2, z1 + 0.25])
      P.aabb(pale, x - 0.2, 0.3, z1 + 0.05, x + 0.2, 0.45, z1 + 0.45, 1)
    }
    P.aabb(pale, x0 + 0.1, h - 0.22, z1, x1 - 0.1, h + 0.02, z1 + 0.45, 1)
    P.aabb(hc.paint('#2a2620', 0.6, 0.6), cx - 0.55, 0.3, z1 - 0.06, cx + 0.55, 2.25, z1 + 0.012, 1)
    for (const y of [0.9, 1.6]) P.box(hc.iron(), cx, y, z1 + 0.02, 1.0, 0.05, 0.02, 1)
    P.aabb(pale, x0 + 0.3, 0, z1, x1 - 0.3, 0.15, z1 + 0.45, 1)
    return P.build()
  })
  return <Merged parts={parts} />
}

/* ---------------------------------------------------------------------------
 * The witch and her cauldron, on the roundabout's island
 * ------------------------------------------------------------------------- */

export function Statue() {
  const parts = useParts('hc:statue', () => {
    const P = new Pieces()
    const s = STATUE
    const [cx, y, cz] = s.p
    const stone = acres.stone()
    const pale = hc.granite('#8a877f')
    // Stepped octagonal plinth, a cornice, a bronze plaque. The cornices stand
    // a centimetre proud of the stone they cap, or their tops would flicker.
    P.add(stone, new CylinderGeometry(s.base[0], s.base[0] + 0.05, s.base[1], 8), [cx, y + s.base[1] / 2, cz])
    P.add(stone, new CylinderGeometry(s.plinth[0], s.plinth[0] + 0.05, s.plinth[1], 8), [cx, y + s.base[1] + s.plinth[1] / 2, cz])
    const top = y + s.base[1] + s.plinth[1]
    P.add(pale, new CylinderGeometry(s.plinth[0] + 0.1, s.plinth[0] + 0.1, 0.11, 8), [cx, top - 0.045, cz])
    P.add(pale, new CylinderGeometry(s.base[0] + 0.06, s.base[0] + 0.06, 0.09, 8), [cx, y + s.base[1] - 0.035, cz])
    P.box(hc.paint('#5a4a2a', 0.45, 0.8), cx, y + s.base[1] + 0.45, cz + s.plinth[0] * Math.cos(Math.PI / 8) + 0.03, 0.7, 0.4, 0.03, 1)
    // The witch: a long dark robe, cape collar, crooked arms with green hands.
    const robe = hc.cloth('#251c2c')
    const skin = hc.paint('#6f8a4c', 0.7)
    P.add(robe, new CylinderGeometry(0.42, 0.95, 2.4, 12), [cx, top + 1.2, cz])
    P.add(robe, new CylinderGeometry(0.36, 0.44, 0.7, 10), [cx, top + 2.75, cz])
    P.add(hc.cloth('#3a1a2a'), new CylinderGeometry(0.66, 0.4, 0.24, 12), [cx, top + 3.0, cz])
    // Right arm out over the cauldron, a bony hand; left arm on a crooked staff.
    addSegment(P, robe, [cx + 0.42, top + 2.95, cz], [cx + 0.78, top + 2.5, cz + 0.55], 0.13, 0.11, 8)
    addSegment(P, robe, [cx + 0.78, top + 2.5, cz + 0.55], [cx + 0.62, top + 2.2, cz + 1.1], 0.11, 0.09, 8)
    P.add(skin, new SphereGeometry(0.11, 8, 6), [cx + 0.6, top + 2.12, cz + 1.18])
    for (let k = 0; k < 4; k++) addSegment(P, skin, [cx + 0.6, top + 2.1, cz + 1.2], [cx + 0.48 + k * 0.07, top + 1.92, cz + 1.36], 0.02, 0.012, 4)
    addSegment(P, robe, [cx - 0.42, top + 2.95, cz], [cx - 0.75, top + 2.45, cz + 0.25], 0.13, 0.11, 8)
    addSegment(P, robe, [cx - 0.75, top + 2.45, cz + 0.25], [cx - 0.82, top + 2.1, cz + 0.55], 0.11, 0.09, 8)
    P.add(skin, new SphereGeometry(0.11, 8, 6), [cx - 0.82, top + 2.04, cz + 0.6])
    const staff = hc.bark()
    addSegment(P, staff, [cx - 0.85, top + 0.0, cz + 0.62], [cx - 0.82, top + 2.6, cz + 0.6], 0.045, 0.04, 6)
    addSegment(P, staff, [cx - 0.82, top + 2.6, cz + 0.6], [cx - 0.62, top + 3.1, cz + 0.62], 0.04, 0.03, 6)
    addSegment(P, staff, [cx - 0.62, top + 3.1, cz + 0.62], [cx - 0.7, top + 3.3, cz + 0.62], 0.03, 0.02, 5)
    // Her head: a great carved pumpkin, glowing; the hat, its tip bent over.
    addPumpkin(P, [cx, top + 3.08, cz], 2.3, true, 0, 1)
    const hat = hc.cloth('#18131c')
    P.add(hat, new CylinderGeometry(0.95, 0.95, 0.05, 20), [cx, top + 3.78, cz], [0.08, 0, -0.05])
    P.add(hat, new CylinderGeometry(0.16, 0.5, 1.1, 14), [cx, top + 4.33, cz], [0.06, 0, -0.04])
    P.add(hat, new ConeGeometry(0.17, 0.62, 10), [cx + 0.12, top + 5.02, cz + 0.04], [0.2, 0, -0.6])
    P.add(hc.cloth('#7a2a18'), new CylinderGeometry(0.51, 0.51, 0.12, 14), [cx, top + 3.86, cz], [0.07, 0, -0.045])
    // Thorny vines creeping up the plinth.
    const rand = seededRandom(4411)
    for (let i = 0; i < 7; i++) {
      let a = (i / 7) * Math.PI * 2 + rand() * 0.4
      const r = s.plinth[0] + 0.035
      let py = y + s.base[1]
      let prev = [cx + Math.cos(a) * r, py, cz + Math.sin(a) * r]
      for (let k = 0; k < 5; k++) {
        a += 0.25 + rand() * 0.2
        py = Math.min(py + 0.16 + rand() * 0.08, top - 0.08)
        const next = [cx + Math.cos(a) * r, py, cz + Math.sin(a) * r]
        addSegment(P, staff, prev, next, 0.03, 0.022, 5)
        prev = next
      }
    }
    // The cauldron in front of her: an iron pot on three legs over a fire, the brew glowing.
    const [off, cr, ch] = s.cauldron
    const kx = cx
    const kz = cz + off
    const iron = hc.paint('#1a191c', 0.45, 0.75)
    const pot = new LatheGeometry([new Vector2(0, 0.12), new Vector2(0.42, 0.13), new Vector2(0.58, 0.3), new Vector2(cr, 0.5), new Vector2(0.56, ch - 0.06), new Vector2(0.5, ch)], 18)
    P.add(iron, pot, [kx, y, kz])
    P.add(iron, new TorusGeometry(0.51, 0.05, 6, 20), [kx, y + ch, kz], [Math.PI / 2, 0, 0])
    P.add(hc.brew(), new CircleGeometry(0.49, 20), [kx, y + ch - 0.08, kz], [-Math.PI / 2, 0, 0])
    for (let i = 0; i < 6; i++) {
      const a = rand() * Math.PI * 2
      const r = rand() * 0.34
      P.add(hc.brew(), new SphereGeometry(0.04 + rand() * 0.05, 6, 4), [kx + Math.cos(a) * r, y + ch - 0.07, kz + Math.sin(a) * r], null, [1, 0.6, 1])
    }
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5
      addSegment(P, iron, [kx + Math.cos(a) * 0.42, y + 0.2, kz + Math.sin(a) * 0.42], [kx + Math.cos(a) * 0.52, y, kz + Math.sin(a) * 0.52], 0.035, 0.035, 5)
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.3
      addSegment(P, hc.bark(), [kx + Math.cos(a) * 0.55, y + 0.05, kz + Math.sin(a) * 0.55], [kx - Math.cos(a) * 0.1, y + 0.12, kz - Math.sin(a) * 0.1], 0.05, 0.04, 6)
    }
    P.add(hc.ember(), new SphereGeometry(0.26, 8, 4), [kx, y + 0.03, kz], null, [1, 0.3, 1])
    return P.build()
  })
  return <Merged parts={parts} />
}

/* ---------------------------------------------------------------------------
 * The watchtower, burning at the top
 * ------------------------------------------------------------------------- */

export function Watchtower({ p, half, deck, cabin, spire, ladder }) {
  const parts = useParts('hc:watchtower', () => {
    const P = new Pieces()
    const [cx, , cz] = p
    const h = half
    const post = hc.wood('#4e3e30')
    const plank = hc.wood('#6a5642')
    const charred = hc.paint('#191412', 0.95)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(post, cx + sx * (h - 0.1), cabin / 2, cz + sz * (h - 0.1), 0.22, cabin, 0.22, 1)
    // Cross-braces on every face, in two bays below the deck.
    const span = (h - 0.1) * 2
    for (const [y0, y1] of [[0.3, deck / 2], [deck / 2, deck - 0.2]]) {
      const hh = y1 - y0
      const diag = Math.hypot(span, hh)
      const ang = Math.atan2(span, hh)
      for (const s of [-1, 1]) {
        for (const k of [-1, 1]) {
          P.box(post, cx, (y0 + y1) / 2, cz + s * (h - 0.1), 0.06, diag, 0.08, 1, [0, 0, k * ang])
          P.box(post, cx + s * (h - 0.1), (y0 + y1) / 2, cz, 0.08, diag, 0.06, 1, [k * ang, 0, 0])
        }
      }
      P.box(post, cx, y1, cz - (h - 0.1), span, 0.1, 0.1, 1)
      P.box(post, cx, y1, cz + (h - 0.1), span, 0.1, 0.1, 1)
    }
    // Deck, plank parapet with a rail, the ladder gap.
    P.box(plank, cx, deck - 0.08, cz, h * 2, 0.16, h * 2, 1)
    for (const r of towerParapet({ p, half, deck, ladder })) {
      const len = r.b - r.a
      const mid = (r.a + r.b) / 2
      const at = (y) => (r.axis === 'x' ? [mid, y, r.fixed] : [r.fixed, y, mid])
      const size = (sy, th) => (r.axis === 'x' ? [len, sy, th] : [th, sy, len])
      P.box(plank, ...at(deck + 0.5), ...size(1.0, 0.06), 1)
      P.box(post, ...at(deck + 1.03), ...size(0.06, 0.1), 1)
    }
    // Lintels under the cabin roof, the roof, the shingled spire charred and smouldering.
    for (const s of [-1, 1]) {
      P.box(post, cx, cabin - 0.2, cz + s * (h - 0.1), h * 2, 0.16, 0.12, 1)
      P.box(post, cx + s * (h - 0.1), cabin - 0.2, cz, 0.12, 0.16, h * 2, 1)
    }
    P.box(plank, cx, cabin + 0.06, cz, h * 2 + 0.6, 0.12, h * 2 + 0.6, 1)
    P.add(acres.roof('#3a3036'), pyramid(h * 2 + 0.4, spire - cabin - 0.12), [cx, cabin + 0.12, cz])
    P.add(charred, pyramid(h * 0.9, (spire - cabin) * 0.45), [cx, cabin + 0.12 + (spire - cabin) * 0.55, cz])
    const rand = seededRandom(5521)
    for (let i = 0; i < 9; i++) {
      const a = rand() * Math.PI * 2
      const yy = cabin + 0.6 + rand() * (spire - cabin - 1.6)
      const r = (h + 0.2) * (1 - (yy - cabin) / (spire - cabin)) + 0.02
      P.box(hc.ember(), cx + Math.cos(a) * r, yy, cz + Math.sin(a) * r, 0.3 + rand() * 0.4, 0.06, 0.3 + rand() * 0.3, 1, [rand() * 0.6, -a, 0])
    }
    return P.build()
  })
  return <Merged parts={parts} />
}

/* ---------------------------------------------------------------------------
 * Footbridge, culverts
 * ------------------------------------------------------------------------- */

export function Bridge(b) {
  const parts = useParts('hc:bridge', () => {
    const P = new Pieces()
    const plank = hc.wood('#7a6048')
    const post = hc.wood('#4e3e30')
    for (const s of bridgeSlabs(b)) {
      const [W, , L] = s.size
      const q = quat(s.q)
      // A point in the slab's own frame, in the world.
      const at = (x, y, z) => {
        _v.set(x, y, z).applyQuaternion(q)
        return [s.p[0] + _v.x, s.p[1] + _v.y, s.p[2] + _v.z]
      }
      // Planks across, a hair apart, their tops flush with the slab's top face.
      const n = Math.max(2, Math.round(L / 0.24))
      for (let i = 0; i < n; i++) P.add(plank, boxGeo(W + 0.1, 0.05, L / n - 0.03, 1), at(0, 0.035, -L / 2 + (L / n) * (i + 0.5)), q)
      // Stringers under both edges.
      for (const side of [-1, 1]) P.add(post, boxGeo(0.12, 0.18, L, 1), at(side * (W / 2 - 0.08), -0.08, 0), q)
    }
    // Rails: posts along both sides, a top rail following the hump.
    P.withFrame([b.p[0], 0, b.p[2]], b.rotY, () => {
      const q = b.length / 4
      const deckAt = (z) => (Math.abs(z) <= q ? b.rise : Math.max(0.02, b.rise * (1 - (Math.abs(z) - q) / (q + 0.15))))
      for (const side of [-1, 1]) {
        const x = side * (b.width / 2 - 0.05)
        const zs = [-q * 1.8, -q, 0, q, q * 1.8]
        for (const z of zs) P.box(post, x, deckAt(z) + 0.5, z, 0.09, 1.0, 0.09, 1)
        for (let i = 0; i < zs.length - 1; i++) {
          const za = zs[i]
          const zb = zs[i + 1]
          const ya = deckAt(za) + 0.98
          const yb = deckAt(zb) + 0.98
          const len = Math.hypot(zb - za, yb - ya)
          P.box(post, x, (ya + yb) / 2, (za + zb) / 2, 0.07, 0.07, len + 0.06, 1, [-Math.atan2(yb - ya, zb - za), 0, 0])
        }
      }
    })
    return P.build()
  })
  return <Merged parts={parts} />
}

/** Concrete headwalls where the creek goes under the lanes, a dark pipe mouth in each. */
export function Culverts() {
  const parts = useParts('hc:culverts', () => {
    const P = new Pieces()
    const concrete = acres.concrete()
    const dark = hc.paint('#0c0c0e', 0.95)
    for (const c of CULVERTS) {
      P.box(concrete, c.x, c.h / 2, c.z, 0.24, c.h, c.length, 1.5)
      P.box(concrete, c.x, c.h + 0.04, c.z, 0.32, 0.08, c.length + 0.1, 1.5)
      const mouth = new CircleGeometry(0.27, 16, 0, Math.PI)
      P.add(dark, mouth, [c.x + c.face * 0.125, 0.0, c.z], [0, (c.face * Math.PI) / 2, 0])
    }
    return P.build()
  })
  return <Merged parts={parts} />
}

/* ---------------------------------------------------------------------------
 * Outhouses, the hay cart, the burning hay
 * ------------------------------------------------------------------------- */

/** A crescent moon cut into a door. */
function crescentGeometry(r) {
  const s = new Shape()
  s.absarc(0, 0, r, 0, Math.PI * 2, false)
  const hole = new Path()
  hole.absarc(r * 0.45, r * 0.15, r * 0.85, 0, Math.PI * 2, true)
  s.holes.push(hole)
  return new ShapeGeometry(s, 16)
}

export function Outhouse({ p, rotY }) {
  const parts = useParts(`hc:outhouse:${p[0]}`, () => {
    const P = new Pieces()
    const wood = hc.wood('#6a5038')
    P.withFrame(p, rotY, () => {
      P.box(wood, 0, 1.1, 0, 1.3, 2.2, 1.3, 1)
      P.box(hc.wood('#3e2e22'), 0, 2.32, -0.05, 1.5, 0.08, 1.6, 1, [0.18, 0, 0])
      P.box(hc.wood('#4a3626'), 0, 1.0, 0.655, 0.8, 1.9, 0.02, 1)
      P.add(hc.paint('#0c0b0d', 0.9), crescentGeometry(0.12), [0.05, 1.7, 0.67])
      P.box(hc.iron(), 0.3, 1.0, 0.68, 0.04, 0.12, 0.03, 1)
    })
    return P.build()
  })
  return <Merged parts={parts} />
}

export function Cart({ p, rotY }) {
  const parts = useParts(`hc:cart:${p[0]}:${p[2]}`, () => {
    const P = new Pieces()
    const wood = hc.wood('#6e5236')
    P.withFrame(p, rotY, () => {
      // Bed, sides, the wheels on their axle, shafts down to the ground ahead.
      P.box(wood, 0, 0.92, 0, 1.6, 0.1, 2.9, 1)
      for (const s of [-1, 1]) P.box(wood, s * 0.78, 1.15, 0, 0.06, 0.38, 2.9, 1)
      P.box(wood, 0, 1.15, 1.42, 1.6, 0.38, 0.06, 1)
      for (const s of [-1, 1]) {
        P.add(wood, new TorusGeometry(0.55, 0.05, 6, 18), [s * 0.95, 0.58, 0.2], [0, Math.PI / 2, 0])
        for (let k = 0; k < 6; k++) P.box(wood, s * 0.95, 0.58, 0.2, 0.04, 1.06, 0.05, 1, [(k / 6) * Math.PI, 0, 0])
        P.add(hc.iron(), new CylinderGeometry(0.08, 0.08, 0.12, 8), [s * 0.95, 0.58, 0.2], [0, 0, Math.PI / 2])
        P.box(wood, s * 0.45, 0.55, -2.1, 0.07, 0.07, 2.6, 1, [-0.34, 0, 0])
      }
      P.box(hc.iron(), 0, 0.58, 0.2, 1.9, 0.06, 0.06, 1)
      // Its load: hay and pumpkins.
      P.box(hc.hay(), 0, 1.25, 0.1, 1.44, 0.6, 2.5, 0.8)
      addPumpkin(P, [0.35, 1.55, -0.5], 1.2, false, 0.4)
      addPumpkin(P, [-0.3, 1.55, 0.3], 1.0, false, 1.2)
      addPumpkin(P, [0.2, 1.55, 0.85], 1.3, true, Math.PI / 2, 3)
    })
    return P.build()
  })
  return <Merged parts={parts} />
}

/** Loose hay piled in the barn, burning (the flames and smoke come from the effects system). */
export function HayPile({ p, rotY }) {
  const parts = useParts('hc:hayPile', () => {
    const P = new Pieces()
    P.withFrame(p, rotY, () => {
      P.add(hc.hay(), new SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), [0, 0, 0], null, [1.1, 0.75, 0.9])
      P.add(hc.ember(), new SphereGeometry(0.7, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), [0.1, 0.25, 0.05], null, [1, 0.8, 0.9])
      const rand = seededRandom(661)
      for (let i = 0; i < 5; i++) P.box(hc.paint('#141010', 0.95), (rand() - 0.5) * 1.4, 0.3 + rand() * 0.3, (rand() - 0.5) * 1.2, 1.2, 0.08, 0.12, 1, [0, rand() * 3, rand() * 0.5])
    })
    return P.build()
  })
  return <Merged parts={parts} />
}
