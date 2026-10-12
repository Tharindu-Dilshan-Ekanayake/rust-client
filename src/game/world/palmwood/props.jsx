import { useMemo } from 'react'
import { BufferGeometry, CylinderGeometry, DodecahedronGeometry, Float32BufferAttribute, PlaneGeometry, Quaternion, SphereGeometry } from 'three'

import { rampBox } from '../../../shared/mapKit.js'
import {
  BOAT,
  BUILDINGS,
  buildPalmwoodColliders,
  DECK,
  LOOP,
  loopPath,
  PALMWOOD_HALF,
  PW_FURNITURE,
  PW_ROOF_T,
  TANK_STAND,
  towerOf,
  towerParapet,
  TRACKS,
} from '../../../shared/mapPalmwood.js'
import { rotate3, seededRandom } from '../../../shared/math.js'
import { boxGeo } from '../materials.js'
import { Merged } from '../acres/merge.jsx'
import { once, Pieces } from '../acres/pieces.js'
import { addSheets } from './kit.js'
import { pw } from './materials.js'
import { addBanana, addBush, addPalm, addTuft, trunk } from './plants.js'

/**
 * Everything in Palmwood that isn't a building or the ground: the camo deck,
 * lookout towers, water tank, the boat, fences, sandbags, crates, drums,
 * generators, logs, pallets, boom gates, the campfire, washing lines, the
 * lean-to, the plants and what's inside the buildings. Each builds its pieces
 * once into merged meshes; the static batcher merges them map-wide.
 */

const TIMBER = '#caa57a'
const timber = () => pw.wood(TIMBER)

/** Builds once per key and draws the result. */
function useParts(key, build) {
  return useMemo(() => once(key, build), [key]) // eslint-disable-line react-hooks/exhaustive-deps
}
const keyOf = (type, p, extra = '') => `pw:${type}:${p[0].toFixed(2)}:${p[2].toFixed(2)}:${extra}`

/** Runs `fn` in an entity's frame (position + yaw). */
function framed(P, p, rotY, fn) {
  P.withFrame(p, rotY ?? 0, fn)
}

/* ---------------------------------------------------------------------------
 * Raised things
 * ------------------------------------------------------------------------- */

/** A sagging net over a w x d rectangle centred on (0, 0, 0): lower at the middle, drooping past the edges. */
function netGeometry(w, d, sag = 0.22, droop = 0.6) {
  const g = new PlaneGeometry(w, d, 10, 10)
  g.rotateX(-Math.PI / 2)
  const pos = g.getAttribute('position')
  const uv = g.getAttribute('uv')
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / (w / 2)
    const z = pos.getZ(i) / (d / 2)
    const edge = Math.max(Math.abs(x), Math.abs(z))
    pos.setY(i, -Math.cos(x * Math.PI * 0.5) * Math.cos(z * Math.PI * 0.5) * sag - Math.max(0, edge - 0.86) * droop * 4)
    uv.setXY(i, uv.getX(i) * w * 0.5, uv.getY(i) * d * 0.5)
  }
  g.computeVertexNormals()
  return g
}

export function Deck({ x0, x1, z0, z1, y, net }) {
  const parts = useParts('pw:deck', () => {
    const P = new Pieces()
    const wood = pw.wood('#b08860')
    const cx = (x0 + x1) / 2
    const cz = (z0 + z1) / 2
    // Planks run east-west, a fascia board round the edge.
    for (let z = z0; z < z1 - 0.01; z += 0.3) P.aabb(wood, x0, y - 0.05, z + 0.01, x1, y, Math.min(z1, z + 0.29), 1)
    P.aabb(timber(), x0 - 0.02, 0, z0 - 0.02, x1 + 0.02, y - 0.05, z0, 1)
    P.aabb(timber(), x0 - 0.02, 0, z1, x1 + 0.02, y - 0.05, z1 + 0.02, 1)
    P.aabb(timber(), x0 - 0.02, 0, z0, x0, y - 0.05, z1, 1)
    P.aabb(timber(), x1, 0, z0, x1 + 0.02, y - 0.05, z1, 1)
    P.aabb(pw.wood('#8a6a48'), x0, 0, z0, x1, y - 0.05, z1, 1)
    for (const x of [x0 + 0.1, x1 - 0.1]) for (const z of [z0 + 0.1, z1 - 0.1]) P.box(timber(), x, (net + y) / 2, z, 0.14, net - y, 0.14, 1)
    P.box(timber(), cx, net - 0.06, z0 + 0.1, x1 - x0, 0.1, 0.1, 1)
    P.box(timber(), cx, net - 0.06, z1 - 0.1, x1 - x0, 0.1, 0.1, 1)
    P.add(pw.camo(), netGeometry(x1 - x0 + 0.8, z1 - z0 + 0.8), [cx, net + 0.02, cz])
    return P.build()
  })
  return <Merged parts={parts} />
}

export function Tower({ id }) {
  const parts = useParts(`pw:tower:${id}`, () => {
    const P = new Pieces()
    const t = towerOf(id)
    const [cx, , cz] = t.p
    const h = t.half
    const post = timber()
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(post, cx + sx * (h - 0.1), t.roof / 2, cz + sz * (h - 0.1), 0.2, t.roof, 0.2, 1)
    // X-braces on every face, in two bays below the deck.
    const span = (h - 0.1) * 2
    for (const [y0, y1] of [[0.3, t.deck / 2], [t.deck / 2, t.deck - 0.2]]) {
      const hh = y1 - y0
      const diag = Math.hypot(span, hh)
      const ang = Math.atan2(span, hh)
      for (const s of [-1, 1]) {
        for (const k of [-1, 1]) {
          P.box(post, cx, (y0 + y1) / 2, cz + s * (h - 0.1), 0.06, diag, 0.08, 1, [0, 0, k * ang])
          P.box(post, cx + s * (h - 0.1), (y0 + y1) / 2, cz, 0.08, diag, 0.06, 1, [k * ang, 0, 0])
        }
      }
    }
    // Deck, parapet (plywood, a rail on top) and the tin roof.
    P.box(pw.wood('#b08860'), cx, t.deck - 0.08, cz, h * 2, 0.16, h * 2, 1)
    for (const r of towerParapet(t)) {
      const len = r.b - r.a
      const mid = (r.a + r.b) / 2
      const at = (y) => (r.axis === 'x' ? [mid, y, r.fixed] : [r.fixed, y, mid])
      const size = (sy, th) => (r.axis === 'x' ? [len, sy, th] : [th, sy, len])
      P.box(pw.plywood(), ...at(t.deck + 0.5), ...size(1.0, 0.06), 2.44)
      P.box(post, ...at(t.deck + 1.03), ...size(0.06, 0.1), 1)
    }
    const roof = { p: [cx, t.roof + 0.04, cz], size: [h * 2 + 0.8, PW_ROOF_T, h * 2 + 0.8], q: [0, 0, 0, 1] }
    addSheets(P, roof, id === 'nw' ? ['red', 'rust'] : ['teal', 'rust'], seededRandom(id === 'nw' ? 31 : 37))
    P.box(post, cx, t.roof - 0.1, cz, h * 2 + 0.2, 0.12, 0.12, 1)
    P.box(post, cx, t.roof - 0.1, cz, 0.12, 0.12, h * 2 + 0.2, 1)
    return P.build()
  })
  return <Merged parts={parts} />
}

export function TankStand() {
  const parts = useParts('pw:tankStand', () => {
    const P = new Pieces()
    const s = TANK_STAND
    const [cx, , cz] = s.p
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(timber(), cx + sx * (s.half - 0.08), s.deck / 2, cz + sz * (s.half - 0.08), 0.16, s.deck, 0.16, 1)
    const span = (s.half - 0.08) * 2
    const hh = s.deck - 0.4
    const diag = Math.hypot(span, hh)
    const ang = Math.atan2(span, hh)
    for (const side of [-1, 1]) {
      P.box(timber(), cx, s.deck / 2, cz + side * (s.half - 0.08), 0.05, diag, 0.07, 1, [0, 0, side * ang])
      P.box(timber(), cx + side * (s.half - 0.08), s.deck / 2, cz, 0.07, diag, 0.05, 1, [side * ang, 0, 0])
    }
    P.box(pw.wood('#b08860'), cx, s.deck - 0.07, cz, s.half * 2, 0.14, s.half * 2, 1)
    const black = pw.paint('#202224', 0.75)
    P.add(black, new CylinderGeometry(s.r, s.r * 0.97, s.h, 18), [cx, s.deck + s.h / 2, cz])
    for (const y of [0.35, 0.75, 1.15]) P.add(black, new CylinderGeometry(s.r + 0.03, s.r + 0.03, 0.06, 18), [cx, s.deck + y, cz])
    P.add(black, new CylinderGeometry(0.22, 0.22, 0.12, 12), [cx, s.deck + s.h + 0.06, cz])
    // Outlet pipe down a leg.
    P.box(pw.paint('#c8c4ba', 0.5), cx + s.half - 0.25, s.deck / 2, cz + s.half - 0.08, 0.06, s.deck, 0.06, 1)
    return P.build()
  })
  return <Merged parts={parts} />
}

/**
 * Part of the hull's skin: stations from the bow (-L/2, pointed) to the
 * transom (+L/2); round each, `f` from f0 to f1 (0 = port gunwale, 0.5 = keel,
 * 1 = starboard gunwale). `inset` shrinks it (the inside), `inward` turns
 * its faces in.
 */
function hullGeometry(L, halfBeam, depth, f0, f1, inset = 0, inward = false) {
  const n = 12
  const m = 8
  const pos = []
  const uv = []
  const idx = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const z = -L / 2 + t * L
    // Pointed bow, broad middle, narrowing a little to a squared-off transom.
    const b = Math.max(0.02, halfBeam * (t < 0.55 ? Math.sin((t / 0.55) * Math.PI * 0.5) ** 0.8 : 1 - (t - 0.55) * 0.35) - inset)
    const d = depth * (t < 0.3 ? 0.55 + (t / 0.3) * 0.45 : 1) - inset
    for (let k = 0; k <= m; k++) {
      const f = f0 + ((f1 - f0) * k) / m
      const ang = f * Math.PI
      pos.push(-Math.cos(ang) * b, -Math.sin(ang) * d, z)
      uv.push(z * 0.5, f * 2)
    }
  }
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < m; k++) {
      const a = i * (m + 1) + k
      const c = a + m + 1
      if (inward) idx.push(a, c, a + 1, a + 1, c, c + 1)
      else idx.push(a, a + 1, c, a + 1, c + 1, c)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

export function Boat({ p, rotY }) {
  const parts = useParts(keyOf('boat', p), () => {
    const P = new Pieces()
    const { length: L, beam, keel, top } = BOAT
    const depth = top - keel
    framed(P, p, rotY, () => {
      // Blocks under the keel.
      for (const z of [-1.4, 1.2]) P.box(timber(), 0, keel / 2, z, 0.9, keel, 0.4, 1)
      // Blue below, a white band along the top of each side, wood inside.
      P.add(pw.paint('#2f6aa0', 0.6), hullGeometry(L, beam / 2, depth, 0.12, 0.88), [0, top, 0])
      for (const [f0, f1] of [[0, 0.12], [0.88, 1]]) P.add(pw.paint('#ece6d6', 0.6), hullGeometry(L, beam / 2, depth, f0, f1), [0, top, 0])
      P.add(pw.wood('#9a7a58'), hullGeometry(L, beam / 2, depth, 0, 1, 0.05, true), [0, top, 0])
      // Transom, gunwale rail, thwarts, floorboards, an outboard and the oars.
      P.box(pw.paint('#ece6d6', 0.6), 0, top - depth * 0.45, L / 2 - 0.02, beam * 0.62, depth * 0.85, 0.06, 1)
      P.box(pw.paint('#b8352c', 0.6), 0, top - 0.05, L / 2 - 0.02, beam * 0.66, 0.1, 0.08, 1)
      for (const z of [-1.2, 0.4, 1.9]) P.box(pw.wood('#9a7a58'), 0, top - 0.35, z, beam * 0.86, 0.05, 0.3, 1)
      P.box(pw.wood('#8a6a48'), 0, keel + 0.18, 0.3, beam * 0.5, 0.04, L * 0.6, 1)
      P.box(pw.paint('#1e1e1e', 0.6), 0, top - 0.1, L / 2 + 0.25, 0.32, 0.5, 0.36, 1)
      P.box(pw.paint('#1e1e1e', 0.6), 0, top - 0.75, L / 2 + 0.32, 0.12, 0.8, 0.12, 1)
      for (const s of [-1, 1]) P.box(pw.wood('#c09a6a'), s * 0.35, top - 0.3, -0.2, 0.06, 0.06, 2.6, 1, [0, s * 0.08, 0])
    })
    return P.build()
  })
  return <Merged parts={parts} />
}

/* ---------------------------------------------------------------------------
 * Fences
 * ------------------------------------------------------------------------- */

function along(a, b) {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const len = Math.hypot(dx, dz)
  return { len, yaw: Math.atan2(-dz, dx), mid: [(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2] }
}

export function PlyFence({ a, b, h }) {
  const parts = useParts(keyOf('plyFence', [a[0], 0, a[1]], `${b[0]}:${b[1]}`), () => {
    const P = new Pieces()
    const { len, yaw, mid } = along(a, b)
    framed(P, mid, yaw, () => {
      for (let x = -len / 2; x < len / 2 - 0.01; x += 1.22) {
        const w = Math.min(1.22, len / 2 - x)
        P.box(pw.plywood(), x + w / 2, h / 2, 0.02, w - 0.01, h - 0.05, 0.02, 2.44)
      }
      for (let x = -len / 2 + 0.04; x <= len / 2; x += Math.max(0.5, len / Math.ceil(len / 2.4))) P.box(timber(), x, h / 2, -0.03, 0.08, h + 0.1, 0.08, 1)
      for (const y of [0.3, h - 0.3]) P.box(timber(), 0, y, -0.03, len, 0.08, 0.05, 1)
    })
    return P.build()
  })
  return <Merged parts={parts} />
}

export function TinFence({ a, b, h }) {
  const parts = useParts(keyOf('tinFence', [a[0], 0, a[1]], `${b[0]}:${b[1]}`), () => {
    const P = new Pieces()
    const { len, yaw, mid } = along(a, b)
    const rand = seededRandom(Math.round(a[0] * 13 + a[1] * 7))
    const colors = ['rust', 'galvanized', 'red', 'rust', 'teal', 'white']
    framed(P, mid, yaw, () => {
      const n = Math.max(1, Math.round(len / 0.9))
      const w = len / n
      for (let i = 0; i < n; i++) {
        const x = -len / 2 + w * (i + 0.5)
        const tall = h - rand() * 0.25
        P.box(pw.tin(colors[Math.floor(rand() * colors.length)]), x, tall / 2, (i % 2) * 0.012, w + 0.03, tall, 0.02, 1.6)
      }
      for (let x = -len / 2 + 0.05; x <= len / 2; x += len / Math.ceil(len / 2.2)) P.box(timber(), x, h / 2, -0.05, 0.08, h + 0.05, 0.08, 1)
      for (const y of [0.35, h - 0.35]) P.box(timber(), 0, y, -0.05, len, 0.07, 0.05, 1)
    })
    return P.build()
  })
  return <Merged parts={parts} />
}

/* ---------------------------------------------------------------------------
 * Cover
 * ------------------------------------------------------------------------- */

const bagGeo = new SphereGeometry(0.5, 8, 4)

export function Sandbags({ a, b, layers, y = 0 }) {
  const parts = useParts(keyOf('sandbags', [a[0], y, a[1]], `${b[0]}:${b[1]}`), () => {
    const P = new Pieces()
    const { len, yaw, mid } = along(a, b)
    const rand = seededRandom(Math.round(a[0] * 17 + b[1] * 5))
    const tints = ['#7f8a5c', '#8a8e60', '#6f7a50']
    framed(P, [mid[0], y, mid[2]], yaw, () => {
      for (let l = 0; l < layers; l++) {
        const offset = l % 2 ? 0.28 : 0
        for (const row of [-0.155, 0.155]) {
          for (let x = -len / 2 + 0.29 + offset; x <= len / 2 - 0.27; x += 0.56) {
            P.add(pw.burlap(tints[Math.floor(rand() * tints.length)]), bagGeo, [x, 0.11 + l * 0.17, row], [0, (rand() - 0.5) * 0.25, 0], [0.6, 0.22, 0.34])
          }
        }
      }
    })
    return P.build()
  })
  return <Merged parts={parts} />
}

function addCrate(P, w, h, d, y = 0, tint = '#c8a070') {
  P.box(pw.wood(tint), 0, y + h / 2, 0, w, h, d, 1)
  const b = 0.05
  const dark = pw.wood('#8a6a48')
  // Battens round the faces, standing just proud of them.
  for (const s of [-1, 1]) {
    P.box(dark, 0, y + b / 2, s * (d / 2 + 0.01), w + 0.02, b, 0.02, 1)
    P.box(dark, 0, y + h - b / 2, s * (d / 2 + 0.01), w + 0.02, b, 0.02, 1)
    P.box(dark, s * (w / 2 + 0.01), y + b / 2, 0, 0.02, b, d, 1)
    P.box(dark, s * (w / 2 + 0.01), y + h - b / 2, 0, 0.02, b, d, 1)
  }
}

export function Crate({ p, size, rotY }) {
  const parts = useParts(keyOf('crate', p, size.join(':')), () => {
    const P = new Pieces()
    framed(P, p, rotY, () => addCrate(P, ...size))
    return P.build()
  })
  return <Merged parts={parts} />
}

function addPallet(P, y = 0, w = 1.2, d = 1.0) {
  const wood = pw.wood('#b8926a')
  for (const x of [-w / 2 + 0.05, 0, w / 2 - 0.05]) P.box(wood, x, y + 0.05, 0, 0.1, 0.1, d, 1)
  for (let z = -d / 2 + 0.05; z <= d / 2 - 0.04; z += (d - 0.1) / 4) P.box(wood, 0, y + 0.12, z, w, 0.03, 0.09, 1)
}

const drumGeo = (() => {
  const g = new CylinderGeometry(0.29, 0.29, 0.88, 16)
  return g
})()

export function Barrels({ kind, p, rotY }) {
  const parts = useParts(keyOf('barrels', p, kind), () => {
    const P = new Pieces()
    framed(P, p, rotY, () => {
      if (kind === 'stack') {
        for (const level of [0, 1]) {
          const y = level * 1.02
          addPallet(P, y, 1.25, 1.15)
          for (const [x, z] of [[-0.3, -0.24], [0.3, -0.24], [0, 0.28]]) P.add(pw.drum(), drumGeo, [x, y + 0.14 + 0.44, z], [0, x * 3 + level, 0])
        }
      } else {
        const rust = pw.rust()
        P.add(rust, drumGeo, [-0.36, 0.44, -0.2], [0, 0.4, 0])
        P.add(rust, drumGeo, [0.28, 0.44, -0.3], [0, 1.1, 0])
        P.add(pw.drum(), drumGeo, [0.0, 0.29, 0.38], [0, 0, Math.PI / 2])
      }
    })
    return P.build()
  })
  return <Merged parts={parts} />
}

export function Generator({ p, rotY }) {
  const parts = useParts(keyOf('generator', p), () => {
    const P = new Pieces()
    const olive = pw.paint('#5b6a38', 0.6)
    const dark = pw.paint('#2a2c2a', 0.5, 0.6)
    framed(P, p, rotY, () => {
      for (const z of [-0.42, 0.42]) P.box(dark, 0, 0.06, z, 1.8, 0.12, 0.1, 1)
      P.box(olive, 0, 0.62, 0, 1.6, 0.95, 0.9, 1)
      P.box(dark, -0.45, 0.68, 0.455, 0.5, 0.45, 0.02, 1)
      P.box(pw.paint('#c8a63a', 0.5), 0.35, 0.95, 0.455, 0.3, 0.12, 0.02, 1)
      for (let x = 0.15; x < 0.75; x += 0.1) P.box(dark, x, 0.55, 0.455, 0.05, 0.35, 0.02, 1)
      P.add(dark, new CylinderGeometry(0.05, 0.05, 0.5, 8), [0.6, 1.3, -0.25])
      P.add(dark, new CylinderGeometry(0.09, 0.09, 0.06, 10), [-0.5, 1.12, -0.2])
      P.box(dark, 0, 1.12, 0, 1.7, 0.04, 0.04, 1)
    })
    return P.build()
  })
  return <Merged parts={parts} />
}

export function Logs({ p, rotY }) {
  const parts = useParts(keyOf('logs', p), () => {
    const P = new Pieces()
    const bark = pw.palmBark()
    framed(P, p, rotY, () => {
      const rows = [[4, 0.17], [3, 0.47], [2, 0.76]]
      rows.forEach(([n, y], r) => {
        for (let i = 0; i < n; i++) {
          const z = (i - (n - 1) / 2) * 0.32
          P.add(bark, trunk(0.16, 0.16, 2.5 + ((i + r) % 2) * 0.12, 8, 1), [((i + r) % 3) * 0.04, y, z], [0, 0, Math.PI / 2])
        }
      })
    })
    return P.build()
  })
  return <Merged parts={parts} />
}

export function Pallets({ p, rotY }) {
  const parts = useParts(keyOf('pallets', p), () => {
    const P = new Pieces()
    framed(P, p, rotY, () => {
      for (let i = 0; i < 5; i++) P.withFrame([((i * 7) % 3) * 0.03 - 0.03, i * 0.15, 0], ((i * 5) % 3) * 0.04 - 0.04, () => addPallet(P))
    })
    return P.build()
  })
  return <Merged parts={parts} />
}

export function Boom({ p, rotY, length }) {
  const parts = useParts(keyOf('boom', p), () => {
    const P = new Pieces()
    framed(P, p, rotY, () => {
      P.add(pw.hazard(), new CylinderGeometry(0.12, 0.14, 1.1, 10), [0, 0.55, 0])
      P.box(pw.paint('#2a2c2a', 0.6), 0, 1.0, 0, 0.3, 0.2, 0.3, 1)
      P.box(pw.hazard(), length / 2, 0.95, 0, length, 0.1, 0.1, 0.8)
      P.box(pw.concrete(), -0.45, 0.95, 0, 0.5, 0.28, 0.24, 1)
    })
    return P.build()
  })
  return <Merged parts={parts} />
}

export function Campfire({ p }) {
  const parts = useParts(keyOf('campfire', p), () => {
    const P = new Pieces()
    const stone = pw.paint('#7d776d', 0.9)
    const stoneGeo = new DodecahedronGeometry(0.16, 0)
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2
      P.add(stone, stoneGeo, [p[0] + Math.cos(a) * 0.55, 0.08, p[2] + Math.sin(a) * 0.55], [i, i * 2, 0], [1, 0.7, 1])
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.3
      P.add(pw.paint('#2a201a', 0.9), trunk(0.06, 0.07, 0.8, 6, 1), [p[0] + Math.cos(a) * 0.15, 0.12, p[2] + Math.sin(a) * 0.15], [0, -a, Math.PI / 2 - 0.25])
    }
    P.add(pw.ember(), new SphereGeometry(0.3, 8, 4), [p[0], 0.02, p[2]], null, [1, 0.25, 1])
    // A pot on a tripod over it.
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      P.box(timber(), p[0] + Math.cos(a) * 0.35, 0.6, p[2] + Math.sin(a) * 0.35, 0.04, 1.3, 0.04, 1, [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3])
    }
    P.add(pw.paint('#3a3a3a', 0.4, 0.6), new CylinderGeometry(0.2, 0.16, 0.26, 12), [p[0], 0.62, p[2]])
    return P.build()
  })
  return <Merged parts={parts} />
}

export function Washline({ a, b }) {
  const parts = useParts(keyOf('washline', [a[0], 0, a[1]], `${b[0]}:${b[1]}`), () => {
    const P = new Pieces()
    const { len, yaw, mid } = along(a, b)
    const rand = seededRandom(Math.round(a[0] * 11 + a[1] * 3))
    const clothes = ['#e8c23a', '#d8443a', '#3a7ad8', '#f2f0ea', '#5aa85a', '#e88aa8']
    framed(P, mid, yaw, () => {
      for (const x of [-len / 2, len / 2]) P.box(timber(), x, 1.0, 0, 0.07, 2.0, 0.07, 1)
      // The line sags: three straight runs.
      const sag = [1.92, 1.78, 1.78, 1.92]
      for (let i = 0; i < 3; i++) {
        const x0 = -len / 2 + (len * i) / 3
        const x1 = -len / 2 + (len * (i + 1)) / 3
        const r = rampBox([x0, sag[i], 0], [x1, sag[i + 1], 0], 0.012, 0.012)
        P.add(pw.paint('#d8d4ca', 0.6), boxGeo(...r.size, 1), r.p, new Quaternion(...r.q))
      }
      for (let x = -len / 2 + 0.5; x < len / 2 - 0.4; x += 0.55 + rand() * 0.3) {
        const w = 0.35 + rand() * 0.3
        const h = 0.45 + rand() * 0.35
        const y = 1.8 - h / 2 - 0.02
        P.add(pw.tarp(clothes[Math.floor(rand() * clothes.length)]), new PlaneGeometry(w, h), [x, y, 0], [0, rand() * 0.2, 0])
      }
    })
    return P.build()
  })
  return <Merged parts={parts} />
}

export function LeanTo({ x0, x1, z0, z1, high, low }) {
  const parts = useParts('pw:leanTo', () => {
    const P = new Pieces()
    for (const x of [x0 + 0.08, x1 - 0.08]) P.box(timber(), x, low / 2, z1 - 0.08, 0.12, low, 0.12, 1)
    P.box(timber(), (x0 + x1) / 2, low - 0.05, z1 - 0.08, x1 - x0, 0.1, 0.1, 1)
    const cx = (x0 + x1) / 2
    const r = rampBox([cx, high, z0], [cx, low + 0.02, z1 + 0.3], x1 - x0 + 0.4, 0.02)
    P.add(pw.camo(), boxGeo(r.size[0], 0.005, r.size[2], 2), r.p, new Quaternion(...r.q))
    return P.build()
  })
  return <Merged parts={parts} />
}

/* ---------------------------------------------------------------------------
 * Plants
 * ------------------------------------------------------------------------- */

export function Banana({ p, s }) {
  const parts = useParts(keyOf('banana', p, s), () => {
    const P = new Pieces()
    addBanana(P, p, s, Math.round(p[0] * 31 + p[2] * 17))
    return P.build()
  })
  return <Merged parts={parts} />
}

export function Palm({ p, h, lean }) {
  const parts = useParts(keyOf('palm', p, `${h}:${lean}`), () => {
    const P = new Pieces()
    addPalm(P, p, h, lean, Math.round(p[0] * 13 + p[2] * 29))
    return P.build()
  })
  return <Merged parts={parts} />
}

export function Bush({ p, s }) {
  const parts = useParts(keyOf('bush', p, s), () => {
    const P = new Pieces()
    addBush(P, p, s, Math.round(p[0] * 7 + p[2] * 41))
    return P.build()
  })
  return <Merged parts={parts} shadow={false} />
}

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

/** Distance from (x, z) to a polyline of [x, z]. */
function distToPath(points, x, z, closed) {
  let best = Infinity
  const n = points.length
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = points[i]
    const b = points[(i + 1) % n]
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)))
    best = Math.min(best, Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t))
  }
  return best
}

/** Grass tufts scattered over open ground: not on the tracks, not in anything solid. */
export function Tufts({ seed }) {
  const parts = useParts(`pw:tufts:${seed}`, () => {
    const P = new Pieces()
    const rand = seededRandom(seed)
    const colliders = buildPalmwoodColliders().filter((c) => !(c.shape === 'box' && (c.half[0] > 30 || c.half[2] > 30)))
    const loop = loopPath(2)
    const H = PALMWOOD_HALF - 0.6
    let placed = 0
    for (let tries = 0; tries < 2400 && placed < 320; tries++) {
      const x = (rand() * 2 - 1) * H
      const z = (rand() * 2 - 1) * H
      if (distToPath(loop, x, z, true) < LOOP.width / 2 + 0.2) continue
      if (TRACKS.some((t) => distToPath(t.points, x, z, false) < t.width / 2 + 0.1)) continue
      if (blocked(colliders, x, z, 0.35)) continue
      // Not indoors, nor on the deck.
      if (BUILDINGS.some((b) => x > b.x0 - 0.3 && x < b.x1 + 0.3 && z > b.z0 - 0.3 && z < b.z1 + 0.3)) continue
      if (x > DECK.x0 - 0.3 && x < DECK.x1 + 0.3 && z > DECK.z0 - 0.3 && z < DECK.z1 + 0.3) continue
      addTuft(P, [x, 0, z], 0.7 + rand() * 0.6, rand() * Math.PI)
      placed++
    }
    return P.build()
  })
  return <Merged parts={parts} shadow={false} />
}

/* ---------------------------------------------------------------------------
 * Inside the buildings
 * ------------------------------------------------------------------------- */

function addFurniture(P, f) {
  const [w, h, d] = f.size
  const wood = pw.wood('#a88058')
  switch (f.kind) {
    case 'table':
      P.box(wood, 0, h - 0.03, 0, w, 0.06, d, 1)
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(wood, sx * (w / 2 - 0.06), (h - 0.06) / 2, sz * (d / 2 - 0.06), 0.06, h - 0.06, 0.06, 1)
      P.add(pw.paint('#d8d0c0', 0.6), new CylinderGeometry(0.05, 0.04, 0.1, 8), [w * 0.2, h + 0.05, 0])
      break
    case 'crates': {
      addCrate(P, w, h * 0.55, d, 0)
      P.withFrame([0.05, 0, -0.04], 0.3, () => addCrate(P, w * 0.7, h * 0.45, d * 0.7, h * 0.55, '#b89060'))
      break
    }
    case 'shelf': {
      const frame = pw.wood('#8a6a48')
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(frame, sx * (w / 2 - 0.03), h / 2, sz * (d / 2 - 0.03), 0.05, h, 0.05, 1)
      const rand = seededRandom(Math.round(f.p[0] * 19 + f.p[2] * 7))
      for (const y of [0.3, 0.9, 1.5]) {
        P.box(wood, 0, y, 0, w, 0.04, d, 1)
        const n = 3
        for (let i = 0; i < n; i++) {
          const long = w > d
          const a = (i - 1) * (long ? w : d) * 0.28
          const tint = ['#c84a3a', '#3a7ac8', '#e8c23a', '#5aa85a'][Math.floor(rand() * 4)]
          P.box(pw.paint(tint, 0.6), long ? a : 0, y + 0.13, long ? 0 : a, 0.18, 0.22, 0.14, 1)
        }
      }
      break
    }
    case 'sheets':
      P.box(pw.plywood(), 0, h / 2, 0, w, h, d, 2.44)
      break
    case 'bucket':
      P.add(pw.paint('#3a7ac8', 0.6), new CylinderGeometry(w / 2, w / 2.4, h, 12), [0, h / 2, 0])
      break
    case 'bunk': {
      const frame = pw.wood('#8a6a48')
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(frame, sx * (w / 2 - 0.04), h / 2, sz * (d / 2 - 0.04), 0.06, h, 0.06, 1)
      for (const y of [0.35, 1.25]) {
        P.box(frame, 0, y, 0, w, 0.05, d, 1)
        P.box(pw.tarp('#d8d0b8'), 0, y + 0.08, 0, w - 0.1, 0.11, d - 0.1, 2)
      }
      break
    }
    case 'stove':
      P.box(pw.paint('#9a5a3e', 0.9), 0, h / 2, 0, w, h, d, 1)
      P.add(pw.paint('#2a2a2a', 0.4, 0.6), new CylinderGeometry(0.18, 0.15, 0.22, 12), [0, h + 0.11, -d * 0.2])
      P.add(pw.paint('#2a2a2a', 0.4, 0.6), new CylinderGeometry(0.14, 0.12, 0.18, 12), [0, h + 0.09, d * 0.25])
      break
    case 'fruit': {
      addCrate(P, w, h * 0.7, d, 0, '#b89060')
      const rand = seededRandom(Math.round(f.p[0] * 23))
      for (let i = 0; i < 9; i++) {
        const x = (rand() - 0.5) * (w - 0.3)
        const z = (rand() - 0.5) * (d - 0.25)
        const banana = rand() < 0.6
        P.add(pw.paint(banana ? '#e8c83a' : '#6a4a2a', 0.6), new SphereGeometry(banana ? 0.1 : 0.12, 8, 5), [x, h * 0.7 + 0.08, z], null, banana ? [1.8, 0.7, 0.7] : null)
      }
      break
    }
    default:
      P.box(wood, 0, h / 2, 0, w, h, d, 1)
  }
}

export function Furniture() {
  const parts = useParts('pw:furniture', () => {
    const P = new Pieces()
    for (const f of PW_FURNITURE) P.withFrame(f.p, f.rotY, () => addFurniture(P, f))
    return P.build()
  })
  return <Merged parts={parts} />
}
