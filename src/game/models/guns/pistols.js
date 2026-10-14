import { Group, SphereGeometry } from 'three'

import { add, addMuzzle, addOptic, addUnder, box, cached, cartridge, crossPin, M, marker, profileGeo, tube } from '../weaponKit.js'

/**
 * Pistols beyond the P9 (conventions as in weaponModels.js). Like the P9, the
 * slide is its own group so it blows back, and the hand on the grip sits where
 * the P9's does.
 */

/** Colonel 45: blued steel single-action, flat-topped slide, wood grip panels, the hammer spur. */
function buildColonel(att) {
  const g = new Group()
  const slide = new Group()
  slide.name = 'slide'
  g.add(slide)
  add(slide, profileGeo('clSlide', [[-0.085, 0.018], [0.125, 0.018], [0.128, 0.026], [0.128, 0.05], [-0.08, 0.05], [-0.088, 0.04]], 0.024, 0.003), M.metalDark)
  for (let i = 0; i < 8; i++) box(slide, [0.026, 0.024, 0.0022], -0.074 + i * 0.006, 0.034, M.inset)
  box(slide, [0.004, 0.012, 0.034], 0.02, 0.04, M.inset, 0.0122)
  box(slide, [0.002, 0.01, 0.03], 0.02, 0.041, M.steel, 0.012)
  tube(slide, 0.009, 0.118, 0.13, 0.034, M.metal, 16)
  tube(slide, 0.0055, 0.128, 0.131, 0.034, M.inset, 12)
  // Frame, slide stop, thumb safety, the grip safety and hammer spur.
  add(g, profileGeo('clFrame', [[-0.07, 0.018], [0.11, 0.018], [0.11, 0.002], [0.06, -0.002], [-0.03, 0.0]], 0.022, 0.003), M.metalDark)
  box(g, [0.004, 0.006, 0.026], 0.03, 0.014, M.metalDark, -0.0128)
  box(g, [0.004, 0.006, 0.02], -0.05, 0.02, M.metalDark, -0.0128)
  box(g, [0.022, 0.012, 0.03], -0.065, 0.006, M.metalDark, 0, [0.4, 0, 0])
  box(g, [0.008, 0.016, 0.01], -0.08, 0.05, M.metalDark, 0, [0.5, 0, 0])
  // Guard, the flat trigger; grip frame with wood panels and their screws; the mag's base.
  add(g, profileGeo('clGuard', [[0.0, 0.0], [0.068, 0.0], [0.068, -0.006], [0.012, -0.034], [0.0, -0.034]], 0.007, 0.002), M.metalDark)
  box(g, [0.005, 0.016, 0.008], 0.024, -0.012, M.steel)
  add(g, profileGeo('clGrip', [[-0.04, 0.002], [0.012, 0.002], [-0.006, -0.11], [-0.058, -0.106], [-0.05, -0.05], [-0.06, 0.0]], 0.022, 0.004), M.metalDark)
  for (const x of [-1, 1]) {
    add(g, profileGeo('clPanel', [[-0.042, -0.012], [0.004, -0.012], [-0.01, -0.092], [-0.05, -0.088]], 0.004, 0.0012), M.walnut, [x * 0.0118, 0, 0])
    for (const v of [-0.025, -0.08]) crossPin(g, 0.0028, 0.002, -0.022, v, M.steel, x * 0.0142)
  }
  const mag = new Group()
  mag.name = 'mag'
  const ext = att.mag === 'extended'
  box(mag, [0.024, ext ? 0.03 : 0.008, 0.042], -0.034, ext ? -0.122 : -0.109, M.metalDark, 0, [-0.21, 0, 0])
  cartridge(mag, -0.014, 0.004, 0, 0.026, 0.0052)
  g.add(mag)
  const optic = addOptic(slide, att.optic, -0.03, 0.05, true)
  if (optic) marker(g, 'sight', optic.sightU, optic.sightV)
  else {
    box(slide, [0.004, 0.008, 0.008], 0.112, 0.054, M.metalDark)
    box(slide, [0.02, 0.008, 0.008], -0.066, 0.054, M.metalDark)
    marker(g, 'sight', -0.095, 0.058)
  }
  if (att.under === 'laser') addUnder(g, 'laser', 0.085, 0.002, true)
  const tip = addMuzzle(g, att.muzzle === 'suppressor' ? 'suppressor' : 'none-pistol', 0.131, 0.034, 0.0085)
  marker(g, 'muzzle', tip + 0.005, 0.034)
  marker(g, 'leftHand', -0.02, -0.055)
  marker(g, 'eject', 0.02, 0.046, 0.014)
  return g
}

/** Dragoon .50: polished steel hand cannon: a big slide, the barrel block up front with its rail, a rubber grip. */
function buildDragoon(att) {
  const g = new Group()
  const slide = new Group()
  slide.name = 'slide'
  g.add(slide)
  add(slide, profileGeo('dgSlide', [[-0.095, 0.026], [0.07, 0.026], [0.07, 0.074], [-0.085, 0.074], [-0.097, 0.06]], 0.032, 0.004), M.metal)
  for (let i = 0; i < 7; i++) box(slide, [0.034, 0.032, 0.0024], -0.084 + i * 0.007, 0.05, M.inset)
  box(slide, [0.004, 0.016, 0.04], 0.02, 0.06, M.inset, 0.0162)
  // The barrel block (fixed): long, flat-sided, a rail along its top, the big bore.
  add(g, profileGeo('dgBarrel', [[0.07, 0.014], [0.175, 0.014], [0.178, 0.03], [0.175, 0.074], [0.07, 0.074]], 0.03, 0.004), M.stainless)
  box(g, [0.012, 0.006, 0.1], 0.122, 0.077, M.metal)
  for (let i = 0; i < 6; i++) box(g, [0.014, 0.003, 0.004], 0.08 + i * 0.016, 0.081, M.metal)
  tube(g, 0.0085, 0.177, 0.179, 0.046, M.inset, 14)
  // Frame, the hammer, guard and trigger; the wraparound rubber grip; the mag's base.
  add(g, profileGeo('dgFrame', [[-0.07, 0.026], [0.16, 0.026], [0.16, 0.008], [0.07, 0.004], [-0.03, 0.008]], 0.03, 0.004), M.metal)
  box(g, [0.012, 0.02, 0.014], -0.098, 0.052, M.metalDark, 0, [0.45, 0, 0])
  box(g, [0.004, 0.008, 0.024], -0.05, 0.03, M.metalDark, -0.0165)
  add(g, profileGeo('dgGuard', [[0.0, 0.008], [0.074, 0.008], [0.074, 0.0], [0.074, -0.03], [0.0, -0.03]], 0.008, 0.002), M.metal)
  box(g, [0.006, 0.02, 0.008], 0.026, -0.008, M.steel)
  add(g, profileGeo('dgGrip', [[-0.042, 0.008], [0.014, 0.008], [-0.004, -0.118], [-0.064, -0.112], [-0.054, -0.05], [-0.066, 0.006]], 0.034, 0.006), M.rubber)
  for (let i = 0; i < 5; i++) box(g, [0.036, 0.004, 0.006], -0.03 - i * 0.004, -0.02 - i * 0.02, M.inset)
  const mag = new Group()
  mag.name = 'mag'
  const ext = att.mag === 'extended'
  box(mag, [0.03, ext ? 0.03 : 0.01, 0.05], -0.04, ext ? -0.13 : -0.118, M.metalDark, 0, [-0.21, 0, 0])
  cartridge(mag, -0.015, 0.01, 0, 0.032, 0.0065)
  g.add(mag)
  // Optic on the barrel's rail; else its sights: a post up front, a notch on the slide.
  const optic = addOptic(g, att.optic, 0.12, 0.08, true)
  if (optic) marker(g, 'sight', optic.sightU, optic.sightV)
  else {
    box(g, [0.005, 0.012, 0.01], 0.165, 0.084, M.metalDark)
    add(g, cached('dgDot', () => new SphereGeometry(0.0016, 8, 6)), M.red, [0, 0.088, -0.16])
    box(slide, [0.026, 0.01, 0.01], -0.078, 0.079, M.metalDark)
    marker(g, 'sight', -0.11, 0.087)
  }
  if (att.under === 'laser') addUnder(g, 'laser', 0.13, 0.014, true)
  const tip = addMuzzle(g, att.muzzle === 'compensator' ? 'compensator' : 'none-pistol', 0.179, 0.046, 0.0105)
  marker(g, 'muzzle', tip + 0.006, 0.046)
  marker(g, 'leftHand', -0.03, -0.06)
  marker(g, 'eject', 0.0, 0.065, 0.018)
  return g
}

export const PISTOLS = { colonel: buildColonel, dragoon: buildDragoon }
