import { useMemo } from 'react'
import { ConeGeometry, CylinderGeometry, IcosahedronGeometry, PlaneGeometry, SphereGeometry } from 'three'

import { CANDLES, HEADSTONES, PIER_TOP, PUMPKINS, STONE_SIZE, STRING_LIGHTS } from '../../../shared/mapHollow.js'
import { seededRandom } from '../../../shared/math.js'
import { acres } from '../acres/materials.js'
import { Merged } from '../acres/merge.jsx'
import { once, Pieces } from '../acres/pieces.js'
import { addCandles, addPine, addPumpkin, addSegment, stringBulbs, withTilt } from './kit.js'
import { hc } from './materials.js'

/**
 * Hollow Creek's smaller things: pumpkins and candles, the iron lamp posts,
 * the poles and the string lights between them, the graveyard's iron fence,
 * gate piers and headstones, hay, scarecrows, dead trees, pines, boulders and
 * cobwebs. Each builds its pieces once into merged meshes (the lists in one
 * set each), sized to their colliders in shared/mapHollow.js.
 */

function useParts(key, build) {
  return useMemo(() => once(key, build), [key]) // eslint-disable-line react-hooks/exhaustive-deps
}
const keyOf = (type, p) => `hc:${type}:${p[0].toFixed(2)}:${p[2].toFixed(2)}`
/** Along a line from a to b (x, z): mid point, length and the yaw that runs local +x from a to b. */
const lineFrame = (a, b) => ({
  mid: [(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2],
  len: Math.hypot(b[0] - a[0], b[1] - a[1]),
  yaw: Math.atan2(-(b[1] - a[1]), b[0] - a[0]),
})

/* ---------------------------------------------------------------------------
 * Pumpkins and candles (one set each for the whole town)
 * ------------------------------------------------------------------------- */

export function Pumpkins() {
  const parts = useParts('hc:pumpkins', () => {
    const P = new Pieces()
    PUMPKINS.forEach((k, i) => addPumpkin(P, k.p, k.s, k.carved, k.rotY, i))
    return P.build()
  })
  return <Merged parts={parts} />
}

export function Candles() {
  const parts = useParts('hc:candles', () => {
    const P = new Pieces()
    const rand = seededRandom(3301)
    for (const c of CANDLES) addCandles(P, c.p, c.n, rand)
    return P.build()
  })
  return <Merged parts={parts} shadow={false} />
}

/* ---------------------------------------------------------------------------
 * Lamps, poles, string lights
 * ------------------------------------------------------------------------- */

/** An iron lamp post with a lantern on top (its glow and light on the ground: see night.jsx). */
export function Lamp({ p }) {
  const parts = useParts(keyOf('lamp', p), () => {
    const P = new Pieces()
    const iron = hc.iron()
    const [x, , z] = p
    P.add(iron, new CylinderGeometry(0.16, 0.2, 0.5, 8), [x, 0.25, z])
    P.add(iron, new CylinderGeometry(0.055, 0.075, 3.0, 8), [x, 2.0, z])
    for (const y of [0.55, 1.2, 3.4]) P.add(iron, new CylinderGeometry(0.1, 0.1, 0.06, 8), [x, y, z])
    // The lantern: glass in an iron frame, a pyramid cap and a finial.
    P.box(hc.lampGlass(), x, 3.68, z, 0.26, 0.4, 0.26, 1)
    P.box(iron, x, 3.46, z, 0.34, 0.05, 0.34, 1)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(iron, x + sx * 0.14, 3.68, z + sz * 0.14, 0.03, 0.44, 0.03, 1)
    P.add(iron, new ConeGeometry(0.28, 0.24, 4), [x, 4.02, z], [0, Math.PI / 4, 0])
    P.add(iron, new SphereGeometry(0.05, 6, 4), [x, 4.18, z])
    return P.build()
  })
  return <Merged parts={parts} />
}

export function LightPole({ p, h }) {
  const parts = useParts(keyOf('lightPole', p), () => {
    const P = new Pieces()
    const wood = hc.wood('#3e3026')
    P.add(wood, new CylinderGeometry(0.1, 0.13, h, 8), [p[0], h / 2, p[2]])
    P.box(wood, p[0], h - 0.3, p[2], 0.9, 0.09, 0.09, 1)
    P.add(hc.iron(), new SphereGeometry(0.06, 6, 4), [p[0], h - 0.2, p[2]])
    return P.build()
  })
  return <Merged parts={parts} />
}

// Bulbs are 4 cm specks of light (the halo does the rest): 20 faces each read as round, and there are hundreds.
const bulbGeo = new IcosahedronGeometry(0.042, 0)

/** Strings of orange and purple bulbs sagging between poles, eaves and the bell tower. */
export function StringLights() {
  const parts = useParts('hc:stringLights', () => {
    const P = new Pieces()
    const wire = hc.paint('#151417', 0.8)
    for (const [a, b, sag] of STRING_LIGHTS) {
      const at = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]
      const n = 14
      for (let i = 0; i < n; i++) addSegment(P, wire, at(i / n), at((i + 1) / n), 0.008, 0.008, 3)
    }
    for (const bulb of stringBulbs()) P.add(hc.bulb(bulb.color), bulbGeo, bulb.p, null, [1, 1.3, 1])
    return P.build()
  })
  return <Merged parts={parts} shadow={false} />
}

/* ---------------------------------------------------------------------------
 * The graveyard: iron railings, gate piers, headstones
 * ------------------------------------------------------------------------- */

const spikeGeo = new ConeGeometry(0.03, 0.11, 4)
const knobGeo = new SphereGeometry(0.06, 6, 4)

export function IronFence({ a, b }) {
  const parts = useParts(`hc:ironFence:${a.join(':')}:${b.join(':')}`, () => {
    const P = new Pieces()
    const iron = hc.iron()
    const { mid, len, yaw } = lineFrame(a, b)
    P.withFrame(mid, yaw, () => {
      for (const y of [0.16, 1.3]) P.box(iron, 0, y, 0, len, 0.035, 0.035, 1)
      const n = Math.max(1, Math.round(len / 0.13))
      for (let i = 0; i <= n; i++) {
        const x = -len / 2 + (len * i) / n
        P.box(iron, x, 0.74, 0, 0.022, 1.4, 0.022, 1)
        P.add(iron, spikeGeo, [x, 1.49, 0])
      }
      const posts = Math.max(1, Math.round(len / 2.4))
      for (let i = 0; i <= posts; i++) {
        const x = -len / 2 + (len * i) / posts
        P.box(iron, x, 0.8, 0, 0.08, 1.6, 0.08, 1)
        P.add(iron, knobGeo, [x, 1.64, 0])
      }
    })
    return P.build()
  })
  return <Merged parts={parts} />
}

export function GatePier({ p }) {
  const parts = useParts(keyOf('pier', p), () => {
    const P = new Pieces()
    P.box(acres.stone(), p[0], 0.7, p[2], 0.5, 1.4, 0.5, 1.4)
    P.box(hc.granite('#8a877f'), p[0], 1.44, p[2], 0.62, 0.08, 0.62, 1)
    // Looking out of the gate: south on the graveyard's, west on the churchyard's.
    addPumpkin(P, [p[0], PIER_TOP - 0.07, p[2]], 1.0, true, p[0] < 0 ? -Math.PI / 2 : 0, 2)
    return P.build()
  })
  return <Merged parts={parts} />
}

export function Headstones() {
  const parts = useParts('hc:headstones', () => {
    const P = new Pieces()
    const rand = seededRandom(5571)
    const tints = ['#a6a49c', '#8e8c86', '#b2aea2', '#7e7c78']
    for (const s of HEADSTONES) {
      const [w, h, d] = STONE_SIZE[s.kind]
      const stone = hc.granite(tints[Math.floor(rand() * tints.length)])
      P.withFrame(s.p, s.rotY, () => {
        // Lean it over (about its foot), then build it upright in that frame.
        withTilt(P, s.tilt, () => {
          if (s.kind === 'round') {
            P.box(stone, 0, (h - w / 2) / 2, 0, w, h - w / 2, d, 1)
            P.add(stone, new CylinderGeometry(w / 2, w / 2, d, 14, 1, false, -Math.PI / 2, Math.PI), [0, h - w / 2, 0], [-Math.PI / 2, 0, 0])
          } else if (s.kind === 'cross') {
            P.box(stone, 0, h / 2, 0, 0.16, h, d, 1)
            P.box(stone, 0, h * 0.7, 0, w, 0.15, d, 1)
            P.box(stone, 0, 0.1, 0, 0.42, 0.2, d + 0.12, 1)
          } else if (s.kind === 'obelisk') {
            P.box(stone, 0, 0.12, 0, w + 0.14, 0.24, d + 0.14, 1)
            P.add(stone, new CylinderGeometry(w * 0.42, w * 0.62, h - 0.5, 4), [0, 0.24 + (h - 0.5) / 2, 0], [0, Math.PI / 4, 0])
            P.add(stone, new ConeGeometry(w * 0.42, 0.26, 4), [0, h - 0.13, 0], [0, Math.PI / 4, 0])
          } else {
            P.box(stone, 0, h / 2, 0, w, h, d, 1)
            P.box(stone, 0, h + 0.03, 0, w + 0.06, 0.06, d + 0.06, 1)
          }
          if (s.kind === 'round' || s.kind === 'square') {
            const ew = w * 0.78
            P.add(hc.engraving(), new PlaneGeometry(ew, ew), [0, h * 0.55, d / 2 + 0.003])
          }
        })
        // The grave in front: a low mound of earth.
        P.add(hc.mud(), new SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), [0, -0.02, 1.0], null, [0.4, 0.12, 0.82])
      })
    }
    return P.build()
  })
  return <Merged parts={parts} />
}

/* ---------------------------------------------------------------------------
 * Hay, scarecrows
 * ------------------------------------------------------------------------- */

export function Hay({ p, kind, rotY }) {
  const parts = useParts(keyOf(`hay:${kind}`, p), () => {
    const P = new Pieces()
    const hay = hc.hay()
    const twine = hc.paint('#5a4630', 0.9)
    P.withFrame(p, rotY, () => {
      if (kind === 'round') {
        P.add(hay, new CylinderGeometry(0.65, 0.65, 1.2, 18), [0, 0.65, 0], [0, 0, Math.PI / 2])
        for (const x of [-0.3, 0.3]) P.add(twine, new CylinderGeometry(0.66, 0.66, 0.03, 18, 1, true), [x, 0.65, 0], [0, 0, Math.PI / 2])
        return
      }
      const bale = (x, y, z, turn) => {
        P.box(hay, x, y + 0.23, z, 1.06, 0.46, 0.52, 0.8, [0, turn, 0])
        for (const k of [-0.25, 0.25]) P.box(twine, x + Math.cos(turn) * k, y + 0.23, z - Math.sin(turn) * k, 0.02, 0.47, 0.53, 1, [0, turn, 0])
      }
      bale(-0.55, 0, -0.27, 0)
      bale(0.55, 0, -0.27, 0.02)
      bale(-0.5, 0, 0.27, -0.02)
      bale(0.56, 0, 0.27, 0)
      bale(0.05, 0.46, 0, 0.12)
    })
    return P.build()
  })
  return <Merged parts={parts} />
}

export function Scarecrow({ p, rotY }) {
  const parts = useParts(keyOf('scarecrow', p), () => {
    const P = new Pieces()
    const wood = hc.wood('#4e3e30')
    const shirt = hc.cloth('#6a3426')
    const pants = hc.cloth('#3a4660')
    const hay = hc.hay()
    P.withFrame(p, rotY, () => {
      P.box(wood, 0, 1.25, -0.05, 0.1, 2.5, 0.1, 1)
      P.box(wood, 0, 1.85, -0.05, 1.7, 0.08, 0.08, 1)
      P.box(shirt, 0, 1.65, 0, 0.62, 0.72, 0.3, 1)
      for (const s of [-1, 1]) {
        P.box(shirt, s * 0.55, 1.83, 0, 0.5, 0.22, 0.24, 1)
        P.add(hay, new ConeGeometry(0.1, 0.22, 6), [s * 0.88, 1.83, 0], [0, 0, (s * Math.PI) / 2])
        P.box(pants, s * 0.14, 1.05, 0, 0.24, 0.62, 0.24, 1)
        P.add(hay, new ConeGeometry(0.1, 0.18, 6), [s * 0.14, 0.68, 0], [Math.PI, 0, 0])
      }
      addPumpkin(P, [0, 2.0, 0], 1.45, true, 0, 3)
      P.add(hc.cloth('#3a2c20'), new CylinderGeometry(0.4, 0.4, 0.03, 14), [0, 2.44, 0], [0.12, 0, 0.06])
      P.add(hc.cloth('#3a2c20'), new CylinderGeometry(0.05, 0.22, 0.42, 10), [0.03, 2.66, 0], [0.12, 0, 0.12])
    })
    return P.build()
  })
  return <Merged parts={parts} />
}

/* ---------------------------------------------------------------------------
 * Trees and rocks
 * ------------------------------------------------------------------------- */

/** A dead tree: a twisted trunk forking into bare, crooked branches. */
export function DeadTree({ p, s }) {
  const parts = useParts(keyOf('deadTree', p), () => {
    const P = new Pieces()
    const bark = hc.bark()
    const rand = seededRandom(Math.round(p[0] * 31 + p[2] * 17) + 9000)
    const grow = (from, dir, len, r, depth) => {
      const to = [from[0] + dir[0] * len, from[1] + dir[1] * len, from[2] + dir[2] * len]
      addSegment(P, bark, from, to, r, r * 0.68, depth > 1 ? 6 : 4)
      if (depth === 0) return
      const n = depth === 3 ? 3 : 2 + (rand() < 0.4 ? 1 : 0)
      for (let i = 0; i < n; i++) {
        const a = rand() * Math.PI * 2
        const spread = 0.55 + rand() * 0.5
        let nd = [dir[0] + Math.cos(a) * spread, dir[1] * (0.5 + rand() * 0.4), dir[2] + Math.sin(a) * spread]
        const l = Math.hypot(...nd)
        nd = nd.map((v) => v / l)
        grow(to, nd, len * (0.55 + rand() * 0.2), r * 0.62, depth - 1)
      }
    }
    // Roots flaring at the foot, then the trunk with a lean.
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + rand()
      addSegment(P, bark, [p[0], 0.35 * s, p[2]], [p[0] + Math.cos(a) * 0.6 * s, -0.05, p[2] + Math.sin(a) * 0.6 * s], 0.14 * s, 0.05 * s, 5)
    }
    const lean = [(rand() - 0.5) * 0.25, 1, (rand() - 0.5) * 0.25]
    const l = Math.hypot(...lean)
    grow([p[0], -0.05, p[2]], lean.map((v) => v / l), 2.4 * s, 0.3 * s, 3)
    return P.build()
  })
  return <Merged parts={parts} />
}

/** A pine: a bare trunk and stacked cones of needles, darker inside. */
export function Pine({ p, h }) {
  const parts = useParts(keyOf('pine', p), () => {
    const P = new Pieces()
    addPine(P, p, h, Math.round(p[0] * 13 + p[2] * 7))
    return P.build()
  })
  return <Merged parts={parts} />
}

/** A lumpy boulder, half sunk. */
export function Rock({ p, s, seed }) {
  const parts = useParts(keyOf('rock', p), () => {
    const P = new Pieces()
    const rand = seededRandom(seed)
    const g = new IcosahedronGeometry(1, 1)
    const pos = g.getAttribute('position')
    const moved = new Map()
    for (let i = 0; i < pos.count; i++) {
      const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`
      if (!moved.has(key)) moved.set(key, 0.8 + rand() * 0.35)
      const k = moved.get(key)
      pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k)
    }
    g.computeVertexNormals()
    P.add(hc.rock(), g, [p[0], 0.18 * s, p[2]], [rand() * 0.4, rand() * 6, rand() * 0.3], [0.95 * s, 0.72 * s, 0.85 * s])
    return P.build()
  })
  return <Merged parts={parts} />
}

/* ---------------------------------------------------------------------------
 * Cobwebs in doorways and corners
 * ------------------------------------------------------------------------- */

/** [x, y, z, size, rotY, flip]: anchored at their top corner. */
const WEBS = [
  [-1.15, 3.12, -16.92, 0.8, 0, 1], [1.15, 3.12, -16.92, 0.8, 0, -1],
  [8.42, 2.2, -35.34, 0.55, 0, 1], [9.58, 2.2, -35.34, 0.55, 0, -1],
  [6.48, 2.55, 7.96, 0.7, Math.PI, -1], [8.52, 2.55, 7.96, 0.7, Math.PI, 1],
  [-21.5, 2.45, -20.5, 0.7, Math.PI / 2, -1], [21.5, 2.45, -15.6, 0.7, -Math.PI / 2, -1],
  [6.5, 1.45, -38.9, 0.6, 0, 1], [11.5, 1.45, -38.9, 0.6, 0, -1],
]

export function Cobwebs() {
  const parts = useParts('hc:cobwebs', () => {
    const P = new Pieces()
    for (const [x, y, z, s, rotY, flip] of WEBS) {
      const g = new PlaneGeometry(s, s)
      // Anchor the texture's top-left corner at (x, y, z), spreading away from it.
      g.translate((s / 2) * flip, -s / 2, 0)
      if (flip < 0) {
        const uv = g.getAttribute('uv')
        for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i))
      }
      P.add(hc.cobweb(), g, [x, y, z], [0, rotY, 0])
    }
    return P.build()
  })
  return <Merged parts={parts} shadow={false} />
}

