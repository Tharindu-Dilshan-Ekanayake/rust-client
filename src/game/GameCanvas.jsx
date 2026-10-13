import { useProgress } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { Suspense, useEffect, useRef } from 'react'
import { Vector3 } from 'three'

import { sfx } from '../audio/sfx.js'
import { useGameStore } from '../store/gameStore.js'
import { Effects } from './fx/Effects.jsx'
import { SndObjects } from './fx/SndObjects.jsx'
import { AmmoPickups, GrenadeMeshes, SmokeClouds } from './fx/WorldState.jsx'
import MenuCamera from './MenuCamera.jsx'
import { castMap } from './physicsQueries.js'
import { installInput } from './player/input.js'
import PerfDirector from './PerfDirector.jsx'
import ClimbHands from './player/ClimbHands.jsx'
import LocalPlayer from './player/LocalPlayer.jsx'
import { RenderPipeline, ViewModel } from './player/ViewModel.jsx'
import RemotePlayers from './remote/RemotePlayers.jsx'
import { runtime } from './runtime.js'
import SceneEnvironment from './SceneEnvironment.jsx'
import { cycleSpectate } from './snd.js'
import MapScene from './world/MapScene.jsx'

const _fwd = new Vector3()
const _up = new Vector3()
const _target = new Vector3()
const _eye = new Vector3()
const _dir = new Vector3()
const _cam = new Vector3()
const _look = new Vector3()

/** Search & Destroy: how long the death cam lingers on your body before it moves to a teammate (ms). */
const SPECTATE_AFTER = 2600

/**
 * Over the shoulder of the teammate being watched (Search & Destroy), pulled
 * in when there's a wall behind them. False when there's nobody left to watch.
 */
function spectate(camera, dt, s) {
  let r = runtime.remotes.get(runtime.spectateId)
  if (!r?.alive) {
    // They went down (or nobody was picked yet): on to the next one standing.
    const now = performance.now()
    if (now - (s.cycledAt ?? 0) > 400) {
      s.cycledAt = now
      cycleSpectate(0)
    }
    r = runtime.remotes.get(runtime.spectateId)
    if (!r?.alive) return false
  }
  const eyeH = r.prone ? 0.45 : r.crouch ? 1.05 : 1.55
  _eye.set(r.pos.x, r.pos.y + eyeH, r.pos.z)
  const pitch = r.pitch ?? 0
  const cp = Math.cos(pitch)
  _fwd.set(-Math.sin(r.yaw) * cp, Math.sin(pitch), -Math.cos(r.yaw) * cp)
  // Back 2.4 m, right 0.55 m, up 0.35 m from their eyes.
  _dir.set(Math.sin(r.yaw) * 2.4 + Math.cos(r.yaw) * 0.55, 0.35, Math.cos(r.yaw) * 2.4 - Math.sin(r.yaw) * 0.55)
  const len = _dir.length()
  _dir.divideScalar(len)
  const hit = castMap(_eye, _dir, len + 0.3)
  _cam.copy(_eye).addScaledVector(_dir, hit ? Math.max(0.25, hit.toi - 0.3) : len)
  _look.copy(_eye).addScaledVector(_fwd, 10)
  const k = s.watching ? 1 - Math.exp(-dt * 12) : 1
  if (!s.look) s.look = _look.clone()
  camera.position.lerp(_cam, k)
  s.look.lerp(_look, k)
  camera.lookAt(s.look)
  s.watching = true
  if (Math.abs(camera.fov - 70) > 0.1) {
    camera.fov = 70
    camera.updateProjectionMatrix()
  }
  return true
}

/** After death: rise above the body and track whoever got you (Search & Destroy: then watch a teammate). */
function DeathCamera() {
  const camera = useThree((s) => s.camera)
  const start = useRef(null)
  useEffect(() => {
    start.current = { pos: camera.position.clone(), t: performance.now() }
  }, [camera])
  useFrame((_state, delta) => {
    const s = start.current
    if (!s) return
    const game = useGameStore.getState()
    if (game.mode === 'snd' && (game.death?.waiting || performance.now() - s.t > SPECTATE_AFTER)) {
      if (spectate(camera, Math.min(delta, 0.05), s)) return
      if (s.watching) {
        // Nobody left to watch: drift back out over your body from wherever the camera is.
        s.watching = false
        s.look = null
        s.pos.copy(camera.position)
        s.t = performance.now()
      }
    }
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
    const s = state.current
    const now = performance.now()
    if (!s.start) s.start = now
    s.frames++
    if (now - s.start < 2000) return
    const fps = (s.frames * 1000) / (now - s.start)
    s.frames = 0
    s.start = now
    runtime.view.fps = fps
    // Nothing left to give by resolution: the quality watchdog may step in.
    runtime.view.dprAtMin = !adaptive || s.dpr <= min * 0.75 + 0.01
    if (!adaptive) return
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

/** Bomb sites and the bomb, in Search & Destroy rooms. */
function SndLayer() {
  const snd = useGameStore((s) => s.mode === 'snd')
  return snd ? <SndObjects /> : null
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
      // Near plane at 10 cm (the player capsule keeps the eye 35 cm off any wall):
      // twice the depth precision of 5 cm, so distant layers don't flicker.
      camera={{ fov: 75, near: 0.1, far: 600, position: [30, 14, 30] }}
      // No MSAA on the canvas: the frame is drawn into the colour grade's HDR
      // target and anti-aliased there (FXAA, see ColorGrade.js). No stencil either.
      gl={{ antialias: false, stencil: false, powerPreference: 'high-performance' }}
      onCreated={({ gl, scene }) => {
        gl.domElement.setAttribute('data-game', '')
        // Tests read draw-call counts from it (?debug).
        runtime.gl = gl
        runtime.scene = scene
      }}
    >
      <Suspense fallback={null}>
        <SceneEnvironment quality={quality} />
        {/* Nothing here is simulated (map colliders + our own capsule, moved by the
            character controller), so one step a frame keeps queries current; a
            fixed step would catch up with many steps after a slow frame. */}
        <Physics timeStep="vary">
          <MapScene />
          {inRoom && <LocalPlayer />}
          {inRoom && <ClimbHands />}
        </Physics>
        {inRoom && (
          <>
            <RemotePlayers />
            <GrenadeMeshes />
            <SmokeClouds />
            <AmmoPickups />
            <SndLayer />
          </>
        )}
        <Effects />
        <LoadSignal />
      </Suspense>
      <CameraDirector />
      <AudioListenerSync />
      <AdaptiveResolution />
      <PerfDirector />
      <ViewModel />
      <RenderPipeline />
    </Canvas>
  )
}

export default GameCanvas
