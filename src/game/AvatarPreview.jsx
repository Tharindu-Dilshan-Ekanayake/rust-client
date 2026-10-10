import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect } from 'react'
import { Vector3 } from 'three'

import { net } from '../net/network.js'
import { useGameStore } from '../store/gameStore.js'
import { Effects } from './fx/Effects.jsx'
import RemotePlayers from './remote/RemotePlayers.jsx'
import { runtime } from './runtime.js'
import SceneEnvironment from './SceneEnvironment.jsx'
import PlayerAvatar from './PlayerAvatar.jsx'
import { Backdrop } from './world/props.jsx'

/**
 * Dev-only: `/?preview=avatars` lines up fake remote players in every pose
 * (idle, walking, aiming, crouched, knife sprint, climbing, dead) using the real
 * RemotePlayers component, fed through the same interpolation buffers.
 */
const POSES = [
  { name: 'Rifle', weapon: 'ar' },
  { name: 'Walk', weapon: 'ar', speed: 3 },
  { name: 'Sprint', weapon: 'ar', speed: 7, sprint: true },
  { name: 'Sniper up', weapon: 'sniper', ads: true, pitch: 0.4 },
  { name: 'Pistol', weapon: 'pistol' },
  { name: 'Crouch', weapon: 'ar', crouch: true, pitch: -0.05 },
  { name: 'Prone', weapon: 'ar', prone: true },
  { name: 'Slide', weapon: 'ar', crouch: true, slide: true },
  { name: 'Reload', weapon: 'ar', reload: true },
  { name: 'Throw', weapon: 'ar', throw: true },
  { name: 'Knife', weapon: 'knife', speed: 3 },
  { name: 'Climb', weapon: 'ar', climbing: true },
]

function FakePlayers() {
  useEffect(() => {
    useGameStore.setState({ mode: 'tdm', team: 'alpha', gameState: 'menu' })
    const ids = POSES.map((p, i) => `fake${i}`)
    POSES.forEach((p, i) => {
      runtime.remotes.set(ids[i], {
        id: ids[i],
        pos: new Vector3(),
        vel: new Vector3(),
        yaw: 0,
        pitch: 0,
        name: p.name,
        team: i === 2 ? 'bravo' : 'alpha',
        isBot: true,
        state: p.dead ? 'dead' : 'alive',
        hp: 100,
        weapon: p.weapon,
        primary: p.weapon,
        crouch: Boolean(p.crouch),
        prone: Boolean(p.prone),
        slide: Boolean(p.slide),
        kit: '',
        ads: Boolean(p.ads),
        sprint: Boolean(p.sprint),
        climbing: Boolean(p.climbing),
        avatar: '',
        seq: 1,
        firedAt: 0,
        loudAt: 0,
        meleeAt: 0,
        deadAt: performance.now(),
      })
      net.buffers.set(ids[i], [])
    })
    useGameStore.setState({ remoteIds: ids })
    return () => {
      ids.forEach((id) => {
        runtime.remotes.delete(id)
        net.buffers.delete(id)
      })
    }
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const now = performance.now()
    POSES.forEach((p, i) => {
      const id = `fake${i}`
      const buf = net.buffers.get(id)
      if (!buf) return
      const x = (i - (POSES.length - 1) / 2) * 2.4
      // Pace back and forth at roughly `speed` m/s.
      const walk = p.speed ? Math.sin((t * p.speed) / 1.2) * 1.2 : 0
      buf.push({ t: now, x, y: p.climbing ? 1 + Math.sin(t) * 0.5 : 0, z: walk, yaw: Math.PI, pitch: p.pitch ?? 0, seq: 1 })
      if (buf.length > 30) buf.shift()
      const r = runtime.remotes.get(id)
      // Loop the death animation and the melee swing so they're visible.
      if (p.dead && now - r.deadAt > 2500) r.deadAt = now
      if (p.weapon === 'knife' && now - r.meleeAt > 900) r.meleeAt = now
      if (p.ads && now - r.firedAt > 1200) r.firedAt = now
      if (p.reload && now - (r.reloadAt ?? 0) > 2800) {
        r.reloadAt = now
        r.reloadDur = 2200
      }
      if (p.throw && now - (r.throwAt ?? 0) > 1500) r.throwAt = now
      if (!p.ads && !p.reload && !p.throw && p.weapon !== 'knife' && now - r.firedAt > 400) r.firedAt = now
    })
  })
  return null
}

function Camera() {
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const view = new URLSearchParams(window.location.search).get('view')
  useFrame(() => {
    const focus = Number(new URLSearchParams(window.location.search).get('focus'))
    if (Number.isFinite(focus) && new URLSearchParams(window.location.search).has('focus')) {
      // Close-up on one pose: `&focus=N`, optionally from the side.
      const x = (focus - (POSES.length - 1) / 2) * 2.4
      // Views around the player (who faces +Z): front, three-quarter, side, back.
      const angle = { front: 0, quarter: -0.7, side: Math.PI / 2, back: Math.PI * 0.8 }[view ?? 'front'] ?? 0
      const dist = Number(new URLSearchParams(window.location.search).get('dist')) || 3
      camera.position.set(x + Math.sin(angle) * dist, 1.45, Math.cos(angle) * dist)
      camera.lookAt(x, 0.9, 0)
      return
    }
    if (view === 'side') camera.position.set(11, 1.6, 4)
    else camera.position.set(0, 2.2, 10.5)
    camera.lookAt(view === 'side' ? 6 : 0, 0.9, 0)
  })
  useEffect(() => {
    runtime.camera = camera
    // Lets tests inspect the posed rigs.
    window.__scene = scene
  }, [camera, scene])
  return null
}

const PROBES = [
  [],
  [['ArmR1', 'axisX', -1.45], ['ArmL1', 'axisX', -1.45]],
  [['ArmL1', 'axisZ', -0.4], ['ArmL1', 'axisX', -1.45], ['ArmR1', 'axisZ', 0.4], ['ArmR1', 'axisX', -1.45]],
  [['ArmL1', 'axisX', -1.45], ['ArmL1', 'axisZ', -0.4], ['ArmR1', 'axisX', -1.45], ['ArmR1', 'axisZ', 0.4]],
  [['ArmL1', 'axisX', -1.45], ['ArmL1', 'axisY', -0.6], ['ArmR1', 'axisX', -1.45], ['ArmR1', 'axisY', 0.6]],
  [['ArmL1', 'axisY', -0.6], ['ArmL1', 'axisX', -1.45], ['ArmR1', 'axisY', 0.6], ['ArmR1', 'axisX', -1.45]],
  [['ArmL1', 'axisZ', 1.4], ['ArmR1', 'axisZ', -1.4]],
  [['ArmL1', 'axisX', -2.6], ['ArmR1', 'axisX', -2.6]],
]

const SIDE = new URLSearchParams(window.location.search).has('side')

/** `&probe`: one avatar per raw rotation of ArmL1, to read the rig's axes. */
function Probes() {
  return PROBES.map((probe, i) => (
    <Suspense key={i} fallback={null}>
      <PlayerAvatar
        // Exposed so tests can measure skinned vertex positions per probe.
        ref={(g) => {
          if (g) (window.__probe ??= [])[i] = g
        }}
        position={[(i - 3.5) * 1.6, 0, 0]}
        // &side turns them so forward points screen-left and the left arm faces us.
        rotation={[0, SIDE ? -Math.PI / 2 : 0, 0]}
        equipped={null}
        proportions={{}}
        motionRef={{ current: { time: 0, speed: 0, grounded: true, probe } }}
      />
    </Suspense>
  ))
}

export function AvatarPreview() {
  const probe = new URLSearchParams(window.location.search).has('probe')
  if (probe) {
    return (
      <div style={{ position: 'fixed', inset: 0 }}>
        <Canvas camera={{ fov: 55, near: 0.05, far: 400 }}>
          <Suspense fallback={null}>
            <SceneEnvironment dust={false} />
            <Probes />
          </Suspense>
          <Camera />
        </Canvas>
      </div>
    )
  }
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Canvas shadows="percentage" camera={{ fov: 55, near: 0.05, far: 400 }}>
        <Suspense fallback={null}>
          <SceneEnvironment dust={false} />
          <Backdrop />
          <RemotePlayers />
          <Effects />
        </Suspense>
        <FakePlayers />
        <Camera />
      </Canvas>
    </div>
  )
}

export default AvatarPreview
