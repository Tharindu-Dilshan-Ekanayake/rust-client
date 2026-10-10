import { useMemo } from 'react'
import { BufferAttribute, BufferGeometry, MeshStandardMaterial, PlaneGeometry, Quaternion } from 'three'

import { ruinPieces, yawOffset } from '../../shared/map.js'
import { seededRandom } from '../../shared/math.js'
import { useMerged } from './geometryUtils.js'
import { boxGeo, cylGeo, materials } from './materials.js'
import { Stairs } from './structures.jsx'
import { scorchTexture } from './textures.js'

const scorchMat = new MeshStandardMaterial({
  map: scorchTexture(),
  transparent: true,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  roughness: 1,
})
const scorchGeo = new PlaneGeometry(1, 1)
/**
 * Unit sand drift: banked against a wall along x, highest at z = 0 and running
 * out to nothing at z = 1, rippled and tapering off at both ends. Scaled per
 * drift to (length, height, depth).
 */
const driftGeo = (() => {
  const nx = 18
  const nz = 8
  const rand = seededRandom(77)
  const bumps = Array.from({ length: (nx + 1) * (nz + 1) }, () => rand())
  const pos = []
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const u = i / nx - 0.5
      const v = j / nz
      const taper = Math.min(1, (0.5 - Math.abs(u)) / 0.18)
      const y = Math.max(0, (1 - v) ** 1.15 * taper * (0.9 + bumps[j * (nx + 1) + i] * 0.2)) - (j === nz || taper <= 0 ? 0.05 : 0)
      pos.push(u, y, v)
    }
  }
  const index = []
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i
      index.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  g.setAttribute('uv', new BufferAttribute(new Float32Array(pos.flatMap((_, k) => (k % 3 === 1 ? [] : [pos[k] * 2]))), 2))
  g.setIndex(index)
  g.computeVertexNormals()
  return g
})()

const toQuat = (q) => new Quaternion(q[0], q[1], q[2], q[3])

/** Merged mesh helper: renders nothing for an empty list. */
function Merged({ pieces, material, shadow = true }) {
  if (!pieces.length) return null
  return <MergedInner pieces={pieces} material={material} shadow={shadow} />
}
function MergedInner({ pieces, material, shadow }) {
  const geo = useMerged(pieces)
  return <mesh geometry={geo} material={material} castShadow={shadow} receiveShadow />
}

/**
 * A war-damaged building. Walls, slabs and ramps come from the shared
 * `ruinPieces()` (the same boxes the physics uses); on top of them go the
 * decoration: jagged shards along shattered wall tops, chunks and rebar,
 * rubble, burnt beams, scorch marks, sand drifted against the walls and
 * debris (planks, torn sheet metal) strewn round the outside.
 */
export function Ruin(r) {
  const pieces = useMemo(() => ruinPieces(r), [r])
  const parts = useMemo(() => {
    const rand = seededRandom((r.seed ?? 1) * 7 + 3)
    const local = (lx, ly, lz) => {
      const o = yawOffset(r.p, lx, lz, r.rotY)
      return [o[0], r.p[1] + ly, o[2]]
    }
    const plaster = []
    const brick = []
    const concrete = []
    const rebar = []
    const charred = []
    const wood = []
    const sheet = []

    for (const w of pieces.walls) {
      const broken = w.kind === 'brick'
      ;(broken ? brick : plaster).push({
        geometry: boxGeo(w.size[0], w.size[1], w.size[2], broken ? 1.2 : 2.2),
        position: w.p,
        rotation: [0, w.yaw, 0],
      })
      if (!broken || w.size[1] < 0.35) continue
      // Loose chunks balanced on broken tops, and the odd bent rebar.
      const topY = w.p[1] + w.size[1] / 2
      // A tilted shard standing proud of the break.
      if (w.size[1] > 0.5 && rand() < 0.7) {
        const sw = w.size[0] * (0.55 + rand() * 0.5)
        const sh = 0.22 + rand() * 0.42
        const tilt = (rand() < 0.5 ? -1 : 1) * (0.35 + rand() * 0.5)
        const slide = (rand() - 0.5) * w.size[0] * 0.4
        brick.push({
          geometry: boxGeo(sw, sh, w.size[2] * 0.94, 1.2),
          position: [w.p[0] + Math.cos(w.yaw) * slide, topY - sh * 0.2, w.p[2] - Math.sin(w.yaw) * slide],
          rotation: [0, w.yaw, tilt],
        })
      }
      if (rand() < 0.45) {
        const s = 0.12 + rand() * 0.16
        brick.push({
          geometry: boxGeo(s * 1.4, s, s, 1),
          position: [w.p[0] + (rand() - 0.5) * 0.2, topY + s * 0.35, w.p[2] + (rand() - 0.5) * 0.1],
          rotation: [rand() * 0.6, w.yaw + rand(), rand() * 0.6],
        })
      }
      if (rand() < 0.35) {
        const len = 0.25 + rand() * 0.45
        rebar.push({
          geometry: boxGeo(0.014, len, 0.014, 1),
          position: [w.p[0] + (rand() - 0.5) * w.size[0] * 0.6, topY + len / 2 - 0.05, w.p[2]],
          rotation: [(rand() - 0.5) * 0.9, w.yaw, (rand() - 0.5) * 0.9],
        })
      }
    }

    pieces.slabs.forEach((sl, si) => {
      const def = r.slabs[si]
      concrete.push({ geometry: boxGeo(sl.size[0], sl.size[1], sl.size[2], 2), position: sl.p, rotation: [0, sl.yaw, 0] })
      // Rebar fringe along the slab's east edge.
      for (let i = 0; i < 6; i++) {
        const len = 0.3 + rand() * 0.4
        const edge = local(def.x1 + len / 2 - 0.05, def.top - 0.1, def.z0 + (i + 0.5) * ((def.z1 - def.z0) / 6))
        rebar.push({ geometry: boxGeo(len, 0.014, 0.014, 1), position: edge, rotation: [0, r.rotY + (rand() - 0.5) * 0.4, (rand() - 0.5) * 0.6] })
      }
    })
    for (const rp of pieces.ramps) {
      if (rp.kind === 'ramp') concrete.push({ geometry: boxGeo(rp.size[0], rp.size[1], rp.size[2], 2), position: rp.p, quaternion: toQuat(rp.q) })
    }

    // Rubble piles: chunks heaped higher toward the middle.
    for (const rb of pieces.rubble) {
      const pr = seededRandom(rb.seed)
      const [w, h, d] = rb.size
      for (let i = 0; i < 18; i++) {
        const lx = (pr() - 0.5) * w
        const lz = (pr() - 0.5) * d
        const centre = 1 - Math.min(1, Math.hypot(lx / w, lz / d) * 2)
        const s = 0.12 + pr() * 0.3
        const c = Math.cos(rb.yaw)
        const sn = Math.sin(rb.yaw)
        const pos = [rb.p[0] + lx * c + lz * sn, Math.max(s * 0.3, centre * h * 0.9 - s * 0.2), rb.p[2] - lx * sn + lz * c]
        ;(pr() < 0.5 ? brick : concrete).push({ geometry: boxGeo(s * (1 + pr()), s * 0.7, s, 1), position: pos, rotation: [pr() * 0.8, pr() * 3, pr() * 0.8] })
      }
    }
    for (const pr of pieces.props) {
      concrete.push({ geometry: boxGeo(0.2, 0.05, 0.2, 1), position: [pr.p[0], 0.02, pr.p[2]], rotation: [0, pr.yaw, 0] })
    }

    // Burnt roof beams for roofless houses.
    if (r.beams) {
      for (const lz of [-1.6, 0, 1.6]) {
        charred.push({ geometry: boxGeo(r.w + 0.2, 0.16, 0.18, 1), position: local(0, r.h - 0.12, lz), rotation: [0, r.rotY, 0] })
      }
      charred.push({ geometry: boxGeo(3.4, 0.16, 0.18, 1), position: local(0.6, 1.1, -0.6), rotation: [0, r.rotY + 0.3, 0.62] })
    }

    // Floor slab, plus scorch marks.
    const floorPos = local(0, 0.02, 0)
    const scorches = Array.from({ length: 3 }, () => ({
      p: local((rand() - 0.5) * (r.w - 1.5), 0.045, (rand() - 0.5) * (r.d - 1.5)),
      s: 1.2 + rand() * 1.6,
      rot: rand() * Math.PI,
    }))
    // Sand blown up against the walls (the slope you can walk up is in pieces.drifts).
    const drifts = pieces.drifts.map((d) => ({ p: [d.at[0], -0.02, d.at[2]], scale: [d.len, d.h, d.depth], rotY: d.yawOut }))

    // Debris strewn round the outside: planks, torn sheet metal.
    const around = () => {
      const a = rand() * Math.PI * 2
      const k = 0.55 + rand() * 0.35
      return local(Math.cos(a) * (r.w / 2 + 0.8) * k * 1.6, 0, Math.sin(a) * (r.d / 2 + 0.8) * k * 1.6)
    }
    for (let i = 0; i < 6; i++) {
      const p = around()
      const len = 0.9 + rand() * 1.3
      wood.push({ geometry: boxGeo(len, 0.04, 0.16 + rand() * 0.08, 1), position: [p[0], 0.03 + rand() * 0.08, p[2]], rotation: [(rand() - 0.5) * 0.15, rand() * Math.PI, (rand() - 0.5) * 0.25] })
    }
    for (let i = 0; i < 3; i++) {
      const p = around()
      sheet.push({ geometry: boxGeo(1.0 + rand() * 0.8, 0.02, 0.7 + rand() * 0.4, 1), position: [p[0], 0.12, p[2]], rotation: [(rand() - 0.5) * 0.5, rand() * Math.PI, (rand() - 0.5) * 0.4] })
    }
    return { plaster, brick, concrete, rebar, charred, wood, sheet, drifts, floorPos, scorches }
  }, [pieces, r])

  return (
    <group>
      <Merged pieces={parts.plaster} material={materials.ruinPlaster()} />
      <Merged pieces={parts.brick} material={materials.ruinBlock()} />
      <Merged pieces={parts.concrete} material={materials.slab()} />
      <Merged pieces={parts.rebar} material={materials.rust()} shadow={false} />
      <Merged pieces={parts.charred} material={materials.charred()} />
      <Merged pieces={parts.wood} material={materials.wood()} />
      <Merged pieces={parts.sheet} material={materials.rust()} />
      {parts.drifts.map((d, i) => (
        <mesh key={i} geometry={driftGeo} material={materials.sand()} position={d.p} rotation={[0, d.rotY, 0]} scale={d.scale} receiveShadow />
      ))}
      {pieces.props.map((pr, i) => (
        <group key={i} position={pr.p} rotation={[0, pr.yaw, 0]}>
          <mesh geometry={boxGeo(pr.size[0], pr.size[1], pr.size[2], 1)} material={materials.machine()} castShadow receiveShadow />
          <mesh geometry={cylGeo(0.12, 1.4, 10, 1)} material={materials.rust()} position={[pr.size[0] / 2 + 0.15, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow />
        </group>
      ))}
      {pieces.ramps
        .filter((rp) => rp.kind === 'stairs')
        .map((rp, i) => (
          <Stairs key={i} bottom={rp.bottom} top={rp.top} width={rp.width} steps={13} rails={false} material={materials.slab()} />
        ))}
      <mesh geometry={boxGeo(r.w - 0.3, 0.04, r.d - 0.3, 2)} material={materials.floor()} position={parts.floorPos} rotation={[0, r.rotY, 0]} receiveShadow />
      {parts.scorches.map((sc, i) => (
        <mesh key={i} geometry={scorchGeo} material={scorchMat} position={sc.p} rotation={[-Math.PI / 2, 0, sc.rot]} scale={sc.s} />
      ))}
    </group>
  )
}

export default Ruin
