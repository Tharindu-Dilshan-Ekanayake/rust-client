import { useProgress } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { Suspense, useEffect, useRef } from 'react'
import { Vector3 } from 'three'

import { sfx } from '../audio/sfx.js'
import { useGameStore } from '../store/gameStore.js'
import { Effects } from './fx/Effects.jsx'
import { AmmoPickups, GrenadeMeshes, SmokeClouds } from './fx/WorldState.jsx'
import MenuCamera from './MenuCamera.jsx'
import { installInput } from './player/input.js'
import LocalPlayer from './player/LocalPlayer.jsx'
import { RenderPipeline, ViewModel } from './player/ViewModel.jsx'
import RemotePlayers from './remote/RemotePlayers.jsx'
import { runtime } from './runtime.js'
import SceneEnvironment from './SceneEnvironment.jsx'
import DustlineMap from './world/DustlineMap.jsx'

const _fwd = new Vector3()
const _up = new Vector3()
const _target = new Vector3()

/** After death: rise above the body and track whoever got you. */
function DeathCamera() {
  const camera = useThree((s) => s.camera)
  const start = useRef(null)
  useEffect(() => {
    start.current = { pos: camera.position.clone(), t: performance.now() }
  }, [camera])
  useFrame(() => {
    const s = start.current
    if (!s) return
    const k = Math.min(1, (performance.now() - s.t) / 900)
    const e = k * k * (3 - 2 * k)
    const d = runtime.death.at
    const killer = runtime.remotes.get(runtime.death.killerId)
    if (killer && killer.alive) _target.set(killer.pos.x, killer.pos.y + 1.3, killer.pos.z)
    else _target.set(d.x + Math.sin(performance.now() / 2000) * 4, d.y + 0.5, d.z + Math.cos(performance.now() / 2000) * 4)
    // Hover a few metres up and back from the body, on the side away from the killer.
    const away = new Vector3(d.x - _target.x, 0, d.z - _target.z)
    if (away.lengthSq() < 0.01) away.set(0, 0, 1)
    away.normalize()
    const want = new Vector3(d.x + away.x * 2.5, d.y + 3.2, d.z + away.z * 2.5)
    camera.position.lerpVectors(s.pos, want, e)
    camera.lookAt(_target)
    if (Math.abs(camera.fov - 65) > 0.1) {
      camera.fov = 65
      camera.updateProjectionMatrix()
    }
  })
  return null
}

/** Picks which camera controller owns the shared camera for the current screen. */
function CameraDirector() {
  const gameState = useGameStore((s) => s.gameState)
  if (gameState === 'dead') return <DeathCamera />
  if (gameState === 'playing') return null // LocalPlayer drives the camera
  return <MenuCamera />
}

/** Keeps the Web Audio listener on the camera. */
function AudioListenerSync() {
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    runtime.camera = camera
  }, [camera])
  useFrame(() => {
    camera.getWorldDirection(_fwd)
    _up.set(0, 1, 0).applyQuaternion(camera.quaternion)
    sfx.setListener(camera.position, _fwd, _up)
    sfx.setListenerPosition(camera.position)
  })
  return null
}

const DPR = { low: [0.75, 1], medium: [1, 1.25], high: [1, 1.5] }

/**
 * Drops the render scale in steps when the frame rate stays low, and creeps back
 * up when there's headroom. Resolution is the cheapest knob that helps everyone.
 */
function AdaptiveResolution() {
  const setDpr = useThree((s) => s.setDpr)
  const quality = useGameStore((s) => s.settings.quality)
  const adaptive = useGameStore((s) => s.settings.adaptive)
  const state = useRef({ frames: 0, start: 0, dpr: 0 })
  const [min, max] = DPR[quality] ?? DPR.high
  useEffect(() => {
    state.current.dpr = Math.min(max, window.devicePixelRatio || 1)
    setDpr(state.current.dpr)
  }, [min, max, setDpr])
  useFrame(() => {
    if (!adaptive) return
    const s = state.current
    const now = performance.now()
    if (!s.start) s.start = now
    s.frames++
    if (now - s.start < 2000) return
    const fps = (s.frames * 1000) / (now - s.start)
    s.frames = 0
    s.start = now
    runtime.view.fps = fps
    let next = s.dpr
    if (fps < 45) next = Math.max(min * 0.75, s.dpr - 0.25)
    else if (fps > 58) next = Math.min(Math.min(max, window.devicePixelRatio || 1), s.dpr + 0.125)
    if (Math.abs(next - s.dpr) > 0.01) {
      s.dpr = next
      setDpr(next)
    }
  })
  return null
}

/** Flags the store once the scene's assets have finished loading. */
function LoadSignal() {
  const { active, progress } = useProgress()
  useEffect(() => {
    if (!active && progress >= 100) useGameStore.setState({ loaded: true })
  }, [active, progress])
  useEffect(() => {
    // If nothing needed the loader at all, Suspense resolving is enough.
    const t = setTimeout(() => useGameStore.setState({ loaded: true }), 1500)
    return () => clearTimeout(t)
  }, [])
  return null
}

export function GameCanvas() {
  const inRoom = useGameStore((s) => s.gameState !== 'loading' && s.gameState !== 'menu')
  const quality = useGameStore((s) => s.settings.quality)

  useEffect(() => {
    installInput()
  }, [])

  return (
    <Canvas
      shadows="percentage"
      dpr={DPR[quality] ?? DPR.high}
      camera={{ fov: 75, near: 0.05, far: 600, position: [30, 14, 30] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.domElement.setAttribute('data-game', '')
      }}
    >
      <Suspense fallback={null}>
        <SceneEnvironment quality={quality} />
        <Physics>
          <DustlineMap />
          {inRoom && <LocalPlayer />}
        </Physics>
        {inRoom && (
          <>
            <RemotePlayers />
            <GrenadeMeshes />
            <SmokeClouds />
            <AmmoPickups />
          </>
        )}
        <Effects />
        <LoadSignal />
      </Suspense>
      <CameraDirector />
      <AudioListenerSync />
      <AdaptiveResolution />
      <ViewModel />
      <RenderPipeline />
    </Canvas>
  )
}

export default GameCanvas
