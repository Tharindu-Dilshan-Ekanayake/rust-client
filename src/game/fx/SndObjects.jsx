import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, CanvasTexture, SRGBColorSpace } from 'three'

import { sfx } from '../../audio/sfx.js'
import { SND } from '../../shared/constants.js'
import { useActiveMap, useGameStore } from '../../store/gameStore.js'
import { castMap } from '../physicsQueries.js'
import { runtime } from '../runtime.js'
import { sitesOf } from '../snd.js'

/**
 * Search & Destroy in the world: the two bomb sites painted on the ground (a
 * ring the size of the plant zone and a stencilled letter), and the bomb itself
 * wherever it's lying: dropped, planted (beeping faster as it runs down), or
 * defused. Positions come from runtime.snd, the room state as it arrives.
 */

/** A stencilled site letter, as if sprayed on the ground. */
function letterTexture(letter) {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')
  g.font = '900 210px Impact, "Arial Black", "Helvetica Neue", sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.lineJoin = 'round'
  g.lineWidth = 16
  g.strokeStyle = 'rgba(18, 14, 8, 0.5)'
  g.strokeText(letter, 128, 136)
  g.fillStyle = 'rgba(255, 228, 180, 0.9)'
  g.fillText(letter, 128, 136)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** A soft round glow for the bomb's light. */
function glowTexture() {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  return new CanvasTexture(c)
}

const decalProps = { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }

function SiteMark({ site }) {
  const tex = useMemo(() => letterTexture(site.id), [site.id])
  useEffect(() => () => tex.dispose(), [tex])
  const [x, y, z] = site.p
  const ref = useRef(null)
  const tries = useRef(0)
  // Sit on whatever floor is really there (a slab, a deck), once the map's colliders are in.
  useFrame(() => {
    if (tries.current > 90 || !runtime.world || !ref.current) return
    tries.current++
    const hit = castMap([x, y + 2.5, z], [0, -1, 0], 5)
    if (!hit) return
    ref.current.position.y = y + 2.5 - hit.toi + 0.03
    tries.current = Infinity
  })
  return (
    <group ref={ref} position={[x, y + 0.03, z]}>
      <mesh rotation-x={-Math.PI / 2} renderOrder={2}>
        <ringGeometry args={[SND.siteRadius - 0.16, SND.siteRadius, 64]} />
        <meshBasicMaterial color="#f2a33a" opacity={0.6} {...decalProps} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} renderOrder={2}>
        <ringGeometry args={[SND.siteRadius - 0.5, SND.siteRadius - 0.42, 64]} />
        <meshBasicMaterial color="#f2a33a" opacity={0.25} {...decalProps} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} renderOrder={2}>
        <planeGeometry args={[2.3, 2.3]} />
        <meshBasicMaterial map={tex} {...decalProps} />
      </mesh>
    </group>
  )
}

/** Seconds between beeps for the time left on the bomb. */
const beepEvery = (left) => (left > 20 ? 1 : left > 10 ? 0.5 : left > 5 ? 0.25 : 0.12)

function Bomb() {
  const group = useRef(null)
  const led = useRef(null)
  const glow = useRef(null)
  const beat = useRef({ next: 0, flash: 0 })
  const glowMap = useMemo(() => glowTexture(), [])
  useEffect(() => () => glowMap.dispose(), [glowMap])

  useFrame(() => {
    const g = group.current
    if (!g) return
    const s = runtime.snd
    g.position.set(s.x, s.y, s.z)
    const now = performance.now()
    let on = false
    let color = '#ff2a2a'
    if (s.bombState === 'planted') {
      const every = beepEvery(s.left) * 1000
      const b = beat.current
      if (now >= b.next) {
        b.next = now + every
        b.flash = now
        sfx.play('bombBeep', { pos: [s.x, s.y + 0.2, s.z], ref: 3, maxDistance: 50, volume: 0.85 })
      }
      on = now - b.flash < Math.min(110, every * 0.5)
    } else if (s.bombState === 'dropped') {
      on = Math.floor(now / 600) % 2 === 0
      color = '#ffb020'
    } else if (s.bombState === 'defused') {
      on = true
      color = '#36e07a'
    }
    led.current.color.set(on ? color : '#2a0808')
    glow.current.visible = on
    glow.current.material.color.set(color)
  })

  return (
    <group ref={group} rotation-y={0.5}>
      {/* Base plate and three charges, taped together. */}
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[0.46, 0.04, 0.3]} />
        <meshStandardMaterial color="#3a3f33" roughness={0.85} />
      </mesh>
      {[-0.085, 0, 0.085].map((zz) => (
        <mesh key={zz} position={[0, 0.082, zz]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.042, 0.042, 0.42, 12]} />
          <meshStandardMaterial color="#b9a274" roughness={0.9} />
        </mesh>
      ))}
      {[-0.13, 0.13].map((xx) => (
        <mesh key={xx} position={[xx, 0.082, 0]}>
          <boxGeometry args={[0.035, 0.1, 0.27]} />
          <meshStandardMaterial color="#26282b" roughness={0.6} />
        </mesh>
      ))}
      {/* The timer on top, its screen, the light. */}
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[0.17, 0.05, 0.11]} />
        <meshStandardMaterial color="#141517" roughness={0.45} metalness={0.3} />
      </mesh>
      <mesh position={[-0.02, 0.1755, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.1, 0.06]} />
        <meshBasicMaterial color="#5c1414" toneMapped={false} />
      </mesh>
      <mesh position={[0.058, 0.182, 0]}>
        <sphereGeometry args={[0.014, 10, 8]} />
        <meshBasicMaterial ref={led} color="#2a0808" toneMapped={false} />
      </mesh>
      <sprite ref={glow} position={[0.058, 0.19, 0]} scale={0.32} visible={false}>
        <spriteMaterial map={glowMap} blending={AdditiveBlending} depthWrite={false} transparent toneMapped={false} />
      </sprite>
      {/* Wires from the timer into the charges. */}
      <mesh position={[0.085, 0.13, 0.03]} rotation={[Math.PI / 2, 0, 0.3]}>
        <torusGeometry args={[0.045, 0.006, 6, 14, Math.PI]} />
        <meshStandardMaterial color="#c42b2b" roughness={0.5} />
      </mesh>
      <mesh position={[0.085, 0.13, -0.03]} rotation={[Math.PI / 2, 0, -0.3]}>
        <torusGeometry args={[0.04, 0.006, 6, 14, Math.PI]} />
        <meshStandardMaterial color="#2b62c4" roughness={0.5} />
      </mesh>
    </group>
  )
}

export function SndObjects() {
  const map = useActiveMap()
  const bombState = useGameStore((s) => s.room.bombState)
  const sites = sitesOf(map)
  const showBomb = bombState === 'dropped' || bombState === 'planted' || bombState === 'defused'
  return (
    <>
      {sites.map((s) => (
        <SiteMark key={`${map.id}-${s.id}`} site={s} />
      ))}
      {showBomb && <Bomb />}
    </>
  )
}

export default SndObjects
