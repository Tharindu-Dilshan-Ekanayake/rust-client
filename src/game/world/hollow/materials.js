import { AdditiveBlending, Color, DoubleSide, MeshBasicMaterial, MeshStandardMaterial } from 'three'

import { acres } from '../acres/materials.js'
import { sidewalkTexture } from '../acres/textures.js'
import {
  barkTexture,
  cobbleTexture,
  cobwebTexture,
  engravingTexture,
  faceTexture,
  hayTexture,
  leafLawnTexture,
  mudTexture,
  needlesTexture,
  poolTexture,
  pumpkinTexture,
  waterTexture,
} from './textures.js'

/**
 * Materials for Hollow Creek, built once and shared so the static batcher
 * merges everything drawn with the same one. The houses, cars and street
 * furniture come from Atomic Acres' set (acres.*); these are the night town's
 * own: autumn ground, water, straw, dead wood, pumpkins, iron, and the few
 * things that give off light (lamps, candle flames, carved faces, the
 * cauldron, bulbs), which are emissive rather than lights, so the map costs
 * the renderer no extra lights at all.
 */

const cache = new Map()
const mat = (key, build) => {
  if (!cache.has(key)) cache.set(key, build())
  return cache.get(key)
}
const std = (key, opts) => mat(key, () => new MeshStandardMaterial(opts))

/** Colours of the lights: warm lamplight, candle flame, the cauldron's brew, string bulbs. */
export const LIGHT = Object.freeze({
  lamp: '#ffc46a',
  flame: '#ffb04a',
  brew: '#7dff4a',
  orange: '#ff8a26',
  purple: '#b25cff',
  green: '#86ff5a',
  fire: '#ff7a2a',
})

/** An unlit material over-bright on purpose: the HDR grade tone-maps it into a glow. */
function hot(key, color, strength, extra) {
  return mat(key, () => {
    const m = new MeshBasicMaterial({ toneMapped: true, ...extra })
    m.color = new Color(color).multiplyScalar(strength)
    return m
  })
}

export const hc = {
  lawn: () => std('hc:lawn', { map: leafLawnTexture(), roughness: 1, metalness: 0 }),
  mud: () => std('hc:mud', { map: mudTexture(), roughness: 0.85, metalness: 0 }),
  water: () => std('hc:water', { map: waterTexture(), roughness: 0.12, metalness: 0.6, envMapIntensity: 1.4 }),
  cobble: () => std('hc:cobble', { map: cobbleTexture(), roughness: 0.9, metalness: 0 }),
  /** Sidewalk slabs, greyed: Atomic Acres' bright ones glare under the moon. */
  sidewalk: () => std('hc:sidewalk', { map: sidewalkTexture(), color: '#a4a29c', roughness: 0.95, metalness: 0 }),
  hay: () => std('hc:hay', { map: hayTexture(), roughness: 1, metalness: 0 }),
  bark: () => std('hc:bark', { map: barkTexture(), roughness: 1, metalness: 0 }),
  needles: () => std('hc:needles', { map: needlesTexture(), roughness: 1, metalness: 0, flatShading: true }),
  pumpkin: () => std('hc:pumpkin', { map: pumpkinTexture(), roughness: 0.65, metalness: 0 }),
  /** Faceted boulders (the same flat-shaded rock shader as the other maps). */
  rock: () => acres.rock(),
  stone: () => acres.stone(),
  /** Headstone granite: the stone texture, greyed. */
  granite: (tint = '#a6a49c') => std(`hc:granite:${tint}`, { map: acres.stone().map, color: tint, roughness: 0.95 }),
  iron: () => acres.paint('#1d1c20', 0.5, 0.7),
  /** Carved faces in the pumpkins: the cuts glow (alpha outside them). */
  faces: () => mat('hc:faces', () => {
    const m = new MeshBasicMaterial({ map: faceTexture(), alphaTest: 0.4, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
    m.color = new Color(1, 1, 1).multiplyScalar(2.6)
    return m
  }),
  /** Lantern glass, bulbs and flames: over-bright, unlit. */
  lampGlass: () => hot('hc:lampGlass', LIGHT.lamp, 2.4),
  flame: () => hot('hc:flame', LIGHT.flame, 3.0),
  brew: () => hot('hc:brew', LIGHT.brew, 2.2),
  bulb: (name) => hot(`hc:bulb:${name}`, LIGHT[name] ?? name, 2.6),
  /** Embers in the burning hay and the tower's roof. */
  ember: () => std('hc:ember', { color: '#2a120a', emissive: '#ff6a1c', emissiveIntensity: 2.0, roughness: 1 }),
  wax: () => acres.paint('#ece2cc', 0.55),
  cloth: (color) => acres.fabric(color),
  wood: (color) => acres.wood(color),
  paint: (color, roughness, metalness) => acres.paint(color, roughness, metalness),
  /** Light falling on the ground: additive, never written to depth, nudged above the ground layers. */
  pool: (name) =>
    mat(`hc:pool:${name}`, () => {
      const m = new MeshBasicMaterial({
        map: poolTexture(),
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        polygonOffset: true,
        polygonOffsetFactor: -8,
        polygonOffsetUnits: -16,
      })
      m.color = new Color(LIGHT[name] ?? name).multiplyScalar(0.55)
      return m
    }),
  cobweb: () =>
    mat('hc:cobweb', () => new MeshStandardMaterial({ map: cobwebTexture(), transparent: true, depthWrite: false, side: DoubleSide, roughness: 0.9 })),
  engraving: () =>
    mat('hc:engraving', () =>
      new MeshStandardMaterial({ map: engravingTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, roughness: 0.9 }),
    ),
  /**
   * A ground layer: the same look as `name` (hc.* or acres.*) with a depth
   * offset (k = 1, 2, ... for each layer up) so it never flickers against the
   * layer under it, even far off.
   */
  layer: (name, k) =>
    mat(`hc:layer:${name}:${k}`, () => {
      const base = hc[name] ? hc[name]() : acres[name]()
      const m = base.clone()
      m.polygonOffset = true
      m.polygonOffsetFactor = -k
      m.polygonOffsetUnits = -2 * k
      return m
    }),
}
