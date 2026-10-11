import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, MeshStandardMaterial, PlaneGeometry, Quaternion, SphereGeometry, SpriteMaterial, TorusGeometry } from 'three'

import { railRuns, rampBox, refineryWallBoxes } from '../../shared/map.js'
import { segmentTransform, useMerged } from './geometryUtils.js'
import { boxGeo, materials } from './materials.js'
import { Box, Cyl } from './parts.jsx'
import { flareTexture, refinerySignTexture } from './textures.js'

/**
 * The refinery in the middle of the map: a corrugated pump hall with a red
 * skirt and an open bay, the deck over them, a tall clad process tower with the
 * company plate and a flare stack, the raised tank platform on its braced
 * frame, and the conveyor running up the west side. Collision comes from the
 * same shared data (shared/map.js REFINERY).
 */

const signMat = new MeshStandardMaterial({ map: refinerySignTexture(), roughness: 0.7, metalness: 0.2 })
const signGeo = new PlaneGeometry(1, 1)
const domeGeo = new SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)
const tyreGeo = new TorusGeometry(0.33, 0.12, 8, 18)
const toQuat = (q) => new Quaternion(q[0], q[1], q[2], q[3])

/** Rails round a rectangle at height y: posts, top and mid rails (kick plates go in their own list). */
function railParts(x0, x1, z0, z1, y, gaps, steel, kicks) {
  for (const run of railRuns(x0, x1, z0, z1, gaps)) {
    const { axis, fixed } = run
    // Side runs stop short of the corners so they don't overlap the end runs.
    const a = axis === 'z' ? Math.max(run.a, z0 + 0.09) : run.a
    const b = axis === 'z' ? Math.min(run.b, z1 - 0.09) : run.b
    if (b - a < 0.05) continue
    const len = b - a
    const mid = (a + b) / 2
    const at = (c, yy) => (axis === 'x' ? [c, yy, fixed] : [fixed, yy, c])
    const size = (h, w) => (axis === 'x' ? [len, h, w] : [w, h, len])
    steel.push({ geometry: boxGeo(...size(0.05, 0.05), 1), position: at(mid, y + 1.0) })
    steel.push({ geometry: boxGeo(...size(0.04, 0.04), 1), position: at(mid, y + 0.6) })
    kicks.push({ geometry: boxGeo(...size(0.3, 0.06), 1), position: at(mid, y + 0.15) })
    const posts = Math.max(1, Math.round(len / 1.2))
    for (let i = 0; i <= posts; i++) steel.push({ geometry: boxGeo(0.06, 1.0, 0.06, 1), position: at(a + (len * i) / posts, y + 0.5) })
  }
}

export function Refinery(r) {
  const { hall, bay, deck, tower: tw, platform: pf, tank, conveyor: cv, columns } = r
  const walls = useMemo(() => refineryWallBoxes(r), [r])

  const parts = useMemo(() => {
    const steel = []
    const dark = []
    const kicks = []
    const skirt = []
    const panels = []
    const box = (list, size, p, extra) => list.push({ geometry: boxGeo(size[0], size[1], size[2], 1), position: p, ...extra })
    const beam = (list, a, b, w = 0.1) => {
      const t = segmentTransform(a, b)
      list.push({ geometry: boxGeo(w, t.length, w, 1), position: t.position, quaternion: t.quaternion })
    }

    // Red skirt along the bottom of every wall piece that reaches the ground.
    for (const w of walls) {
      if (w.y0 > 0.01) continue
      const h = Math.min(1.1, w.size[1])
      // A touch longer and thicker than the wall so no face lines up with it.
      const s = [w.size[0] + (w.size[0] > w.size[2] ? 0.02 : 0.04), h, w.size[2] + (w.size[2] > w.size[0] ? 0.02 : 0.04)]
      skirt.push({ geometry: boxGeo(s[0], s[1], s[2], 2.4), position: [w.p[0], h / 2, w.p[2]] })
    }

    // Steel frame: corner columns, the fascia round the deck, door frames.
    const corners = [[hall.x0, hall.z0], [hall.x0, hall.z1], [hall.x1, hall.z0], [hall.x1, hall.z1], [bay.x1, hall.z0], [bay.x1, hall.z1]]
    for (const [x, z] of corners) box(dark, [0.3, deck - 0.04, 0.3], [x, (deck - 0.04) / 2, z])
    box(dark, [10.4, 0.34, 0.12], [0, deck - 0.2, hall.z0 - 0.12])
    box(dark, [10.4, 0.34, 0.12], [0, deck - 0.2, hall.z1 + 0.12])
    box(dark, [0.12, 0.3, 8.4], [hall.x0 - 0.12, deck - 0.2, 0])
    box(dark, [0.12, 0.3, 8.4], [bay.x1 + 0.12, deck - 0.2, 0])
    for (const [x0, x1, z] of [[-1.0, 0.2, hall.z0], [-3.4, -2.2, hall.z1]]) {
      for (const x of [x0, x1]) box(dark, [0.1, 2.25, 0.3], [x, 1.12, z])
      box(dark, [x1 - x0 + 0.2, 0.12, 0.3], [(x0 + x1) / 2, 2.24, z])
    }

    // Deck, platform and tower-top rails.
    railParts(-5.1, 5.1, -4.1, 4.1, deck, r.deckGaps, steel, kicks)
    railParts(pf.x0, pf.x1, pf.z0, pf.z1, pf.top, [...r.platformGaps, ['west', tw.z0, tw.z1]], steel, kicks)
    railParts(tw.x0, tw.x1, tw.z0, tw.z1, tw.top, r.towerGaps, steel, kicks)

    // Platform: columns, X bracing on its open faces, edge channel.
    for (const [x, z] of columns) box(dark, [0.26, pf.top - 0.2 - deck, 0.26], [x, (deck + pf.top - 0.2) / 2, z])
    const lo = deck + 0.25
    const hi = pf.top - 0.3
    for (const [a, b] of [
      [[1.6, lo, -3.85], [4.85, hi, -3.85]],
      [[1.6, hi, -3.85], [4.85, lo, -3.85]],
      [[4.85, lo, -3.85], [4.85, hi, 0.45]],
      [[4.85, hi, -3.85], [4.85, lo, 0.45]],
    ]) beam(dark, a, b, 0.12)
    box(dark, [pf.x1 - pf.x0 + 0.1, 0.26, 0.1], [(pf.x0 + pf.x1) / 2, pf.top - 0.2, pf.z0 - 0.05])
    box(dark, [pf.x1 - pf.x0 + 0.1, 0.26, 0.1], [(pf.x0 + pf.x1) / 2, pf.top - 0.2, pf.z1 + 0.05])
    box(dark, [0.1, 0.26, pf.z1 - pf.z0], [pf.x1 + 0.05, pf.top - 0.2, (pf.z0 + pf.z1) / 2])

    // Tower: corner angles and banding.
    const th = tw.top - deck
    const tcx = (tw.x0 + tw.x1) / 2
    const tcz = (tw.z0 + tw.z1) / 2
    // Everything on the tower stops under the roof slab.
    const wallH = th - 0.15
    for (const x of [tw.x0, tw.x1]) for (const z of [tw.z0, tw.z1]) box(dark, [0.18, wallH, 0.18], [x, deck + wallH / 2, z])
    for (const y of [deck + 2.5, deck + 5.0, tw.top - 0.4]) box(dark, [tw.x1 - tw.x0 + 0.12, 0.16, tw.z1 - tw.z0 + 0.12], [tcx, y, tcz])

    // Conveyor: sheet sides with a hazard band, open truss on top, legs.
    const side = (offset, h, lift) => {
      const up = (p) => [p[0], p[1] + lift, p[2] + offset]
      return rampBox(up(cv.top), up(cv.bottom), 0.05, h)
    }
    for (const s of [-1, 1]) {
      const off = s * (cv.width / 2 + 0.04)
      const sheet = side(off, 0.55, 0.32)
      panels.push({ geometry: boxGeo(sheet.size[0], sheet.size[1], sheet.size[2], 2), position: sheet.p, quaternion: toQuat(sheet.q) })
      const band = side(off - s * 0.035, 0.16, 0.14)
      kicks.push({ geometry: boxGeo(band.size[0], band.size[1], band.size[2], 1), position: band.p, quaternion: toQuat(band.q) })
      // Top chord, and posts + diagonals up the length: stood just outside the
      // sheet so no face of the truss lies in the sheet's plane.
      const truss = off + s * 0.07
      const at = (t, y) => [cv.bottom[0] + (cv.top[0] - cv.bottom[0]) * t, cv.bottom[1] + (cv.top[1] - cv.bottom[1]) * t + y, cv.bottom[2] + truss]
      beam(dark, at(0, 1.0), at(1, 1.0), 0.08)
      const n = 8
      for (let i = 0; i <= n; i++) {
        beam(dark, at(i / n, 0.05), at(i / n, 1.0), 0.07)
        if (i < n) beam(dark, at(i / n, 0.1), at((i + 1) / n, 0.95), 0.05)
      }
    }
    const slope = (cv.top[1] - cv.bottom[1]) / (cv.top[0] - cv.bottom[0])
    for (const x of cv.legs) {
      const h = cv.bottom[1] + (x - cv.bottom[0]) * slope - 0.2
      for (const s of [-1, 1]) box(dark, [0.2, h, 0.2], [x, h / 2, cv.bottom[2] + s * (cv.width / 2 - 0.1)])
      box(dark, [0.12, 0.12, cv.width], [x, h - 0.1, cv.bottom[2]])
      if (h > 1.2) box(dark, [0.1, 0.1, cv.width], [x, h * 0.45, cv.bottom[2]])
    }
    // Pipes from the tank platform into the tower.
    beam(steel, [tank.p[0] - 0.9, pf.top + 0.6, tank.p[1]], [tw.x1 + 0.02, pf.top + 0.6, tank.p[1]], 0.16)
    beam(steel, [tank.p[0], pf.top + 2.7, tank.p[1] + 0.2], [tw.x1 + 0.02, pf.top + 3.4, -1.0], 0.12)
    beam(steel, [tw.x0 - 0.18, deck + 0.3, -3.3], [tw.x0 - 0.18, tw.top + 0.4, -3.3], 0.14)
    return { steel, dark, kicks, skirt, panels }
  }, [r, walls, hall, bay, deck, tw, pf, tank, cv, columns])

  const steelGeo = useMerged(parts.steel)
  const darkGeo = useMerged(parts.dark)
  const kickGeo = useMerged(parts.kicks)
  const skirtGeo = useMerged(parts.skirt)
  const panelGeo = useMerged(parts.panels)
  // Drawn a hair under the walking surface where it meets the deck, so the two never share a plane.
  const belt = useMemo(() => rampBox([cv.top[0] - 0.06, cv.top[1] - 0.012, cv.top[2]], [cv.bottom[0], cv.bottom[1] - 0.012, cv.bottom[2]], cv.width, 0.16), [cv])

  // The flare burns at the top of its stack.
  const flame = useRef(null)
  const flameMat = useMemo(
    () => new SpriteMaterial({ map: flareTexture(), color: '#ffb35c', blending: AdditiveBlending, depthWrite: false, transparent: true }),
    [],
  )
  const flareTop = tw.top + 5.6
  useFrame(({ clock }) => {
    const f = flame.current
    if (!f) return
    const t = clock.elapsedTime
    const k = 1 + Math.sin(t * 9.1) * 0.12 + Math.sin(t * 23.7) * 0.08
    f.scale.set(1.5 * k, 2.4 * k, 1)
    f.position.y = flareTop + 0.9 + Math.sin(t * 5.3) * 0.08
  })

  const cladding = materials.corrugated('#a89a82')
  const hallSkin = materials.corrugated('#8e8576')
  const th = tw.top - deck
  const tcx = (tw.x0 + tw.x1) / 2
  const tcz = (tw.z0 + tw.z1) / 2
  return (
    <group>
      {/* Hall + bay: corrugated walls with a red skirt, floor slab, the deck over them. */}
      {walls.map((w, i) => (
        <Box key={i} size={w.size} position={w.p} material={hallSkin} tile={2.4} />
      ))}
      <mesh geometry={skirtGeo} material={materials.corrugated('#8a3226')} castShadow receiveShadow />
      <Box size={[10, 0.05, 8]} position={[0, 0.025, 0]} material={materials.floor()} tile={3} shadow={false} />
      <Box size={[10.2, 0.2, 8.2]} position={[0, deck - 0.1, 0]} material={materials.slab()} tile={3} />
      <mesh geometry={darkGeo} material={materials.towerDark()} castShadow receiveShadow />
      <mesh geometry={steelGeo} material={materials.steelDark()} castShadow />
      <mesh geometry={kickGeo} material={materials.hazardStripe()} castShadow receiveShadow />

      {/* Grilles in the windows, "02" plate on the bay. */}
      <Box size={[0.02, 1.2, 2.0]} position={[hall.x0 + 0.1, 1.6, -0.5]} material={materials.weldMesh()} shadow={false} />
      <Box size={[0.02, 1.6, 3.0]} position={[bay.x1 - 0.1, 1.8, -1.3]} material={materials.weldMesh()} shadow={false} />
      <Box size={[1.4, 1.0, 0.02]} position={[-0.5, 1.5, hall.z1 - 0.1]} material={materials.weldMesh()} shadow={false} />
      <Box size={[0.04, 0.6, 0.6]} position={[bay.x1 + 0.03, 2.95, 1.2]} material={materials.hazard()} />

      {/* Pump machine inside the hall, with its pipework. */}
      <Box size={[2.2, 1.5, 1.3]} position={[-2.6, 0.75, 1.6]} material={materials.machine()} tile={1} />
      <Cyl r={0.3} h={1.8} position={[-2.6, 1.7, 1.6]} rotation={[0, 0, Math.PI / 2]} material={materials.rust()} />
      <Cyl r={0.14} h={1.9} position={[-3.9, 2.4, 1.6]} material={materials.rust()} />

      {/* Process tower: clad box, company plates, AC units, roof with chimneys and the flare. */}
      <Box size={[tw.x1 - tw.x0, th - 0.15, tw.z1 - tw.z0]} position={[tcx, deck + (th - 0.15) / 2, tcz]} material={cladding} tile={2.4} />
      {/* Plates stand proud of the banding that runs behind them. */}
      <mesh geometry={signGeo} material={signMat} position={[tcx, deck + 3.9, tw.z1 + 0.1]} scale={2.2} />
      <mesh geometry={signGeo} material={signMat} position={[tw.x0 - 0.1, deck + 3.9, tcz]} rotation={[0, -Math.PI / 2, 0]} scale={2.2} />
      <mesh geometry={signGeo} material={signMat} position={[tcx, deck + 3.9, tw.z0 - 0.1]} rotation={[0, Math.PI, 0]} scale={2.2} />
      {[[tw.x0 - 0.35, deck + 1.3, -1.0], [tw.x0 - 0.35, deck + 1.3, -2.6]].map((p, i) => (
        <Box key={i} size={[0.6, 0.65, 0.9]} position={p} material={materials.machine()} tile={1} />
      ))}
      <Box size={[tw.x1 - tw.x0 + 0.2, 0.15, tw.z1 - tw.z0 + 0.2]} position={[tcx, tw.top - 0.075, tcz]} material={materials.slab()} tile={2} />
      <Cyl r={0.35} h={3.2} position={[tw.x0 + 0.7, tw.top + 1.6, tw.z0 + 0.7]} material={materials.rust()} />
      <Cyl r={0.42} h={0.18} position={[tw.x0 + 0.7, tw.top + 3.2, tw.z0 + 0.7]} material={materials.steelDark()} />
      <Cyl r={0.28} h={2.6} position={[tw.x0 + 1.6, tw.top + 1.3, tw.z0 + 0.6]} material={materials.rust()} />
      <Cyl r={0.11} h={5.6} position={[tw.x1 - 0.12, tw.top + 2.8, tw.z0 + 0.12]} material={materials.steelDark()} />
      <Cyl r={0.2} h={0.35} position={[tw.x1 - 0.12, flareTop, tw.z0 + 0.12]} material={materials.rust()} />
      <sprite ref={flame} userData={{ dynamic: true }} material={flameMat} position={[tw.x1 - 0.12, flareTop + 0.9, tw.z0 + 0.12]} />

      {/* Tank platform: grating deck and the silver tank. */}
      <Box size={[pf.x1 - pf.x0, 0.2, pf.z1 - pf.z0]} position={[(pf.x0 + pf.x1) / 2, pf.top - 0.1, (pf.z0 + pf.z1) / 2]} material={materials.grate()} tile={1.5} />
      <Cyl r={tank.r} h={tank.h} segments={28} position={[tank.p[0], pf.top + tank.h / 2, tank.p[1]]} material={materials.steel()} tile={2} />
      <mesh geometry={domeGeo} material={materials.steel()} position={[tank.p[0], pf.top + tank.h, tank.p[1]]} scale={[tank.r, tank.r * 0.45, tank.r]} castShadow />
      {[0.25, 0.75].map((f) => (
        <Cyl key={f} r={tank.r + 0.03} h={0.08} segments={28} position={[tank.p[0], pf.top + tank.h * f, tank.p[1]]} material={materials.rust()} shadow={false} />
      ))}

      {/* Conveyor up to the deck. */}
      <mesh geometry={boxGeo(belt.size[0], belt.size[1], belt.size[2], 1)} material={materials.belt()} position={belt.p} quaternion={toQuat(belt.q)} castShadow receiveShadow />
      <mesh geometry={panelGeo} material={cladding} castShadow receiveShadow />

      {/* Clutter: an IBC tote on its pallet, stacked tyres. */}
      <group position={[r.ibc[0], 0, r.ibc[1]]}>
        <Box size={[1.1, 0.14, 1.1]} position={[0, 0.07, 0]} material={materials.wood()} tile={1} />
        <Box size={[1.0, 0.92, 1.0]} position={[0, 0.6, 0]} material={materials.tankWhite()} tile={1} />
        {[-0.52, 0.52].map((x) => [-0.52, 0.52].map((z) => <Box key={`${x}${z}`} size={[0.04, 0.98, 0.04]} position={[x, 0.62, z]} material={materials.steel()} shadow={false} />))}
        <Box size={[1.08, 0.04, 1.08]} position={[0, 1.1, 0]} material={materials.steel()} shadow={false} />
      </group>
      {r.tyres.map(([x, z, n]) =>
        Array.from({ length: n }, (_, i) => (
          <mesh key={`${x}${z}${i}`} geometry={tyreGeo} material={materials.rubber()} position={[x + (i % 2) * 0.04, 0.13 + i * 0.25, z]} rotation={[Math.PI / 2, 0, i * 0.7]} castShadow />
        )),
      )}
    </group>
  )
}

export default Refinery
