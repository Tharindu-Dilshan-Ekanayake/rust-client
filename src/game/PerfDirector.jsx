import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Bone, BoxGeometry, BufferAttribute, DataTexture, Group, MeshDepthMaterial, Skeleton, SkinnedMesh } from 'three'

import { BOT_KITS, PRESET_CLASSES, WEAPONS } from '../shared/weapons.js'
import { toWireClass, useGameStore } from '../store/gameStore.js'
import { avatarSkinMaterial } from './avatarRig.js'
import { createWeaponLod, createWeaponModel, prepareWeaponModel } from './models/weaponModels.js'
import { makeArm } from './player/arms.js'
import { spriteShowcase } from './remote/sprites.js'
import { QUALITY_STEPS } from './quality.js'
import { runtime } from './runtime.js'

/**
 * Keeps the game smooth on whatever it runs on:
 *  - steps the quality down (while "Auto quality" is on) if the frame rate
 *    stays low even at the lowest render scale (everyone starts on Low);
 *  - redraws the sun's shadow map every frame on High and every other frame
 *    below that (the sun and the map never move; only players do);
 *  - compiles every shader and uploads every texture up front (and again for
 *    anything new that turns up later: a player joining, a weapon pulled out)
 *    so the first shot, first grenade or first enemy on screen doesn't freeze
 *    the game while the GPU driver catches up.
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
  // Guns other players are sure to carry, built now rather than when they
  // first show up: every bot loadout and the preset classes, with far LODs.
  const kits = [
    ...Object.entries(BOT_KITS).flatMap(([id, list]) => list.map((att) => [id, att])),
    ...PRESET_CLASSES.map((c) => [c.primary, c.primaryAtt]),
  ]
  for (const [id, att] of kits) {
    g.add(createWeaponModel(id, att))
    const lod = createWeaponLod(id, att)
    if (lod) g.add(lod)
  }
  for (const body of avatarStandIns()) g.add(body)
  g.add(spriteShowcase())
  return g
}

/**
 * Stand-ins for a player's body: the same skinned material, without and with
 * its skin texture (the texture lands a moment after the body does). Their
 * shaders took ~0.5 s to build the first time players appeared in a match.
 */
function avatarStandIns() {
  const texture = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
  texture.needsUpdate = true
  return [null, texture].map((map) => {
    const geometry = new BoxGeometry(0.05, 0.05, 0.05)
    const n = geometry.getAttribute('position').count
    const weights = new Float32Array(n * 4)
    for (let i = 0; i < n; i++) weights[i * 4] = 1
    geometry.setAttribute('skinIndex', new BufferAttribute(new Uint16Array(n * 4), 4))
    geometry.setAttribute('skinWeight', new BufferAttribute(weights, 4))
    const material = avatarSkinMaterial()
    material.map = map
    const body = new SkinnedMesh(geometry, material)
    const bone = new Bone()
    body.add(bone)
    body.bind(new Skeleton([bone]))
    body.castShadow = true
    body.receiveShadow = true
    body.frustumCulled = false
    ownDepthMaterial(body)
    return body
  })
}

/**
 * three.js draws every shadow caster with one shared depth material, which
 * needs a different shader for skinned and instanced meshes: each switch between
 * kinds in the shadow pass looked the shader up again. Those get their own.
 */
const depthFor = { skinned: new MeshDepthMaterial(), instanced: new MeshDepthMaterial() }
function ownDepthMaterial(o) {
  if (!o.castShadow || o.customDepthMaterial) return
  if (o.isSkinnedMesh) o.customDepthMaterial = depthFor.skinned
  else if (o.isInstancedMesh) o.customDepthMaterial = depthFor.instanced
}

const materialsOf = (o) => (Array.isArray(o.material) ? o.material : o.material ? [o.material] : [])

/** Drawables under `root` with a material not in `seen` (and marks those seen). */
function freshObjects(root, seen) {
  const fresh = []
  root.traverse((o) => {
    if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite)) return
    ownDepthMaterial(o)
    let isNew = false
    for (const m of materialsOf(o)) {
      if (seen.has(m)) continue
      seen.add(m)
      isNew = true
    }
    if (isNew) fresh.push(o)
  })
  return fresh
}

export function PerfDirector() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const quality = useGameStore((s) => s.settings.quality)
  const auto = useGameStore((s) => s.settings.qualityAuto)
  const showcase = useMemo(() => weaponShowcase(), [])
  const classId = useGameStore((s) => s.selectedClassId)
  const classes = useGameStore((s) => s.classes)

  // Your own class's guns, built in idle time while you're still in the menus.
  useEffect(() => {
    const c = toWireClass(useGameStore.getState().getClass(classId))
    if (!c) return
    prepareWeaponModel(c.primary, c.primaryAtt)
    prepareWeaponModel(c.secondary, c.secondaryAtt)
  }, [classId, classes])
  const st = useRef({ frame: 0, compiledAt: '', seenWorld: new WeakSet(), seenVm: new WeakSet(), parked: 0, slow: 0, lastFps: 0 })

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

    // The showcase sits under the map for a few frames after a warm-up (see below).
    if (s.parked > 0 && --s.parked === 0) scene.remove(showcase)

    // Shadows: every frame on High, every other frame otherwise.
    const every = quality === 'high' ? 1 : 2
    gl.shadowMap.autoUpdate = every === 1
    if (every > 1 && s.frame % every === 0) gl.shadowMap.needsUpdate = true

    // Warm-up. Everything at once whenever what every shader depends on
    // changes (the reflection maps arriving, shadows on/off); in between, only
    // objects whose materials haven't been drawn yet (a player joining, a
    // weapon pulled out), so a busy match never recompiles the whole scene.
    if (s.frame % 45 === 3) {
      const vm = runtime.vm
      const sig = `${Boolean(scene.environment)}|${Boolean(vm?.scene.environment)}|${quality}`
      if (sig !== s.compiledAt) {
        s.compiledAt = sig
        s.seenWorld = new WeakSet()
        s.seenVm = new WeakSet()
        freshObjects(scene, s.seenWorld)
        if (vm) freshObjects(vm.scene, s.seenVm)
        warmUp(gl, scene, camera, showcase)
        // The shadow pass builds its own (depth) shaders, and only for things
        // really in the scene: park the showcase under the map for a few frames
        // so those are built now too, not when the first player turns up.
        showcase.position.set(0, -12, 0)
        scene.add(showcase)
        showcase.updateMatrixWorld(true)
        gl.shadowMap.needsUpdate = true
        s.parked = 4
      } else {
        const world = freshObjects(scene, s.seenWorld)
        const own = vm ? freshObjects(vm.scene, s.seenVm) : []
        if (world.length || own.length) warmUpObjects(gl, world, scene, camera, own, vm)
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

/** Uploads the textures a set of materials draws with. */
function initTextures(gl, materials) {
  for (const m of materials) {
    for (const k of TEXTURE_KEYS) if (m[k]?.isTexture) gl.initTexture(m[k])
    if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) gl.initTexture(u.value)
  }
}

/** Compiles just these objects, against the lights of the scene each is drawn in. */
function warmUpObjects(gl, world, scene, camera, own, vm) {
  const prev = gl.getRenderTarget()
  gl.setRenderTarget(runtime.gradeTarget ?? null)
  try {
    const materials = new Set()
    for (const o of world) for (const m of gl.compile(o, camera, scene)) materials.add(m)
    for (const o of own) for (const m of gl.compile(o, vm.camera, vm.scene)) materials.add(m)
    initTextures(gl, materials)
  } finally {
    gl.setRenderTarget(prev)
  }
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
    initTextures(gl, materials)
  } finally {
    gl.setRenderTarget(prev)
  }
}

export default PerfDirector
