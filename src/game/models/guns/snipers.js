import { CylinderGeometry, Group, Mesh, SphereGeometry, TorusGeometry } from 'three'

import { add, box, cached, cartridge, coupleMag, crossPin, finishGun, M, profileGeo, rail, tube } from '../weaponKit.js'

/**
 * Sniper and marksman rifles beyond the Longhaul. Bolt guns carry a 'bolt'
 * group built like the Longhaul's (origin on the bolt's axis, handle out to
 * the right) so the viewmodel works it the same way; the semi-autos have none.
 */

/** A bolt: handle out to the right of its axis, a knob on the end (a bent-down handle with `droop`). */
function boltGroup(u, v, len = 0.065, knob = 0.012, droop = 0) {
  const bolt = new Group()
  bolt.name = 'bolt'
  bolt.position.set(0.028, v, -u)
  const handle = new Mesh(cached(`boltH:${len}`, () => new CylinderGeometry(0.0055, 0.0055, len, 10)), M.steel)
  handle.rotation.z = Math.PI / 2 - droop
  handle.position.set(len / 2 - 0.004, -Math.sin(droop) * len * 0.5, 0)
  bolt.add(handle)
  const k = new Mesh(cached(`boltK:${knob}`, () => new SphereGeometry(knob, 16, 12)), M.metalDark)
  k.position.set(len - 0.004, -Math.sin(droop) * len, 0)
  k.scale.set(1, 1, 1.2)
  bolt.add(k)
  return bolt
}

/** A riflescope on two rings over the action: tube, eyepiece and objective bells, turrets, coated glass. */
function scope(g, sv, u0, u1, r, objR, ringV, rings) {
  for (const u of rings) {
    box(g, [r * 2 + 0.008, sv - ringV + 0.008, 0.018], u, (sv + ringV) / 2, M.metalDark)
    for (const x of [-1, 1]) crossPin(g, 0.0025, 0.004, u, sv + r, M.steel, x * (r + 0.004))
  }
  tube(g, r, u0, u1, sv, M.metal, 24)
  tube(g, r + 0.006, u0 - 0.065, u0, sv, M.metal, 24, r + 0.002)
  tube(g, r + 0.006, u0 - 0.075, u0 - 0.062, sv, M.rubber, 24)
  tube(g, objR, u1, u1 + 0.09, sv, M.metal, 24, r + 0.002)
  tube(g, objR + 0.002, u1 + 0.085, u1 + 0.097, sv, M.metalDark, 24)
  const mid = (u0 + u1) / 2 - 0.02
  add(g, cached(`sTurT:${r}`, () => new CylinderGeometry(r * 0.75, r * 0.75, 0.02, 18)), M.metalDark, [0, sv + r + 0.009, -mid])
  add(g, cached(`sTurS:${r}`, () => new CylinderGeometry(r * 0.75, r * 0.75, 0.02, 18)), M.metalDark, [r + 0.009, sv, -mid], [0, 0, Math.PI / 2])
  const front = add(g, cached(`sLensF:${objR}`, () => new CylinderGeometry(objR - 0.003, objR - 0.003, 0.002, 24)), M.lensCap, [0, sv, -(u1 + 0.092)])
  front.rotation.x = Math.PI / 2
  const back = add(g, cached(`sLensB:${r}`, () => new CylinderGeometry(r + 0.002, r + 0.002, 0.002, 24)), M.lensCap, [0, sv, -(u0 - 0.07)])
  back.rotation.x = Math.PI / 2
}

/** A folded bipod under the forend at u. */
function bipod(g, u, v, len = 0.2) {
  box(g, [0.036, 0.014, 0.028], u, v, M.metalDark)
  for (const x of [-0.014, 0.014]) {
    box(g, [0.007, 0.007, len], u - len / 2, v - 0.004, M.metalDark, x)
    box(g, [0.011, 0.009, 0.014], u - len, v - 0.004, M.rubber, x)
  }
}

/** Kite SR: a light scout rifle in a tan sporter stock, slim barrel, compact scope. */
function buildKite(att) {
  const g = new Group()
  add(g, profileGeo('ktStock', [
    [-0.56, -0.072], [-0.45, -0.052], [-0.2, -0.03], [-0.13, -0.06], [-0.1, -0.1], [-0.052, -0.096], [-0.03, -0.004],
    [0.42, 0.0], [0.42, 0.034], [-0.06, 0.04], [-0.22, 0.05], [-0.42, 0.066], [-0.56, 0.068],
  ], 0.052, 0.008), M.tan)
  for (let i = 0; i < 3; i++) for (const x of [-1, 1]) box(g, [0.004, 0.014, 0.05], 0.13 + i * 0.075, 0.017, M.inset, x * 0.0262)
  box(g, [0.058, 0.15, 0.018], -0.568, -0.002, M.rubber)
  for (const u of [-0.45, 0.36]) add(g, cached('swivel', () => new TorusGeometry(0.007, 0.0018, 6, 12)), M.steel, [0, u < 0 ? -0.06 : -0.004, -u], [0, Math.PI / 2, 0])
  add(g, profileGeo('ktGuard', [[0.0, -0.004], [0.07, -0.004], [0.07, -0.01], [0.006, -0.04], [0.0, -0.04]], 0.006, 0.001), M.metalDark)
  box(g, [0.005, 0.02, 0.006], 0.028, -0.016, M.steel)
  // Action, bolt shroud, ejection port; the bolt.
  tube(g, 0.021, -0.09, 0.17, 0.055, M.metal, 24)
  tube(g, 0.016, -0.11, -0.09, 0.055, M.metalDark, 16)
  box(g, [0.004, 0.018, 0.06], 0.05, 0.06, M.inset, 0.021)
  g.add(boltGroup(0.05, 0.06, 0.06, 0.011))
  // Slim barrel, scope on two rings, integrated folding bipod.
  tube(g, 0.0125, 0.17, 0.74, 0.045, M.metalDark, 18, 0.0105)
  rail(g, -0.08, 0.16, 0.076, 0.022)
  scope(g, 0.112, -0.05, 0.19, 0.0135, 0.021, 0.084, [-0.02, 0.12])
  bipod(g, 0.4, -0.006, 0.16)
  // Six-round box mag.
  const mag = new Group()
  mag.name = 'mag'
  const ext = att.mag === 'extended'
  box(mag, [0.03, ext ? 0.06 : 0.036, 0.074], 0.06, ext ? -0.026 : -0.014, M.polymer)
  cartridge(mag, 0.09, 0.008, 0, 0.065, 0.006)
  if (att.mag === 'fast') coupleMag(mag, -0.034, -0.02, 0.06)
  g.add(mag)
  finishGun(g, att, {
    ironSight: [-0.16, 0.112],
    muzzleKind: 'none-pistol',
    muzzle: [0.74, 0.045],
    bore: 0.0105,
    hand: [0.28, -0.004],
    eject: [0.05, 0.068, 0.024],
  })
  return g
}

/** Ironwood M91: full wood stock to the muzzle, barrel bands, hex receiver, bent bolt, a short scope. */
function buildIronwood(att) {
  const g = new Group()
  add(g, profileGeo('iwStock', [
    [-0.6, -0.075], [-0.5, -0.06], [-0.18, -0.03], [-0.12, -0.06], [-0.095, -0.098], [-0.05, -0.094], [-0.035, -0.008],
    [0.56, -0.004], [0.6, 0.016], [0.6, 0.036], [-0.05, 0.042], [-0.2, 0.05], [-0.45, 0.06], [-0.6, 0.062],
  ], 0.05, 0.008), M.walnut)
  add(g, profileGeo('iwUpperWood', [[0.17, 0.042], [0.5, 0.042], [0.5, 0.058], [0.172, 0.058]], 0.034, 0.005), M.walnut)
  for (const u of [0.23, 0.52]) box(g, [0.054, 0.072, 0.012], u, 0.018, M.steel)
  box(g, [0.052, 0.14, 0.012], -0.605, -0.006, M.metalDark)
  add(g, profileGeo('iwGuard', [[-0.004, -0.008], [0.078, -0.008], [0.078, -0.014], [0.006, -0.042], [-0.004, -0.042]], 0.006, 0.001), M.steel)
  box(g, [0.005, 0.02, 0.006], 0.028, -0.02, M.steel)
  // Hexagonal receiver, the tang behind it, the bent-down bolt.
  tube(g, 0.019, -0.08, 0.16, 0.058, M.metalDark, 6)
  box(g, [0.022, 0.012, 0.06], -0.11, 0.045, M.metalDark)
  g.add(boltGroup(0.05, 0.062, 0.072, 0.011, 0.75))
  // Barrel past the stock, front sight hood.
  tube(g, 0.012, 0.56, 0.86, 0.026, M.metalDark, 16, 0.0105)
  tube(g, 0.012, 0.82, 0.85, 0.048, M.metalDark, 14)
  add(g, cached('iwHood', () => new TorusGeometry(0.011, 0.0022, 6, 14)), M.metalDark, [0, 0.048, -0.835])
  // Short scope over the action on a side rail mount.
  box(g, [0.012, 0.05, 0.12], 0.06, 0.07, M.metalDark, -0.022)
  scope(g, 0.106, -0.03, 0.14, 0.012, 0.017, 0.082, [0.0, 0.11])
  // The magazine floor plate (fed by stripper clips through the top).
  const mag = new Group()
  mag.name = 'mag'
  box(mag, [0.034, 0.022, 0.09], 0.065, -0.014, M.metalDark)
  cartridge(mag, 0.1, 0.03, 0, 0.07, 0.0062)
  g.add(mag)
  finishGun(g, att, {
    ironSight: [-0.14, 0.106],
    muzzleKind: 'none-pistol',
    muzzle: [0.86, 0.026],
    bore: 0.0105,
    hand: [0.32, -0.006],
    eject: [0.05, 0.07, 0.022],
  })
  return g
}

/** Sable DMR: a big-frame AR in black, long free-float handguard, fluted barrel, mid-power scope. */
function buildSable(att) {
  const g = new Group()
  add(g, profileGeo('sbLower', [[-0.08, 0.036], [0.18, 0.036], [0.18, -0.006], [0.145, -0.032], [0.145, -0.08], [0.035, -0.08], [0.037, -0.032], [-0.08, -0.026]], 0.056), M.metal)
  add(g, profileGeo('sbUpper', [[-0.16, 0.036], [0.28, 0.036], [0.28, 0.09], [-0.14, 0.09], [-0.16, 0.076]], 0.062), M.metal)
  box(g, [0.004, 0.024, 0.07], 0.08, 0.062, M.inset, 0.032)
  for (const u of [-0.06, 0.16]) crossPin(g, 0.0045, 0.06, u, 0.022, M.metalDark)
  box(g, [0.05, 0.008, 0.026], -0.145, 0.095, M.metalDark)
  rail(g, -0.14, 0.66, 0.09, 0.022)
  add(g, profileGeo('sbHand', [[0.28, 0.004], [0.68, 0.004], [0.68, 0.09], [0.28, 0.09]], 0.07, 0.008), M.metalDark)
  for (let i = 0; i < 6; i++) for (const x of [-0.036, 0.036]) box(g, [0.004, 0.018, 0.04], 0.31 + i * 0.062, 0.047, M.inset, x)
  // Heavy fluted barrel.
  tube(g, 0.0135, 0.68, 0.94, 0.05, M.metalDark, 18)
  for (const a of [0.5, -0.5, Math.PI / 2, Math.PI - 0.5, Math.PI + 0.5]) box(g, [0.0035, 0.0035, 0.2], 0.82, 0.05 + Math.sin(a) * 0.0124, M.inset, Math.cos(a) * 0.0124)
  // Grip, guard; the precision stock with its cheek piece and adjustable butt.
  add(g, profileGeo('sbGrip', [[-0.018, -0.024], [0.042, -0.027], [0.008, -0.136], [-0.045, -0.131], [-0.032, -0.062]], 0.034, 0.006), M.polymer)
  add(g, profileGeo('sbGuard', [[0.0, -0.03], [0.078, -0.03], [0.078, -0.036], [0.006, -0.062], [0.0, -0.062]], 0.006, 0.001), M.metalDark)
  box(g, [0.006, 0.022, 0.006], 0.032, -0.044, M.steel)
  tube(g, 0.017, -0.34, -0.16, 0.054, M.metalDark)
  add(g, profileGeo('sbStock', [[-0.46, -0.06], [-0.3, 0.0], [-0.22, 0.03], [-0.22, 0.078], [-0.46, 0.078]], 0.052, 0.008), M.polymer)
  box(g, [0.044, 0.024, 0.18], -0.34, 0.092, M.polymer)
  box(g, [0.058, 0.15, 0.018], -0.468, 0.008, M.rubber)
  scope(g, 0.15, -0.06, 0.18, 0.015, 0.022, 0.1, [-0.03, 0.14])
  bipod(g, 0.64, -0.002, 0.22)
  const mag = new Group()
  mag.name = 'mag'
  const ext = att.mag === 'extended'
  add(mag, profileGeo(ext ? 'sbMagX' : 'sbMag', ext ? [[0.042, -0.034], [0.138, -0.034], [0.158, -0.27], [0.062, -0.276]] : [[0.042, -0.034], [0.138, -0.034], [0.152, -0.2], [0.056, -0.205]], 0.036, 0.004), M.metalDark)
  cartridge(mag, 0.11, -0.03, 0, 0.065, 0.006)
  if (att.mag === 'fast') coupleMag(mag, -0.04, -0.1, 0.1)
  g.add(mag)
  finishGun(g, att, {
    ironSight: [-0.2, 0.15],
    muzzleKind: 'brake',
    muzzle: [0.94, 0.05],
    bore: 0.0135,
    under: [0.5, 0.004],
    hand: [0.48, 0.002],
    eject: [0.08, 0.062, 0.035],
    charge: [-0.145, 0.095, 0],
  })
  return g
}

/** Goliath .50: a massive tan receiver, the perforated barrel jacket, a .50's brake, a ten-round box. */
function buildGoliath(att) {
  const g = new Group()
  add(g, profileGeo('glUpper', [[-0.2, 0.0], [0.36, 0.0], [0.36, 0.1], [-0.18, 0.1], [-0.2, 0.08]], 0.074, 0.008), M.tan)
  add(g, profileGeo('glLower', [[-0.16, 0.002], [0.22, 0.002], [0.22, -0.036], [0.17, -0.04], [0.17, -0.07], [0.04, -0.07], [0.04, -0.03], [-0.14, -0.03]], 0.068, 0.006), M.tan)
  // Barrel jacket ahead of the receiver, its round vent holes.
  add(g, profileGeo('glJacket', [[0.36, 0.02], [0.78, 0.028], [0.78, 0.086], [0.36, 0.094]], 0.07, 0.008), M.tan)
  for (let i = 0; i < 7; i++) {
    for (const x of [-1, 1]) add(g, cached('glHole', () => new CylinderGeometry(0.009, 0.009, 0.004, 12)), M.inset, [x * 0.0352, 0.058, -(0.4 + i * 0.054)], [0, 0, Math.PI / 2])
  }
  box(g, [0.004, 0.03, 0.09], 0.08, 0.06, M.inset, 0.0372)
  box(g, [0.018, 0.016, 0.04], 0.28, 0.084, M.metalDark, -0.042)
  rail(g, -0.18, 0.36, 0.1, 0.026)
  // Carry handle folded on the rail's front, the barrel and its big brake.
  box(g, [0.03, 0.02, 0.12], 0.3, 0.12, M.metalDark)
  tube(g, 0.0175, 0.78, 1.12, 0.055, M.metalDark, 18)
  // Grip and guard; the long stock with its monopod and a thick recoil pad.
  add(g, profileGeo('glGrip', [[-0.02, -0.03], [0.044, -0.03], [0.008, -0.14], [-0.048, -0.134], [-0.034, -0.066]], 0.036, 0.006), M.polymer)
  add(g, profileGeo('glGuard', [[0.0, -0.032], [0.08, -0.032], [0.08, -0.038], [0.006, -0.064], [0.0, -0.064]], 0.008, 0.002), M.metalDark)
  box(g, [0.006, 0.022, 0.006], 0.032, -0.046, M.steel)
  add(g, profileGeo('glStock', [[-0.2, 0.08], [-0.2, -0.03], [-0.42, -0.05], [-0.58, -0.05], [-0.58, 0.09], [-0.42, 0.09]], 0.06, 0.008), M.tan)
  box(g, [0.066, 0.15, 0.034], -0.6, 0.02, M.rubber)
  box(g, [0.014, 0.08, 0.014], -0.46, -0.09, M.metalDark)
  scope(g, 0.165, -0.12, 0.17, 0.018, 0.03, 0.11, [-0.06, 0.12])
  bipod(g, 0.74, 0.02, 0.26)
  const mag = new Group()
  mag.name = 'mag'
  box(mag, [0.05, 0.13, 0.13], 0.105, -0.1, M.metalDark)
  box(mag, [0.054, 0.012, 0.134], 0.105, -0.168, M.polymer)
  cartridge(mag, 0.13, -0.03, 0, 0.13, 0.0085)
  if (att.mag === 'fast') coupleMag(mag, -0.058, -0.1, 0.1)
  g.add(mag)
  finishGun(g, att, {
    ironSight: [-0.25, 0.165],
    muzzleKind: 'fifty',
    muzzle: [1.12, 0.055],
    bore: 0.0175,
    hand: [0.55, 0.02],
    eject: [0.08, 0.07, 0.04],
    charge: [0.28, 0.084, -0.05],
  })
  return g
}

export const SNIPERS = { kite: buildKite, ironwood: buildIronwood, sable: buildSable, goliath: buildGoliath }
