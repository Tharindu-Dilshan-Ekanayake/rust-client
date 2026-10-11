import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Group } from 'three'

import { WEAPONS } from '../shared/weapons.js'
import { useGameStore } from '../store/gameStore.js'
import { createWeaponModel } from './models/weaponModels.js'
import { makeArm } from './player/arms.js'
import { detectQuality, QUALITY_STEPS } from './quality.js'
import { runtime } from './runtime.js'

/**
 * Keeps the game smooth on whatever it runs on:
 *  - picks a starting quality from the GPU on first run (while "Auto quality"
 *    is on), and steps it down if the frame rate stays low even at the lowest
 *    render scale;
 *  - redraws the sun's shadow map every frame on High and every other frame
 *    below that (the sun and the map never move; only players do);
 *  - compiles every shader and uploads every texture up front, whenever new
 *    things appear in the scene, so the first shot, first grenade or first
 *    enemy on screen doesn't freeze the game while the GPU driver catches up.
 */

const TEXTURE_KEYS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'alphaMap', 'aoMap', 'bumpMap', 'lightMap']

/** Every weapon, grenade, the rocket and an arm: shader warm-up for both the world's lights and the viewmodel's. */
function weaponShowcase() {
  const g = new Group()
  for (const id of [...Object.keys(WEAPONS), 'frag', 'flash', 'smoke', 'rocket']) {
    try {
      g.add(createWeaponModel(id))
    } catch {
      // Not every id has a model (the knife's is built elsewhere); skip.
    }
  }
  g.add(makeArm(1))
  return g
}

function countObjects(scene) {
  let n = 0
  scene.traverse(() => n++)
  return n
}

export function PerfDirector() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const quality = useGameStore((s) => s.settings.quality)
  const auto = useGameStore((s) => s.settings.qualityAuto)
  const showcase = useMemo(() => weaponShowcase(), [])
  const st = useRef({ frame: 0, compiledAt: -1, slow: 0, lastFps: 0 })

  // First run: choose a quality for this machine.
  useEffect(() => {
    const s = useGameStore.getState()
    if (!s.settings.qualityAuto || s.settings.qualityDetected) return
    s.setSettings({ quality: detectQuality(gl), qualityDetected: true })
  }, [gl])

  // The world never moves: don't rebuild the scene root's matrix every frame
  // (it forces every object below it to recompute its own).
  useEffect(() => {
    scene.matrixAutoUpdate = false
    scene.updateMatrix()
    return () => {
      scene.matrixAutoUpdate = true
    }
  }, [scene])

  useFrame(() => {
    const s = st.current
    s.frame++

    // Shadows: every frame on High, every other frame otherwise.
    const every = quality === 'high' ? 1 : 2
    gl.shadowMap.autoUpdate = every === 1
    if (every > 1 && s.frame % every === 0) gl.shadowMap.needsUpdate = true

    // Warm-up: when the scene gains objects (map loaded, joining a match,
    // players spawning in), compile and upload everything new.
    if (s.frame % 45 === 3) {
      // Anything that changes which shader a material needs: new objects, the
      // reflection maps arriving, shadows on/off.
      const sig = `${countObjects(scene)}|${Boolean(scene.environment)}|${Boolean(runtime.vm?.scene.environment)}|${quality}`
      if (sig !== s.compiledAt) {
        s.compiledAt = sig
        warmUp(gl, scene, camera, showcase)
      }
    }

    // Auto quality: if even the lowest render scale can't hold ~40 fps for
    // a while, drop a quality level.
    const game = useGameStore.getState()
    const fps = runtime.view.fps ?? 0
    if (auto && game.gameState === 'playing' && fps && fps !== s.lastFps) {
      s.lastFps = fps
      s.slow = fps < 38 && runtime.view.dprAtMin ? s.slow + 1 : 0
      const i = QUALITY_STEPS.indexOf(quality)
      if (s.slow >= 3 && i > 0) {
        s.slow = 0
        game.setSettings({ quality: QUALITY_STEPS[i - 1] })
        game.pushNotice(`Graphics set to ${QUALITY_STEPS[i - 1].toUpperCase()} to keep the game smooth`, 3500)
      }
    }
  })
  return null
}

/** Compiles shaders and uploads textures for the scene (and the weapons) into the target it's drawn to. */
function warmUp(gl, scene, camera, showcase) {
  const target = runtime.gradeTarget ?? null
  const prev = gl.getRenderTarget()
  gl.setRenderTarget(target)
  try {
    const materials = gl.compile(scene, camera)
    for (const m of gl.compile(showcase, camera, scene)) materials.add(m)
    if (runtime.vm) {
      for (const m of gl.compile(runtime.vm.scene, runtime.vm.camera)) materials.add(m)
      for (const m of gl.compile(showcase, runtime.vm.camera, runtime.vm.scene)) materials.add(m)
    }
    for (const m of materials) {
      for (const k of TEXTURE_KEYS) if (m[k]?.isTexture) gl.initTexture(m[k])
      if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) gl.initTexture(u.value)
    }
  } finally {
    gl.setRenderTarget(prev)
  }
}

export default PerfDirector
