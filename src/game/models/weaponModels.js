import {
  AdditiveBlending,
  BufferAttribute,
  CanvasTexture,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  Path,
  PlaneGeometry,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { sanitizeAttachments } from '../../shared/weapons.js'
import { brushedFinish, metalFinish, paintFinish, rubberFinish, stippleFinish, woodFinish } from './weaponTextures.js'

/**
 * Procedural weapon models.
 *
 * Parts are extruded from 2D side profiles (with a small bevel so edges catch the
 * light) plus rounded boxes and cylinders — no model files. Each model honours its
 * attachments (optic, muzzle, magazine). Surfaces use procedural PBR maps
 * (anodised scratches, cerakote, stippled polymer, wood grain, brushed steel).
 *
 * Convention: the barrel points down -Z, the origin sits at the trigger, x+ is
 * the gun's right side, and each model carries named children the animation code
 * looks up:
 *   `muzzle`   — barrel tip (flash + tracer origin; moves with a suppressor)
 *   `sight`    — the point on the sight line the eye lines up with when aiming
 *   `mag`      — the magazine, dropped during reloads
 *   `bolt`     — sniper bolt handle / revolver cylinder
 *   `slide`    — pistol slide (blowback)
 *   `hammer`   — revolver hammer
 *   `eject`    — where spent brass leaves the gun
 *   `leftHand` — where the support hand goes
 *   `grip`     — where the firing hand closes
 *
 * Profiles are written as (u, v) points: u = metres forward of the trigger,
 * v = metres up.
 */

/* ---------------------------------------------------------------------------
 * Materials
 * ------------------------------------------------------------------------- */

const F = {
  metal: metalFinish(),
  paint: paintFinish(),
  stipple: stippleFinish(),
  wood: woodFinish(),
  brushed: brushedFinish(),
  rubber: rubberFinish(),
}

const physical = (opts) => new MeshPhysicalMaterial(opts)

export const weaponMaterials = {
  /** Hard-anodised aluminium (receivers): dark grey, faint scratches, a little clear coat. */
  metal: physical({
    color: '#2f3135',
    metalness: 0.55,
    roughness: 1,
    map: F.metal.map,
    roughnessMap: F.metal.roughnessMap,
    normalMap: F.metal.normalMap,
    normalScale: new Vector2(0.35, 0.35),
    clearcoat: 0.18,
    clearcoatRoughness: 0.45,
  }),
  /** Parkerised steel (barrels, muzzle devices, small parts). */
  metalDark: physical({
    color: '#232528',
    metalness: 0.55,
    roughness: 1.1,
    map: F.metal.map,
    roughnessMap: F.metal.roughnessMap,
    normalMap: F.metal.normalMap,
    normalScale: new Vector2(0.3, 0.3),
  }),
  steel: physical({
    color: '#b5b9be',
    metalness: 0.95,
    roughness: 0.75,
    map: F.brushed.map,
    roughnessMap: F.brushed.roughnessMap,
    normalMap: F.brushed.normalMap,
    normalScale: new Vector2(0.25, 0.25),
  }),
  stainless: physical({
    color: '#9a9fa5',
    metalness: 0.9,
    roughness: 0.95,
    map: F.brushed.map,
    roughnessMap: F.brushed.roughnessMap,
    normalMap: F.brushed.normalMap,
    normalScale: new Vector2(0.3, 0.3),
    clearcoat: 0.2,
    clearcoatRoughness: 0.3,
  }),
  polymer: physical({
    color: '#2b2d31',
    metalness: 0.04,
    roughness: 0.68,
    map: F.stipple.map,
    normalMap: F.stipple.normalMap,
    normalScale: new Vector2(0.55, 0.55),
    clearcoat: 0.08,
    clearcoatRoughness: 0.6,
  }),
  /** Flat dark earth cerakote. */
  tan: physical({
    color: '#977f5b',
    metalness: 0.06,
    roughness: 0.74,
    map: F.paint.map,
    normalMap: F.paint.normalMap,
    normalScale: new Vector2(0.4, 0.4),
  }),
  olive: physical({
    color: '#4c5639',
    metalness: 0.06,
    roughness: 0.72,
    map: F.paint.map,
    normalMap: F.paint.normalMap,
    normalScale: new Vector2(0.4, 0.4),
  }),
  wood: physical({
    color: '#ffffff',
    metalness: 0,
    roughness: 0.48,
    map: F.wood.map,
    normalMap: F.wood.normalMap,
    normalScale: new Vector2(0.4, 0.4),
    clearcoat: 0.55,
    clearcoatRoughness: 0.3,
  }),
  rubber: new MeshStandardMaterial({ color: '#1b1c1d', roughness: 0.95, normalMap: F.rubber.normalMap }),
  brass: new MeshStandardMaterial({ color: '#d6ad57', roughness: 0.26, metalness: 1 }),
  copper: new MeshStandardMaterial({ color: '#b9693c', roughness: 0.3, metalness: 1 }),
  white: new MeshStandardMaterial({ color: '#e8e4d8', roughness: 0.6 }),
  red: new MeshStandardMaterial({ color: '#d23b28', roughness: 0.4, emissive: '#5a0d06', emissiveIntensity: 0.6 }),
  tritium: new MeshBasicMaterial({ color: '#9dff70', toneMapped: false }),
  grey: new MeshStandardMaterial({ color: '#6c6f72', roughness: 0.6, metalness: 0.5 }),
  inset: new MeshStandardMaterial({ color: '#0b0c0d', roughness: 0.9 }),
  lens: new MeshPhysicalMaterial({
    color: '#6b8fa8',
    roughness: 0.05,
    metalness: 0.1,
    transparent: true,
    opacity: 0.28,
    side: DoubleSide,
    depthWrite: false,
  }),
  /** Multi-coated objective glass: deep blue-violet sheen. */
  lensCap: physical({
    color: '#16263d',
    roughness: 0.04,
    metalness: 0.75,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    iridescence: 0.8,
    iridescenceIOR: 1.6,
    emissive: '#0b1626',
    emissiveIntensity: 0.6,
  }),
  /** Reflex-sight glass: barely tinted so the view through it stays clear. */
  reflexLens: new MeshPhysicalMaterial({
    color: '#a9c4d6',
    roughness: 0.02,
    metalness: 0.2,
    transparent: true,
    opacity: 0.14,
    side: DoubleSide,
    depthWrite: false,
  }),
  dot: new MeshBasicMaterial({ color: '#ff2a1a', toneMapped: false }),
  dotGlow: new MeshBasicMaterial({
    color: '#ff3a24',
    transparent: true,
    opacity: 0.35,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }),
}
const M = weaponMaterials

function holoReticleTexture() {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const ctx = c.getContext('2d')
  ctx.strokeStyle = '#ff5530'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.arc(64, 64, 44, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = '#ff5530'
  ctx.beginPath()
  ctx.arc(64, 64, 5, 0, Math.PI * 2)
  ctx.fill()
  for (const [x, y, w, h] of [[62, 6, 4, 14], [62, 108, 4, 14], [6, 62, 14, 4], [108, 62, 14, 4]]) ctx.fillRect(x, y, w, h)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}
const holoReticle = new MeshBasicMaterial({
  map: holoReticleTexture(),
  transparent: true,
  blending: AdditiveBlending,
  depthWrite: false,
  side: DoubleSide,
})

/* ---------------------------------------------------------------------------
 * Geometry helpers
 * ------------------------------------------------------------------------- */

const geoCache = new Map()
const cached = (key, build) => {
  if (!geoCache.has(key)) geoCache.set(key, build())
  return geoCache.get(key)
}

/** Side profile (u forward, v up) extruded `width` across, centred on x = 0. */
function profileGeo(key, points, width, bevel = 0.0035) {
  return cached(`p:${key}`, () => {
    const s = new Shape()
    points.forEach(([u, v], i) => (i ? s.lineTo(u, v) : s.moveTo(u, v)))
    s.closePath()
    const depth = Math.max(0.001, width - bevel * 2)
    const g = new ExtrudeGeometry(s, {
      depth,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 2,
      curveSegments: 4,
    })
    // Shape X (u) -> -Z, extrusion -> X.
    g.rotateY(Math.PI / 2)
    g.translate(-depth / 2, 0, 0)
    g.computeVertexNormals()
    return g
  })
}

function add(group, geo, mat, pos = [0, 0, 0], rot) {
  const m = new Mesh(geo, mat)
  m.position.set(...pos)
  if (rot) m.rotation.set(...rot)
  m.castShadow = true
  group.add(m)
  return m
}

const rbox = (w, h, d, r = 0.004) => cached(`rb:${w}:${h}:${d}:${r}`, () => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)))

/** Rounded box centred at (x, v, -u). */
function box(group, size, u, v, mat, x = 0, rot) {
  return add(group, rbox(...size), mat, [x, v, -u], rot)
}

/** Cylinder lying along the barrel axis, from u0 to u1, centred at height v. */
function tube(group, r, u0, u1, v, mat, segments = 16, rEnd = r, x = 0) {
  const len = Math.abs(u1 - u0)
  const geo = cached(`t:${r}:${rEnd}:${len}:${segments}`, () => {
    const g = new CylinderGeometry(rEnd, r, len, segments)
    g.rotateX(-Math.PI / 2)
    return g
  })
  return add(group, geo, mat, [x, v, -(u0 + u1) / 2])
}

/** Cylinder running across the gun (pins, screws, knobs), centred at (x, v, -u). */
function crossPin(group, r, len, u, v, mat, x = 0, segments = 12) {
  const geo = cached(`x:${r}:${len}:${segments}`, () => new CylinderGeometry(r, r, len, segments).rotateZ(Math.PI / 2))
  return add(group, geo, mat, [x, v, -u])
}

/** Thick-walled open tube along the barrel axis (an optic housing you can see through). */
function ringTube(group, rOut, rIn, u0, u1, v, mat, segments = 24, x = 0) {
  const len = Math.abs(u1 - u0)
  const geo = cached(`ring:${rOut}:${rIn}:${len}:${segments}`, () => {
    const shape = new Shape().absarc(0, 0, rOut, 0, Math.PI * 2, false)
    shape.holes.push(new Path().absarc(0, 0, rIn, 0, Math.PI * 2, true))
    const g = new ExtrudeGeometry(shape, { depth: len, bevelEnabled: false, curveSegments: segments })
    g.translate(0, 0, -len / 2)
    const uv = g.getAttribute('uv')
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, uv.getY(i) * 4)
    return g
  })
  return add(group, geo, mat, [x, v, -(u0 + u1) / 2])
}

function marker(group, name, u, v, x = 0) {
  const o = new Object3D()
  o.name = name
  o.position.set(x, v, -u)
  group.add(o)
  return o
}

/** Picatinny rail with teeth, from u0 to u1, base at height v. */
function rail(group, u0, u1, v, width = 0.022, mat = M.metalDark) {
  box(group, [width, 0.006, u1 - u0], (u0 + u1) / 2, v + 0.003, mat, 0, undefined)
  const teeth = Math.floor((u1 - u0) / 0.011)
  const tooth = cached(`tooth:${width}`, () => new RoundedBoxGeometry(width + 0.004, 0.005, 0.006, 1, 0.001))
  for (let i = 0; i < teeth; i++) add(group, tooth, mat, [0, v + 0.0085, -(u0 + 0.0055 + i * 0.011)])
}

/** A loaded round lying along the barrel axis: brass case + copper bullet. */
function cartridge(group, u, v, x, len = 0.045, r = 0.0048) {
  tube(group, r, u - len * 0.72, u, v, M.brass, 10, r, x)
  tube(group, r * 0.94, u, u + len * 0.12, v, M.brass, 10, r * 0.8, x)
  tube(group, r * 0.8, u + len * 0.12, u + len * 0.3, v, M.copper, 10, r * 0.15, x)
}

/** Grooves (dark insets) evenly spaced along u. */
function grooves(group, count, u0, step, v, size, x = 0) {
  for (let i = 0; i < count; i++) box(group, size, u0 + i * step, v, M.inset, x)
}

/* ---------------------------------------------------------------------------
 * Attachments
 * ------------------------------------------------------------------------- */

/** Mounts an optic on a rail at height `v` (rail top) around `u`; returns the sight-line height. */
function addOptic(group, kind, u, v, small = false) {
  if (kind === 'reddot') {
    if (small) {
      // Pistol-sized open reflex sight: a base and a hooded window frame.
      box(group, [0.03, 0.012, 0.042], u, v + 0.006, M.metal)
      for (const x of [-0.0125, 0.0125]) box(group, [0.005, 0.024, 0.008], u + 0.014, v + 0.022, M.metal, x)
      box(group, [0.03, 0.005, 0.01], u + 0.014, v + 0.0335, M.metal)
      crossPin(group, 0.003, 0.033, u - 0.012, v + 0.008, M.steel)
      const lens = add(group, cached('rmrLens', () => new PlaneGeometry(0.021, 0.017)), M.reflexLens, [0, v + 0.022, -(u + 0.015)])
      lens.rotation.x = 0.12
      add(group, cached('dotS', () => new SphereGeometry(0.0009, 8, 6)), M.dot, [0, v + 0.021, -(u + 0.013)])
      add(group, cached('dotSG', () => new SphereGeometry(0.0018, 8, 6)), M.dotGlow, [0, v + 0.021, -(u + 0.013)])
      return { sightV: v + 0.021, sightU: u - 0.03 }
    }
    // Short, wide tube on a riser, so the window stays big and clear of the barrel.
    const c = v + 0.046
    box(group, [0.03, 0.016, 0.046], u, v + 0.008, M.metalDark)
    box(group, [0.014, 0.024, 0.034], u, v + 0.022, M.metal)
    crossPin(group, 0.0035, 0.036, u + 0.012, v + 0.008, M.steel)
    ringTube(group, 0.0235, 0.0195, u - 0.026, u + 0.026, c, M.metal)
    ringTube(group, 0.0255, 0.0195, u + 0.02, u + 0.034, c, M.metalDark)
    ringTube(group, 0.025, 0.0195, u - 0.032, u - 0.022, c, M.metalDark)
    // Brightness knob and windage turret, each with a knurled ring.
    add(group, cached('knob', () => new CylinderGeometry(0.008, 0.008, 0.01, 16)), M.metalDark, [0.027, c, -u], [0, 0, Math.PI / 2])
    add(group, cached('knobRing', () => new TorusGeometry(0.008, 0.0012, 4, 16)), M.metal, [0.031, c, -u], [0, Math.PI / 2, 0])
    add(group, cached('turret', () => new CylinderGeometry(0.007, 0.007, 0.008, 16)), M.metalDark, [0, c + 0.026, -u])
    const lens = add(group, cached('rdLens', () => new CircleGeometry(0.0196, 24)), M.reflexLens, [0, c, -(u + 0.024)])
    lens.rotation.y = Math.PI
    // The dot sits on the sight line just in front of the eye-side ring.
    add(group, cached('dot', () => new SphereGeometry(0.0008, 8, 6)), M.dot, [0, c, -(u + 0.02)])
    add(group, cached('dotG', () => new SphereGeometry(0.0016, 8, 6)), M.dotGlow, [0, c, -(u + 0.02)])
    return { sightV: c, sightU: u - 0.032 }
  }
  if (kind === 'holo') {
    const c = v + 0.03
    box(group, [0.036, 0.016, 0.075], u, v + 0.008, M.metalDark)
    // Hood: two side walls and a top bar around an open window.
    for (const x of [-0.019, 0.019]) box(group, [0.006, 0.038, 0.05], u + 0.012, c, M.metal, x)
    box(group, [0.044, 0.006, 0.05], u + 0.012, c + 0.02, M.metal)
    // Battery cap and buttons at the back.
    crossPin(group, 0.006, 0.014, u - 0.026, v + 0.012, M.metalDark, 0.022)
    for (const x of [-0.008, 0.008]) box(group, [0.008, 0.004, 0.008], u - 0.03, v + 0.018, M.rubber, x)
    const glass = add(group, cached('holoGlass', () => new PlaneGeometry(0.032, 0.03)), M.lens, [0, c, -(u + 0.03)])
    glass.renderOrder = 2
    const ret = add(group, cached('holoRet', () => new PlaneGeometry(0.02, 0.02)), holoReticle, [0, c, -(u + 0.031)])
    ret.renderOrder = 3
    return { sightV: c, sightU: u - 0.06 }
  }
  return null
}

/** Muzzle device from `u` forward at height `v`. Returns the new muzzle tip. */
function addMuzzle(group, kind, u, v, r) {
  if (kind === 'suppressor') {
    const len = r > 0.015 ? 0.2 : 0.14
    tube(group, r * 2.0, u + 0.012, u + len - 0.012, v, M.metalDark, 24)
    tube(group, r * 2.15, u, u + 0.012, v, M.metal, 24)
    tube(group, r * 2.15, u + len - 0.012, u + len, v, M.metal, 24)
    // Machined rings and a front cap bore.
    for (let i = 1; i < 4; i++) tube(group, r * 2.05, u + (len * i) / 4 - 0.002, u + (len * i) / 4 + 0.002, v, M.metal, 24)
    tube(group, r * 0.9, u + len, u + len + 0.001, v, M.inset, 12)
    return u + len
  }
  if (kind === 'compensator') {
    const len = r > 0.015 ? 0.07 : 0.05
    box(group, [r * 2.6, r * 2.6, len], u + len / 2, v, M.metal)
    // Gas ports on top and the sides.
    for (let i = 0; i < 3; i++) {
      box(group, [r * 1.6, 0.004, 0.008], u + 0.012 + i * (len / 3.4), v + r * 1.31, M.inset)
      for (const x of [-1, 1]) box(group, [0.004, r * 1.2, 0.008], u + 0.012 + i * (len / 3.4), v, M.inset, x * r * 1.31)
    }
    return u + len
  }
  if (kind === 'brake') {
    // Big side-ported brake for the sniper.
    const len = 0.085
    box(group, [r * 3.1, r * 2.5, len], u + len / 2, v, M.metalDark)
    for (let i = 0; i < 3; i++) {
      for (const x of [-1, 1]) box(group, [0.006, r * 1.7, 0.012], u + 0.016 + i * 0.024, v, M.inset, x * r * 1.53)
    }
    tube(group, r * 0.8, u + len, u + len + 0.001, v, M.inset, 12)
    return u + len
  }
  // Pistols have a plain crown.
  if (kind === 'none-pistol') return u
  // Standard birdcage flash hider: slotted cylinder.
  tube(group, r * 1.45, u, u + 0.055, v, M.metalDark, 16)
  tube(group, r * 1.55, u, u + 0.008, v, M.metalDark, 16)
  for (const a of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4, Math.PI / 2]) {
    box(group, [0.0035, 0.0035, 0.032], u + 0.033, v + Math.sin(a) * r * 1.42, M.inset, Math.cos(a) * r * 1.42)
  }
  tube(group, r * 0.85, u + 0.055, u + 0.056, v, M.inset, 12)
  return u + 0.055
}

/* ---------------------------------------------------------------------------
 * Weapons
 * ------------------------------------------------------------------------- */

function buildAR(att) {
  const g = new Group()
  // Lower receiver with flared magwell.
  add(g, profileGeo('arLower', [[-0.07, 0.035], [0.17, 0.035], [0.17, -0.005], [0.137, -0.03], [0.137, -0.072], [0.033, -0.072], [0.035, -0.03], [-0.07, -0.025]], 0.052), M.metal)
  box(g, [0.058, 0.01, 0.108], 0.085, -0.068, M.metal) // magwell flare
  // Pins, selector, bolt catch, mag release.
  for (const u of [-0.055, 0.152]) {
    crossPin(g, 0.0042, 0.058, u, 0.022, M.metalDark)
    crossPin(g, 0.0026, 0.06, u, 0.022, M.steel)
  }
  for (const x of [-1, 1]) {
    crossPin(g, 0.0075, 0.004, -0.035, 0.012, M.metalDark, x * 0.028)
    box(g, [0.004, 0.006, 0.026], -0.045, 0.016, M.metalDark, x * 0.031, [0.5, 0, 0])
  }
  box(g, [0.004, 0.026, 0.012], 0.112, 0.01, M.metalDark, -0.028) // bolt catch (left)
  crossPin(g, 0.0062, 0.006, 0.12, -0.006, M.metalDark, 0.028) // mag release (right)
  box(g, [0.004, 0.018, 0.022], 0.12, -0.006, M.metal, 0.031) // its fence
  // Upper receiver, dust cover, brass deflector, forward assist, charging handle.
  add(g, profileGeo('arUpper', [[-0.15, 0.035], [0.27, 0.035], [0.27, 0.085], [-0.13, 0.085], [-0.15, 0.072]], 0.058), M.metal)
  box(g, [0.004, 0.022, 0.062], 0.08, 0.058, M.inset, 0.03) // ejection port
  box(g, [0.002, 0.024, 0.064], 0.082, 0.042, M.metalDark, 0.0335, [0, 0, -0.9]) // dust cover, swung open
  box(g, [0.012, 0.018, 0.022], 0.025, 0.067, M.metal, 0.034, [0, 0.35, 0]) // brass deflector
  add(g, cached('fa', () => new CylinderGeometry(0.0085, 0.0085, 0.024, 14)), M.metalDark, [0.031, 0.066, 0.02], [Math.PI / 2, 0, 0])
  crossPin(g, 0.009, 0.006, -0.008, 0.066, M.metal, 0.031)
  box(g, [0.05, 0.008, 0.025], -0.135, 0.09, M.metalDark) // charging handle
  box(g, [0.014, 0.007, 0.016], -0.132, 0.09, M.metalDark, -0.03) // latch
  rail(g, -0.13, 0.27, 0.085)
  // Handguard (FDE) with M-LOK slots on the sides and underneath, an end cap and a QD cup.
  add(g, profileGeo('arHand', [[0.27, 0.0], [0.58, 0.0], [0.58, 0.083], [0.27, 0.083]], 0.066, 0.008), M.tan)
  for (let i = 0; i < 5; i++) {
    for (const x of [-0.034, 0.034]) box(g, [0.004, 0.016, 0.035], 0.31 + i * 0.054, 0.042, M.inset, x)
    box(g, [0.016, 0.004, 0.035], 0.31 + i * 0.054, -0.0015, M.inset)
  }
  box(g, [0.07, 0.087, 0.012], 0.578, 0.0415, M.metalDark)
  crossPin(g, 0.007, 0.006, 0.52, 0.02, M.metal, -0.034)
  crossPin(g, 0.0035, 0.007, 0.52, 0.02, M.inset, -0.035)
  rail(g, 0.28, 0.57, 0.083)
  // Barrel (stepped profile), low-profile gas block with its pins.
  tube(g, 0.0108, 0.584, 0.66, 0.045, M.metalDark, 16)
  tube(g, 0.0092, 0.66, 0.76, 0.045, M.metalDark, 16)
  box(g, [0.028, 0.03, 0.03], 0.625, 0.047, M.metal)
  for (const u of [0.617, 0.633]) crossPin(g, 0.002, 0.03, u, 0.058, M.steel)
  // Pistol grip with a beavertail, trigger guard, curved trigger.
  add(g, profileGeo('arGrip', [[-0.018, -0.022], [0.042, -0.025], [0.008, -0.135], [-0.045, -0.13], [-0.03, -0.06], [-0.032, -0.03]], 0.034, 0.006), M.tan)
  add(g, profileGeo('arGuard', [[0.0, -0.028], [0.075, -0.028], [0.075, -0.034], [0.006, -0.06], [0.0, -0.06]], 0.006, 0.001), M.metalDark)
  add(g, profileGeo('arTrig', [[0.026, -0.026], [0.036, -0.026], [0.035, -0.04], [0.03, -0.054], [0.026, -0.05], [0.03, -0.04]], 0.006, 0.0008), M.steel)
  // Stock: buffer tube, castle nut, body with sling slot, QD cup, latch, butt pad.
  tube(g, 0.016, -0.32, -0.13, 0.05, M.metalDark)
  tube(g, 0.0195, -0.142, -0.13, 0.05, M.metal, 8)
  add(g, profileGeo('arStock', [[-0.4, -0.045], [-0.25, 0.012], [-0.22, 0.04], [-0.22, 0.072], [-0.4, 0.072]], 0.05, 0.008), M.tan)
  box(g, [0.052, 0.012, 0.03], -0.36, 0.035, M.inset) // sling slot
  crossPin(g, 0.0065, 0.004, -0.3, 0.01, M.metal, -0.026)
  box(g, [0.012, 0.012, 0.05], -0.27, -0.0, M.metalDark, 0, [0.4, 0, 0]) // adjustment latch
  box(g, [0.054, 0.125, 0.016], -0.405, 0.012, M.rubber)
  // Magazine: ribbed polymer body, baseplate, rounds showing at the feed lips.
  const mag = new Group()
  mag.name = 'mag'
  const ext = att.mag === 'extended'
  const magPts = ext
    ? [[0.04, -0.03], [0.13, -0.03], [0.165, -0.15], [0.2, -0.27], [0.11, -0.28], [0.08, -0.16]]
    : [[0.04, -0.03], [0.13, -0.03], [0.155, -0.12], [0.18, -0.19], [0.095, -0.2], [0.07, -0.12]]
  add(mag, profileGeo(ext ? 'arMagX' : 'arMag', magPts, 0.034, 0.005), M.polymer)
  // Grip ribs across the lower half, following the curve.
  const ribs = ext ? [[0.112, -0.17], [0.125, -0.2], [0.138, -0.23]] : [[0.1, -0.13], [0.11, -0.155], [0.122, -0.18]]
  for (const [u, v] of ribs) box(mag, [0.038, 0.005, 0.07], u + 0.02, v, M.polymer, 0, [-0.33, 0, 0])
  box(mag, [0.04, 0.012, 0.09], ext ? 0.155 : 0.137, ext ? -0.278 : -0.198, M.polymer, 0, [ext ? -0.35 : -0.3, 0, 0])
  cartridge(mag, 0.11, -0.026, 0.0035)
  cartridge(mag, 0.104, -0.033, -0.0035)
  g.add(mag)

  // Sights: optic, or folding irons.
  const optic = addOptic(g, att.optic, 0.04, 0.094)
  if (optic) {
    marker(g, 'sight', optic.sightU, optic.sightV)
  } else {
    // Rear aperture + front post on the handguard rail.
    box(g, [0.03, 0.03, 0.012], -0.1, 0.108, M.metalDark)
    add(g, cached('aperture', () => new TorusGeometry(0.006, 0.0022, 8, 16)), M.metalDark, [0, 0.128, 0.1])
    box(g, [0.026, 0.03, 0.012], 0.54, 0.108, M.metalDark)
    box(g, [0.0035, 0.024, 0.0035], 0.54, 0.124, M.metalDark)
    marker(g, 'sight', -0.13, 0.128)
  }
  const tip = addMuzzle(g, att.muzzle, 0.76, 0.045, 0.0092)
  marker(g, 'muzzle', tip + 0.01, 0.045)
  marker(g, 'leftHand', 0.45, -0.005)
  marker(g, 'eject', 0.075, 0.06, 0.036)
  return g
}

function buildSniper(att) {
  const g = new Group()
  // Chassis (olive) with thumbhole stock and cheek riser.
  add(g, profileGeo('snChassis', [
    [-0.58, -0.07], [-0.47, -0.04], [-0.2, -0.03], [-0.16, -0.06], [-0.1, -0.06], [-0.05, 0.0],
    [0.45, 0.0], [0.45, 0.045], [-0.05, 0.045], [-0.2, 0.06], [-0.4, 0.085], [-0.58, 0.085],
  ], 0.06, 0.008), M.olive)
  // Vent cuts in the forend.
  for (let i = 0; i < 4; i++) for (const x of [-0.0305, 0.0305]) box(g, [0.004, 0.016, 0.05], 0.12 + i * 0.075, 0.022, M.inset, x)
  box(g, [0.05, 0.03, 0.18], -0.48, 0.098, M.olive) // cheek riser
  crossPin(g, 0.008, 0.012, -0.42, 0.075, M.metalDark, -0.034) // its adjuster
  box(g, [0.066, 0.17, 0.02], -0.59, 0.008, M.rubber) // butt pad
  crossPin(g, 0.007, 0.004, -0.5, 0.0, M.metal, -0.031) // QD cup
  // Pistol grip, guard, trigger.
  add(g, profileGeo('snGrip', [[-0.02, -0.02], [0.035, -0.02], [0.005, -0.13], [-0.05, -0.12]], 0.034, 0.006), M.polymer)
  add(g, profileGeo('snGuard', [[0.0, -0.022], [0.07, -0.022], [0.07, -0.028], [0.006, -0.055], [0.0, -0.055]], 0.006, 0.001), M.metalDark)
  add(g, profileGeo('snTrig', [[0.025, -0.022], [0.034, -0.022], [0.033, -0.036], [0.028, -0.048], [0.025, -0.044]], 0.006, 0.0008), M.steel)
  // Round action, recoil lug, bolt shroud.
  tube(g, 0.026, -0.08, 0.2, 0.065, M.metal, 24)
  tube(g, 0.02, -0.1, -0.08, 0.065, M.metalDark, 16)
  box(g, [0.004, 0.02, 0.07], 0.06, 0.07, M.inset, 0.026)
  const bolt = new Group()
  bolt.name = 'bolt'
  bolt.position.set(0.03, 0.07, 0.06)
  const handle = new Mesh(cached('boltH', () => new CylinderGeometry(0.006, 0.006, 0.07, 10)), M.steel)
  handle.rotation.z = Math.PI / 2
  handle.position.x = 0.032
  bolt.add(handle)
  const knob = new Mesh(cached('boltK', () => new SphereGeometry(0.013, 16, 12)), M.metalDark)
  knob.position.x = 0.068
  knob.scale.set(1, 1, 1.25)
  bolt.add(knob)
  g.add(bolt)
  // Heavy fluted barrel.
  tube(g, 0.019, 0.2, 0.92, 0.055, M.metalDark, 20, 0.016)
  for (const a of [0.6, -0.6, Math.PI / 2, Math.PI - 0.6, Math.PI + 0.6]) {
    box(g, [0.004, 0.004, 0.42], 0.6, 0.055 + Math.sin(a) * 0.0175, M.inset, Math.cos(a) * 0.0175)
  }
  rail(g, -0.1, 0.2, 0.09, 0.024)
  // Scope: rings with cap screws, tube, bells, knurled turrets, parallax knob, coated glass.
  for (const u of [-0.02, 0.15]) {
    box(g, [0.034, 0.036, 0.02], u, 0.11, M.metalDark)
    for (const x of [-0.019, 0.019]) crossPin(g, 0.0028, 0.004, u, 0.128, M.steel, x)
  }
  const sv = 0.135
  tube(g, 0.017, -0.06, 0.24, sv, M.metal, 24)
  tube(g, 0.024, -0.12, -0.05, sv, M.metal, 24, 0.019)
  tube(g, 0.024, 0.24, 0.34, sv, M.metal, 24, 0.032)
  tube(g, 0.0335, 0.33, 0.345, sv, M.metalDark, 24)
  tube(g, 0.025, -0.13, -0.115, sv, M.rubber, 24)
  add(g, cached('turretT', () => new CylinderGeometry(0.013, 0.013, 0.024, 20)), M.metalDark, [0, sv + 0.028, -0.08])
  add(g, cached('turretS', () => new CylinderGeometry(0.013, 0.013, 0.024, 20)), M.metalDark, [0.028, sv, -0.08], [0, 0, Math.PI / 2])
  for (let i = 0; i < 3; i++) {
    add(g, cached('knurl', () => new TorusGeometry(0.0132, 0.0011, 4, 20)), M.metal, [0, sv + 0.022 + i * 0.005, -0.08], [Math.PI / 2, 0, 0])
    add(g, cached('knurl', () => new TorusGeometry(0.0132, 0.0011, 4, 20)), M.metal, [0.022 + i * 0.005, sv, -0.08], [0, Math.PI / 2, 0])
  }
  add(g, cached('parallax', () => new CylinderGeometry(0.011, 0.011, 0.016, 20)), M.metalDark, [-0.024, sv, -0.08], [0, 0, Math.PI / 2])
  const front = add(g, cached('scopeF', () => new CylinderGeometry(0.029, 0.029, 0.002, 24)), M.lensCap, [0, sv, -0.341])
  front.rotation.x = Math.PI / 2
  const back = add(g, cached('scopeB', () => new CylinderGeometry(0.021, 0.021, 0.002, 24)), M.lensCap, [0, sv, 0.121])
  back.rotation.x = Math.PI / 2
  marker(g, 'sight', -0.16, sv)
  // Folded bipod under the forend.
  box(g, [0.04, 0.016, 0.03], 0.42, -0.008, M.metalDark)
  for (const x of [-0.016, 0.016]) {
    box(g, [0.008, 0.008, 0.22], 0.31, -0.012, M.metalDark, x)
    box(g, [0.012, 0.01, 0.016], 0.2, -0.012, M.rubber, x)
  }
  // Magazine with rounds on top.
  const mag = new Group()
  mag.name = 'mag'
  const ext = att.mag === 'extended'
  box(mag, [0.05, ext ? 0.12 : 0.08, 0.1], 0.07, ext ? -0.06 : -0.04, M.metalDark)
  box(mag, [0.054, 0.01, 0.104], 0.07, ext ? -0.123 : -0.083, M.polymer)
  cartridge(mag, 0.11, 0.002, 0.0, 0.07, 0.0065)
  g.add(mag)
  const tip = addMuzzle(g, att.muzzle === 'suppressor' ? 'suppressor' : 'brake', 0.92, 0.055, 0.016)
  marker(g, 'muzzle', tip + 0.01, 0.055)
  marker(g, 'leftHand', 0.32, -0.01)
  marker(g, 'eject', 0.06, 0.08, 0.03)
  return g
}

function buildPistol(att) {
  const g = new Group()
  // Slide (its own group so it can blow back): tapered nose, front and rear
  // serrations, ejection port with the barrel hood showing, sights or an optic.
  const slide = new Group()
  slide.name = 'slide'
  g.add(slide)
  add(slide, profileGeo('p9Slide', [[-0.075, 0.02], [0.13, 0.02], [0.135, 0.04], [0.125, 0.056], [-0.07, 0.056], [-0.078, 0.045]], 0.03, 0.004), M.metal)
  for (let i = 0; i < 7; i++) box(slide, [0.032, 0.026, 0.0025], -0.062 + i * 0.007, 0.038, M.inset)
  for (let i = 0; i < 4; i++) box(slide, [0.032, 0.022, 0.0025], 0.088 + i * 0.007, 0.036, M.inset)
  box(slide, [0.004, 0.014, 0.04], 0.02, 0.042, M.inset, 0.015) // ejection port
  box(slide, [0.002, 0.012, 0.036], 0.02, 0.043, M.steel, 0.0148) // barrel hood
  tube(slide, 0.0075, 0.124, 0.137, 0.035, M.steel, 14) // barrel crown
  tube(slide, 0.0042, 0.1345, 0.1375, 0.035, M.inset, 12) // bore
  tube(slide, 0.0045, 0.128, 0.134, 0.024, M.metalDark, 10) // guide rod
  // Polymer frame: dust cover with a short accessory rail, slide stop, takedown lever.
  add(g, profileGeo('p9Frame', [[-0.06, 0.02], [0.125, 0.02], [0.125, 0.0], [0.07, -0.004], [0.06, 0.0], [-0.03, 0.0]], 0.028, 0.004), M.polymer)
  for (let i = 0; i < 3; i++) box(g, [0.022, 0.004, 0.005], 0.085 + i * 0.012, -0.001, M.polymer)
  box(g, [0.004, 0.006, 0.03], 0.04, 0.016, M.metalDark, -0.0155) // slide stop (left)
  box(g, [0.004, 0.008, 0.008], 0.06, 0.013, M.metalDark, -0.0155) // takedown lever
  add(g, profileGeo('p9Guard', [[0.0, 0.0], [0.07, 0.0], [0.07, -0.006], [0.012, -0.036], [0.0, -0.036]], 0.008, 0.002), M.polymer)
  add(g, profileGeo('p9Grip', [[-0.035, 0.002], [0.012, 0.002], [-0.01, -0.105], [-0.058, -0.1], [-0.05, -0.05], [-0.06, 0.0]], 0.03, 0.006), M.polymer)
  box(g, [0.006, 0.02, 0.006], 0.025, -0.012, M.steel) // trigger
  box(g, [0.0025, 0.012, 0.004], 0.0255, -0.012, M.metalDark) // trigger safety blade
  const mag = new Group()
  mag.name = 'mag'
  const ext = att.mag === 'extended'
  box(mag, [0.032, ext ? 0.03 : 0.012, 0.042], -0.03, ext ? -0.118 : -0.108, M.metalDark, 0, [-0.21, 0, 0])
  cartridge(mag, -0.012, 0.0, 0, 0.026, 0.0045)
  g.add(mag)
  const optic = addOptic(slide, att.optic, -0.03, 0.056, true)
  if (optic) {
    marker(g, 'sight', optic.sightU, optic.sightV)
  } else {
    // Night sights: tritium dots that glow green.
    box(slide, [0.006, 0.01, 0.006], 0.115, 0.061, M.metalDark)
    box(slide, [0.024, 0.01, 0.008], -0.06, 0.061, M.metalDark)
    add(slide, cached('trit', () => new SphereGeometry(0.0016, 8, 6)), M.tritium, [0, 0.0645, -0.112])
    for (const x of [-0.007, 0.007]) add(slide, cached('trit', () => new SphereGeometry(0.0016, 8, 6)), M.tritium, [x, 0.0635, 0.064])
    marker(g, 'sight', -0.09, 0.064)
  }
  const tip = addMuzzle(g, att.muzzle === 'suppressor' ? 'suppressor' : 'none-pistol', 0.138, 0.035, 0.0085)
  marker(g, 'muzzle', tip + 0.005, 0.035)
  marker(g, 'leftHand', -0.02, -0.055)
  marker(g, 'eject', 0.02, 0.055, 0.016)
  return g
}

function buildViper(att) {
  const g = new Group()
  // Frame (stainless), heavy barrel with a vented top rib, ejector rod shroud.
  add(g, profileGeo('vFrame', [[-0.06, 0.0], [0.07, 0.0], [0.07, 0.058], [-0.03, 0.058], [-0.065, 0.04]], 0.03, 0.004), M.stainless)
  tube(g, 0.012, 0.07, 0.25, 0.04, M.stainless, 20)
  box(g, [0.014, 0.012, 0.18], 0.16, 0.056, M.stainless)
  grooves(g, 5, 0.1, 0.03, 0.0625, [0.008, 0.002, 0.016])
  box(g, [0.016, 0.022, 0.16], 0.165, 0.025, M.stainless) // ejector shroud
  tube(g, 0.0042, 0.07, 0.2, 0.012, M.steel, 10) // ejector rod
  tube(g, 0.0062, 0.248, 0.251, 0.04, M.inset, 12) // bore
  crossPin(g, 0.0035, 0.032, -0.045, 0.045, M.steel) // frame screw heads
  crossPin(g, 0.0035, 0.032, 0.05, 0.012, M.steel)
  // Cylinder: fluted, with chamber mouths on the face (its own group so it turns).
  const drum = new Group()
  drum.name = 'bolt'
  drum.position.set(0, 0.032, -0.02)
  const cyl = new Mesh(cached('vDrum', () => new CylinderGeometry(0.026, 0.026, 0.06, 30).rotateX(Math.PI / 2)), M.stainless)
  cyl.castShadow = true
  drum.add(cyl)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6
    const flute = new Mesh(rbox(0.006, 0.004, 0.044, 0.0015), M.inset)
    flute.position.set(Math.cos(a) * 0.0255, Math.sin(a) * 0.0255, 0)
    flute.rotation.z = a + Math.PI / 2
    drum.add(flute)
    const mouth = new Mesh(cached('vMouth', () => new CircleGeometry(0.0055, 12)), M.inset)
    mouth.position.set(Math.cos(a - Math.PI / 6) * 0.016, Math.sin(a - Math.PI / 6) * 0.016, -0.0301)
    mouth.rotation.y = Math.PI
    drum.add(mouth)
  }
  g.add(drum)
  // Hammer (own group for cocking), guard, trigger, wood grip with a medallion.
  const hammer = new Group()
  hammer.name = 'hammer'
  hammer.position.set(0, 0.052, 0.062)
  box(hammer, [0.01, 0.022, 0.012], 0, 0.006, M.metalDark, 0, [0.4, 0, 0])
  box(hammer, [0.012, 0.004, 0.012], 0.006, 0.019, M.metalDark, 0, [0.2, 0, 0])
  g.add(hammer)
  add(g, profileGeo('vGuard', [[-0.005, 0.0], [0.055, 0.0], [0.055, -0.006], [0.008, -0.034], [-0.005, -0.034]], 0.007, 0.002), M.stainless)
  box(g, [0.004, 0.02, 0.005], 0.02, -0.012, M.steel)
  add(g, profileGeo('vGrip', [[-0.06, 0.004], [-0.015, 0.004], [-0.035, -0.105], [-0.088, -0.095]], 0.034, 0.008), M.wood)
  for (const x of [-1, 1]) {
    crossPin(g, 0.007, 0.002, -0.05, -0.04, M.brass, x * 0.0175)
  }
  const mag = new Group()
  mag.name = 'mag'
  g.add(mag)
  const optic = addOptic(g, att.optic, 0.12, 0.062, true)
  if (optic) {
    marker(g, 'sight', optic.sightU, optic.sightV)
  } else {
    box(g, [0.004, 0.012, 0.012], 0.24, 0.066, M.metalDark)
    box(g, [0.0042, 0.004, 0.004], 0.236, 0.07, M.red) // red ramp insert
    box(g, [0.02, 0.008, 0.008], -0.04, 0.064, M.metalDark)
    marker(g, 'sight', -0.07, 0.069)
  }
  const tip = addMuzzle(g, att.muzzle === 'compensator' ? 'compensator' : 'none-pistol', 0.25, 0.04, 0.012)
  marker(g, 'muzzle', tip + 0.005, 0.04)
  marker(g, 'leftHand', -0.035, -0.055)
  return g
}

function buildHornet(att) {
  const g = new Group()
  // Boxy upper with a top rail and machined ribs, lower with a vertical fore-grip.
  add(g, profileGeo('hUpper', [[-0.09, 0.02], [0.15, 0.02], [0.15, 0.066], [-0.07, 0.066], [-0.09, 0.05]], 0.034, 0.004), M.metalDark)
  for (let i = 0; i < 4; i++) for (const x of [-0.0172, 0.0172]) box(g, [0.002, 0.03, 0.004], 0.075 + i * 0.016, 0.043, M.inset, x)
  box(g, [0.004, 0.016, 0.05], 0.03, 0.045, M.inset, 0.017)
  box(g, [0.012, 0.008, 0.016], -0.085, 0.058, M.metal, -0.018) // charging handle
  rail(g, -0.07, 0.14, 0.066, 0.018)
  add(g, profileGeo('hLower', [[-0.06, 0.02], [0.15, 0.02], [0.15, -0.004], [0.06, -0.004], [-0.03, 0.0]], 0.03, 0.004), M.polymer)
  box(g, [0.024, 0.07, 0.03], 0.12, -0.04, M.polymer, 0, [0.12, 0, 0]) // fore-grip
  for (let i = 0; i < 4; i++) box(g, [0.026, 0.003, 0.032], 0.121 + i * 0.002, -0.02 - i * 0.014, M.inset, 0, [0.12, 0, 0])
  add(g, profileGeo('hGuard', [[0.0, 0.0], [0.06, 0.0], [0.06, -0.006], [0.01, -0.034], [0.0, -0.034]], 0.007, 0.002), M.polymer)
  box(g, [0.004, 0.016, 0.005], 0.022, -0.012, M.steel)
  add(g, profileGeo('hGrip', [[-0.035, 0.002], [0.012, 0.002], [-0.008, -0.1], [-0.055, -0.095]], 0.03, 0.005), M.polymer)
  for (const x of [-1, 1]) crossPin(g, 0.006, 0.004, -0.02, 0.008, M.metalDark, x * 0.016) // selector
  // Folded wire stock.
  for (const x of [-0.012, 0.012]) box(g, [0.005, 0.005, 0.12], -0.13, 0.03, M.metalDark, x)
  box(g, [0.03, 0.04, 0.006], -0.19, 0.02, M.rubber)
  tube(g, 0.0075, 0.15, 0.19, 0.04, M.metalDark, 12)
  const mag = new Group()
  mag.name = 'mag'
  const ext = att.mag === 'extended'
  box(mag, [0.026, ext ? 0.17 : 0.1, 0.036], -0.025, ext ? -0.15 : -0.115, M.metalDark, 0, [-0.2, 0, 0])
  cartridge(mag, -0.01, -0.006, 0, 0.026, 0.004)
  g.add(mag)
  const optic = addOptic(g, att.optic, 0.0, 0.075, true)
  if (optic) {
    marker(g, 'sight', optic.sightU, optic.sightV)
  } else {
    box(g, [0.004, 0.014, 0.006], 0.13, 0.082, M.metalDark)
    box(g, [0.022, 0.012, 0.008], -0.06, 0.081, M.metalDark)
    marker(g, 'sight', -0.08, 0.087)
  }
  const tip = addMuzzle(g, att.muzzle === 'suppressor' ? 'suppressor' : 'none-pistol', 0.19, 0.04, 0.0085)
  marker(g, 'muzzle', tip + 0.005, 0.04)
  marker(g, 'leftHand', 0.12, -0.07)
  marker(g, 'eject', 0.03, 0.05, 0.018)
  return g
}

function buildKnife() {
  const g = new Group()
  // Big clip-point combat knife (~34 cm). Blade: black-coated, with a bright
  // ground edge, a fuller groove and saw teeth along the spine.
  add(g, profileGeo('kBlade2', [[0.006, -0.012], [0.19, -0.012], [0.235, -0.002], [0.255, 0.006], [0.2, 0.012], [0.165, 0.024], [0.006, 0.024]], 0.006, 0.0012), M.metalDark)
  add(g, profileGeo('kEdge2', [[0.006, -0.021], [0.19, -0.021], [0.255, 0.006], [0.235, -0.002], [0.19, -0.012], [0.006, -0.012]], 0.0036, 0.0006), M.steel)
  add(g, profileGeo('kClip', [[0.165, 0.024], [0.2, 0.012], [0.255, 0.006], [0.2, 0.0155], [0.17, 0.026]], 0.0034, 0.0005), M.steel)
  for (const x of [-1, 1]) box(g, [0.0012, 0.006, 0.13], 0.095, 0.011, M.inset, x * 0.0031) // fuller
  for (let i = 0; i < 7; i++) box(g, [0.0055, 0.006, 0.006], 0.025 + i * 0.009, 0.027, M.metalDark, 0, [Math.PI / 4, 0, 0]) // saw teeth
  // Guard, ribbed grip, steel pommel with a lanyard hole.
  box(g, [0.014, 0.07, 0.012], 0.0, 0.004, M.metalDark)
  box(g, [0.018, 0.012, 0.016], 0.0, 0.036, M.steel)
  box(g, [0.018, 0.012, 0.016], 0.0, -0.028, M.steel)
  tube(g, 0.016, -0.125, -0.006, 0.002, M.rubber, 14, 0.0145)
  for (let i = 0; i < 6; i++) tube(g, 0.0172, -0.112 + i * 0.019, -0.106 + i * 0.019, 0.002, M.polymer, 14)
  tube(g, 0.0165, -0.145, -0.125, 0.002, M.steel, 14, 0.012)
  add(g, cached('lanyard', () => new TorusGeometry(0.006, 0.002, 6, 14)), M.steel, [0, 0.002, 0.152], [0, Math.PI / 2, 0])
  marker(g, 'muzzle', 0.255, 0.006)
  marker(g, 'tip', 0.25, 0.004)
  marker(g, 'mid', 0.1, 0.004)
  marker(g, 'sight', -0.1, 0.03)
  return g
}

function buildFrag() {
  const g = new Group()
  const body = new Mesh(cached('fragBody', () => new IcosahedronGeometry(0.038, 2)), M.olive)
  body.scale.set(1, 1.18, 1)
  body.castShadow = true
  g.add(body)
  box(g, [0.02, 0.025, 0.02], 0, 0.048, M.metalDark)
  box(g, [0.01, 0.07, 0.016], 0, 0.03, M.grey, 0.022, [0, 0, -0.25])
  add(g, cached('pinRing', () => new TorusGeometry(0.012, 0.0025, 6, 14)), M.steel, [-0.016, 0.062, 0])
  return g
}

function buildCanister(mat, band) {
  const g = new Group()
  const body = new Mesh(cached('canister', () => new CylinderGeometry(0.026, 0.026, 0.11, 18)), mat)
  body.castShadow = true
  g.add(body)
  const b = new Mesh(cached('canBand', () => new CylinderGeometry(0.0265, 0.0265, 0.018, 18)), band)
  b.position.y = 0.02
  g.add(b)
  box(g, [0.018, 0.02, 0.018], 0, 0.062, M.grey)
  return g
}

const BUILDERS = {
  ar: buildAR,
  sniper: buildSniper,
  pistol: buildPistol,
  viper: buildViper,
  hornet: buildHornet,
  knife: buildKnife,
  frag: buildFrag,
  flash: () => buildCanister(M.grey, M.white),
  smoke: () => buildCanister(M.olive, M.white),
}

/** Where the firing hand closes on each weapon (u along the barrel, v height). */
const GRIPS = {
  ar: [-0.005, -0.08],
  sniper: [-0.01, -0.075],
  pistol: [-0.023, -0.05],
  viper: [-0.05, -0.05],
  hornet: [-0.02, -0.048],
  knife: [-0.065, 0.002],
}

/* ---------------------------------------------------------------------------
 * Batching + instancing
 * ------------------------------------------------------------------------- */

const KEEP = ['position', 'normal', 'uv']

/**
 * Merges the gun's static parts into one mesh per material. A detailed gun is
 * ~150 little meshes; merged it's a dozen draw calls, which matters with eight
 * players on screen. Moving parts (named groups) and see-through parts stay as
 * they are.
 */
function mergeStatics(root) {
  const buckets = new Map()
  for (const child of [...root.children]) {
    if (!child.isMesh || child.material.transparent || child.material.isMeshBasicMaterial) continue
    if (!buckets.has(child.material)) buckets.set(child.material, [])
    buckets.get(child.material).push(child)
  }
  for (const [material, meshes] of buckets) {
    if (meshes.length < 2) continue
    const geos = meshes.map((m) => {
      m.updateMatrix()
      let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()
      g.applyMatrix4(m.matrix)
      for (const name of Object.keys(g.attributes)) if (!KEEP.includes(name)) g.deleteAttribute(name)
      if (!g.getAttribute('uv')) g.setAttribute('uv', new BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2))
      g.clearGroups()
      return g
    })
    const merged = mergeGeometries(geos, false)
    geos.forEach((g) => g.dispose())
    if (!merged) continue
    const mesh = new Mesh(merged, material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    for (const m of meshes) root.remove(m)
    root.add(mesh)
  }
}

const templates = new Map()

/**
 * Model instance for a weapon/equipment id with its attachments fitted. Each
 * combination is built and merged once; callers get a cheap clone that shares
 * geometry and materials.
 */
export function createWeaponModel(id, att) {
  const a = sanitizeAttachments(id, att)
  const key = `${id}|${a.optic ?? ''}|${a.muzzle ?? ''}|${a.mag ?? ''}`
  if (!templates.has(key)) {
    const build = BUILDERS[id] ?? BUILDERS.ar
    const model = build(a)
    model.userData.weaponId = id
    if (GRIPS[id]) marker(model, 'grip', GRIPS[id][0], GRIPS[id][1])
    mergeStatics(model)
    // Moving parts (slide, mag, bolt...) move as one piece, so batch inside them too.
    for (const child of model.children) if (child.isGroup) mergeStatics(child)
    templates.set(key, model)
  }
  return templates.get(key).clone(true)
}
