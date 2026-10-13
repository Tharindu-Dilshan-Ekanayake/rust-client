import { DoubleSide, MeshStandardMaterial } from 'three'

import { chainLinkTexture, concreteTexture, rustTexture, sandTexture } from '../textures.js'
import {
  asphaltTexture,
  barricadeStripeTexture,
  brickRedTexture,
  busSideTexture,
  busSignTexture,
  cardboardTexture,
  carpetTexture,
  checkerTexture,
  clockTexture,
  dirtTexture,
  fenceBoardTexture,
  grassTexture,
  leafTexture,
  panelTexture,
  plasterTexture,
  poolTileTexture,
  roadClosedTexture,
  shelterSignTexture,
  shingleTexture,
  sidewalkTexture,
  sidingTexture,
  starTexture,
  stoneTexture,
  streetBladeTexture,
  terrazzoTexture,
  trailerLogoTexture,
  warningSignTexture,
  welcomeSignTexture,
  woodFloorTexture,
} from './textures.js'

/**
 * Materials for Atomic Acres, built once and shared, so the static batcher can
 * merge everything drawn with the same one. Palettes follow the 1950s look:
 * lemon yellow and teal-green houses, white trim, slate roofs, bright lawns.
 */

const cache = new Map()
const mat = (key, build) => {
  if (!cache.has(key)) cache.set(key, build())
  return cache.get(key)
}
const std = (key, opts) => mat(key, () => new MeshStandardMaterial(opts))

/**
 * Finishes for plain-coloured (untextured) materials. Every one of them uses
 * one of these four, so the static batcher draws all the paint of a finish in a
 * single call (the colours go into the vertices) instead of one call per shade
 * of shine. Textured materials sharing a texture share a roughness for the same
 * reason.
 */
const FINISH = { matte: [0.9, 0], satin: [0.55, 0.1], gloss: [0.32, 0.35], metal: [0.5, 0.7] }
const finishOf = (r, m) => (m >= 0.45 ? 'metal' : r <= 0.4 ? 'gloss' : r >= 0.8 ? 'matte' : 'satin')
const solid = (key, color, roughness, metalness = 0, extra) => {
  const [r, m] = FINISH[typeof roughness === 'string' ? roughness : finishOf(roughness, metalness)]
  return std(key, { color, roughness: r, metalness: m, ...extra })
}

/** Exterior wall colours (lap siding unless noted). */
export const SIDING = {
  cream: { color: '#ece4cf', tex: 'plaster' },
  yellow: { color: '#e9cf52' },
  green: { color: '#5bb89a' },
  white: { color: '#f1efe6' },
  blue: { color: '#9cc5dc' },
  orange: { color: '#e07a2c', tex: 'panel' },
  barn: { color: '#9a3b2e' },
  // Hollow Creek's night-time town.
  ash: { color: '#8a8f94' },
  dusk: { color: '#5d5a6e' },
  moss: { color: '#6b7a58' },
  oat: { color: '#d6cbb0' },
  plum: { color: '#6a4a62' },
  tealgrey: { color: '#5f7a7a' },
}
export const ROOFS = { slate: '#5d6873', charcoal: '#6b7480', red: '#a2483a', teal: '#3f817b', concrete: '#bdb8ae' }
export const TRIM = { white: '#f6f4ec', concrete: '#c9c4b8', teal: '#3f817b', bone: '#d9d2c2', walnut: '#4a3426' }
export const SHUTTERS = { green: '#2f7d63', white: '#f6f4ec', black: '#24221f' }
/** Inside walls per house and floor. */
export const INTERIOR = {
  yellow: ['#efe2c2', '#d7e6dc'],
  green: ['#f2e5cb', '#d6e0ea'],
  orange: ['#efebe3'],
  cottage: ['#f0dcd9'],
  poolhouse: ['#dff0ea'],
  shed: ['#c9b08a'],
}
export const CAR_COLORS = { mint: '#9fd6c2', red: '#c43a2f', sky: '#8dbad8', rust: '#7c5038', cream: '#efe1bc' }

export const acres = {
  grass: () => std('a:grass', { map: grassTexture(), roughness: 1, metalness: 0 }),
  dirt: () => std('a:dirt', { map: dirtTexture(), roughness: 1, metalness: 0 }),
  desert: () => std('a:desert', { map: sandTexture(), color: '#e8dccb', roughness: 1, metalness: 0 }),
  asphalt: () => std('a:asphalt', { map: asphaltTexture(), roughness: 0.92, metalness: 0 }),
  sidewalk: () => std('a:sidewalk', { map: sidewalkTexture(), roughness: 0.95, metalness: 0 }),
  concrete: () => std('a:concrete', { map: concreteTexture(), color: '#dcd8cf', roughness: 0.95 }),
  curb: () => std('a:curb', { map: concreteTexture(), color: '#e6e2d8', roughness: 0.95 }),
  roadLine: () => solid('a:roadLine', '#e8c547', 'matte'),
  siding: (name) => {
    const s = SIDING[name] ?? SIDING.white
    const map = s.tex === 'plaster' ? plasterTexture() : s.tex === 'panel' ? panelTexture() : sidingTexture()
    // Plaster-finished walls match the inside walls (same texture, same roughness).
    return std(`a:siding:${name}`, { map, color: s.color, roughness: s.tex === 'plaster' ? 0.92 : 0.85, metalness: 0 })
  },
  interior: (color) => std(`a:interior:${color}`, { map: plasterTexture(), color, roughness: 0.92 }),
  ceiling: () => std('a:ceiling', { map: plasterTexture(), color: '#f3f1ea', roughness: 0.92 }),
  /**
   * Inside walls and ceilings of a room with the lamps on at night (Hollow
   * Creek): a warm glow of their own, `lit` strong, so the room reads (and so
   * does anyone standing in it) without a single real light. Walls and
   * ceilings glow the same colour, so with one `lit` for the whole map the
   * batcher draws every room in town at once.
   */
  interiorLit: (color, lit) =>
    std(`a:interiorLit:${color}:${lit}`, { map: plasterTexture(), color, emissive: '#ffb468', emissiveIntensity: lit, emissiveMap: plasterTexture(), roughness: 0.92 }),
  ceilingLit: (lit) =>
    std(`a:ceilingLit:${lit}`, { map: plasterTexture(), color: '#e8e2d4', emissive: '#ffb468', emissiveIntensity: lit, emissiveMap: plasterTexture(), roughness: 0.92 }),
  trim: (name = 'white') => solid(`a:trim:${name}`, TRIM[name] ?? name, 'satin'),
  shutter: (name) => std(`a:shutter:${name}`, { map: sidingTexture(), color: SHUTTERS[name] ?? name, roughness: 0.85 }),
  roof: (name) => std(`a:roof:${name}`, { map: shingleTexture(), color: ROOFS[name] ?? name, roughness: 0.9 }),
  /**
   * Faceted rock for the distant mountains: textured and flat shaded like
   * Dustline's rocks, so both maps draw rock with the same compiled shader.
   */
  rock: () => std('a:rock', { map: concreteTexture(), color: '#a08a72', roughness: 1, flatShading: true }),
  flatRoof: () => std('a:flatRoof', { map: concreteTexture(), color: '#8e8c86', roughness: 0.95 }),
  stone: () => std('a:stone', { map: stoneTexture(), roughness: 0.95 }),
  brick: () => std('a:brick', { map: brickRedTexture(), roughness: 0.95 }),
  woodFloor: () => std('a:woodFloor', { map: woodFloorTexture(), roughness: 0.75 }),
  checker: () => std('a:checker', { map: checkerTexture(), roughness: 0.5 }),
  terrazzo: () => std('a:terrazzo', { map: terrazzoTexture(), roughness: 0.6 }),
  carpet: (color = '#b88c84') => std(`a:carpet:${color}`, { map: carpetTexture(), color, roughness: 1 }),
  tile: () => std('a:tile', { map: poolTileTexture(), color: '#e8f2f0', roughness: 0.4 }),
  plank: () => std('a:plank', { map: fenceBoardTexture(), color: '#c9a77e', roughness: 0.95 }),
  fence: () => std('a:fence', { map: fenceBoardTexture(), roughness: 0.95 }),
  picket: () => solid('a:picket', '#f4f2ea', 'satin'),
  leaves: () => std('a:leaves', { map: leafTexture(), roughness: 1 }),
  bark: () => solid('a:bark', '#5a4632', 'matte'),
  wood: (color = '#8a5f3a') => std(`a:wood:${color}`, { map: woodFloorTexture(), color, roughness: 0.75 }),
  fabric: (color) => std(`a:fabric:${color}`, { map: carpetTexture(), color, roughness: 1 }),
  /** Curtains lit from behind: a lamp on in the room at night. */
  /** Curtains with the lamp behind them: one warm glow whatever the cloth, so they all batch together. */
  glowFabric: (color) => std(`a:glowFabric:${color}`, { map: carpetTexture(), color, emissive: '#eca24a', emissiveIntensity: 0.9, roughness: 1 }),
  paint: (color, roughness = 0.55, metalness = 0.1) => {
    const finish = finishOf(roughness, metalness)
    return solid(`a:paint:${color}:${finish}`, color, finish)
  },
  carPaint: (color) => solid(`a:carPaint:${color}`, color, 'gloss'),
  chrome: () => std('a:chrome', { color: '#d6d8da', roughness: 0.2, metalness: 0.95 }),
  glass: () => std('a:glass', { color: '#24323c', roughness: 0.12, metalness: 0.5 }),
  rubber: () => solid('a:rubber', '#1c1b1b', 'matte'),
  whitewall: () => solid('a:whitewall', '#f1efe8', 'satin'),
  steel: () => solid('a:steel', '#9aa0a3', 'metal'),
  steelDark: () => solid('a:steelDark', '#3e4245', 'metal'),
  rust: () => std('a:rust', { map: rustTexture(), roughness: 0.9, metalness: 0.3 }),
  tank: () => solid('a:tank', '#d9dcd8', 'metal'),
  chainLink: () =>
    mat('a:chainLink', () => new MeshStandardMaterial({ map: chainLinkTexture(), alphaTest: 0.5, side: DoubleSide, roughness: 0.6, metalness: 0.6 })),
  mannequin: () => solid('a:mannequin', '#dccab0', 'satin'),
  cardboard: () => std('a:cardboard', { map: cardboardTexture(), roughness: 0.95 }),
  lampGlass: () => std('a:lampGlass', { color: '#fffaf0', emissive: '#fff1cc', emissiveIntensity: 0.6, roughness: 0.3 }),
  water: () => solid('a:water', '#5aa7b8', 'gloss'),
  /**
   * A ground layer: the same look as `name`, with a depth offset (k = 1, 2, ...
   * for each layer up) so it never flickers against the layer under it, even
   * far off across the map.
   */
  layer: (name, k) =>
    mat(`a:layer:${name}:${k}`, () => {
      const m = acres[name]().clone()
      m.polygonOffset = true
      m.polygonOffsetFactor = -k
      m.polygonOffsetUnits = -2 * k
      return m
    }),
  /** Signs: a texture on a board, nudged in front of it. */
  sign: (key, texture) =>
    mat(`a:sign:${key}`, () => new MeshStandardMaterial({ map: texture(), roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 })),
  decal: (key, texture) =>
    mat(`a:decal:${key}`, () =>
      new MeshStandardMaterial({ map: texture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, roughness: 0.6 }),
    ),
}

/** Textured signs, by name. */
export const signs = {
  welcome: () => acres.sign('welcome', welcomeSignTexture),
  roadClosed: () => acres.sign('roadClosed', roadClosedTexture),
  stripes: () => acres.sign('stripes', barricadeStripeTexture),
  clock: () => acres.sign('clock', clockTexture),
  shelter: () => acres.sign('shelter', shelterSignTexture),
  warning: () => acres.sign('warning', warningSignTexture),
  busFront: () => acres.sign('busFront', busSignTexture),
  blade: (name) => acres.sign(`blade:${name}`, () => streetBladeTexture(name)),
  trailerLogo: () => acres.decal('trailerLogo', trailerLogoTexture),
  busSide: () => acres.decal('busSide', busSideTexture),
  star: () => acres.decal('star', starTexture),
}
