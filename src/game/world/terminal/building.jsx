import { useMemo } from 'react'
import { BufferGeometry, CylinderGeometry, Float32BufferAttribute, PlaneGeometry, SphereGeometry, TorusGeometry } from 'three'

import {
  BOARDS,
  COLLAPSE,
  FACADE,
  facadeParts,
  flightParts,
  glassRunParts,
  HIDEOUT,
  LEG,
  LEG_HOLE,
  LEG_IN,
  ROOF_HOLES,
  TB,
  TB_IN,
  TM_ARCHES,
  TM_COLUMNS,
  TM_FLIGHTS,
  TM_FRONTS,
  TM_FURNITURE,
  TM_GLASS_RUNS,
  TM_LANDINGS,
  TM_RAILS,
  TM_SKYLIGHTS,
  TM_SLABS,
  TM_VOID,
  TM_WALLS,
  TRANSOM,
  wallSolids,
} from '../../../shared/mapTerminal.js'
import { rampBox } from '../../../shared/mapKit.js'
import { seededRandom } from '../../../shared/math.js'
import { Merged } from '../acres/merge.jsx'
import { once, Pieces } from '../acres/pieces.js'
import { addBush, addPalm } from '../palmwood/plants.js'
import { addBar, addRail } from '../quarter/kit.js'
import { addGlazing, addSign, addSignBox, GROUND_Y } from './kit.js'
import { tm } from './materials.js'

/**
 * The terminal from its shared description (shared/mapTerminal.js): the same
 * wall pieces, slabs and flights its colliders are made of, dressed (the
 * glass that breaks is the glass system's: GlassPanes),
 * after the fighting. Cladding outside and plaster inside gone grey with
 * smoke; the glass fronts with their mullions, dark spandrel and the fascia
 * with the airport's name, panes shot out; stone floors, carpet in the
 * lounges and at the gates, tiled ceilings with their light strips (dead, but
 * for a few and the red emergency lights); the hall's orange roof trusses
 * under the skylights, the palm in its planter, the hanging sculpture and
 * banners; columns with a dark band; glass balustrades round the void; the
 * escalators and the grand stair; the signs; every desk, seat, shelf and
 * machine; and the damage: the hole blown in the leg's end, the slab come
 * down inside it under the hole in the roof, rubble, soot, fallen ceiling
 * tiles, sandbags and barricades.
 */

const UNDER1 = TB.l1 - TB.slab
const UNDER2 = TB.roof - TB.slab
const OUT = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }
const FRAME = '#2e3136'
const STEEL = '#8d9196'
/** The building's whites after the smoke: cladding, plaster, floors, ceilings, columns. */
const WALL_OUT = '#c2beb6'
const WALL_IN = '#bab4a8'
const FLOOR = '#a9a59c'
const CEILING = '#aaa7a0'
const EDGE = '#b4afa5'
const COLUMN = '#bdb9b1'

/* ---------------------------------------------------------------------------
 * Walls
 * ------------------------------------------------------------------------- */

/** A rectangle [a0, a1, y0, y1] along a run as a box, `t` thick, pushed `off` along the run's normal. */
function runBox(P, material, run, [a0, a1, y0, y1], t, off = 0, tile = 2.5) {
  const mid = (a0 + a1) / 2
  if (run.axis === 'x') P.box(material, mid, (y0 + y1) / 2, run.at + off, a1 - a0, y1 - y0, t, tile)
  else P.box(material, run.at + off, (y0 + y1) / 2, mid, t, y1 - y0, a1 - a0, tile)
}

/** The line of a run on the ground plan between `a` and `b` (along it). */
const runLine = (run, a, b, off = 0) => (run.axis === 'x' ? [[a, run.at + off], [b, run.at + off]] : [[run.at + off, a], [run.at + off, b]])
/** World [x, y, z] of a point `a` along a run, `off` off its line, at height `y`. */
const runPoint = (run, a, y, off = 0) => (run.axis === 'x' ? [a, y, run.at + off] : [run.at + off, y, a])
/** Yaw that turns a quad (facing +z) to face out of a run's `side` (+1 / -1 along its normal). */
const runFacing = (run, side) => (run.axis === 'x' ? (side > 0 ? 0 : Math.PI) : side > 0 ? Math.PI / 2 : -Math.PI / 2)

const decalGeo = new PlaneGeometry(1, 1)
/** Soot on a wall's face: `side` of the run, `t` its thickness, centred on `a` along it and at height `y`. */
function wallScorch(P, run, a, y, w, h, side, t) {
  P.add(tm.scorch(), decalGeo, runPoint(run, a, y, side * (t / 2 + 0.012)), [0, runFacing(run, side), 0], [w, h, 1])
}
/** Soot on a floor (flat, a little over it). */
function floorScorch(P, x, y, z, size, yaw = 0) {
  P.add(tm.scorch(), decalGeo, [x, y + 0.02, z], [-Math.PI / 2, 0, yaw], [size, size, 1])
}

/**
 * A hole blown through a wall: its edges broken back into lumps of concrete,
 * reinforcing bars bent out of them, soot round it on both faces, and the
 * wall's rubble spread on the floor both sides (low enough to walk through).
 */
function addBreach(P, w, o, rand) {
  const t = w.t
  const concrete = tm.concrete('#8e8a82')
  const steel = tm.paint('#4a3a2e', 0.8, 0.4)
  const lump = (a, y, off, s) => {
    const p = runPoint(w, a, y, off)
    P.box(concrete, p[0], p[1], p[2], s * (0.7 + rand() * 0.6), s * (0.6 + rand() * 0.6), s * (0.7 + rand() * 0.6), 1, [rand() * 0.8, rand() * Math.PI, rand() * 0.8])
  }
  // The edges: lumps up both sides and along the top, standing a little into the hole.
  for (let y = o.bottom + 0.3; y < o.top; y += 0.35) {
    lump(o.from + 0.08 + rand() * 0.14, y, (rand() - 0.5) * t * 0.6, 0.32)
    lump(o.to - 0.08 - rand() * 0.14, y, (rand() - 0.5) * t * 0.6, 0.32)
  }
  for (let a = o.from + 0.2; a < o.to; a += 0.32) lump(a, o.top - 0.06 - rand() * 0.12, (rand() - 0.5) * t * 0.6, 0.3)
  // Bars hanging out of the top edge.
  for (let a = o.from + 0.3; a < o.to - 0.2; a += 0.45 + rand() * 0.3) {
    const from = runPoint(w, a, o.top, (rand() - 0.5) * t * 0.5)
    const to = runPoint(w, a + (rand() - 0.5) * 0.4, o.top - 0.4 - rand() * 0.7, (rand() - 0.5) * 0.8)
    addBar(P, steel, from, to, 0.025, 0.025)
  }
  // Rubble thrown out both sides.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 26; i++) {
      const a = o.from - 0.6 + rand() * (o.to - o.from + 1.2)
      const off = side * (t / 2 + 0.1 + rand() * rand() * 2.6)
      const s = 0.08 + rand() * 0.2
      const p = runPoint(w, a, s * 0.3, off)
      P.box(concrete, p[0], p[1], p[2], s * 1.4, s * 0.8, s, 1, [rand() * 0.5, rand() * Math.PI, rand() * 0.5])
    }
    // Soot round the hole (not across it).
    wallScorch(P, w, o.from - 0.9, (o.bottom + o.top) / 2 + 0.3, 1.8, o.top - o.bottom + 1.6, side, t)
    wallScorch(P, w, o.to + 0.9, (o.bottom + o.top) / 2 + 0.3, 1.8, o.top - o.bottom + 1.6, side, t)
    wallScorch(P, w, (o.from + o.to) / 2, o.top + 0.8, o.to - o.from + 1.4, 1.8, side, t)
  }
}

/**
 * Planks nailed across a rectangle [a0, a1, y0, y1] of a run, `off` off its
 * line: rough boards of mixed timber, a little crooked, gaps between them.
 */
function addBoards(P, run, [a0, a1, y0, y1], off, rand) {
  const woods = [tm.oak('#dcb486'), tm.oak('#c89e70'), tm.oak('#e6c294')]
  let y = y0 + 0.02
  while (y < y1 - 0.08) {
    const h = Math.min(y1 - y, 0.18 + rand() * 0.08)
    const p = runPoint(run, (a0 + a1) / 2 + (rand() - 0.5) * 0.12, y + h / 2, off + (rand() - 0.5) * 0.02)
    const len = a1 - a0 + 0.12 + rand() * 0.15
    const tilt = (rand() - 0.5) * 0.06
    if (run.axis === 'x') P.box(woods[(rand() * 3) | 0], p[0], p[1], p[2], len, h - 0.02, 0.025, 1, [0, 0, tilt])
    else P.box(woods[(rand() * 3) | 0], p[0], p[1], p[2], 0.025, h - 0.02, len, 1, [tilt, 0, 0])
    y += h + 0.015 + rand() * 0.03
  }
  // Two battens across the back of them.
  for (const a of [a0 + 0.15, a1 - 0.15]) runBox(P, tm.oak('#a88058'), run, [a - 0.04, a + 0.04, y0, y1], 0.03, off - Math.sign(off || 1) * 0.03, 1)
}

/** A makeshift wall: sheets of plywood or ribbed steel on a timber frame, ragged along the top. */
function addMakeshift(P, w, rand) {
  const sheet = w.style === 'sheet' ? tm.sheet('#b4baa8') : tm.oak('#e2c08e')
  const timber = tm.oak('#a88058')
  for (const [a0, a1, y0, y1] of wallSolids(w)) {
    // Sheets about 1.2 m wide, each a little crooked, their tops uneven.
    const n = Math.max(1, Math.round((a1 - a0) / 1.2))
    for (let i = 0; i < n; i++) {
      const b0 = a0 + ((a1 - a0) * i) / n
      const b1 = a0 + ((a1 - a0) * (i + 1)) / n
      const top = y1 - rand() * 0.15
      const p = runPoint(w, (b0 + b1) / 2, (y0 + top) / 2, (rand() - 0.5) * 0.02)
      const tilt = (rand() - 0.5) * 0.03
      if (w.axis === 'x') P.box(sheet, p[0], p[1], p[2], b1 - b0 + 0.02, top - y0, w.t * 0.5, 1.2, [0, 0, tilt])
      else P.box(sheet, p[0], p[1], p[2], w.t * 0.5, top - y0, b1 - b0 + 0.02, 1.2, [tilt, 0, 0])
    }
    // The frame: posts at the ends and every couple of metres, a rail along the top, on the back.
    for (let a = a0 + 0.05; a <= a1 - 0.04; a += Math.max(0.5, (a1 - a0 - 0.1) / Math.max(1, Math.round((a1 - a0) / 2)))) runBox(P, timber, w, [a - 0.045, a + 0.045, y0, y1 - 0.1], 0.09, -0.08, 1)
    runBox(P, timber, w, [a0, a1, y1 - 0.4, y1 - 0.31], 0.09, -0.08, 1)
    // Props against the floor, and a sandbag or two at its foot.
    for (let a = a0 + 0.6; a < a1 - 0.3; a += 2.4) {
      const foot = runPoint(w, a, y0, -0.95)
      const head = runPoint(w, a, y0 + 1.6, -0.1)
      addBar(P, timber, foot, head, 0.08, 0.08)
    }
  }
}

function addWalls(P) {
  const cladding = tm.cladding(WALL_OUT)
  const plaster = tm.plaster(WALL_IN)
  const skirting = tm.paint('#2a2b2e', 0.5)
  const rand = seededRandom(7611)
  for (const w of TM_WALLS) {
    if (w.style) {
      addMakeshift(P, w, rand)
      continue
    }
    const outer = w.outer ? OUT[w.outer] : null
    const sign = outer ? (w.axis === 'x' ? outer[1] : outer[0]) : 0
    for (const r of wallSolids(w)) {
      if (outer) {
        runBox(P, cladding, w, r, w.t / 2, (sign * w.t) / 4, 3)
        runBox(P, plaster, w, r, w.t / 2, (-sign * w.t) / 4, 3)
      } else {
        runBox(P, plaster, w, r, w.t, 0, 3)
      }
    }
    // Skirting along the bottom of each inside face, on each floor the wall stands on.
    const floors = [w.y0, ...(w.y0 < TB.l1 && w.y1 > TB.l1 ? [TB.l1] : [])]
    for (const y of floors) {
      const solids = wallSolids(w).filter((r) => r[2] <= y + 0.01 && r[3] >= y + 0.12)
      for (const [a0, a1] of solids) {
        const sides = outer ? [-sign] : [-1, 1]
        for (const s of sides) runBox(P, skirting, w, [a0, a1, y, y + 0.1], 0.02, s * (w.t / 2 + 0.01), 1)
      }
    }
    // Openings: frames round the doors, glazing in the windows, the breach.
    for (const o of w.openings) {
      const [p0, p1] = runLine(w, o.from, o.to)
      if (o.kind === 'breach') addBreach(P, w, o, rand)
      else if (o.kind === 'boarded') {
        // Boarded up from inside: planks across the opening, a sill under it.
        addBoards(P, w, [o.from, o.to, o.bottom, o.top], -sign * (w.t / 2 - 0.03), rand)
        runBox(P, tm.paint('#9a9a96', 0.5), w, [o.from - 0.05, o.to + 0.05, o.bottom - 0.03, o.bottom + 0.02], w.t + 0.08, 0, 1)
      } else if (o.kind === 'glass') {
        addGlazing(P, p0, p1, o.bottom, o.top, { pitch: 1.4, frame: FRAME, depth: w.t + 0.02, pane: false })
        // A sill under the window, both faces.
        // (Its top 2 cm over the wall's, never level with it.)
        runBox(P, tm.paint('#d9dadc', 0.5), w, [o.from - 0.05, o.to + 0.05, o.bottom - 0.03, o.bottom + 0.02], w.t + 0.08, 0, 1)
      } else {
        // Frames 2 cm into the opening, so none of their faces lies on the wall's reveals.
        const frame = tm.paint(FRAME, 0.45, 0.6)
        runBox(P, frame, w, [o.from - 0.04, o.from + 0.02, o.bottom, o.top + 0.04], w.t + 0.03, 0, 1)
        runBox(P, frame, w, [o.to - 0.02, o.to + 0.04, o.bottom, o.top + 0.04], w.t + 0.03, 0, 1)
        runBox(P, frame, w, [o.from + 0.02, o.to - 0.02, o.top - 0.02, o.top + 0.04], w.t + 0.03, 0, 1)
        // Wide entrances: glass sliding doors parked open either side.
        if (outer && o.to - o.from > 2.5) {
          const leaf = (o.to - o.from) / 4
          for (const s of [-1, 1]) {
            const a = s < 0 ? o.from - leaf * 0.1 : o.to + leaf * 0.1 - leaf
            const [q0, q1] = runLine(w, a, a + leaf, -sign * (w.t / 2 + 0.06))
            addGlazing(P, q0, q1, o.bottom + 0.02, o.top - 0.04, { pitch: leaf, frame: '#b8bcc0', post: 0.05, depth: 0.05 })
          }
        }
      }
    }
  }
}

function addGlassRuns(P) {
  for (const g of TM_GLASS_RUNS) {
    const { panes, header } = glassRunParts(g)
    const frame = g.frame === 'steel' ? STEEL : FRAME
    for (const [a0, a1, y0, y1] of panes) {
      const [p0, p1] = runLine(g, a0, a1)
      addGlazing(P, p0, p1, y0, y1, { pitch: 1.2, frame, post: 0.05, depth: 0.08, pane: false })
    }
    for (const r of header) runBox(P, tm.plaster(EDGE), g, r, TB.inner, 0, 3)
    for (const o of g.openings) {
      const paint = tm.paint(frame, 0.45, 0.6)
      runBox(P, paint, g, [o.from - 0.03, o.from + 0.03, o.bottom, o.top], 0.1, 0, 1)
      runBox(P, paint, g, [o.to - 0.03, o.to + 0.03, o.bottom, o.top], 0.1, 0, 1)
    }
  }
  // The metal detectors in the security lanes: two posts and the beam over them.
  const grey = tm.paint('#c9ccd0', 0.5, 0.3)
  for (const z of TM_ARCHES) {
    for (const s of [-1, 1]) P.box(grey, -17.0, 1.1, z + s * 0.68, 0.5, 2.2, 0.15, 1)
    P.box(grey, -17.0, 2.28, z, 0.55, 0.16, 1.55, 1)
    P.box(tm.glow('#4cd964'), -17.27, 2.28, z, 0.01, 0.06, 0.4, 1)
  }
}

/* ---------------------------------------------------------------------------
 * The glass fronts
 * ------------------------------------------------------------------------- */

/**
 * Jagged glass left in a shot-out pane's frame: teeth hanging from its top
 * edge, standing up from its bottom one, in from its sides (triangles in the
 * pane's plane, in local run coordinates [a, y]).
 */
function shardGeometry(F, [a0, a1, y0, y1], rand) {
  const pos = []
  const tri = (p, q, r) => {
    for (const [a, y] of [p, q, r]) pos.push(...runPoint(F, a, y))
  }
  const edge = (from, to, y, down) => {
    let a = from
    while (a < to - 0.05) {
      const w = 0.12 + rand() * 0.35
      const b = Math.min(to, a + w)
      const tip = (a + b) / 2 + (rand() - 0.5) * w * 0.6
      const len = (0.15 + rand() * rand() * 0.9) * (rand() < 0.2 ? 0.2 : 1)
      tri([a, y], [b, y], [tip, y + (down ? -len : len)])
      a = b
    }
  }
  edge(a0, a1, y1, true)
  if (y0 > 0.1) edge(a0, a1, y0, false)
  for (const [a, dir] of [
    [a0, 1],
    [a1, -1],
  ]) {
    let y = y0
    while (y < y1 - 0.05) {
      const h = 0.15 + rand() * 0.4
      const top = Math.min(y1, y + h)
      tri([a, y], [a, top], [a + dir * (0.06 + rand() * rand() * 0.5), (y + top) / 2 + (rand() - 0.5) * h * 0.5])
      y = top
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}

/** A glass front (see TM_FRONTS): its bands, panes and mullions, doors, the shot-out gaps. */
function addFront(P, F, rand) {
  const out = F.out
  const { solid, panes, broken } = facadeParts(F)
  const mullion = tm.paint('#3a3f46', 0.45, 0.6)
  // Spandrel (dark, both faces) and the fascia (cladding outside, plaster in).
  for (const r of solid) {
    if (r[2] > TB.l1) {
      runBox(P, tm.cladding(WALL_OUT), F, r, TB.wall / 2, (out * TB.wall) / 4, 3)
      runBox(P, tm.plaster(WALL_IN), F, r, TB.wall / 2, (-out * TB.wall) / 4, 3)
    } else runBox(P, tm.cladding('#3e434a'), F, r, TB.wall, 0, 3)
  }
  // Panes and mullions every 1.5 m (none across a door), a transom over the doors' height.
  const doors = [...F.ground, ...F.upper]
  const inDoor = (a, y0, y1) => doors.some((o) => a > o.from - 0.02 && a < o.to + 0.02 && y0 < o.top && y1 > o.bottom)
  for (const [a0, a1, y0, y1] of panes) {
    const n = Math.max(1, Math.round((a1 - a0) / 1.5))
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n
      if (!inDoor(a, y0, y1)) runBox(P, mullion, F, [a - 0.035, a + 0.035, y0, y1], 0.24, 0, 1)
    }
    const transom = y0 < TB.l1 ? TRANSOM[0] : TRANSOM[1]
    if (transom > y0 + 0.1 && transom < y1 - 0.1) runBox(P, mullion, F, [a0, a1, transom - 0.035, transom + 0.035], 0.2, 0, 1)
  }
  // Boarded up from inside.
  for (const r of facadeParts(F).boards) addBoards(P, F, r, -out * BOARDS.inset, rand)
  // Shot-out panes: the transom still across them, glass teeth left in the frame, the rest
  // in glittering bits on the floor both sides.
  const glint = tm.paint('#d8e4ea', 0.1, 0.6)
  for (const b of broken) {
    const [a0, a1, y0, y1] = b
    for (const y of [y0, y1]) if (TRANSOM.some((t) => Math.abs(t - y) < 0.01)) runBox(P, mullion, F, [a0, a1, y - 0.035, y + 0.035], 0.2, 0, 1)
    P.add(tm.glass('#b8ccd6'), shardGeometry(F, b, rand), [0, 0, 0])
    const upstairs = y0 > TB.l1 - 0.1
    for (let i = 0; i < 40; i++) {
      // (Upstairs only inside: outside it's a long way down.)
      const side = upstairs || rand() < 0.5 ? -out : out
      const floor = upstairs ? TB.l1 + 0.012 : side === out ? 0 : GROUND_Y.floor
      const p = runPoint(F, a0 - 0.4 + rand() * (a1 - a0 + 0.8), floor + 0.006, side * (0.2 + rand() * rand() * 2.4))
      P.box(glint, p[0], p[1], p[2], 0.03 + rand() * 0.06, 0.006, 0.03 + rand() * 0.05, 1, [0, rand() * Math.PI, 0])
    }
  }
  // Doors: frames (2 cm into the opening, so none of their faces lies on the glass's edges).
  const frame = tm.paint(FRAME, 0.45, 0.6)
  for (const o of doors) {
    runBox(P, frame, F, [o.from - 0.06, o.from + 0.02, o.bottom, o.top], 0.3, 0, 1)
    runBox(P, frame, F, [o.to - 0.02, o.to + 0.06, o.bottom, o.top], 0.3, 0, 1)
    runBox(P, frame, F, [o.from - 0.06, o.to + 0.06, o.top - 0.02, o.top + 0.06], 0.3, 0, 1)
  }
  // The baggage hall's shutter rolled up in its box.
  if (F.shutter) {
    const [s0, s1, sy0, sy1] = F.shutter
    runBox(P, tm.cladding('#8a9098'), F, [s0, s1, sy0, sy1], TB.wall + 0.02, 0, 1)
    runBox(P, tm.brushed('#a8acb0'), F, [s0 - 0.1, s1 + 0.1, sy0, sy0 + 0.5], 0.32, out * 0.24, 1)
  }
  // Little canopies over the glass doors to the apron.
  for (const o of F.ground.filter((d) => d.top < 3)) runBox(P, tm.brushed('#b8bcc0'), F, [o.from - 0.8, o.to + 0.8, 3.14, 3.26], 1.5, out * 0.9, 1)
}

function addFronts(P) {
  const rand = seededRandom(7711)
  for (const F of TM_FRONTS) addFront(P, F, rand)
  const z = FACADE.z
  // The airport's name across the fascia, and a smaller one at the west end.
  addSign(P, 'logo', [20.0, (TB.l1 + TB.top) / 2 + 2.85, z + TB.wall / 2 + 0.006], 9.6, 1.2, 0)
  addSign(P, 'logo', [-30.0, (TB.l1 + TB.top) / 2 + 2.85, z + TB.wall / 2 + 0.006], 6.4, 0.8, 0)
  addSignBox(P, 'gate3', [-6.0, TB.l1 + 2.75, z + 0.25], 1.8, 0.45, 0, 1)
  // The corner where the leg's front meets the main one: a steel post up to the fascia.
  P.box(tm.paint('#3a3f46', 0.45, 0.6), LEG.x0 + TB.wall / 2, (TB.top - 1.4) / 2, z, 0.34, TB.top - 1.4, 0.34, 1)
}

/* ---------------------------------------------------------------------------
 * Floors, ceilings, the roof
 * ------------------------------------------------------------------------- */

/** Where the floors are carpeted: [x0, x1, z0, z1, y, tint]. */
const CARPETS = [
  // Upstairs: the Sky Lounge, Gate 3, the east gate lounge, the VIP lounge, the leg's gates.
  [-42.6, -15.0, -50.0, -21.2, TB.l1, '#5c636e'],
  [-11.2, 11.2, -26.0, -21.0, TB.l1, '#6e7e94'],
  [14.0, 40.0, -31.6, -21.0, TB.l1, '#6e7e94'],
  [16.2, 27.7, -55.5, -46.2, TB.l1, '#5a4a3e'],
  [30.4, 42.2, -18.8, -2.4, TB.l1, '#6e7e94'],
  // Downstairs: the east gate lounge, round the seats.
  [16.4, 42.4, -30.0, -21.4, 0, '#6e7e94'],
]

/**
 * Accents in the halls: slate panelling behind the check-in desks, oak behind
 * the café counter and along the gate lounge's back, a band of dark stone
 * inside the glass fronts and along the check-in queue (each a centimetre
 * proud of what it stands on or against).
 */
function addAccents(P) {
  const slate = tm.cladding('#3e454e')
  const oak = tm.oak('#8a6440')
  const back = TB_IN.z0
  P.aabb(slate, -43.6, 0.1, back + 0.02, -26.2, 3.6, back + 0.06, 3)
  P.aabb(oak, 16.6, 0.1, back + 0.02, 25.4, 4.2, back + 0.06, 2)
  P.aabb(oak, -11.6, TB.l1 + 0.1, back + 0.02, -4.2, TB.l1 + 4.2, back + 0.06, 2)
  P.aabb(oak, 4.2, TB.l1 + 0.1, back + 0.02, 11.6, TB.l1 + 4.2, back + 0.06, 2)
  const dark = tm.stone('#46494e')
  P.aabb(dark, TB_IN.x0, GROUND_Y.floor, -21.7, LEG_IN.x0, GROUND_Y.floor + 0.008, FACADE.z - 0.011, 1.2)
  P.aabb(dark, LEG_IN.x0, GROUND_Y.floor, FACADE.z - 0.011, LEG_IN.x0 + 1.4, GROUND_Y.floor + 0.008, LEG_IN.z1, 1.2)
  P.aabb(dark, -43.6, GROUND_Y.floor, -44.4, -17.2, GROUND_Y.floor + 0.008, -43.2, 1.2)
  P.aabb(dark, 12.2, GROUND_Y.floor, -46.0, 43.6, GROUND_Y.floor + 0.008, -44.8, 1.2)
}

function addFloors(P) {
  const { x0, x1, z0 } = TB_IN
  // The ground floor: stone over the whole inside, laid a few millimetres over the apron's level.
  // (Out to just behind the glass fronts, so no strip of apron shows inside them; the leg's carries on from the main block's.)
  const stone = tm.layer('stone', 3, FLOOR)
  P.aabb(stone, x0, 0, z0, x1, GROUND_Y.floor, FACADE.z - 0.011, 1.2)
  P.aabb(stone, LEG_IN.x0 - 0.139, 0, FACADE.z - 0.011, LEG_IN.x1, GROUND_Y.floor, LEG_IN.z1, 1.2)
  // A chequered square round the planter.
  P.aabb(tm.stone('#34363a'), -6.2, GROUND_Y.floor, -42.0, 6.2, GROUND_Y.floor + 0.008, -31.6, 1.2)
  for (let i = 0; i < 10; i++) {
    for (let k = 0; k < 8; k++) {
      if ((i + k) % 2) continue
      const x = -6.2 + i * 1.24
      const z = -42.0 + k * 1.3
      P.aabb(tm.stone('#aeaba4'), x, GROUND_Y.floor + 0.008, z, x + 1.24, GROUND_Y.floor + 0.018, z + 1.3, 1.2)
    }
  }
  for (const [cx0, cx1, cz0, cz1, y, tint] of CARPETS) P.aabb(tm.carpet(tint), cx0, y + (y > 0 ? 0 : GROUND_Y.floor), cz0, cx1, y + (y > 0 ? 0.012 : GROUND_Y.floor + 0.012), cz1, 2)

  for (const s of TM_SLABS) {
    const under = s.y - TB.slab
    for (const [a0, a1, b0, b1] of s.rects) {
      // Ceiling tiles underneath, plaster for the slab's edges, the floor (or the roof's membrane) on top.
      P.aabb(tm.ceiling(CEILING), a0, under, b0, a1, under + 0.012, b1, 2.4)
      P.aabb(tm.plaster(EDGE), a0, under + 0.012, b0, a1, s.y - 0.03, b1, 3)
      P.aabb(s.roof ? tm.concrete('#7e7c78') : tm.stone(FLOOR), a0, s.y - 0.03, b0, a1, s.y, b1, s.roof ? 3 : 1.2)
    }
  }
  // The void's edge: a fascia band in front of the slab's edge (4 cm proud of it,
  // never on it), broken where the escalators and the grand stair arrive.
  const [vx0, vx1, vz0, vz1] = TM_VOID
  const band = tm.cladding(COLUMN)
  const by0 = UNDER1 - 0.05
  const bandRun = (a, b, fixed, axis, inward) => {
    const c = fixed + inward * 0.02
    if (axis === 'x') P.box(band, (a + b) / 2, (by0 + TB.l1) / 2, c, b - a, TB.l1 - by0, 0.04, 2)
    else P.box(band, c, (by0 + TB.l1) / 2, (a + b) / 2, 0.04, TB.l1 - by0, b - a, 2)
  }
  bandRun(vx0, -11.2, vz0, 'x', 1)
  bandRun(-8.8, vx1, vz0, 'x', 1)
  bandRun(vx0, 8.6, vz1, 'x', -1)
  bandRun(11.6, vx1, vz1, 'x', -1)
  bandRun(vz0, vz1, vx0, 'z', 1)
  bandRun(vz0, vz1, vx1, 'z', -1)
  // Skylights: the glass and its glazing bars (the west hall's blown in: bars, and teeth of glass).
  const bar = tm.paint('#3a3f46', 0.45, 0.6)
  const rand = seededRandom(7811)
  TM_SKYLIGHTS.forEach(([a0, a1, b0, b1], i) => {
    const shattered = i === 2
    if (!shattered) P.box(tm.glass('#c4d6e2'), (a0 + a1) / 2, TB.roof - 0.05, (b0 + b1) / 2, a1 - a0, 0.02, b1 - b0, 1)
    for (let x = a0; x <= a1 + 1e-3; x += (a1 - a0) / Math.max(1, Math.round((a1 - a0) / 2))) P.box(bar, x, TB.roof - 0.05, (b0 + b1) / 2, 0.08, 0.14, b1 - b0, 1)
    for (const z of [b0, (b0 + b1) / 2, b1]) P.box(bar, (a0 + a1) / 2, TB.roof - 0.05, z, a1 - a0, 0.14, 0.08, 1)
    if (shattered) {
      for (const z of [b0, b1]) {
        for (let x = a0; x < a1 - 0.2; x += 0.25 + rand() * 0.4) {
          const w = 0.15 + rand() * 0.3
          P.box(tm.glass('#b8ccd6'), x + w / 2, TB.roof - 0.05, z + (z === b0 ? 1 : -1) * (0.1 + rand() * 0.25), w, 0.012, 0.2 + rand() * 0.4, 1, [0, rand() * 0.6 - 0.3, 0])
        }
      }
    }
  })
}

/**
 * The holes overhead: their edges broken back into lumps of concrete, bars
 * bent down out of them, ceiling tiles hanging off, soot round them, and on
 * the floor under the roof's, what came down through it (the leg's fallen
 * slab is addCollapse's).
 */
function addHoles(P) {
  const rand = seededRandom(8111)
  const concrete = tm.concrete('#85817a')
  const steel = tm.paint('#4a3a2e', 0.8, 0.4)
  const tile = tm.ceiling(CEILING)
  const ragged = ([x0, x1, z0, z1], y) => {
    const under = y - TB.slab
    const lump = (x, z) => {
      const s = 0.25 + rand() * 0.3
      P.box(concrete, x, y - TB.slab / 2 + (rand() - 0.5) * 0.15, z, s * (0.8 + rand() * 0.6), TB.slab * (0.6 + rand() * 0.6), s * (0.8 + rand() * 0.6), 1, [rand() * 0.6, rand() * Math.PI, rand() * 0.6])
    }
    const edge = (a, b, fixed, alongX, inward) => {
      for (let t = a + 0.15; t < b; t += 0.35 + rand() * 0.25) {
        const k = fixed + inward * (0.05 + rand() * 0.2)
        if (alongX) lump(t, k)
        else lump(k, t)
        if (rand() < 0.45) {
          const from = alongX ? [t, under + 0.05, fixed] : [fixed, under + 0.05, t]
          const drop = 0.4 + rand() * 1.1
          const to = alongX ? [t + (rand() - 0.5) * 0.4, under - drop, fixed + inward * (0.2 + rand() * 0.5)] : [fixed + inward * (0.2 + rand() * 0.5), under - drop, t + (rand() - 0.5) * 0.4]
          addBar(P, steel, from, to, 0.022, 0.022)
        }
        // A ceiling tile hanging by one corner.
        if (rand() < 0.18) {
          const p = alongX ? [t, under - 0.35, fixed - inward * 0.3] : [fixed - inward * 0.3, under - 0.35, t]
          P.box(tile, p[0], p[1], p[2], 0.6, 0.012, 0.6, 1, alongX ? [1.1 * inward, rand(), 0.2] : [0.2, rand(), 1.1 * inward])
        }
      }
    }
    edge(x0, x1, z0, true, 1)
    edge(x0, x1, z1, true, -1)
    edge(z0, z1, x0, false, 1)
    edge(z0, z1, x1, false, -1)
  }
  ragged(LEG_HOLE, TB.l1)
  for (const h of ROOF_HOLES) ragged(h, TB.roof)
  // Under the Sky Lounge's roof hole: soot spread over the floor round the rubble.
  const [hx0, hx1, hz0, hz1] = ROOF_HOLES[1]
  floorScorch(P, (hx0 + hx1) / 2, TB.l1, (hz0 + hz1) / 2, 7.5, 0.4)
  floorScorch(P, (ROOF_HOLES[0][0] + ROOF_HOLES[0][1]) / 2 + 3.2, TB.l1, ROOF_HOLES[0][2] - 2.0, 4.0, 1.2)
}

/**
 * The leg's fallen slab: broken off along its north edge and come down in one
 * piece onto the ground floor. Its floor on top (scattered with what was on
 * it), the ceiling tiles underneath torn and hanging, bars out of its broken
 * ends, and the rubble it landed in.
 */
function addCollapse(P) {
  const rand = seededRandom(8211)
  const c = COLLAPSE
  const r = rampBox(c.top, c.bottom, c.width, c.thick)
  const q = quatOf(r.q)
  // The slab, and its floor on top (inset, 1 cm proud of it).
  P.box(tm.concrete('#8a867f'), r.p[0], r.p[1], r.p[2], r.size[0], r.size[1], r.size[2], 2, q)
  const lift = c.thick / 2 + 0.006
  const n = [Math.sin(r.angle) * Math.sin(r.yaw), Math.cos(r.angle), Math.sin(r.angle) * Math.cos(r.yaw)]
  P.box(tm.stone(FLOOR), r.p[0] + n[0] * lift, r.p[1] + n[1] * lift, r.p[2] + n[2] * lift, r.size[0] - 0.3, 0.012, r.size[2] - 0.5, 1.2, q)
  // Ceiling tiles under it, half torn away.
  const down = c.thick + 0.008
  for (let i = 0; i < 9; i++) {
    const f = (i + 0.5) / 9
    if (rand() < 0.35) continue
    const p = [c.top[0] + (c.bottom[0] - c.top[0]) * f + (rand() - 0.5) * 3.6, c.top[1] + (c.bottom[1] - c.top[1]) * f, c.top[2] + (c.bottom[2] - c.top[2]) * f]
    P.box(tm.ceiling(CEILING), p[0] - n[0] * down, p[1] - n[1] * down, p[2] - n[2] * down, 1.2, 0.012, 0.8, 1, q)
  }
  // Bars still holding it to the edge it broke from, and out of its foot.
  const steel = tm.paint('#4a3a2e', 0.8, 0.4)
  for (let x = -c.width / 2 + 0.3; x < c.width / 2; x += 0.35 + rand() * 0.2) {
    addBar(P, steel, [c.top[0] + x, UNDER1 + 0.06, c.top[2] - 0.04], [c.top[0] + x + (rand() - 0.5) * 0.3, UNDER1 - 0.25 - rand() * 0.3, c.top[2] + 0.35 + rand() * 0.4], 0.022, 0.022)
    if (rand() < 0.6) addBar(P, steel, [c.bottom[0] + x, 0.1, c.bottom[2] - 0.1], [c.bottom[0] + x + (rand() - 0.5) * 0.3, 0.05 + rand() * 0.4, c.bottom[2] + 0.3 + rand() * 0.7], 0.022, 0.022)
  }
  // Rubble round its foot and down its sides (low: drawn, not solid).
  const concrete = tm.concrete('#8e8a82')
  for (let i = 0; i < 60; i++) {
    const side = i % 2 ? 1 : -1
    const along = rand()
    const x = c.bottom[0] + side * (c.width / 2 + rand() * 0.9) * (i < 40 ? 1 : rand())
    const z = c.top[2] + (c.bottom[2] + 1.4 - c.top[2]) * (i < 40 ? along : 0.85 + along * 0.15)
    const s = 0.1 + rand() * 0.28
    P.box(concrete, x, GROUND_Y.floor + s * 0.3, z, s * 1.3, s * 0.8, s, 1, [rand() * 0.5, rand() * Math.PI, rand() * 0.5])
  }
  floorScorch(P, c.bottom[0], GROUND_Y.floor, c.bottom[2] - 1.0, 6.0, 0.3)
}

/**
 * The lights: strips under the upper floor and downlights under the roof,
 * nearly all dead (the power's off), a few still lit off the emergency
 * supply, the red emergency lamps; some strips hanging down out of the
 * ceiling by one end.
 */
function addLights(P) {
  const lit = tm.glow('#f4ead6')
  const dead = tm.paint('#55524c', 0.5)
  const red = tm.glow('#ff2a14')
  const rand = seededRandom(7711)
  const inVoid = (x, z) => x > TM_VOID[0] - 0.5 && x < TM_VOID[1] + 0.5 && z > TM_VOID[2] - 0.5 && z < TM_VOID[3] + 0.5
  const under = (rects, x, z, m) => rects.some(([a0, a1, b0, b1]) => x > a0 + m && x < a1 - m && z > b0 + m && z < b1 - m)
  // Ground floor: strips under the upper slab (main block and leg).
  for (const [ox0, ox1, oz0, oz1] of [
    [TB_IN.x0, TB_IN.x1, TB_IN.z0, TB_IN.z1],
    [LEG_IN.x0, LEG_IN.x1, TB_IN.z1 + 1.0, LEG_IN.z1],
  ]) {
    for (let x = ox0 + 4; x < ox1 - 2; x += 4.8) {
      for (let z = oz0 + 3; z < oz1 - 1.5; z += 4.0) {
        if (inVoid(x, z) || !under(TM_SLABS[0].rects, x, z, 1.0)) continue
        const k = rand()
        if (k < 0.08) {
          // Hanging by one end.
          P.box(dead, x + 0.6, UNDER1 - 0.65, z, 0.18, 1.6, 0.18, 1, [0, 0, 0.5 + rand() * 0.3])
          addBar(P, tm.paint('#2a2a2a', 0.6), [x - 0.3, UNDER1, z], [x + 0.25, UNDER1 - 0.2, z], 0.012, 0.012)
          continue
        }
        P.box(k < 0.2 ? lit : dead, x, UNDER1 - 0.008, z, 1.8, 0.012, 0.18, 1)
      }
    }
  }
  // Upstairs: downlights under the roof.
  const disc = new CylinderGeometry(0.16, 0.16, 0.02, 12)
  const holes = [...TM_SKYLIGHTS, ...ROOF_HOLES]
  for (const [ox0, ox1, oz0, oz1] of [
    [TB_IN.x0, TB_IN.x1, TB_IN.z0, TB_IN.z1],
    [LEG_IN.x0, LEG_IN.x1, TB_IN.z1 + 1.0, LEG_IN.z1],
  ]) {
    for (let x = ox0 + 3; x < ox1 - 2; x += 4.0) {
      for (let z = oz0 + 2.5; z < oz1 - 1.0; z += 4.0) {
        if (inVoid(x, z) || holes.some(([a0, a1, b0, b1]) => x > a0 - 0.6 && x < a1 + 0.6 && z > b0 - 0.6 && z < b1 + 0.6)) continue
        P.add(rand() < 0.12 ? lit : dead, disc, [x + (rand() - 0.5) * 0.2, UNDER2 - 0.012, z])
      }
    }
  }
  // Red emergency lamps on the ceilings by the doors and along the halls: [x, z, upstairs].
  const lamps = [
    [-35.5, -20.9, 0], [-10.4, -20.9, 0], [10.4, -20.9, 0], [-43.2, -35.0, 0], [43.2, -28.0, 0], [43.2, -11.4, 0],
    [28.9, -8.2, 0], [28.9, 4.6, 0], [31.8, 11.2, 0], [-22.4, -48.6, 0], [0.0, -55.2, 0], [-24.0, -55.2, 0], [24.0, -55.2, 0],
    [-6.0, -20.9, 1], [-30.0, -55.2, 1], [20.0, -55.2, 1], [43.2, -48.0, 1], [36.0, 11.2, 1], [43.2, -4.0, 1], [-43.2, -36.0, 1], [0.0, -49.4, 1],
  ]
  for (const [x, z, up] of lamps) {
    const y = (up ? UNDER2 : UNDER1) - 0.07
    P.box(tm.paint('#2a2a2c', 0.5), x, y, z, 0.32, 0.14, 0.32, 1)
    P.box(red, x, y - 0.09, z, 0.24, 0.05, 0.24, 1)
  }
}

/* ---------------------------------------------------------------------------
 * The hall: roof trusses, the sculpture, banners, screens
 * ------------------------------------------------------------------------- */

function addHall(P) {
  const orange = tm.paint('#d86a2a', 0.5, 0.4)
  const [vx0, vx1] = TM_VOID
  // Trusses across the void under the skylights: a top and bottom chord and a zigzag of struts.
  for (const z of [-42.6, -38.6, -34.6, -30.6, -28.2]) {
    const top = UNDER2 - 0.12
    const bottom = UNDER2 - 1.0
    addBar(P, orange, [vx0 - 0.4, top, z], [vx1 + 0.4, top, z], 0.18, 0.22)
    addBar(P, orange, [vx0 + 0.6, bottom, z], [vx1 - 0.6, bottom, z], 0.14, 0.16)
    const n = 12
    for (let i = 0; i < n; i++) {
      const xa = vx0 + 0.6 + ((vx1 - vx0 - 1.2) * i) / n
      const xb = vx0 + 0.6 + ((vx1 - vx0 - 1.2) * (i + 1)) / n
      addBar(P, orange, [xa, bottom, z], [xb, top, z], 0.07, 0.07)
      addBar(P, orange, [xb, top, z], [xb, bottom, z], 0.06, 0.06)
    }
  }
  // The sculpture: white petals hung in a ring over the departures board.
  const white = tm.paint('#f4f4f2', 0.35)
  const cx = 0
  const cz = -30.6
  const cy = 7.4
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2
    const r = 1.4
    const p0 = [cx + Math.cos(a) * 0.3, cy - 1.0, cz + Math.sin(a) * 0.3]
    const p1 = [cx + Math.cos(a) * r, cy + 0.4, cz + Math.sin(a) * r]
    const p2 = [cx + Math.cos(a + 0.2) * r * 0.7, cy + 1.3, cz + Math.sin(a + 0.2) * r * 0.7]
    addBar(P, white, p0, p1, 0.05, 0.22)
    addBar(P, white, p1, p2, 0.05, 0.18)
  }
  P.add(white, new TorusGeometry(1.0, 0.04, 6, 24), [cx, cy + 0.9, cz], [Math.PI / 2, 0, 0])
  for (const k of [-0.6, 0.6]) addBar(P, tm.paint('#8a8c90', 0.4, 0.8), [cx + k, cy + 1.3, cz], [cx + k, UNDER2 - 1.0, cz], 0.015, 0.015)
  // Blue banners hanging down the void's north side (clear of the escalators).
  for (let i = 0; i < 4; i++) {
    const x = -6.0 + i * 3.6
    P.box(tm.paint('#2f6fc8', 0.7), x, UNDER2 - 2.6, -43.2, 0.9, 3.2, 0.02, 1)
    P.box(tm.paint('#f4f4f2', 0.7), x, UNDER2 - 4.32, -43.2, 0.9, 0.24, 0.025, 1)
  }
  // Adverts on the back wall upstairs (seen across the hall) and in the east hall.
  addScreen(P, [-8.0, TB.l1 + 2.2, TB_IN.z0 + 0.06], 3.6, 1.2, 0, 0)
  addScreen(P, [8.0, TB.l1 + 2.2, TB_IN.z0 + 0.06], 3.6, 1.2, 0, 1)
  addScreen(P, [36.0, 2.9, -48.16], 3.0, 1.0, Math.PI, 2)
  addScreen(P, [-30.0, 3.0, TB_IN.z0 + 0.06], 3.6, 1.2, 0, 1)
}

/** An advert screen (a third of the advert atlas) in a black bezel. */
function addScreen(P, p, w, h, yaw, which) {
  const s = Math.sin(yaw)
  const c = Math.cos(yaw)
  P.box(tm.paint('#141416', 0.4), p[0], p[1], p[2], Math.abs(c) * (w + 0.1) + Math.abs(s) * 0.08, h + 0.1, Math.abs(s) * (w + 0.1) + Math.abs(c) * 0.08, 1)
  const g = new PlaneGeometry(w, h)
  const uv = g.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setX(i, (which + uv.getX(i)) / 3)
  P.add(tm.adverts(), g, [p[0] + s * 0.045, p[1], p[2] + c * 0.045], [0, yaw, 0])
}

/* ---------------------------------------------------------------------------
 * Columns, stairs, escalators, balustrades
 * ------------------------------------------------------------------------- */

function addColumns(P) {
  const white = tm.cladding(COLUMN)
  const dark = tm.paint('#26282c', 0.4, 0.2)
  for (const [x, z, s] of TM_COLUMNS) {
    if (s < 0.8) {
      // Behind the glass: dark steel.
      P.box(tm.paint('#3a3f46', 0.45, 0.6), x, UNDER2 / 2, z, s, UNDER2, s, 1)
      continue
    }
    P.box(white, x, UNDER2 / 2, z, s, UNDER2, s, 3)
    // A dark band at head height on each floor, a base, and a screen on some.
    for (const y of [0, TB.l1]) {
      P.box(dark, x, y + 0.06, z, s + 0.02, 0.12, s + 0.02, 1)
      P.box(dark, x, y + 2.55, z, s + 0.02, 0.5, s + 0.02, 1)
    }
  }
  // Departures screens on the hall's corner columns, facing into the hall.
  for (const [x, z, yaw] of [[-12.47, -26.53, Math.PI], [12.47, -26.53, Math.PI], [-12.47, -44.47, 0], [12.47, -44.47, 0]]) {
    const s = Math.sin(yaw)
    const c = Math.cos(yaw)
    const p = [x - s * 0.47, 3.3, z + c * 0.47]
    P.box(tm.paint('#141416', 0.4), p[0], p[1], p[2], 1.3, 0.8, 0.06, 1)
    P.add(tm.board(), new PlaneGeometry(1.2, 0.72), [p[0] - s * 0.032, p[1], p[2] + c * 0.032], [0, yaw, 0])
  }
}

function addFlights(P) {
  for (const fl of TM_FLIGHTS) {
    const p = flightParts(fl)
    const alongX = Math.abs(p.ux) > 0.5
    if (p.escalator) addEscalator(P, fl, p)
    else {
      const tread = fl.outside ? tm.concrete('#bdbab2') : tm.stone('#eeeeec')
      const N = Math.max(4, Math.round(p.rise / 0.18))
      for (let i = 0; i < N; i++) {
        const top = fl.bottom[1] + (p.rise * (i + 1)) / N
        const f = (i + 0.5) / N
        const cx = fl.bottom[0] + p.ux * p.run * f
        const cz = fl.bottom[2] + p.uz * p.run * f
        const len = p.run / N
        P.box(tread, cx, top / 2, cz, alongX ? len + 0.002 : fl.width, top, alongX ? fl.width : len + 0.002, 1.2)
        // A dark nosing on each tread.
        const nx = cx - p.ux * (len / 2 - 0.02)
        const nz = cz - p.uz * (len / 2 - 0.02)
        P.box(tm.paint('#3a3c40', 0.6), nx, top + 0.004, nz, alongX ? 0.04 : fl.width - 0.06, 0.008, alongX ? fl.width - 0.06 : 0.04, 1)
      }
      for (const r of p.rails) addSlopedRail(P, fl, p, r.off, fl.glass)
    }
  }
  for (const L of TM_LANDINGS) {
    P.aabb(tm.concrete('#bdbab2'), L.x0, 0, L.z0, L.x1, L.y, L.z1, 2)
    for (const [ax, az, bx, bz] of L.rails) addRail(P, tm.paint('#5a5e64', 0.5, 0.6), [ax, az], [bx, bz], L.y, 1.05)
  }
}

/** A balustrade up a flight at `off` from its middle: glass with a steel handrail, or posts and rails. */
function addSloppedPost(P, material, p, h) {
  P.box(material, p[0], p[1] + h / 2, p[2], 0.04, h, 0.04, 1)
}
function addSlopedRail(P, fl, p, off, glass) {
  const at = (f, lift) => [fl.bottom[0] + p.ux * p.run * f - p.uz * off, fl.bottom[1] + p.rise * f + lift, fl.bottom[2] + p.uz * p.run * f + p.ux * off]
  const steel = tm.paint(glass ? '#c8ccd0' : '#5a5e64', 0.35, 0.8)
  if (glass) {
    const r = rampBox(at(1, 1.0), at(0, 1.0), 0.02, 0.92)
    P.box(tm.glass(), r.p[0], r.p[1], r.p[2], 0.02, 0.92, r.size[2], 1, quatOf(r.q))
    addBar(P, steel, at(0, 1.02), at(1, 1.02), 0.06, 0.05)
    addBar(P, steel, at(0, 0.06), at(1, 0.06), 0.06, 0.06)
  } else {
    for (let f = 0.03; f <= 1.001; f += Math.max(0.1, 1 / Math.ceil(p.run))) addSloppedPost(P, steel, at(f, 0), 1.0)
    for (const h of [1.0, 0.5]) addBar(P, steel, at(0, h), at(1, h), 0.045, 0.045)
  }
}

const quatOf = (q) => ({ isQuaternion: true, x: q[0], y: q[1], z: q[2], w: q[3] })

function addEscalator(P, fl, p) {
  const steel = tm.brushed('#d0d4d8')
  const at = (f, off, lift) => [fl.bottom[0] + p.ux * p.run * f - p.uz * off, fl.bottom[1] + p.rise * f + lift, fl.bottom[2] + p.uz * p.run * f + p.ux * off]
  // The steps: ribbed aluminium on top of the truss.
  const steps = rampBox(at(1, 0, 0), at(0, 0, 0), fl.width - 0.24, 0.04)
  P.box(tm.rib('#9a9ea4'), steps.p[0], steps.p[1], steps.p[2], steps.size[0], 0.04, steps.size[2], 1, quatOf(steps.q))
  // The truss: brushed steel sides and underside.
  const truss = rampBox(at(1, 0, -0.04), at(0, 0, -0.04), fl.width, 0.56)
  P.box(steel, truss.p[0], truss.p[1], truss.p[2], truss.size[0], truss.size[1], truss.size[2], 2, quatOf(truss.q))
  // Balustrades: glass with black rubber handrails, on both sides and between the lanes.
  for (const r of p.rails) {
    const glass = rampBox(at(1, r.off, 0.95), at(0, r.off, 0.95), 0.02, 0.85)
    P.box(tm.glass(), glass.p[0], glass.p[1], glass.p[2], 0.02, 0.85, glass.size[2], 1, quatOf(glass.q))
    addBar(P, tm.rubber(), at(-0.03, r.off, 1.0), at(1.03, r.off, 1.0), 0.1, 0.07)
    addBar(P, steel, at(0, r.off, 0.1), at(1, r.off, 0.1), 0.1, 0.18)
  }
  // Comb plates at the foot and the head.
  const plate = tm.brushed('#bfc3c8')
  for (const f of [0, 1]) {
    const q = at(f, 0, 0)
    const k = f === 0 ? -1 : 1
    // On top of the floor it meets (the ground floor's stone is a few cm up).
    const y = (f === 0 ? fl.bottom[1] + GROUND_Y.floor : fl.top[1]) + 0.006
    P.box(plate, q[0] + p.ux * k * 0.5, y, q[2] + p.uz * k * 0.5, Math.abs(p.ux) > 0.5 ? 1.0 : fl.width, 0.012, Math.abs(p.ux) > 0.5 ? fl.width : 1.0, 1)
  }
}

function addRails(P) {
  const steel = tm.paint('#c8ccd0', 0.35, 0.8)
  for (const [ax, az, bx, bz, y, glass] of TM_RAILS) {
    if (!glass) {
      addRail(P, tm.paint('#5a5e64', 0.5, 0.6), [ax, az], [bx, bz], y, 1.05)
      continue
    }
    addGlazing(P, [ax, az], [bx, bz], y + 0.06, y + 1.0, { pitch: 1.5, frame: '#c8ccd0', post: 0.04, depth: 0.04, rails: false })
    addBar(P, steel, [ax, y + 1.03, az], [bx, y + 1.03, bz], 0.07, 0.05)
    addBar(P, steel, [ax, y + 0.03, az], [bx, y + 0.03, bz], 0.08, 0.06)
  }
}

/* ---------------------------------------------------------------------------
 * Furniture and fittings
 * ------------------------------------------------------------------------- */

/** Beam seating: a steel beam on legs, the seats along it (backs on local +z side). */
function seatRow(P, w, d, tint = '#2a4d7a') {
  const n = Math.max(1, Math.round(w / 0.6))
  const steel = tm.paint('#b8bcc0', 0.35, 0.8)
  const fabric = tm.fabric(tint)
  P.box(steel, 0, 0.36, 0.05, w, 0.06, 0.08, 1)
  for (const x of [-w / 2 + 0.25, w / 2 - 0.25]) P.box(steel, x, 0.18, 0.05, 0.06, 0.36, d * 0.8, 1)
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (w * (i + 0.5)) / n
    const sw = w / n - 0.06
    P.box(fabric, x, 0.45, -0.02, sw, 0.08, d * 0.7, 1)
    P.box(fabric, x, 0.68, d / 2 - 0.08, sw, 0.46, 0.08, 1, [0.12, 0, 0])
    if (i < n - 1) P.box(steel, x + w / n / 2, 0.6, 0.0, 0.04, 0.05, d * 0.6, 1)
  }
}

const FURNITURE_ART = {
  seats: (P, [w, , d]) => seatRow(P, w, d),
  desk: (P, [w, h, d]) => {
    P.box(tm.plaster('#f4f4f2'), 0, h / 2, 0, w, h, d, 2)
    P.box(tm.oak('#c79a62'), 0, h + 0.02, 0, w + 0.04, 0.04, d + 0.04, 1)
    // The airline's blue strip and the monitors.
    P.box(tm.paint('#163d7a', 0.5), 0, h - 0.2, d / 2 + 0.005, w, 0.12, 0.01, 1)
    for (const x of [-w / 4, w / 4]) {
      P.box(tm.paint('#1c1d20', 0.4), x, h + 0.25, -0.1, 0.42, 0.3, 0.04, 1)
      P.box(tm.paint('#8a8c90', 0.4, 0.6), x, h + 0.08, -0.1, 0.04, 0.12, 0.04, 1)
    }
  },
  belt: (P, [w, h, d]) => {
    P.box(tm.paint('#8d9196', 0.4, 0.7), 0, (h - 0.08) / 2, 0, w, h - 0.08, d, 1)
    P.box(tm.rubber(), 0, h - 0.04, 0, w - 0.06, 0.08, d - 0.1, 1)
  },
  kiosk: (P, [w, h, d]) => {
    P.box(tm.plaster('#f4f4f2'), 0, h / 2, 0, w, h, d, 1)
    P.box(tm.paint('#163d7a', 0.5), 0, h - 0.06, 0, w + 0.01, 0.12, d + 0.01, 1)
    P.box(tm.glow('#bfe3ff'), 0, h - 0.42, -d / 2 - 0.006, w * 0.7, 0.36, 0.01, 1)
  },
  xray: (P, [w, h, d]) => {
    // Roller tables either side of the tunnel.
    P.box(tm.paint('#8d9196', 0.4, 0.7), 0, (h - 0.06) / 2, 0, w, h - 0.06, d * 0.9, 1)
    for (let x = -w / 2 + 0.1; x < w / 2; x += 0.12) P.box(tm.brushed('#d0d4d8'), x, h - 0.03, 0, 0.05, 0.05, d, 1)
  },
  tunnel: (P, [w, h, d]) => {
    P.box(tm.plaster('#e2e4e6'), 0, h / 2 + 0.15, 0, w, h - 0.3, d, 1)
    P.box(tm.paint('#2a4d7a', 0.5), 0, 0.15, 0, w - 0.1, 0.3, d - 0.1, 1)
    P.box(tm.rubber(), 0, 0.95, 0, w + 0.01, 0.6, d - 0.3, 1)
    P.box(tm.paint('#1c1d20', 0.4), 0, h + 0.2, 0, 0.5, 0.35, 0.06, 1)
  },
  basins: (P, [w, h, d]) => {
    P.box(tm.stone('#d8d8dc'), 0, h - 0.05, 0, w, 0.1, d, 1)
    P.box(tm.plaster('#e8e8e6'), 0, (h - 0.1) / 2, 0.05, w - 0.1, h - 0.1, d - 0.1, 1)
    for (let z = -d / 2 + 0.5; z < d / 2; z += 0.9) P.add(tm.paint('#f6f6f6', 0.2), new CylinderGeometry(0.18, 0.14, 0.12, 12), [0, h - 0.02, z])
    // The mirror on the wall behind.
    P.box(tm.paint('#9fb2c0', 0.08, 0.9), w / 2 + 0.005, h + 0.75, 0, 0.01, 0.9, d - 0.2, 1)
  },
  stall: (P, [w, h, d]) => {
    P.box(tm.paint('#5e7a8a', 0.5), 0, h / 2 + 0.15, 0, w, h - 0.3, d, 1)
    P.box(tm.paint('#8d9196', 0.4, 0.7), 0, 0.075, d / 2 - 0.05, 0.05, 0.15, 0.05, 1)
  },
  planter: (P, [w, h, d], f, rand) => {
    P.box(tm.oak('#b9874f'), 0, h / 2, 0, w, h, d, 1)
    P.box(tm.paint('#3e2e22', 0.95), 0, h + 0.002, 0, w - 0.16, 0.01, d - 0.16, 1)
    if (w > 6) {
      // The hall's palm in the middle, with bushes round it.
      addPalm(P, [0, h, 0], 8.0, 0.08, 9101, { fronds: 13, coconuts: false })
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2
        addBush(P, [Math.cos(a) * (w / 2 - 0.8), h, Math.sin(a) * (d / 2 - 0.8)], 0.7 + rand() * 0.3, 9200 + i)
      }
    } else {
      for (let x = -w / 2 + 0.5; x < w / 2; x += 0.9) addBush(P, [x, h, 0], 0.55 + rand() * 0.2, 9300 + Math.round(x * 10 + f.p[2]))
    }
  },
  board: (P, [w, h, d]) => {
    P.box(tm.paint('#2a2c30', 0.4, 0.3), 0, 0.5, 0, 0.6, 1.0, 0.4, 1)
    P.box(tm.paint('#141416', 0.4), 0, h - 0.85, 0, w, 1.6, d, 1)
    for (const s of [-1, 1]) P.add(tm.board(), new PlaneGeometry(w - 0.12, 1.5), [0, h - 0.85, s * (d / 2 + 0.004)], [0, s > 0 ? 0 : Math.PI, 0])
  },
  info: (P, [w, h, d]) => {
    P.box(tm.oak('#c79a62'), 0, h / 2, 0, w, h, d, 2)
    P.box(tm.stone('#f6f6f4'), 0, h + 0.02, 0, w + 0.06, 0.04, d + 0.06, 1)
    P.box(tm.paint('#1c1d20', 0.4), 0, h + 0.2, 0, 0.5, 0.32, 0.04, 1)
    // The i on a pole at one end.
    P.box(tm.paint('#8a8c90', 0.4, 0.8), w / 2 - 0.25, h + 0.6, 0, 0.04, 1.2, 0.04, 1)
    addSignBox(P, 'info', [w / 2 - 0.25, h + 1.43, 0], 0.45, 0.45, 0, 2, 0)
  },
  cart: (P, [w, h, d]) => {
    const steel = tm.paint('#b8bcc0', 0.35, 0.8)
    for (let z = -d / 2 + 0.3; z < d / 2; z += 0.3) {
      P.box(steel, 0, 0.32, z, w, 0.04, 0.5, 1)
      P.box(steel, 0, h - 0.1, z + 0.25, w, 0.04, 0.04, 1)
      for (const x of [-w / 2 + 0.03, w / 2 - 0.03]) addBar(P, steel, [x, 0.12, z - 0.2], [x, h, z + 0.25], 0.03, 0.03)
    }
  },
  shelf: (P, [w, h, d]) => {
    P.box(tm.paint('#d8d8d4', 0.6), 0, h / 2, 0, w, h, d, 1)
    // Goods on whichever long face (both, on an island).
    const g = new PlaneGeometry(Math.max(w, d) - 0.06, h - 0.1)
    const uv = g.getAttribute('uv')
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * (Math.max(w, d) - 0.06)) / 1.2, (uv.getY(i) * (h - 0.1)) / 1.2)
    if (w >= d) for (const s of [-1, 1]) P.add(tm.goods(), g, [0, h / 2 + 0.04, s * (d / 2 + 0.004)], [0, s > 0 ? 0 : Math.PI, 0])
    else for (const s of [-1, 1]) P.add(tm.goods(), g, [s * (w / 2 + 0.004), h / 2 + 0.04, 0], [0, (s * Math.PI) / 2, 0])
  },
  counter: (P, [w, h, d]) => {
    P.box(tm.oak('#8a5a32'), 0, (h - 0.05) / 2, 0, w, h - 0.05, d, 2)
    P.box(tm.stone('#2a2c30'), 0, h - 0.025, 0, w + 0.06, 0.05, d + 0.06, 1)
    P.box(tm.paint('#d8a24a', 0.4, 0.8), 0, 0.06, d / 2 + 0.005, w, 0.04, 0.01, 1)
  },
  table: (P, [w, h]) => {
    P.add(tm.stone('#f2f2f0'), new CylinderGeometry(w / 2, w / 2, 0.04, 16), [0, h - 0.02, 0])
    P.box(tm.paint('#2a2c30', 0.4, 0.6), 0, (h - 0.04) / 2, 0, 0.06, h - 0.04, 0.06, 1)
    P.add(tm.paint('#2a2c30', 0.4, 0.6), new CylinderGeometry(0.24, 0.24, 0.03, 12), [0, 0.015, 0])
    // Chairs round it (drawn only).
    for (const a of [0.4, 2.0, 3.6, 5.2]) {
      const x = Math.cos(a) * (w / 2 + 0.38)
      const z = Math.sin(a) * (w / 2 + 0.38)
      P.box(tm.paint('#7a4a2e', 0.6), x, 0.45, z, 0.42, 0.05, 0.42, 1)
      P.box(tm.paint('#2a2c30', 0.4, 0.6), x, 0.22, z, 0.04, 0.44, 0.04, 1)
      P.box(tm.paint('#7a4a2e', 0.6), x + Math.cos(a) * 0.2, 0.72, z + Math.sin(a) * 0.2, Math.abs(Math.sin(a)) * 0.4 + 0.04, 0.5, Math.abs(Math.cos(a)) * 0.4 + 0.04, 1)
    }
  },
  sofa: (P, [w, , d]) => {
    const leather = tm.paint('#3a3230', 0.55)
    P.box(leather, 0, 0.22, 0, w, 0.44, d, 1)
    P.box(leather, 0, 0.62, d / 2 - 0.12, w, 0.46, 0.24, 1)
    for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) P.box(leather, x, 0.55, 0, 0.2, 0.3, d, 1)
    P.box(tm.paint('#5a4a44', 0.7), 0, 0.47, -0.08, w - 0.3, 0.08, d - 0.3, 1)
  },
  podium: (P, [w, h, d]) => {
    P.box(tm.plaster('#f4f4f2'), 0, h / 2, 0, w, h, d, 2)
    P.box(tm.paint('#163d7a', 0.5), 0, h - 0.1, -d / 2 - 0.005, w, 0.14, 0.01, 1)
    addSign(P, 'gate3', [0, h + 0.35, 0.2], 1.2, 0.3, 0)
    addSign(P, 'gate3', [0, h + 0.35, 0.19], 1.2, 0.3, Math.PI)
    P.box(tm.paint('#1c1d20', 0.4), 0, h + 0.35, 0.195, 1.26, 0.36, 0.006, 1)
  },
  // The hideout's: camp beds, the radio table.
  cot: (P, [w, h, d], f, rand) => {
    const steel = tm.paint('#4e5a3e', 0.6, 0.4)
    for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) for (const z of [-d / 2 + 0.05, d / 2 - 0.05]) P.box(steel, x, (h - 0.06) / 2, z, 0.04, h - 0.06, 0.04, 1)
    P.box(tm.fabric('#5a6448'), 0, h - 0.04, 0, w, 0.06, d, 1)
    // A rumpled blanket and a pillow.
    P.box(tm.fabric('#6a5a48'), w * 0.12, h + 0.03, 0, w * 0.66, 0.07, d * 0.95, 1, [0, (rand() - 0.5) * 0.1, (rand() - 0.5) * 0.05])
    P.box(tm.fabric('#c8c0b0'), -w / 2 + 0.25, h + 0.05, 0, 0.35, 0.1, d * 0.7, 1)
  },
  radioTable: (P, [w, h, d], f, rand) => {
    const wood = tm.oak('#7a5a3a')
    P.box(wood, 0, h - 0.025, 0, w, 0.05, d, 1)
    for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) for (const z of [-d / 2 + 0.06, d / 2 - 0.06]) P.box(wood, x, (h - 0.05) / 2, z, 0.05, h - 0.05, 0.05, 1)
    // The field radio, its handset, a map spread out, a lamp still lit, papers.
    P.box(tm.paint('#3e4a30', 0.7, 0.2), 0, h + 0.17, -d / 4, 0.42, 0.34, 0.5, 1)
    P.box(tm.paint('#1c1d20', 0.5), 0.12, h + 0.25, -d / 4 + 0.26, 0.12, 0.14, 0.02, 1)
    P.box(tm.glow('#ffb84a'), -0.1, h + 0.28, -d / 4 + 0.255, 0.05, 0.03, 0.01, 1)
    addBar(P, tm.paint('#2a2c30', 0.5), [0.15, h + 0.34, -d / 4 - 0.1], [0.2, h + 0.9, -d / 4 - 0.15], 0.012, 0.012)
    P.box(tm.paint('#c8bc96', 0.9), 0, h + 0.002, d / 4, w * 0.8, 0.004, 0.7, 1, [0, (rand() - 0.5) * 0.3, 0])
    P.add(tm.paint('#2a2c30', 0.5), new CylinderGeometry(0.06, 0.08, 0.25, 10), [-w / 2 + 0.2, h + 0.125, d / 2 - 0.2])
    P.add(tm.glow('#ffd28a'), new SphereGeometry(0.07, 10, 8), [-w / 2 + 0.2, h + 0.3, d / 2 - 0.2])
  },
  // A planter knocked over: the pot on its side, the soil spilled out and the plant lying in it.
  potFallen: (P, [w, h, d], f, rand) => {
    const r = Math.min(w, h) / 2
    P.add(tm.oak('#8a6a46'), new CylinderGeometry(r, r * 0.8, d, 12, 1, true), [0, r, 0], [Math.PI / 2, 0, 0])
    P.add(tm.paint('#2e2620', 0.95), new CylinderGeometry(r * 0.96, r * 0.96, 0.02, 12), [0, r, -d / 2 + 0.03], [Math.PI / 2, 0, 0])
    P.add(tm.oak('#7a5a3e'), new CylinderGeometry(r * 0.8, r * 0.8, 0.03, 12), [0, r, d / 2 - 0.015], [Math.PI / 2, 0, 0])
    // The soil fanning out of its mouth, and the plant (the palms' bush) lying in it.
    for (let i = 0; i < 7; i++) P.box(tm.paint('#3a2e24', 0.95), (rand() - 0.5) * 0.9, 0.03, -d / 2 - 0.2 - rand() * 0.7, 0.3 + rand() * 0.3, 0.06, 0.3 + rand() * 0.3, 1, [0, rand() * 3, 0])
    addBush(P, [(rand() - 0.5) * 0.3, 0.15, -d / 2 - 0.65], 0.55, 9500 + Math.round(f.p[0] * 10))
    // Shards of a smaller pot that went with it.
    for (let i = 0; i < 5; i++) P.box(tm.oak('#8a6a46'), 0.6 + rand() * 0.5, 0.02, (rand() - 0.5) * 0.8, 0.12, 0.03, 0.08, 1, [0.4, rand() * 3, 0.2])
  },
  // A table thrown on its side for cover: the round top on edge, the column and foot sticking out; a chair over.
  tableBroken: (P, [w, h], f, rand) => {
    P.add(tm.stone('#b8b6b0'), new CylinderGeometry(h / 2, h / 2, 0.04, 18), [0, h / 2, 0], [Math.PI / 2, 0, 0])
    P.box(tm.paint('#2a2c30', 0.4, 0.6), 0, h / 2, 0.36, 0.06, 0.06, 0.7, 1)
    P.add(tm.paint('#2a2c30', 0.4, 0.6), new CylinderGeometry(0.24, 0.24, 0.03, 12), [0, h / 2, 0.72], [Math.PI / 2, 0, 0])
    // A chair on its back beside it, another's broken leg.
    P.withFrame([w / 2 + 0.35, 0, 0.2], rand() * 3, (Q) => {
      Q.box(tm.paint('#7a4a2e', 0.6), 0, 0.22, 0, 0.42, 0.05, 0.42, 1, [1.3, 0, 0])
      Q.box(tm.paint('#7a4a2e', 0.6), 0, 0.03, 0.3, 0.42, 0.05, 0.5, 1)
      Q.box(tm.paint('#2a2c30', 0.4, 0.6), 0, 0.2, -0.2, 0.04, 0.04, 0.44, 1, [0.2, 0, 0])
    })
    P.box(tm.paint('#2a2c30', 0.4, 0.6), -w / 2 - 0.3, 0.02, 0.3, 0.04, 0.04, 0.44, 1, [0, rand() * 3, 0])
  },
  // A shelf unit fallen back against the wall, its goods spilled at its foot.
  shelfFallen: (P, [w, h, d], f, rand) => {
    P.box(tm.paint('#d8d8d4', 0.6), 0, h / 2, 0, w, h + 0.1, 0.4, 1, [-0.28, 0, 0.05])
    P.add(tm.goods(), new PlaneGeometry(w - 0.1, h - 0.1), [0, h / 2 + 0.05, 0.21], [-0.28, 0, 0.05])
    for (let i = 0; i < 8; i++) P.box(tm.paint(['#c84a3a', '#3a6ac8', '#e8c22a', '#f2f2ee'][i % 4], 0.6), (rand() - 0.5) * w, 0.06, d / 2 + 0.2 + rand() * 0.5, 0.2, 0.12, 0.14, 1, [0, rand() * 3, 0])
  },
  // The fighting's furniture.
  sandbags: (P, [w, h, d], f, rand) => {
    // Courses of bags along the wall's long side, staggered, two deep if it's thick enough.
    const alongX = w >= d
    const len = alongX ? w : d
    const deep = alongX ? d : w
    const rows = Math.max(1, Math.round(deep / 0.4))
    const courses = Math.max(1, Math.round(h / 0.15))
    const bag = 0.56
    const sack = [tm.sack('#ece0c4'), tm.sack('#d2c6a6')]
    for (let c = 0; c < courses; c++) {
      const y = c * (h / courses) + h / courses / 2
      const off = (c % 2) * bag * 0.5
      for (let r = 0; r < rows; r++) {
        const across = -deep / 2 + (deep * (r + 0.5)) / rows
        for (let a = -len / 2 + bag / 2 - off; a < len / 2 + bag / 2; a += bag) {
          // (Cut short at the wall's ends.)
          const lo = Math.max(a - bag / 2, -len / 2)
          const hi = Math.min(a + bag / 2, len / 2)
          if (hi - lo < 0.2) continue
          const m = (lo + hi) / 2
          const yaw = (rand() - 0.5) * 0.12
          // (A little short of the next bag each way, so the seams between them show.)
          const sx = (hi - lo - 0.06) * (0.96 + rand() * 0.05)
          const sy = (h / courses) * (0.9 + rand() * 0.08)
          const sz = (deep / rows) * (0.9 + rand() * 0.06)
          if (alongX) P.box(sack[(c + r) % 2], m, y, across, sx, sy, sz, 0.6, [0, yaw, (rand() - 0.5) * 0.06])
          else P.box(sack[(c + r) % 2], across, y, m, sz, sy, sx, 0.6, [(rand() - 0.5) * 0.06, yaw, 0])
        }
      }
    }
  },
  rubble: (P, [w, h, d], f, rand) => {
    // A heap of broken concrete, highest in the middle, a bar or two out of it, a ceiling tile on top.
    const concrete = [tm.concrete('#8e8a82'), tm.concrete('#77736c')]
    const n = Math.round(10 + w * d * 3)
    for (let i = 0; i < n; i++) {
      const u = (rand() - 0.5) * 2
      const v = (rand() - 0.5) * 2
      const rim = Math.max(Math.abs(u), Math.abs(v))
      const top = h * (1 - rim * rim * 0.75)
      const s = 0.18 + rand() * 0.4 * (1 - rim * 0.5)
      const y = Math.max(s * 0.3, top * (0.4 + rand() * 0.5) - s * 0.25)
      P.box(concrete[i % 2], (u * w) / 2 * 0.9, y, (v * d) / 2 * 0.9, s * (1 + rand() * 0.8), s * (0.6 + rand() * 0.5), s * (1 + rand() * 0.6), 1, [rand() * 0.7, rand() * Math.PI, rand() * 0.7])
    }
    P.box(concrete[0], 0, h * 0.35, 0, w * 0.8, h * 0.7, d * 0.8, 1, [0, rand(), 0])
    const steel = tm.paint('#4a3a2e', 0.8, 0.4)
    for (let i = 0; i < 3; i++) addBar(P, steel, [(rand() - 0.5) * w * 0.6, h * 0.5, (rand() - 0.5) * d * 0.6], [(rand() - 0.5) * w * 1.2, h * (0.6 + rand() * 0.6), (rand() - 0.5) * d * 1.2], 0.02, 0.02)
    P.box(tm.ceiling(CEILING), (rand() - 0.5) * w * 0.3, h * 0.82, (rand() - 0.5) * d * 0.3, 0.6, 0.012, 0.6, 1, [0.3, rand() * 3, 0.15])
  },
  carousel: (P, [w, h, d]) => {
    // A long island, rounded at the ends: the steel body, the black slats of the belt sloping out over it.
    const body = tm.paint('#6e7276', 0.4, 0.7)
    const straight = d - w
    P.box(body, 0, (h - 0.12) / 2, 0, w - 0.3, h - 0.12, straight, 1)
    for (const s of [-1, 1]) P.add(body, new CylinderGeometry((w - 0.3) / 2, (w - 0.3) / 2, h - 0.12, 20, 1, false, s > 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI), [0, (h - 0.12) / 2, (s * straight) / 2])
    P.box(tm.rubber(), 0, h - 0.06, 0, w, 0.12, straight, 1)
    for (const s of [-1, 1]) P.add(tm.rubber(), new CylinderGeometry(w / 2, w / 2, 0.12, 20, 1, false, s > 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI), [0, h - 0.06, (s * straight) / 2])
    // A bag still going round, and the spine's yellow kick strip.
    P.box(tm.paint('#2a4d7a', 0.55), 0.5, h + 0.12, 1.2, 0.5, 0.24, 0.7, 1, [0, 0.4, 0])
    for (const s of [-1, 1]) P.box(tm.paint('#d6a51c', 0.6), s * ((w - 0.3) / 2 + 0.005), 0.08, 0, 0.01, 0.1, straight, 1)
  },
  crates: (P, [w, h, d], f, rand) => {
    // Olive ammunition boxes stacked two high, rope handles, stencilled lids.
    const olive = tm.paint('#4c5a33', 0.75, 0.1)
    const dark = tm.paint('#2e3620', 0.8)
    const lh = h / 2
    for (const [x, y, sw] of [
      [-w / 4, 0, w / 2 - 0.04],
      [w / 4, 0, w / 2 - 0.04],
      [(rand() - 0.5) * 0.2, lh, w / 2 - 0.04],
    ]) {
      P.box(olive, x, y + lh / 2, 0, sw, lh - 0.02, d - 0.04, 1, [0, (rand() - 0.5) * 0.08, 0])
      P.box(dark, x, y + lh - 0.01, 0, sw * 0.9, 0.02, 0.06, 1)
      P.box(tm.paint('#d8c890', 0.8), x, y + lh * 0.55, d / 2 - 0.015, sw * 0.5, 0.08, 0.01, 1)
    }
  },
  barricade: (P, [w, h, d], f, rand) => {
    // Whatever was to hand: a row of seats on its back, a table on its side, a luggage cart, a door.
    P.withFrame([-w / 4, 0.35, 0], 0.1, (Q) => {
      Q.box(tm.paint('#b8bcc0', 0.35, 0.8), 0, 0, 0, w / 2, 0.06, 0.08, 1)
      for (let i = 0; i < 3; i++) Q.box(tm.fabric('#2a3a4e'), -w / 4 + (w / 2) * ((i + 0.5) / 3), 0.25, 0.1, w / 6 - 0.05, 0.5, 0.42, 1, [-1.2, 0, 0])
    })
    P.box(tm.oak('#6a4a30'), w / 4, h / 2, -d / 4, w / 2 - 0.1, h, 0.05, 1, [0, 0.15, 0])
    P.box(tm.plaster(EDGE), w / 4 - 0.1, h * 0.4, d / 4, w / 2 - 0.2, h * 0.8, 0.06, 1, [0.12, -0.1, 0])
    const steel = tm.paint('#8a8c90', 0.4, 0.7)
    for (let i = 0; i < 4; i++) addBar(P, steel, [(rand() - 0.5) * w * 0.8, 0.05, (rand() - 0.5) * d * 0.6], [(rand() - 0.5) * w * 0.8, h * (0.6 + rand() * 0.4), (rand() - 0.5) * d * 0.6], 0.03, 0.03)
  },
}

function addFurniture(P) {
  const rand = seededRandom(7811)
  for (const f of TM_FURNITURE) {
    const art = FURNITURE_ART[f.kind]
    if (!art) continue
    P.withFrame(f.p, f.rotY, (Q) => art(Q, f.size, f, rand))
  }
}

/* ---------------------------------------------------------------------------
 * Signs, bins, luggage
 * ------------------------------------------------------------------------- */

function addSigns(P) {
  // [name, x, y, z, w, h, yaw, faces, hang]
  const list = [
    ['security', -18.2, 3.6, -32.0, 2.6, 0.65, -Math.PI / 2, 2, UNDER1 - 3.95],
    ['checkin', -33.6, 3.5, -45.0, 3.2, 0.8, 0, 2, UNDER1 - 3.92],
    ['books', -4.0, 3.45, -47.86, 3.2, 0.8, 0, 1, 0],
    ['dutyfree', 36.0, 3.45, -37.86, 3.2, 0.8, 0, 1, 0],
    ['cafe', 21.0, 3.3, TB_IN.z0 + 0.06, 3.2, 0.8, 0, 1, 0],
    ['toilets', -22.4, 2.85, -48.95, 1.0, 0.5, 0, 1, 0],
    ['toilets', 0.0, TB.l1 + 2.85, -49.95, 1.0, 0.5, 0, 1, 0],
    ['baggage', -35.5, 4.15, TB_IN.z1 - 0.12, 2.4, 0.6, Math.PI, 1, 0],
    ['staff', -17.6, 3.2, -46.6, 1.8, 0.45, -Math.PI / 2, 2, UNDER1 - 3.43],
    ['gate3', -6.0, TB.l1 + 3.1, -22.6, 2.4, 0.6, Math.PI, 2, UNDER2 - TB.l1 - 3.4],
    ['gate45', 26.0, TB.l1 + 3.1, -34.0, 2.6, 0.65, Math.PI, 2, UNDER2 - TB.l1 - 3.43],
    ['lounge', -24.0, TB.l1 + 3.1, -46.0, 2.6, 0.65, Math.PI, 2, UNDER2 - TB.l1 - 3.43],
    ['vip', 22.0, TB.l1 + 3.25, -45.86, 2.4, 0.6, 0, 1, 0],
    ['gate45', 2.0, 3.6, -26.0, 2.6, 0.65, 0, 2, UNDER1 - 3.93],
    ['exit', TB_IN.x0 + 0.12, 3.25, -35.0, 0.9, 0.45, Math.PI / 2, 1, 0],
    ['exit', TB_IN.x1 - 0.12, 3.25, -28.0, 0.9, 0.45, -Math.PI / 2, 1, 0],
    ['exit', -10.4, 2.95, TB_IN.z1 - 0.12, 0.9, 0.45, Math.PI, 1, 0],
    ['exit', 10.4, 2.95, TB_IN.z1 - 0.12, 0.9, 0.45, Math.PI, 1, 0],
    // The leg: its baggage hall, the gates upstairs, the ways out.
    ['baggage', 36.0, 3.5, -16.0, 2.4, 0.6, 0, 2, UNDER1 - 3.83],
    ['gate45', 36.0, TB.l1 + 3.1, -18.0, 2.6, 0.65, 0, 2, UNDER2 - TB.l1 - 3.43],
    ['exit', 31.8, 3.25, LEG_IN.z1 - 0.12, 0.9, 0.45, Math.PI, 1, 0],
    ['exit', LEG_IN.x1 - 0.12, 3.25, -11.4, 0.9, 0.45, -Math.PI / 2, 1, 0],
  ]
  for (const [name, x, y, z, w, h, yaw, faces, hang] of list) addSignBox(P, name, [x, y, z], w, h, yaw, faces, hang)
}

function addClutter(P) {
  const rand = seededRandom(7911)
  const bin = tm.paint('#5a5e64', 0.4, 0.7)
  for (const [x, z, y] of [[-14.2, -34.0, 0], [14.2, -38.0, 0], [-27.0, -24.0, 0], [30.0, -36.6, 0], [-13.4, -48.0, TB.l1], [42.4, -24.0, TB.l1], [-42.6, -24.0, TB.l1]]) {
    P.add(bin, new CylinderGeometry(0.24, 0.22, 0.85, 12), [x, y + 0.425, z])
    P.add(tm.paint('#2a2c30', 0.5), new CylinderGeometry(0.25, 0.25, 0.04, 12), [x, y + 0.87, z])
  }
  // Abandoned luggage: suitcases standing and lying about the hall and the gates.
  const cases = ['#1c1d20', '#2a4d7a', '#7a2a2a', '#3a3a3c', '#5a5040', '#2a5a4a']
  const spots = [
    [-6.8, -26.8, 0], [-8.4, -27.6, 0], [4.6, -44.2, 0], [7.4, -45.0, 0], [-15.6, -38.4, 0], [16.2, -42.0, 0], [20.6, -33.6, 0], [31.6, -34.8, 0],
    [-34.4, -38.6, 0], [-28.4, -27.0, 0], [-2.4, -21.6, TB.l1], [8.6, -21.8, TB.l1], [22.8, -24.6, TB.l1], [-36.0, -26.4, TB.l1],
    [33.0, -14.6, 0], [39.2, 0.6, 0], [34.6, 10.2, 0], [35.0, -3.4, TB.l1], [42.0, -9.0, TB.l1], [31.2, 9.6, TB.l1],
  ]
  for (const [x, z, y] of spots) {
    const tint = cases[Math.floor(rand() * cases.length)]
    const lying = rand() < 0.5
    const yaw = rand() * Math.PI * 2
    const w = 0.42 + rand() * 0.12
    const h = 0.62 + rand() * 0.14
    const d = 0.24
    if (lying) P.box(tm.paint(tint, 0.55), x, y + d / 2 + 0.03, z, w, d, h, 1, [0, yaw, 0])
    else {
      P.box(tm.paint(tint, 0.55), x, y + h / 2 + 0.06, z, w, h, d, 1, [0, yaw, 0])
      for (const k of [-1, 1]) P.add(tm.rubber(), new SphereGeometry(0.035, 6, 4), [x + Math.cos(yaw) * k * (w / 2 - 0.05), y + 0.035, z - Math.sin(yaw) * k * (w / 2 - 0.05)])
    }
  }
}

/* ---------------------------------------------------------------------------
 * Damage
 * ------------------------------------------------------------------------- */

/**
 * What the fighting left on the walls, floors and ceilings: soot where shells
 * and grenades went off, ceiling tiles brought down (lying on the floor, the
 * dark gap they left overhead), cables hanging out of the gaps.
 */
function addDamage(P) {
  const rand = seededRandom(8311)
  // Soot on the floors: [x, z, upstairs, size].
  for (const [x, z, up, size] of [
    [-4.0, -25.0, 0, 3.6], [12.6, -27.6, 0, 3.0], [-29.6, -27.4, 0, 4.0], [-21.4, -38.0, 0, 2.6], [22.0, -40.0, 0, 3.2], [36.0, -15.0, 0, 3.4],
    [40.4, 6.6, 0, 3.0], [31.0, -6.0, 0, 2.6], [-20.0, -26.0, 1, 3.4], [24.0, -25.6, 1, 3.0], [36.0, -11.6, 1, 3.6], [40.6, 6.0, 1, 2.8],
    [-36.0, -40.0, 1, 3.0], [-6.0, -48.0, 1, 2.4], [8.0, -24.0, 1, 2.6],
  ]) {
    floorScorch(P, x, up ? TB.l1 + 0.012 : GROUND_Y.floor, z, size, rand() * Math.PI)
  }
  // Soot up the walls: [wall id, along, height, w, h, side].
  const wall = Object.fromEntries(TM_WALLS.map((w) => [w.id, w]))
  for (const [id, a, y, w, h, side] of [
    ['back', -16.0, 2.4, 3.6, 3.6, 1],
    ['back', 12.0, 7.4, 3.0, 3.4, 1],
    ['back', 27.0, 2.6, 2.6, 3.0, 1],
    ['west', -36.0, 7.4, 3.0, 3.2, 1],
    ['east', -8.0, 2.6, 3.0, 3.6, -1],
    ['east', -19.0, 7.6, 3.4, 3.4, -1],
    ['east', -16.0, 2.4, 2.6, 2.8, 1],
    ['leg-s', 35.0, 2.2, 2.6, 3.0, -1],
    ['leg-s', 33.6, 4.6, 3.6, 2.8, 1],
    ['wc-s', -20.0, 2.0, 2.4, 2.6, 1],
  ]) {
    wallScorch(P, wall[id], a, y, w, h, side, wall[id].t)
  }
  // Ceiling tiles down: the tile on the floor, the gap overhead, a cable or two out of it.
  const tile = tm.ceiling(CEILING)
  const gap = tm.paint('#141210', 0.9)
  const cable = tm.paint('#1c1c1c', 0.6)
  const spots = [
    [-30.0, -33.0, 0], [-22.0, -44.0, 0], [-14.0, -30.0, 0], [16.0, -36.0, 0], [26.0, -28.0, 0], [38.0, -40.0, 0], [34.0, -16.0, 0],
    [41.0, -6.0, 0], [30.4, -16.0, 0], [40.0, 9.0, 0], [-40.0, -26.0, 1], [-26.0, -36.0, 1], [-14.0, -46.0, 1], [20.0, -30.0, 1],
    [34.0, -24.0, 1], [32.0, -12.0, 1], [41.0, 2.0, 1], [-2.0, -24.0, 1],
  ]
  for (const [x, z, up] of spots) {
    const ceil = (up ? UNDER2 : UNDER1) - 0.004
    const floor = up ? TB.l1 + 0.012 : GROUND_Y.floor
    P.box(gap, x, ceil, z, 1.2, 0.006, 0.6, 1)
    for (let i = 0; i < 2; i++) {
      const tx = x + (rand() - 0.5) * 1.6
      const tz = z + (rand() - 0.5) * 1.6
      P.box(tile, tx, floor + 0.008 + i * 0.012, tz, 0.6, 0.012, 0.6, 1, [(rand() - 0.5) * 0.02, rand() * Math.PI, 0])
    }
    if (rand() < 0.6) addBar(P, cable, [x - 0.3, ceil, z], [x - 0.1 + rand() * 0.3, ceil - 0.8 - rand() * 1.2, z + (rand() - 0.5) * 0.3], 0.014, 0.014)
  }
}

/* ---------------------------------------------------------------------------
 * The roof: air-handling units and vents (seen from the apron)
 * ------------------------------------------------------------------------- */

function addRoof(P) {
  const rand = seededRandom(8011)
  const unit = tm.cladding('#9a9c9e')
  for (const [x, z, w, d] of [[-30, -48, 6, 3], [-14, -52, 4, 3], [28, -50, 7, 3.4], [34, -40, 3, 3], [-38, -26, 3.2, 2.4], [6, -50, 3, 2.4], [39.6, -12, 4.4, 3], [40.0, 7.0, 3, 2.4]]) {
    P.box(unit, x, TB.roof + 0.9, z, w, 1.8, d, 2)
    for (let i = 0; i < Math.floor(w / 1.6); i++) {
      P.add(tm.paint('#2a2c30', 0.5), new CylinderGeometry(0.55, 0.55, 0.08, 16), [x - w / 2 + 0.8 + i * 1.6, TB.roof + 1.84, z])
    }
  }
  const clear = (x, z) => ![...TM_SKYLIGHTS, ...ROOF_HOLES].some(([a0, a1, b0, b1]) => x > a0 - 1 && x < a1 + 1 && z > b0 - 1 && z < b1 + 1)
  for (let i = 0; i < 14; i++) {
    const leg = i >= 10
    const x = leg ? LEG_IN.x0 + 1 + rand() * (LEG_IN.x1 - LEG_IN.x0 - 2) : -40 + rand() * 80
    const z = leg ? -18 + rand() * 28 : -54 + rand() * 30
    if (!clear(x, z)) continue
    P.add(tm.paint('#8d9196', 0.4, 0.7), new CylinderGeometry(0.2, 0.2, 0.9, 10), [x, TB.roof + 0.45, z])
  }
  // Coping along the top of the walls round the roof (round the L, the pieces meeting end to end).
  const coping = tm.paint('#7d8186', 0.45, 0.6)
  const c = TB.wall + 0.08
  const y = TB.top + 0.03
  const lip = c / 2
  P.box(coping, 0, y, TB.z0 + TB.wall / 2, TB.x1 - TB.x0 + 0.1, 0.06, c, 1)
  const backIn = TB.z0 + TB.wall / 2 + lip
  const frontX1 = LEG.x0 + TB.wall / 2 - lip
  P.box(coping, (TB.x0 - 0.05 + frontX1) / 2, y, FACADE.z, frontX1 - TB.x0 + 0.05, 0.06, c, 1)
  const frontIn = FACADE.z - lip
  P.box(coping, TB.x0 + TB.wall / 2, y, (backIn + frontIn) / 2, c, 0.06, frontIn - backIn, 1)
  const legS = LEG.z1 - TB.wall / 2
  P.box(coping, TB.x1 - TB.wall / 2, y, (backIn + legS - lip) / 2, c, 0.06, legS - lip - backIn, 1)
  P.box(coping, LEG.x0 + TB.wall / 2, y, (frontIn + legS - lip) / 2, c, 0.06, legS - lip - frontIn, 1)
  P.box(coping, (LEG.x0 + TB.x1) / 2, y, legS, TB.x1 - LEG.x0 + 0.08, 0.06, c, 1)
}

/**
 * The hideout: lit by a lantern and candles (no power here either), a map
 * pinned on the wall, bottles and tins, a mattress on the floor (the shelf
 * unit fallen against the wall outside, half hiding the gap, is furniture).
 */
function addHideout(P) {
  const rand = seededRandom(8411)
  const H = HIDEOUT
  // The map on the bookshop's wall, and a sheet of plans beside it.
  P.box(tm.paint('#c8bc96', 0.9), H.x1 - 0.005, 1.7, -53.0, 0.004, 0.9, 1.3, 1)
  for (let i = 0; i < 6; i++) P.box(tm.paint(i % 2 ? '#7a2a2a' : '#2a3a5e', 0.7), H.x1 - 0.009, 1.45 + rand() * 0.5, -53.5 + rand() * 1.0, 0.004, 0.03, 0.12 + rand() * 0.2, 1, [rand() * 0.6, 0, 0])
  // Candles on the crates, a lantern hung from the ceiling, their glow on the wall.
  for (const [x, y, z] of [[-13.0, 1.13, -52.8], [-13.4, 1.13, -53.2], [-15.9, 0.04, -52.6]]) {
    P.add(tm.paint('#e8e0c8', 0.6), new CylinderGeometry(0.025, 0.025, 0.12, 8), [x, y + 0.06, z])
    P.add(tm.glow('#ffc060'), new SphereGeometry(0.018, 6, 5), [x, y + 0.14, z])
  }
  addBar(P, tm.paint('#2a2c30', 0.5), [-13.8, UNDER1, -52.8], [-13.8, 2.6, -52.8], 0.012, 0.012)
  P.add(tm.paint('#3e4a30', 0.6, 0.3), new CylinderGeometry(0.1, 0.12, 0.26, 10), [-13.8, 2.47, -52.8])
  P.add(tm.glow('#ffb04a'), new SphereGeometry(0.07, 10, 8), [-13.8, 2.47, -52.8])
  // A mattress on the floor in the corner, bottles and tins, papers.
  P.box(tm.fabric('#8a8270'), -11.2, 0.09, -50.9, 1.8, 0.16, 0.9, 1, [0, 0.05, 0])
  for (let i = 0; i < 9; i++) {
    const x = -15.0 + rand() * 4.2
    const z = -54.2 + rand() * 3.4
    if (rand() < 0.5) P.add(tm.paint(['#3a5a3a', '#5a3a1a', '#2a3a4a'][i % 3], 0.2, 0.1), new CylinderGeometry(0.035, 0.035, 0.26, 8), [x, 0.13, z])
    else P.add(tm.brushed('#a8acb0'), new CylinderGeometry(0.045, 0.045, 0.1, 10), [x, 0.05, z])
  }
  for (let i = 0; i < 8; i++) P.box(tm.paint('#d8d4c8', 0.9), -16.6 + rand() * 6, 0.006, -54.8 + rand() * 4.2, 0.21, 0.004, 0.3, 1, [0, rand() * 3, 0])
  floorScorch(P, -13.5, GROUND_Y.floor, -53.0, 3.0, 0.5)
}

function buildTerminal() {
  const P = new Pieces()
  addWalls(P)
  addGlassRuns(P)
  addFronts(P)
  addFloors(P)
  addHoles(P)
  addCollapse(P)
  addAccents(P)
  addLights(P)
  addHall(P)
  addColumns(P)
  addFlights(P)
  addRails(P)
  addFurniture(P)
  addSigns(P)
  addClutter(P)
  addDamage(P)
  addHideout(P)
  addRoof(P)
  return P.build()
}

export function Terminal() {
  const parts = useMemo(() => once('tm:terminal', buildTerminal), [])
  return <Merged parts={parts} />
}

export default Terminal
