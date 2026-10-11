import { materials } from './materials.js'
import { Box, Cyl } from './parts.jsx'

/**
 * Burnt-out vehicles: a fuel tanker gutted by fire and a scorched sedan. The
 * flames and smoke come from the effects system (see `fire` / `smoke` on the
 * map entity); the cab interiors glow with the shared ember material.
 */

const wheel = (x, y, z, key, r = 0.5, w = 0.34, burnt = false) => (
  <Cyl key={key} r={r} h={w} segments={14} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]} material={burnt ? materials.charred() : materials.rubber()} tile={1} />
)

/** Fuel tanker: cab at the front (-Z), chassis, the split and blackened tank. */
export function Tanker({ p, rotY }) {
  const hull = materials.burnt()
  const dark = materials.charred()
  const tank = materials.tankerBurnt()
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      {/* Wheels: some burnt down to the rims, so it sags to one side. */}
      {[-3.1, -0.9, 0.3, 2.4, 3.5].flatMap((z, i) => [
        wheel(-1.0, i === 2 ? 0.36 : 0.48, z, `l${i}`, 0.5, 0.34, i === 2),
        wheel(1.0, 0.48, z, `r${i}`, 0.5, 0.34, i === 0),
      ])}
      <Box size={[1.8, 0.35, 7.6]} position={[0, 0.72, 0.2]} material={materials.steelDark()} />
      {/* Cab: windows gone, roof buckled, glowing inside. */}
      <Box size={[2.3, 1.1, 1.9]} position={[0, 1.45, -3.15]} material={hull} tile={1.2} />
      <Box size={[2.3, 0.12, 1.7]} position={[0, 2.62, -3.1]} rotation={[0.08, 0, 0.05]} material={hull} tile={1.2} />
      {[-1, 1].map((s) => (
        <Box key={s} size={[0.08, 0.7, 1.7]} position={[s * 1.11, 2.25, -3.1]} material={hull} tile={1.2} />
      ))}
      <Box size={[2.1, 0.7, 0.08]} position={[0, 2.25, -3.98]} rotation={[-0.15, 0, 0]} material={dark} shadow={false} />
      <Box size={[1.9, 0.5, 1.5]} position={[0, 1.95, -3.1]} material={materials.ember()} shadow={false} />
      <Box size={[2.2, 0.45, 0.3]} position={[0, 0.95, -4.15]} material={dark} />
      {/* Tank: blackened shell, rings, a split down one side with the glow showing. */}
      <Cyl r={1.08} h={5.3} segments={22} position={[0, 2.05, 0.95]} rotation={[Math.PI / 2, 0, 0]} material={tank} tile={1.6} />
      {[-1.6, 0.95, 3.5].map((z) => (
        <Cyl key={z} r={1.12} h={0.12} segments={22} position={[0, 2.05, z]} rotation={[Math.PI / 2, 0, 0]} material={dark} tile={1} shadow={false} />
      ))}
      <Box size={[0.3, 0.55, 2.4]} position={[1.0, 2.1, 0.6]} rotation={[0, 0, 0.3]} material={materials.ember()} shadow={false} />
      <Box size={[0.06, 0.7, 2.6]} position={[1.12, 2.3, 0.6]} rotation={[0, 0, 0.45]} material={dark} />
      <Box size={[0.6, 0.12, 1.2]} position={[0, 3.18, 0.9]} material={dark} />
      {/* A torn panel and a tyre lying in the sand. */}
      <Box size={[1.2, 0.05, 0.9]} position={[1.9, 0.08, 1.8]} rotation={[0.1, 0.6, 0.12]} material={hull} />
      <mesh position={[-2.1, 0.13, -1.6]} rotation={[Math.PI / 2, 0, 0]} material={materials.rubber()} castShadow>
        <torusGeometry args={[0.42, 0.14, 8, 16]} />
      </mesh>
    </group>
  )
}

/** Spare pipe lengths stacked on timber sleepers (open ends, dark inside). */
export function PipeStack({ p, rotY }) {
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      {[-1.6, 1.6].map((z) => (
        <Box key={z} size={[1.9, 0.14, 0.24]} position={[0, 0.07, z]} material={materials.wood()} tile={1} />
      ))}
      {[[-0.52, 0.62], [0.52, 0.62], [0, 1.5]].map(([x, y]) => (
        <group key={`${x}${y}`} position={[x, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <Cyl r={0.5} h={5} segments={20} openEnded material={materials.pipe()} tile={2.4} />
          <Cyl r={0.45} h={4.98} segments={20} openEnded material={materials.pipeInside()} tile={2.4} shadow={false} />
          {[-2.5, 2.5].map((e) => (
            <mesh key={e} position={[0, e, 0]} rotation={[Math.PI / 2, 0, 0]} material={materials.rust()}>
              <ringGeometry args={[0.45, 0.5, 20]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

/** Scorched sedan sitting on its rims, bonnet up, still smouldering. */
export function CarWreck({ p, rotY }) {
  const hull = materials.burnt()
  const dark = materials.charred()
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      {[[-0.82, -1.35], [0.82, -1.35], [-0.82, 1.35], [0.82, 1.35]].map(([x, z], i) => wheel(x, 0.3, z, i, 0.32, 0.22, true))}
      <Box size={[1.8, 0.6, 4.3]} position={[0, 0.6, 0]} material={hull} tile={1.2} />
      <Box size={[1.6, 0.5, 2.0]} position={[0, 1.15, 0.2]} material={hull} tile={1.2} />
      <Box size={[1.5, 0.06, 1.9]} position={[0, 1.42, 0.2]} rotation={[0.04, 0, -0.06]} material={dark} />
      <Box size={[1.5, 0.35, 1.8]} position={[0, 0.98, 0.2]} material={materials.ember()} shadow={false} />
      {/* Bonnet sprung open, boot lid gone. */}
      <Box size={[1.6, 0.05, 1.1]} position={[0, 1.25, -1.55]} rotation={[-0.75, 0, 0]} material={hull} />
      <Box size={[1.7, 0.1, 0.9]} position={[0, 0.95, 1.8]} material={dark} />
    </group>
  )
}
