import { useMemo } from 'react'
import {
  AdditiveBlending,
  BufferGeometry,
  DodecahedronGeometry,
  DoubleSide,
  Float32BufferAttribute,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SpriteMaterial,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { buildColliders, MAP_HALF, POWER_LINES } from '../../shared/map.js'
import { rotate3, seededRandom } from '../../shared/math.js'
import { cylGeo, instancedVariant, materials } from './materials.js'
import { Box, Cyl } from './parts.jsx'
import { shrubTexture, softDotTexture } from './textures.js'

/* ---------------------------------------------------------------------------
 * Burnt-out APC
 * ------------------------------------------------------------------------- */

export function Apc({ p, rotY }) {
  const hull = materials.burnt()
  const dark = materials.charred()
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      {[-1, 1].map((side) =>
        [-2.0, -0.7, 0.6, 1.9].map((z, i) => (
          <Cyl key={`${side}${i}`} r={0.52} h={0.38} segments={14} position={[side * 1.12, 0.52, z]} rotation={[0, 0, Math.PI / 2]} material={i === 1 && side === 1 ? dark : materials.rubber()} tile={1} />
        )),
      )}
      <Box size={[2.3, 0.9, 5.3]} position={[0, 1.0, 0]} material={hull} tile={1.5} />
      <Box size={[2.6, 0.7, 4.4]} position={[0, 1.7, 0.45]} material={hull} tile={1.5} />
      {/* Sloped glacis at the front. */}
      <Box size={[2.5, 0.12, 1.3]} position={[0, 1.55, -2.15]} rotation={[-0.62, 0, 0]} material={hull} tile={1.5} />
      <group position={[0, 2.05, 0.4]} rotation={[0, 0.8, 0]}>
        <Box size={[1.4, 0.6, 1.5]} position={[0, 0.3, 0]} material={hull} tile={1.2} />
        {/* Barrel, knocked off line. */}
        <Cyl r={0.07} h={2.0} position={[0, 0.32, -1.6]} rotation={[Math.PI / 2 - 0.25, 0, 0.1]} material={dark} />
        <Cyl r={0.32} h={0.12} position={[0.3, 0.66, 0.2]} material={dark} />
      </group>
      {/* Hatch blown open: the fire inside glows through. */}
      <Box size={[0.9, 0.04, 0.9]} position={[-0.6, 2.06, -1.0]} material={materials.ember()} shadow={false} />
      {/* Scorch-blackened side and a torn armour plate on the ground. */}
      <Box size={[0.02, 0.8, 2.4]} position={[1.31, 1.7, -0.2]} material={dark} shadow={false} />
      <Box size={[1.1, 0.06, 0.8]} position={[1.9, 0.1, 1.4]} rotation={[0.1, 0.5, 0.15]} material={hull} />
    </group>
  )
}

/* ---------------------------------------------------------------------------
 * Concrete culvert sections, boulders
 * ------------------------------------------------------------------------- */

export function Culvert({ p, rotY }) {
  return (
    <group position={[p[0], 0.85, p[2]]} rotation={[0, rotY, 0]}>
      <mesh geometry={cylGeo(0.85, 2.4, 24, 2, true)} material={materials.concrete()} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow />
      <mesh geometry={cylGeo(0.7, 2.39, 24, 2, true)} material={materials.pipeInside()} rotation={[Math.PI / 2, 0, 0]} />
      {[-1.2, 1.2].map((z) => (
        <mesh key={z} position={[0, 0, z]} material={materials.concreteDark()}>
          <ringGeometry args={[0.7, 0.85, 24]} />
        </mesh>
      ))}
    </group>
  )
}

const rockGeo = new DodecahedronGeometry(1, 0)

export function Rock({ p, size }) {
  const s = size
  return (
    <mesh
      geometry={rockGeo}
      material={materials.rock()}
      position={[p[0], s * 0.22, p[2]]}
      scale={[s * 0.55, s * 0.45, s * 0.5]}
      rotation={[0.3, (p[0] * 13 + p[2] * 7) % 6.28, 0.2]}
      castShadow
      receiveShadow
    />
  )
}

/* ---------------------------------------------------------------------------
 * Power poles, wires, lamp posts
 * ------------------------------------------------------------------------- */

export function Pole({ p }) {
  return (
    <group position={[p[0], 0, p[2]]}>
      <Cyl r={0.13} rTop={0.1} h={7} segments={8} position={[0, 3.5, 0]} material={materials.palmTrunk()} tile={1} />
      <Box size={[1.8, 0.12, 0.12]} position={[0, 6.6, 0]} material={materials.palmTrunk()} tile={1} />
      {[-0.75, 0, 0.75].map((x) => (
        <Cyl key={x} r={0.04} h={0.14} position={[x, 6.73, 0]} material={materials.steel()} shadow={false} />
      ))}
    </group>
  )
}

/** Sagging wires between consecutive poles, as one line set. */
export function PowerLines({ lines = POWER_LINES }) {
  const geo = useMemo(() => {
    const pts = []
    for (const line of lines) {
      for (let i = 0; i < line.length - 1; i++) {
        const [ax, az] = line[i]
        const [bx, bz] = line[i + 1]
        const along = [bx - ax, bz - az]
        const len = Math.hypot(along[0], along[1])
        const perp = [-along[1] / len, along[0] / len]
        for (const off of [-0.75, 0, 0.75]) {
          let prev = null
          for (let k = 0; k <= 16; k++) {
            const t = k / 16
            const sag = Math.sin(t * Math.PI) * 0.9
            const pt = [ax + along[0] * t + perp[0] * off, 6.78 - sag, az + along[1] * t + perp[1] * off]
            if (prev) pts.push(...prev, ...pt)
            prev = pt
          }
        }
      }
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pts, 3))
    return g
  }, [lines])
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#1c1916" />
    </lineSegments>
  )
}

const glowMat = new SpriteMaterial({ map: softDotTexture(), color: '#ffcf80', blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 })

export function Lamp({ p }) {
  return (
    <group position={[p[0], 0, p[2]]}>
      <Cyl r={0.1} rTop={0.07} h={4.4} segments={8} position={[0, 2.2, 0]} material={materials.steelDark()} tile={1} />
      <Box size={[0.08, 0.08, 1.0]} position={[0, 4.35, -0.45]} material={materials.steelDark()} />
      <Box size={[0.32, 0.12, 0.45]} position={[0, 4.28, -0.95]} material={materials.steelDark()} />
      <Box size={[0.26, 0.03, 0.36]} position={[0, 4.21, -0.95]} material={materials.lampGlow()} shadow={false} />
      <sprite material={glowMat} position={[0, 4.1, -0.95]} scale={[1.6, 1.6, 1]} />
    </group>
  )
}

/* ---------------------------------------------------------------------------
 * Camouflage net over the sandbag nest
 * ------------------------------------------------------------------------- */

export function CamoNet({ p, size, height }) {
  const [w, d] = size
  const geo = useMemo(() => {
    const g = new PlaneGeometry(w + 0.6, d + 0.6, 12, 12)
    g.rotateX(-Math.PI / 2)
    const pos = g.getAttribute('position')
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / ((w + 0.6) / 2)
      const z = pos.getZ(i) / ((d + 0.6) / 2)
      // Sags between the poles and droops past the edges.
      const edge = Math.max(Math.abs(x), Math.abs(z))
      pos.setY(i, -Math.cos(x * Math.PI * 0.5) * Math.cos(z * Math.PI * 0.5) * 0.25 - Math.max(0, edge - 0.85) * 1.6)
    }
    g.computeVertexNormals()
    return g
  }, [w, d])
  return (
    <group position={[p[0], height, p[2]]}>
      <mesh geometry={geo} material={materials.camo()} castShadow receiveShadow />
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
        <Cyl key={`${sx}${sz}`} r={0.05} h={height} segments={6} position={[(sx * w) / 2, -height / 2, (sz * d) / 2]} material={materials.palmTrunk()} tile={1} />
      ))}
    </group>
  )
}

/* ---------------------------------------------------------------------------
 * Scattered shrubs and pebbles (visual only)
 * ------------------------------------------------------------------------- */

const shrubGeo = (() => {
  const a = new PlaneGeometry(1, 0.8)
  a.translate(0, 0.4, 0)
  const b = a.clone().rotateY(Math.PI / 2)
  const c = a.clone().rotateY(Math.PI / 4)
  return mergeGeometries([a, b, c])
})()
const shrubMat = new MeshStandardMaterial({ map: shrubTexture(), alphaTest: 0.45, side: DoubleSide, roughness: 1 })
const pebbleGeo = new DodecahedronGeometry(1, 0)

/** True if (x, z) at ground level sits inside (or within `margin` of) any collider. */
function blocked(colliders, x, z, margin) {
  for (const c of colliders) {
    if (c.p[1] > 40) continue
    const inv = [-c.q[0], -c.q[1], -c.q[2], c.q[3]]
    const l = rotate3([x - c.p[0], 0.25 - c.p[1], z - c.p[2]], inv)
    if (c.shape === 'box') {
      if (c.half[0] > 50) continue // ground slab
      if (Math.abs(l[0]) <= c.half[0] + margin && Math.abs(l[1]) <= c.half[1] + 0.3 && Math.abs(l[2]) <= c.half[2] + margin) return true
    } else if (Math.hypot(l[0], l[2]) <= c.r + margin && Math.abs(l[1]) <= c.halfHeight + 0.3) {
      return true
    }
  }
  return false
}

export function Decor({ seed, shrubs, pebbles }) {
  const layout = useMemo(() => {
    const rand = seededRandom(seed)
    const colliders = buildColliders()
    const pick = (count, margin) => {
      const out = []
      for (let tries = 0; out.length < count && tries < count * 12; tries++) {
        const x = (rand() * 2 - 1) * (MAP_HALF - 0.5)
        const z = (rand() * 2 - 1) * (MAP_HALF - 0.5)
        // Avoid the tower's open ring so it stays readable.
        if (Math.hypot(x, z) < 3) continue
        if (!blocked(colliders, x, z, margin)) out.push([x, z, rand(), rand()])
      }
      return out
    }
    return { shrubs: pick(shrubs, 0.6), pebbles: pick(pebbles, 0.2) }
  }, [seed, shrubs, pebbles])

  const setShrubs = (mesh) => {
    if (!mesh) return
    const o = new Object3D()
    layout.shrubs.forEach(([x, z, a, b], i) => {
      o.position.set(x, 0, z)
      o.rotation.set(0, a * Math.PI, 0)
      o.scale.setScalar(0.5 + b * 0.9)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }
  const setPebbles = (mesh) => {
    if (!mesh) return
    const o = new Object3D()
    layout.pebbles.forEach(([x, z, a, b], i) => {
      const s = 0.06 + b * 0.16
      o.position.set(x, s * 0.25, z)
      o.rotation.set(a * 3, b * 3, a * 2)
      o.scale.set(s, s * 0.6, s * 0.8)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }
  return (
    <group>
      <instancedMesh ref={setShrubs} args={[shrubGeo, shrubMat, layout.shrubs.length]} />
      <instancedMesh ref={setPebbles} args={[pebbleGeo, instancedVariant(materials.rock()), layout.pebbles.length]} receiveShadow />
    </group>
  )
}
