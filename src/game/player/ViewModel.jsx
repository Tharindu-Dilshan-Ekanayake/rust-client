import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  PointLight,
  Scene,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
} from 'three'

import { RELOAD_KEYS } from '../../audio/bank.js'
import { sfx } from '../../audio/sfx.js'
import { ColorGrade } from '../ColorGrade.js'
import { useBloxityStore } from '../../bloxity/store.js'
import { activeMapId, useActiveMap, useGameStore } from '../../store/gameStore.js'
import { createWeaponModel, weaponMaterials } from '../models/weaponModels.js'
import { makeArm, placeArm } from './arms.js'
import { buildBloxArms, dressArm } from './bloxArms.js'
import { runtime } from '../runtime.js'
import { envFor } from '../environment.js'
import { flareTexture } from '../world/textures.js'

/**
 * First-person weapon + arms.
 *
 * Lives in its own scene with its own camera and is drawn after the world with a
 * cleared depth buffer (see RenderPipeline), so the gun never clips into walls
 * and keeps a steady FOV while the world camera zooms for ADS.
 */

/**
 * Hip placement per weapon, in viewmodel camera space. ADS placement is worked
 * out from each model's 'sight' marker so whatever optic is fitted lines up
 * with the centre of the screen; `eye` is how far in front of the eye it sits.
 */
const POSES = {
  ar: { hip: [0.13, -0.135, -0.3], rot: [0, 0.04, 0], eye: 0.075, opticEye: 0.06 },
  sniper: { hip: [0.15, -0.15, -0.3], rot: [0, 0.05, 0], eye: 0.06 },
  pistol: { hip: [0.11, -0.105, -0.25], rot: [0, 0.05, 0], eye: 0.15, opticEye: 0.12 },
  viper: { hip: [0.115, -0.11, -0.26], rot: [0, 0.05, 0], eye: 0.15, opticEye: 0.12 },
  hornet: { hip: [0.12, -0.115, -0.26], rot: [0, 0.05, 0], eye: 0.13, opticEye: 0.11 },
  smg: { hip: [0.12, -0.125, -0.28], rot: [0, 0.045, 0], eye: 0.09, opticEye: 0.06 },
  shotgun: { hip: [0.13, -0.13, -0.3], rot: [0, 0.04, 0], eye: 0.1, opticEye: 0.07 },
  lmg: { hip: [0.14, -0.15, -0.32], rot: [0, 0.035, 0], eye: 0.08, opticEye: 0.06 },
  // Any further out and the venturi at the back crosses the near plane.
  rpg: { hip: [0.15, -0.125, -0.25], rot: [0, 0.03, 0], eye: 0.12 },
  knife: { hip: [0.13, -0.12, -0.28], ads: [0.13, -0.12, -0.28], rot: [0.42, 0.9, 0.18] },
}
/** Viewmodel kick multiplier per weapon. */
const HEAVY = { sniper: 2.4, viper: 2.1, pistol: 1.4, hornet: 0.75, smg: 0.8, shotgun: 2.2, lmg: 1.1, rpg: 2.6 }
/** Muzzle-flash sprite size (rig units) per weapon. */
const FLASH_SIZE = { sniper: 0.42, viper: 0.34, pistol: 0.22, hornet: 0.2, smg: 0.24, shotgun: 0.5, lmg: 0.36, rpg: 0.6 }
/** Guns whose empty reload is quicker through the mag change and then works the action (see RELOAD_KEYS). */
const EMPTY_ACTION = new Set(['ar', 'smg', 'hornet', 'pistol'])
/** The charging handle each empty reload grabs (model space), and how far it travels back. */
const CHARGE_POINT = {
  ar: new Vector3(-0.012, 0.092, 0.135),
  smg: new Vector3(-0.03, 0.06, 0.08),
  hornet: new Vector3(-0.022, 0.058, 0.085),
}
const CHARGE_TRAVEL = { ar: 0.05, smg: 0.045, hornet: 0.04 }
/** The off hand's elbow comes up and out to reach over the receiver. */
const ELBOW_L_CHARGE = new Vector3(-0.25, -0.3, 0.05)
/** Casing thrown out of the port per weapon (none for the launcher). */
const SHELL_KIND = { ar: 'rifle', lmg: 'rifle', sniper: 'sniper', shotgun: 'shotgun', smg: 'pistol', pistol: 'pistol', hornet: 'pistol' }
/** Guns are modelled at real size; this keeps them from filling the screen. */
const VM_SCALE = 0.6
const GRIP = new Vector3(0, -0.06, 0.06)
const ELBOW_R = new Vector3(0.2, -0.44, -0.04)
const ELBOW_L = new Vector3(-0.17, -0.42, -0.08)
const ELBOW_L_REACH = new Vector3(-0.3, -0.3, -0.2)

const _b = new Vector3()
const _c = new Vector3()
const _d = new Vector3()
const _e = new Vector3()
/** Where the off hand goes for shotgun shells (camera space, below the view). */
const SHELL_BELT = new Vector3(-0.12, -0.25, -0.2)

/** Pump travel 0..1 for a stroke that's back from `b0`..`b1`, held, then forward `f0`..`f1`. */
function pumpStroke(k, b0, b1, f0, f1) {
  if (k < b0 || k > f1) return 0
  if (k < b1) return smooth((k - b0) / (b1 - b0))
  if (k < f0) return 1
  return 1 - smooth((k - f0) / (f1 - f0))
}

const smooth = (t) => t * t * (3 - 2 * t)

/* ---------------------------------------------------------------------------
 * Grenade throw (camera space). Cooking: the off hand brings the grenade up,
 * the pin pops, and the arm winds back up by the shoulder and holds there.
 * Throwing: finish the wind-up if it wasn't (a quick tap, or a tactical), then
 * an overhand whip forward, release, follow-through across the body, and the
 * arm drops away.
 * ------------------------------------------------------------------------- */

const T_LOW = new Vector3(-0.16, -0.34, -0.28)
const T_CHEST = new Vector3(-0.1, -0.13, -0.3)
const T_WIND = new Vector3(-0.2, 0.03, -0.25)
const T_RELEASE = new Vector3(-0.05, 0.07, -0.52)
const T_FOLLOW = new Vector3(0.07, -0.2, -0.38)
const E_WIND = new Vector3(-0.42, -0.1, 0.02)
const E_FWD = new Vector3(-0.25, -0.22, -0.1)
const _tw = new Vector3()
const _te = new Vector3()

function throwPose(vm, a) {
  const t = vm.throwState
  const throwing = a.throw >= 0
  if (!a.cooking && !throwing) {
    t.pin = false
    t.started = false
    return { active: false, grenade: false }
  }
  const popPin = () => {
    if (t.pin) return
    t.pin = true
    const g = vm.grenades[a.grenadeKind ?? 'frag']
    if (g) ejectShell(vm, g, 'pin')
  }
  if (a.cooking) {
    const c = a.cookTime ?? 0
    if (c < 0.14) {
      _tw.lerpVectors(T_LOW, T_CHEST, smooth(c / 0.14))
      _te.copy(ELBOW_L)
    } else if (c < 0.2) {
      popPin()
      _tw.copy(T_CHEST)
      _te.copy(ELBOW_L)
    } else {
      popPin()
      const w = smooth(Math.min(1, (c - 0.2) / 0.2))
      _tw.lerpVectors(T_CHEST, T_WIND, w)
      _te.lerpVectors(ELBOW_L, E_WIND, w)
      // Holding a live grenade: the arm can't keep quite still.
      if (w >= 1) _tw.y += Math.sin(c * 9) * 0.003
    }
    t.wind = c < 0.2 ? 0 : Math.min(1, (c - 0.2) / 0.2)
    t.from.copy(_tw)
    t.fromElbow.copy(_te)
    t.cooked = true
    t.started = false
    return { active: true, grenade: true, wrist: _tw, elbow: _te }
  }

  // Throwing.
  if (!t.started) {
    t.started = true
    t.released = false
    if (!t.cooked) {
      t.from.copy(T_LOW)
      t.fromElbow.copy(ELBOW_L)
      t.wind = 0
    }
    t.cooked = false
    popPin()
  }
  const k = a.throw
  const wu = 0.3 * (1 - t.wind)
  const swing = 0.18
  const follow = 0.2
  if (k < wu) {
    const f = smooth(k / wu)
    _tw.lerpVectors(t.from, T_WIND, f)
    _te.lerpVectors(t.fromElbow, E_WIND, f)
  } else if (k < wu + swing) {
    // Accelerating overhand arc, peaking just before the release.
    const f = (k - wu) / swing
    const e = f * f
    _tw.lerpVectors(T_WIND, T_RELEASE, e)
    _tw.y += Math.sin(e * Math.PI) * 0.07
    _te.lerpVectors(E_WIND, E_FWD, e)
    if (f > 0.75 && !t.released) {
      t.released = true
      // The weight of it leaving the hand.
      runtime.view.shake = Math.min(1, runtime.view.shake + 0.08)
    }
  } else if (k < wu + swing + follow) {
    const f = smooth((k - wu - swing) / follow)
    _tw.lerpVectors(T_RELEASE, T_FOLLOW, f)
    _te.lerpVectors(E_FWD, ELBOW_L, f)
    t.released = true
  } else {
    const f = smooth((k - wu - swing - follow) / (1 - wu - swing - follow))
    _tw.lerpVectors(T_FOLLOW, T_LOW, f)
    _te.copy(ELBOW_L)
  }
  return { active: true, grenade: !t.released, wrist: _tw, elbow: _te }
}
const KNIFE_VIEW_SCALE = 1.3
const TRAIL_POINTS = 14

/**
 * Knife slash, alternating forehand and backhand: a short wind-up to one side,
 * a fast cut across and down with a little lunge, then a settle back.
 * Returns pose offsets for progress `k` (0..1).
 */
function knifeSlash(k, dir) {
  const o = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, strike: 0 }
  const wind = { x: dir * 0.09, y: 0.05, z: 0.02, rx: -0.25, ry: -dir * 0.35, rz: dir * 0.75 }
  const cut = { x: -dir * 0.24, y: -0.07, z: -0.13, rx: 0.35, ry: dir * 0.85, rz: -dir * 1.0 }
  let from
  let to
  let t
  if (k < 0.18) {
    from = null
    to = wind
    t = smooth(k / 0.18)
  } else if (k < 0.42) {
    from = wind
    to = cut
    t = smooth((k - 0.18) / 0.24)
    o.strike = Math.sin(((k - 0.18) / 0.24) * Math.PI)
  } else {
    from = cut
    to = null
    t = smooth((k - 0.42) / 0.58)
  }
  for (const key of ['x', 'y', 'z', 'rx', 'ry', 'rz']) {
    const a = from ? from[key] : 0
    const b = to ? to[key] : 0
    o[key] = a + (b - a) * t
  }
  return o
}

/** A fading ribbon behind the blade while it cuts (camera space, additive). */
function makeTrail() {
  const geo = new BufferGeometry()
  const pos = new Float32Array(TRAIL_POINTS * 2 * 3)
  const col = new Float32Array(TRAIL_POINTS * 2 * 3)
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  geo.setAttribute('color', new BufferAttribute(col, 3))
  const idx = []
  for (let i = 0; i < TRAIL_POINTS - 1; i++) {
    const a = i * 2
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  geo.setIndex(idx)
  const mesh = new Mesh(
    geo,
    new MeshBasicMaterial({ vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
  )
  mesh.frustumCulled = false
  mesh.visible = false
  return { mesh, points: [] }
}

const _tip = new Vector3()
const _mid = new Vector3()

function updateTrail(vm, model, active) {
  const trail = vm.trail
  if (active) {
    const tip = model.getObjectByName('tip')
    const mid = model.getObjectByName('mid')
    if (tip && mid) {
      tip.getWorldPosition(_tip)
      mid.getWorldPosition(_mid)
      vm.camera.worldToLocal(_tip)
      vm.camera.worldToLocal(_mid)
      trail.points.unshift([_tip.clone(), _mid.clone()])
    }
  } else if (trail.points.length) {
    // Let the ribbon shrink away instead of vanishing.
    trail.points.pop()
  }
  if (trail.points.length > TRAIL_POINTS) trail.points.length = TRAIL_POINTS
  const n = trail.points.length
  trail.mesh.visible = n > 1
  if (n < 2) return
  const pos = trail.mesh.geometry.getAttribute('position')
  const col = trail.mesh.geometry.getAttribute('color')
  for (let i = 0; i < TRAIL_POINTS; i++) {
    const [a, b] = trail.points[Math.min(i, n - 1)]
    pos.setXYZ(i * 2, a.x, a.y, a.z)
    pos.setXYZ(i * 2 + 1, b.x, b.y, b.z)
    const fade = i < n ? (1 - i / n) ** 1.5 * 0.38 : 0
    col.setXYZ(i * 2, fade, fade * 0.97, fade * 0.9)
    col.setXYZ(i * 2 + 1, fade * 0.2, fade * 0.2, fade * 0.18)
  }
  pos.needsUpdate = true
  col.needsUpdate = true
  trail.mesh.geometry.setDrawRange(0, (n - 1) * 6)
}

const _shellPos = new Vector3()

/**
 * The viewmodel draws its own copies of the gun, arm and casing materials. A
 * material drawn in two scenes with different lights (the world, and the
 * viewmodel's studio rig) has its shader looked up again every time it changes
 * scene: every frame, for every part of a gun someone in view is also carrying.
 */
const vmMaterials = new Map()
function vmMaterial(material) {
  let own = vmMaterials.get(material)
  if (!own) {
    own = material.clone()
    vmMaterials.set(material, own)
    vmMaterials.set(own, own)
  }
  return own
}
function ownMaterials(root) {
  root.traverse((o) => {
    if (o.material && !Array.isArray(o.material)) o.material = vmMaterial(o.material)
  })
  return root
}

/** Throws a casing out of the gun's `eject` marker, in camera space. */
function ejectShell(vm, eject, kind) {
  const s = vm.shells[vm.nextShell++ % vm.shells.length]
  eject.getWorldPosition(_shellPos)
  vm.camera.worldToLocal(_shellPos)
  s.mesh.geometry = vm.shellGeos[kind]
  s.mesh.material = vmMaterial(kind === 'shotgun' ? weaponMaterials.red : kind === 'pin' ? weaponMaterials.steel : weaponMaterials.brass)
  s.mesh.position.copy(_shellPos)
  s.mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0)
  const up = kind === 'pistol' ? 1.35 : kind === 'shotgun' ? 0.8 : 1
  if (kind === 'pin') s.vel.set(-0.35 - Math.random() * 0.3, 0.55 + Math.random() * 0.3, 0.1)
  else s.vel.set(0.85 + Math.random() * 0.5, (0.9 + Math.random() * 0.5) * up, 0.18 + Math.random() * 0.25)
  s.spin.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 20)
  s.life = 0.75
  s.mesh.visible = true
  // A tinkle as it lands, not for every round of a long burst.
  if (kind !== 'pin' && vm.shotCount++ % 2 === 0) setTimeout(() => sfx.play('brass', { volume: 0.22 }), 380 + Math.random() * 120)
}

function updateShells(vm, dt) {
  for (const s of vm.shells) {
    if (s.life <= 0) continue
    s.life -= dt
    s.vel.y -= 5.5 * dt
    s.mesh.position.addScaledVector(s.vel, dt)
    s.mesh.rotation.x += s.spin.x * dt
    s.mesh.rotation.y += s.spin.y * dt
    s.mesh.rotation.z += s.spin.z * dt
    if (s.life <= 0) s.mesh.visible = false
  }
}

/** Builds a viewmodel weapon and works out where it sits when aimed. */
function buildModel(id, att, rig) {
  const model = ownMaterials(createWeaponModel(id, att))
  model.visible = false
  // The knife reads better a size up in first person.
  if (id === 'knife') model.scale.setScalar(KNIFE_VIEW_SCALE)
  rig.add(model)
  const pose = POSES[id] ?? POSES.ar
  const sight = model.getObjectByName('sight')
  if (pose.ads || !sight) {
    model.userData.ads = new Vector3().fromArray(pose.ads ?? pose.hip)
  } else {
    // Put the sight line on the camera axis, `eye` metres ahead of the eye.
    const eye = att?.optic && att.optic !== 'iron' ? (pose.opticEye ?? pose.eye) : pose.eye
    model.userData.ads = new Vector3(-sight.position.x * VM_SCALE, -sight.position.y * VM_SCALE, -eye - sight.position.z * VM_SCALE)
  }
  return model
}

export function ViewModel() {
  const size = useThree((s) => s.size)
  const vm = useMemo(() => {
    const scene = new Scene()
    const camera = new PerspectiveCamera(62, 1, 0.01, 10)
    scene.add(camera)
    // Lit like the map you're on (see the effect below).
    const ambient = new AmbientLight()
    const hemi = new HemisphereLight()
    const sun = new DirectionalLight()
    scene.add(ambient, hemi, sun)
    // A studio rig that turns with the view so the gun always reads well: warm key
    // over the shoulder, cool rim from beyond the muzzle, soft fill from the left.
    const aim = new Object3D()
    aim.position.set(0.1, -0.12, -0.45)
    camera.add(aim)
    for (const [color, intensity, pos] of [
      ['#ffe6c4', 2.3, [1.2, 1.4, 1.0]],
      ['#c4dcff', 1.8, [-0.6, 0.9, -2.0]],
      ['#9fb2cc', 0.55, [-1.5, -0.3, 0.4]],
    ]) {
      const light = new DirectionalLight(color, intensity)
      light.position.set(...pos)
      light.target = aim
      camera.add(light)
    }

    // Spent brass: a small pool of casings flung out of the ejection port.
    const shellGeos = {
      rifle: new CylinderGeometry(0.0029, 0.0029, 0.027, 10).rotateX(Math.PI / 2),
      pistol: new CylinderGeometry(0.0027, 0.0027, 0.0125, 10).rotateX(Math.PI / 2),
      sniper: new CylinderGeometry(0.0039, 0.0036, 0.042, 10).rotateX(Math.PI / 2),
      shotgun: new CylinderGeometry(0.0095, 0.0095, 0.05, 12).rotateX(Math.PI / 2),
      pin: new TorusGeometry(0.011, 0.0022, 6, 14),
    }
    const shells = Array.from({ length: 14 }, () => {
      const mesh = new Mesh(shellGeos.rifle, vmMaterial(weaponMaterials.brass))
      mesh.visible = false
      camera.add(mesh)
      return { mesh, vel: new Vector3(), spin: new Vector3(), life: 0 }
    })

    const rig = new Group()
    rig.scale.setScalar(VM_SCALE)
    camera.add(rig)
    // Built lazily per weapon + attachment combo; geometry is shared, so these are cheap.
    const models = new Map()
    const armR = ownMaterials(makeArm(1))
    const armL = ownMaterials(makeArm(-1))
    camera.add(armR, armL)
    // A shotgun shell pinched in the off hand's fingers while reloading.
    const handShell = new Group()
    handShell.add(new Mesh(new CylinderGeometry(0.0095, 0.0095, 0.05, 12).rotateX(Math.PI / 2), weaponMaterials.red))
    const shellBase = new Mesh(new CylinderGeometry(0.0098, 0.0098, 0.012, 12).rotateX(Math.PI / 2), weaponMaterials.brass)
    shellBase.position.z = 0.028
    handShell.add(shellBase)
    ownMaterials(handShell)
    handShell.position.set(0, 0.004, -0.07)
    handShell.visible = false
    armL.add(handShell)
    const grenades = { frag: ownMaterials(createWeaponModel('frag')), flash: ownMaterials(createWeaponModel('flash')), smoke: ownMaterials(createWeaponModel('smoke')) }
    for (const g of Object.values(grenades)) {
      g.visible = false
      armL.add(g)
      g.scale.setScalar(0.55)
      g.position.set(0, 0.03, -0.03)
    }

    const flash = new Sprite(
      new SpriteMaterial({ map: flareTexture(), color: '#ffd28a', blending: AdditiveBlending, depthWrite: false, transparent: true }),
    )
    flash.visible = false
    rig.add(flash)
    const flashLight = new PointLight('#ffb35a', 0, 3, 2)
    camera.add(flashLight)
    flashLight.position.set(0.1, -0.05, -0.6)

    return {
      scene,
      camera,
      rig,
      models,
      armR,
      armL,
      grenades,
      handShell,
      flash,
      flashLight,
      sprint: 0,
      slide: 0,
      sway: { x: 0, y: 0 },
      visible: false,
      magRest: new Map(),
      shells,
      shellGeos,
      trail: (() => {
        const t = makeTrail()
        camera.add(t.mesh)
        return t
      })(),
      nextShell: 0,
      shotCount: 0,
      lastBolt: -1,
      lastRack: -1,
      throwState: { pin: false, started: false, released: false, cooked: false, wind: 0, from: new Vector3(), fromElbow: new Vector3() },
      drum: 0,
      drumTarget: 0,
      lastSince: 1,
      lights: { ambient, hemi, sun },
    }
  }, [])

  const mapId = useActiveMap().id
  useEffect(() => {
    const { ambient, hemi, sun } = vm.lights
    const env = envFor(mapId)
    ambient.color.set(env.vm.ambient[0])
    ambient.intensity = env.vm.ambient[1]
    hemi.color.set(env.vm.hemi[0])
    hemi.groundColor.set(env.vm.hemi[1])
    hemi.intensity = env.vm.hemi[2]
    sun.color.set(env.vm.sun[0])
    sun.intensity = env.vm.sun[1]
    sun.position.copy(env.sunDir).multiplyScalar(5).add(new Vector3(0, 2, 2))
  }, [vm, mapId])

  useEffect(() => {
    runtime.vm = vm
    return () => {
      if (runtime.vm === vm) runtime.vm = null
    }
  }, [vm])

  useEffect(() => {
    vm.camera.aspect = size.width / size.height
    vm.camera.updateProjectionMatrix()
  }, [size, vm])

  // The hands on the gun are the player's own Bloxity arms (skin, shirt
  // sleeves), rebuilt whenever they change their avatar.
  const equipped = useBloxityStore((s) => s.equipped)
  useEffect(() => {
    let cancelled = false
    buildBloxArms(equipped).then((arms) => {
      if (cancelled || !arms) return
      dressArm(vm.armL, arms.L)
      dressArm(vm.armR, arms.R)
      // A blocky hand holds a grenade at its end rather than in a palm.
      for (const g of Object.values(vm.grenades)) g.position.set(0, 0.006, -0.072)
    })
    return () => {
      cancelled = true
    }
  }, [vm, equipped])

  const lastWeapon = useRef('')

  useFrame((_s, delta) => {
    // Reflections from the start (not just once the gun is first shown), so the
    // shaders warmed up in the menu are the ones gameplay uses.
    if (runtime.envMap && vm.scene.environment !== runtime.envMap) {
      vm.scene.environment = runtime.envMap
      vm.scene.environmentIntensity = 0.95
    }
    const dt = Math.min(delta, 0.05)
    const a = runtime.vmState
    const game = useGameStore.getState()
    const show = Boolean(a) && game.gameState === 'playing' && runtime.local.alive && !a.climbing
    // Fully scoped snipers see the scope overlay instead of the gun.
    const scoped = a && a.weapon === 'sniper' && a.ads > 0.92
    vm.visible = show && !scoped
    if (!vm.visible) {
      vm.flashLight.intensity = 0
      return
    }

    const id = a.weapon
    const key = `${id}:${a.att?.optic ?? ''}:${a.att?.muzzle ?? ''}:${a.att?.mag ?? ''}`
    if (!vm.models.has(key)) vm.models.set(key, buildModel(id, a.att, vm.rig))
    if (lastWeapon.current !== key) {
      for (const [k, m] of vm.models) m.visible = k === key
      lastWeapon.current = key
    }
    const model = vm.models.get(key)
    const pose = POSES[id] ?? POSES.ar
    const adsPose = model.userData.ads

    // Mouse sway: the gun lags slightly behind the view.
    vm.sway.x += (-a.lookDx * 0.00018 - vm.sway.x) * Math.min(1, dt * 10)
    vm.sway.y += (a.lookDy * 0.00018 - vm.sway.y) * Math.min(1, dt * 10)
    vm.sway.x = Math.max(-0.04, Math.min(0.04, vm.sway.x))
    vm.sway.y = Math.max(-0.04, Math.min(0.04, vm.sway.y))
    vm.sprint += ((a.sprint ? 1 : 0) - vm.sprint) * Math.min(1, dt * 9)

    const t = smooth(a.ads)
    const p = new Vector3().fromArray(pose.hip).lerp(adsPose, t)
    const rx = pose.rot[0] * (1 - t)
    let ry = pose.rot[1] * (1 - t)
    let rz = pose.rot[2] * (1 - t)
    let rxx = rx

    const hipK = 1 - t * 0.85
    p.x += (a.bob?.x ?? 0) * hipK + vm.sway.x * hipK
    p.y += (a.bob?.y ?? 0) * hipK + vm.sway.y * hipK
    ry += vm.sway.x * 2 * hipK

    // Sprint: gun canted down and inward.
    const sp = vm.sprint
    p.x += 0.05 * sp
    p.y -= 0.06 * sp
    rxx -= 0.35 * sp
    ry += 0.75 * sp
    rz += 0.25 * sp

    // Slide: gun canted over and pulled in.
    vm.slide += ((a.slide ? 1 : 0) - vm.slide) * Math.min(1, dt * 10)
    rz += 0.32 * vm.slide * (1 - t)
    p.x -= 0.03 * vm.slide
    p.y -= 0.025 * vm.slide

    // Recoil kick.
    const kick = a.kick * a.kick
    const heavy = HEAVY[id] ?? 1
    // Recoil pushes back and climbs, but much less when aimed so the sight stays usable.
    p.z += 0.03 * kick * heavy * (1 - t * 0.4)
    rxx += 0.07 * kick * heavy * (1 - t * 0.55)

    // Reload: tilt the gun in, drop the empty mag, the off hand brings a fresh one
    // up from the belt and slaps it home, then the gun rolls back level.
    const mag = model.getObjectByName('mag')
    if (mag && !vm.magRest.has(mag)) vm.magRest.set(mag, { p: mag.position.clone(), r: mag.rotation.clone() })
    if (mag) {
      const rest = vm.magRest.get(mag)
      mag.position.copy(rest.p)
      mag.rotation.copy(rest.r)
      mag.visible = true
    }
    /** 0..1 how far the off hand is reaching for / holding the magazine. */
    let magHand = 0
    /** Empty reload: 0..1 how far the off hand is on the charging handle, and how far it's pulled back. */
    let chargeHand = 0
    let chargePull = 0
    /** Shotgun: shell-by-shell reload progress (see weaponSystem.shellPhase), or null. */
    let shellHand = null
    /** Launcher: 0..1 how far the off hand is on the fresh rocket. */
    let rocketHand = 0
    const warhead = model.getObjectByName('warhead')
    if (warhead) {
      if (!warhead.userData.rest) warhead.userData.rest = warhead.position.clone()
      warhead.position.copy(warhead.userData.rest)
      warhead.visible = a.loaded !== false
    }
    if (a.reload >= 0 && id === 'shotgun') {
      // Rolled onto its side so the loading port faces the off hand, which
      // fetches shells off the belt one at a time and thumbs them in.
      const rl = Math.min(1, a.reload)
      const lift = Math.min(1, Math.sin(rl * Math.PI) * 4)
      p.y += 0.05 * lift
      p.x -= 0.045 * lift
      rz -= 0.55 * lift
      rxx += 0.14 * lift
      if (a.shell != null) {
        shellHand = a.shell
        // Each shell pushed home nudges the gun.
        const k = a.shell - Math.floor(a.shell)
        if (a.shell >= 0 && k > 0.42 && k < 0.6) rxx -= 0.04 * Math.sin(((k - 0.42) / 0.18) * Math.PI)
      }
    } else if (a.reload >= 0 && id === 'rpg') {
      // The tube swings across with its muzzle up and to the left, so the
      // fresh rocket goes into the front within easy reach.
      const rl = Math.min(1, a.reload)
      const lift = Math.min(1, Math.sin(rl * Math.PI) * 1.8)
      p.y -= 0.03 * lift
      p.x -= 0.02 * lift
      p.z += 0.05 * lift
      ry += 0.95 * lift
      rxx += 0.3 * lift
      rz -= 0.15 * lift
      if (warhead && rl > 0.2 && rl < 0.72) {
        const f = Math.min(1, (rl - 0.2) / 0.42)
        const e = f * f * (3 - 2 * f)
        warhead.visible = true
        warhead.position.z -= 0.3 * (1 - e)
        warhead.position.y -= 0.05 * (1 - e)
        rocketHand = Math.min(1, (rl - 0.2) / 0.06, (0.72 - rl) / 0.08)
        // Seated: a shove that rocks the tube back.
        if (rl > 0.62) p.z += 0.02 * Math.sin(((rl - 0.62) / 0.1) * Math.PI)
      }
    } else if (a.reload >= 0) {
      const rl = Math.min(1, a.reload)
      // The same key moments the reload sounds are cued from (audio/bank.js).
      const keys = RELOAD_KEYS[a.empty && EMPTY_ACTION.has(id) ? 'empty' : 'tactical']
      // Bring the gun up toward the middle and roll it so the magwell faces the
      // off hand: the whole swap happens in view.
      const tilt = Math.sin(Math.min(1, rl * 1.1) * Math.PI)
      const lift = Math.min(1, tilt * 1.6)
      p.y += 0.075 * lift
      p.x -= 0.07 * lift
      p.z -= 0.035 * lift
      rz -= 0.7 * lift
      rxx += 0.18 * lift
      ry += 0.12 * lift
      if (mag) {
        if (rl < keys.out) {
          // Thumb the release.
          magHand = rl / keys.out
        } else if (rl < keys.fallEnd) {
          // Empty mag falls out, tumbling.
          const f = (rl - keys.out) / (keys.fallEnd - keys.out)
          mag.position.y -= 0.9 * f * f
          mag.position.z += 0.12 * f
          mag.rotation.x += 1.4 * f
          mag.visible = f < 0.95
          magHand = Math.max(0, 1 - f * 2)
        } else if (rl < keys.seat) {
          // Fresh mag rises with the hand into the well.
          const f = (rl - keys.fallEnd) / (keys.seat - keys.fallEnd)
          const e = f * f * (3 - 2 * f)
          mag.position.y -= 0.32 * (1 - e)
          mag.position.z -= 0.06 * (1 - e)
          mag.rotation.x -= 0.35 * (1 - e)
          magHand = 1
        } else {
          // Seated with a jolt; the palm slaps it home, then the hand goes back.
          const seatJolt = (rl - keys.seat) / 0.045
          if (seatJolt < 1) rxx -= 0.06 * Math.sin(seatJolt * Math.PI)
          const slap = (rl - keys.tap) / 0.04
          if (slap > 0 && slap < 1) rxx -= 0.035 * Math.sin(slap * Math.PI)
          magHand = rl < keys.tap + 0.03 ? 1 : Math.max(0, 1 - (rl - keys.tap - 0.03) / 0.1)
        }
      }
      // Empty: work the action. The off hand reaches the charging handle, rips
      // it back, lets go, and the bolt slams home with a kick through the gun.
      if (keys.charge && CHARGE_POINT[id]) {
        const reach = keys.charge - 0.1
        if (rl > reach && rl < keys.slam + 0.12) {
          chargeHand = rl < keys.charge ? smooth((rl - reach) / 0.1) : rl < keys.slam ? 1 : 1 - smooth((rl - keys.slam) / 0.12)
          // Ripped back fast, held a beat, then let go so the bolt runs home.
          chargePull = rl >= keys.charge && rl < keys.slam - 0.02 ? smooth(Math.min(1, (rl - keys.charge) / 0.045)) : 0
        }
        // Swing the back of the receiver up into view and cant the top toward
        // the off hand, so the pull reads instead of happening off screen.
        const pose = rl < reach ? 0 : rl < keys.charge ? smooth((rl - reach) / 0.1) : rl < keys.slam ? 1 : 1 - smooth(Math.min(1, (rl - keys.slam) / 0.16))
        p.x -= 0.015 * pose
        p.y += 0.02 * pose
        p.z -= 0.04 * pose
        rz += 0.22 * pose
        rxx -= 0.05 * pose
        if (chargePull > 0) {
          // The pull drags the whole gun back a touch.
          p.z += 0.008 * chargePull
          rz += 0.04 * chargePull
        }
      }
      if (keys.slam) {
        const kick = (rl - keys.slam) / 0.05
        if (kick > 0 && kick < 1) {
          p.z += 0.014 * Math.sin(kick * Math.PI)
          rxx -= 0.04 * Math.sin(kick * Math.PI)
        }
      }
    }

    // Weapon swap: comes up from below. The knife is flipped up into the hand,
    // spinning once round its own length.
    if (a.swap >= 0) {
      const low = 1 - smooth(Math.min(1, a.swap))
      p.y -= 0.22 * low
      rxx -= 0.9 * low
      if (id === 'knife' && !a.quickKnife) rz += low * Math.PI * 2
    }

    // Melee: the knife slashes across; any other weapon does a quick bash.
    if (a.melee >= 0) {
      const m = Math.sin(a.melee * Math.PI)
      if (id === 'knife') {
        const o = knifeSlash(a.melee, (a.meleeIndex ?? 0) % 2 ? -1 : 1)
        p.x += o.x
        p.y += o.y
        p.z += o.z
        rxx += o.rx
        ry += o.ry
        rz += o.rz
      } else {
        p.z -= 0.14 * m
        p.x -= 0.05 * m
        rxx -= 0.25 * m
        rz += 0.4 * m
      }
    }

    // Grenades: the gun drops away to the right while the off hand pulls the
    // pin, winds up and throws; it comes back up after the follow-through.
    const throwing = a.throw >= 0
    if (a.cooking || throwing) {
      const lower = throwing ? (a.throw < 0.7 ? 1 : 1 - smooth((a.throw - 0.7) / 0.3)) : Math.min(1, (a.cookTime ?? 1) / 0.12)
      p.y -= 0.1 * lower
      p.x += 0.05 * lower
      rxx -= 0.38 * lower
      rz -= 0.25 * lower
    }

    const newShot = (a.sinceShot ?? 1) < vm.lastSince
    // Pistol slide: snaps back and forward on every shot, locks open when empty.
    const slide = model.getObjectByName('slide')
    if (slide) {
      if (slide.userData.restZ === undefined) slide.userData.restZ = slide.position.z
      const since = a.sinceShot ?? 1
      let back = since < 0.075 ? Math.sin((since / 0.075) * Math.PI) : 0
      if (a.empty && !(a.reload >= RELOAD_KEYS.empty.slam)) back = 0.85
      slide.position.z = slide.userData.restZ + 0.032 * back
    }

    // Sniper bolt cycle; the revolver's cylinder indexes one chamber per shot.
    const bolt = model.getObjectByName('bolt')
    if (bolt && !bolt.userData.rest) bolt.userData.rest = bolt.position.clone()
    if (bolt && id === 'sniper') {
      const rest = bolt.userData.rest
      if (a.bolt >= 0 && a.bolt < 0.8) {
        const b = Math.sin((a.bolt / 0.8) * Math.PI)
        bolt.rotation.z = 1.2 * b
        bolt.position.z = rest.z + 0.07 * b
        p.y -= 0.02 * b
        rz += 0.15 * b
      } else {
        bolt.rotation.z = 0
        bolt.position.z = rest.z
      }
    } else if (bolt && id === 'viper') {
      if (a.sinceShot < vm.lastSince) vm.drumTarget += (Math.PI * 2) / 6
      vm.drum += (vm.drumTarget - vm.drum) * Math.min(1, dt * 22)
      bolt.rotation.z = vm.drum
      // Reload: the cylinder swings out to the left.
      const swing = a.reload >= 0 ? Math.sin(Math.min(1, a.reload) * Math.PI) : 0
      bolt.position.x = bolt.userData.rest.x - 0.035 * Math.min(1, swing * 1.6)
    }

    // Shotgun pump: racked between shots (and after loading from empty); the
    // off hand rides along on it.
    const pump = model.getObjectByName('pump')
    if (pump) {
      if (pump.userData.restZ === undefined) pump.userData.restZ = pump.position.z
      let stroke = 0
      if (a.bolt >= 0) stroke = pumpStroke(a.bolt, 0.25, 0.36, 0.42, 0.53)
      else if (a.rack >= 0) stroke = pumpStroke(a.rack, 0, 0.4, 0.5, 0.92)
      pump.position.z = pump.userData.restZ + 0.085 * stroke
      p.z += 0.012 * stroke
      rz += 0.05 * stroke
      rxx += 0.025 * stroke
    }
    vm.lastSince = a.sinceShot ?? 1

    vm.rig.position.copy(p)
    vm.rig.rotation.set(rxx, ry, rz)
    vm.rig.updateMatrixWorld(true)

    // Brass: out of the port on each shot; bolt guns and the pump throw theirs
    // on the backstroke, and the launcher has nothing to throw.
    const eject = model.getObjectByName('eject')
    const shellKind = SHELL_KIND[id]
    const cycleAt = id === 'sniper' ? 0.42 : id === 'shotgun' ? 0.33 : -1
    const cycled = cycleAt > 0 && vm.lastBolt < cycleAt && a.bolt >= cycleAt
    const rackEject = id === 'shotgun' && vm.lastRack < 0.4 && a.rack >= 0.4
    if (eject && shellKind && ((newShot && cycleAt < 0) || cycled || rackEject)) ejectShell(vm, eject, shellKind)
    vm.lastBolt = a.bolt ?? -1
    vm.lastRack = a.rack ?? -1
    updateShells(vm, dt)
    updateTrail(vm, model, id === 'knife' && a.melee >= 0.16 && a.melee < 0.46)

    // Arms follow the weapon: right hand on the grip, left on the support point.
    const toCam = (local, out) => {
      out.copy(local)
      model.localToWorld(out)
      vm.camera.worldToLocal(out)
      return out
    }
    const wristR = toCam(id === 'knife' ? _b.set(0, 0, 0.03) : GRIP, new Vector3())
    placeArm(vm.armR, wristR, ELBOW_R)

    const grenadeKind = a.grenadeKind ?? 'frag'
    const held = throwPose(vm, a)
    for (const [k, g] of Object.entries(vm.grenades)) g.visible = held.grenade && k === grenadeKind
    if (held.active) {
      placeArm(vm.armL, held.wrist, held.elbow)
      vm.armL.visible = true
    } else if (id === 'knife') {
      vm.armL.visible = false
    } else {
      // World position: the shotgun's support marker rides on the pump.
      const support = model.getObjectByName('leftHand')
      const wristL = support ? vm.camera.worldToLocal(support.getWorldPosition(new Vector3())) : new Vector3(-0.07, -0.13, -0.32)
      if (magHand > 0 && mag) {
        // Hand on the magazine (just below its middle) while it's out of the gun.
        mag.getWorldPosition(_b)
        vm.camera.worldToLocal(_b)
        _b.y -= 0.03
        wristL.lerp(_b, magHand)
      }
      if (chargeHand > 0) {
        // Fingers over the handle from the left, pulling it back toward the face.
        _c.copy(CHARGE_POINT[id])
        _c.z += CHARGE_TRAVEL[id] * chargePull
        _c.x -= 0.045
        _c.y -= 0.01
        wristL.lerp(toCam(_c, _d), chargeHand)
      }
      if (shellHand !== null) {
        // Off the pump to the belt, then for each shell: up to the loading port,
        // thumb it in, back down for the next (back to the pump after the last).
        const port = toCam(_c.set(0, -0.02, -0.06), _d)
        port.y -= 0.03
        port.z += 0.035
        const onPump = _e.copy(wristL)
        if (shellHand < 0) {
          wristL.lerpVectors(onPump, SHELL_BELT, smooth(Math.max(0, 1 + shellHand / a.shellLead)))
          vm.handShell.visible = shellHand > -0.2
        } else {
          const i = Math.floor(shellHand)
          const k = shellHand - i
          const back = i >= (a.shells ?? 1) - 1 ? onPump : SHELL_BELT
          if (k < 0.4) wristL.lerpVectors(SHELL_BELT, port, smooth(k / 0.4))
          else if (k < 0.62) wristL.copy(port).y += 0.018 * Math.sin(((k - 0.4) / 0.22) * Math.PI)
          else wristL.lerpVectors(port, back, smooth((k - 0.62) / 0.38))
          vm.handShell.visible = k < 0.5
        }
      }
      if (rocketHand > 0 && warhead) {
        warhead.localToWorld(_b.set(0, -0.06, -0.6))
        vm.camera.worldToLocal(_b)
        wristL.lerp(_b, rocketHand)
      }
      // Reaching out for the rocket brings the elbow forward with it.
      const elbowL = rocketHand > 0 ? _e.copy(ELBOW_L).lerp(ELBOW_L_REACH, rocketHand) : chargeHand > 0 ? _e.copy(ELBOW_L).lerp(ELBOW_L_CHARGE, chargeHand) : ELBOW_L
      placeArm(vm.armL, wristL, elbowL)
      vm.armL.visible = true
    }
    if (shellHand === null) vm.handShell.visible = false

    // Muzzle flash.
    const muzzle = model.getObjectByName('muzzle')
    const flashing = a.muzzleFlash && id !== 'knife'
    vm.flash.visible = flashing
    if (flashing && muzzle) {
      vm.flash.position.copy(muzzle.position)
      model.localToWorld(vm.flash.position)
      vm.rig.worldToLocal(vm.flash.position)
      // Rig-local units (the rig is scaled by VM_SCALE). A suppressor leaves a faint puff.
      const s = (FLASH_SIZE[id] ?? 0.3) * (a.quiet ? 0.3 : 1) * (0.8 + Math.random() * 0.4)
      vm.flash.scale.setScalar(s)
      vm.flash.material.rotation = Math.random() * Math.PI
    }
    vm.flashLight.intensity = flashing ? (a.quiet ? 0.8 : 6) : 0

    // Optics narrow the viewmodel FOV further so the sight window reads bigger.
    const fov = 62 - (a.att?.optic && a.att.optic !== 'iron' ? 17 : 10) * t
    if (Math.abs(vm.camera.fov - fov) > 0.05) {
      vm.camera.fov = fov
      vm.camera.updateProjectionMatrix()
    }
  })

  return null
}

/**
 * Draws the world, then the viewmodel on top with a fresh depth buffer, then
 * (above Low quality) runs the colour grade over the result.
 */
export function RenderPipeline() {
  const gl = useThree((s) => s.gl)
  const quality = useGameStore((s) => s.settings.quality)
  const samples = quality === 'high' ? 4 : 2
  const grade = useMemo(() => (ColorGrade.supported(gl) ? new ColorGrade({ samples }) : null), [gl, samples])
  useEffect(() => () => grade?.dispose(), [grade])

  useFrame(({ gl: renderer, scene, camera }) => {
    renderer.autoClear = false
    const graded = grade && quality !== 'low'
    // Shader warm-up compiles against whatever target the frame is drawn into.
    runtime.gradeTarget = graded ? grade.target : null
    if (graded) {
      grade.setLook(envFor(activeMapId()).grade)
      grade.begin(renderer)
    }
    else renderer.clear()
    renderer.render(scene, camera)
    const vm = runtime.vm
    if (vm?.visible) {
      renderer.clearDepth()
      renderer.render(vm.scene, vm.camera)
    }
    if (graded) grade.end(renderer)
  }, 1)
  return null
}

export default ViewModel
