import { useMemo } from 'react'
import { ConeGeometry, CylinderGeometry } from 'three'

import { CAR_MODELS } from '../../../shared/mapAcres.js'
import { CONES, GSE, MAST, ULD } from '../../../shared/mapTerminal.js'
import { Merged } from '../acres/merge.jsx'
import { once, Pieces } from '../acres/pieces.js'
import { Car } from '../acres/vehicles.jsx'
import { addBar } from '../quarter/kit.js'
import { addSign, prismGeometry } from './kit.js'
import { tm } from './materials.js'

/**
 * The apron's equipment: air cargo containers and the dollies they ride on,
 * baggage tugs, the fuel truck, the catering truck, the pushback tug, the
 * ground power unit, the apron bus, the floodlight masts and the cones; the
 * police car and the taxi. Each built once per kind and placed by its group.
 */

/** Builds once per key and draws it at an entity's place. */
function Placed({ k, build, p, rotY }) {
  const parts = useMemo(() => once(k, build), [k, build])
  return (
    <group position={p} rotation={[0, rotY ?? 0, 0]}>
      <Merged parts={parts} />
    </group>
  )
}

const wheel = (P, x, y, z, r, w, material = tm.rubber()) => {
  P.add(material, new CylinderGeometry(r, r, w, 14), [x, y, z], [0, 0, Math.PI / 2])
  P.add(tm.paint('#b8bcc0', 0.4, 0.6), new CylinderGeometry(r * 0.55, r * 0.55, w + 0.01, 10), [x, y, z], [0, 0, Math.PI / 2])
}

/* ---------------------------------------------------------------------------
 * Containers
 * ------------------------------------------------------------------------- */

const ULD_TINTS = ['#e4e6e8', '#d6dadf', '#c9ced4', '#e0dccf', '#d9dde2']

/** The small container: ribbed aluminium, one lower corner cut away to fit the hold, a curtain door in front. */
function buildAke(tint) {
  const P = new Pieces()
  const { w, h, d } = ULD.ake
  const shape = [
    [-w / 2, 0],
    [w / 2 - 0.5, 0],
    [w / 2, 0.55],
    [w / 2, h],
    [-w / 2, h],
  ]
  P.add(tm.rib(tint), prismGeometry(shape, d), [0, 0, 0])
  // Frame edges, the curtain door (on its -z face) and a placard.
  const frame = tm.paint('#8d9196', 0.45, 0.6)
  // (The band's top a centimetre over the box's, the post's top inside the band: no shared faces.)
  P.box(frame, 0, h - 0.02, 0, w + 0.02, 0.06, d + 0.02, 1)
  P.box(frame, -w / 2 + 0.02, (h - 0.03) / 2, -d / 2, 0.06, h - 0.03, 0.04, 1)
  P.box(tm.paint('#2f6fc8', 0.7), -0.15, h / 2 + 0.08, -d / 2 - 0.012, w - 0.6, h - 0.5, 0.01, 1)
  P.box(tm.paint('#f2f2ee', 0.6), -0.15, h - 0.35, -d / 2 - 0.02, 0.3, 0.2, 0.006, 1)
  return P.build()
}

/** The big one: a pallet with cargo strapped under a net. */
function buildPmc(tint) {
  const P = new Pieces()
  const { w, h, d } = ULD.pmc
  P.box(tm.brushed('#c8ccd0'), 0, 0.04, 0, w, 0.08, d, 1)
  P.box(tm.paint(tint === '#e4e6e8' ? '#b89a6a' : '#a88a5a', 0.85), 0, (h + 0.08) / 2, 0, w - 0.1, h - 0.08, d - 0.1, 2)
  const net = tm.paint('#2a2c30', 0.7)
  for (let x = -w / 2 + 0.3; x < w / 2; x += 0.55) {
    P.box(net, x, h + 0.005, 0, 0.04, 0.01, d - 0.08, 1)
    for (const s of [-1, 1]) P.box(net, x, (h + 0.08) / 2, s * (d / 2 - 0.045), 0.04, h - 0.08, 0.01, 1)
  }
  for (let z = -d / 2 + 0.3; z < d / 2; z += 0.55) {
    P.box(net, 0, h + 0.012, z, w - 0.08, 0.008, 0.04, 1)
    for (const s of [-1, 1]) P.box(net, s * (w / 2 - 0.045), (h + 0.08) / 2, z, 0.01, h - 0.08, 0.04, 1)
  }
  return P.build()
}

export function Uld({ kind, p, rotY }) {
  const tint = ULD_TINTS[Math.abs(Math.round(p[0] * 7 + p[2] * 3)) % ULD_TINTS.length]
  return <Placed k={`tm:uld:${kind}:${tint}`} build={() => (kind === 'pmc' ? buildPmc(tint) : buildAke(tint))} p={p} rotY={rotY} />
}

/* ---------------------------------------------------------------------------
 * Baggage train: the tug and its dollies
 * ------------------------------------------------------------------------- */

function buildTug() {
  const P = new Pieces()
  const g = GSE.tug
  const body = tm.paint('#2f6fc8', 0.5)
  P.box(body, 0, 0.55, 0.1, g.width, 0.6, g.length - 0.2, 1)
  P.box(tm.paint('#e8e8e4', 0.5), 0, 0.92, -g.length / 2 + 0.55, g.width - 0.1, 0.3, 0.9, 1)
  P.box(tm.paint('#2a2c30', 0.6), 0, 1.0, 0.45, 0.6, 0.12, 0.5, 1)
  P.box(tm.paint('#2a2c30', 0.6), 0, 1.3, 0.72, 0.6, 0.6, 0.1, 1)
  addBar(P, tm.paint('#2a2c30', 0.5), [0, 0.95, -0.05], [0, 1.4, 0.15], 0.05, 0.05)
  for (const [x, z] of [[-0.62, -0.95], [0.62, -0.95], [-0.62, 0.95], [0.62, 0.95]]) wheel(P, x, 0.32, z, 0.32, 0.22)
  // Canopy on four posts.
  for (const [x, z] of [[-0.62, 0.05], [0.62, 0.05], [-0.62, 1.2], [0.62, 1.2]]) P.box(tm.paint('#8d9196', 0.4, 0.6), x, 1.25, z, 0.05, 0.9, 0.05, 1)
  P.box(tm.paint('#e8e8e4', 0.5), 0, 1.72, 0.62, g.width, 0.05, 1.4, 1)
  P.box(tm.glow('#ffb43a'), 0, 1.78, 0.62, 0.14, 0.08, 0.14, 1)
  return P.build()
}

export const Tug = ({ p, rotY }) => <Placed k="tm:tug" build={buildTug} p={p} rotY={rotY} />

function buildDolly(cargo) {
  const P = new Pieces()
  const c = ULD[cargo]
  const deck = GSE.dolly.deck
  const yellow = tm.paint('#e2b22a', 0.6)
  P.box(yellow, 0, deck - 0.06, 0, c.w + 0.3, 0.12, c.d + 0.4, 1)
  for (let x = -c.w / 2; x <= c.w / 2 + 1e-3; x += c.w / 4) P.box(tm.brushed('#c0c4c8'), x, deck + 0.005, 0, 0.06, 0.01, c.d + 0.3, 1)
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) wheel(P, (x * (c.w + 0.2)) / 2, 0.2, (z * (c.d + 0.1)) / 2, 0.2, 0.14)
  addBar(P, yellow, [0, 0.3, -(c.d + 0.4) / 2], [0, 0.3, -(c.d + 0.4) / 2 - 0.85], 0.06, 0.06)
  // The container riding on it.
  const parts = cargo === 'pmc' ? buildPmc('#d6dadf') : buildAke('#d6dadf')
  for (const { material, geometry } of parts) P.add(material, geometry, [0, deck, 0])
  return P.build()
}

export const Dolly = ({ p, rotY, cargo }) => <Placed k={`tm:dolly:${cargo}`} build={() => buildDolly(cargo)} p={p} rotY={rotY} />

/* ---------------------------------------------------------------------------
 * Trucks
 * ------------------------------------------------------------------------- */

/** A truck cab at the front (local -z): body, windscreen, side windows, lights, front wheels. */
function addCab(P, width, length, top, z0, colour) {
  const zc = z0 + length / 2
  P.box(tm.paint(colour, 0.45, 0.2), 0, (top + 0.5) / 2, zc, width, top - 0.5, length, 1)
  P.box(tm.paint('#20262e', 0.15, 0.5), 0, top - 0.55, z0 - 0.012, width - 0.3, 0.75, 0.02, 1)
  for (const s of [-1, 1]) P.box(tm.paint('#20262e', 0.15, 0.5), s * (width / 2 + 0.008), top - 0.6, zc - 0.1, 0.02, 0.6, length * 0.55, 1)
  P.box(tm.paint('#2a2c30', 0.6), 0, 0.62, z0 - 0.04, width, 0.24, 0.08, 1)
  for (const s of [-1, 1]) P.box(tm.glow('#fff2d0'), s * (width / 2 - 0.3), 0.95, z0 - 0.012, 0.3, 0.14, 0.02, 1)
  P.box(tm.glow('#ffb43a'), 0, top + 0.06, zc, 0.2, 0.12, 0.2, 1)
}

function buildFuelTruck() {
  const P = new Pieces()
  const g = GSE.fuel
  const half = g.length / 2
  addCab(P, g.width, g.cab, g.cabTop, -half, '#c0392b')
  P.box(tm.paint('#2a2c30', 0.6), 0, 0.7, g.cab / 2, g.width - 0.2, 0.8, g.length - g.cab, 1)
  const tankLen = g.length - g.cab - 0.3
  const tz = -half + g.cab + 0.3 + tankLen / 2
  P.add(tm.paint('#eef0f2', 0.35, 0.3), new CylinderGeometry(g.tankR, g.tankR, tankLen, 24), [0, g.tankY, tz], [Math.PI / 2, 0, 0])
  for (const z of [tz - tankLen / 2, tz + tankLen / 2]) P.add(tm.paint('#c9ccd0', 0.4, 0.4), new CylinderGeometry(g.tankR + 0.03, g.tankR + 0.03, 0.08, 24), [0, g.tankY, z], [Math.PI / 2, 0, 0])
  // The red band and JET A-1 on both sides.
  P.add(tm.paint('#c0392b', 0.5), new CylinderGeometry(g.tankR + 0.008, g.tankR + 0.008, 0.4, 24, 1, true), [0, g.tankY, tz + 1.2], [Math.PI / 2, 0, 0])
  // On the tank's sides at its middle height (a flat sign on the curve, 1-4 cm off it).
  for (const s of [-1, 1]) addSign(P, 'jet', [s * (g.tankR + 0.012), g.tankY, tz - 0.6], 2.0, 0.5, (s * Math.PI) / 2)
  // Walkway and its rail on top, the hose reel at the back.
  P.box(tm.rib('#b0b4b8'), 0, g.tankY + g.tankR + 0.03, tz, 0.6, 0.05, tankLen - 1.0, 1)
  for (const s of [-1, 1]) addBar(P, tm.paint('#e2b22a', 0.6), [s * 0.35, g.tankY + g.tankR + 0.6, tz - tankLen / 2 + 0.6], [s * 0.35, g.tankY + g.tankR + 0.6, tz + tankLen / 2 - 0.6], 0.04, 0.04)
  P.add(tm.rubber(), new CylinderGeometry(0.45, 0.45, 1.2, 16), [0, 1.1, half - 0.2], [0, 0, Math.PI / 2])
  for (const z of [-half + 1.1, half - 2.4, half - 1.2]) for (const s of [-1, 1]) wheel(P, s * (g.width / 2 - 0.25), 0.5, z, 0.5, 0.38)
  return P.build()
}

export const FuelTruck = ({ p, rotY }) => <Placed k="tm:fuel" build={buildFuelTruck} p={p} rotY={rotY} />

function buildCatering() {
  const P = new Pieces()
  const g = GSE.catering
  const half = g.length / 2
  addCab(P, g.width, g.cab, g.cabTop, -half, '#eef0f2')
  P.box(tm.paint('#2a2c30', 0.6), 0, 0.7, g.cab / 2, g.width - 0.2, 0.8, g.length - g.cab, 1)
  // The box on its scissor lift (lowered).
  const bz = g.cab / 2 + 0.2
  const bl = g.length - g.cab - 0.4
  P.box(tm.paint('#eef0f2', 0.5, 0.2), 0, (g.boxY + g.boxTop) / 2, bz, g.width, g.boxTop - g.boxY, bl, 2)
  for (const s of [-1, 1]) addSign(P, 'fuel', [s * (g.width / 2 + 0.006), (g.boxY + g.boxTop) / 2 + 0.3, bz], 3.6, 0.9, (s * Math.PI) / 2)
  for (const s of [-1, 1]) addBar(P, tm.paint('#8d9196', 0.45, 0.6), [s * 0.9, 1.0, bz - bl / 2 + 0.4], [s * 0.9, g.boxY, bz + bl / 2 - 0.4], 0.08, 0.12)
  for (const z of [-half + 1.0, half - 1.2]) for (const s of [-1, 1]) wheel(P, s * (g.width / 2 - 0.25), 0.45, z, 0.45, 0.34)
  return P.build()
}

export const Catering = ({ p, rotY }) => <Placed k="tm:catering" build={buildCatering} p={p} rotY={rotY} />

function buildPushback() {
  const P = new Pieces()
  const g = GSE.pushback
  const yellow = tm.paint('#e2b22a', 0.6)
  P.box(yellow, 0, g.height / 2 + 0.25, 0, g.width, g.height - 0.5, g.length, 1)
  P.box(tm.paint('#2a2c30', 0.6), 0, 0.3, 0, g.width - 0.3, 0.5, g.length - 1.2, 1)
  // The cab at the front, low and glazed.
  P.box(yellow, 0, (g.height + g.cabTop) / 2, -g.length / 2 + 0.9, 1.4, g.cabTop - g.height, 1.4, 1)
  P.box(tm.paint('#20262e', 0.15, 0.5), 0, g.cabTop - 0.35, -g.length / 2 + 0.19, 1.2, 0.45, 0.02, 1)
  P.box(tm.paint('#2a2c30', 0.6), 0, 0.55, -g.length / 2 - 0.15, 0.6, 0.3, 0.3, 1)
  for (const z of [-g.length / 2 + 1.1, g.length / 2 - 1.1]) for (const s of [-1, 1]) wheel(P, s * (g.width / 2 - 0.1), 0.55, z, 0.55, 0.5)
  P.box(tm.glow('#ffb43a'), 0, g.cabTop + 0.06, -g.length / 2 + 0.9, 0.2, 0.12, 0.2, 1)
  return P.build()
}

export const Pushback = ({ p, rotY }) => <Placed k="tm:pushback" build={buildPushback} p={p} rotY={rotY} />

function buildGpu() {
  const P = new Pieces()
  const g = GSE.gpu
  P.box(tm.paint('#e2b22a', 0.6), 0, g.height / 2 + 0.15, 0, g.width, g.height - 0.3, g.length, 1)
  P.box(tm.paint('#2a2c30', 0.6), 0, g.height - 0.05, 0, g.width - 0.2, 0.1, g.length - 0.3, 1)
  for (const [x, z] of [[-0.5, -0.8], [0.5, -0.8], [-0.5, 0.8], [0.5, 0.8]]) wheel(P, x, 0.18, z, 0.18, 0.12)
  // The cable coiled on the side.
  P.add(tm.rubber(), new CylinderGeometry(0.3, 0.3, 0.12, 14, 1, true), [g.width / 2 + 0.07, 0.8, 0.2], [0, 0, Math.PI / 2])
  return P.build()
}

export const Gpu = ({ p, rotY }) => <Placed k="tm:gpu" build={buildGpu} p={p} rotY={rotY} />

function buildBus() {
  const P = new Pieces()
  const g = GSE.bus
  const half = g.length / 2
  const white = tm.paint('#eef0f2', 0.45, 0.2)
  P.box(white, 0, g.height / 2 + 0.1, 0, g.width, g.height - 0.2, g.length, 2)
  // A deep blue skirt and the glazing all round (doors along the right side).
  P.box(tm.paint('#163d7a', 0.5), 0, 0.42, 0, g.width + 0.02, 0.4, g.length + 0.02, 1)
  const glass = tm.paint('#20262e', 0.15, 0.5)
  for (const s of [-1, 1]) P.box(glass, s * (g.width / 2 + 0.008), 1.75, 0, 0.02, 1.4, g.length - 1.0, 1)
  for (const z of [-half + 0.01, half - 0.01]) P.box(glass, 0, 1.8, z + (z < 0 ? -0.008 : 0.008), g.width - 0.3, 1.5, 0.02, 1)
  for (const z of [-3.6, 0, 3.6]) P.box(tm.paint('#3a3f46', 0.45, 0.6), g.width / 2 + 0.02, 1.35, z, 0.02, 2.4, 1.3, 1)
  // Roof units, wheels.
  P.box(tm.paint('#c9ccd0', 0.5, 0.3), 0, g.height + 0.12, 2.0, 1.8, 0.24, 3.0, 1)
  for (const z of [-half + 2.2, half - 2.4]) for (const s of [-1, 1]) wheel(P, s * (g.width / 2 - 0.3), 0.5, z, 0.5, 0.34)
  return P.build()
}

export const ApronBus = ({ p, rotY }) => <Placed k="tm:bus" build={buildBus} p={p} rotY={rotY} />

/** A car (or what's left of one), and a police car's light bar and stripe, a taxi's roof sign. */
export function TmCar({ model, color, p, rotY, livery, wreck = false }) {
  const extra = useMemo(
    () =>
      livery
        ? once(`tm:carLivery:${model}:${livery}`, () => {
            const P = new Pieces()
            const m = CAR_MODELS[model]
            if (livery === 'police') {
              P.box(tm.paint('#2a2c30', 0.5), 0, m.cabinTop + 0.05, -0.1, 1.2, 0.1, 0.3, 1)
              P.box(tm.glow('#2a6aff'), -0.32, m.cabinTop + 0.14, -0.1, 0.5, 0.1, 0.24, 1)
              P.box(tm.glow('#ff2a2a'), 0.32, m.cabinTop + 0.14, -0.1, 0.5, 0.1, 0.24, 1)
              for (const s of [-1, 1]) P.box(tm.paint('#1f5fbf', 0.5), s * (m.w / 2 + 0.006), (m.body[0] + m.body[1]) / 2 + 0.05, 0, 0.012, 0.14, m.length * 0.8, 1)
            } else {
              P.box(tm.paint('#f2f2ee', 0.5), 0, m.cabinTop + 0.12, -0.2, 0.6, 0.22, 0.2, 1)
            }
            return P.build()
          })
        : null,
    [model, livery],
  )
  return (
    <>
      <Car model={model} color={color} p={p} rotY={rotY} wreck={wreck} />
      {extra && (
        <group position={p} rotation={[0, rotY, 0]}>
          <Merged parts={extra} />
        </group>
      )}
    </>
  )
}

/* ---------------------------------------------------------------------------
 * Floodlight masts, cones
 * ------------------------------------------------------------------------- */

function buildMast() {
  const P = new Pieces()
  const steel = tm.paint('#9aa0a8', 0.4, 0.7)
  P.add(steel, new CylinderGeometry(MAST.r * 0.55, MAST.r, MAST.h, 12), [0, MAST.h / 2, 0])
  P.add(tm.concrete('#bdbab2'), new CylinderGeometry(0.55, 0.65, 0.4, 12), [0, 0.2, 0])
  // The head: a frame of floodlights facing out over the apron, a little service platform.
  P.box(steel, 0, MAST.h + 0.1, 0, 2.6, 0.12, 0.12, 1)
  P.box(steel, 0, MAST.h + 0.9, 0, 2.6, 0.12, 0.12, 1)
  for (let i = 0; i < 4; i++) {
    const x = -0.95 + i * 0.63
    for (const y of [MAST.h + 0.5, MAST.h + 1.25]) {
      P.box(tm.paint('#3a3c40', 0.5, 0.4), x, y, 0.15, 0.5, 0.36, 0.2, 1)
      P.box(tm.glow('#fff6dc'), x, y, 0.255, 0.42, 0.28, 0.012, 1)
    }
  }
  P.box(tm.rib('#9aa0a8'), 0, MAST.h - 0.6, 0, 1.4, 0.06, 1.4, 1)
  return P.build()
}

export const Mast = ({ p }) => <Placed k="tm:mast" build={buildMast} p={p} rotY={Math.atan2(-p[0], -p[2])} />

function buildCones() {
  const P = new Pieces()
  const orange = tm.paint('#f2601c', 0.6)
  const white = tm.paint('#f2f2ee', 0.5)
  for (const [x, z] of CONES) {
    P.box(orange, x, 0.02, z, 0.38, 0.04, 0.38, 1)
    P.add(orange, new ConeGeometry(0.16, 0.7, 12), [x, 0.39, z])
    P.add(white, new CylinderGeometry(0.075, 0.1, 0.12, 12, 1, true), [x, 0.46, z])
  }
  return P.build()
}

export function Cones() {
  const parts = useMemo(() => once('tm:cones', buildCones), [])
  return <Merged parts={parts} />
}

