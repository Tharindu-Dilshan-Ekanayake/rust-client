import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { CanvasTexture, Group, Mesh, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, Vector2, Vector3 } from 'three'

import { weaponMaterials } from '../models/weaponModels.js'

/**
 * The player's own gloved hands and camo sleeves: on the gun in the viewmodel,
 * and on the rungs while climbing a ladder.
 */

/** Desert camo for the sleeves: tan base with olive and brown blotches. */
function camoTexture() {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#a28d68'
  ctx.fillRect(0, 0, 128, 128)
  let seed = 7
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (const [color, count, size] of [['#6f6a46', 14, 26], ['#7d5f40', 10, 20], ['#c4b08a', 12, 14]]) {
    ctx.fillStyle = color
    for (let i = 0; i < count; i++) {
      const x = rand() * 128
      const y = rand() * 128
      ctx.beginPath()
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2
        const r = size * (0.45 + rand() * 0.55)
        ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7)
      }
      ctx.fill()
    }
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.wrapS = RepeatWrapping
  t.wrapT = RepeatWrapping
  t.repeat.set(1.5, 2)
  return t
}

const gloveMat = new MeshStandardMaterial({
  color: '#3d3a33',
  roughness: 0.85,
  normalMap: weaponMaterials.polymer.normalMap,
  normalScale: new Vector2(0.5, 0.5),
})
const knuckleMat = new MeshStandardMaterial({ color: '#2a2925', roughness: 0.7 })
const sleeveMat = new MeshStandardMaterial({ color: '#ffffff', map: camoTexture(), roughness: 0.95 })
const cuffMat = new MeshStandardMaterial({ color: '#5e573f', roughness: 0.95 })

const rounded = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 2, r)
const handGeo = {
  palm: rounded(0.05, 0.03, 0.05, 0.01),
  fingers: rounded(0.048, 0.024, 0.036, 0.009),
  knuckles: rounded(0.05, 0.008, 0.016, 0.003),
  thumb: rounded(0.016, 0.018, 0.04, 0.007),
  cuff: rounded(0.054, 0.04, 0.026, 0.008),
  sleeve: (() => {
    const g = rounded(0.062, 0.06, 1, 0.018)
    // Pivot at the wrist; the sleeve extends toward the elbow along +Z.
    g.translate(0, 0, 0.5)
    return g
  })(),
  sleeveCuff: rounded(0.068, 0.066, 0.03, 0.014),
}

/**
 * One forearm + gloved hand. The group sits at the wrist and is turned so +Z
 * points at the elbow: fingers reach forward (-Z), curled down round the grip,
 * with the thumb on the inside (`side` -1 left arm, 1 right arm).
 */
export function makeArm(side) {
  const arm = new Group()
  const add = (geo, mat, pos, rot) => {
    const m = new Mesh(geo, mat)
    m.position.set(...pos)
    if (rot) m.rotation.set(...rot)
    arm.add(m)
    return m
  }
  add(handGeo.palm, gloveMat, [0, 0, -0.012])
  add(handGeo.fingers, gloveMat, [0, -0.012, -0.044], [0.55, 0, 0])
  add(handGeo.knuckles, knuckleMat, [0, 0.013, -0.032], [0.15, 0, 0])
  add(handGeo.thumb, gloveMat, [-side * 0.027, 0.004, -0.03], [0.25, side * 0.35, 0])
  add(handGeo.cuff, gloveMat, [0, 0, 0.018])
  const sleeve = add(handGeo.sleeve, sleeveMat, [0, 0, 0.032])
  add(handGeo.sleeveCuff, cuffMat, [0, 0, 0.045])
  arm.userData.sleeve = sleeve
  // The stock glove and sleeve, hidden while the player's Bloxity arm is on (bloxArms.js).
  arm.userData.parts = [...arm.children]
  return arm
}

const _toElbow = new Vector3()
const _target = new Vector3()

/**
 * Puts an arm's wrist at `wrist` with the sleeve running back to `elbow`.
 * Both are world positions (the viewmodel camera sits at the origin of its
 * scene, so there camera space is world space).
 */
export function placeArm(arm, wrist, elbow) {
  arm.position.copy(wrist)
  const sleeve = arm.userData.sleeve
  const len = _toElbow.copy(elbow).sub(wrist).length()
  sleeve.scale.set(1, 1, Math.max(0.05, len - 0.032))
  // A Bloxity arm (bloxArms.js) runs from just past the wrist to the elbow.
  for (const mesh of arm.userData.blox ?? []) mesh.scale.z = Math.max(0.05, len + arm.userData.bloxReach)
  // Object3D.lookAt points +Z at the target.
  arm.lookAt(_target.copy(elbow))
}
