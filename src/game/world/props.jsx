import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { DoubleSide, ExtrudeGeometry, MeshStandardMaterial, Object3D, PlaneGeometry, Shape, SphereGeometry } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

import { yawOffset } from '../../shared/map.js'
import { seededRandom } from '../../shared/math.js'
import { BARREL_COLORS, materials } from './materials.js'
import { Outskirts } from './outskirts.jsx'
import { Box, Cyl } from './parts.jsx'
import { frondTexture } from './textures.js'

export function Crate({ p, size, rotY }) {
  const s = size
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      <Box size={[s, s, s]} position={[0, s / 2, 0]} material={materials.wood()} tile={1} />
      {/* Darker edge battens */}
      {[-1, 1].map((x) =>
        [-1, 1].map((z) => (
          <Box key={`${x}${z}`} size={[0.08, s + 0.01, 0.08]} position={[x * (s / 2 - 0.035), s / 2, z * (s / 2 - 0.035)]} material={materials.steelDark()} shadow={false} />
        )),
      )}
    </group>
  )
}

export function Barrel({ p, color, tipped = false }) {
  const m = materials.barrel(BARREL_COLORS[color] ?? '#777')
  return (
    <group position={[p[0], p[1] ?? 0, p[2]]} rotation={tipped ? [Math.PI / 2, 0, 0.4] : [0, 0, 0]}>
      <Cyl r={0.3} h={0.9} segments={18} position={[0, 0.45, 0]} material={m} tile={1} />
      {[0.3, 0.6].map((y) => (
        <Cyl key={y} r={0.312} h={0.035} segments={18} position={[0, y, 0]} material={materials.steelDark()} shadow={false} />
      ))}
    </group>
  )
}

let barrierGeo = null
function getBarrierGeo(length) {
  if (barrierGeo) return barrierGeo
  // Jersey-barrier profile: wide foot, sloped face, narrow cap.
  const s = new Shape()
  s.moveTo(-0.31, 0)
  s.lineTo(0.31, 0)
  s.lineTo(0.31, 0.08)
  s.lineTo(0.2, 0.3)
  s.lineTo(0.1, 1.0)
  s.lineTo(-0.1, 1.0)
  s.lineTo(-0.2, 0.3)
  s.lineTo(-0.31, 0.08)
  s.closePath()
  const g = new ExtrudeGeometry(s, { depth: length, bevelEnabled: false })
  g.translate(0, 0, -length / 2)
  g.rotateY(Math.PI / 2)
  // Extrude UVs are in shape units; scale them down for the concrete tile.
  const uv = g.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2, uv.getY(i) / 2)
  barrierGeo = g
  return g
}

export function Barrier({ p, rotY, length }) {
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      <mesh geometry={getBarrierGeo(length)} material={materials.concrete()} castShadow receiveShadow />
      {[-1, 1].map((s) => (
        <Box key={s} size={[0.3, 0.12, 0.21]} position={[s * (length / 2 - 0.2), 0.93, 0]} material={materials.hazard()} shadow={false} />
      ))}
    </group>
  )
}

const bagGeo = new RoundedBoxGeometry(0.58, 0.2, 0.34, 2, 0.08)

export function Sandbags({ p, rotY, length }) {
  const layout = useMemo(() => {
    const out = []
    const layers = 5
    for (let l = 0; l < layers; l++) {
      const offset = l % 2 ? 0.29 : 0
      for (const row of [-0.17, 0.17]) {
        for (let x = -length / 2 + 0.29 + offset; x <= length / 2 - 0.25; x += 0.56) {
          out.push([x, 0.1 + l * 0.19, row, (l * 7 + x * 13) % 0.2])
        }
      }
    }
    return out
  }, [length])
  const setRef = (mesh) => {
    if (!mesh) return
    const o = new Object3D()
    layout.forEach(([x, y, z, r], i) => {
      o.position.set(x, y, z)
      o.rotation.set(0, r - 0.1, 0)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      <instancedMesh ref={setRef} args={[bagGeo, materials.burlap(), layout.length]} castShadow receiveShadow />
    </group>
  )
}

export function Generator({ p, rotY }) {
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      <Box size={[2.2, 0.2, 1.2]} position={[0, 0.1, 0]} material={materials.steelDark()} />
      <Box size={[2.1, 1.15, 1.1]} position={[0, 0.78, 0]} material={materials.corrugated('#b0892e')} tile={1.2} />
      <Box size={[0.05, 0.8, 0.8]} position={[1.08, 0.8, 0]} material={materials.grate()} tile={0.6} />
      <Cyl r={0.08} h={0.7} position={[-0.7, 1.65, 0.3]} material={materials.rust()} />
      <Box size={[0.6, 0.25, 0.4]} position={[0.3, 1.48, -0.2]} material={materials.steel()} />
    </group>
  )
}

export function Truck({ p, rotY }) {
  const body = materials.burnt()
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      {[[-0.85, -1.6], [0.85, -1.6], [-0.85, 1.3], [0.85, 1.3]].map(([x, z], i) => (
        <Cyl key={i} r={0.38} h={0.3} segments={14} position={[x, i === 2 ? 0.3 : 0.38, z]} rotation={[0, 0, Math.PI / 2]} material={materials.rubber()} />
      ))}
      <Box size={[1.6, 0.25, 4.4]} position={[0, 0.45, -0.35]} material={materials.steelDark()} />
      <Box size={[1.9, 0.5, 4.5]} position={[0, 0.82, -0.05]} material={body} tile={1.5} />
      <Box size={[1.85, 0.32, 0.9]} position={[0, 1.2, -1.8]} rotation={[0.05, 0, 0]} material={body} tile={1.5} />
      <Box size={[1.85, 0.85, 0.78]} position={[0, 1.5, -0.98]} material={body} tile={1.5} />
      <Box size={[1.7, 0.45, 0.04]} position={[0, 1.65, -1.38]} material={materials.rubber()} shadow={false} />
      {/* Cab burnt out: the roof is gone and the seats still glow. */}
      <Box size={[1.6, 0.04, 0.6]} position={[0, 1.94, -0.98]} material={materials.ember()} shadow={false} />
      <Box size={[1.9, 0.1, 2.8]} position={[0, 1.08, 0.85]} material={body} tile={1.5} />
      {[-1, 1].map((s) => (
        <Box key={s} size={[0.08, 0.4, 2.8]} position={[s * 0.91, 1.3, 0.85]} material={body} tile={1.5} />
      ))}
      <Box size={[1.9, 0.4, 0.08]} position={[0, 1.3, 2.22]} rotation={[0.5, 0, 0]} material={body} tile={1.5} />
      <Barrel p={[0.3, 1.13, 0.6]} color="blue" tipped />
    </group>
  )
}

export function Scrap({ p, rotY }) {
  const pieces = useMemo(() => {
    const rand = seededRandom(Math.round((p[0] + 31) * 17 + (p[2] + 57) * 7))
    return Array.from({ length: 6 }, () => ({
      size: [0.8 + rand() * 1.2, 0.04, 0.6 + rand() * 0.8],
      pos: [(rand() - 0.5) * 1.8, 0.2 + rand() * 0.8, (rand() - 0.5) * 1.0],
      rot: [(rand() - 0.5) * 1.6, rand() * 3, (rand() - 0.5) * 1.6],
    }))
  }, [p])
  const at = yawOffset([0, 0, 0], 1.1, 0.9, 0)
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      <group rotation={[0, 0.2, 0]}>
        <Box size={[2.3, 0.5, 1.3]} position={[0, 0.25, 0]} material={materials.rust()} tile={1} />
        {pieces.map((piece, i) => (
          <Box key={i} size={piece.size} position={piece.pos} rotation={piece.rot} material={i % 2 ? materials.rust() : materials.corrugated('#7f7a70')} tile={1} />
        ))}
      </group>
      {[0, 0.24, 0.48].map((y) => (
        <mesh key={y} position={[at[0], 0.12 + y, at[2]]} rotation={[Math.PI / 2, 0, 0]} material={materials.rubber()} castShadow>
          <torusGeometry args={[0.36, 0.13, 8, 16]} />
        </mesh>
      ))}
    </group>
  )
}

const frondGeo = new PlaneGeometry(2.6, 0.9)
frondGeo.translate(1.3, 0, 0)

// Shared by every palm so they batch together.
const frondMat = new MeshStandardMaterial({ map: frondTexture(), alphaTest: 0.4, side: DoubleSide, roughness: 1 })

export function Palm({ p, h, lean }) {
  const segments = 6
  const parts = useMemo(() => {
    const out = []
    let x = 0
    let y = 0
    for (let i = 0; i < segments; i++) {
      const segH = h / segments
      const ang = lean * (i / segments) * 1.6
      out.push({ pos: [x + Math.sin(ang) * segH * 0.5, y + segH / 2, 0], rot: [0, 0, -ang], r: 0.21 - i * 0.012 })
      x += Math.sin(ang) * segH
      y += Math.cos(ang) * segH
    }
    return { trunk: out, top: [x, y, 0] }
  }, [h, lean])
  return (
    <group position={p} rotation={[0, (p[0] * 7 + p[2] * 3) % 6.28, 0]}>
      {parts.trunk.map((s, i) => (
        <Cyl key={i} r={s.r} rTop={s.r - 0.012} h={h / segments + 0.05} segments={8} position={s.pos} rotation={s.rot} material={materials.palmTrunk()} tile={1} />
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <mesh
          key={i}
          geometry={frondGeo}
          material={frondMat}
          position={parts.top}
          rotation={[0.9 + (i % 3) * 0.25, (i / 9) * Math.PI * 2, -0.35 - (i % 2) * 0.35]}
          castShadow
        />
      ))}
    </group>
  )
}

/** Oil pumpjack with a rocking beam (purely decorative motion). */
export function Pumpjack({ p, rotY }) {
  const beam = useRef(null)
  const crank = useRef(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.9
    if (beam.current) beam.current.rotation.z = Math.sin(t) * 0.22
    if (crank.current) crank.current.rotation.z = -t
  })
  const steel = materials.steelDark()
  const paint = materials.corrugated('#9a6a2a')
  return (
    // Animated parts: keep out of static batching.
    <group position={p} rotation={[0, rotY, 0]} userData={{ dynamic: true }}>
      <Box size={[5.2, 0.6, 1.5]} position={[0, 0.3, 0]} material={materials.concreteDark()} />
      {/* Samson post (A-frame) */}
      {[-1, 1].map((s) => (
        <Box key={s} size={[0.22, 3.9, 0.22]} position={[0.3, 2.45, s * 0.42]} rotation={[s * 0.16, 0, 0]} material={paint} tile={1} />
      ))}
      <Box size={[0.5, 0.3, 1.2]} position={[0.3, 0.75, 0]} material={steel} />
      <group ref={beam} position={[0.3, 4.4, 0]}>
        <Box size={[5.4, 0.36, 0.32]} position={[0, 0, 0]} material={paint} tile={1.5} />
        {/* Horse head */}
        <Box size={[0.5, 1.4, 0.4]} position={[2.85, -0.45, 0]} rotation={[0, 0, 0.12]} material={paint} tile={1} />
        <Box size={[0.06, 3.6, 0.06]} position={[3.05, -2.3, 0]} material={steel} shadow={false} />
        <Box size={[0.3, 0.3, 0.5]} position={[-2.4, -0.25, 0]} material={steel} />
      </group>
      <group ref={crank} position={[-2.0, 1.6, 0]}>
        <Box size={[1.6, 0.35, 0.18]} position={[0.2, 0, 0.45]} material={steel} />
        <Box size={[1.6, 0.35, 0.18]} position={[0.2, 0, -0.45]} material={steel} />
        <Box size={[0.6, 0.9, 1.1]} position={[0.8, 0, 0]} material={materials.rust()} />
      </group>
      <Box size={[1.2, 1.2, 1.2]} position={[-2.0, 0.9, 0]} material={materials.machine()} tile={1} />
    </group>
  )
}

export function Desk({ p, size, rotY }) {
  const [w, h, d] = size
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      <Box size={[w, 0.06, d]} position={[0, h - 0.03, 0]} material={materials.wood()} tile={1} />
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
        <Box key={`${sx}${sz}`} size={[0.06, h - 0.06, 0.06]} position={[sx * (w / 2 - 0.05), (h - 0.06) / 2, sz * (d / 2 - 0.05)]} material={materials.steelDark()} />
      ))}
      <Box size={[0.5, 0.35, 0.4]} position={[0.3, h + 0.17, 0]} material={materials.steel()} />
      <Box size={[0.35, 0.02, 0.25]} position={[-0.35, h + 0.01, 0.1]} rotation={[0, 0.3, 0]} material={materials.plaster()} shadow={false} />
    </group>
  )
}

export function Lockers({ p, size, rotY }) {
  const [w, h, d] = size
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      <Box size={size} position={[0, h / 2, 0]} material={materials.corrugated('#56606a')} tile={1} />
      {[-0.5, 0, 0.5].map((z) => (
        <Box key={z} size={[0.02, h - 0.1, 0.02]} position={[-w / 2 - 0.005, h / 2, z * (d / 1.5)]} material={materials.steelDark()} shadow={false} />
      ))}
    </group>
  )
}

export function AmmoCrate({ p, size, rotY }) {
  const [w, h, d] = size
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      <Box size={size} position={[0, h / 2, 0]} material={materials.ammoGreen()} tile={1} />
      <Box size={[w + 0.01, 0.08, d + 0.01]} position={[0, h * 0.7, 0]} material={materials.hazard()} shadow={false} />
      <Box size={[0.16, 0.04, 0.05]} position={[0, h + 0.02, 0]} material={materials.steelDark()} shadow={false} />
    </group>
  )
}

/* ---------------------------------------------------------------------------
 * Ground and the desert beyond the walls
 * ------------------------------------------------------------------------- */

const groundGeo = (() => {
  const g = new PlaneGeometry(320, 320, 1, 1)
  const uv = g.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 64, uv.getY(i) * 64)
  g.rotateX(-Math.PI / 2)
  return g
})()

export function Backdrop() {
  const dunes = useMemo(() => {
    const rand = seededRandom(997)
    const out = []
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + rand() * 0.2
      const r = 64 + rand() * 30
      out.push({
        pos: [Math.cos(a) * r, -1.5 - rand() * 2, Math.sin(a) * r],
        scale: [9 + rand() * 7, 3 + rand() * 6, 8 + rand() * 7],
        rotY: rand() * Math.PI,
      })
    }
    return out
  }, [])
  const palms = useMemo(() => {
    const rand = seededRandom(733)
    return Array.from({ length: 10 }, () => {
      const a = rand() * Math.PI * 2
      const r = 40 + rand() * 22
      return { p: [Math.cos(a) * r, 0, Math.sin(a) * r], h: 5 + rand() * 4, lean: (rand() - 0.5) * 0.6 }
    })
  }, [])
  const duneGeo = useMemo(() => new SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), [])
  return (
    <group>
      <mesh geometry={groundGeo} material={materials.sand()} receiveShadow />
      {dunes.map((d, i) => (
        <mesh key={i} geometry={duneGeo} material={materials.sand()} position={d.pos} scale={d.scale} rotation={[0, d.rotY, 0]} receiveShadow />
      ))}
      {palms.map((palm, i) => (
        <Palm key={i} {...palm} />
      ))}
      <Outskirts />
      {/* Distant derricks on the skyline */}
      {[[-70, -50], [75, -38], [50, 72], [-60, 66]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          {[-1, 1].map((sx) =>
            [-1, 1].map((sz) => (
              <Box key={`${sx}${sz}`} size={[0.3, 16, 0.3]} position={[sx * 1.6, 8, sz * 1.6]} rotation={[sz * 0.08, 0, -sx * 0.08]} material={materials.tower()} shadow={false} />
            )),
          )}
          <Box size={[1.2, 1.2, 1.2]} position={[0, 16, 0]} material={materials.tower()} shadow={false} />
        </group>
      ))}
    </group>
  )
}
