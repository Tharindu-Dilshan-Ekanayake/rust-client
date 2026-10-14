import { CylinderGeometry, Group, SphereGeometry } from 'three'

import { add, box, cached, crossPin, M, tube } from '../weaponKit.js'

/**
 * Lethals beyond the frag: Semtex, a C4 brick, a claymore, and the C4's
 * detonator (held in the hand while a charge is out). Real-world sizes; the
 * claymore's convex face points down -Z (its "front toward enemy").
 */

/** Semtex: a squat puck with a sticky pad on its base, the fuze cap and a blinking light. */
function buildSemtex() {
  const g = new Group()
  add(g, cached('smtBody', () => new CylinderGeometry(0.034, 0.036, 0.04, 20)), M.olive, [0, 0, 0])
  add(g, cached('smtPad', () => new CylinderGeometry(0.037, 0.037, 0.006, 20)), M.tan, [0, -0.022, 0])
  add(g, cached('smtCap', () => new CylinderGeometry(0.014, 0.016, 0.018, 14)), M.metalDark, [0, 0.028, 0])
  add(g, cached('smtLed', () => new SphereGeometry(0.0035, 8, 6)), M.dot, [0.012, 0.036, 0])
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    box(g, [0.006, 0.02, 0.012], 0, 0, M.inset, 0, [0, a, 0]).position.set(Math.cos(a) * 0.034, 0, Math.sin(a) * 0.034)
  }
  return g
}

/** C4: a white putty brick wrapped in olive tape, the blasting cap and its receiver, antenna, a red light. */
function buildC4() {
  const g = new Group()
  box(g, [0.06, 0.04, 0.11], 0, 0, M.white)
  for (const z of [-0.035, 0.035]) box(g, [0.062, 0.042, 0.016], z, 0, M.olive)
  box(g, [0.034, 0.018, 0.04], 0, 0.028, M.metalDark)
  tube(g, 0.004, 0.0, 0.04, 0.032, M.steel, 8, 0.004, 0.011)
  add(g, cached('c4Ant', () => new CylinderGeometry(0.0012, 0.0012, 0.05, 6)), M.metalDark, [-0.01, 0.06, 0.01])
  add(g, cached('c4Led', () => new SphereGeometry(0.0035, 8, 6)), M.dot, [0.008, 0.039, -0.01])
  return g
}

/** Claymore: a curved olive slab on scissor legs, the sight slit on top, the cable fitting. */
function buildClaymore() {
  const g = new Group()
  // Convex face from three panels angled round the front.
  box(g, [0.075, 0.085, 0.032], 0, 0.065, M.olive)
  for (const s of [-1, 1]) box(g, [0.075, 0.085, 0.032], 0, 0.065, M.olive, s * 0.068, [0, -s * 0.32, 0]).position.z = 0.012
  box(g, [0.2, 0.01, 0.034], 0, 0.112, M.olive)
  // Sight slit and the cable fittings on top.
  box(g, [0.012, 0.012, 0.02], 0, 0.122, M.metalDark)
  for (const x of [-0.05, 0.05]) {
    add(g, cached('cmPlug', () => new CylinderGeometry(0.006, 0.006, 0.014, 10)), M.metalDark, [x, 0.122, 0.004])
  }
  // Two pairs of scissor legs splayed under it.
  for (const x of [-0.07, 0.07]) {
    for (const s of [-1, 1]) {
      const leg = add(g, cached('cmLeg', () => new CylinderGeometry(0.0025, 0.0025, 0.07, 6)), M.metalDark, [x, 0.03, s * 0.012])
      leg.rotation.x = s * 0.45
    }
  }
  crossPin(g, 0.003, 0.2, 0.0, 0.025, M.metalDark)
  return g
}

/** The C4 detonator: a small clacker with a flip guard and a stubby antenna. */
function buildDetonator() {
  const g = new Group()
  box(g, [0.032, 0.022, 0.07], 0, 0, M.olive)
  box(g, [0.024, 0.008, 0.024], 0.012, 0.014, M.metalDark)
  add(g, cached('detBtn', () => new CylinderGeometry(0.006, 0.006, 0.006, 12)), M.red, [0, 0.014, -0.012])
  add(g, cached('detAnt', () => new CylinderGeometry(0.0018, 0.0018, 0.04, 6)), M.metalDark, [0.01, 0.02, 0.03])
  return g
}

export const EXPLOSIVES = { semtex: buildSemtex, c4: buildC4, claymore: buildClaymore, detonator: buildDetonator }
