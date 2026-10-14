import { CylinderGeometry, Group, TorusGeometry } from 'three'

import { add, box, cached, cartridge, coupleMag, crossPin, finishGun, M, profileGeo, rail, tube } from '../weaponKit.js'

/**
 * Submachine guns beyond the VK-9. Conventions as in weaponModels.js; each
 * pistol grip sits where the VK-9's does, so the hand closes on it the same.
 */

/** Wasp 45: a boxy polymer .45 with a side-folding skeleton stock and a straight mag. */
function buildWasp(att) {
  const g = new Group()
  add(g, profileGeo('wsRecv', [[-0.1, -0.012], [0.27, -0.012], [0.27, 0.068], [-0.085, 0.068], [-0.1, 0.05]], 0.05, 0.006), M.polymer)
  // Vent slots along the forend, the ejection port, a seam line.
  for (let i = 0; i < 4; i++) for (const x of [-1, 1]) box(g, [0.004, 0.026, 0.012], 0.19 + i * 0.02, 0.028, M.inset, x * 0.0252)
  box(g, [0.004, 0.02, 0.045], 0.065, 0.045, M.inset, 0.0252)
  box(g, [0.052, 0.002, 0.33], 0.085, 0.02, M.inset)
  for (const u of [-0.05, 0.17]) crossPin(g, 0.004, 0.052, u, 0.0, M.steel)
  rail(g, -0.08, 0.25, 0.068, 0.02)
  box(g, [0.012, 0.012, 0.022], 0.2, 0.054, M.metalDark, -0.03)
  // Grip with finger grooves and the integrated guard.
  add(g, profileGeo('wsGrip', [[-0.022, -0.012], [0.032, -0.012], [0.006, -0.118], [-0.042, -0.112], [-0.03, -0.05]], 0.032, 0.006), M.polymer)
  add(g, profileGeo('wsGuard', [[-0.002, -0.012], [0.07, -0.012], [0.07, -0.02], [0.012, -0.046], [-0.002, -0.046]], 0.012, 0.003), M.polymer)
  box(g, [0.005, 0.02, 0.006], 0.026, -0.024, M.steel)
  // Skeleton stock, folded out; its hinge and pad.
  add(g, profileGeo('wsStock', [[-0.1, 0.05], [-0.1, 0.0], [-0.36, -0.032], [-0.375, -0.032], [-0.375, 0.062], [-0.2, 0.056]], 0.036, 0.006), M.polymer)
  box(g, [0.038, 0.05, 0.17], -0.25, 0.018, M.inset)
  box(g, [0.04, 0.1, 0.012], -0.38, 0.014, M.rubber)
  crossPin(g, 0.008, 0.05, -0.1, 0.03, M.metalDark)
  // Barrel stub out of the front.
  tube(g, 0.0095, 0.27, 0.33, 0.034, M.metalDark, 14)
  // Straight .45 mag.
  const mag = new Group()
  mag.name = 'mag'
  const ext = att.mag === 'extended'
  add(mag, profileGeo(ext ? 'wsMagX' : 'wsMag', ext ? [[0.055, -0.012], [0.115, -0.012], [0.12, -0.24], [0.06, -0.24]] : [[0.055, -0.012], [0.115, -0.012], [0.118, -0.17], [0.058, -0.17]], 0.03, 0.004), M.polymer)
  for (let i = 0; i < 3; i++) box(mag, [0.032, 0.004, 0.05], 0.087, -0.06 - i * 0.03, M.inset)
  cartridge(mag, 0.09, -0.01, 0, 0.032, 0.0058)
  if (att.mag === 'fast') coupleMag(mag, -0.034, -0.07, 0.085)
  g.add(mag)
  finishGun(g, att, {
    optic: [0.06, 0.077],
    irons: (gg) => {
      box(gg, [0.024, 0.022, 0.012], -0.06, 0.08, M.metalDark)
      box(gg, [0.004, 0.02, 0.004], 0.23, 0.08, M.metalDark)
    },
    ironSight: [-0.09, 0.088],
    muzzleKind: 'none-pistol',
    muzzle: [0.33, 0.034],
    bore: 0.0095,
    under: [0.2, -0.012],
    hand: [0.21, -0.01],
    eject: [0.065, 0.045, 0.027],
    charge: [0.2, 0.054, -0.035],
  })
  return g
}

/** Mako 57: a rounded bullpup shell, thumbhole grip, the 50-round mag lying along the top. */
function buildMako(att) {
  const g = new Group()
  add(g, profileGeo('mkShell', [[-0.32, -0.05], [-0.3, -0.088], [-0.22, -0.088], [-0.15, -0.042], [0.12, -0.042], [0.2, -0.02], [0.225, 0.015], [0.225, 0.056], [-0.32, 0.056]], 0.062, 0.01), M.tan)
  // Thumbhole grip and the hand stop up front (both part of the shell).
  add(g, profileGeo('mkGrip', [[-0.034, -0.042], [0.03, -0.042], [0.01, -0.104], [-0.04, -0.104]], 0.038, 0.008), M.polymer)
  box(g, [0.064, 0.026, 0.05], 0.0, -0.03, M.inset)
  add(g, profileGeo('mkFront', [[0.08, -0.042], [0.16, -0.042], [0.15, -0.088], [0.104, -0.094]], 0.044, 0.008), M.polymer)
  box(g, [0.005, 0.02, 0.006], 0.03, -0.05, M.steel)
  box(g, [0.066, 0.12, 0.012], -0.322, -0.016, M.rubber)
  // Ejection is downward, behind the grip; the left-side charging handle; seam lines.
  box(g, [0.03, 0.004, 0.05], -0.12, -0.06, M.inset)
  box(g, [0.012, 0.012, 0.02], 0.1, 0.025, M.metalDark, -0.035)
  for (const v of [0.0, 0.03]) box(g, [0.064, 0.002, 0.36], -0.05, v, M.inset)
  // Barrel stub.
  tube(g, 0.0085, 0.225, 0.26, 0.0, M.metalDark, 14)
  // The top magazine: smoked polymer with the rounds showing along it.
  const mag = new Group()
  mag.name = 'mag'
  const ext = att.mag === 'extended'
  const len = ext ? 0.5 : 0.44
  box(mag, [0.054, 0.028, len], -0.05 - (ext ? 0.03 : 0), 0.07, M.smoky)
  for (let i = 0; i < 12; i++) box(mag, [0.046, 0.004, 0.006], -0.24 + i * 0.03, 0.0855, M.brass)
  box(mag, [0.056, 0.01, 0.03], -0.27 - (ext ? 0.06 : 0), 0.072, M.polymer)
  if (att.mag === 'fast') {
    box(mag, [0.05, 0.006, len * 0.9], -0.05, 0.088, M.polymer)
  }
  g.add(mag)
  // Its sight rides over the front of the magazine.
  if (att.optic !== 'iron') rail(g, -0.1, 0.08, 0.086, 0.02)
  finishGun(g, att, {
    optic: [-0.02, 0.095],
    irons: (gg) => {
      // The built-in ring sight housing.
      box(gg, [0.03, 0.03, 0.05], -0.02, 0.1, M.polymer)
      add(gg, cached('mkRing', () => new TorusGeometry(0.009, 0.0025, 8, 18)), M.metalDark, [0, 0.118, 0.006])
    },
    ironSight: [-0.05, 0.118],
    muzzle: [0.26, 0.0],
    bore: 0.0085,
    under: [0.19, -0.02],
    hand: [0.13, -0.06],
    eject: [-0.12, -0.06, 0.02],
    charge: [0.1, 0.025, -0.04],
  })
  return g
}

/** Ripper V: rail-topped upper, the angular block of the recoil system, the mag forward of the guard. */
function buildRipper(att) {
  const g = new Group()
  add(g, profileGeo('rpUpper', [[-0.12, 0.02], [0.26, 0.02], [0.26, 0.078], [-0.1, 0.078], [-0.12, 0.062]], 0.05, 0.006), M.metalDark)
  add(g, profileGeo('rpBlock', [[-0.035, 0.02], [0.27, 0.02], [0.27, -0.012], [0.235, -0.07], [0.16, -0.075], [0.1, -0.03], [-0.03, -0.022]], 0.056, 0.008), M.polymer)
  for (let i = 0; i < 3; i++) for (const x of [-1, 1]) box(g, [0.004, 0.01, 0.04], 0.15 + i * 0.03, -0.01, M.inset, x * 0.0282, [0.6, 0, 0])
  box(g, [0.004, 0.018, 0.05], 0.06, 0.05, M.inset, 0.0252)
  rail(g, -0.1, 0.25, 0.078, 0.02)
  box(g, [0.012, 0.012, 0.022], 0.2, 0.062, M.metal, -0.03)
  // Barrel shroud with slots, the barrel out of it.
  box(g, [0.03, 0.034, 0.11], 0.315, 0.046, M.metalDark)
  for (let i = 0; i < 3; i++) for (const x of [-1, 1]) box(g, [0.003, 0.014, 0.022], 0.285 + i * 0.03, 0.046, M.inset, x * 0.0152)
  tube(g, 0.0085, 0.37, 0.385, 0.046, M.metalDark, 14)
  // AR-style grip and guard; the collapsible stock on its tube.
  add(g, profileGeo('rpGrip', [[-0.02, -0.022], [0.036, -0.024], [0.006, -0.124], [-0.042, -0.118], [-0.03, -0.06]], 0.032, 0.006), M.polymer)
  add(g, profileGeo('rpGuard', [[-0.004, -0.022], [0.098, -0.03], [0.098, -0.036], [0.008, -0.05], [-0.004, -0.05]], 0.006, 0.001), M.metalDark)
  box(g, [0.005, 0.02, 0.006], 0.026, -0.034, M.steel)
  tube(g, 0.014, -0.3, -0.12, 0.05, M.metalDark)
  add(g, profileGeo('rpStock', [[-0.38, -0.04], [-0.26, 0.014], [-0.22, 0.04], [-0.22, 0.07], [-0.38, 0.07]], 0.046, 0.008), M.polymer)
  box(g, [0.05, 0.11, 0.014], -0.385, 0.014, M.rubber)
  // Long double-stack mag forward of the guard.
  const mag = new Group()
  mag.name = 'mag'
  const ext = att.mag === 'extended'
  add(mag, profileGeo(ext ? 'rpMagX' : 'rpMag', ext ? [[0.166, -0.07], [0.212, -0.07], [0.222, -0.29], [0.176, -0.29]] : [[0.166, -0.07], [0.212, -0.07], [0.218, -0.2], [0.172, -0.2]], 0.028, 0.004), M.polymer)
  box(mag, [0.032, 0.014, 0.05], ext ? 0.199 : 0.195, ext ? -0.29 : -0.2, M.polymer)
  if (att.mag === 'fast') coupleMag(mag, -0.032, -0.12, 0.19)
  g.add(mag)
  finishGun(g, att, {
    optic: [0.04, 0.087],
    irons: (gg) => {
      box(gg, [0.024, 0.026, 0.012], -0.08, 0.092, M.metalDark)
      add(gg, cached('aperture', () => new TorusGeometry(0.006, 0.0022, 8, 16)), M.metalDark, [0, 0.11, 0.08])
      box(gg, [0.022, 0.024, 0.01], 0.23, 0.092, M.metalDark)
      box(gg, [0.0035, 0.02, 0.0035], 0.23, 0.106, M.metalDark)
    },
    ironSight: [-0.1, 0.11],
    muzzle: [0.385, 0.046],
    bore: 0.0085,
    under: [0.25, -0.048],
    hand: [0.205, -0.08],
    eject: [0.06, 0.055, 0.028],
    charge: [0.2, 0.062, -0.036],
  })
  return g
}

/** Rattler: a stamped box with a ribbed side, the magazine up through the grip, a folding stock. */
function buildRattler(att) {
  const g = new Group()
  add(g, profileGeo('rtRecv', [[-0.11, 0.0], [0.2, 0.0], [0.2, 0.058], [-0.11, 0.058]], 0.046, 0.005), M.metalDark)
  for (const v of [0.016, 0.04]) for (const x of [-1, 1]) box(g, [0.003, 0.006, 0.27], 0.045, v, M.inset, x * 0.0232)
  box(g, [0.004, 0.018, 0.045], 0.05, 0.03, M.inset, 0.0235)
  // Top cover and its cocking knob.
  box(g, [0.042, 0.01, 0.3], 0.045, 0.062, M.metal)
  add(g, cached('rtKnob', () => new CylinderGeometry(0.0075, 0.0085, 0.012, 14)), M.metal, [0, 0.073, -0.13])
  // Grip (the magazine goes up through it), grip safety, big guard, trigger.
  add(g, profileGeo('rtGrip', [[-0.042, 0.0], [0.026, 0.0], [0.012, -0.124], [-0.046, -0.124]], 0.034, 0.006), M.polymer)
  for (let i = 0; i < 4; i++) for (const x of [-1, 1]) box(g, [0.003, 0.006, 0.05], -0.017, -0.03 - i * 0.022, M.inset, x * 0.0172)
  box(g, [0.014, 0.05, 0.01], -0.046, -0.05, M.metalDark, 0, [0.12, 0, 0])
  add(g, profileGeo('rtGuard', [[0.0, 0.0], [0.085, 0.0], [0.085, -0.008], [0.03, -0.05], [0.0, -0.05]], 0.008, 0.002), M.metalDark)
  box(g, [0.005, 0.022, 0.006], 0.04, -0.016, M.steel)
  // Barrel nut and barrel; front sight ears; rear sight.
  tube(g, 0.016, 0.195, 0.215, 0.03, M.metal, 16)
  tube(g, 0.0085, 0.215, 0.27, 0.03, M.metalDark, 14)
  for (const x of [-0.008, 0.008]) box(g, [0.004, 0.024, 0.012], 0.18, 0.078, M.metalDark, x)
  box(g, [0.0035, 0.018, 0.0035], 0.18, 0.074, M.metalDark)
  box(g, [0.022, 0.016, 0.012], -0.085, 0.074, M.metalDark)
  // Folding stock, unfolded: two struts, hinge, butt plate.
  for (const x of [-0.016, 0.016]) box(g, [0.006, 0.006, 0.24], -0.23, 0.03, M.metalDark, x)
  crossPin(g, 0.007, 0.046, -0.11, 0.03, M.metal)
  box(g, [0.042, 0.09, 0.008], -0.354, 0.012, M.metalDark)
  // The magazine: up inside the grip, the rest below.
  const mag = new Group()
  mag.name = 'mag'
  const ext = att.mag === 'extended'
  box(mag, [0.026, ext ? 0.17 : 0.1, 0.034], -0.013, ext ? -0.186 : -0.151, M.metalDark, 0, [-0.12, 0, 0])
  box(mag, [0.03, 0.01, 0.038], ext ? -0.002 : -0.006, ext ? -0.271 : -0.2, M.metalDark, 0, [-0.12, 0, 0])
  if (att.mag === 'fast') coupleMag(mag, -0.03, -0.17, -0.01)
  g.add(mag)
  if (att.optic !== 'iron') rail(g, -0.07, 0.12, 0.067, 0.02)
  finishGun(g, att, {
    optic: [0.02, 0.076],
    ironSight: [-0.11, 0.081],
    muzzle: [0.27, 0.03],
    bore: 0.0085,
    under: [0.13, 0.0],
    hand: [0.14, -0.004],
    eject: [0.05, 0.035, 0.026],
    charge: [0.13, 0.073, 0],
  })
  return g
}

export const SMGS = { wasp: buildWasp, mako: buildMako, ripper: buildRipper, rattler: buildRattler }

