import { useMemo } from 'react'
import { BufferGeometry, CircleGeometry, Float32BufferAttribute, Object3D, PlaneGeometry, Quaternion, TorusGeometry, Vector3 } from 'three'

import { CONTAINER, PIPE_CROSSINGS, PIPELINE, pipelinePieces, shackWallBoxes, WALL_LINE, yawOffset } from '../../shared/map.js'
import { seededRandom } from '../../shared/math.js'
import { boxGeo, CONTAINER_COLORS, cylGeo, instancedVariant, materials } from './materials.js'
import { segmentTransform, useMerged } from './geometryUtils.js'
import { Box, Cyl, Rod } from './parts.jsx'

/* ---------------------------------------------------------------------------
 * Central derrick tower
 * ------------------------------------------------------------------------- */

/** A merged batch of beams between point pairs: [{ a, b, w }]. */
function beamPieces(list) {
  return list.map(({ a, b, w = 0.12 }) => {
    const t = segmentTransform(a, b)
    return { geometry: boxGeo(w, t.length, w, 1), position: t.position, quaternion: t.quaternion }
  })
}

export function Tower(t) {
  const { legInset: li, legSize: ls, legHeight: lh, houseSize: hs, houseBottom: hb, houseHeight: hh } = t
  const { platformSize: ps, platformTop: top, railHeight, ladderGap, mastInset: mi, mastBase, mastHeight, mastTop } = t
  const frame = materials.towerDark()
  const paint = materials.tower()

  // Lower frame: ring beams + X bracing, one draw call.
  const braces = useMemo(() => {
    const pieces = []
    const span = li * 2
    for (const y of [3, 6, lh]) {
      for (const s of [-1, 1]) {
        pieces.push({ geometry: boxGeo(span + ls, 0.18, 0.18), position: [0, y, s * li] })
        pieces.push({ geometry: boxGeo(0.18, 0.18, span), position: [s * li, y, 0] })
      }
    }
    const sections = [[0.2, 3], [3, 6], [6, lh]]
    for (const [y0, y1] of sections) {
      const rise = y1 - y0
      const len = Math.hypot(span, rise)
      const ang = Math.atan2(rise, span)
      const yc = (y0 + y1) / 2
      for (const s of [-1, 1]) {
        for (const d of [-1, 1]) {
          pieces.push({ geometry: boxGeo(len, 0.1, 0.1), position: [0, yc, s * li], rotation: [0, 0, d * ang] })
          pieces.push({ geometry: boxGeo(0.1, 0.1, len), position: [s * li, yc, 0], rotation: [d * ang, 0, 0] })
        }
      }
    }
    // Gusset plates where the braces meet the legs.
    for (const y of [3, 6]) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) pieces.push({ geometry: boxGeo(0.5, 0.5, 0.5), position: [sx * li, y, sz * li] })
    }
    return pieces
  }, [li, ls, lh])
  const braceGeo = useMerged(braces)

  // Mast: open vertical corner posts over the deck, then a tapering lattice to the crown.
  const mast = useMemo(() => {
    const y0 = top + mastBase
    const y1 = top + mastHeight
    const at = (y) => mi + (mastTop - mi) * ((y - y0) / (y1 - y0))
    const list = []
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        list.push({ a: [sx * mi, top, sz * mi], b: [sx * mi, y0, sz * mi], w: 0.2 })
        list.push({ a: [sx * mi, y0, sz * mi], b: [sx * mastTop, y1, sz * mastTop], w: 0.17 })
      }
    }
    const levels = []
    for (let y = y0; y <= y1 + 0.01; y += (y1 - y0) / 5) levels.push(y)
    for (const y of levels) {
      const r = at(y)
      for (const s of [-1, 1]) {
        list.push({ a: [-r, y, s * r], b: [r, y, s * r], w: 0.12 })
        list.push({ a: [s * r, y, -r], b: [s * r, y, r], w: 0.12 })
      }
    }
    for (let i = 0; i < levels.length - 1; i++) {
      const ya = levels[i]
      const yb = levels[i + 1]
      const ra = at(ya)
      const rb = at(yb)
      for (const s of [-1, 1]) {
        list.push({ a: [-ra, ya, s * ra], b: [rb, yb, s * rb], w: 0.07 })
        list.push({ a: [ra, ya, s * ra], b: [-rb, yb, s * rb], w: 0.07 })
        list.push({ a: [s * ra, ya, -ra], b: [s * rb, yb, rb], w: 0.07 })
        list.push({ a: [s * ra, ya, ra], b: [s * rb, yb, -rb], w: 0.07 })
      }
    }
    return beamPieces(list)
  }, [top, mi, mastBase, mastHeight, mastTop])
  const mastGeo = useMerged(mast)

  // Ladder with a safety cage from head height up.
  const ladder = useMemo(() => {
    const pieces = []
    const height = top + 1.0
    for (const x of [-0.25, 0.25]) pieces.push({ geometry: boxGeo(0.06, height, 0.06), position: [x, height / 2, 2.62] })
    for (let y = 0.3; y < height; y += 0.32) pieces.push({ geometry: boxGeo(0.5, 0.04, 0.04), position: [0, y, 2.62] })
    for (let y = 1.5; y < top; y += 3) {
      for (const x of [-0.25, 0.25]) pieces.push({ geometry: boxGeo(0.04, 0.04, 0.8), position: [x, y, 2.2] })
    }
    for (const x of [-0.42, 0, 0.42]) {
      const z = x === 0 ? 3.06 : 2.9
      pieces.push({ geometry: boxGeo(0.035, height - 2.6, 0.035), position: [x, 2.6 + (height - 2.6) / 2, z] })
    }
    return pieces
  }, [top])
  const ladderGeo = useMerged(ladder)
  const hoops = useMemo(() => {
    const out = []
    for (let y = 2.6; y < top + 0.8; y += 0.9) out.push(y)
    return out
  }, [top])

  // Corrugated head house where the old water tank sat.
  const house = useMemo(() => {
    const yc = hb + hh / 2
    const h2 = hs / 2
    return [
      { size: [hs, hh, 0.06], p: [0, yc, -h2] },
      { size: [hs, hh, 0.06], p: [0, yc, h2] },
      { size: [0.06, hh, hs], p: [-h2, yc, 0] },
      { size: [0.06, hh, hs], p: [h2, yc, 0] },
    ]
  }, [hb, hh, hs])

  const half = ps / 2
  const railTop = top + railHeight
  const posts = []
  for (const x of [-half + 0.04, 0, half - 0.04]) {
    for (const z of [-half + 0.04, half - 0.04]) {
      if (z > 0 && Math.abs(x) < ladderGap) continue
      posts.push([x, z])
    }
  }
  for (const z of [-half / 2, half / 2]) {
    posts.push([-half + 0.04, z])
    posts.push([half - 0.04, z])
  }
  const crownY = top + mastHeight
  const wireY = top + mastBase + (mastHeight - mastBase) * 0.55
  const wireR = mi + (mastTop - mi) * 0.55

  return (
    <group position={t.p}>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <Box key={`${sx}${sz}`} size={[ls, lh, ls]} position={[sx * li, lh / 2, sz * li]} material={frame} />
        )),
      )}
      {/* Footings */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <Box key={`f${sx}${sz}`} size={[0.9, 0.35, 0.9]} position={[sx * li, 0.17, sz * li]} material={materials.concreteDark()} tile={1} />
        )),
      )}
      <mesh geometry={braceGeo} material={frame} castShadow receiveShadow />

      {/* Head house: corrugated cladding, corner trims, a door, hazard band under the deck */}
      {house.map((w, i) => (
        <Box key={i} size={w.size} position={w.p} material={materials.corrugated('#8d8377')} tile={2.4} />
      ))}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <Box key={`t${sx}${sz}`} size={[0.14, hh, 0.14]} position={[sx * (hs / 2), hb + hh / 2, sz * (hs / 2)]} material={frame} />
        )),
      )}
      <Box size={[hs + 0.1, 0.12, hs + 0.1]} position={[0, hb + 0.06, 0]} material={frame} />
      <Box size={[0.95, 2.0, 0.04]} position={[0.8, hb + 1.05, -hs / 2 - 0.035]} material={materials.steelDark()} />
      <Box size={[0.7, 0.45, 0.04]} position={[-0.8, hb + 1.9, -hs / 2 - 0.035]} material={materials.hazard()} />
      {[-1, 1].map((sx) => (
        <Box key={`w${sx}`} size={[0.04, 0.6, 1.2]} position={[sx * (hs / 2 + 0.035), hb + 1.8, 0]} material={materials.steelDark()} />
      ))}

      {/* Lookout deck: grating, hazard-striped kick plates, red rails */}
      <Box size={[ps, 0.2, ps]} position={[0, top - 0.1, 0]} material={materials.grate()} tile={1.5} />
      <Box size={[ps + 0.06, 0.12, ps + 0.06]} position={[0, top - 0.26, 0]} material={frame} />
      {[
        { c: [0, -half + 0.04], s: [ps, 0.08] },
        { c: [half - 0.04, 0], s: [0.08, ps] },
        { c: [-half + 0.04, 0], s: [0.08, ps] },
        { c: [-(half + ladderGap) / 2, half - 0.04], s: [half - ladderGap, 0.08] },
        { c: [(half + ladderGap) / 2, half - 0.04], s: [half - ladderGap, 0.08] },
      ].map((r, i) => (
        <group key={i}>
          <Box size={[r.s[0], 0.3, r.s[1]]} position={[r.c[0], top + 0.15, r.c[1]]} material={materials.hazardStripe()} tile={1} />
          <Box size={[r.s[0], 0.06, r.s[1]]} position={[r.c[0], railTop, r.c[1]]} material={paint} shadow={false} />
          <Box size={[r.s[0], 0.04, r.s[1]]} position={[r.c[0], top + 0.65, r.c[1]]} material={paint} shadow={false} />
        </group>
      ))}
      {posts.map(([x, z], i) => (
        <Box key={i} size={[0.06, railHeight, 0.06]} position={[x, top + railHeight / 2, z]} material={paint} shadow={false} />
      ))}

      {/* Derrick mast and crown */}
      <mesh geometry={mastGeo} material={paint} castShadow />
      <Box size={[mastTop * 2 + 0.5, 0.14, mastTop * 2 + 0.5]} position={[0, crownY + 0.07, 0]} material={materials.grate()} tile={1} />
      <mesh position={[0, crownY + 0.55, 0]} rotation={[0, Math.PI / 4, 0]} material={materials.steelDark()} castShadow>
        <torusGeometry args={[0.38, 0.07, 8, 20]} />
      </mesh>
      <Box size={[0.12, 1.6, 0.12]} position={[mastTop, crownY + 0.8, -mastTop]} material={materials.steelDark()} shadow={false} />
      <mesh position={[mastTop, crownY + 1.66, -mastTop]} material={materials.light()}>
        <sphereGeometry args={[0.1, 10, 8]} />
      </mesh>

      <mesh geometry={ladderGeo} material={materials.steelDark()} castShadow />
      {hoops.map((y) => (
        <mesh key={y} position={[0, y, 2.62]} rotation={[Math.PI / 2, 0, 0]} material={materials.steelDark()}>
          <torusGeometry args={[0.44, 0.02, 4, 14, Math.PI]} />
        </mesh>
      ))}

      {/* Pump machine underneath */}
      <Box size={[2.6, 0.3, 2.0]} position={[0, 0.15, 0]} material={materials.concreteDark()} />
      <Box size={[1.8, 1.1, 1.2]} position={[0, 0.85, 0]} material={materials.machine()} tile={1} />
      <Cyl r={0.35} h={1.0} position={[0.25, 1.75, 0]} rotation={[0, 0, Math.PI / 2]} material={materials.machine()} />
      <Box size={[0.5, 0.25, 0.7]} position={[-0.55, 1.52, 0.1]} material={materials.steelDark()} />
      <Cyl r={0.18} h={7.6} position={[-0.6, 5.2, -0.4]} material={materials.rust()} />
      <Cyl r={0.14} h={1.6} position={[0.9, 0.5, 0.55]} rotation={[Math.PI / 2, 0, 0]} material={materials.rust()} />

      {/* Guy wires from the mast to ground anchors */}
      {t.guys.map(([gx, gz]) => (
        <group key={`${gx}${gz}`}>
          <Rod a={[Math.sign(gx) * wireR, wireY, Math.sign(gz) * wireR]} b={[gx, 0.1, gz]} r={0.018} material={materials.wire()} />
          <Box size={[0.7, 0.1, 0.7]} position={[gx, 0.05, gz]} material={materials.concreteDark()} tile={1} />
        </group>
      ))}
    </group>
  )
}

/* ---------------------------------------------------------------------------
 * Storage tanks, catwalk, stairs
 * ------------------------------------------------------------------------- */

export function Tank({ p, r, h }) {
  return (
    <group position={[p[0], 0, p[2]]}>
      <Cyl r={r} h={h} segments={48} position={[0, h / 2, 0]} material={materials.tank()} tile={2.5} />
      {[0.25, 0.5, 0.75].map((f) => (
        <Cyl key={f} r={r + 0.03} h={0.07} segments={48} position={[0, h * f, 0]} material={materials.rust()} shadow={false} />
      ))}
      <Cyl r={r + 0.05} h={0.14} segments={48} position={[0, h - 0.04, 0]} material={materials.steelDark()} shadow={false} openEnded />
      <Cyl r={0.45} h={0.2} position={[r * 0.4, h + 0.1, r * 0.35]} material={materials.steelDark()} />
      <Cyl r={0.12} h={0.9} position={[-r * 0.5, h + 0.45, -r * 0.4]} material={materials.rust()} />
      {/* Outlet valve on the south side */}
      <Cyl r={0.22} h={0.7} position={[0, 0.8, r + 0.3]} rotation={[Math.PI / 2, 0, 0]} material={materials.rust()} />
      <mesh position={[0, 0.8, r + 0.68]} material={materials.hazard()}>
        <torusGeometry args={[0.2, 0.03, 6, 16]} />
      </mesh>
    </group>
  )
}

export function Catwalk({ p, length, width }) {
  const rail = materials.hazard()
  return (
    <group position={p}>
      {/* Deck sits a hair above the tank roofs it rests on, so the two never z-fight. */}
      <Box size={[length, 0.12, width]} position={[0, -0.045, 0]} material={materials.grate()} tile={1.5} />
      {[-1, 1].map((s) => (
        <group key={s} position={[0, 0, s * (width / 2 - 0.03)]}>
          <Box size={[length - 0.6, 0.05, 0.05]} position={[0, 1.0, 0]} material={rail} shadow={false} />
          <Box size={[length - 0.6, 0.04, 0.04]} position={[0, 0.5, 0]} material={rail} shadow={false} />
          {[-(length / 2 - 0.3), 0, length / 2 - 0.3].map((x) => (
            <Box key={x} size={[0.05, 1.0, 0.05]} position={[x, 0.5, 0]} material={rail} shadow={false} />
          ))}
        </group>
      ))}
    </group>
  )
}

/** Steel stairs between two points; built in a local frame whose +Z runs uphill. */
/**
 * Fixed steel ladder up a wall face (see `ladder()` in shared/map.js): rails
 * with rungs, stand-off brackets back to the wall, and goose-neck grab rails
 * that curl over onto the deck so you can haul yourself off the top.
 */
export function Ladder({ foot, dir, topY, base = 0, rungs: [first, step], material }) {
  const pieces = useMemo(() => {
    const out = []
    const side = [-dir[2], 0, dir[0]]
    const at = (along, lateral, y) => [foot[0] + dir[0] * along + side[0] * lateral, y, foot[1] + dir[2] * along + side[2] * lateral]
    // Boxes are built along x (lateral) and z (along dir), then turned to face the wall.
    const quat = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.atan2(dir[0], dir[2]))
    const railH = topY + 1.0 - base
    for (const l of [-0.25, 0.25]) {
      out.push({ geometry: boxGeo(0.06, railH, 0.06, 1), position: at(0, l, base + railH / 2), quaternion: quat })
      // Goose neck: over the edge and down onto the deck.
      out.push({ geometry: boxGeo(0.05, 0.05, 0.5, 1), position: at(0.22, l, topY + 1.0), quaternion: quat })
      out.push({ geometry: boxGeo(0.05, 1.0, 0.05, 1), position: at(0.47, l, topY + 0.5), quaternion: quat })
      for (let y = base + 1.2; y < topY; y += 1.7) out.push({ geometry: boxGeo(0.04, 0.04, 0.14, 1), position: at(0.07, l, y), quaternion: quat })
    }
    for (let y = first; y <= topY + 0.01; y += step) out.push({ geometry: boxGeo(0.5, 0.035, 0.035, 1), position: at(0, 0, y), quaternion: quat })
    return out
  }, [foot, dir, topY, base, first, step])
  const geometry = useMerged(pieces)
  return <mesh geometry={geometry} material={material ?? materials.hazard()} castShadow receiveShadow />
}

export function Stairs({ bottom, top, width, steps = 22, rails = true, material }) {
  const dx = top[0] - bottom[0]
  const dz = top[2] - bottom[2]
  const run = Math.hypot(dx, dz)
  const rise = top[1] - bottom[1]
  const yaw = Math.atan2(dx, dz)
  const stepRise = rise / steps
  const stepRun = run / steps
  const angle = Math.atan2(rise, run)
  const len = Math.hypot(run, rise)

  const stepPieces = useMemo(() => {
    const pieces = []
    for (let i = 0; i < steps; i++) {
      pieces.push({ geometry: boxGeo(width, 0.05, stepRun + 0.02), position: [0, (i + 1) * stepRise - 0.025, (i + 0.5) * stepRun] })
    }
    return pieces
  }, [width, stepRise, stepRun, steps])
  const stepGeo = useMerged(stepPieces)
  const x = width / 2 + 0.04

  return (
    <group position={bottom} rotation={[0, yaw, 0]}>
      <mesh geometry={stepGeo} material={material ?? materials.grate()} castShadow receiveShadow />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box size={[0.08, 0.28, len]} position={[side * x, rise / 2 - 0.05, run / 2]} rotation={[-angle, 0, 0]} material={materials.hazard()} />
          {rails && (
            <>
              <Rod a={[side * x, 0.95, 0]} b={[side * x, rise + 0.95, run]} r={0.03} material={materials.hazard()} />
              {[0.15, 0.5, 0.85].map((t) => (
                <Rod key={t} a={[side * x, rise * t, run * t]} b={[side * x, rise * t + 0.95, run * t]} r={0.025} material={materials.hazard()} />
              ))}
            </>
          )}
        </group>
      ))}
      {[0.55, 0.85].map((t) =>
        [-1, 1].map((side) => (
          <Box key={`${t}${side}`} size={[0.12, rise * t + bottom[1], 0.12]} position={[side * (width / 2 - 0.1), (rise * t - bottom[1]) / 2, run * t]} material={materials.steelDark()} />
        )),
      )}
    </group>
  )
}

export function Landing({ p, size }) {
  const [w, d] = size
  return (
    <group>
      <Box size={[w, 0.2, d]} position={[p[0], p[1] - 0.085, p[2]]} material={materials.grate()} tile={1.5} />
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
        <Box key={`${sx}${sz}`} size={[0.14, p[1] - 0.2, 0.14]} position={[p[0] + sx * (w / 2 - 0.1), (p[1] - 0.2) / 2, p[2] + sz * (d / 2 - 0.1)]} material={materials.steelDark()} />
      ))}
      <Box size={[0.05, 0.05, d]} position={[p[0] - w / 2 + 0.03, p[1] + 1.0, p[2]]} material={materials.hazard()} shadow={false} />
      <Box size={[0.05, 1.0, 0.05]} position={[p[0] - w / 2 + 0.03, p[1] + 0.5, p[2] - d / 2 + 0.05]} material={materials.hazard()} shadow={false} />
      <Box size={[0.05, 1.0, 0.05]} position={[p[0] - w / 2 + 0.03, p[1] + 0.5, p[2] + d / 2 - 0.05]} material={materials.hazard()} shadow={false} />
    </group>
  )
}

/* ---------------------------------------------------------------------------
 * Pipeline
 * ------------------------------------------------------------------------- */

const _y = new Vector3(0, 1, 0)

/**
 * One pipe run. `open` = 'a' | 'b' | 'both' leaves torn, hollow ends instead of
 * end caps.
 */
/**
 * A ripped pipe end: a short sleeve whose rim is jagged (each segment torn back a
 * different amount) with a few tongues of metal peeled outward. Built along +Y
 * from y=0; `inset` shrinks it for the inner (rusty) face.
 */
function tornLipGeometry(r, seed, inset = 0) {
  const rand = seededRandom(seed)
  const N = 40
  const tips = []
  for (let i = 0; i < N; i++) tips.push(0.04 + rand() * rand() * 0.42)
  // A couple of long peeled tongues.
  for (let k = 0; k < 4; k++) tips[Math.floor(rand() * N)] = 0.45 + rand() * 0.2
  const flare = tips.map((t) => (t > 0.4 ? 0.12 + rand() * 0.1 : rand() * 0.035))
  const pos = []
  const idx = []
  const rr = r - inset
  for (let i = 0; i <= N; i++) {
    const k = i % N
    const ang = (i / N) * Math.PI * 2
    const c = Math.cos(ang)
    const sn = Math.sin(ang)
    // Base ring, then the torn tip (pulled outward where the metal peeled).
    pos.push(c * rr, 0, sn * rr)
    const tr = rr * (1 + flare[k])
    pos.push(c * tr, tips[k], sn * tr)
  }
  for (let i = 0; i < N; i++) {
    const p = i * 2
    idx.push(p, p + 1, p + 2, p + 2, p + 1, p + 3)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  const uv = []
  for (let i = 0; i <= N; i++) uv.push(i / 4, 0, i / 4, 0.5)
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function TornLip({ at, dir, r, seed, material }) {
  const geo = useMemo(() => tornLipGeometry(r, seed), [r, seed])
  const inner = useMemo(() => tornLipGeometry(r, seed, r * 0.05), [r, seed])
  const q = useMemo(() => new Quaternion().setFromUnitVectors(_y, new Vector3(...dir).normalize()), [dir])
  return (
    <group position={at} quaternion={q}>
      <mesh geometry={geo} material={material} castShadow receiveShadow />
      <mesh geometry={inner} material={materials.pipeInside()} />
      {/* Scorched band where it tore. */}
      <mesh geometry={cylGeo(r + 0.012, 0.25, 30, 1, true)} material={materials.charred()} position={[0, -0.12, 0]} />
    </group>
  )
}

const BOLTS = 16
const boltGeo = boxGeo(0.06, 0.3, 0.06, 1)

export function Pipe({ a, b, r, open, material, joints = 6 }) {
  const t = useMemo(() => segmentTransform(a, b), [a, b])
  const dir = useMemo(() => new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize(), [a, b])
  const flanges = useMemo(() => {
    const out = []
    if (joints) for (let d = 3; d < t.length - 1; d += joints) out.push(d)
    return out
  }, [t, joints])
  const at = (d) => [a[0] + dir.x * d, a[1] + dir.y * d, a[2] + dir.z * d]
  // Flange rings merged into one mesh; bolts round each joint as one instanced mesh.
  const ringGeo = useMerged(
    useMemo(
      () =>
        flanges.flatMap((d) => [
          { geometry: cylGeo(r + 0.11, 0.08, 30, 1), position: at(d - 0.06), quaternion: t.quaternion },
          { geometry: cylGeo(r + 0.11, 0.08, 30, 1), position: at(d + 0.06), quaternion: t.quaternion },
          { geometry: cylGeo(r + 0.05, 0.05, 30, 1), position: at(d), quaternion: t.quaternion },
        ]),
      // eslint-disable-next-line react-hooks/exhaustive-deps -- at() derives from a/dir
      [flanges, r, t, a, dir],
    ),
  )
  const setBolts = (mesh) => {
    if (!mesh) return
    const side = new Vector3(0, 1, 0).cross(dir)
    if (side.lengthSq() < 1e-4) side.set(1, 0, 0)
    side.normalize()
    const up = dir.clone().cross(side).normalize()
    const o = new Object3D()
    let i = 0
    for (const d of flanges) {
      const c = at(d)
      for (let k = 0; k < BOLTS; k++) {
        const ang = (k / BOLTS) * Math.PI * 2
        o.position.set(c[0], c[1], c[2]).addScaledVector(side, Math.cos(ang) * (r + 0.075)).addScaledVector(up, Math.sin(ang) * (r + 0.075))
        o.quaternion.copy(t.quaternion)
        o.updateMatrix()
        mesh.setMatrixAt(i++, o.matrix)
      }
    }
    mesh.instanceMatrix.needsUpdate = true
  }
  const caps = useMemo(() => {
    const capQuat = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), dir)
    const flip = capQuat.clone().multiply(new Quaternion().setFromAxisAngle(_y, Math.PI))
    const out = []
    if (open !== 'a' && open !== 'both') out.push({ p: a, q: flip })
    if (open !== 'b' && open !== 'both') out.push({ p: b, q: capQuat })
    return out
  }, [a, b, dir, open])
  const capGeo = useMemo(() => new CircleGeometry(r, 30), [r])
  const skin = material ?? materials.pipe()
  return (
    <group>
      <mesh geometry={cylGeo(r, t.length, 30, 2.4, true)} material={skin} position={t.position} quaternion={t.quaternion} castShadow receiveShadow />
      {open && (
        // Dark interior so torn ends read as hollow.
        <mesh geometry={cylGeo(r * 0.94, t.length - 0.05, 30, 2.4, true)} material={materials.pipeInside()} position={t.position} quaternion={t.quaternion} />
      )}
      {caps.map((c, i) => (
        // Inside a torn pipe the far cap must read as dark interior, not lit steel.
        <mesh key={i} geometry={capGeo} material={open ? materials.pipeInside() : skin} position={c.p} quaternion={c.q} />
      ))}
      {flanges.length > 0 && <mesh geometry={ringGeo} material={materials.rust()} castShadow receiveShadow />}
      {flanges.length > 0 && <instancedMesh args={[boltGeo, instancedVariant(materials.steelDark()), flanges.length * BOLTS]} ref={setBolts} />}
      {(open === 'a' || open === 'both') && <TornLip at={a} dir={[-dir.x, -dir.y, -dir.z]} r={r} seed={Math.round(a[0] * 31 + a[2] * 17)} material={skin} />}
      {(open === 'b' || open === 'both') && <TornLip at={b} dir={[dir.x, dir.y, dir.z]} r={r} seed={Math.round(b[0] * 29 + b[2] * 13)} material={skin} />}
    </group>
  )
}

/** The elevated pipeline: pipe runs on H-frame racks, with the broken section. */
export function Pipeline() {
  const { pipes, racks, fallen, service, dir } = useMemo(() => pipelinePieces(), [])
  const h = PIPELINE.height - PIPELINE.radius
  const rackParts = useMemo(() => {
    const steel = []
    const concrete = []
    const dark = []
    for (const rack of racks) {
      const rot = [0, rack.yaw, 0]
      for (const side of [-1, 1]) {
        const leg = yawOffset(rack.p, side * PIPELINE.rackHalf, 0, rack.yaw)
        steel.push({ geometry: boxGeo(0.22, h, 0.22, 1), position: [leg[0], h / 2, leg[2]], rotation: rot })
        concrete.push({ geometry: boxGeo(0.6, 0.3, 0.6, 1), position: [leg[0], 0.12, leg[2]], rotation: rot })
        // Knee braces up into the crossbeam.
        const knee = yawOffset(rack.p, side * (PIPELINE.rackHalf - 0.45), 0, rack.yaw)
        const t = segmentTransform([leg[0], h - 0.7, leg[2]], [knee[0], h - 0.15, knee[2]])
        steel.push({ geometry: boxGeo(0.09, t.length, 0.09, 1), position: t.position, quaternion: t.quaternion })
      }
      steel.push({ geometry: boxGeo(PIPELINE.rackHalf * 2 + 0.22, 0.18, 0.22, 1), position: [rack.p[0], h - 0.09, rack.p[2]], rotation: rot })
      // Saddle the pipe sits in, and the U-strap over it.
      dark.push({ geometry: boxGeo(0.34, 0.32, 1.5, 1), position: [rack.p[0], h + 0.1, rack.p[2]], rotation: rot })
    }
    // Bellows of the expansion joint.
    for (let i = -3; i <= 3; i++) {
      dark.push({ geometry: cylGeo(PIPELINE.radius + 0.07 + (i % 2 ? 0 : 0.04), 0.09, 30, 1), position: [PIPELINE.bellowsX + i * 0.13, PIPELINE.height, PIPELINE.z], rotation: [0, 0, Math.PI / 2] })
    }
    // Gate valve on the main: body, bonnet, stem, wheel hub.
    const vx = PIPELINE.valveX
    const top = PIPELINE.height + PIPELINE.radius
    dark.push({ geometry: boxGeo(0.7, 0.7, 0.8, 1), position: [vx, top + 0.35, PIPELINE.z] })
    dark.push({ geometry: boxGeo(0.45, 0.6, 0.5, 1), position: [vx, top + 1.0, PIPELINE.z] })
    steel.push({ geometry: cylGeo(0.05, 0.9, 8, 1), position: [vx, top + 1.65, PIPELINE.z] })
    return { steel, concrete, dark }
  }, [racks, h])
  const darkGeo = useMerged(rackParts.dark)
  const steelGeo = useMerged(rackParts.steel)
  const concreteGeo = useMerged(rackParts.concrete)
  // Pipe clamps where the pipe sits on each rack.
  const clampQuat = useMemo(() => new Quaternion().setFromUnitVectors(_y, new Vector3(...dir)), [dir])
  return (
    <group>
      {pipes.map((p, i) => (
        <Pipe key={i} a={p.a} b={p.b} r={p.r} open={p.open} joints={6} />
      ))}
      {fallen.map((f, i) => (
        <Pipe key={i} a={f.a} b={f.b} r={f.r} open="both" material={materials.rust()} joints={f.walk ? 4 : 0} />
      ))}
      {service.map((sv, i) => (
        <Pipe key={`s${i}`} a={sv.a} b={sv.b} r={sv.r} joints={i === 0 ? 5 : 0} material={materials.rust()} />
      ))}
      <mesh geometry={darkGeo} material={materials.steelDark()} castShadow receiveShadow />
      {/* Hand wheels: on the gate valve, and on the service line's valve by the ground. */}
      <mesh position={[PIPELINE.valveX, PIPELINE.height + PIPELINE.radius + 2.1, PIPELINE.z]} rotation={[Math.PI / 2, 0, 0]} material={materials.barrel('#9b2f22')}>
        <torusGeometry args={[0.38, 0.04, 6, 20]} />
      </mesh>
      <group position={[PIPELINE.small.dropX, 1.15, PIPELINE.z + PIPELINE.small.dz]}>
        <mesh geometry={boxGeo(0.5, 0.5, 0.5, 1)} material={materials.steelDark()} castShadow />
        <mesh position={[0, 0, 0.42]} material={materials.barrel('#9b2f22')}>
          <torusGeometry args={[0.24, 0.03, 6, 16]} />
        </mesh>
      </group>
      <mesh geometry={cylGeo(PIPELINE.small.r + 0.04, 0.6, 12, 1)} material={materials.concreteDark()} position={[PIPELINE.small.dropX, 0.3, PIPELINE.z + PIPELINE.small.dz]} receiveShadow />
      <mesh geometry={steelGeo} material={materials.tower()} castShadow receiveShadow />
      <mesh geometry={concreteGeo} material={materials.concreteDark()} receiveShadow />
      <Box size={[1.8, PIPELINE.height + 1.4, 3.0]} position={[PIPELINE.from + 0.4, (PIPELINE.height + 1.4) / 2, PIPELINE.z]} material={materials.concreteDark()} tile={3} />
      {racks.map((rack, i) => (
        <mesh key={i} geometry={cylGeo(PIPELINE.radius + 0.04, 0.14, 24, 1)} material={materials.steelDark()} position={[rack.p[0], PIPELINE.height, rack.p[2]]} quaternion={clampQuat} />
      ))}
      {/* Sand drifted over the low ends of the fallen lengths. */}
      {fallen.map((f, i) => {
        const low = f.a[1] < f.b[1] ? f.a : f.b
        const lying = Math.abs(f.a[1] - f.b[1]) < 0.3
        const at = lying ? [(f.a[0] + f.b[0]) / 2, -0.2, (f.a[2] + f.b[2]) / 2] : [low[0], -0.25, low[2]]
        return (
          <mesh key={i} position={at} scale={lying ? [3.1, 0.75, 1.9] : [2.2, 1.0, 2.0]} rotation={[0, Math.atan2(f.b[0] - f.a[0], f.b[2] - f.a[2]), 0]} material={materials.sand()} receiveShadow>
            <sphereGeometry args={[1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
        )
      })}
    </group>
  )
}

/* ---------------------------------------------------------------------------
 * Shipping containers
 * ------------------------------------------------------------------------- */

const containerTagGeo = new PlaneGeometry(2.5, 2.5)

export function Container({ p, rotY, color, open }) {
  const { length: L, height: H, width: W, wall } = CONTAINER
  const skin = materials.corrugated(CONTAINER_COLORS[color] ?? '#888')
  const frame = materials.steelDark()
  // Most ground-level boxes have been tagged on one side or both.
  const hash = Math.abs(Math.round(p[0] * 7.3 + p[2] * 13.1))
  const tags = p[1] > 0.5 ? [] : [[hash % 5, 1, ((hash >> 2) % 3) - 1], ...(hash % 3 === 0 ? [[(hash + 2) % 5, -1, 0.8]] : [])]
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      {tags.map(([t, side, x], i) => (
        <mesh
          key={i}
          geometry={containerTagGeo}
          material={materials.graffiti(t)}
          position={[x, H / 2 + 0.05, side * (W / 2 + 0.015)]}
          rotation={[0, side > 0 ? 0 : Math.PI, 0]}
        />
      ))}
      {open ? (
        <>
          <Box size={[L, wall, W]} position={[0, wall / 2, 0]} material={materials.wood()} tile={1.5} />
          <Box size={[L, wall, W]} position={[0, H - wall / 2, 0]} material={skin} tile={2.4} />
          <Box size={[L, H, wall]} position={[0, H / 2, -W / 2 + wall / 2]} material={skin} tile={2.4} />
          <Box size={[L, H, wall]} position={[0, H / 2, W / 2 - wall / 2]} material={skin} tile={2.4} />
          {/* Doors swung wide open at one end. */}
          {[-1, 1].map((s) => (
            <Box key={s} size={[W / 2, H - 0.1, 0.05]} position={[L / 2 + W / 4 - 0.05, H / 2, s * (W / 2 + 0.03)]} rotation={[0, s * 0.15, 0]} material={skin} tile={2.4} />
          ))}
        </>
      ) : (
        <>
          <Box size={[L, H, W]} position={[0, H / 2, 0]} material={skin} tile={2.4} />
          {/* Door end: seams and locking bars. */}
          <Box size={[0.04, H - 0.2, 0.04]} position={[L / 2 + 0.01, H / 2, 0]} material={frame} shadow={false} />
          {[-0.6, -0.25, 0.25, 0.6].map((z) => (
            <Box key={z} size={[0.05, H - 0.3, 0.04]} position={[L / 2 + 0.03, H / 2, z]} material={materials.steel()} shadow={false} />
          ))}
        </>
      )}
      {/* Corner castings and rails */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <Box key={`${sx}${sz}`} size={[0.14, H, 0.14]} position={[sx * (L / 2 - 0.06), H / 2, sz * (W / 2 - 0.06)]} material={frame} />
        )),
      )}
      {[0.07, H - 0.07].map((y) =>
        [-1, 1].map((sz) => (
          <Box key={`${y}${sz}`} size={[L, 0.14, 0.12]} position={[0, y, sz * (W / 2 - 0.05)]} material={frame} shadow={false} />
        )),
      )}
    </group>
  )
}

/* ---------------------------------------------------------------------------
 * Control shack
 * ------------------------------------------------------------------------- */

export function Shack(s) {
  const walls = useMemo(() => shackWallBoxes(s), [s])
  const cx = (s.x0 + s.x1) / 2
  const cz = (s.z0 + s.z1) / 2
  const w = s.x1 - s.x0
  const d = s.z1 - s.z0
  const frame = materials.steelDark()
  return (
    <group>
      {walls.map((b, i) => (
        <Box key={i} size={b.size} position={b.p} material={materials.plaster()} tile={2.5} />
      ))}
      <Box size={[w + 0.4, s.roofThickness, d + 0.4]} position={[cx, s.height + s.roofThickness / 2, cz]} material={materials.corrugated('#8b8478')} tile={2.4} />
      <Box size={[w - 0.4, 0.04, d - 0.4]} position={[cx, 0.02, cz]} material={materials.floor()} shadow={false} />
      {/* Door frame + door hanging open */}
      <Box size={[0.24, 0.08, s.door.to - s.door.from + 0.1]} position={[s.x0 + 0.1, s.door.top, (s.door.from + s.door.to) / 2]} material={frame} shadow={false} />
      <Box size={[0.05, s.door.top - 0.05, s.door.to - s.door.from - 0.05]} position={[s.x0 - 0.45, s.door.top / 2, s.door.from - 0.4]} rotation={[0, 1.1, 0]} material={materials.corrugated('#5d6650')} tile={2} />
      {/* Window frames */}
      {s.windows.map((win, i) => {
        const mid = (win.from + win.to) / 2
        const span = win.to - win.from
        const h = win.top - win.bottom
        const north = win.wall === 'north'
        const pos = north ? [mid, (win.bottom + win.top) / 2, s.z0 + 0.1] : [s.x0 + 0.1, (win.bottom + win.top) / 2, mid]
        return (
          <group key={i} position={pos}>
            <Box size={north ? [span, 0.06, 0.26] : [0.26, 0.06, span]} position={[0, -h / 2, 0]} material={frame} shadow={false} />
            <Box size={north ? [span, 0.06, 0.26] : [0.26, 0.06, span]} position={[0, h / 2, 0]} material={frame} shadow={false} />
            <Box size={north ? [0.04, h, 0.04] : [0.04, h, 0.04]} position={[0, 0, 0]} material={frame} shadow={false} />
          </group>
        )
      })}
      {/* Roof clutter: AC unit + vent */}
      <Box size={[1.0, 0.6, 0.8]} position={[cx + 1.6, s.height + 0.42, cz + 1.4]} material={materials.steel()} />
      <Cyl r={0.15} h={0.7} position={[cx - 1.8, s.height + 0.47, cz - 1.5]} material={materials.rust()} />
      {/* Interior light */}
      <mesh position={[cx, s.height - 0.08, cz]}>
        <boxGeometry args={[0.6, 0.06, 0.2]} />
        <meshStandardMaterial color="#fff3d6" emissive="#ffd9a0" emissiveIntensity={2} />
      </mesh>
    </group>
  )
}

/* ---------------------------------------------------------------------------
 * Perimeter: T-walls, rusty mesh, razor wire, drifted sand
 * ------------------------------------------------------------------------- */

/** A copy of `geo` with its texture slid sideways, so repeated panels don't look stamped. */
function shiftUv(geo, offset) {
  const g = geo.clone()
  const uv = g.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) + offset)
  return g
}

/** Sand piled along a wall: a strip `width` metres out from the face (inside or `outward`), heights from `heightAt(along)`. */
function driftGeometry(side, from, to, width, heightAt, outward) {
  const steps = Math.max(2, Math.round((to - from) / 0.75))
  const across = 5
  const pos = []
  const uv = []
  const idx = []
  const sign = Math.sign(side.fixed) * (outward ? 1 : -1)
  const face = side.fixed + sign * 0.16
  for (let i = 0; i <= steps; i++) {
    const c = from + ((to - from) * i) / steps
    const h = heightAt(c)
    for (let j = 0; j <= across; j++) {
      const t = j / across
      const off = face + sign * t * width
      const y = h * (1 - t) * (1 - t) - 0.02
      if (side.axis === 'x') pos.push(c, y, off)
      else pos.push(off, y, c)
      uv.push(c / 4, (t * width) / 4)
    }
  }
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < across; j++) {
      const a = i * (across + 1) + j
      const b = a + across + 1
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  // Winding depends on the side; render both faces' worth by fixing it up here.
  const flip = (side.axis === 'x') === (sign > 0)
  if (flip) {
    const ix = g.getIndex()
    for (let k = 0; k < ix.count; k += 3) {
      const t = ix.getX(k + 1)
      ix.setX(k + 1, ix.getX(k + 2))
      ix.setX(k + 2, t)
    }
  }
  g.computeVertexNormals()
  return g
}

/**
 * Perimeter: tall concrete T-wall panels (rust runs, bullet pocks), rusty welded
 * mesh above them, razor wire on top, and sand drifted against both faces. The
 * actual boundary is the invisible collider wall in the shared map.
 */
export function Perimeter() {
  const data = useMemo(() => {
    const rand = seededRandom(271)
    const noise = (c, k) => 0.5 + 0.3 * Math.sin(c * 0.37 + k) + 0.2 * Math.sin(c * 1.13 + k * 2.1)
    const walls = []
    const footings = []
    const hooks = []
    const frames = []
    const meshes = []
    const coils = []
    const drifts = []
    const sides = [
      { name: 'north', axis: 'x', fixed: -WALL_LINE, k: 1 },
      { name: 'south', axis: 'x', fixed: WALL_LINE, k: 2 },
      { name: 'west', axis: 'z', fixed: -WALL_LINE, k: 3 },
      { name: 'east', axis: 'z', fixed: WALL_LINE, k: 4 },
    ]
    const panel = 3.0
    const at = (side, c, y, n = 0) => (side.axis === 'x' ? [c, y, side.fixed + n] : [side.fixed + n, y, c])
    const sz = (side, a, h, b) => (side.axis === 'x' ? [a, h, b] : [b, h, a])
    const meshTop = 4.7
    for (const side of sides) {
      for (let c = -WALL_LINE + panel / 2; c < WALL_LINE; c += panel) {
        const crossing = PIPE_CROSSINGS.some(([n, at2]) => n === side.name && Math.abs(at2 - c) < 1.8)
        const h = 3.25 + rand() * 0.35
        const tilt = (rand() - 0.5) * 0.03
        const rot = side.axis === 'x' ? [tilt, 0, 0] : [0, 0, tilt]
        walls.push({ geometry: shiftUv(boxGeo(...sz(side, panel - 0.05, h, 0.3), 3.4), rand()), position: at(side, c, h / 2), rotation: rot })
        footings.push({ geometry: boxGeo(...sz(side, panel - 0.05, 0.3, 0.7), 2), position: at(side, c, 0.15) })
        // The pipe passes over this panel: no hooks or mesh above it.
        if (crossing) continue
        // Two lifting hooks poking out of the top.
        for (const d of [-0.75, 0.75]) {
          hooks.push({ geometry: boxGeo(...sz(side, 0.04, 0.2, 0.04), 1), position: at(side, c + d - 0.07, h + 0.08) })
          hooks.push({ geometry: boxGeo(...sz(side, 0.04, 0.2, 0.04), 1), position: at(side, c + d + 0.07, h + 0.08) })
          hooks.push({ geometry: boxGeo(...sz(side, 0.18, 0.04, 0.04), 1), position: at(side, c + d, h + 0.18) })
        }
        // Rusty mesh panel above: posts at the joints, top + mid rails, mesh infill.
        frames.push({ geometry: boxGeo(0.08, meshTop - 3.0, 0.08, 1), position: at(side, c - panel / 2, (meshTop + 3.0) / 2) })
        frames.push({ geometry: boxGeo(...sz(side, panel, 0.07, 0.07), 1), position: at(side, c, meshTop) })
        frames.push({ geometry: boxGeo(...sz(side, panel, 0.06, 0.06), 1), position: at(side, c, 3.95) })
        meshes.push({ geometry: boxGeo(...sz(side, panel, meshTop - 3.1, 0.01), 0.6), position: at(side, c, (meshTop + 3.1) / 2) })
      }
      for (let c = -WALL_LINE; c <= WALL_LINE; c += 0.22) {
        if (!PIPE_CROSSINGS.some(([n, at2]) => n === side.name && Math.abs(at2 - c) < 1.6)) coils.push({ side, c })
      }
      const end = WALL_LINE - 0.2
      drifts.push(driftGeometry(side, -end, end, 1.4, (c) => 0.12 + 0.42 * noise(c, side.k), false))
      drifts.push(driftGeometry(side, -end - 3, end + 3, 4.5, (c) => 0.6 + 1.6 * noise(c, side.k + 7), true))
    }
    return { walls, footings, hooks, frames, meshes, coils, drifts, meshTop }
  }, [])

  const wallGeo = useMerged(data.walls)
  const footGeo = useMerged(data.footings)
  const hookGeo = useMerged(data.hooks)
  const frameGeo = useMerged(data.frames)
  const meshGeo = useMerged(data.meshes)

  const coilGeo = useMemo(() => new TorusGeometry(0.3, 0.012, 4, 14), [])
  const setCoils = (mesh) => {
    if (!mesh) return
    const o = new Object3D()
    data.coils.forEach(({ side, c }, i) => {
      if (side.axis === 'x') {
        o.position.set(c, data.meshTop + 0.3, side.fixed)
        o.rotation.set(0, Math.PI / 2, 0)
      } else {
        o.position.set(side.fixed, data.meshTop + 0.3, c)
        o.rotation.set(0, 0, 0)
      }
      o.rotation.z += 0.25
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }

  return (
    <group>
      <mesh geometry={wallGeo} material={materials.twall()} castShadow receiveShadow />
      <mesh geometry={footGeo} material={materials.concreteDark()} castShadow receiveShadow />
      <mesh geometry={hookGeo} material={materials.rust()} />
      <mesh geometry={frameGeo} material={materials.rust()} castShadow />
      <mesh geometry={meshGeo} material={materials.weldMesh()} castShadow />
      <instancedMesh args={[coilGeo, instancedVariant(materials.wire()), data.coils.length]} ref={setCoils} />
      {data.drifts.map((g, i) => (
        <mesh key={i} geometry={g} material={materials.sand()} receiveShadow />
      ))}
      {/* Concrete collar where the pipeline goes through the wall. */}
      {PIPE_CROSSINGS.map(([name, at]) => {
        const p = name === 'east' || name === 'west' ? [name === 'east' ? WALL_LINE : -WALL_LINE, PIPELINE.height, at] : [at, PIPELINE.height, name === 'south' ? WALL_LINE : -WALL_LINE]
        const rot = name === 'east' || name === 'west' ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]
        return (
          <group key={name} position={p} rotation={rot}>
            <mesh geometry={cylGeo(PIPELINE.radius + 0.22, 0.9, 24, 1)} material={materials.concreteDark()} castShadow receiveShadow />
            <mesh geometry={cylGeo(PIPELINE.radius + 0.08, 1.4, 24, 1)} material={materials.steelDark()} castShadow />
          </group>
        )
      })}
    </group>
  )
}
