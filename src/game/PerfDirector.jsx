import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Bone, BoxGeometry, BufferAttribute, DataTexture, Group, MeshDepthMaterial, Skeleton, SkinnedMesh } from 'three'

import { BOT_KITS, PRESET_CLASSES, WEAPONS } from '../shared/weapons.js'
import { toWireClass, useGameStore } from '../store/gameStore.js'
import { avatarSkinMaterial } from './avatarRig.js'
import { remoteLaserBeam } from './models/laser.js'
import { createWeaponLod, createWeaponModel, hasWeaponModel, prepareWeaponModel } from './models/weaponModels.js'
import { makeArm } from './player/arms.js'
import { spriteShowcase } from './remote/sprites.js'
import { QUALITY_STEPS } from './quality.js'
import { runtime } from './runtime.js'
import { leanMatrixWalk } from './sceneMatrices.js'

/**
 * Keeps the game smooth on whatever it runs on:
 *  - steps the quality down (while "Auto quality" is on) if the frame rate
 *    stays low even at the lowest render scale (everyone starts on Low);
 *  - redraws the sun's shadow map every frame on High and every other frame
 *    below that (the sun and the map never move; only players do);
 *  - compiles every shader and uploads every texture up front (and again for
 *    anything new that turns up later: a player joining, a weapon pulled out)
 *    so the first shot, first grenade or first enemy on screen doesn't freeze
 *    the game while the GPU driver catches up;
 *  - finishes setting each of those shaders up as soon as the driver has it
 *    ready (see finishPrograms).
 */

const TEXTURE_KEYS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'alphaMap', 'aoMap', 'bumpMap', 'lightMap']

/**
 * Shader warm-up for both the world's lights and the viewmodel's: an arm, the
 * player bodies, the sprites, and (as they get built, see SHOWCASE_GUNS) every
 * weapon, every piece of equipment and the rocket.
 */
function weaponShowcase() {
  const g = new Group()
  g.add(makeArm(1))
  g.add(remoteLaserBeam())
  for (const body of avatarStandIns()) g.add(body)
  g.add(spriteShowcase())
  return g
}

/**
 * The guns in the showcase, as [id, attachments, with its far LOD]: every model
 * bare, then the guns other players are sure to carry (every bot loadout and
 * the preset classes) so those are built before they first show up. ~50 models
 * took well over a second to build in one go; they're built in idle moments
 * instead (prepareWeaponModel) and join the showcase as each is ready.
 */
const SHOWCASE_GUNS = [
  ...[...Object.keys(WEAPONS), 'frag', 'semtex', 'c4', 'claymore', 'detonator', 'flash', 'smoke', 'rocket'].map((id) => [id, undefined, false]),
  ...Object.entries(BOT_KITS).flatMap(([id, list]) => list.map((att) => [id, att, true])),
  ...PRESET_CLASSES.map((c) => [c.primary, c.primaryAtt, true]),
]

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

  // Your own class's guns, built in idle time while you're still in the menus (ahead of the rest).
  useEffect(() => {
    const c = toWireClass(useGameStore.getState().getClass(classId))
    if (!c) return
    prepareWeaponModel(c.primary, c.primaryAtt, true)
    prepareWeaponModel(c.secondary, c.secondaryAtt, true)
  }, [classId, classes])
  // Every other gun, queued behind them.
  useEffect(() => {
    for (const [id, att] of SHOWCASE_GUNS) prepareWeaponModel(id, att)
  }, [])
  const st = useRef({ frame: 0, compiledAt: '', seenWorld: new WeakSet(), seenVm: new WeakSet(), finished: new WeakSet(), parked: 0, parkAt: 0, slow: 0, lastFps: 0, gunsLeft: SHOWCASE_GUNS })

  // The world never moves: don't rebuild the scene root's matrix every frame
  // (it forces every object below it to recompute its own), and before each
  // render walk only what can have moved (see sceneMatrices.js).
  useEffect(() => {
    scene.matrixAutoUpdate = false
    scene.updateMatrix()
    const undo = leanMatrixWalk(scene)
    return () => {
      undo()
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

    if (s.frame % 10 === 5) finishPrograms(gl, s.finished)

    // Park the showcase once the driver has the shaders just compiled for it
    // ready: drawn any sooner, the draw waits for them (most of a second on
    // some drivers). Never later than ~4 s after the warm-up.
    if (s.parkAt && (s.frame - s.parkAt > 240 || programsReady(gl))) {
      s.parkAt = 0
      finishPrograms(gl, s.finished)
      showcase.position.set(0, -12, 0)
      scene.add(showcase)
      showcase.updateMatrixWorld(true)
      gl.shadowMap.needsUpdate = true
      s.parked = 4
    }

    // Guns built since the last look join the showcase; once they're all in,
    // the next warm-up below is a full one, so their shaders are ready too.
    if (s.gunsLeft.length && s.frame % 30 === 17) {
      s.gunsLeft = s.gunsLeft.filter(([id, att, lod]) => {
        if (!hasWeaponModel(id, att)) return true
        showcase.add(createWeaponModel(id, att))
        const far = lod && createWeaponLod(id, att)
        if (far) showcase.add(far)
        return false
      })
      if (!s.gunsLeft.length) s.compiledAt = ''
    }

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
        // really in the scene: the showcase gets parked under the map for a
        // few frames (below) so those are built now too, not when the first
        // player turns up.
        s.parkAt = s.frame
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

/**
 * three.js reads a shader's uniform and attribute tables (and its compile log)
 * the first time something is drawn with it, not when it's compiled. On some
 * drivers (AMD through ANGLE/D3D11) that first read stalled for 0.1-0.4 s
 * even when the shader had been compiled seconds earlier: the first shot, the
 * first reload, the first explosion. Done here instead, for every shader the
 * driver reports linked (asking is non-blocking), it costs well under 1 ms.
 */
function finishPrograms(gl, finished) {
  for (const program of gl.info.programs ?? []) {
    if (finished.has(program) || !program.isReady?.()) continue
    finished.add(program)
    program.getUniforms()
  }
}

/** True once the driver reports every compiled shader linked (asking doesn't block). */
const programsReady = (gl) => (gl.info.programs ?? []).every((p) => p.isReady?.() !== false)

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
