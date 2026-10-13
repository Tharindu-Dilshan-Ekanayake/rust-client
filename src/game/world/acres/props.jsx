import { useMemo } from 'react'
import {
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three'

import { FURNITURE } from '../../../shared/mapAcres.js'
import { seededRandom } from '../../../shared/math.js'
import { acres, signs } from './materials.js'
import { Merged } from './merge.jsx'
import { once, Pieces } from './pieces.js'

/**
 * Street furniture, garden things and everything indoors, each built from a few
 * boxes and cylinders and merged per material. Sizes match their colliders in
 * shared/mapAcres.js where they have one.
 */

/** Runs a builder on fresh pieces and merges them. */
function built(build) {
  const P = new Pieces()
  build(P)
  return P.build()
}

/** Placed in a local frame: position + yaw. */
function At({ p, rotY = 0, children }) {
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      {children}
    </group>
  )
}

/** Along a line from a to b (x, z): yaw and length so local +x runs a -> b. */
const lineFrame = (a, b) => ({
  mid: [(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2],
  len: Math.hypot(b[0] - a[0], b[1] - a[1]),
  yaw: Math.atan2(-(b[1] - a[1]), b[0] - a[0]),
})

const cyl = (r, h, seg = 12) => new CylinderGeometry(r, r, h, seg)

/* ---------------------------------------------------------------------------
 * Fences and walls
 * ------------------------------------------------------------------------- */

export function PicketFence({ a, b }) {
  const f = lineFrame(a, b)
  const parts = useMemo(() => built(
    (P) => {
      const white = acres.picket()
      const n = Math.max(1, Math.round(f.len / 2.4))
      for (let i = 0; i <= n; i++) P.box(white, -f.len / 2 + (i * f.len) / n, 0.53, 0, 0.1, 1.06, 0.1, 1)
      for (const y of [0.28, 0.74]) P.box(white, 0, y, -0.04, f.len, 0.08, 0.035, 1)
      for (let x = -f.len / 2 + 0.07; x < f.len / 2; x += 0.15) {
        P.box(white, x, 0.47, 0.02, 0.085, 0.86, 0.02, 1)
        P.box(white, x, 0.93, 0.02, 0.06, 0.06, 0.02, 1, [0, 0, Math.PI / 4])
      }
    }),
    [f.len],
  )
  return (
    <At p={f.mid} rotY={f.yaw}>
      <Merged parts={parts} />
    </At>
  )
}

export function PrivacyFence({ a, b }) {
  const f = lineFrame(a, b)
  const parts = useMemo(() => built(
    (P) => {
      P.box(acres.fence(), 0, 0.98, 0, f.len, 1.92, 0.05, 1.12)
      const post = acres.wood('#6e5136')
      const n = Math.max(1, Math.round(f.len / 2.4))
      for (let i = 0; i <= n; i++) P.box(post, -f.len / 2 + (i * f.len) / n, 1.02, 0.06, 0.12, 2.04, 0.12, 1)
      P.box(post, 0, 1.97, 0, f.len + 0.1, 0.05, 0.12, 1)
      for (const y of [0.35, 1.55]) P.box(post, 0, y, 0.05, f.len, 0.1, 0.05, 1)
    }),
    [f.len],
  )
  return (
    <At p={f.mid} rotY={f.yaw}>
      <Merged parts={parts} />
    </At>
  )
}

export function StoneWall({ a, b, h }) {
  const f = lineFrame(a, b)
  const parts = useMemo(() => built(
    (P) => {
      P.box(acres.stone(), 0, h / 2, 0, f.len, h, 0.45, 1.4)
      P.box(acres.concrete(), 0, h + 0.04, 0, f.len + 0.06, 0.08, 0.52, 1)
    }),
    [f.len, h],
  )
  return (
    <At p={f.mid} rotY={f.yaw}>
      <Merged parts={parts} />
    </At>
  )
}

export function Pillar({ p }) {
  const parts = useMemo(() => built((P) => {
    P.box(acres.stone(), 0, 0.7, 0, 0.5, 1.4, 0.5, 1.4)
    P.box(acres.concrete(), 0, 1.45, 0, 0.6, 0.1, 0.6, 1)
    P.add(acres.concrete(), cyl(0.12, 0.1), [0, 1.55, 0])
    P.add(acres.lampGlass(), new SphereGeometry(0.2, 12, 9), [0, 1.78, 0])
  }), [])
  return (
    <At p={p}>
      <Merged parts={parts} />
    </At>
  )
}

export function Planter({ a, b }) {
  const f = lineFrame(a, b)
  const parts = useMemo(() => built(
    (P) => {
      P.box(acres.concrete(), 0, 0.32, 0, f.len, 0.65, 0.7, 1.5)
      P.box(acres.dirt(), 0, 0.64, 0, f.len - 0.12, 0.04, 0.58, 2)
      const rand = seededRandom(Math.round(f.len * 100))
      for (let x = -f.len / 2 + 0.4; x < f.len / 2 - 0.2; x += 0.55) {
        const s = 0.22 + rand() * 0.12
        P.add(acres.leaves(), new IcosahedronGeometry(1, 0), [x, 0.7 + s * 0.5, (rand() - 0.5) * 0.2], [rand(), rand(), 0], [s, s * 0.8, s])
      }
    }),
    [f.len],
  )
  return (
    <At p={f.mid} rotY={f.yaw}>
      <Merged parts={parts} />
    </At>
  )
}

export function Hedge({ p, length, rotY }) {
  const parts = useMemo(() => built(
    (P) => {
      const leaves = acres.leaves()
      P.box(leaves, 0, 0.62, 0, length, 1.24, 0.95, 1.2)
      P.box(leaves, 0, 1.3, 0, length - 0.12, 0.3, 0.8, 1.2)
      const rand = seededRandom(Math.round(length * 37 + p[0] * 3))
      for (let x = -length / 2 + 0.3; x < length / 2 - 0.2; x += 0.6) {
        P.add(leaves, new IcosahedronGeometry(1, 0), [x, 1.3 + rand() * 0.08, (rand() - 0.5) * 0.3], [rand(), rand(), rand()], [0.36, 0.22, 0.42])
      }
    }),
    [length, p],
  )
  return (
    <At p={p} rotY={rotY}>
      <Merged parts={parts} />
    </At>
  )
}

/** Shade tree: trunk, a couple of limbs, and a crown of leafy clumps. */
export function Tree({ p, s }) {
  const parts = useMemo(() => built(
    (P) => {
      const rand = seededRandom(Math.round(p[0] * 13 + p[2] * 7 + 500))
      const bark = acres.bark()
      P.add(bark, new CylinderGeometry(0.17 * s, 0.26 * s, 3.2 * s, 9), [0, 1.6 * s, 0])
      for (let k = 0; k < 3; k++) {
        const a = rand() * Math.PI * 2
        P.add(bark, new CylinderGeometry(0.06 * s, 0.11 * s, 1.6 * s, 6), [Math.cos(a) * 0.45 * s, 3.3 * s, Math.sin(a) * 0.45 * s], [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6])
      }
      const leaves = acres.leaves()
      const clumps = 7
      for (let k = 0; k < clumps; k++) {
        const a = (k / clumps) * Math.PI * 2 + rand()
        const r = k === 0 ? 0 : (1.0 + rand() * 0.6) * s
        const size = (k === 0 ? 1.9 : 1.2 + rand() * 0.5) * s
        P.add(leaves, new IcosahedronGeometry(1, 1), [Math.cos(a) * r, (4.3 + rand() * 0.9 - (k === 0 ? -0.3 : 0)) * s, Math.sin(a) * r], [rand(), rand(), 0], [size, size * 0.8, size])
      }
    }),
    [s, p],
  )
  return (
    <At p={p}>
      <Merged parts={parts} />
    </At>
  )
}

/* ---------------------------------------------------------------------------
 * Street furniture
 * ------------------------------------------------------------------------- */

export function GlobeLamp({ p }) {
  const parts = useMemo(() => built((P) => {
    const black = acres.paint('#1d1e20', 0.5, 0.4)
    P.add(black, new CylinderGeometry(0.16, 0.2, 0.5, 10), [0, 0.25, 0])
    P.add(black, new CylinderGeometry(0.06, 0.08, 3.3, 10), [0, 1.9, 0])
    P.add(black, new CylinderGeometry(0.14, 0.08, 0.16, 10), [0, 3.58, 0])
    P.add(acres.lampGlass(), new SphereGeometry(0.26, 12, 9), [0, 3.86, 0])
    P.add(black, new CylinderGeometry(0.05, 0.08, 0.06, 10), [0, 4.12, 0])
  }), [])
  return (
    <At p={p}>
      <Merged parts={parts} />
    </At>
  )
}

export function StreetSign({ p, rotY, names }) {
  const parts = useMemo(() => built(
    (P) => {
      const post = acres.paint('#2f3a33', 0.6, 0.3)
      P.add(post, cyl(0.045, 3.0, 8), [0, 1.5, 0])
      names.forEach((name, i) => {
        const y = 2.62 + i * 0.26
        const yaw = i * (Math.PI / 2)
        const g = new PlaneGeometry(1.15, 0.22)
        P.add(signs.blade(name), g, [Math.sin(yaw) * 0.03, y, Math.cos(yaw) * 0.03], [0, yaw, 0])
        P.add(signs.blade(name), g, [-Math.sin(yaw) * 0.03, y, -Math.cos(yaw) * 0.03], [0, yaw + Math.PI, 0])
      })
      P.add(post, cyl(0.07, 0.08, 8), [0, 3.02, 0])
    }),
    [names],
  )
  return (
    <At p={p} rotY={rotY}>
      <Merged parts={parts} />
    </At>
  )
}

/** The town sign on its stone base, readable from both sides. */
export function WelcomeSign({ p, rotY }) {
  const parts = useMemo(() => built((P) => {
    P.box(acres.stone(), 0, 0.5, 0, 6.4, 1.0, 1.3, 1.4)
    P.box(acres.concrete(), 0, 1.04, 0, 6.6, 0.08, 1.4, 1)
    const frame = acres.paint('#2f7f77', 0.55)
    P.box(frame, 0, 2.4, 0, 6.0, 2.8, 0.3, 1)
    for (const s of [-1, 1]) {
      P.add(signs.welcome(), new PlaneGeometry(5.7, 2.5), [0, 2.4, s * 0.175], [0, s > 0 ? 0 : Math.PI, 0])
      P.box(acres.trim('white'), s * 3.05, 2.4, 0, 0.12, 2.9, 0.34, 1)
    }
    P.box(acres.trim('white'), 0, 3.85, 0, 6.2, 0.12, 0.34, 1)
    // A little star on top.
    P.add(acres.paint('#e5a83a', 0.4), new IcosahedronGeometry(0.28, 0), [2.5, 4.15, 0])
    // Flower bed in front of the base.
    const rand = seededRandom(77)
    for (let k = 0; k < 14; k++) {
      P.add(acres.paint(['#d6455a', '#f0c23e', '#f4f1e8', '#b05ad6'][k % 4], 0.8), new IcosahedronGeometry(0.1, 0), [-2.8 + k * 0.42, 1.16, (rand() - 0.5) * 0.6])
    }
  }), [])
  return (
    <At p={p} rotY={rotY}>
      <Merged parts={parts} />
    </At>
  )
}

export function Mailbox({ p, rotY }) {
  const parts = useMemo(() => built((P) => {
    P.box(acres.wood('#6e5136'), 0, 0.55, 0, 0.1, 1.1, 0.1, 1)
    P.box(acres.paint('#d8d6cf', 0.4, 0.5), 0, 1.15, 0, 0.24, 0.24, 0.48, 1)
    P.add(acres.paint('#d8d6cf', 0.4, 0.5), new CylinderGeometry(0.12, 0.12, 0.48, 12, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(-Math.PI / 2), [0, 1.27, 0])
    P.box(acres.paint('#c42a20', 0.5), 0.13, 1.25, 0.08, 0.02, 0.24, 0.05, 1)
  }), [])
  return (
    <At p={p} rotY={rotY}>
      <Merged parts={parts} />
    </At>
  )
}

export function Hydrant({ p }) {
  const parts = useMemo(() => built((P) => {
    const red = acres.paint('#c23a28', 0.45, 0.2)
    P.add(red, new CylinderGeometry(0.15, 0.17, 0.62, 12), [0, 0.31, 0])
    P.add(red, new SphereGeometry(0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), [0, 0.62, 0])
    P.add(acres.paint('#d9d4c4', 0.5, 0.3), cyl(0.05, 0.12), [0, 0.78, 0])
    for (const a of [0, Math.PI / 2, Math.PI]) P.add(red, cyl(0.06, 0.16).rotateZ(Math.PI / 2), [Math.cos(a) * 0.14, 0.45, Math.sin(a) * 0.14], [0, -a, 0])
  }), [])
  return (
    <At p={p}>
      <Merged parts={parts} />
    </At>
  )
}

/** Concertina wire stretched along a line. */
export function Wire({ a, b }) {
  const f = lineFrame(a, b)
  const parts = useMemo(() => built(
    (P) => {
      const steel = acres.steel()
      const ring = new TorusGeometry(0.42, 0.012, 4, 18)
      for (let x = -f.len / 2; x <= f.len / 2; x += 0.2) P.add(steel, ring, [x, 0.42, 0], [0, Math.PI / 2, 0.3])
      for (let x = -f.len / 2; x <= f.len / 2 + 0.01; x += 3.0) P.box(acres.steelDark(), x, 0.5, 0, 0.05, 1.0, 0.05, 1)
    }),
    [f.len],
  )
  return (
    <At p={f.mid} rotY={f.yaw}>
      <Merged parts={parts} shadow={false} />
    </At>
  )
}

export function Sawhorse({ p, rotY }) {
  const parts = useMemo(() => built((P) => {
    const wood = acres.paint('#efece2', 0.7)
    for (const s of [-1, 1]) {
      for (const k of [-1, 1]) P.box(wood, s * 0.8, 0.48, k * 0.14, 0.06, 1.0, 0.06, 1, [k * 0.28, 0, 0])
    }
    P.box(signs.stripes(), 0, 0.8, 0, 1.8, 0.22, 0.05, 1)
    P.box(signs.stripes(), 0, 0.4, 0, 1.8, 0.18, 0.05, 1)
    P.add(signs.roadClosed(), new PlaneGeometry(1.2, 0.38), [0, 1.1, 0.035])
    P.add(signs.roadClosed(), new PlaneGeometry(1.2, 0.38), [0, 1.1, -0.035], [0, Math.PI, 0])
    P.box(wood, 0, 1.1, 0, 1.24, 0.42, 0.04, 1)
  }), [])
  return (
    <At p={p} rotY={rotY}>
      <Merged parts={parts} />
    </At>
  )
}

/* ---------------------------------------------------------------------------
 * Park and yards
 * ------------------------------------------------------------------------- */

export function PicnicTable({ p, rotY }) {
  const parts = useMemo(() => built((P) => {
    const wood = acres.wood('#8f6a45')
    P.box(wood, 0, 0.76, 0, 1.9, 0.06, 0.8, 1)
    for (const s of [-1, 1]) {
      P.box(wood, 0, 0.45, s * 0.66, 1.9, 0.05, 0.28, 1)
      for (const x of [-0.75, 0.75]) P.box(wood, x, 0.38, s * 0.3, 0.08, 0.84, 0.08, 1, [s * 0.5, 0, 0])
    }
  }), [])
  return (
    <At p={p} rotY={rotY}>
      <Merged parts={parts} />
    </At>
  )
}

export function SwingSet({ p, rotY }) {
  const parts = useMemo(() => built((P) => {
    const red = acres.paint('#b8372c', 0.5, 0.4)
    const chain = acres.steel()
    P.add(red, cyl(0.05, 3.4).rotateZ(Math.PI / 2), [0, 2.3, 0])
    for (const s of [-1, 1]) for (const k of [-1, 1]) P.add(red, cyl(0.045, 2.5), [s * 1.6, 1.18, k * 0.45], [k * 0.4, 0, 0])
    for (const x of [-0.7, 0.6]) {
      for (const k of [-0.18, 0.18]) P.box(chain, x + k, 1.6, 0, 0.015, 1.4, 0.015, 1)
      P.box(acres.paint('#1d1d1d', 0.8), x, 0.88, 0, 0.5, 0.04, 0.2, 1)
    }
  }), [])
  return (
    <At p={p} rotY={rotY}>
      <Merged parts={parts} />
    </At>
  )
}

export function Slide({ p, rotY }) {
  const parts = useMemo(() => built((P) => {
    const steel = acres.steel()
    const yellow = acres.paint('#e7b52f', 0.45, 0.3)
    for (const s of [-1, 1]) {
      P.box(steel, s * 0.3, 0.95, 0, 0.05, 1.9, 0.05, 1, [-0.2, 0, 0])
      P.box(steel, s * 0.3, 0.9, 0.4, 0.05, 1.8, 0.05, 1)
    }
    for (let y = 0.3; y < 1.7; y += 0.32) P.box(steel, 0, y, -0.08 + y * 0.2, 0.6, 0.04, 0.05, 1)
    P.box(steel, 0, 1.78, 0.35, 0.7, 0.05, 0.5, 1)
    P.box(yellow, 0, 1.0, 1.8, 0.55, 0.05, 2.7, 1, [0.62, 0, 0])
    for (const s of [-1, 1]) P.box(yellow, s * 0.29, 1.08, 1.8, 0.03, 0.14, 2.7, 1, [0.62, 0, 0])
  }), [])
  return (
    <At p={p} rotY={rotY}>
      <Merged parts={parts} />
    </At>
  )
}

/** Fallout shelter: a concrete entrance block with a steel hatch and its sign. */
export function Shelter({ p, rotY }) {
  const parts = useMemo(() => built((P) => {
    P.box(acres.concrete(), 0, 0.55, 0, 2.2, 1.1, 2.2, 1.5)
    P.box(acres.steelDark(), 0, 1.13, 0, 1.2, 0.06, 1.2, 1)
    P.box(acres.steel(), 0, 1.18, 0.3, 0.6, 0.06, 0.06, 1)
    P.add(acres.steelDark(), cyl(0.08, 0.5), [0.95, 1.35, -0.95])
    P.add(acres.steelDark(), cyl(0.04, 1.6), [-1.2, 0.8, 1.2])
    P.add(signs.shelter(), new PlaneGeometry(0.55, 0.55), [-1.2, 1.45, 1.23])
    P.add(signs.shelter(), new PlaneGeometry(0.55, 0.55), [-1.2, 1.45, 1.17], [0, Math.PI, 0])
  }), [])
  return (
    <At p={p} rotY={rotY}>
      <Merged parts={parts} />
    </At>
  )
}

export function Bench({ p, rotY }) {
  const parts = useMemo(() => built((P) => {
    for (const x of [-0.7, 0.7]) P.box(acres.concrete(), x, 0.22, 0, 0.12, 0.44, 0.5, 1)
    const wood = acres.wood('#7d5a3a')
    for (const z of [-0.16, 0, 0.16]) P.box(wood, 0, 0.47, z, 1.7, 0.05, 0.12, 1)
    for (const y of [0.65, 0.8]) P.box(wood, 0, y, 0.24, 1.7, 0.1, 0.04, 1)
  }), [])
  return (
    <At p={p} rotY={rotY}>
      <Merged parts={parts} />
    </At>
  )
}

export function Bbq({ p }) {
  const parts = useMemo(() => built((P) => {
    const black = acres.paint('#1d1d1f', 0.45, 0.4)
    P.add(black, new SphereGeometry(0.34, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), [0, 0.86, 0])
    P.add(black, new SphereGeometry(0.34, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), [0, 0.9, 0])
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2
      P.add(acres.steel(), cyl(0.02, 0.8), [Math.cos(a) * 0.22, 0.4, Math.sin(a) * 0.22], [Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25])
    }
  }), [])
  return (
    <At p={p}>
      <Merged parts={parts} />
    </At>
  )
}

export function Clothesline({ a, b }) {
  const f = lineFrame(a, b)
  const parts = useMemo(() => built(
    (P) => {
      const steel = acres.steel()
      for (const s of [-1, 1]) {
        P.add(steel, cyl(0.04, 2.0), [(s * f.len) / 2, 1.0, 0])
        P.box(steel, (s * f.len) / 2, 1.95, 0, 0.04, 0.04, 0.9, 1)
      }
      for (const z of [-0.35, 0, 0.35]) P.box(acres.paint('#d9d6cc', 0.6), 0, 1.93, z, f.len, 0.01, 0.01, 1)
      const colors = ['#f4f1e8', '#7fb3d6', '#e6c25a', '#d9705c', '#f4f1e8']
      colors.forEach((c, i) => P.add(acres.fabric(c), new PlaneGeometry(0.7, 0.9), [-f.len / 2 + 0.9 + i * 1.2, 1.48, i % 2 ? 0.35 : 0], [0, 0, (i % 2 ? 1 : -1) * 0.04]))
    }),
    [f.len],
  )
  return (
    <At p={f.mid} rotY={f.yaw}>
      <Merged parts={parts} />
    </At>
  )
}

export function PatioSet({ p }) {
  const parts = useMemo(() => built((P) => {
    const white = acres.paint('#f1efe8', 0.5, 0.2)
    P.add(white, cyl(0.6, 0.04, 20), [0, 0.74, 0])
    P.add(white, cyl(0.05, 0.72), [0, 0.37, 0])
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.4
      const x = Math.cos(a) * 0.95
      const z = Math.sin(a) * 0.95
      P.box(white, x, 0.45, z, 0.45, 0.04, 0.45, 1, [0, -a, 0])
      P.box(white, x + Math.cos(a) * 0.22, 0.7, z + Math.sin(a) * 0.22, 0.45, 0.5, 0.04, 1, [0, -a + Math.PI / 2, 0])
    }
    P.add(acres.steel(), cyl(0.025, 2.2), [0, 1.1, 0])
    P.add(acres.fabric('#c9553f'), new ConeGeometry(1.3, 0.45, 10, 1, true), [0, 2.25, 0])
  }), [])
  return (
    <At p={p}>
      <Merged parts={parts} />
    </At>
  )
}

export function Doghouse({ p, rotY }) {
  const parts = useMemo(() => built((P) => {
    P.box(acres.siding('barn'), 0, 0.42, 0, 1.2, 0.84, 1.1, 1.6)
    P.box(acres.roof('slate'), -0.32, 1.02, 0, 0.75, 0.06, 1.25, 1, [0, 0, 0.6])
    P.box(acres.roof('slate'), 0.32, 1.02, 0, 0.75, 0.06, 1.25, 1, [0, 0, -0.6])
    P.box(acres.paint('#151515', 0.9), 0, 0.35, 0.565, 0.45, 0.55, 0.01, 1)
  }), [])
  return (
    <At p={p} rotY={rotY}>
      <Merged parts={parts} />
    </At>
  )
}

export function TrashCans({ p, rotY }) {
  const parts = useMemo(() => built((P) => {
    const can = acres.paint('#9ea3a3', 0.45, 0.7)
    for (const s of [-0.35, 0.35]) {
      P.add(can, new CylinderGeometry(0.28, 0.25, 0.9, 14), [s, 0.45, 0])
      P.add(can, new CylinderGeometry(0.3, 0.3, 0.05, 14), [s, 0.92, 0])
      P.box(can, s, 0.98, 0, 0.12, 0.05, 0.04, 1)
    }
  }), [])
  return (
    <At p={p} rotY={rotY}>
      <Merged parts={parts} />
    </At>
  )
}

export function Lounger({ p, rotY }) {
  const parts = useMemo(() => built((P) => {
    const white = acres.paint('#f1efe8', 0.5, 0.2)
    P.box(white, 0, 0.32, 0.2, 0.62, 0.05, 1.4, 1)
    P.box(white, 0, 0.55, -0.62, 0.62, 0.05, 0.6, 1, [-0.8, 0, 0])
    P.box(acres.fabric('#3f8fb0'), 0, 0.37, 0.2, 0.56, 0.05, 1.3, 1)
    for (const x of [-0.28, 0.28]) for (const z of [-0.5, 0.8]) P.box(white, x, 0.15, z, 0.04, 0.3, 0.04, 1)
  }), [])
  return (
    <At p={p} rotY={rotY}>
      <Merged parts={parts} />
    </At>
  )
}

export function Umbrella({ p }) {
  const parts = useMemo(() => built((P) => {
    P.add(acres.concrete(), cyl(0.25, 0.12), [0, 0.06, 0])
    P.add(acres.steel(), cyl(0.03, 2.4), [0, 1.2, 0])
    for (let k = 0; k < 8; k++) {
      const wedge = new ConeGeometry(1.6, 0.5, 2, 1, true, (k * Math.PI) / 4, Math.PI / 4)
      P.add(acres.fabric(k % 2 ? '#d24a3a' : '#f4f1e8'), wedge, [0, 2.45, 0])
    }
  }), [])
  return (
    <At p={p}>
      <Merged parts={parts} />
    </At>
  )
}

export function DivingBoard({ p, rotY }) {
  const parts = useMemo(() => built((P) => {
    P.box(acres.concrete(), 0, 0.2, -0.8, 0.6, 0.4, 0.6, 1)
    P.box(acres.paint('#2f7f9a', 0.5), 0, 0.42, 0.4, 0.5, 0.06, 2.4, 1)
  }), [])
  return (
    <At p={p} rotY={rotY}>
      <Merged parts={parts} />
    </At>
  )
}

export function BoxPile({ p, rotY }) {
  const parts = useMemo(() => built((P) => {
    const c = acres.cardboard()
    P.box(c, -0.4, 0.25, -0.3, 0.8, 0.5, 0.6, 0.7)
    P.box(c, 0.4, 0.25, -0.3, 0.8, 0.5, 0.6, 0.7, [0, 0.05, 0])
    P.box(c, 0, 0.25, 0.3, 1.6, 0.5, 0.6, 0.7)
    P.box(c, 0, 0.75, 0, 1.5, 0.5, 1.1, 0.7, [0, -0.04, 0])
    P.box(c, 0, 1.35, 0, 0.8, 0.7, 0.8, 0.7, [0, 0.3, 0])
  }), [])
  return (
    <At p={p} rotY={rotY}>
      <Merged parts={parts} />
    </At>
  )
}

export function Tyres({ p }) {
  const parts = useMemo(() => built((P) => {
    const ring = new TorusGeometry(0.33, 0.14, 8, 18)
    for (let k = 0; k < 4; k++) P.add(acres.rubber(), ring, [k * 0.02, 0.14 + k * 0.26, 0], [Math.PI / 2, 0, 0.1 * k])
  }), [])
  return (
    <At p={p}>
      <Merged parts={parts} />
    </At>
  )
}

export function OilDrums({ p }) {
  const parts = useMemo(() => built((P) => {
    P.box(acres.wood('#7d6040'), 0, 0.06, 0, 1.4, 0.12, 1.4, 1)
    const colors = ['#2f5f8a', '#a8402c', '#3e6b3a', '#a8402c']
    ;[[-0.33, -0.33], [0.33, -0.33], [-0.33, 0.33], [0.33, 0.33]].forEach(([x, z], i) => {
      P.add(acres.paint(colors[i], 0.6, 0.4), new CylinderGeometry(0.29, 0.29, 0.86, 16), [x, 0.55, z])
    })
  }), [])
  return (
    <At p={p} rotY={0.2}>
      <Merged parts={parts} />
    </At>
  )
}

export function WoodPile({ p, rotY }) {
  const parts = useMemo(() => built((P) => {
    const log = new CylinderGeometry(0.14, 0.14, 2.3, 8).rotateZ(Math.PI / 2)
    const bark = acres.bark()
    for (let row = 0; row < 3; row++) {
      for (let k = 0; k < 3 - row; k++) P.add(bark, log, [0, 0.15 + row * 0.25, (k - (2 - row) / 2) * 0.3])
    }
  }), [])
  return (
    <At p={p} rotY={rotY}>
      <Merged parts={parts} />
    </At>
  )
}

/* ---------------------------------------------------------------------------
 * Mannequins: the town's silent residents
 * ------------------------------------------------------------------------- */

const POSES = {
  stand: { la: 0.08, ra: -0.08, lf: 0, rf: 0 },
  wave: { la: 0.1, ra: -2.6, lf: 0, rf: -0.6 },
  hips: { la: 0.7, ra: -0.7, lf: -1.53, rf: 1.53 },
  window: { la: 0.05, ra: -0.05, lf: 0, rf: 0 },
}

export function Mannequin({ p, rotY, pose }) {
  const parts = useMemo(() => built(
    (P) => {
      const pl = acres.mannequin()
      const q = POSES[pose] ?? POSES.stand
      const limb = (r0, r1, h) => new CylinderGeometry(r1, r0, h, 7)
      // Legs, hips, torso, shoulders, neck, head.
      for (const s of [-1, 1]) {
        P.add(pl, limb(0.075, 0.06, 0.82), [s * 0.1, 0.43, 0])
        P.add(pl, limb(0.06, 0.05, 0.12), [s * 0.1, 0.06, -0.04], [Math.PI / 2, 0, 0])
      }
      P.add(pl, new SphereGeometry(0.17, 9, 6), [0, 0.92, 0], null, [1.05, 0.8, 0.75])
      P.add(pl, limb(0.15, 0.19, 0.5), [0, 1.18, 0], null, [1, 1, 0.7])
      P.add(pl, new SphereGeometry(0.2, 9, 6), [0, 1.43, 0], null, [1.05, 0.55, 0.65])
      P.add(pl, limb(0.05, 0.045, 0.14), [0, 1.56, 0])
      P.add(pl, new SphereGeometry(0.11, 10, 8), [0, 1.72, 0], null, [0.9, 1.12, 0.95])
      // Arms from the shoulders: upper arm, forearm.
      for (const [s, a, f] of [[-1, q.la, q.lf], [1, q.ra, q.rf]]) {
        const sh = [s * 0.22, 1.43, 0]
        const up = 0.32
        const elbow = [sh[0] - Math.sin(a) * up, sh[1] - Math.cos(a) * up, 0]
        P.add(pl, limb(0.05, 0.045, up), [(sh[0] + elbow[0]) / 2, (sh[1] + elbow[1]) / 2, 0], [0, 0, -a])
        const fa = a + f
        const lo = 0.3
        const hand = [elbow[0] - Math.sin(fa) * lo, elbow[1] - Math.cos(fa) * lo, 0]
        P.add(pl, limb(0.045, 0.035, lo), [(elbow[0] + hand[0]) / 2, (elbow[1] + hand[1]) / 2, 0], [0, 0, -fa])
      }
    }),
    [pose],
  )
  return (
    <At p={p} rotY={rotY}>
      <Merged parts={parts} />
    </At>
  )
}

/* ---------------------------------------------------------------------------
 * Furniture (one merged set for the whole map)
 * ------------------------------------------------------------------------- */

function furniturePiece(P, kind, [w, h, d]) {
  const wood = acres.wood('#7a5032')
  const white = acres.paint('#f1efe6', 0.4, 0.1)
  switch (kind) {
    case 'sofa':
    case 'armchair': {
      const fabric = acres.fabric(kind === 'sofa' ? '#5f8a7a' : '#c9a24a')
      P.box(fabric, 0, 0.22, 0, w, 0.44, d, 1)
      // Back along the long side's far edge, arms at the ends.
      const long = d >= w
      if (long) {
        P.box(fabric, -w / 2 + 0.12, h / 2 + 0.05, 0, 0.24, h - 0.1, d, 1)
        for (const s of [-1, 1]) P.box(fabric, 0, 0.55, s * (d / 2 - 0.08), w, 0.3, 0.16, 1)
      } else {
        P.box(fabric, 0, h / 2 + 0.05, -d / 2 + 0.12, w, h - 0.1, 0.24, 1)
        for (const s of [-1, 1]) P.box(fabric, s * (w / 2 - 0.08), 0.55, 0, 0.16, 0.3, d, 1)
      }
      return
    }
    case 'coffeeTable':
    case 'diningTable': {
      P.box(wood, 0, h - 0.03, 0, w, 0.05, d, 1)
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(wood, sx * (w / 2 - 0.06), (h - 0.05) / 2, sz * (d / 2 - 0.06), 0.05, h - 0.05, 0.05, 1)
      if (kind === 'diningTable') {
        const chair = acres.paint('#c9553f', 0.5, 0.2)
        for (const s of [-1, 1]) {
          P.box(chair, s * (w / 2 + 0.25), 0.45, 0, 0.42, 0.05, 0.42, 1)
          P.box(chair, s * (w / 2 + 0.44), 0.72, 0, 0.04, 0.5, 0.42, 1)
          for (const k of [-1, 1]) P.box(acres.chrome(), s * (w / 2 + 0.25), 0.22, k * 0.17, 0.03, 0.44, 0.03, 1)
        }
      }
      return
    }
    case 'tv': {
      P.box(wood, 0, h * 0.4, 0, w, h * 0.8, d, 1)
      P.box(acres.glass(), 0, h * 0.55, d / 2 + 0.005, w * 0.7, h * 0.4, 0.01, 1)
      P.box(acres.paint('#2a2a2a', 0.5), 0, h * 0.05, 0, w * 0.8, 0.1, d * 0.8, 1)
      for (const s of [-1, 1]) P.box(acres.chrome(), s * 0.12, h * 0.8 + 0.2, 0, 0.012, 0.42, 0.012, 1, [0, 0, s * 0.35])
      return
    }
    case 'counter':
    case 'island': {
      P.box(acres.paint('#9fd3c4', 0.5), 0, (h - 0.04) / 2, 0, w, h - 0.04, d, 1)
      P.box(acres.paint('#f2efe7', 0.3), 0, h - 0.02, 0, w + 0.03, 0.04, d + 0.03, 1)
      P.box(acres.chrome(), 0, h - 0.18, d / 2 + 0.01, w * 0.9, 0.02, 0.01, 1)
      return
    }
    case 'fridge':
    case 'washer': {
      P.box(white, 0, h / 2, 0, w, h, d, 1)
      P.box(acres.chrome(), w / 2 - 0.08, h * 0.65, d / 2 + 0.02, 0.03, 0.3, 0.03, 1)
      return
    }
    case 'stove': {
      P.box(white, 0, h / 2, 0, w, h, d, 1)
      P.box(acres.paint('#202020', 0.6), 0, h + 0.005, 0, w - 0.06, 0.01, d - 0.06, 1)
      return
    }
    case 'bed': {
      P.box(wood, 0, 0.18, 0, w, 0.3, d, 1)
      P.box(white, 0, 0.42, 0, w - 0.06, 0.2, d - 0.06, 1)
      P.box(acres.fabric('#c96f6f'), 0, 0.55, d * 0.1, w - 0.02, 0.08, d * 0.75, 1)
      P.box(white, 0, 0.58, -d / 2 + 0.25, w * 0.7, 0.12, 0.35, 1)
      P.box(wood, 0, 0.5, -d / 2 + 0.03, w, 1.0, 0.06, 1)
      return
    }
    case 'dresser':
    case 'wardrobe':
    case 'bookshelf':
    case 'shelf': {
      P.box(wood, 0, h / 2, 0, w, h, d, 1)
      if (kind === 'bookshelf' || kind === 'shelf') {
        for (let y = 0.4; y < h - 0.2; y += 0.42) {
          const spine = acres.fabric(['#b8463a', '#3f6f8f', '#d9b04a'][Math.round(y * 3) % 3])
          // Along whichever side is the front (the long one).
          if (w >= d) P.box(spine, 0, y + 0.13, d / 2 + 0.012, w * 0.8, 0.24, 0.02, 1)
          else P.box(spine, -w / 2 - 0.012, y + 0.13, 0, 0.02, 0.24, d * 0.8, 1)
        }
      }
      return
    }
    case 'piano': {
      P.box(acres.paint('#1b1514', 0.3, 0.1), 0, h / 2, 0, w, h, d, 1)
      P.box(white, w / 2 + 0.05, 0.75, 0, 0.12, 0.03, d - 0.1, 1)
      return
    }
    case 'workbench': {
      P.box(wood, 0, h - 0.03, 0, w, 0.06, d, 1)
      for (const sz of [-1, 1]) for (const sx of [-1, 1]) P.box(acres.steelDark(), sx * (w / 2 - 0.05), (h - 0.06) / 2, sz * (d / 2 - 0.05), 0.05, h - 0.06, 0.05, 1)
      P.box(acres.paint('#b8372c', 0.5, 0.4), 0, h + 0.12, -d * 0.2, w * 0.5, 0.24, 0.5, 1)
      return
    }
    case 'bench': {
      P.box(wood, 0, h - 0.03, 0, w, 0.06, d, 1)
      for (const sx of [-1, 1]) P.box(wood, sx * (w / 2 - 0.06), h / 2, 0, 0.06, h, d, 1)
      return
    }
    case 'pew': {
      // Seat, a tall back along the far (north) edge, ends.
      const dark = acres.wood('#4a2e1c')
      P.box(dark, 0, 0.45, 0.06, w, 0.06, d - 0.12, 1)
      P.box(dark, 0, (h + 0.45) / 2 + 0.02, -d / 2 + 0.04, w, h - 0.45, 0.06, 1)
      for (const sx of [-1, 1]) P.box(dark, sx * (w / 2 - 0.04), h / 2, 0, 0.08, h, d, 1)
      return
    }
    case 'altar': {
      P.box(acres.stone(), 0, (h - 0.06) / 2, 0, w, h - 0.06, d, 1)
      P.box(acres.fabric('#5a1a24'), 0, h - 0.03, 0, w + 0.06, 0.06, d + 0.06, 1)
      P.box(acres.fabric('#5a1a24'), 0, h * 0.6, d / 2 + 0.04, w * 0.5, h * 0.8, 0.02, 1)
      return
    }
    case 'bales': {
      // Square hay bales stacked into the footprint.
      const straw = acres.wood('#c8a65a')
      const bw = 1.0
      const bh = 0.46
      const nx = Math.max(1, Math.round(w / bw))
      const nz = Math.max(1, Math.round(d / 0.55))
      const ny = Math.max(1, Math.round(h / bh))
      for (let y = 0; y < ny; y++) {
        for (let i = 0; i < nx; i++) {
          for (let k = 0; k < nz; k++) {
            const jitter = ((i * 7 + k * 3 + y * 5) % 5) * 0.012
            P.box(straw, -w / 2 + (w / nx) * (i + 0.5) + jitter, (h / ny) * (y + 0.5), -d / 2 + (d / nz) * (k + 0.5), w / nx - 0.04, h / ny - 0.02, d / nz - 0.04, 0.8)
          }
        }
      }
      return
    }
    case 'crates': {
      const crate = acres.wood('#8a6a44')
      P.box(crate, 0, h / 2, 0, w, h, d, 1)
      for (const sy of [0.08, h - 0.08]) P.box(acres.wood('#5a4028'), 0, sy, 0, w + 0.02, 0.08, d + 0.02, 1)
      return
    }
    default:
      P.box(wood, 0, h / 2, 0, w, h, d, 1)
  }
}

/** All of a map's furniture in one merged set (Atomic Acres' unless `list` is given). */
export function Furniture({ list = FURNITURE, cacheKey = 'acres:furniture' }) {
  const parts = useMemo(() => once(cacheKey, () => {
    const P = new Pieces()
    for (const f of list) {
      // Each piece is built round its own origin, placed by the frame.
      P.withFrame(f.p, f.rotY, () => furniturePiece(P, f.kind, f.size))
    }
    return P.build()
  }), [list, cacheKey])
  return <Merged parts={parts} />
}
