import { useFrame } from '@react-three/fiber'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { AdditiveBlending, Color, MeshStandardMaterial, NormalBlending, Sprite, SpriteMaterial, Vector3 } from 'three'

import { net } from '../../net/network.js'
import { seededRandom } from '../../shared/math.js'
import { EQUIPMENT, WEAPONS } from '../../shared/weapons.js'
import { createWeaponModel } from '../models/weaponModels.js'
import { flareTexture, smokeTexture } from '../world/textures.js'

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

/* ---------------------------------------------------------------------------
 * Rockets in flight: nose along the flight path, motor flame, smoke trail
 * ------------------------------------------------------------------------- */

const TRAIL_PUFFS = 120
/** Shared pool of trail puffs, so a trail lingers after its rocket bursts. */
const trail = { puffs: [], next: 0 }

function emitTrail(pos) {
  const p = trail.puffs[trail.next++ % TRAIL_PUFFS]
  if (!p) return
  p.pos.copy(pos)
  p.pos.x += (Math.random() - 0.5) * 0.08
  p.pos.y += (Math.random() - 0.5) * 0.08
  p.pos.z += (Math.random() - 0.5) * 0.08
  p.age = 0
  p.life = 1.6 + Math.random() * 0.8
  p.drift = 0.25 + Math.random() * 0.3
}

function RocketTrails() {
  const puffs = useMemo(() => {
    const tex = smokeTexture()
    return Array.from({ length: TRAIL_PUFFS }, () => {
      const sprite = new Sprite(new SpriteMaterial({ map: tex, color: '#cfc8bb', transparent: true, depthWrite: false, opacity: 0, rotation: Math.random() * 6 }))
      sprite.visible = false
      sprite.renderOrder = 4
      return { sprite, pos: new Vector3(), age: 1, life: 0, drift: 0 }
    })
  }, [])
  // Published from an effect so it's always the pool that's actually mounted
  // (StrictMode runs the memo twice and keeps one).
  useEffect(() => {
    trail.puffs = puffs
    return () => {
      if (trail.puffs === puffs) trail.puffs = []
    }
  }, [puffs])
  useFrame((_s, dt) => {
    for (const p of puffs) {
      if (p.age >= p.life) {
        p.sprite.visible = false
        continue
      }
      p.age += dt
      const k = p.age / p.life
      p.pos.y += p.drift * dt
      p.sprite.visible = true
      p.sprite.position.copy(p.pos)
      p.sprite.scale.setScalar(0.35 + k * 1.9)
      // Hot and bright right behind the motor, then grey and fading.
      const heat = Math.max(0, 1 - p.age / 0.08)
      p.sprite.material.color.setRGB(0.8 + heat * 0.2, 0.78 + heat * 0.1, 0.73 - heat * 0.3)
      p.sprite.material.opacity = 0.55 * (1 - k) ** 1.4
    }
  })
  return puffs.map((p, i) => <primitive key={i} object={p.sprite} />)
}

const _vel = new Vector3()
const _tgt = new Vector3()
const _look = new Vector3()

const Rocket = memo(function Rocket({ id }) {
  const ref = useRef(null)
  const model = useMemo(() => {
    const m = createWeaponModel('rocket')
    const flame = new Sprite(new SpriteMaterial({ map: flareTexture(), color: '#ffb35a', blending: AdditiveBlending, depthWrite: false, transparent: true }))
    flame.position.z = 0.12
    flame.scale.setScalar(0.7)
    flame.name = 'flame'
    m.add(flame)
    return m
  }, [])
  // Last server sample, when it arrived, and the flight direction between samples.
  const track = useRef({ pos: null, at: 0, vel: new Vector3(), lastPuff: 0 })
  useFrame((_s, dt) => {
    const g = net.room?.state.grenades.get(id)
    const obj = ref.current
    if (!g || !obj) return
    const t = track.current
    const now = performance.now()
    if (!t.pos) {
      t.pos = new Vector3(g.x, g.y, g.z)
      t.at = now
      obj.position.copy(t.pos)
    } else if (g.x !== t.pos.x || g.y !== t.pos.y || g.z !== t.pos.z) {
      _vel.set(g.x - t.pos.x, g.y - t.pos.y, g.z - t.pos.z)
      if (_vel.lengthSq() > 1e-6) t.vel.copy(_vel.normalize().multiplyScalar(WEAPONS.rpg.projectile.speed))
      t.pos.set(g.x, g.y, g.z)
      t.at = now
    }
    // Patches come ~30 times a second and the rocket covers ~1.7 m between
    // them: run it forward from the last one, then ease toward that.
    _tgt.copy(t.pos).addScaledVector(t.vel, Math.min(0.08, (now - t.at) / 1000))
    obj.position.lerp(_tgt, Math.min(1, dt * 30))
    if (t.vel.lengthSq() > 0) obj.lookAt(_look.copy(obj.position).sub(t.vel))
    obj.rotateZ(dt * 12)
    const flame = obj.getObjectByName('flame')
    if (flame) flame.scale.setScalar(0.55 + Math.random() * 0.35)
    if (now - t.lastPuff > 14) {
      t.lastPuff = now
      emitTrail(obj.localToWorld(_look.set(0, 0, 0.2)))
    }
  })
  // Glow from the flame sprite only: adding a light per rocket would change the
  // scene's light count and recompile every shader mid-fight.
  return <primitive ref={ref} object={model} />
})

const Projectile = memo(function Projectile({ id }) {
  const kind = net.room?.state.grenades.get(id)?.kind
  return kind === 'rocket' ? <Rocket id={id} /> : <Grenade id={id} />
})

export function GrenadeMeshes() {
  const keys = useCollectionKeys((s) => s.grenades)
  return (
    <>
      {keys.map((id) => (
        <Projectile key={id} id={id} />
      ))}
      <RocketTrails />
    </>
  )
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
