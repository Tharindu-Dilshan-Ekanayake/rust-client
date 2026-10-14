import { DoubleSide, MeshStandardMaterial } from 'three'

import { pw } from '../palmwood/materials.js'
import { blockTexture, concreteTexture } from '../textures.js'
import { awningTexture, dryTexture, dustTexture, louvreTexture, pavingTexture, roadTexture, signTexture, stuccoTexture, tileTexture } from './textures.js'

/**
 * Materials for Old Quarter, built once and shared. Materials that differ only
 * in colour batch together (the static batcher bakes the colour into the
 * vertices), so every stucco wall in town, inside and out, is one draw, every
 * concrete slab, stair and ledge another; the shacks' tin and timber and the
 * palms share Palmwood's, and the dry grass and twigs are one atlas.
 */

const cache = new Map()
const mat = (key, build) => {
  if (!cache.has(key)) cache.set(key, build())
  return cache.get(key)
}
const std = (key, opts) => mat(key, () => new MeshStandardMaterial(opts))

export const oq = {
  /** Stucco render, tinted per building (and paler inside). */
  stucco: (tint = '#ffffff') => std(`oq:stucco:${tint}`, { map: stuccoTexture(), color: tint, roughness: 0.95, metalness: 0 }),
  /** Cast concrete: slabs, stairs, ledges, sills, columns, copings, kerbs. */
  concrete: (tint = '#cfc8ba') => std(`oq:concrete:${tint}`, { map: concreteTexture(), color: tint, roughness: 0.95, metalness: 0 }),
  /** Bare concrete block (the Skeleton's walls going up). */
  block: () => std('oq:block', { map: blockTexture(), roughness: 0.95, metalness: 0 }),
  tile: (tint = '#ffffff') => std(`oq:tile:${tint}`, { map: tileTexture(), color: tint, roughness: 0.7, metalness: 0 }),
  /** The ground-floor tiles (a layer: see `layer`), the same warm tint as the floors upstairs. */
  floorTile: () => oq.tile('#ead6b6'),
  dust: () => std('oq:dust', { map: dustTexture(), roughness: 1, metalness: 0 }),
  paving: () => std('oq:paving', { map: pavingTexture(), roughness: 0.95, metalness: 0 }),
  asphalt: () => std('oq:asphalt', { map: roadTexture(), roughness: 0.95, metalness: 0 }),
  louvre: (tint) => std(`oq:louvre:${tint}`, { map: louvreTexture(), color: tint, roughness: 0.8, metalness: 0 }),
  awning: (tint) => std(`oq:awning:${tint}`, { map: awningTexture(), color: tint, roughness: 0.9, metalness: 0, side: DoubleSide }),
  signs: () => std('oq:signs', { map: signTexture(), roughness: 0.75, metalness: 0 }),
  /** Dry grass and dead twigs: one atlas (DRY_UV), tinted a little per tuft. */
  dry: (tint = '#ffffff') =>
    mat(`oq:dry:${tint}`, () => new MeshStandardMaterial({ map: dryTexture(), color: tint, alphaTest: 0.4, side: DoubleSide, roughness: 0.9, metalness: 0 })),
  wood: (tint) => pw.wood(tint),
  tin: (name) => pw.tin(name),
  paint: (color, roughness, metalness) => pw.paint(color, roughness, metalness),
  rubber: () => pw.rubber(),
  /**
   * A ground layer: the same look as `name` with a depth offset (k = 1, 2, ...
   * for each layer up) so it never flickers against the layer under it.
   */
  layer: (name, k) =>
    mat(`oq:layer:${name}:${k}`, () => {
      const m = oq[name]().clone()
      m.polygonOffset = true
      m.polygonOffsetFactor = -k
      m.polygonOffsetUnits = -2 * k
      return m
    }),
}
