import {
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  LinearSRGBColorSpace,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { baseOf, sanitizeAttachments } from '../../shared/weapons.js'
import { SHADOW_ONLY_LAYER } from '../layers.js'
import { EXPLOSIVES } from './guns/explosives.js'
import { LMGS } from './guns/lmgs.js'
import { PISTOLS } from './guns/pistols.js'
import { RIFLES } from './guns/rifles.js'
import { SMGS } from './guns/smgs.js'
import { SNIPERS } from './guns/snipers.js'
import { add, addMuzzle, addOptic, addUnder, box, cached, cartridge, coupleMag, crossPin, grooves, M, marker, profileGeo, rail, rbox, tube } from './weaponKit.js'

export { weaponMaterials } from './weaponKit.js'

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
  if (att.mag === 'fast') coupleMag(mag, -0.036, -0.09, 0.1)
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
  marker(g, 'leftHand', ...(addUnder(g, att.under, 0.43, 0.0) ?? [0.45, -0.005]))
  marker(g, 'eject', 0.075, 0.06, 0.036)
  marker(g, 'charge', -0.135, 0.092, -0.012)
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
  if (att.under === 'laser') addUnder(g, 'laser', 0.095, -0.002, true)
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
  if (att.under === 'laser') addUnder(g, 'laser', 0.17, 0.012, true)
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
  if (att.under === 'laser') addUnder(g, 'laser', 0.165, 0.018, true)
  const tip = addMuzzle(g, att.muzzle === 'suppressor' ? 'suppressor' : 'none-pistol', 0.19, 0.04, 0.0085)
  marker(g, 'muzzle', tip + 0.005, 0.04)
  marker(g, 'leftHand', 0.12, -0.07)
  marker(g, 'eject', 0.03, 0.05, 0.018)
  marker(g, 'charge', -0.085, 0.058, -0.022)
  return g
}

function buildSMG(att) {
  const g = new Group()
  // Compact receiver, polymer lower, slotted handguard, folding stock.
  add(g, profileGeo('smgUpper', [[-0.12, 0.02], [0.21, 0.02], [0.21, 0.07], [-0.1, 0.07], [-0.12, 0.056]], 0.046), M.metalDark)
  add(g, profileGeo('smgLower', [[-0.08, 0.022], [0.2, 0.022], [0.2, -0.004], [0.12, -0.008], [0.12, -0.03], [0.055, -0.03], [0.055, -0.006], [-0.06, -0.004]], 0.042), M.polymer)
  add(g, profileGeo('smgHand', [[0.2, -0.004], [0.36, 0.004], [0.36, 0.066], [0.2, 0.066]], 0.05, 0.006), M.polymer)
  grooves(g, 4, 0.23, 0.03, 0.03, [0.052, 0.012, 0.012])
  box(g, [0.004, 0.018, 0.04], 0.07, 0.048, M.inset, 0.023) // ejection port
  box(g, [0.012, 0.01, 0.022], -0.08, 0.06, M.metal, -0.026) // charging handle
  for (const u of [-0.06, 0.15]) crossPin(g, 0.0035, 0.048, u, 0.035, M.steel)
  rail(g, -0.1, 0.19, 0.07, 0.02)
  tube(g, 0.0085, 0.36, 0.41, 0.04, M.metalDark, 14)
  add(g, profileGeo('smgGrip', [[-0.03, -0.004], [0.02, -0.004], [-0.004, -0.112], [-0.054, -0.106]], 0.032, 0.006), M.polymer)
  add(g, profileGeo('smgGuard', [[0.0, -0.006], [0.055, -0.006], [0.055, -0.012], [0.008, -0.04], [0.0, -0.04]], 0.006, 0.001), M.polymer)
  box(g, [0.005, 0.02, 0.006], 0.026, -0.016, M.steel)
  for (const x of [-0.016, 0.016]) box(g, [0.006, 0.006, 0.2], -0.22, 0.045, M.metalDark, x) // stock rails
  box(g, [0.04, 0.1, 0.012], -0.33, 0.01, M.rubber)
  const mag = new Group()
  mag.name = 'mag'
  const ext = att.mag === 'extended'
  add(mag, profileGeo(ext ? 'smgMagX' : 'smgMag', ext ? [[0.06, -0.025], [0.115, -0.025], [0.15, -0.25], [0.095, -0.255]] : [[0.06, -0.025], [0.115, -0.025], [0.138, -0.17], [0.083, -0.175]], 0.028, 0.004), M.metalDark)
  cartridge(mag, 0.1, -0.02, 0, 0.026, 0.0045)
  if (att.mag === 'fast') coupleMag(mag, -0.032, -0.08, 0.1)
  g.add(mag)
  const optic = addOptic(g, att.optic, 0.02, 0.079)
  if (optic) {
    marker(g, 'sight', optic.sightU, optic.sightV)
  } else {
    box(g, [0.024, 0.02, 0.01], -0.08, 0.087, M.metalDark)
    box(g, [0.004, 0.02, 0.004], 0.17, 0.087, M.metalDark)
    marker(g, 'sight', -0.11, 0.094)
  }
  const tip = addMuzzle(g, att.muzzle, 0.41, 0.04, 0.0085)
  marker(g, 'muzzle', tip + 0.008, 0.04)
  marker(g, 'leftHand', ...(addUnder(g, att.under, 0.29, -0.004) ?? [0.27, -0.004]))
  marker(g, 'eject', 0.07, 0.05, 0.026)
  marker(g, 'charge', -0.08, 0.06, -0.03)
  return g
}

function buildShotgun(att) {
  const g = new Group()
  // Receiver with a loading port underneath, barrel over the magazine tube.
  add(g, profileGeo('sgRecv', [[-0.12, -0.012], [0.17, -0.012], [0.17, 0.064], [-0.1, 0.064], [-0.12, 0.05]], 0.052), M.metalDark)
  box(g, [0.03, 0.006, 0.07], 0.08, -0.013, M.inset) // loading port
  box(g, [0.004, 0.02, 0.06], 0.07, 0.04, M.inset, 0.026) // ejection port
  for (const u of [-0.06, 0.12]) crossPin(g, 0.004, 0.054, u, 0.01, M.steel)
  tube(g, 0.0125, 0.17, 0.62, 0.046, M.metalDark, 18)
  tube(g, 0.0118, 0.17, 0.54, 0.016, M.metalDark, 16)
  tube(g, 0.0132, 0.53, 0.55, 0.016, M.metal, 16) // mag cap
  box(g, [0.03, 0.05, 0.02], 0.5, 0.031, M.metal) // barrel clamp
  tube(g, 0.0065, 0.618, 0.622, 0.046, M.inset, 12) // bore
  // Side saddle: spare shells on the left of the receiver.
  for (let i = 0; i < 4; i++) {
    const u = -0.06 + i * 0.03
    const geo = cached('shellHull', () => new CylinderGeometry(0.0095, 0.0095, 0.05, 12))
    add(g, geo, M.red, [-0.034, 0.025, -u])
    add(g, cached('shellBase', () => new CylinderGeometry(0.0098, 0.0098, 0.012, 12)), M.brass, [-0.034, -0.006, -u])
  }
  box(g, [0.006, 0.07, 0.13], -0.015, 0.025, M.polymer, -0.028)
  // Pump (its own group so it can rack): ribbed forend round the mag tube.
  const pump = new Group()
  pump.name = 'pump'
  g.add(pump)
  add(pump, profileGeo('sgPump', [[0.26, -0.012], [0.44, -0.012], [0.44, 0.046], [0.26, 0.046]], 0.05, 0.008), M.polymer)
  for (let i = 0; i < 6; i++) box(pump, [0.052, 0.006, 0.006], 0.28 + i * 0.026, -0.004, M.inset)
  marker(pump, 'leftHand', ...(addUnder(pump, att.under, 0.35, -0.012) ?? [0.35, -0.012]))
  // Pistol-grip stock, guard, trigger.
  add(g, profileGeo('sgStock', [[-0.12, 0.05], [-0.42, 0.06], [-0.42, -0.08], [-0.33, -0.06], [-0.16, -0.012], [-0.12, -0.012]], 0.046, 0.008), M.polymer)
  box(g, [0.05, 0.15, 0.016], -0.425, -0.01, M.rubber)
  add(g, profileGeo('sgGrip', [[-0.03, -0.012], [0.02, -0.012], [-0.006, -0.12], [-0.058, -0.112]], 0.034, 0.006), M.polymer)
  add(g, profileGeo('sgGuard', [[0.0, -0.014], [0.065, -0.014], [0.065, -0.02], [0.006, -0.046], [0.0, -0.046]], 0.006, 0.001), M.metalDark)
  box(g, [0.005, 0.022, 0.006], 0.03, -0.026, M.steel)
  rail(g, -0.08, 0.15, 0.064, 0.02)
  const optic = addOptic(g, att.optic, 0.02, 0.073)
  if (optic) {
    marker(g, 'sight', optic.sightU, optic.sightV)
  } else {
    // Ghost-ring rear and a red bead up front.
    add(g, cached('ghostRing', () => new TorusGeometry(0.008, 0.0028, 8, 16)), M.metalDark, [0, 0.084, 0.06])
    box(g, [0.022, 0.016, 0.01], -0.06, 0.072, M.metalDark)
    add(g, cached('bead', () => new SphereGeometry(0.0034, 10, 8)), M.red, [0, 0.062, -0.6])
    marker(g, 'sight', -0.1, 0.084)
  }
  const tip = addMuzzle(g, att.muzzle === 'suppressor' ? 'suppressor' : 'none-pistol', 0.622, 0.046, 0.0125)
  marker(g, 'muzzle', tip + 0.01, 0.046)
  marker(g, 'eject', 0.07, 0.04, 0.03)
  return g
}

function buildLMG(att) {
  const g = new Group()
  // Heavy receiver with a hinged feed cover, perforated heat shield, carry handle.
  add(g, profileGeo('lmgRecv', [[-0.14, -0.012], [0.23, -0.012], [0.23, 0.086], [-0.12, 0.086], [-0.14, 0.07]], 0.066), M.metalDark)
  add(g, profileGeo('lmgCover', [[-0.09, 0.086], [0.18, 0.086], [0.17, 0.106], [-0.08, 0.106]], 0.07, 0.004), M.metal)
  crossPin(g, 0.004, 0.072, -0.085, 0.09, M.steel)
  box(g, [0.004, 0.024, 0.07], 0.06, 0.05, M.inset, 0.034) // ejection port
  for (const u of [-0.08, 0.2]) crossPin(g, 0.0045, 0.068, u, 0.02, M.steel)
  tube(g, 0.0215, 0.23, 0.48, 0.042, M.polymer, 20)
  for (let i = 0; i < 6; i++) for (const a of [0.5, -0.5]) box(g, [0.004, 0.008, 0.022], 0.25 + i * 0.038, 0.042 + Math.sin(a) * 0.02, M.inset, Math.cos(a) * 0.02)
  tube(g, 0.0135, 0.48, 0.76, 0.042, M.metalDark, 18)
  tube(g, 0.008, 0.48, 0.62, 0.016, M.metalDark, 12) // gas tube
  box(g, [0.02, 0.04, 0.03], 0.62, 0.028, M.metal) // gas block
  // Carry handle arching over the barrel.
  box(g, [0.012, 0.05, 0.012], 0.42, 0.075, M.metalDark)
  box(g, [0.012, 0.05, 0.012], 0.52, 0.075, M.metalDark)
  box(g, [0.016, 0.012, 0.13], 0.47, 0.104, M.polymer)
  // Folded bipod.
  box(g, [0.04, 0.016, 0.03], 0.66, 0.012, M.metalDark)
  for (const x of [-0.014, 0.014]) box(g, [0.008, 0.008, 0.24], 0.54, 0.004, M.metalDark, x)
  // Skeleton stock, grip, guard, trigger.
  add(g, profileGeo('lmgStock', [[-0.14, 0.07], [-0.44, 0.07], [-0.44, -0.07], [-0.36, -0.06], [-0.18, -0.01], [-0.14, -0.01]], 0.05, 0.008), M.tan)
  box(g, [0.04, 0.05, 0.12], -0.3, 0.02, M.inset) // cut-out
  box(g, [0.054, 0.15, 0.018], -0.445, 0.0, M.rubber)
  add(g, profileGeo('lmgGrip', [[-0.03, -0.012], [0.025, -0.012], [-0.002, -0.125], [-0.056, -0.118]], 0.036, 0.006), M.polymer)
  add(g, profileGeo('lmgGuard', [[0.0, -0.014], [0.07, -0.014], [0.07, -0.02], [0.006, -0.048], [0.0, -0.048]], 0.007, 0.001), M.metalDark)
  box(g, [0.006, 0.022, 0.006], 0.032, -0.028, M.steel)
  // Box magazine on the left, with the belt feeding up into the receiver.
  const mag = new Group()
  mag.name = 'mag'
  add(mag, profileGeo('lmgBox', [[0.02, -0.02], [0.14, -0.02], [0.14, -0.13], [0.02, -0.13]], 0.08, 0.006), M.olive)
  box(mag, [0.084, 0.012, 0.12], 0.08, -0.13, M.polymer)
  box(mag, [0.02, 0.03, 0.05], 0.08, -0.07, M.inset, -0.041) // handle cut
  for (let i = 0; i < 5; i++) cartridge(mag, 0.09, -0.015 + i * 0.012, -0.034 + i * 0.002, 0.045, 0.0045)
  g.add(mag)
  rail(g, -0.06, 0.14, 0.106, 0.022)
  const optic = addOptic(g, att.optic, 0.02, 0.115)
  if (optic) {
    marker(g, 'sight', optic.sightU, optic.sightV)
  } else {
    box(g, [0.03, 0.03, 0.012], -0.06, 0.13, M.metalDark)
    add(g, cached('lmgAperture', () => new TorusGeometry(0.006, 0.0022, 8, 16)), M.metalDark, [0, 0.148, 0.06])
    box(g, [0.004, 0.05, 0.004], 0.72, 0.076, M.metalDark)
    marker(g, 'sight', -0.1, 0.148)
  }
  const tip = addMuzzle(g, att.muzzle, 0.76, 0.042, 0.0135)
  marker(g, 'muzzle', tip + 0.01, 0.042)
  marker(g, 'leftHand', ...(addUnder(g, att.under, 0.36, 0.02) ?? [0.33, 0.015]))
  marker(g, 'eject', 0.06, 0.02, 0.036)
  return g
}

/** Rocket warhead + motor, pointing down -Z (used on the launcher and in flight). */
function rocketParts(group, u0) {
  // Motor tube sits in the launcher; the bulbous warhead sticks out the front.
  tube(group, 0.026, u0 - 0.1, u0 + 0.04, 0.0, M.metalDark, 16)
  tube(group, 0.044, u0 + 0.04, u0 + 0.17, 0.0, M.olive, 20, 0.042)
  tube(group, 0.042, u0 + 0.17, u0 + 0.33, 0.0, M.olive, 20, 0.006)
  tube(group, 0.008, u0 + 0.33, u0 + 0.36, 0.0, M.metal, 10)
  tube(group, 0.0445, u0 + 0.09, u0 + 0.1, 0.0, M.brass, 20)
}

function buildRPG() {
  const g = new Group()
  const v = 0.06
  // Launch tube with a flared venturi at the back and a wooden heat guard.
  tube(g, 0.036, -0.4, 0.48, v, M.olive, 20)
  tube(g, 0.042, -0.52, -0.4, v, M.metalDark, 20, 0.062)
  tube(g, 0.041, 0.46, 0.5, v, M.metalDark, 20)
  tube(g, 0.043, -0.12, 0.16, v, M.wood, 20)
  for (const u of [-0.12, 0.16]) tube(g, 0.0445, u - 0.006, u + 0.006, v, M.metalDark, 20)
  // Rear grip with trigger, front grip, iron sights, optical sight on the left.
  add(g, profileGeo('rpgGrip', [[-0.03, 0.03], [0.02, 0.03], [-0.004, -0.09], [-0.056, -0.084]], 0.034, 0.006), M.wood)
  add(g, profileGeo('rpgGuard', [[0.0, 0.026], [0.06, 0.026], [0.06, 0.02], [0.006, -0.008], [0.0, -0.008]], 0.006, 0.001), M.metalDark)
  box(g, [0.005, 0.022, 0.006], 0.026, 0.012, M.steel)
  add(g, profileGeo('rpgFront', [[0.16, 0.03], [0.21, 0.03], [0.2, -0.09], [0.158, -0.086]], 0.032, 0.006), M.wood)
  box(g, [0.006, 0.034, 0.006], 0.3, v + 0.052, M.metalDark)
  // Rear sight: a notch between two ears, so the front post shows through it.
  for (const x of [-0.009, 0.009]) box(g, [0.006, 0.03, 0.01], -0.08, v + 0.05, M.metalDark, x)
  box(g, [0.014, 0.014, 0.01], -0.08, v + 0.037, M.metalDark)
  box(g, [0.03, 0.05, 0.11], 0.0, v + 0.022, M.metalDark, -0.056)
  tube(g, 0.012, 0.055, 0.065, v + 0.032, M.lensCap, 14, 0.012, -0.056)
  // The loaded rocket: hidden once fired, back after a reload.
  const warhead = new Group()
  warhead.name = 'warhead'
  warhead.position.y = v
  rocketParts(warhead, 0.46)
  g.add(warhead)
  marker(g, 'sight', -0.14, v + 0.065)
  marker(g, 'muzzle', 0.52, v)
  marker(g, 'leftHand', 0.18, -0.06)
  return g
}

function buildRocket() {
  const g = new Group()
  rocketParts(g, -0.1)
  // Fins at the tail.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    box(g, [0.004, 0.05, 0.05], -0.17, Math.sin(a) * 0.03, M.metalDark, Math.cos(a) * 0.03, [0, 0, a])
  }
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
  smg: buildSMG,
  shotgun: buildShotgun,
  lmg: buildLMG,
  rpg: buildRPG,
  rocket: buildRocket,
  knife: buildKnife,
  frag: buildFrag,
  flash: () => buildCanister(M.grey, M.white),
  smoke: () => buildCanister(M.olive, M.white),
  ...RIFLES,
  ...SMGS,
  ...SNIPERS,
  ...LMGS,
  ...PISTOLS,
  ...EXPLOSIVES,
}

/** Where the firing hand closes on each weapon (u along the barrel, v height); newer guns share their family's. */
const GRIPS = {
  ar: [-0.005, -0.08],
  sniper: [-0.01, -0.075],
  pistol: [-0.023, -0.05],
  viper: [-0.05, -0.05],
  hornet: [-0.02, -0.048],
  smg: [-0.016, -0.06],
  shotgun: [-0.012, -0.07],
  lmg: [-0.006, -0.085],
  rpg: [-0.018, -0.05],
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

const shadowProxyMaterial = new MeshBasicMaterial()

/**
 * One positions-only stand-in that casts the shadow of every static part, on
 * the shadow-only layer; the parts themselves stop casting. With eight players
 * that's one shadow draw per gun instead of a dozen. Moving parts keep theirs.
 */
function addShadowProxy(root) {
  const parts = []
  root.traverse((c) => {
    if (c.isMesh && c.castShadow && !c.material.transparent) parts.push(c)
  })
  if (parts.length < 2) return
  root.updateMatrixWorld(true)
  const toRoot = new Matrix4().copy(root.matrixWorld).invert()
  const geos = parts.map((m) => {
    const g = new BufferGeometry()
    const src = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry
    g.setAttribute('position', src.getAttribute('position').clone())
    g.applyMatrix4(new Matrix4().multiplyMatrices(toRoot, m.matrixWorld))
    return g
  })
  const merged = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  if (!merged) return
  const proxy = new Mesh(merged, shadowProxyMaterial)
  proxy.name = 'shadowProxy'
  proxy.castShadow = true
  proxy.layers.set(SHADOW_ONLY_LAYER)
  for (const m of parts) m.castShadow = false
  root.add(proxy)
}

const templates = new Map()

/* ---------------------------------------------------------------------------
 * Far LOD: what a gun looks like from more than a dozen metres away
 * ------------------------------------------------------------------------- */

const lodMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.35 })
const meanColors = new Map()

/** Average colour of a texture's image (linear), or null; worked out once per texture. */
function meanColor(texture) {
  if (!texture?.image) return null
  if (meanColors.has(texture)) return meanColors.get(texture)
  let color
  try {
    const n = 16
    const c = document.createElement('canvas')
    c.width = c.height = n
    const ctx = c.getContext('2d')
    ctx.drawImage(texture.image, 0, 0, n, n)
    const d = ctx.getImageData(0, 0, n, n).data
    let r = 0
    let g = 0
    let b = 0
    for (let i = 0; i < d.length; i += 4) {
      r += d[i]
      g += d[i + 1]
      b += d[i + 2]
    }
    const k = 255 * n * n
    color = new Color().setRGB(r / k, g / k, b / k, texture.colorSpace === SRGBColorSpace ? SRGBColorSpace : LinearSRGBColorSpace)
  } catch {
    color = null
  }
  meanColors.set(texture, color)
  return color
}

/**
 * The whole gun as one vertex-coloured mesh (each part's colour times its
 * texture's average): a dozen draws become one. Only for players far enough
 * away that the surface detail is a few pixels; casts its own shadow.
 */
function buildLod(model) {
  model.updateMatrixWorld(true)
  const toRoot = new Matrix4().copy(model.matrixWorld).invert()
  const geos = []
  model.traverse((o) => {
    if (!o.isMesh || o.name === 'shadowProxy' || o.material.transparent || o.material.isMeshBasicMaterial) return
    const src = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry
    const g = new BufferGeometry()
    g.setAttribute('position', src.getAttribute('position').clone())
    if (src.getAttribute('normal')) g.setAttribute('normal', src.getAttribute('normal').clone())
    else g.computeVertexNormals()
    g.applyMatrix4(new Matrix4().multiplyMatrices(toRoot, o.matrixWorld))
    const tint = o.material.color.clone()
    const texel = meanColor(o.material.map)
    if (texel) tint.multiply(texel)
    const n = g.getAttribute('position').count
    const colors = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) tint.toArray(colors, i * 3)
    g.setAttribute('color', new BufferAttribute(colors, 3))
    geos.push(g)
  })
  const merged = geos.length ? mergeGeometries(geos, false) : null
  geos.forEach((g) => g.dispose())
  if (!merged) return null
  const mesh = new Mesh(merged, lodMaterial)
  mesh.name = 'lod'
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

const lods = new Map()

/** Far-LOD stand-in for createWeaponModel(id, att), or null if it can't be built. */
export function createWeaponLod(id, att) {
  const a = sanitizeAttachments(id, att)
  const key = keyOf(id, a)
  if (!lods.has(key)) {
    createWeaponModel(id, att)
    lods.set(key, templates.has(key) ? buildLod(templates.get(key)) : null)
  }
  return lods.get(key)?.clone() ?? null
}

/**
 * Model instance for a weapon/equipment id with its attachments fitted. Each
 * combination is built and merged once; callers get a cheap clone that shares
 * geometry and materials.
 */
export function createWeaponModel(id, att) {
  const a = sanitizeAttachments(id, att)
  const key = keyOf(id, a)
  if (!templates.has(key)) {
    // Finish a build already under way in idle time, or do the whole thing now.
    const stages = pending.get(key)?.stages ?? buildStages(id, a, key)
    pending.delete(key)
    for (const stage of stages) stage()
  }
  return templates.get(key).clone(true)
}

const keyOf = (id, a) => `${id}|${a.optic ?? ''}|${a.muzzle ?? ''}|${a.mag ?? ''}|${a.under ?? ''}`

/** Building a gun, in steps of a few milliseconds each (see prepareWeaponModel). */
function buildStages(id, a, key) {
  let model = null
  return [
    () => {
      model = (BUILDERS[id] ?? BUILDERS.ar)(a)
      model.userData.weaponId = id
      const grip = GRIPS[id] ?? GRIPS[baseOf(id)]
      if (grip) marker(model, 'grip', grip[0], grip[1])
    },
    () => mergeStatics(model),
    () => {
      // Moving parts (slide, mag, bolt...) move as one piece, so batch inside them too.
      for (const child of model.children) if (child.isGroup) mergeStatics(child)
    },
    () => {
      addShadowProxy(model)
      templates.set(key, model)
    },
  ]
}

/** True once this weapon + attachments combination is built (createWeaponModel is then instant). */
export function hasWeaponModel(id, att) {
  return templates.has(keyOf(id, sanitizeAttachments(id, att)))
}

const pending = new Map()
let idleQueued = false
const whenIdle = (fn) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 1000 }) : setTimeout(fn, 32))

function runPending() {
  idleQueued = false
  // One step per idle slot, so no single frame pays for a whole gun.
  for (const [key, job] of pending) {
    const stage = job.stages.shift()
    if (stage) stage()
    else {
      if (!lods.has(key)) lods.set(key, buildLod(templates.get(key)))
      pending.delete(key)
    }
    break
  }
  if (pending.size && !idleQueued) {
    idleQueued = true
    whenIdle(runPending)
  }
}

/**
 * Builds a combination (and its far LOD) in idle time, a step at a time; until
 * it's ready, callers can show the gun with its default attachments. An
 * `urgent` one (your own class) goes to the front of the queue.
 */
export function prepareWeaponModel(id, att, urgent = false) {
  const a = sanitizeAttachments(id, att)
  const key = keyOf(id, a)
  if (templates.has(key) && lods.has(key)) return
  const job = pending.get(key) ?? { stages: templates.has(key) ? [] : buildStages(id, a, key) }
  if (urgent) {
    const rest = [...pending].filter(([k]) => k !== key)
    pending.clear()
    pending.set(key, job)
    for (const [k, j] of rest) pending.set(k, j)
  } else if (!pending.has(key)) {
    pending.set(key, job)
  } else {
    return
  }
  if (!idleQueued) {
    idleQueued = true
    whenIdle(runPending)
  }
}
