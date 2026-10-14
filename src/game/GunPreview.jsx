import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'

import { weaponsIn } from '../shared/weapons.js'
import { createWeaponModel } from './models/weaponModels.js'
import StudioEnvironment from './StudioEnvironment.jsx'

/**
 * Dev-only: `/?preview=guns` lays out every weapon with a spread of attachment
 * combinations, side-on (`&spin` to rotate them, `&only=N` for a close-up of
 * one). `&cat=ar` (or smg, sniper, lmg, pistol, lethal) lays out one category
 * instead: each gun bare, then fully kitted.
 */
const KITTED = {
  ar: { optic: 'acog', muzzle: 'brake', under: 'grip', mag: 'fast' },
  smg: { optic: 'holo', muzzle: 'suppressor', under: 'laser', mag: 'extended' },
  sniper: { muzzle: 'suppressor', under: 'angled', mag: 'fast' },
  lmg: { optic: 'reddot', muzzle: 'compensator', under: 'angled', mag: 'fast' },
  pistol: { optic: 'reddot', muzzle: 'suppressor', under: 'laser', mag: 'extended' },
}
function categoryLineup(cat) {
  if (cat === 'lethal') return ['frag', 'semtex', 'c4', 'claymore', 'detonator', 'flash', 'smoke'].map((id) => [id, {}])
  return weaponsIn(cat).flatMap((id) => [[id, { optic: 'iron' }], [id, KITTED[cat] ?? {}]])
}
const LINEUP = [
  ['ar', { optic: 'iron', muzzle: 'none', mag: 'std' }],
  ['ar', { optic: 'reddot', muzzle: 'suppressor', mag: 'extended' }],
  ['ar', { optic: 'holo', muzzle: 'compensator', mag: 'std' }],
  ['sniper', { muzzle: 'none', mag: 'std' }],
  ['sniper', { muzzle: 'suppressor', mag: 'extended' }],
  ['pistol', { optic: 'iron', muzzle: 'none', mag: 'std' }],
  ['pistol', { optic: 'reddot', muzzle: 'suppressor', mag: 'extended' }],
  ['viper', { optic: 'iron', muzzle: 'none' }],
  ['viper', { optic: 'reddot', muzzle: 'compensator' }],
  ['hornet', { optic: 'iron', muzzle: 'none', mag: 'std' }],
  ['hornet', { optic: 'reddot', muzzle: 'suppressor', mag: 'extended' }],
  ['smg', { optic: 'iron', muzzle: 'none', mag: 'std' }],
  ['smg', { optic: 'holo', muzzle: 'suppressor', mag: 'extended' }],
  ['shotgun', { optic: 'iron', muzzle: 'none' }],
  ['shotgun', { optic: 'reddot', muzzle: 'suppressor' }],
  ['lmg', { optic: 'iron', muzzle: 'none' }],
  ['lmg', { optic: 'reddot', muzzle: 'compensator' }],
  ['rpg', {}],
  ['knife', {}],
]
/** Columns in the full line-up. */
const COLS = 4

function Gun({ id, att, position }) {
  const ref = useRef(null)
  const model = useMemo(() => createWeaponModel(id, att), [id, att])
  const spin = new URLSearchParams(window.location.search).has('spin')
  useFrame((_s, dt) => {
    if (spin && ref.current) ref.current.rotation.y += dt * 0.5
  })
  return (
    <group ref={ref} position={position} rotation={[0, -Math.PI / 2, 0]}>
      <primitive object={model} />
    </group>
  )
}

export function GunPreview() {
  const params = new URLSearchParams(window.location.search)
  const only = params.get('only')
  const cat = params.get('cat')
  const lineup = cat ? categoryLineup(cat) : LINEUP
  const list = only !== null ? [lineup[Number(only)] ?? lineup[0]] : lineup
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#1a1814' }}>
      <Canvas camera={{ position: [0, 0, only !== null ? 1.1 : 3.9], fov: 40 }}>
        <StudioEnvironment intensity={0.9} />
        <ambientLight intensity={0.2} />
        {/* Key light from the camera side so the near faces read, cool rim behind. */}
        <directionalLight position={[1, 2, 4]} intensity={2.2} color="#fff1dd" />
        <directionalLight position={[-2, 1, -3]} intensity={1.4} color="#b8cfff" />
        {list.map(([id, att], i) => {
          const col = i % COLS
          const row = Math.floor(i / COLS)
          const pos = only !== null ? [0.15, 0, 0] : [(col - (COLS - 1) / 2) * 1.25, 1.1 - row * 0.52, 0]
          return <Gun key={i} id={id} att={att} position={pos} />
        })}
      </Canvas>
    </div>
  )
}

export default GunPreview
