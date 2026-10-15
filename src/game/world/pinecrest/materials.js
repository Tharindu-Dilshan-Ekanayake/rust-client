import { DoubleSide, MeshLambertMaterial, MeshStandardMaterial, Vector2 } from 'three'

import { acres } from '../acres/materials.js'
import { brickRedTexture } from '../acres/textures.js'
import { FoliageMaterial } from '../bramble/materials.js'
import { pw } from '../palmwood/materials.js'
import { tarpTexture } from '../palmwood/textures.js'
import { chainLinkTexture } from '../textures.js'
import {
  birchBarkTexture,
  fallTexture,
  foamTexture,
  foliageTexture,
  forestFloorTexture,
  forestWallTexture,
  graniteTexture,
  gravelTexture,
  meadowTexture,
  mountainTexture,
  pineBarkTexture,
  rippleTexture,
} from './textures.js'

/**
 * Materials for Pinecrest Lodge, built once and shared. Every leaf in the map
 * (birches, pines, bracken, grass, the woods across the valley) is the one
 * foliage material, tinted per plant, so the static batcher draws them all at
 * once; the ground is one splatted material; every rock face and boulder is
 * the one granite. Few shader variants (each costs a compile on loading):
 * the rest share the plain textured and coloured ones. The buildings share Atomic Acres' and Palmwood's.
 */

const cache = new Map()
const mat = (key, build) => {
  if (!cache.has(key)) cache.set(key, build())
  return cache.get(key)
}
const std = (key, opts) => mat(key, () => new MeshStandardMaterial(opts))

/**
 * The ground: fallen leaves (the material's map) blended into meadow grass
 * and gravel by the mesh's `splat` attribute (x grass, y gravel), the edges
 * broken up by the textures' own light and dark so they look worn rather
 * than painted on; vertex colours tint it (wet by the water, darker under
 * the trees).
 */
class GroundMaterial extends MeshStandardMaterial {
  onBeforeCompile(shader) {
    shader.uniforms.grassMap = { value: this.userData.grass }
    shader.uniforms.gravelMap = { value: this.userData.gravel }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 splat;\nvarying vec2 vSplat;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSplat = splat;')
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D grassMap;\nuniform sampler2D gravelMap;\nvarying vec2 vSplat;').replace(
      '#include <map_fragment>',
      `#ifdef USE_MAP
        vec3 litter = texture2D(map, vMapUv).rgb;
        vec3 grass = texture2D(grassMap, vMapUv * 1.33).rgb;
        vec3 gravel = texture2D(gravelMap, vMapUv * 1.33).rgb;
        float wg = smoothstep(0.36, 0.64, vSplat.x + (dot(grass, vec3(0.333)) - 0.32) * 0.9);
        float wr = smoothstep(0.36, 0.64, vSplat.y + (dot(litter, vec3(0.333)) - 0.3) * 0.9);
        diffuseColor.rgb *= mix(mix(litter, grass, wg), gravel, wr);
      #endif`,
    )
  }
}

export const pc = {
  /** Every leaf: the foliage atlas (PC_UV), cut out by alpha, tinted per plant. */
  foliage: (tint = '#ffffff') =>
    mat(`pc:foliage:${tint}`, () => {
      const m = new FoliageMaterial({ map: foliageTexture(), color: tint, alphaTest: 0.45, side: DoubleSide, roughness: 0.85, metalness: 0 })
      // Drawn depth first, then lit only where it's in front (see StaticBatcher).
      m.userData.prepass = true
      return m
    }),
  /** The arena's ground: its own draw, vertex colours and all. */
  ground: () =>
    mat('pc:ground', () => {
      const m = new GroundMaterial({ map: forestFloorTexture(), vertexColors: true, roughness: 1, metalness: 0 })
      m.userData.grass = meadowTexture()
      m.userData.gravel = gravelTexture()
      return m
    }),
  /** The land past the edge: the leaves alone, darkened by vertex colour, on the cheap Lambert shader (it fills much of the screen). */
  farGround: () => mat('pc:farGround', () => new MeshLambertMaterial({ map: forestFloorTexture(), vertexColors: true })),
  /** Granite: on UVs laid along whichever axis each face looks (see rockUV), so it never stretches down a cliff. */
  rock: () => std('pc:rock', { map: graniteTexture(), roughness: 0.92, metalness: 0 }),
  birchBark: () => std('pc:birchBark', { map: birchBarkTexture(), roughness: 0.9, metalness: 0 }),
  pineBark: () => std('pc:pineBark', { map: pineBarkTexture(), roughness: 1, metalness: 0 }),
  /** Sawn ends of logs and stumps: pale wood. */
  endGrain: () => std('pc:endGrain', { color: '#b89870', roughness: 0.9, metalness: 0 }),
  /** The lake: dark, still, catching the sky, the shallows just showing through; its ripples drift (see water.jsx). (Transparent like the creek: one shader for both.) */
  lake: () =>
    mat('pc:lake', () => new MeshStandardMaterial({ color: '#3a565c', normalMap: rippleTexture(), normalScale: new Vector2(0.5, 0.5), roughness: 0.1, metalness: 0.2, envMapIntensity: 1.3, transparent: true, opacity: 0.94 })),
  /** The creek: clearer, the stones showing through; its ripples run downstream. */
  creek: () =>
    mat('pc:creek', () => {
      const ripples = rippleTexture().clone()
      ripples.needsUpdate = true
      return new MeshStandardMaterial({ color: '#46625c', normalMap: ripples, normalScale: new Vector2(0.6, 0.6), roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.62, envMapIntensity: 1.1 })
    }),
  // (Two-sided in one pass: drawn in two, a see-through two-sided material costs a second shader.)
  fall: () => mat('pc:fall', () => new MeshStandardMaterial({ map: fallTexture(), color: '#eef6f6', transparent: true, depthWrite: false, side: DoubleSide, forceSinglePass: true, roughness: 0.3, metalness: 0 })),
  // (Two-sided like the fall: one shader for both.)
  foam: () => mat('pc:foam', () => new MeshStandardMaterial({ map: foamTexture(), transparent: true, depthWrite: false, side: DoubleSide, forceSinglePass: true, roughness: 0.6, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })),
  /** The far mountains: their haze is in the texture, so the fog leaves them be. Lambert: they cover a lot of sky. */
  mountain: () => mat('pc:mountain', () => new MeshLambertMaterial({ map: mountainTexture(), flatShading: true, fog: false })),
  /** The woods across the valley, bands of silhouettes: Lambert, drawn depth first (see backdrop.jsx). */
  forestWall: () =>
    mat('pc:forestWall', () => {
      const m = new MeshLambertMaterial({ map: forestWallTexture(), color: '#a4a89a', alphaTest: 0.5, side: DoubleSide })
      m.userData.prepass = true
      return m
    }),
  /** The glasshouse: old, a little milky. */
  glass: () =>
    mat('pc:glass', () => new MeshStandardMaterial({ color: '#dfe9e8', transparent: true, opacity: 0.24, roughness: 0.06, metalness: 0.3, depthWrite: false, envMapIntensity: 1.2, side: DoubleSide, forceSinglePass: true })),
  brick: () => std('pc:brick', { map: brickRedTexture(), color: '#b89488', roughness: 0.95, metalness: 0 }),
  /** White-painted steel (the glasshouse's frame). */
  frame: () => pw.paint('#ebe9e2', 0.5, 0.2),
  /** Galvanised steel: fence posts, the gantry, the pylons' bolts. */
  steel: () => pw.paint('#9aa0a2', 0.45, 0.7),
  /** The transformers' green. */
  transformer: () => pw.paint('#5d7458', 0.6, 0.3),
  pylon: () => pw.paint('#a8473a', 0.6, 0.4),
  porcelain: () => pw.paint('#7a5a46', 0.3, 0.1),
  /** Chain-link: on the forest bands' shader (Lambert, cut out, two-sided) rather than a shader of its own. */
  chainLink: () => mat('pc:chainLink', () => new MeshLambertMaterial({ map: chainLinkTexture(), color: '#c4c8c8', alphaTest: 0.5, side: DoubleSide })),
  /** Black tarps (boxes, so one-sided: the plain textured shader). */
  tarp: () => std('pc:tarp', { map: tarpTexture(), color: '#1e2022', roughness: 0.8, metalness: 0 }),
  wood: (tint) => pw.wood(tint),
  plank: () => acres.plank(),
  concrete: () => acres.concrete(),
  stone: () => acres.stone(),
  paint: (color, roughness, metalness) => pw.paint(color, roughness, metalness),
  rust: () => pw.rust(),
  rubber: () => pw.rubber(),
}
