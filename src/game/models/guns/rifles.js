import { Group, SphereGeometry, TorusGeometry } from 'three'

import { add, box, cached, cartridge, coupleMag, crossPin, finishGun, M, profileGeo, rail, tube } from '../weaponKit.js'

/**
 * Assault rifles beyond the VX-7. Same conventions as weaponModels.js: barrel
 * down -Z, origin at the trigger, (u, v) = metres forward, up; the hand on
 * each pistol grip sits where the VX-7's does, so they all hold alike.
 */

/** A rifle's trigger guard and trigger (the guard spans u0..u1). */
function guardAndTrigger(g, key, u0, u1, top, mat = M.metalDark) {
  add(g, profileGeo(`${key}Guard`, [[u0, top], [u1, top], [u1, top - 0.006], [u0 + 0.008, top - 0.034], [u0, top - 0.034]], 0.006, 0.001), mat)
  add(g, profileGeo(`${key}Trig`, [[0.026, top - 0.004], [0.036, top - 0.004], [0.035, top - 0.018], [0.03, top - 0.032], [0.026, top - 0.028]], 0.006, 0.0008), M.steel)
}

/** Volk-47: stamped steel, wood furniture, the long selector, a curved steel mag. */
function buildVolk(att) {
  const g = new Group()
  // Receiver, its rivets and port; the dust cover rounded over the top with its rib.
  add(g, profileGeo('vkRecv', [[-0.135, -0.016], [0.205, -0.016], [0.205, 0.046], [-0.12, 0.046], [-0.135, 0.032]], 0.044), M.metalDark)
  add(g, profileGeo('vkCover', [[-0.13, 0.046], [0.17, 0.046], [0.168, 0.056], [0.158, 0.063], [-0.1, 0.063], [-0.124, 0.056]], 0.04, 0.006), M.metal)
  box(g, [0.008, 0.004, 0.2], 0.03, 0.065, M.metal)
  box(g, [0.012, 0.008, 0.012], -0.122, 0.05, M.steel) // cover latch
  for (const [u, v] of [[-0.11, 0.0], [-0.11, 0.03], [0.185, 0.0], [0.185, 0.03], [0.02, -0.008]]) {
    for (const x of [-1, 1]) crossPin(g, 0.003, 0.002, u, v, M.steel, x * 0.0225)
  }
  box(g, [0.004, 0.022, 0.07], 0.06, 0.03, M.inset, 0.0225)
  // Long flat selector down the right side; the bolt carrier's handle.
  box(g, [0.004, 0.014, 0.1], 0.05, 0.034, M.steel, 0.0245, [-0.12, 0, 0])
  box(g, [0.006, 0.006, 0.03], 0.13, 0.038, M.steel, 0.026)
  add(g, cached('vkKnob', () => new SphereGeometry(0.0065, 12, 8)), M.steel, [0.034, 0.038, -0.13])
  // Rear sight block over the front trunnion: tangent leaf and slider.
  box(g, [0.03, 0.016, 0.05], 0.21, 0.056, M.metalDark)
  box(g, [0.02, 0.006, 0.07], 0.215, 0.068, M.metalDark)
  box(g, [0.024, 0.008, 0.014], 0.22, 0.073, M.steel)
  // Wood handguards: lower round the barrel, upper over the gas tube; the retainer.
  add(g, profileGeo('vkHandLo', [[0.21, -0.012], [0.42, -0.008], [0.42, 0.036], [0.21, 0.036]], 0.046, 0.008), M.walnut)
  for (let i = 0; i < 3; i++) for (const x of [-1, 1]) box(g, [0.003, 0.012, 0.04], 0.27 + i * 0.05, 0.012, M.inset, x * 0.0232)
  box(g, [0.05, 0.05, 0.012], 0.425, 0.012, M.metalDark)
  add(g, profileGeo('vkHandUp', [[0.24, 0.046], [0.4, 0.046], [0.4, 0.062], [0.39, 0.072], [0.25, 0.072], [0.24, 0.062]], 0.036, 0.006), M.walnut)
  tube(g, 0.0105, 0.4, 0.47, 0.058, M.metalDark, 14)
  box(g, [0.028, 0.044, 0.03], 0.475, 0.045, M.metalDark)
  // Barrel, cleaning rod under it, front sight block with its ears and post.
  tube(g, 0.0092, 0.42, 0.79, 0.022, M.metalDark, 16)
  tube(g, 0.003, 0.43, 0.73, 0.004, M.steel, 8)
  box(g, [0.024, 0.034, 0.03], 0.74, 0.04, M.metalDark)
  for (const x of [-0.009, 0.009]) box(g, [0.004, 0.032, 0.012], 0.74, 0.07, M.metalDark, x)
  box(g, [0.0035, 0.022, 0.0035], 0.74, 0.066, M.metalDark)
  // Bakelite grip, guard, trigger; wood stock with a steel butt plate and sling loop.
  add(g, profileGeo('vkGrip', [[-0.022, -0.016], [0.034, -0.016], [0.008, -0.125], [-0.04, -0.12], [-0.03, -0.06]], 0.032, 0.006), M.bakelite)
  guardAndTrigger(g, 'vk', -0.004, 0.082, -0.016)
  add(g, profileGeo('vkStock', [[-0.13, 0.032], [-0.13, -0.014], [-0.47, -0.072], [-0.49, -0.07], [-0.49, 0.042], [-0.3, 0.036]], 0.042, 0.008), M.walnut)
  box(g, [0.046, 0.118, 0.01], -0.494, -0.015, M.metalDark, 0, [0.08, 0, 0])
  add(g, cached('vkSling', () => new TorusGeometry(0.008, 0.002, 6, 12)), M.steel, [0, -0.05, 0.4], [0, Math.PI / 2, 0])
  // The banana mag: curved steel, ribbed down its sides, a round at the lips.
  const mag = new Group()
  mag.name = 'mag'
  const ext = att.mag === 'extended'
  const pts = ext
    ? [[0.07, -0.016], [0.13, -0.016], [0.158, -0.11], [0.222, -0.24], [0.165, -0.268], [0.108, -0.13]]
    : [[0.07, -0.016], [0.13, -0.016], [0.152, -0.09], [0.196, -0.175], [0.142, -0.198], [0.104, -0.112]]
  add(mag, profileGeo(ext ? 'vkMagX' : 'vkMag', pts, 0.03, 0.004), M.metalDark)
  const ribs = ext ? [[0.13, -0.08], [0.152, -0.13], [0.176, -0.18]] : [[0.125, -0.07], [0.142, -0.11], [0.16, -0.15]]
  for (const [u, v] of ribs) for (const x of [-1, 1]) box(mag, [0.003, 0.03, 0.006], u, v, M.metal, x * 0.0158, [0.5, 0, 0])
  cartridge(mag, 0.115, -0.012, 0, 0.05, 0.0052)
  if (att.mag === 'fast') coupleMag(mag, -0.034, -0.07, 0.13)
  g.add(mag)
  // An optic sits on a rail along the dust cover.
  if (att.optic !== 'iron') rail(g, -0.09, 0.15, 0.064, 0.022)
  finishGun(g, att, {
    optic: [0.03, 0.073],
    ironSight: [0.17, 0.078],
    muzzleKind: 'slant',
    muzzle: [0.79, 0.022],
    bore: 0.0092,
    under: [0.33, -0.01],
    hand: [0.33, -0.006],
    eject: [0.07, 0.035, 0.026],
    charge: [0.13, 0.038, 0.034],
  })
  return g
}

/** Talon H: tall aluminium upper with a full-length rail, polymer lower, folding stock. */
function buildTalon(att) {
  const g = new Group()
  // Upper (tan) with side rails up front, the ejection port, the left-side charging handle.
  add(g, profileGeo('tlUpper', [[-0.12, 0.0], [0.43, 0.0], [0.43, 0.088], [-0.1, 0.088], [-0.12, 0.074]], 0.058, 0.006), M.tan)
  for (const x of [-1, 1]) {
    box(g, [0.006, 0.014, 0.16], 0.33, 0.044, M.tan, x * 0.031)
    for (let i = 0; i < 12; i++) box(g, [0.004, 0.018, 0.005], 0.258 + i * 0.012, 0.044, M.tan, x * 0.0345)
  }
  box(g, [0.004, 0.024, 0.07], 0.06, 0.05, M.inset, 0.0295)
  box(g, [0.014, 0.012, 0.024], 0.28, 0.068, M.metalDark, -0.036)
  rail(g, -0.1, 0.43, 0.088, 0.022)
  // Lower (black polymer) with the magwell, selector, mag release.
  add(g, profileGeo('tlLower', [[-0.07, 0.002], [0.17, 0.002], [0.17, -0.022], [0.14, -0.05], [0.055, -0.05], [0.05, -0.022], [-0.06, -0.018]], 0.052), M.polymer)
  for (const x of [-1, 1]) crossPin(g, 0.0075, 0.004, -0.03, -0.004, M.metalDark, x * 0.028)
  crossPin(g, 0.006, 0.006, 0.12, -0.02, M.metalDark, 0.028)
  // Barrel (short 7.62), gas block with a folded front sight.
  tube(g, 0.0112, 0.43, 0.73, 0.038, M.metalDark, 16)
  box(g, [0.03, 0.03, 0.03], 0.45, 0.04, M.metalDark)
  box(g, [0.012, 0.012, 0.03], 0.405, 0.095, M.metalDark)
  // Grip, guard, trigger; the folding stock with its cheek riser and butt pad.
  add(g, profileGeo('tlGrip', [[-0.018, -0.018], [0.04, -0.02], [0.008, -0.13], [-0.045, -0.125], [-0.032, -0.06]], 0.034, 0.006), M.polymer)
  guardAndTrigger(g, 'tl', 0.0, 0.075, -0.02, M.polymer)
  add(g, profileGeo('tlStock', [[-0.12, 0.074], [-0.12, -0.012], [-0.34, -0.05], [-0.43, -0.06], [-0.43, 0.084], [-0.3, 0.08]], 0.05, 0.008), M.tan)
  box(g, [0.052, 0.06, 0.13], -0.27, 0.01, M.inset)
  box(g, [0.042, 0.02, 0.15], -0.33, 0.09, M.polymer)
  box(g, [0.056, 0.15, 0.016], -0.437, 0.012, M.rubber)
  crossPin(g, 0.008, 0.06, -0.125, 0.04, M.metalDark)
  // Straight steel 7.62 mag.
  const mag = new Group()
  mag.name = 'mag'
  const ext = att.mag === 'extended'
  add(mag, profileGeo(ext ? 'tlMagX' : 'tlMag', ext ? [[0.058, -0.03], [0.128, -0.03], [0.144, -0.22], [0.072, -0.226]] : [[0.058, -0.03], [0.128, -0.03], [0.138, -0.16], [0.066, -0.165]], 0.032, 0.004), M.metalDark)
  box(mag, [0.036, 0.012, 0.078], ext ? 0.108 : 0.102, ext ? -0.224 : -0.163, M.metalDark)
  cartridge(mag, 0.11, -0.026, 0, 0.055, 0.0058)
  if (att.mag === 'fast') coupleMag(mag, -0.038, -0.08, 0.1)
  g.add(mag)
  finishGun(g, att, {
    optic: [0.04, 0.097],
    irons: (gg) => {
      box(gg, [0.03, 0.03, 0.014], -0.08, 0.106, M.metalDark)
      add(gg, cached('aperture', () => new TorusGeometry(0.006, 0.0022, 8, 16)), M.metalDark, [0, 0.126, 0.08])
      box(gg, [0.026, 0.03, 0.012], 0.4, 0.106, M.metalDark)
      box(gg, [0.0035, 0.024, 0.0035], 0.4, 0.122, M.metalDark)
    },
    ironSight: [-0.11, 0.126],
    muzzle: [0.73, 0.038],
    bore: 0.0112,
    under: [0.34, 0.0],
    hand: [0.34, 0.004],
    eject: [0.07, 0.05, 0.032],
    charge: [0.28, 0.068, -0.04],
  })
  return g
}

/** Strix F2: bullpup, the magazine behind the grip, one smooth polymer shell. */
function buildStrix(att) {
  const g = new Group()
  // The shell: butt to the front grip, the cheek rest over the action.
  add(g, profileGeo('sxShell', [[-0.43, -0.07], [-0.36, -0.07], [-0.24, -0.032], [0.1, -0.032], [0.27, -0.004], [0.3, 0.03], [0.3, 0.074], [-0.43, 0.074]], 0.056, 0.008), M.olive)
  box(g, [0.058, 0.02, 0.2], -0.3, 0.083, M.olive) // cheek rest
  box(g, [0.06, 0.15, 0.016], -0.437, 0.002, M.rubber)
  // Ejection port by the cheek (right), vents and the left-side charging handle.
  box(g, [0.004, 0.022, 0.06], -0.13, 0.042, M.inset, 0.0285)
  for (let i = 0; i < 4; i++) for (const x of [-1, 1]) box(g, [0.004, 0.022, 0.008], 0.15 + i * 0.026, 0.035, M.inset, x * 0.0285)
  box(g, [0.012, 0.012, 0.02], 0.12, 0.058, M.metalDark, -0.034)
  rail(g, -0.26, 0.24, 0.074, 0.022)
  // Big full-hand trigger guard joining the front grip; the pistol grip.
  add(g, profileGeo('sxGuard', [[-0.02, -0.03], [0.14, -0.03], [0.14, -0.04], [0.11, -0.12], [0.08, -0.12], [0.1, -0.05], [0.005, -0.05]], 0.03, 0.004), M.olive)
  add(g, profileGeo('sxTrig', [[0.026, -0.03], [0.036, -0.03], [0.035, -0.044], [0.03, -0.056], [0.026, -0.052]], 0.006, 0.0008), M.steel)
  add(g, profileGeo('sxGrip', [[-0.018, -0.03], [0.036, -0.03], [0.008, -0.13], [-0.043, -0.124], [-0.03, -0.06]], 0.034, 0.006), M.olive)
  // Barrel out of the front.
  tube(g, 0.0095, 0.3, 0.52, 0.045, M.metalDark, 16)
  // The magazine, behind the grip.
  const mag = new Group()
  mag.name = 'mag'
  const ext = att.mag === 'extended'
  add(mag, profileGeo(ext ? 'sxMagX' : 'sxMag', ext ? [[-0.205, -0.03], [-0.145, -0.03], [-0.125, -0.25], [-0.188, -0.258]] : [[-0.205, -0.03], [-0.145, -0.03], [-0.132, -0.18], [-0.192, -0.186]], 0.03, 0.004), M.polymer)
  for (let i = 0; i < 3; i++) box(mag, [0.032, 0.004, 0.05], -0.162, -0.07 - i * 0.03, M.inset, 0, [-0.1, 0, 0])
  cartridge(mag, -0.165, -0.027, 0, 0.045, 0.0048)
  if (att.mag === 'fast') coupleMag(mag, -0.034, -0.08, -0.17)
  g.add(mag)
  finishGun(g, att, {
    optic: [-0.1, 0.083],
    irons: (gg) => {
      box(gg, [0.026, 0.026, 0.012], -0.22, 0.092, M.metalDark)
      add(gg, cached('aperture', () => new TorusGeometry(0.006, 0.0022, 8, 16)), M.metalDark, [0, 0.108, 0.22])
      box(gg, [0.022, 0.026, 0.01], 0.2, 0.092, M.metalDark)
      box(gg, [0.0035, 0.02, 0.0035], 0.2, 0.106, M.metalDark)
    },
    ironSight: [-0.25, 0.108],
    muzzle: [0.52, 0.045],
    bore: 0.0095,
    under: [0.2, -0.016],
    hand: [0.21, -0.012],
    eject: [-0.13, 0.045, 0.031],
    charge: [0.12, 0.058, -0.04],
  })
  return g
}

/** Harrier 36: polymer everything, a carry handle with its own sight, a skeleton stock. */
function buildHarrier(att) {
  const g = new Group()
  // Receiver (grey-green polymer) and the ventilated handguard.
  add(g, profileGeo('hrRecv', [[-0.1, -0.022], [0.3, -0.022], [0.3, 0.062], [-0.08, 0.062], [-0.1, 0.044]], 0.05, 0.006), M.polymer)
  add(g, profileGeo('hrHand', [[0.3, -0.014], [0.53, -0.006], [0.53, 0.058], [0.3, 0.062]], 0.054, 0.008), M.polymer)
  for (let i = 0; i < 6; i++) for (const x of [-1, 1]) box(g, [0.004, 0.014, 0.022], 0.33 + i * 0.033, 0.024, M.inset, x * 0.0272)
  box(g, [0.004, 0.022, 0.06], 0.07, 0.035, M.inset, 0.0252)
  for (const u of [-0.06, 0.22]) crossPin(g, 0.004, 0.052, u, 0.02, M.steel)
  // Barrel, front sight on the gas block.
  tube(g, 0.0095, 0.53, 0.78, 0.03, M.metalDark, 16)
  box(g, [0.026, 0.026, 0.026], 0.55, 0.035, M.metalDark)
  // Grip, guard, trigger.
  add(g, profileGeo('hrGrip', [[-0.02, -0.022], [0.036, -0.024], [0.008, -0.13], [-0.042, -0.125], [-0.03, -0.06]], 0.034, 0.006), M.polymer)
  guardAndTrigger(g, 'hr', 0.0, 0.07, -0.024, M.polymer)
  // Skeleton folding stock: a frame with a big cut-out and a butt pad.
  add(g, profileGeo('hrStock', [[-0.1, 0.044], [-0.1, -0.012], [-0.3, -0.04], [-0.42, -0.05], [-0.42, 0.06], [-0.24, 0.05]], 0.042, 0.006), M.polymer)
  box(g, [0.044, 0.05, 0.16], -0.28, 0.008, M.inset)
  box(g, [0.05, 0.12, 0.014], -0.424, 0.006, M.rubber)
  // Carry handle with the charging handle under its front, unless an optic's rail replaces it.
  if (att.optic === 'iron') {
    add(g, profileGeo('hrHandle', [[-0.06, 0.062], [0.22, 0.062], [0.22, 0.104], [0.2, 0.112], [-0.04, 0.112], [-0.06, 0.1]], 0.03, 0.006), M.polymer)
    box(g, [0.032, 0.03, 0.18], 0.08, 0.083, M.inset)
    box(g, [0.024, 0.02, 0.018], -0.03, 0.122, M.polymer)
    add(g, cached('aperture', () => new TorusGeometry(0.006, 0.0022, 8, 16)), M.metalDark, [0, 0.131, 0.03])
    box(g, [0.0035, 0.024, 0.0035], 0.55, 0.06, M.metalDark)
  } else {
    rail(g, -0.07, 0.24, 0.062, 0.022)
  }
  box(g, [0.01, 0.008, 0.03], 0.16, 0.068, M.metalDark, 0, [0, 0, 0])
  // Smoky polymer mag with its coupling lugs.
  const mag = new Group()
  mag.name = 'mag'
  const ext = att.mag === 'extended'
  const smoke = M.smoky
  add(mag, profileGeo(ext ? 'hrMagX' : 'hrMag', ext ? [[0.055, -0.022], [0.12, -0.022], [0.16, -0.21], [0.2, -0.28], [0.13, -0.29], [0.08, -0.16]] : [[0.055, -0.022], [0.12, -0.022], [0.145, -0.12], [0.17, -0.19], [0.1, -0.2], [0.07, -0.12]], 0.032, 0.004), smoke)
  for (const x of [-1, 1]) box(mag, [0.004, 0.012, 0.02], ext ? 0.12 : 0.1, -0.09, smoke, x * 0.018)
  for (let i = 0; i < 5; i++) cartridge(mag, 0.098 + i * 0.006, -0.028 - i * 0.022, 0.006, 0.045, 0.0048)
  if (att.mag === 'fast') coupleMag(mag, -0.038, -0.08, 0.11)
  g.add(mag)
  finishGun(g, att, {
    optic: [0.06, 0.071],
    ironSight: [-0.06, 0.131],
    muzzle: [0.78, 0.03],
    bore: 0.0095,
    under: [0.43, -0.009],
    hand: [0.43, -0.006],
    eject: [0.07, 0.04, 0.028],
    charge: [0.16, 0.068, 0],
  })
  return g
}

export const RIFLES = { volk: buildVolk, talon: buildTalon, strix: buildStrix, harrier: buildHarrier }

