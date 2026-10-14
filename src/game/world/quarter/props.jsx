import { useMemo } from 'react'
import { BufferGeometry, ConeGeometry, CylinderGeometry, Float32BufferAttribute, LatheGeometry, SphereGeometry, TorusGeometry, Vector2 } from 'three'

import { BLOCK_STACK, BLOCKS, buildQuarterColliders, BULLDOZER, CABLES, QUARTER_FURNITURE, QUARTER_HALF, SHACKS, STREETS } from '../../../shared/mapQuarter.js'
import { rotate3, seededRandom } from '../../../shared/math.js'
import { Merged } from '../acres/merge.jsx'
import { once, Pieces } from '../acres/pieces.js'
import { addBar, tuftGeometry } from './kit.js'
import { oq } from './materials.js'
import { DRY_UV } from './textures.js'

/**
 * Old Quarter's props: the building site (bulldozer, cement mixer, sand and
 * gravel, pallets of blocks, rebar, timber, site toilets, the Skeleton's stud
 * frames and scaffolding), plastered yard walls, the courtyard fountain, dead
 * scrub, dry grass and the cables slung across the streets. Each is merged
 * into a few meshes and cached; the static batcher merges them all by material.
 */

function useParts(key, build) {
  return useMemo(() => once(key, build), [key]) // eslint-disable-line react-hooks/exhaustive-deps
}
const keyOf = (kind, p, extra = '') => `oq:${kind}:${p[0].toFixed(2)}:${p[1].toFixed(2)}:${p[2].toFixed(2)}:${extra}`

/** Builds in a local frame at `p` turned `rotY`. */
function local(P, p, rotY, fn) {
  P.withFrame(p, rotY, fn)
}

/* ---------------------------------------------------------------------------
 * The building site
 * ------------------------------------------------------------------------- */

export function Bulldozer({ p, rotY }) {
  const parts = useParts(keyOf('bulldozer', p, rotY), () => {
    const P = new Pieces()
    const d = BULLDOZER
    const yellow = oq.paint('#d9a521', 0.6)
    const dark = oq.paint('#2a2826', 0.6, 0.5)
    const steel = oq.paint('#5a5a56', 0.5, 0.7)
    const rust = oq.paint('#6e4630', 0.9)
    local(P, p, rotY, () => {
      // Tracks: a long box with rounded ends, the drive sprocket and idler.
      for (const s of [-1, 1]) {
        const x = s * (d.width / 2 - d.track / 2)
        P.box(dark, x, 0.42, 0.2, d.track, 0.62, d.length - 1.4, 1)
        for (const z of [-(d.length / 2 - 0.9), d.length / 2 - 0.5]) P.add(dark, new CylinderGeometry(0.42, 0.42, d.track, 14), [x, 0.42, z], [0, 0, Math.PI / 2])
        for (let k = 0; k < 5; k++) P.add(steel, new CylinderGeometry(0.14, 0.14, d.track + 0.04, 10), [x, 0.18, -1.4 + k * 0.75], [0, 0, Math.PI / 2])
      }
      // Body: engine hood forward, the cab behind it.
      P.box(yellow, 0, 1.2, 0.3, d.width - 1.25, 0.8, d.length - 1.4, 1)
      P.box(yellow, 0, 1.45, -0.7, 1.3, 0.5, 2.2, 1)
      P.box(dark, 0, 1.46, -1.81, 1.1, 0.4, 0.04, 1)
      P.add(dark, new CylinderGeometry(0.07, 0.07, 0.9, 10), [0.35, 2.1, -1.0])
      // Cab: posts, roof, glass-less frames.
      const cab = [0, d.body, 0.9]
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(yellow, cab[0] + sx * 0.7, (d.body + d.cab) / 2, cab[2] + sz * 0.7, 0.08, d.cab - d.body, 0.08, 1)
      P.box(yellow, cab[0], d.cab, cab[2], 1.6, 0.08, 1.6, 1)
      P.box(dark, cab[0], d.body + 0.45, cab[2] + 0.3, 0.6, 0.5, 0.6, 1)
      // Blade on push arms, chipped.
      P.box(yellow, 0, 0.62, -d.length / 2 - 0.25, d.width + 0.5, 1.1, 0.12, 1)
      P.box(rust, 0, 0.12, -d.length / 2 - 0.32, d.width + 0.5, 0.12, 0.08, 1)
      for (const s of [-1, 1]) addBar(P, yellow, [s * (d.width / 2 - 0.2), 0.75, -d.length / 2 - 0.15], [s * (d.width / 2 - 0.2), 0.8, -0.6], 0.14, 0.18)
      // Ripper at the back.
      P.box(steel, 0, 0.6, d.length / 2 + 0.05, 1.0, 0.18, 0.2, 1)
      P.box(steel, 0, 0.3, d.length / 2 + 0.3, 0.12, 0.7, 0.12, 1)
    })
    return P.build()
  })
  return <Merged parts={parts} />
}

export function Mixer({ p, rotY }) {
  const parts = useParts(keyOf('mixer', p, rotY), () => {
    const P = new Pieces()
    const orange = oq.paint('#c8582a', 0.6)
    const steel = oq.paint('#5a5a56', 0.5, 0.7)
    local(P, p, rotY, () => {
      P.box(steel, 0, 0.5, 0, 0.9, 0.12, 1.8, 1)
      for (const z of [-0.6, 0.6]) P.add(oq.rubber(), new TorusGeometry(0.24, 0.09, 8, 14), [0.5, 0.3, z], [0, Math.PI / 2, 0])
      P.box(steel, -0.3, 0.25, 0.8, 0.06, 0.5, 0.06, 1)
      const drum = new LatheGeometry([new Vector2(0.18, 0), new Vector2(0.48, 0.25), new Vector2(0.6, 0.6), new Vector2(0.52, 0.95), new Vector2(0.3, 1.15)], 16)
      P.add(orange, drum, [0, 0.75, -0.1], [0.9, 0, 0])
      P.box(steel, 0, 1.0, 0.55, 0.12, 0.9, 0.12, 1)
    })
    return P.build()
  })
  return <Merged parts={parts} />
}

/** A heap of sand or gravel: a lumpy, flattened cone. */
export function Pile({ p, r, h, kind }) {
  const parts = useParts(keyOf('pile', p, `${r}:${h}:${kind}`), () => {
    const P = new Pieces()
    const g = new ConeGeometry(r, h, 18, 3)
    const pos = g.getAttribute('position')
    const rand = seededRandom(Math.round(p[0] * 13 + p[2] * 7))
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i)
      if (y > h / 2 - 0.01 || y < -h / 2 + 0.01) continue
      const k = 0.9 + rand() * 0.2
      pos.setXYZ(i, pos.getX(i) * k, y, pos.getZ(i) * k)
    }
    g.computeVertexNormals()
    const m = kind === 'gravel' ? oq.concrete('#9a958a') : oq.dust()
    P.add(m, g, [p[0], h / 2 - 0.02, p[2]], null, [1, 1, 1])
    return P.build()
  })
  return <Merged parts={parts} />
}

/** A pallet of concrete blocks, strapped. */
export function BlockStack({ p, rotY }) {
  const parts = useParts(keyOf('blocks', p, rotY), () => {
    const P = new Pieces()
    const s = BLOCK_STACK
    local(P, p, rotY, () => {
      P.box(oq.wood('#9a7a52'), 0, 0.07, 0, s.w, 0.14, s.d, 1)
      P.box(oq.block(), 0, 0.14 + (s.h - 0.14) / 2, 0, s.w - 0.04, s.h - 0.14, s.d - 0.04, 1.2)
      for (const x of [-s.w / 4, s.w / 4]) P.box(oq.paint('#2a5a8a', 0.6), x, s.h / 2 + 0.07, 0, 0.03, s.h - 0.1, s.d + 0.01, 1)
    })
    return P.build()
  })
  return <Merged parts={parts} />
}

export function Rebar({ p, rotY, length }) {
  const parts = useParts(keyOf('rebar', p, length), () => {
    const P = new Pieces()
    const rust = oq.paint('#7a4a32', 0.9)
    const rand = seededRandom(Math.round(p[0] * 17 + p[2] * 3))
    local(P, p, rotY, () => {
      for (const x of [-length / 2 + 0.4, 0, length / 2 - 0.4]) P.box(oq.wood('#8a6a48'), x, 0.06, 0, 0.12, 0.12, 0.8, 1)
      for (let i = 0; i < 14; i++) {
        const z = -0.3 + (i % 7) * 0.1
        const y = 0.14 + Math.floor(i / 7) * 0.05
        const bend = rand() < 0.3 ? 0.25 : 0
        addBar(P, rust, [-length / 2, y, z], [length / 2, y + bend * 0.2, z + bend], 0.02, 0.02)
      }
    })
    return P.build()
  })
  return <Merged parts={parts} />
}

export function Timber({ p, rotY }) {
  const parts = useParts(keyOf('timber', p, rotY), () => {
    const P = new Pieces()
    local(P, p, rotY, () => {
      for (const x of [-1.6, 0, 1.6]) P.box(oq.wood('#8a6a48'), x, 0.05, 0, 0.1, 0.1, 1.2, 1)
      const rand = seededRandom(Math.round(p[0] * 11 + p[2] * 5))
      for (let layer = 0; layer < 4; layer++) {
        for (let k = 0; k < 6; k++) {
          const z = -0.5 + k * 0.2
          P.box(oq.wood(rand() < 0.5 ? '#c8a272' : '#b8915f'), (rand() - 0.5) * 0.3, 0.15 + layer * 0.11, z, 4.0, 0.09, 0.18, 1)
        }
      }
    })
    return P.build()
  })
  return <Merged parts={parts} />
}

export function Toilet({ p, rotY }) {
  const parts = useParts(keyOf('toilet', p, rotY), () => {
    const P = new Pieces()
    local(P, p, rotY, () => {
      P.box(oq.paint('#3a6ea8', 0.55), 0, 1.1, 0, 1.1, 2.2, 1.1, 1)
      P.box(oq.paint('#e8e4da', 0.55), 0, 2.26, 0, 1.16, 0.12, 1.16, 1)
      P.box(oq.paint('#2f5a8a', 0.55), 0, 1.05, -0.56, 0.8, 1.9, 0.03, 1)
      P.box(oq.paint('#e8e4da', 0.55), 0, 1.85, -0.58, 0.3, 0.06, 0.02, 1)
    })
    return P.build()
  })
  return <Merged parts={parts} />
}

/** Timber stud frames on the Skeleton's top: sole and head plates, studs every 0.4 m, a brace. */
export function Studs({ a, b, y, h }) {
  const parts = useParts(keyOf('studs', [a[0], y, a[1]], `${b[0]}:${b[1]}`), () => {
    const P = new Pieces()
    const wood = oq.wood('#c9a678')
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const ux = (b[0] - a[0]) / len
    const uz = (b[1] - a[1]) / len
    const at = (d, yy) => [a[0] + ux * d, yy, a[1] + uz * d]
    for (const yy of [y + 0.025, y + h - 0.025]) addBar(P, wood, at(0, yy), at(len, yy), 0.1, 0.05)
    for (let d = 0.05; d <= len - 0.04; d += 0.4) {
      const p = at(d, y + h / 2)
      P.box(wood, p[0], p[1], p[2], 0.05, h - 0.1, 0.05, 1)
    }
    addBar(P, wood, at(0.1, y + 0.1), at(Math.min(len, 2.4), y + h - 0.1), 0.05, 0.05)
    return P.build()
  })
  return <Merged parts={parts} />
}

/** Tube scaffolding up the Skeleton's south face: standards, ledgers, braces and plank decks. */
export function Scaffold({ x0, x1, z0, z1, decks }) {
  const parts = useParts(`oq:scaffold:${x0}:${z0}`, () => {
    const P = new Pieces()
    const tube = oq.paint('#9a9a94', 0.5, 0.7)
    const plank = oq.wood('#b8915f')
    const n = 4
    const xs = Array.from({ length: n + 1 }, (_, i) => x0 + ((x1 - x0) * i) / n)
    for (const x of xs) for (const z of [z0, z1]) P.add(tube, new CylinderGeometry(0.03, 0.03, 7.2, 6), [x, 3.6, z])
    for (const y of [1.0, ...decks.map((d) => d + 1.0), 6.6 + 1.0]) {
      for (const z of [z0, z1]) addBar(P, tube, [x0, y, z], [x1, y, z], 0.05, 0.05)
    }
    for (const d of decks) {
      for (const z of [z0, z1]) addBar(P, tube, [x0, d, z], [x1, d, z], 0.05, 0.05)
      for (const x of xs) addBar(P, tube, [x, d, z0], [x, d, z1], 0.05, 0.05)
      for (let k = 0; k < 4; k++) P.box(plank, (x0 + x1) / 2, d + 0.04, z0 + 0.14 + k * ((z1 - z0 - 0.28) / 3), x1 - x0 + 0.2, 0.04, 0.24, 1)
    }
    // A brace across each bay of the outer face.
    for (let i = 0; i < n; i++) addBar(P, tube, [xs[i], 0.2, z1], [xs[i + 1], decks[0], z1], 0.05, 0.05)
    return P.build()
  })
  return <Merged parts={parts} />
}

/* ---------------------------------------------------------------------------
 * Walls, the fountain
 * ------------------------------------------------------------------------- */

/** A plastered block wall with a concrete coping (and a base band). */
export function YardWall({ a, b, h }) {
  const parts = useParts(keyOf('yardWall', [a[0], 0, a[1]], `${b[0]}:${b[1]}:${h}`), () => {
    const P = new Pieces()
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const yaw = Math.atan2(-(b[1] - a[1]), b[0] - a[0])
    local(P, [(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2], yaw, () => {
      P.box(oq.stucco('#d9c9a8'), 0, h / 2, 0, len, h, 0.3, 2.5)
      P.box(oq.concrete('#dad3c4'), 0, h + 0.04, 0, len + 0.08, 0.08, 0.4, 1)
      P.box(oq.concrete('#cbc4b6'), 0, 0.2, 0, len + 0.04, 0.4, 0.34, 1.5)
    })
    return P.build()
  })
  return <Merged parts={parts} />
}

export function Fountain({ p }) {
  const parts = useParts(keyOf('fountain', p), () => {
    const P = new Pieces()
    const stone = oq.concrete('#d8cfbe')
    const basin = new LatheGeometry([new Vector2(1.2, 0.0), new Vector2(1.5, 0.0), new Vector2(1.5, 0.6), new Vector2(1.36, 0.6), new Vector2(1.36, 0.2), new Vector2(0.0, 0.2)], 28)
    P.add(stone, basin, [p[0], 0, p[2]])
    P.add(stone, new CylinderGeometry(0.18, 0.26, 1.2, 12), [p[0], 0.8, p[2]])
    P.add(stone, new CylinderGeometry(0.55, 0.3, 0.16, 16), [p[0], 1.4, p[2]])
    // Dry: a little sand and leaves in the bottom.
    P.add(oq.dust(), new CylinderGeometry(1.34, 1.34, 0.02, 24), [p[0], 0.22, p[2]])
    return P.build()
  })
  return <Merged parts={parts} />
}

/* ---------------------------------------------------------------------------
 * Dead scrub, dry grass, the cables
 * ------------------------------------------------------------------------- */

/** A leafless scrub tree: a crooked trunk and branching twigs, a few dry leaves. */
export function Scrub({ p, s }) {
  const parts = useParts(keyOf('scrub', p, s), () => {
    const P = new Pieces()
    const bark = oq.paint('#5e4e3e', 0.9)
    const rand = seededRandom(Math.round(p[0] * 23 + p[2] * 11))
    const grow = (from, dir, len, r, depth) => {
      const to = [from[0] + dir[0] * len, from[1] + dir[1] * len, from[2] + dir[2] * len]
      addBar(P, bark, from, to, r * 2, r * 2)
      if (depth === 0) {
        P.add(oq.dry(), tuftGeometry([to[0], to[1] - 0.15 * s, to[2]], 0.7 * s, 0.55 * s, rand() * 3, DRY_UV.twigs), [0, 0, 0])
        return
      }
      const n = 2 + (rand() < 0.4 ? 1 : 0)
      for (let i = 0; i < n; i++) {
        const a = rand() * Math.PI * 2
        const up = 0.5 + rand() * 0.5
        const d = [dir[0] * 0.5 + Math.cos(a) * 0.6, up, dir[2] * 0.5 + Math.sin(a) * 0.6]
        const l = Math.hypot(...d)
        grow(to, [d[0] / l, d[1] / l, d[2] / l], len * (0.6 + rand() * 0.2), r * 0.65, depth - 1)
      }
    }
    grow([p[0], 0, p[2]], [0.1, 1, 0.05], 1.3 * s, 0.09 * s, 3)
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

/** Dry grass in tufts: along the foot of the walls and in the yards, never on the streets or indoors. */
export function DryTufts({ seed }) {
  const parts = useParts(`oq:tufts:${seed}`, () => {
    const P = new Pieces()
    const rand = seededRandom(seed)
    const colliders = buildQuarterColliders().filter((c) => !(c.shape === 'box' && (c.half[0] > 30 || c.half[2] > 30)))
    const { main, alley, west, east } = STREETS
    const H = QUARTER_HALF - 0.5
    const inside = (x, z, r, m) => x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m
    let placed = 0
    for (let tries = 0; tries < 6000 && placed < 420; tries++) {
      const x = (rand() * 2 - 1) * H
      const z = (rand() * 2 - 1) * H
      if (z > main.z0 - 0.2 && z < main.z1 + 0.2) continue
      if (z > alley.z0 + 0.6 && z < alley.z1 - 0.6) continue
      if (x > west.x0 + 0.6 && x < west.x1 - 0.6) continue
      if (x > east.x0 + 0.6 && x < east.x1 - 0.6) continue
      if (BLOCKS.some((b) => inside(x, z, b, 0.2)) || SHACKS.some((b) => inside(x, z, b, 0.2))) continue
      if (blocked(colliders, x, z, 0.3)) continue
      // Thicker along walls: keep most of the open-ground ones away.
      const nearWall = blocked(colliders, x, z, 1.6)
      if (!nearWall && rand() < 0.7) continue
      const s = 0.7 + rand() * 0.7
      const tint = ['#ffffff', '#e8dcc0', '#f4ead2', '#d8ccae'][Math.floor(rand() * 4)]
      P.add(oq.dry(tint), tuftGeometry([x, 0, z], 0.75 * s, 0.6 * s, rand() * Math.PI, DRY_UV.grass), [0, 0, 0])
      placed++
    }
    return P.build()
  })
  return <Merged parts={parts} shadow={false} />
}

/** Sagging cables slung between the buildings and the poles, as one line set. */
export function Cables() {
  const geo = useMemo(() => {
    const pts = []
    for (const [ax, az, ay, bx, bz, by] of CABLES) {
      for (const off of [0, 0.25]) {
        let prev = null
        for (let k = 0; k <= 16; k++) {
          const t = k / 16
          const sag = Math.sin(t * Math.PI) * 0.7
          const pt = [ax + (bx - ax) * t + off * 0.3, ay + (by - ay) * t - sag - off, az + (bz - az) * t]
          if (prev) pts.push(...prev, ...pt)
          prev = pt
        }
      }
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pts, 3))
    return g
  }, [])
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#1c1916" />
    </lineSegments>
  )
}

/** Things in the rooms: low cover. */
export function Furniture({ list = QUARTER_FURNITURE }) {
  const parts = useParts(`oq:furniture`, () => {
    const P = new Pieces()
    const wood = oq.wood('#8a6a48')
    for (const f of list) {
      const [w, h, d] = f.size
      local(P, f.p, f.rotY, () => {
        switch (f.kind) {
          case 'table':
            P.box(wood, 0, h - 0.03, 0, w, 0.06, d, 1)
            for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(wood, sx * (w / 2 - 0.06), (h - 0.06) / 2, sz * (d / 2 - 0.06), 0.06, h - 0.06, 0.06, 1)
            break
          case 'counter':
            P.box(oq.stucco('#d8cdb4'), 0, h / 2, 0, w, h, d, 1.5)
            P.box(oq.wood('#6a4a30'), 0, h + 0.03, 0, w + 0.06, 0.06, d + 0.06, 1)
            break
          case 'sofa':
            P.box(oq.paint('#7a3a2e', 0.9), 0, 0.22, 0, w, 0.44, d, 1)
            P.box(oq.paint('#7a3a2e', 0.9), 0, 0.55, d / 2 - 0.12, w, 0.5, 0.24, 1)
            break
          case 'mattress':
            P.box(oq.paint('#c8b89a', 0.9), 0, h / 2, 0, w, h, d, 1)
            break
          case 'shelf': {
            for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(wood, sx * (w / 2 - 0.03), h / 2, sz * (d / 2 - 0.03), 0.05, h, 0.05, 1)
            for (const y of [0.3, 0.9, 1.5]) P.box(wood, 0, y, 0, w, 0.04, d, 1)
            break
          }
          case 'sacks':
            for (let i = 0; i < 4; i++) P.add(oq.paint('#c8b48a', 0.9), new SphereGeometry(0.32, 8, 6), [((i % 2) - 0.5) * 0.55, 0.25 + Math.floor(i / 2) * 0.35, 0], null, [1, 0.55, 0.8])
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
