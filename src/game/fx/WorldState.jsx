import { useFrame } from '@react-three/fiber'
import { memo, useMemo, useRef, useState } from 'react'
import { Color, MeshStandardMaterial, NormalBlending, SpriteMaterial } from 'three'

import { net } from '../../net/network.js'
import { seededRandom } from '../../shared/math.js'
import { EQUIPMENT } from '../../shared/weapons.js'
import { createWeaponModel } from '../models/weaponModels.js'
import { smokeTexture } from '../world/textures.js'

/**
 * Re-renders only when the set of keys in a synced collection changes; per-frame
 * values are read straight from the Colyseus state inside useFrame.
 */
function useCollectionKeys(pick) {
  const [keys, setKeys] = useState([])
  const last = useRef('')
  useFrame(() => {
    const col = net.room ? pick(net.room.state) : null
    let sig = ''
    if (col) col.forEach((_v, k) => (sig += `${k},`))
    if (sig !== last.current) {
      last.current = sig
      setKeys(sig ? sig.slice(0, -1).split(',') : [])
    }
  })
  return keys
}

/* ---------------------------------------------------------------------------
 * Grenades in flight
 * ------------------------------------------------------------------------- */

const Grenade = memo(function Grenade({ id }) {
  const ref = useRef(null)
  const kind = net.room?.state.grenades.get(id)?.kind ?? 'frag'
  const model = useMemo(() => createWeaponModel(kind), [kind])
  const spin = useRef(Math.random() * 6)
  useFrame((_s, dt) => {
    const g = net.room?.state.grenades.get(id)
    const obj = ref.current
    if (!g || !obj) return
    // Patches arrive at 20 Hz; ease toward the latest so motion stays smooth.
    if (obj.userData.init) obj.position.lerp({ x: g.x, y: g.y, z: g.z }, Math.min(1, dt * 18))
    else {
      obj.position.set(g.x, g.y, g.z)
      obj.userData.init = true
    }
    spin.current += dt * 8
    obj.rotation.set(spin.current, spin.current * 0.6, 0)
  })
  return <primitive ref={ref} object={model} scale={1.4} />
})

export function GrenadeMeshes() {
  const keys = useCollectionKeys((s) => s.grenades)
  return keys.map((id) => <Grenade key={id} id={id} />)
}

/* ---------------------------------------------------------------------------
 * Smoke clouds
 * ------------------------------------------------------------------------- */

const PUFFS = 26

const SmokeCloud = memo(function SmokeCloud({ id }) {
  const group = useRef(null)
  const born = useRef(performance.now())
  const layout = useMemo(() => {
    const rand = seededRandom([...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7))
    const r = EQUIPMENT.smoke.radius
    return Array.from({ length: PUFFS }, () => {
      const a = rand() * Math.PI * 2
      const d = Math.sqrt(rand()) * r * 0.8
      return {
        x: Math.cos(a) * d,
        z: Math.sin(a) * d,
        y: 0.6 + rand() * 2.6,
        size: 2.6 + rand() * 2.4,
        drift: (rand() - 0.5) * 0.3,
        rot: rand() * Math.PI * 2,
        shade: 0.78 + rand() * 0.2,
      }
    })
  }, [id])
  const materials = useMemo(
    () =>
      layout.map(
        (p) =>
          new SpriteMaterial({
            map: smokeTexture(),
            color: new Color(p.shade, p.shade, p.shade * 0.97),
            transparent: true,
            depthWrite: false,
            blending: NormalBlending,
            rotation: p.rot,
            opacity: 0,
          }),
      ),
    [layout],
  )

  useFrame((_s, dt) => {
    const s = net.room?.state.smokes.get(id)
    const g = group.current
    if (!s || !g) return
    g.position.set(s.x, s.y, s.z)
    const age = (performance.now() - born.current) / 1000
    const grow = Math.min(1, age / 1.6)
    const fade = Math.min(1, s.remaining / EQUIPMENT.smoke.fadeTime)
    g.children.forEach((sprite, i) => {
      const p = layout[i]
      const k = 0.35 + grow * 0.65
      sprite.position.set(p.x * k + p.drift * age, p.y * (0.4 + grow * 0.6), p.z * k)
      sprite.scale.setScalar(p.size * (0.5 + grow * 0.5))
      materials[i].opacity = 0.92 * fade * Math.min(1, age * 2)
      materials[i].rotation += dt * 0.05 * (i % 2 ? 1 : -1)
    })
  })

  return (
    <group ref={group}>
      {materials.map((m, i) => (
        <sprite key={i} material={m} renderOrder={4} />
      ))}
    </group>
  )
})

export function SmokeClouds() {
  const keys = useCollectionKeys((s) => s.smokes)
  return keys.map((id) => <SmokeCloud key={id} id={id} />)
}

/* ---------------------------------------------------------------------------
 * Ammo boxes dropped by the dead
 * ------------------------------------------------------------------------- */

const ammoMat = new MeshStandardMaterial({ color: '#4c5a33', roughness: 0.7, emissive: '#2a3a10', emissiveIntensity: 0.4 })
const bandMat = new MeshStandardMaterial({ color: '#d6a51c', emissive: '#d6a51c', emissiveIntensity: 0.6 })

const Pickup = memo(function Pickup({ id }) {
  const ref = useRef(null)
  useFrame(({ clock }) => {
    const a = net.room?.state.pickups.get(id)
    if (!a || !ref.current) return
    ref.current.position.set(a.x, a.y + 0.25 + Math.sin(clock.elapsedTime * 3) * 0.05, a.z)
    ref.current.rotation.y = clock.elapsedTime * 1.5
  })
  return (
    <group ref={ref}>
      <mesh material={ammoMat} castShadow>
        <boxGeometry args={[0.42, 0.24, 0.26]} />
      </mesh>
      <mesh material={bandMat} position={[0, 0.05, 0]}>
        <boxGeometry args={[0.43, 0.04, 0.27]} />
      </mesh>
    </group>
  )
})

export function AmmoPickups() {
  const keys = useCollectionKeys((s) => s.pickups)
  return keys.map((id) => <Pickup key={id} id={id} />)
}
