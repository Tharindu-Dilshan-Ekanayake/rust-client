import { AdditiveBlending, Color, DoubleSide, MeshBasicMaterial, MeshStandardMaterial } from 'three'

import { materials as world } from '../materials.js'
import { pw } from '../palmwood/materials.js'
import { chainLinkTexture, concreteTexture, woodTexture } from '../textures.js'
import {
  advertTexture,
  asphaltTexture,
  boardTexture,
  brushedTexture,
  carpetTexture,
  ceilingTexture,
  claddingTexture,
  fabricTexture,
  fanTexture,
  finTexture,
  goodsTexture,
  hatchTexture,
  liningTexture,
  liveryTexture,
  plasterTexture,
  ribTexture,
  sackTexture,
  scorchTexture,
  signTexture,
  stoneTexture,
  tarmacTexture,
  wreckSkinTexture,
} from './textures.js'

/**
 * Materials for Skyport Terminal, built once and shared. Materials that differ
 * only in colour batch together (the static batcher bakes the colour into the
 * vertices), so the whole terminal's cladding is one draw, all its plaster
 * another, every seat's fabric another; plain paints share Palmwood's (so
 * they batch with the other props'), and every sign and screen is one atlas.
 */

const cache = new Map()
const mat = (key, build) => {
  if (!cache.has(key)) cache.set(key, build())
  return cache.get(key)
}
const std = (key, opts) => mat(key, () => new MeshStandardMaterial(opts))

export const tm = {
  tarmac: () => std('tm:tarmac', { map: tarmacTexture(), roughness: 0.92, metalness: 0 }),
  asphalt: () => std('tm:asphalt', { map: asphaltTexture(), roughness: 0.95, metalness: 0 }),
  /** Cast concrete: kerbs, plinths, the outside stairs, the roof. */
  concrete: (tint = '#c8c6c0') => std(`tm:concrete:${tint}`, { map: concreteTexture(), color: tint, roughness: 0.95, metalness: 0 }),
  /** Polished stone floors: glossy enough to catch the sky through the glass. */
  stone: (tint = '#ffffff') => std(`tm:stone:${tint}`, { map: stoneTexture(), color: tint, roughness: 0.22, metalness: 0, envMapIntensity: 0.7 }),
  carpet: (tint) => std(`tm:carpet:${tint}`, { map: carpetTexture(), color: tint, roughness: 1, metalness: 0 }),
  cladding: (tint = '#ffffff') => std(`tm:cladding:${tint}`, { map: claddingTexture(), color: tint, roughness: 0.55, metalness: 0.25 }),
  plaster: (tint = '#ffffff') => std(`tm:plaster:${tint}`, { map: plasterTexture(), color: tint, roughness: 0.9, metalness: 0 }),
  ceiling: (tint = '#ffffff') => std(`tm:ceiling:${tint}`, { map: ceilingTexture(), color: tint, roughness: 0.9, metalness: 0 }),
  rib: (tint = '#ffffff') => std(`tm:rib:${tint}`, { map: ribTexture(), color: tint, roughness: 0.45, metalness: 0.55 }),
  brushed: (tint = '#ffffff') => std(`tm:brushed:${tint}`, { map: brushedTexture(), color: tint, roughness: 0.35, metalness: 0.75 }),
  goods: () => std('tm:goods', { map: goodsTexture(), roughness: 0.7, metalness: 0 }),
  fabric: (tint) => std(`tm:fabric:${tint}`, { map: fabricTexture(), color: tint, roughness: 0.95, metalness: 0 }),
  wood: (tint = '#ffffff') => pw.wood(tint),
  oak: (tint = '#c79a62') => std(`tm:oak:${tint}`, { map: woodTexture(), color: tint, roughness: 0.6, metalness: 0 }),
  paint: (color, roughness = 0.6, metalness = 0) => pw.paint(color, roughness, metalness),
  rubber: () => pw.rubber(),
  /** Glass: tinted, a little reflective, see-through. Never casts a shadow. */
  glass: (tint = '#a9c4d4') =>
    mat(`tm:glass:${tint}`, () => new MeshStandardMaterial({ color: tint, transparent: true, opacity: 0.2, roughness: 0.04, metalness: 0.4, depthWrite: false, envMapIntensity: 1.1, side: DoubleSide })),
  /** Light fittings, lit signs' backs: plain bright, unlit. */
  glow: (color = '#fff7e6') => mat(`tm:glow:${color}`, () => new MeshBasicMaterial({ color: new Color(color), toneMapped: false })),
  /** Signs and screens: one atlas each, unlit. */
  signs: () => mat('tm:signs', () => new MeshBasicMaterial({ map: signTexture(), toneMapped: false })),
  board: () => mat('tm:board', () => new MeshBasicMaterial({ map: boardTexture(), toneMapped: false })),
  adverts: () => mat('tm:adverts', () => new MeshBasicMaterial({ map: advertTexture(), toneMapped: false })),
  /** Paint on the apron: white lines tinted yellow, red or white; the hatch and the stand number cut out. */
  paintLine: (tint) => std(`tm:line:${tint}`, { color: tint, roughness: 0.75, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
  hatch: (tint) =>
    mat(`tm:hatch:${tint}`, () => new MeshStandardMaterial({ map: hatchTexture(), color: tint, alphaTest: 0.5, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })),
  stencil: (tint = '#f2c230') =>
    mat(`tm:stencil:${tint}`, () => new MeshStandardMaterial({ map: signTexture(), alphaMap: signTexture(), alphaTest: 0.5, color: tint, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })),
  /** The jet. */
  livery: () => std('tm:livery', { map: liveryTexture(), roughness: 0.32, metalness: 0.12 }),
  fin: () => std('tm:fin', { map: finTexture(), roughness: 0.35, metalness: 0.1 }),
  fan: () => std('tm:fan', { map: fanTexture(), roughness: 0.5, metalness: 0.6 }),
  /** The cabin's lining: lit windows glow from the texture's own light. */
  lining: () => std('tm:lining', { map: liningTexture(), roughness: 0.85, metalness: 0 }),
  chainLink: () =>
    mat('tm:chainLink', () => new MeshStandardMaterial({ map: chainLinkTexture(), alphaTest: 0.45, side: DoubleSide, roughness: 0.6, metalness: 0.6 })),
  /** Light from a fitting spilling round it (additive, never written to depth). */
  halo: (color) => mat(`tm:halo:${color}`, () => new MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false, toneMapped: false })),
  /**
   * War damage. Soot laid over walls, floors and the apron (a decal: drawn over
   * whatever it's on, depth-offset well clear of it, never written to depth).
   */
  scorch: () =>
    mat('tm:scorch', () => new MeshStandardMaterial({ map: scorchTexture(), transparent: true, depthWrite: false, roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -12 })),
  /** The crashed jet's sooty, burnt-through skin; what's left inside it. */
  wreckSkin: () => std('tm:wreckSkin', { map: wreckSkinTexture(), roughness: 0.82, metalness: 0.25 }),
  charred: (tint = '#2a2420') => std(`tm:charred:${tint}`, { color: tint, roughness: 1, metalness: 0 }),
  /** Embers glowing in the wrecks (shared with the other maps': the effects flicker it). */
  ember: () => world.ember(),
  /** Inside lit by its own lights (the jet bridge): lit paint that never goes dark. */
  lit: (tint = '#ffffff') => std(`tm:lit:${tint}`, { map: claddingTexture(), color: tint, emissive: tint, emissiveIntensity: 0.15, roughness: 0.6, metalness: 0.1 }),
  /** Ribbed sheet steel, painted (bare, it would read black at dusk). */
  sheet: (tint = '#ffffff') => std(`tm:sheet:${tint}`, { map: ribTexture(), color: tint, roughness: 0.7, metalness: 0.15 }),
  sack: (tint = '#ffffff') => std(`tm:sack:${tint}`, { map: sackTexture(), color: tint, roughness: 1, metalness: 0 }),
  /**
   * A ground layer: the same look as `name` with a depth offset (k = 1, 2, ...
   * for each layer up) so it never flickers against the layer under it.
   */
  layer: (name, k, ...args) =>
    mat(`tm:layer:${name}:${k}:${args.join(':')}`, () => {
      const m = tm[name](...args).clone()
      m.polygonOffset = true
      m.polygonOffsetFactor = -k
      m.polygonOffsetUnits = -2 * k
      return m
    }),
}
