import { useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute, PlaneGeometry } from 'three'

import { seededRandom } from '../../shared/math.js'
import { useMerged } from './geometryUtils.js'
import { boxGeo, materials } from './materials.js'
import { Box, Cyl } from './parts.jsx'
import { Pipe } from './structures.jsx'

/*
 * Everything beyond the perimeter wall: a rail spur with graffiti-covered
 * boxcars, white storage tanks, a big ground pipeline and hazy ridges on the
 * horizon. None of it is reachable, so none of it has colliders.
 */

const RAIL_X = 41
const tagGeo = new PlaneGeometry(4.2, 4.2)

function Boxcar({ p, color, tags }) {
  const L = 12.5
  const W = 3.0
  const H = 3.3
  const y0 = 1.15
  const skin = materials.corrugated(color)
  return (
    // Length runs along world z; local -z faces the map.
    <group position={p} rotation={[0, Math.PI / 2, 0]}>
      <Box size={[L, H, W]} position={[0, y0 + H / 2, 0]} material={skin} tile={2.4} />
      <Box size={[L + 0.1, 0.14, W + 0.12]} position={[0, y0 + H + 0.07, 0]} material={materials.rust()} tile={2} />
      <Box size={[L - 0.4, 0.3, W - 0.5]} position={[0, y0 - 0.1, 0]} material={materials.steelDark()} />
      <Box size={[2.8, H - 0.3, 0.06]} position={[0.6, y0 + H / 2 - 0.05, -W / 2 - 0.04]} material={materials.corrugated('#5d544a')} tile={2.4} />
      <Box size={[3.4, 0.08, 0.08]} position={[0.6, y0 + H - 0.1, -W / 2 - 0.08]} material={materials.steelDark()} shadow={false} />
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (L / 2 - 2.2), 0, 0]}>
          <Box size={[2.4, 0.45, 2.1]} position={[0, 0.68, 0]} material={materials.steelDark()} />
          {[-0.75, 0.75].map((x) =>
            [-1, 1].map((z) => (
              <Cyl key={`${x}${z}`} r={0.43} h={0.12} segments={14} position={[x, 0.45, z * 0.78]} rotation={[Math.PI / 2, 0, 0]} material={materials.rubber()} />
            )),
          )}
        </group>
      ))}
      {tags.map((t, i) => (
        <mesh key={i} geometry={tagGeo} material={materials.graffiti(t)} position={[(i - (tags.length - 1) / 2) * 4.6, y0 + 1.7, -W / 2 - 0.03]} rotation={[0, Math.PI, 0]} />
      ))}
    </group>
  )
}

function Railway() {
  const sleepers = useMemo(() => {
    const out = []
    for (let z = -72; z <= 72; z += 0.9) out.push({ geometry: boxGeo(2.5, 0.12, 0.24, 1), position: [RAIL_X, 0.26, z] })
    return out
  }, [])
  const sleeperGeo = useMerged(sleepers)
  return (
    <group>
      <Box size={[3.8, 0.24, 146]} position={[RAIL_X, 0.08, 0]} material={materials.concreteDark()} tile={3} shadow={false} />
      <mesh geometry={sleeperGeo} material={materials.wood()} receiveShadow />
      {[-0.72, 0.72].map((x) => (
        <Box key={x} size={[0.09, 0.15, 146]} position={[RAIL_X + x, 0.4, 0]} material={materials.steel()} tile={2} shadow={false} />
      ))}
    </group>
  )
}

function StorageTanks() {
  const tanks = [
    { p: [47, 0, 43], r: 3.4, h: 10 },
    { p: [55, 0, 34], r: 2.8, h: 8 },
    { p: [40, 0, 53], r: 3.0, h: 11 },
  ]
  return (
    <group>
      {tanks.map((t, i) => (
        <group key={i} position={t.p}>
          <Cyl r={t.r} h={t.h} segments={36} position={[0, t.h / 2, 0]} material={materials.tankWhite()} tile={3} />
          <Cyl r={t.r + 0.05} rTop={0.4} h={0.9} segments={36} position={[0, t.h + 0.45, 0]} material={materials.tankWhite()} tile={3} />
          {[0.33, 0.66].map((f) => (
            <Cyl key={f} r={t.r + 0.03} h={0.1} segments={36} position={[0, t.h * f, 0]} material={materials.rust()} shadow={false} />
          ))}
          {/* Spiral-ish access ladder on the map side */}
          <Box size={[0.5, t.h, 0.08]} position={[-t.r - 0.12, t.h / 2, 0]} material={materials.hazard()} shadow={false} />
        </group>
      ))}
      {/* Horizontal tanks on cradles, like the ones on the container decks */}
      {[[33, 0, 46], [36, 0, 40]].map((p, i) => (
        <group key={i} position={p} rotation={[0, 0.3 + i * 0.4, 0]}>
          <Cyl r={1.2} h={5.5} segments={24} position={[0, 1.6, 0]} rotation={[0, 0, Math.PI / 2]} material={materials.tankWhite()} tile={3} />
          {[-1.8, 1.8].map((x) => (
            <Box key={x} size={[0.4, 0.9, 2.0]} position={[x, 0.45, 0]} material={materials.hazard()} />
          ))}
        </group>
      ))}
    </group>
  )
}

function GroundPipeline() {
  const saddles = useMemo(() => {
    const out = []
    for (let z = -66; z <= 66; z += 7) out.push({ geometry: boxGeo(2.6, 0.7, 1.0, 1.5), position: [-40, 0.35, z] })
    return out
  }, [])
  const saddleGeo = useMerged(saddles)
  return (
    <group>
      <Pipe a={[-40, 1.65, -72]} b={[-40, 1.65, 72]} r={1.1} material={materials.pipe()} />
      <mesh geometry={saddleGeo} material={materials.concreteDark()} castShadow receiveShadow />
    </group>
  )
}

/** A continuous ring of eroded hills on the horizon, fading into the haze. */
function Ridges() {
  const geo = useMemo(() => {
    const rand = seededRandom(1201)
    const waves = Array.from({ length: 7 }, (_, i) => ({ f: 2 + i * 2 + Math.floor(rand() * 3), ph: rand() * 6.28, amp: 1 / (1 + i * 0.8) }))
    const ridge = (a) => {
      let h = 0
      let norm = 0
      for (const w of waves) {
        h += Math.sin(a * w.f + w.ph) * w.amp
        norm += w.amp
      }
      return 0.5 + 0.5 * (h / norm)
    }
    const A = 240
    const R = 10
    const r0 = 88
    const r1 = 165
    const pos = []
    const idx = []
    for (let i = 0; i <= A; i++) {
      const a = (i / A) * Math.PI * 2
      const peak = 6 + 26 * ridge(a) ** 1.6
      const crest = 112 + 14 * Math.sin(a * 3 + 1.3)
      for (let j = 0; j <= R; j++) {
        const r = r0 + ((r1 - r0) * j) / R
        // Smooth bump across the ring, peaking along the crest line.
        const t = (r - crest) / (r < crest ? crest - r0 : r1 - crest)
        const y = peak * Math.max(0, 1 - t * t) ** 1.5 - 2
        pos.push(Math.cos(a) * r, y, Math.sin(a) * r)
      }
    }
    for (let i = 0; i < A; i++) {
      for (let j = 0; j < R; j++) {
        const p = i * (R + 1) + j
        const q = p + R + 1
        idx.push(p, q, p + 1, q, q + 1, p + 1)
      }
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  }, [])
  return <mesh geometry={geo} material={materials.ridge()} />
}

export function Outskirts() {
  return (
    <group>
      <Railway />
      <Boxcar p={[RAIL_X, 0.35, -20]} color="#8a3b26" tags={[0, 1]} />
      <Boxcar p={[RAIL_X, 0.35, -6]} color="#4e5f3c" tags={[2]} />
      <Boxcar p={[RAIL_X, 0.35, 8]} color="#6b4a32" tags={[3, 4]} />
      <Boxcar p={[RAIL_X, 0.35, 34]} color="#2f4f6a" tags={[1]} />
      <StorageTanks />
      <GroundPipeline />
      <Ridges />
    </group>
  )
}

export default Outskirts
