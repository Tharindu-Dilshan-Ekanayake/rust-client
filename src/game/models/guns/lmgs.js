import { CylinderGeometry, Group, TorusGeometry } from 'three'

import { add, box, cached, cartridge, crossPin, finishGun, M, profileGeo, rail, tube } from '../weaponKit.js'

/**
 * Machine guns beyond the Bulldog. Conventions as in weaponModels.js; the
 * 'mag' group is whatever feeds the gun (an ammo can, a drum, a box), so the
 * reload swaps it.
 */

/** A folded bipod under the gun at u. */
function bipod(g, u, v, len = 0.22) {
  box(g, [0.04, 0.016, 0.03], u, v, M.metalDark)
  for (const x of [-0.015, 0.015]) {
    box(g, [0.008, 0.008, len], u - len / 2, v - 0.004, M.metalDark, x)
    box(g, [0.012, 0.01, 0.016], u - len, v - 0.004, M.rubber, x)
  }
}

/** A short run of belted rounds feeding up into the receiver from the left. */
function beltRun(g, u, v, n = 4) {
  for (let i = 0; i < n; i++) cartridge(g, u, v + i * 0.011, -0.04 + i * 0.003, 0.05, 0.0048)
}

/** Mule 60: square steel receiver and feed cover, ribbed handguard round the gas cylinder, carry handle, polymer butt. */
function buildMule(att) {
  const g = new Group()
  add(g, profileGeo('muRecv', [[-0.16, -0.012], [0.25, -0.012], [0.25, 0.08], [-0.14, 0.08], [-0.16, 0.066]], 0.064), M.metalDark)
  add(g, profileGeo('muCover', [[-0.08, 0.08], [0.2, 0.08], [0.19, 0.1], [-0.07, 0.1]], 0.068, 0.004), M.metal)
  box(g, [0.03, 0.012, 0.024], -0.085, 0.092, M.steel)
  box(g, [0.004, 0.024, 0.07], 0.06, 0.046, M.inset, 0.033)
  for (const u of [-0.1, 0.2]) crossPin(g, 0.0045, 0.066, u, 0.02, M.steel)
  box(g, [0.012, 0.014, 0.03], 0.16, 0.04, M.steel, 0.036)
  // Handguard (ribbed polymer) round the gas cylinder; barrel, carry handle, front sight.
  add(g, profileGeo('muHand', [[0.25, -0.02], [0.47, -0.016], [0.47, 0.06], [0.25, 0.064]], 0.06, 0.008), M.polymer)
  for (let i = 0; i < 7; i++) box(g, [0.062, 0.006, 0.008], 0.27 + i * 0.03, -0.012, M.inset)
  tube(g, 0.0135, 0.47, 0.86, 0.046, M.metalDark, 18)
  tube(g, 0.011, 0.47, 0.6, 0.014, M.metalDark, 14)
  box(g, [0.014, 0.05, 0.014], 0.52, 0.072, M.metalDark)
  box(g, [0.016, 0.014, 0.12], 0.54, 0.1, M.polymer)
  box(g, [0.004, 0.04, 0.004], 0.83, 0.075, M.metalDark)
  bipod(g, 0.82, 0.03, 0.24)
  // Grip, guard; polymer butt with its shoulder rest.
  add(g, profileGeo('muGrip', [[-0.03, -0.012], [0.026, -0.012], [-0.002, -0.128], [-0.058, -0.12]], 0.036, 0.006), M.polymer)
  add(g, profileGeo('muGuard', [[0.0, -0.014], [0.07, -0.014], [0.07, -0.02], [0.006, -0.048], [0.0, -0.048]], 0.007, 0.001), M.metalDark)
  box(g, [0.006, 0.022, 0.006], 0.032, -0.028, M.steel)
  add(g, profileGeo('muStock', [[-0.16, 0.066], [-0.5, 0.066], [-0.5, -0.07], [-0.4, -0.06], [-0.2, -0.012], [-0.16, -0.012]], 0.052, 0.008), M.polymer)
  box(g, [0.056, 0.14, 0.02], -0.505, 0.0, M.rubber)
  box(g, [0.014, 0.05, 0.03], -0.46, 0.09, M.metalDark)
  // A cloth ammo pouch on the left, the belt running up into the feed tray.
  const mag = new Group()
  mag.name = 'mag'
  add(mag, profileGeo('muPouch', [[0.02, -0.02], [0.15, -0.02], [0.155, -0.14], [0.015, -0.14]], 0.07, 0.012), M.olive)
  box(mag, [0.07, 0.014, 0.06], 0.085, -0.02, M.olive, -0.002)
  beltRun(mag, 0.1, -0.012)
  g.add(mag)
  if (att.optic !== 'iron') rail(g, -0.05, 0.16, 0.1, 0.022)
  finishGun(g, att, {
    optic: [0.05, 0.11],
    irons: (gg) => {
      box(gg, [0.03, 0.03, 0.012], -0.04, 0.115, M.metalDark)
      add(gg, cached('lmgAperture', () => new TorusGeometry(0.006, 0.0022, 8, 16)), M.metalDark, [0, 0.133, 0.04])
    },
    ironSight: [-0.08, 0.133],
    muzzle: [0.86, 0.046],
    bore: 0.0135,
    under: [0.36, -0.02],
    hand: [0.36, -0.016],
    eject: [0.06, 0.03, 0.036],
  })
  return g
}

/** Ram PK: stamped receiver, skeleton laminate stock, fluted barrel with its handle, a green ammo can. */
function buildRam(att) {
  const g = new Group()
  add(g, profileGeo('rmRecv', [[-0.13, -0.008], [0.22, -0.008], [0.22, 0.07], [-0.11, 0.07], [-0.13, 0.056]], 0.056), M.metalDark)
  add(g, profileGeo('rmCover', [[-0.1, 0.07], [0.2, 0.07], [0.19, 0.086], [-0.09, 0.086]], 0.058, 0.004), M.metal)
  for (const [u, v] of [[-0.1, 0.0], [0.2, 0.0], [0.05, 0.05]]) for (const x of [-1, 1]) crossPin(g, 0.003, 0.002, u, v, M.steel, x * 0.0285)
  box(g, [0.004, 0.02, 0.06], 0.05, 0.03, M.inset, 0.0285)
  box(g, [0.01, 0.01, 0.034], 0.12, 0.02, M.steel, 0.032)
  // Fluted barrel, gas tube under it, the carry handle clamped on, tall front post, slotted hider.
  tube(g, 0.0125, 0.22, 0.86, 0.04, M.metalDark, 18)
  for (const a of [0.6, -0.6, Math.PI / 2]) box(g, [0.0035, 0.0035, 0.3], 0.5, 0.04 + Math.sin(a) * 0.0115, M.inset, Math.cos(a) * 0.0115)
  tube(g, 0.0095, 0.22, 0.62, 0.012, M.metalDark, 14)
  box(g, [0.024, 0.04, 0.03], 0.62, 0.02, M.metalDark)
  box(g, [0.014, 0.05, 0.014], 0.38, 0.07, M.metalDark)
  box(g, [0.02, 0.014, 0.1], 0.38, 0.1, M.walnut)
  box(g, [0.018, 0.05, 0.02], 0.8, 0.07, M.metalDark)
  box(g, [0.004, 0.026, 0.004], 0.8, 0.104, M.metalDark)
  bipod(g, 0.6, 0.0, 0.24)
  // Grip, guard; the skeleton stock (laminated wood) with its big cut-out.
  add(g, profileGeo('rmGrip', [[-0.028, -0.008], [0.026, -0.008], [0.0, -0.124], [-0.054, -0.118]], 0.034, 0.006), M.polymer)
  add(g, profileGeo('rmGuard', [[0.0, -0.01], [0.072, -0.01], [0.072, -0.016], [0.006, -0.044], [0.0, -0.044]], 0.007, 0.001), M.metalDark)
  box(g, [0.006, 0.022, 0.006], 0.032, -0.024, M.steel)
  add(g, profileGeo('rmStock', [[-0.13, 0.05], [-0.5, 0.05], [-0.5, -0.08], [-0.42, -0.07], [-0.18, -0.008], [-0.13, -0.008]], 0.044, 0.008), M.walnut)
  box(g, [0.046, 0.064, 0.2], -0.3, -0.004, M.inset)
  box(g, [0.05, 0.13, 0.014], -0.505, -0.012, M.metalDark)
  // The ammo can hanging under the receiver, belt rising into the feed.
  const mag = new Group()
  mag.name = 'mag'
  box(mag, [0.07, 0.1, 0.13], 0.06, -0.06, M.olive)
  box(mag, [0.074, 0.012, 0.134], 0.06, -0.012, M.olive)
  add(mag, cached('rmCanHandle', () => new TorusGeometry(0.018, 0.003, 6, 14, Math.PI)), M.metalDark, [-0.038, -0.03, -0.06], [0, Math.PI / 2, 0])
  beltRun(mag, 0.07, -0.008, 3)
  g.add(mag)
  if (att.optic !== 'iron') rail(g, -0.07, 0.16, 0.086, 0.022)
  finishGun(g, att, {
    optic: [0.03, 0.095],
    irons: (gg) => {
      box(gg, [0.024, 0.014, 0.05], 0.15, 0.094, M.metalDark)
      box(gg, [0.016, 0.012, 0.01], 0.13, 0.104, M.metalDark)
    },
    ironSight: [0.0, 0.108],
    muzzle: [0.86, 0.04],
    bore: 0.0125,
    under: [0.3, -0.008],
    hand: [0.3, -0.004],
    eject: [0.05, 0.03, 0.03],
  })
  return g
}

/** Buzzsaw 42: long steel receiver, the perforated barrel jacket, a muzzle booster, a 50-round drum, a dark wood butt. */
function buildBuzzsaw(att) {
  const g = new Group()
  add(g, profileGeo('bzRecv', [[-0.15, -0.006], [0.2, -0.006], [0.2, 0.074], [-0.13, 0.074], [-0.15, 0.06]], 0.058), M.metalDark)
  add(g, profileGeo('bzCover', [[-0.12, 0.074], [0.18, 0.074], [0.17, 0.09], [-0.11, 0.09]], 0.06, 0.004), M.metal)
  box(g, [0.004, 0.02, 0.06], 0.06, 0.035, M.inset, 0.0295)
  box(g, [0.012, 0.012, 0.04], 0.12, 0.03, M.steel, 0.034)
  // The jacket: a square-ish tube full of oval holes, the barrel inside it.
  add(g, profileGeo('bzJacket', [[0.2, 0.004], [0.57, 0.008], [0.57, 0.074], [0.2, 0.074]], 0.054, 0.006), M.metalDark)
  for (let i = 0; i < 7; i++) {
    for (const x of [-1, 1]) box(g, [0.004, 0.026, 0.03], 0.23 + i * 0.048, 0.04, M.inset, x * 0.0272)
    box(g, [0.032, 0.004, 0.03], 0.23 + i * 0.048, 0.074, M.inset)
  }
  // Muzzle booster cone; front sight on the jacket.
  tube(g, 0.018, 0.57, 0.62, 0.04, M.metalDark, 16, 0.013)
  box(g, [0.004, 0.03, 0.004], 0.55, 0.09, M.metalDark)
  bipod(g, 0.55, 0.004, 0.24)
  // Grip and guard (bakelite), the dark wood butt.
  add(g, profileGeo('bzGrip', [[-0.028, -0.006], [0.026, -0.006], [0.0, -0.122], [-0.054, -0.116]], 0.034, 0.006), M.bakelite)
  add(g, profileGeo('bzGuard', [[0.0, -0.008], [0.07, -0.008], [0.07, -0.014], [0.006, -0.042], [0.0, -0.042]], 0.007, 0.001), M.metalDark)
  box(g, [0.006, 0.022, 0.006], 0.032, -0.022, M.steel)
  add(g, profileGeo('bzStock', [[-0.15, 0.06], [-0.5, 0.05], [-0.5, -0.07], [-0.4, -0.06], [-0.2, -0.006], [-0.15, -0.006]], 0.048, 0.008), M.bakelite)
  box(g, [0.05, 0.13, 0.012], -0.505, -0.008, M.metalDark)
  // The drum on the left.
  const mag = new Group()
  mag.name = 'mag'
  add(mag, cached('bzDrum', () => new CylinderGeometry(0.06, 0.06, 0.06, 24)), M.metalDark, [-0.05, -0.04, -0.07], [0, 0, Math.PI / 2])
  add(mag, cached('bzDrumRim', () => new TorusGeometry(0.06, 0.004, 6, 24)), M.metal, [-0.08, -0.04, -0.07], [0, Math.PI / 2, 0])
  box(mag, [0.04, 0.03, 0.03], 0.07, 0.0, M.metalDark, -0.03)
  beltRun(mag, 0.07, 0.01, 2)
  g.add(mag)
  if (att.optic !== 'iron') rail(g, -0.08, 0.15, 0.09, 0.022)
  finishGun(g, att, {
    optic: [0.02, 0.099],
    irons: (gg) => {
      box(gg, [0.02, 0.028, 0.012], 0.15, 0.104, M.metalDark)
    },
    ironSight: [0.0, 0.11],
    muzzleKind: 'none-pistol',
    muzzle: [0.62, 0.04],
    bore: 0.013,
    under: [0.4, 0.004],
    hand: [0.32, 0.0],
    eject: [0.06, 0.02, 0.03],
  })
  return g
}

/** Tundra: a Volk grown into a squad gun: longer heavy barrel, bipod, club-foot wood butt, 75-round drum. */
function buildTundra(att) {
  const g = new Group()
  add(g, profileGeo('tdRecv', [[-0.135, -0.016], [0.205, -0.016], [0.205, 0.046], [-0.12, 0.046], [-0.135, 0.032]], 0.044), M.metalDark)
  add(g, profileGeo('tdCover', [[-0.13, 0.046], [0.17, 0.046], [0.168, 0.056], [0.158, 0.063], [-0.1, 0.063], [-0.124, 0.056]], 0.04, 0.006), M.metal)
  box(g, [0.004, 0.022, 0.07], 0.06, 0.03, M.inset, 0.0225)
  box(g, [0.004, 0.014, 0.1], 0.05, 0.034, M.steel, 0.0245, [-0.12, 0, 0])
  box(g, [0.006, 0.006, 0.03], 0.13, 0.038, M.steel, 0.026)
  box(g, [0.03, 0.016, 0.05], 0.21, 0.056, M.metalDark)
  add(g, profileGeo('tdHandLo', [[0.21, -0.012], [0.44, -0.008], [0.44, 0.036], [0.21, 0.036]], 0.048, 0.008), M.walnut)
  add(g, profileGeo('tdHandUp', [[0.24, 0.046], [0.42, 0.046], [0.42, 0.062], [0.41, 0.072], [0.25, 0.072], [0.24, 0.062]], 0.036, 0.006), M.walnut)
  tube(g, 0.0105, 0.42, 0.5, 0.058, M.metalDark, 14)
  box(g, [0.028, 0.044, 0.03], 0.505, 0.045, M.metalDark)
  tube(g, 0.0105, 0.44, 0.92, 0.022, M.metalDark, 16)
  box(g, [0.024, 0.034, 0.03], 0.88, 0.04, M.metalDark)
  box(g, [0.0035, 0.024, 0.0035], 0.88, 0.068, M.metalDark)
  bipod(g, 0.86, 0.0, 0.26)
  add(g, profileGeo('tdGrip', [[-0.022, -0.016], [0.034, -0.016], [0.008, -0.125], [-0.04, -0.12], [-0.03, -0.06]], 0.032, 0.006), M.bakelite)
  add(g, profileGeo('tdGuard', [[-0.004, -0.016], [0.082, -0.016], [0.082, -0.022], [0.004, -0.05], [-0.004, -0.05]], 0.006, 0.001), M.metalDark)
  box(g, [0.005, 0.02, 0.006], 0.03, -0.028, M.steel)
  // Club-foot butt: deeper at the heel.
  add(g, profileGeo('tdStock', [[-0.13, 0.032], [-0.13, -0.014], [-0.36, -0.06], [-0.4, -0.1], [-0.5, -0.1], [-0.5, 0.042], [-0.3, 0.036]], 0.042, 0.008), M.walnut)
  box(g, [0.046, 0.15, 0.01], -0.504, -0.03, M.metalDark)
  // The drum (round, a window on its back showing rounds).
  const mag = new Group()
  mag.name = 'mag'
  add(mag, cached('tdDrum', () => new CylinderGeometry(0.075, 0.075, 0.05, 28)), M.metalDark, [0, -0.1, -0.12], [0, 0, Math.PI / 2])
  add(mag, cached('tdDrumRim', () => new TorusGeometry(0.075, 0.004, 6, 28)), M.metal, [0.026, -0.1, -0.12], [0, Math.PI / 2, 0])
  add(mag, cached('tdDrumHub', () => new CylinderGeometry(0.02, 0.02, 0.056, 16)), M.metal, [0, -0.1, -0.12], [0, 0, Math.PI / 2])
  box(mag, [0.03, 0.05, 0.05], 0.1, -0.03, M.metalDark)
  g.add(mag)
  if (att.optic !== 'iron') rail(g, -0.09, 0.15, 0.064, 0.022)
  finishGun(g, att, {
    optic: [0.03, 0.073],
    irons: (gg) => {
      box(gg, [0.02, 0.006, 0.07], 0.215, 0.068, M.metalDark)
      box(gg, [0.024, 0.008, 0.014], 0.22, 0.073, M.steel)
    },
    ironSight: [0.17, 0.078],
    muzzleKind: 'slant',
    muzzle: [0.92, 0.022],
    bore: 0.0105,
    under: [0.34, -0.01],
    hand: [0.34, -0.006],
    eject: [0.07, 0.035, 0.026],
  })
  return g
}

export const LMGS = { mule: buildMule, ram: buildRam, buzzsaw: buildBuzzsaw, tundra: buildTundra }
