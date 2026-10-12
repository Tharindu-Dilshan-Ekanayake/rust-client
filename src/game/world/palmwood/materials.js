import { DoubleSide, MeshStandardMaterial } from 'three'

import { burlapTexture, concreteTexture, corrugatedTexture, hazardStripeTexture, rustTexture, woodTexture } from '../textures.js'
import {
  bananaStemTexture,
  drumTexture,
  earthTexture,
  foliageTexture,
  jungleCamoTexture,
  jungleGrassTexture,
  markTexture,
  palmBarkTexture,
  plywoodTexture,
  safetyMeshTexture,
  tarpTexture,
  trackTexture,
} from './textures.js'

/**
 * Materials for Palmwood, built once and shared. Materials that differ only in
 * colour batch together (the static batcher bakes the colour into vertices), so
 * every plywood wall, every tin sheet and every tarp is one draw each whatever
 * its tint, and every leaf in the map is drawn with one material.
 */

const cache = new Map()
const mat = (key, build) => {
  if (!cache.has(key)) cache.set(key, build())
  return cache.get(key)
}
const std = (key, opts) => mat(key, () => new MeshStandardMaterial(opts))

/** Finishes for plain-coloured materials (see acres/materials.js): four, so they batch. */
const FINISH = { matte: [0.9, 0], satin: [0.55, 0.1], gloss: [0.32, 0.35], metal: [0.5, 0.7] }
const finishOf = (r, m) => (m >= 0.45 ? 'metal' : r <= 0.4 ? 'gloss' : r >= 0.8 ? 'matte' : 'satin')

/** Tin sheet colours. 'rust' is the rust texture rather than a tint. */
export const TIN = { red: '#b5503e', white: '#dedbd2', teal: '#3f8a86', brown: '#8a5a3c', galvanized: '#b4b8b9', blue: '#3a6ea8', rust: null }
export const TARP = { blue: '#2f74c4', orange: '#e57a2c', green: '#3f9a52', red: '#c4362c' }
/** Paint over plywood, and the bands round the buildings. */
export const PAINT = { pink: '#e4a2a6', blue: '#2a5aa8', yellow: '#e2b42a', green: '#5f9a5a', white: '#efe9dc' }

export const pw = {
  earth: () => std('pw:earth', { map: earthTexture(), roughness: 1, metalness: 0 }),
  grass: () => std('pw:grass', { map: jungleGrassTexture(), roughness: 1, metalness: 0 }),
  track: () => std('pw:track', { map: trackTexture(), roughness: 0.95, metalness: 0 }),
  concrete: () => std('pw:concrete', { map: concreteTexture(), color: '#cfc8ba', roughness: 0.95 }),
  /** Plywood, natural or tinted (inside faces darker, painted walls by their paint). */
  plywood: (tint = '#ffffff') => std(`pw:plywood:${tint}`, { map: plywoodTexture(), color: tint, roughness: 0.85, metalness: 0 }),
  /** Timber: posts, studs, frames, treads, crates, pallets, decks. */
  wood: (tint = '#ffffff') => std(`pw:wood:${tint}`, { map: woodTexture(), color: tint, roughness: 0.9, metalness: 0 }),
  tin: (name) => {
    if (name === 'rust' || !TIN[name]) return std('pw:tinRust', { map: rustTexture(), roughness: 0.85, metalness: 0.35 })
    return std(`pw:tin:${name}`, { map: corrugatedTexture(), color: TIN[name], roughness: 0.55, metalness: 0.35 })
  },
  tarp: (name) => std(`pw:tarp:${name}`, { map: tarpTexture(), color: TARP[name] ?? name, roughness: 0.8, metalness: 0, side: DoubleSide }),
  burlap: (tint = '#7f8a5c') => std(`pw:burlap:${tint}`, { map: burlapTexture(), color: tint, roughness: 1 }),
  drum: () => std('pw:drum', { map: drumTexture(), roughness: 0.5, metalness: 0.3 }),
  rust: () => std('pw:tinRust', { map: rustTexture(), roughness: 0.85, metalness: 0.35 }),
  hazard: () => std('pw:hazard', { map: hazardStripeTexture(), roughness: 0.7, metalness: 0.2 }),
  foliage: () =>
    mat('pw:foliage', () => new MeshStandardMaterial({ map: foliageTexture(), alphaTest: 0.45, side: DoubleSide, roughness: 0.85, metalness: 0 })),
  palmBark: () => std('pw:palmBark', { map: palmBarkTexture(), roughness: 1 }),
  bananaStem: () => std('pw:bananaStem', { map: bananaStemTexture(), roughness: 0.9 }),
  mesh: () =>
    mat('pw:mesh', () => new MeshStandardMaterial({ map: safetyMeshTexture(), alphaTest: 0.5, side: DoubleSide, roughness: 0.7 })),
  camo: () => mat('pw:camo', () => new MeshStandardMaterial({ map: jungleCamoTexture(), alphaTest: 0.5, side: DoubleSide, roughness: 1 })),
  paint: (color, roughness = 0.6, metalness = 0) => {
    const finish = finishOf(roughness, metalness)
    const [r, m] = FINISH[finish]
    return std(`pw:paint:${color}:${finish}`, { color, roughness: r, metalness: m })
  },
  rubber: () => std('pw:paint:#1c1b1b:matte', { color: '#1c1b1b', roughness: 0.9, metalness: 0 }),
  ember: () => std('pw:ember', { color: '#2a120a', emissive: '#ff6a1c', emissiveIntensity: 2.0, roughness: 1 }),
  /** Faceted rock (the same shader as the other maps' rocks), tinted for jungle hills. */
  rock: (tint = '#5f7a44') => std(`pw:rock:${tint}`, { map: concreteTexture(), color: tint, roughness: 1, flatShading: true }),
  /** Stencilled marks on the walls: one atlas, nudged in front of the wall. */
  marks: () =>
    mat('pw:marks', () =>
      new MeshStandardMaterial({ map: markTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, roughness: 0.8 }),
    ),
  /**
   * A ground layer: the same look as `name` with a depth offset (k = 1, 2, ...
   * for each layer up) so it never flickers against the layer under it.
   */
  layer: (name, k) =>
    mat(`pw:layer:${name}:${k}`, () => {
      const m = pw[name]().clone()
      m.polygonOffset = true
      m.polygonOffsetFactor = -k
      m.polygonOffsetUnits = -2 * k
      return m
    }),
}
