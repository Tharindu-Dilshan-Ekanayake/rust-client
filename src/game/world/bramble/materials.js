import { DoubleSide, MeshStandardMaterial } from 'three'

import { acres } from '../acres/materials.js'
import { hc } from '../hollow/materials.js'
import { pw } from '../palmwood/materials.js'
import { brickRedTexture } from '../acres/textures.js'
import { jungleGrassTexture, trackTexture } from '../palmwood/textures.js'
import { creekBankTexture, creekBedTexture, foliageTexture, furrowTexture } from './textures.js'

/**
 * Materials for Bramblewood, built once and shared. Materials that differ only
 * in colour batch together (the static batcher bakes the colour into the
 * vertices), so every leaf in the map (trees, bushes, ivy, grass, ferns) is
 * one draw whatever its shade; the houses, sheds and props share the other
 * maps' (Atomic Acres' houses, Palmwood's tin and timber, Hollow Creek's
 * bark, mud, water and hay).
 */

const cache = new Map()
const mat = (key, build) => {
  if (!cache.has(key)) cache.set(key, build())
  return cache.get(key)
}
const std = (key, opts) => mat(key, () => new MeshStandardMaterial(opts))

/**
 * Leaf cards fade out as they turn edge-on to the eye: a card seen side-on
 * squeezes the atlas into a few texels, whose blurred mip comes through the
 * alpha test as a pale vertical streak. The face's slope comes from screen
 * derivatives, so nothing extra is stored. The hook is a method, not an own
 * property, so the static batcher still merges every tint into one draw.
 */
class FoliageMaterial extends MeshStandardMaterial {
  onBeforeCompile(shader) {
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <alphatest_fragment>',
        `{
          vec3 faceN = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
          diffuseColor.a *= smoothstep(0.15, 0.5, abs(dot(faceN, normalize(vViewPosition))));
        }
        #include <alphatest_fragment>`,
      )
      // The cards' normals point up, so leaves light like a canopy. Two-sided
      // materials flip the normal on back faces, which would light every card
      // seen from behind as if it faced the ground: half of each crossed pair
      // dark, half bright, in hard-edged bands. Keep it up from both sides.
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n\tnormal = normalize( vNormal );')
  }
}

export const br = {
  /** Every leaf: the foliage atlas (BR_UV), cut out by alpha, tinted a little per plant. */
  foliage: (tint = '#ffffff') =>
    mat(`br:foliage:${tint}`, () => {
      const m = new FoliageMaterial({ map: foliageTexture(), color: tint, alphaTest: 0.45, side: DoubleSide, roughness: 0.85, metalness: 0 })
      // Drawn depth first, then lit only where it's in front (see StaticBatcher).
      m.userData.prepass = true
      return m
    }),
  furrows: () => std('br:furrows', { map: furrowTexture(), roughness: 1, metalness: 0 }),
  /** Palmwood's wild grass, toned down from the tropics to a damp temperate green. */
  grass: () => std('br:grass', { map: jungleGrassTexture(), color: '#9aa47e', roughness: 1, metalness: 0 }),
  /** The rutted mud track, browner. */
  track: () => std('br:track', { map: trackTexture(), color: '#c4b49c', roughness: 0.95, metalness: 0 }),
  mud: () => hc.mud(),
  /** The creek's dry, cracked bed, and its banks' bare earth. */
  creekBed: () => std('br:creekBed', { map: creekBedTexture(), roughness: 1, metalness: 0 }),
  bank: () => std('br:bank', { map: creekBankTexture(), roughness: 1, metalness: 0 }),
  /** Stones in the creek: plain grey, faceted. */
  pebble: () => std('br:pebble', { color: '#7c786e', roughness: 1, metalness: 0, flatShading: true }),
  water: () => hc.water(),
  bark: () => hc.bark(),
  hay: () => hc.hay(),
  /** Old brick, dirtied and faded (Atomic Acres' is new). */
  brick: () => std('br:brick', { map: brickRedTexture(), color: '#a6857a', roughness: 0.95, metalness: 0 }),
  stone: () => acres.stone(),
  concrete: () => acres.concrete(),
  rock: () => acres.rock(),
  wood: (tint) => pw.wood(tint),
  tin: (name) => pw.tin(name),
  rust: () => pw.rust(),
  paint: (color, roughness, metalness) => pw.paint(color, roughness, metalness),
  rubber: () => pw.rubber(),
  ember: () => pw.ember(),
  /**
   * A ground layer: the same look as `name` with a depth offset (k = 1, 2, ...
   * for each layer up) so it never flickers against the layer under it.
   */
  layer: (name, k) =>
    mat(`br:layer:${name}:${k}`, () => {
      const m = br[name]().clone()
      m.polygonOffset = true
      m.polygonOffsetFactor = -k
      m.polygonOffsetUnits = -2 * k
      return m
    }),
}
