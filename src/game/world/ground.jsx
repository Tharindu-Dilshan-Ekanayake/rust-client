import { useMemo } from 'react'
import { CanvasTexture, MeshStandardMaterial, PlaneGeometry, SphereGeometry, SRGBColorSpace } from 'three'

import { seededRandom } from '../../shared/math.js'
import { materials } from './materials.js'
import { Box, Cyl } from './parts.jsx'

/* ---------------------------------------------------------------------------
 * White pressure tank on a container deck, behind yellow rails
 * ------------------------------------------------------------------------- */

const domeGeo = new SphereGeometry(1, 20, 12)

/** Deck rail runs: [side, fixed coordinate, from, to] along x (z sides) or z (x sides). */
const RAIL_SIDES = [
  ['z-', -1.15, -2.95, 2.95],
  ['z+', 1.15, -2.95, 2.95],
  ['x-', -2.95, -1.15, 1.15],
  ['x+', 2.95, -1.15, 1.15],
]

export function DeckTank({ p, rotY, length, r, gap }) {
  const white = materials.tankWhite()
  const yellow = materials.hazard()
  const cy = 0.3 + r
  const body = length - r
  // Inside the ladder's opening: no post, no rail.
  const inGap = (side, t) => gap && gap.side === side && t > gap.from + 0.01 && t < gap.to - 0.01
  const posts = []
  for (const x of [-2.95, -1.5, 0, 1.5, 2.95]) for (const z of [-1.15, 1.15]) if (!inGap(z < 0 ? 'z-' : 'z+', x)) posts.push([x, z])
  for (const z of [-0.4, 0.4]) for (const x of [-2.95, 2.95]) if (!inGap(x < 0 ? 'x-' : 'x+', z)) posts.push([x, z])
  const rails = []
  for (const [side, fixed, from, to] of RAIL_SIDES) {
    const runs = gap?.side === side ? [[from, gap.from], [gap.to, to]] : [[from, to]]
    for (const [a, b] of runs) {
      if (b - a < 0.05) continue
      const mid = (a + b) / 2
      const alongX = side[0] === 'z'
      rails.push({ size: alongX ? [b - a + 0.06, 0.05, 0.05] : [0.05, 0.05, b - a + 0.06], at: alongX ? [mid, fixed] : [fixed, mid] })
    }
  }
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      {[-1, 1].map((s) => (
        <Box key={s} size={[0.32, 0.5, r * 2]} position={[s * body * 0.32, 0.25, 0]} material={materials.hazardStripe()} tile={1} />
      ))}
      <Cyl r={r} h={body} segments={28} position={[0, cy, 0]} rotation={[0, 0, Math.PI / 2]} material={white} tile={3} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={domeGeo} material={white} position={[s * (body / 2), cy, 0]} scale={[r * 0.5, r, r]} castShadow receiveShadow />
      ))}
      {[-0.25, 0.25].map((f) => (
        <Cyl key={f} r={r + 0.02} h={0.06} segments={28} position={[f * body, cy, 0]} rotation={[0, 0, Math.PI / 2]} material={materials.rust()} shadow={false} />
      ))}
      <Cyl r={0.12} h={0.35} position={[0.4, cy + r + 0.12, 0]} material={materials.steelDark()} />
      {/* Yellow guard rail round the deck edge */}
      {posts.map(([x, z], i) => (
        <Box key={i} size={[0.06, 1.05, 0.06]} position={[x, 0.52, z]} material={yellow} shadow={false} />
      ))}
      {[0.55, 1.05].map((y) =>
        rails.map((rl, i) => <Box key={`${y}:${i}`} size={rl.size} position={[rl.at[0], y, rl.at[1]]} material={yellow} shadow={false} />),
      )}
    </group>
  )
}

/* ---------------------------------------------------------------------------
 * Ground detail: dirt tracks with tyre marks, oil stains, concrete pads
 * ------------------------------------------------------------------------- */

const GROUND = 64
const GROUND_PX = 2048
const toPx = (v) => ((v + GROUND / 2) / GROUND) * GROUND_PX
const M = GROUND_PX / GROUND

/** Polyline offset sideways by `off` metres (per-vertex averaged normals). */
function offsetLine(pts, off) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(pts.length - 1, i + 1)]
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const len = Math.hypot(dx, dz) || 1
    return [p[0] - (dz / len) * off, p[1] + (dx / len) * off]
  })
}

function strokeLine(ctx, pts) {
  ctx.beginPath()
  pts.forEach(([x, z], i) => (i ? ctx.lineTo(toPx(x), toPx(z)) : ctx.moveTo(toPx(x), toPx(z))))
  ctx.stroke()
}

/** Smooths a coarse polyline (Chaikin) so tracks curve instead of kinking. */
function smoothLine(pts, rounds = 3) {
  let out = pts
  for (let r = 0; r < rounds; r++) {
    const next = [out[0]]
    for (let i = 0; i < out.length - 1; i++) {
      const [ax, az] = out[i]
      const [bx, bz] = out[i + 1]
      next.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25], [ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75])
    }
    next.push(out[out.length - 1])
    out = next
  }
  return out
}

const TRACKS = [
  // Turnaround loop round the tower.
  Array.from({ length: 49 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2
    return [Math.cos(a) * 7.6, Math.sin(a) * 7.6]
  }),
  [[-7.6, 0.4], [-11, 1.2], [-15.5, 0.6]],
  [[0.4, 7.6], [1.4, 11], [2, 14.6]],
  [[5.4, -5.4], [8.6, -8.8], [11.6, -12.2]],
  [[-5.4, 5.4], [-8.4, 8.2], [-10.8, 9.4]],
  [[7.6, 0.2], [12, 1.2], [19, 2.6]],
  [[0.2, -7.6], [-0.9, -12], [-2.4, -16.5]],
]
const STAINS = [
  [-14, -14, 1.6],
  [-12.6, -15.2, 0.8],
  [13, -15.6, 1.2],
  [20.2, -15.6, 1.0],
  [14.5, 18.3, 1.3],
  [0.9, 1.3, 0.9],
  [-0.8, -1.2, 0.7],
  [16.2, -21, 0.9],
  [-23, 7, 0.8],
  [5, -3, 0.5],
]

function groundTexture() {
  const c = document.createElement('canvas')
  c.width = GROUND_PX
  c.height = GROUND_PX
  const ctx = c.getContext('2d')
  const rand = seededRandom(4049)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const raw of TRACKS) {
    const pts = raw.length > 20 ? raw : smoothLine(raw)
    // Compacted dirt under the tracks.
    ctx.strokeStyle = 'rgba(112, 84, 56, 0.13)'
    ctx.lineWidth = 3.6 * M
    strokeLine(ctx, pts)
    ctx.strokeStyle = 'rgba(112, 84, 56, 0.1)'
    ctx.lineWidth = 2.4 * M
    strokeLine(ctx, pts)
    // Two tyre ruts with tread marks.
    for (const off of [-0.82, 0.82]) {
      const rut = offsetLine(pts, off)
      ctx.setLineDash([])
      ctx.strokeStyle = 'rgba(86, 62, 42, 0.32)'
      ctx.lineWidth = 0.34 * M
      strokeLine(ctx, rut)
      ctx.setLineDash([0.12 * M, 0.1 * M])
      ctx.strokeStyle = 'rgba(62, 44, 30, 0.35)'
      ctx.lineWidth = 0.26 * M
      strokeLine(ctx, rut)
    }
    ctx.setLineDash([])
  }
  // Oil and diesel stains: overlapping soft blobs.
  for (const [x, z, r] of STAINS) {
    for (let k = 0; k < 5; k++) {
      const cx = toPx(x + (rand() - 0.5) * r)
      const cz = toPx(z + (rand() - 0.5) * r)
      const rr = (0.4 + rand() * 0.6) * r * M
      const g = ctx.createRadialGradient(cx, cz, 0, cx, cz, rr)
      g.addColorStop(0, 'rgba(28, 22, 18, 0.5)')
      g.addColorStop(0.6, 'rgba(40, 30, 22, 0.28)')
      g.addColorStop(1, 'rgba(40, 30, 22, 0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(cx, cz, rr, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  // Wind-blown light and dark patches so the sand isn't one flat tone.
  for (let k = 0; k < 90; k++) {
    const cx = rand() * GROUND_PX
    const cz = rand() * GROUND_PX
    const rr = (1.5 + rand() * 4) * M
    const dark = rand() < 0.5
    const g = ctx.createRadialGradient(cx, cz, 0, cx, cz, rr)
    g.addColorStop(0, dark ? 'rgba(140, 104, 66, 0.12)' : 'rgba(246, 224, 186, 0.14)')
    g.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cz, rr, 0, Math.PI * 2)
    ctx.fill()
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  return t
}

const PADS = [
  { p: [0, 0, 0], size: [6.2, 6.2] },
  { p: [16.6, 0, -19], size: [15, 8.4] },
  { p: [14.5, 0, 17], size: [3.4, 2.4] },
]

export function Ground() {
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        map: groundTexture(),
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        roughness: 1,
      }),
    [],
  )
  const geo = useMemo(() => {
    const g = new PlaneGeometry(GROUND, GROUND)
    g.rotateX(-Math.PI / 2)
    return g
  }, [])
  return (
    <group>
      <mesh geometry={geo} material={material} position={[0, 0.012, 0]} receiveShadow />
      {PADS.map((pad, i) => (
        <Box key={i} size={[pad.size[0], 0.05, pad.size[1]]} position={[pad.p[0], 0.025, pad.p[2]]} material={materials.slab()} tile={3} shadow={false} />
      ))}
    </group>
  )
}
