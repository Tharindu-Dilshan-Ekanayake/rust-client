import {
  AdditiveBlending,
  CanvasTexture,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
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

import { brushedFinish, metalFinish, paintFinish, rubberFinish, stippleFinish, woodFinish } from './weaponTextures.js'

/**
 * The weapon-building kit: materials, geometry helpers and attachments
 * (optics, muzzle devices, underbarrel kit, coupled magazines), shared by
 * every gun builder (weaponModels.js and the per-category gun files).
 * See weaponModels.js for the modelling conventions.
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
  /** Smoke-tinted polymer (see-through-looking magazines), glossy. */
  smoky: physical({
    color: '#4a4339',
    metalness: 0.02,
    roughness: 0.38,
    map: F.stipple.map,
    clearcoat: 0.45,
    clearcoatRoughness: 0.2,
  }),
  /** Oiled walnut rifle furniture: the wood grain, darkened, a soft sheen. */
  walnut: physical({
    color: '#8a5a38',
    metalness: 0,
    roughness: 0.55,
    map: F.wood.map,
    normalMap: F.wood.normalMap,
    normalScale: new Vector2(0.4, 0.4),
    clearcoat: 0.25,
    clearcoatRoughness: 0.45,
  }),
  /** Bakelite / plum polymer (old furniture). */
  bakelite: physical({
    color: '#4a2219',
    metalness: 0.02,
    roughness: 0.5,
    map: F.stipple.map,
    clearcoat: 0.15,
    clearcoatRoughness: 0.4,
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
export const M = weaponMaterials

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
export const holoReticle = new MeshBasicMaterial({
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
export const cached = (key, build) => {
  if (!geoCache.has(key)) geoCache.set(key, build())
  return geoCache.get(key)
}

/** Side profile (u forward, v up) extruded `width` across, centred on x = 0. */
export function profileGeo(key, points, width, bevel = 0.0035) {
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

export function add(group, geo, mat, pos = [0, 0, 0], rot) {
  const m = new Mesh(geo, mat)
  m.position.set(...pos)
  if (rot) m.rotation.set(...rot)
  m.castShadow = true
  group.add(m)
  return m
}

export const rbox = (w, h, d, r = 0.004) => cached(`rb:${w}:${h}:${d}:${r}`, () => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)))

/** Rounded box centred at (x, v, -u). */
export function box(group, size, u, v, mat, x = 0, rot) {
  return add(group, rbox(...size), mat, [x, v, -u], rot)
}

/** Cylinder lying along the barrel axis, from u0 to u1, centred at height v. */
export function tube(group, r, u0, u1, v, mat, segments = 16, rEnd = r, x = 0) {
  const len = Math.abs(u1 - u0)
  const geo = cached(`t:${r}:${rEnd}:${len}:${segments}`, () => {
    const g = new CylinderGeometry(rEnd, r, len, segments)
    g.rotateX(-Math.PI / 2)
    return g
  })
  return add(group, geo, mat, [x, v, -(u0 + u1) / 2])
}

/** Cylinder running across the gun (pins, screws, knobs), centred at (x, v, -u). */
export function crossPin(group, r, len, u, v, mat, x = 0, segments = 12) {
  const geo = cached(`x:${r}:${len}:${segments}`, () => new CylinderGeometry(r, r, len, segments).rotateZ(Math.PI / 2))
  return add(group, geo, mat, [x, v, -u])
}

/** Thick-walled open tube along the barrel axis (an optic housing you can see through). */
export function ringTube(group, rOut, rIn, u0, u1, v, mat, segments = 24, x = 0) {
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

export function marker(group, name, u, v, x = 0) {
  const o = new Object3D()
  o.name = name
  o.position.set(x, v, -u)
  group.add(o)
  return o
}

/** Picatinny rail with teeth, from u0 to u1, base at height v. */
export function rail(group, u0, u1, v, width = 0.022, mat = M.metalDark) {
  box(group, [width, 0.006, u1 - u0], (u0 + u1) / 2, v + 0.003, mat, 0, undefined)
  const teeth = Math.floor((u1 - u0) / 0.011)
  const tooth = cached(`tooth:${width}`, () => new RoundedBoxGeometry(width + 0.004, 0.005, 0.006, 1, 0.001))
  for (let i = 0; i < teeth; i++) add(group, tooth, mat, [0, v + 0.0085, -(u0 + 0.0055 + i * 0.011)])
}

/** A loaded round lying along the barrel axis: brass case + copper bullet. */
export function cartridge(group, u, v, x, len = 0.045, r = 0.0048) {
  tube(group, r, u - len * 0.72, u, v, M.brass, 10, r, x)
  tube(group, r * 0.94, u, u + len * 0.12, v, M.brass, 10, r * 0.8, x)
  tube(group, r * 0.8, u + len * 0.12, u + len * 0.3, v, M.copper, 10, r * 0.15, x)
}

/** Grooves (dark insets) evenly spaced along u. */
export function grooves(group, count, u0, step, v, size, x = 0) {
  for (let i = 0; i < count; i++) box(group, size, u0 + i * step, v, M.inset, x)
}

/* ---------------------------------------------------------------------------
 * Attachments
 * ------------------------------------------------------------------------- */

/** Mounts an optic on a rail at height `v` (rail top) around `u`; returns the sight-line height. */
export function addOptic(group, kind, u, v, small = false) {
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
  if (kind === 'acog') {
    // 3x prism scope. Everything round the sight line is an open tube, so the
    // view goes straight through it: the main body, the objective bell up
    // front, the eyepiece and its rubber eyecup behind. A squared top shroud,
    // the fibre-optic light pipe that lights the chevron, two turrets and a
    // rail mount with its thumb nut.
    const c = v + 0.043
    box(group, [0.03, 0.014, 0.064], u, v + 0.007, M.metalDark)
    crossPin(group, 0.0045, 0.008, u - 0.008, v + 0.008, M.steel, 0.019)
    box(group, [0.016, 0.014, 0.05], u, v + 0.019, M.metal)
    ringTube(group, 0.0195, 0.0158, u - 0.045, u + 0.045, c, M.metal)
    box(group, [0.03, 0.01, 0.08], u, c + 0.017, M.metal)
    ringTube(group, 0.0255, 0.0212, u + 0.045, u + 0.08, c, M.metal)
    ringTube(group, 0.0265, 0.0212, u + 0.074, u + 0.082, c, M.metalDark)
    ringTube(group, 0.0175, 0.0136, u - 0.075, u - 0.045, c, M.metal)
    ringTube(group, 0.0185, 0.0136, u - 0.09, u - 0.074, c, M.rubber)
    // Light pipe along the top (glows), turrets on top and right.
    tube(group, 0.0035, u - 0.035, u + 0.04, c + 0.025, M.tritium, 8)
    add(group, cached('acogTurret', () => new CylinderGeometry(0.0075, 0.0075, 0.008, 14)), M.metalDark, [0, c + 0.025, -(u + 0.01)])
    add(group, cached('acogTurret', () => new CylinderGeometry(0.0075, 0.0075, 0.008, 14)), M.metalDark, [0.022, c, -(u + 0.01)], [0, 0, Math.PI / 2])
    // Glass front and back, barely tinted; the lit chevron on the sight line between.
    const front = add(group, cached('acogLensF', () => new CircleGeometry(0.0212, 24)), M.reflexLens, [0, c, -(u + 0.078)])
    front.rotation.y = Math.PI
    add(group, cached('acogLensB', () => new CircleGeometry(0.0136, 20)), M.reflexLens, [0, c, -(u - 0.08)])
    const chev = add(group, cached('acogChev', () => new PlaneGeometry(0.009, 0.009)), chevronReticle, [0, c - 0.0012, -(u + 0.012)])
    chev.renderOrder = 3
    return { sightV: c, sightU: u - 0.092 }
  }
  return null
}

function chevronTexture() {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const ctx = c.getContext('2d')
  ctx.strokeStyle = '#ff6a2a'
  ctx.lineWidth = 6
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(14, 46)
  ctx.lineTo(32, 18)
  ctx.lineTo(50, 46)
  ctx.stroke()
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(32, 50)
  ctx.lineTo(32, 62)
  ctx.stroke()
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}
/** The ACOG's lit chevron (the tip on the sight line), drawn additive so it glows. */
const chevronReticle = new MeshBasicMaterial({
  map: chevronTexture(),
  transparent: true,
  blending: AdditiveBlending,
  depthWrite: false,
  side: DoubleSide,
  toneMapped: false,
})

/**
 * Underbarrel kit on a short rail under the handguard at (u, v = the
 * handguard's underside): a vertical grip, an angled grip, or a laser module.
 * Returns where the support hand should go when the kit changes it (on a
 * grip), or null. A laser gets a 'laser' marker where its beam leaves.
 * `small`: a pistol's laser, under its dust cover (no rail added).
 */
export function addUnder(group, kind, u, v, small = false) {
  if (!kind || kind === 'none') return null
  if (!small) {
    // Short rail, teeth facing down.
    box(group, [0.022, 0.006, 0.09], u, v - 0.003, M.metalDark)
    const tooth = cached('toothDown', () => new RoundedBoxGeometry(0.026, 0.005, 0.006, 1, 0.001))
    for (let i = 0; i < 8; i++) add(group, tooth, M.metalDark, [0, v - 0.0085, -(u - 0.04 + i * 0.011)])
  }
  if (kind === 'grip') {
    // Vertical fore-grip: rail clamp, a slightly tapered ribbed handle, end cap.
    box(group, [0.03, 0.012, 0.036], u, v - 0.016, M.metalDark)
    crossPin(group, 0.004, 0.034, u + 0.008, v - 0.016, M.steel)
    add(group, cached('vGripBody', () => new CylinderGeometry(0.0135, 0.0122, 0.085, 18)), M.polymer, [0, v - 0.064, -u])
    for (let i = 0; i < 3; i++) add(group, cached('vGripRib', () => new TorusGeometry(0.013, 0.0018, 6, 18)), M.polymer, [0, v - 0.04 - i * 0.022, -u], [Math.PI / 2, 0, 0])
    add(group, cached('vGripCap', () => new CylinderGeometry(0.0148, 0.0142, 0.007, 18)), M.rubber, [0, v - 0.108, -u])
    return [u, v - 0.06]
  }
  if (kind === 'angled') {
    // Angled fore-grip: a swept wedge with a thumb shelf at its front edge.
    add(group, profileGeo('angGrip', [[-0.05, 0.0], [0.042, 0.0], [0.042, -0.012], [0.028, -0.016], [-0.022, -0.046], [-0.05, -0.016]], 0.026, 0.004), M.polymer, [0, v - 0.006, -u])
    for (let i = 0; i < 4; i++) box(group, [0.027, 0.003, 0.006], u - 0.018 + i * 0.012, v - 0.026 + i * 0.004, M.inset, 0, [0.5, 0, 0])
    return [u - 0.01, v - 0.03]
  }
  if (kind === 'laser') {
    // Laser module: a machined body, the emitter window up front (lit red), a pressure switch.
    const w = small ? 0.024 : 0.028
    const len = small ? 0.044 : 0.058
    const lv = v - (small ? 0.012 : 0.017)
    box(group, [w, small ? 0.02 : 0.024, len], u, lv, M.metalDark)
    box(group, [w + 0.002, 0.008, 0.014], u - len / 2 + 0.01, lv + 0.008, M.metal)
    box(group, [0.006, 0.008, 0.012], u - len / 2 + 0.012, lv - 0.004, M.rubber, w / 2 + 0.002)
    tube(group, 0.0052, u + len / 2 - 0.004, u + len / 2 + 0.002, lv, M.metal, 14)
    tube(group, 0.0034, u + len / 2 + 0.002, u + len / 2 + 0.0026, lv, M.dot, 12)
    marker(group, 'laser', u + len / 2 + 0.003, lv)
    return null
  }
  return null
}

/**
 * Fast mag: a second magazine coupled alongside the first (on the gun's left,
 * clear of the ejection port) by two clamps. Copies whatever the mag group
 * holds, so it fits any gun's magazine.
 */
export function coupleMag(mag, dx = -0.036, clampV = -0.06, clampU = 0.1) {
  for (const part of [...mag.children]) {
    const twin = part.clone()
    twin.position.x += dx
    mag.add(twin)
  }
  for (const k of [0, 1]) box(mag, [Math.abs(dx) + 0.03, 0.012, 0.024], clampU + (k ? 0.02 : -0.02), clampV - k * 0.05, M.polymer, dx / 2)
}

/** Muzzle device from `u` forward at height `v`. Returns the new muzzle tip. */
export function addMuzzle(group, kind, u, v, r) {
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
  if (kind === 'slant') {
    // AK-style slant brake: a short sleeve with its top cut open on a bias.
    tube(group, r * 1.45, u, u + 0.045, v, M.metalDark, 16)
    box(group, [r * 1.5, 0.004, 0.02], u + 0.028, v + r * 1.35, M.inset, 0, [0.25, 0, 0])
    box(group, [0.004, r * 1.1, 0.012], u + 0.016, v, M.inset, r * 1.4)
    tube(group, r * 0.85, u + 0.045, u + 0.046, v, M.inset, 12)
    return u + 0.045
  }
  if (kind === 'fifty') {
    // A .50's double-baffle brake: two chambers, arrowhead nose, big side ports.
    const len = 0.13
    box(group, [r * 3.4, r * 2.6, len], u + len / 2, v, M.metalDark)
    box(group, [r * 3.0, r * 2.2, 0.03], u + len + 0.012, v, M.metalDark, 0, [0, 0, 0])
    for (const x of [-1, 1]) {
      box(group, [0.006, r * 1.9, 0.035], u + 0.03, v, M.inset, x * r * 1.72)
      box(group, [0.006, r * 1.9, 0.035], u + 0.085, v, M.inset, x * r * 1.72)
    }
    tube(group, r * 0.9, u + len + 0.027, u + len + 0.028, v, M.inset, 12)
    return u + len + 0.027
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


/**
 * Everything a gun ends with, from one description: its sight (the optic on
 * the rail at `optic` = [u, v], or iron sights drawn by `irons` when there's
 * no optic, `ironSight` being the eye's spot on that sight line), the muzzle
 * device (`muzzleKind` replaces the plain muzzle) and its marker, the
 * underbarrel kit at `under` and the support hand (on the kit's grip, or at
 * `hand`), and the 'eject' and 'charge' (charging handle) markers.
 */
export function finishGun(g, att, s) {
  const optic = s.optic ? addOptic(g, att.optic, s.optic[0], s.optic[1], s.smallOptic) : null
  if (optic) marker(g, 'sight', optic.sightU, optic.sightV)
  else {
    s.irons?.(g)
    marker(g, 'sight', ...s.ironSight)
  }
  const muzzle = att.muzzle && att.muzzle !== 'none' ? att.muzzle : s.muzzleKind ?? 'none'
  const tip = addMuzzle(g, muzzle, s.muzzle[0], s.muzzle[1], s.bore)
  marker(g, 'muzzle', tip + 0.01, s.muzzle[1])
  const hand = s.under ? addUnder(g, att.under, s.under[0], s.under[1], s.smallUnder) : null
  if (s.hand || hand) marker(g, 'leftHand', ...(hand ?? s.hand))
  if (s.eject) marker(g, 'eject', ...s.eject)
  if (s.charge) marker(g, 'charge', ...s.charge)
}
