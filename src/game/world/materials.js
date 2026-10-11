import { BoxGeometry, CylinderGeometry, DoubleSide, MeshStandardMaterial } from 'three'

import {
  blockTexture,
  brickTexture,
  burlapTexture,
  camoTexture,
  chainLinkTexture,
  concreteTexture,
  corrugatedTexture,
  graffitiTexture,
  pipelineTexture,
  grateTexture,
  hazardStripeTexture,
  machineTexture,
  paintedSteelTexture,
  rustTexture,
  sandTexture,
  tankTexture,
  twallTexture,
  weldMeshTexture,
  woodTexture,
} from './textures.js'

/**
 * Shared geometries and materials for the map.
 *
 * Geometry UVs are scaled to world size (one texture tile per `tile` metres), so a
 * single material can cover a 0.5 m crate and a 6 m wall at the same texel density.
 */

const geoCache = new Map()

/** Box whose UVs tile every `tile` metres on every face. */
export function boxGeo(w, h, d, tile = 2) {
  const key = `b:${w.toFixed(3)}:${h.toFixed(3)}:${d.toFixed(3)}:${tile}`
  if (geoCache.has(key)) return geoCache.get(key)
  const g = new BoxGeometry(w, h, d)
  const uv = g.getAttribute('uv')
  // Face order: +x, -x, +y, -y, +z, -z; four vertices each.
  const faces = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ]
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const idx = f * 4 + i
      uv.setXY(idx, (uv.getX(idx) * faces[f][0]) / tile, (uv.getY(idx) * faces[f][1]) / tile)
    }
  }
  uv.needsUpdate = true
  geoCache.set(key, g)
  return g
}

/** Cylinder with UVs scaled to circumference/height. */
export function cylGeo(r, h, segments = 24, tile = 2, openEnded = false, rTop = r) {
  const key = `c:${r.toFixed(3)}:${rTop.toFixed(3)}:${h.toFixed(3)}:${segments}:${tile}:${openEnded}`
  if (geoCache.has(key)) return geoCache.get(key)
  const g = new CylinderGeometry(rTop, r, h, segments, 1, openEnded)
  const uv = g.getAttribute('uv')
  const circ = Math.PI * 2 * Math.max(r, rTop)
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (uv.getX(i) * circ) / tile, (uv.getY(i) * h) / tile)
  }
  uv.needsUpdate = true
  geoCache.set(key, g)
  return g
}

const matCache = new Map()
function mat(key, build) {
  if (!matCache.has(key)) matCache.set(key, build())
  return matCache.get(key)
}

export const materials = {
  sand: () => mat('sand', () => new MeshStandardMaterial({ map: sandTexture(), roughness: 1, metalness: 0 })),
  concrete: () =>
    mat('concrete', () => new MeshStandardMaterial({ map: concreteTexture(), roughness: 0.95, metalness: 0 })),
  concreteDark: () =>
    mat('concreteDark', () => new MeshStandardMaterial({ map: concreteTexture(), color: '#9a9184', roughness: 0.95 })),
  rust: () => mat('rust', () => new MeshStandardMaterial({ map: rustTexture(), roughness: 0.85, metalness: 0.35 })),
  pipe: () => mat('pipe', () => new MeshStandardMaterial({ map: pipelineTexture(), roughness: 0.82, metalness: 0.3 })),
  /** Fire-gutted tanker shell: scorched black over the rusty paint. */
  tankerBurnt: () =>
    mat('tankerBurnt', () => new MeshStandardMaterial({ map: rustTexture(), color: '#86705e', roughness: 0.95, metalness: 0.2 })),
  /** Glowing embers inside burning wrecks (Effects flickers its intensity). */
  ember: () => mat('ember', () => new MeshStandardMaterial({ color: '#2a120a', emissive: '#ff5a14', emissiveIntensity: 2.2, roughness: 1 })),
  pipeInside: () =>
    mat('pipeInside', () => new MeshStandardMaterial({ color: '#2a1d16', roughness: 1, side: DoubleSide })),
  tower: () =>
    mat('tower', () => new MeshStandardMaterial({ map: paintedSteelTexture(), roughness: 0.7, metalness: 0.4 })),
  tank: () => mat('tank', () => new MeshStandardMaterial({ map: tankTexture(), roughness: 0.75, metalness: 0.35 })),
  corrugated: (color) =>
    mat(`corr:${color}`, () => new MeshStandardMaterial({ map: corrugatedTexture(), color, roughness: 0.75, metalness: 0.2 })),
  wood: () => mat('wood', () => new MeshStandardMaterial({ map: woodTexture(), roughness: 0.9 })),
  /** Conveyor belt: worn grey rubber with a grip pattern (the grate texture). */
  belt: () => mat('belt', () => new MeshStandardMaterial({ map: grateTexture(), color: '#8a8378', roughness: 0.92, metalness: 0.1 })),
  grate: () => mat('grate', () => new MeshStandardMaterial({ map: grateTexture(), roughness: 0.8, metalness: 0.5 })),
  machine: () =>
    mat('machine', () => new MeshStandardMaterial({ map: machineTexture(), roughness: 0.6, metalness: 0.45 })),
  burlap: () => mat('burlap', () => new MeshStandardMaterial({ map: burlapTexture(), roughness: 1 })),
  steelDark: () => mat('steelDark', () => new MeshStandardMaterial({ color: '#3b3732', roughness: 0.6, metalness: 0.7 })),
  steel: () => mat('steel', () => new MeshStandardMaterial({ color: '#7d776d', roughness: 0.5, metalness: 0.75 })),
  rubber: () => mat('rubber', () => new MeshStandardMaterial({ color: '#1d1b1a', roughness: 0.95 })),
  burnt: () => mat('burnt', () => new MeshStandardMaterial({ map: rustTexture(), color: '#b3a290', roughness: 0.95, metalness: 0.25 })),
  hazard: () => mat('hazard', () => new MeshStandardMaterial({ color: '#d6a51c', roughness: 0.6 })),
  ammoGreen: () => mat('ammoGreen', () => new MeshStandardMaterial({ color: '#4c5a33', roughness: 0.7, metalness: 0.3 })),
  barrel: (color) =>
    mat(`barrel:${color}`, () => new MeshStandardMaterial({ map: rustTexture(), color, roughness: 0.6, metalness: 0.5 })),
  chainLink: () =>
    mat('chainLink', () => {
      const m = new MeshStandardMaterial({
        map: chainLinkTexture(),
        alphaTest: 0.5,
        transparent: false,
        side: DoubleSide,
        roughness: 0.6,
        metalness: 0.6,
      })
      return m
    }),
  wire: () => mat('wire', () => new MeshStandardMaterial({ color: '#8d8a84', roughness: 0.4, metalness: 0.9 })),
  palmTrunk: () => mat('palmTrunk', () => new MeshStandardMaterial({ color: '#6f5638', roughness: 1 })),
  plaster: () =>
    mat('plaster', () => new MeshStandardMaterial({ map: concreteTexture(), color: '#d8c7a6', roughness: 0.95 })),
  floor: () => mat('floor', () => new MeshStandardMaterial({ map: concreteTexture(), color: '#8d8476', roughness: 0.95 })),
  light: () => mat('light', () => new MeshStandardMaterial({ color: '#ff4a2a', emissive: '#ff2a10', emissiveIntensity: 3 })),
  brick: () => mat('brick', () => new MeshStandardMaterial({ map: brickTexture(), roughness: 0.95 })),
  ruinPlaster: () =>
    mat('ruinPlaster', () => new MeshStandardMaterial({ map: concreteTexture(), color: '#c4b69c', roughness: 0.97 })),
  /** Torn walls of the shelled buildings: grey-beige concrete block, not red brick. */
  ruinBlock: () => mat('ruinBlock', () => new MeshStandardMaterial({ map: blockTexture(), color: '#d2c6b0', roughness: 0.97 })),
  slab: () => mat('slab', () => new MeshStandardMaterial({ map: concreteTexture(), color: '#a39b8c', roughness: 0.95 })),
  rock: () => mat('rock', () => new MeshStandardMaterial({ map: concreteTexture(), color: '#a88f6c', roughness: 1, flatShading: true })),
  charred: () => mat('charred', () => new MeshStandardMaterial({ color: '#3d322a', roughness: 1 })),
  wireLine: () => mat('wireLine', () => new MeshStandardMaterial({ color: '#2b2622', roughness: 0.8 })),
  camo: () =>
    mat('camo', () => new MeshStandardMaterial({ map: camoTexture(), alphaTest: 0.5, side: DoubleSide, roughness: 1 })),
  lampGlow: () => mat('lampGlow', () => new MeshStandardMaterial({ color: '#fff0d0', emissive: '#ffcf80', emissiveIntensity: 2.5 })),
  /** Weathered dark steel for the tower frame (the red mast stays painted). */
  towerDark: () =>
    mat('towerDark', () => new MeshStandardMaterial({ map: paintedSteelTexture(), color: '#77665a', roughness: 0.75, metalness: 0.45 })),
  hazardStripe: () => mat('hazardStripe', () => new MeshStandardMaterial({ map: hazardStripeTexture(), roughness: 0.7, metalness: 0.2 })),
  weldMesh: () =>
    mat('weldMesh', () => new MeshStandardMaterial({ map: weldMeshTexture(), alphaTest: 0.5, side: DoubleSide, roughness: 0.8, metalness: 0.4 })),
  tankWhite: () =>
    mat('tankWhite', () => new MeshStandardMaterial({ map: tankTexture(), color: '#f4efe6', roughness: 0.7, metalness: 0.25 })),
  ridge: () => mat('ridge', () => new MeshStandardMaterial({ color: '#b89a74', roughness: 1 })),
  twall: () => mat('twall', () => new MeshStandardMaterial({ map: twallTexture(), roughness: 0.95 })),
  graffiti: (i) =>
    mat(`graffiti:${i}`, () =>
      new MeshStandardMaterial({
        map: graffitiTexture(i),
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        roughness: 0.8,
      }),
    ),
}

const instancedCache = new Map()

/**
 * A copy of a material for instanced meshes. Sharing one material between
 * instanced and plain meshes makes three.js swap shader programs on every draw.
 */
export function instancedVariant(material) {
  if (!instancedCache.has(material)) instancedCache.set(material, material.clone())
  return instancedCache.get(material)
}

export const CONTAINER_COLORS = {
  red: '#9c3a2c',
  blue: '#2f5a86',
  green: '#4c6b3c',
  orange: '#c46a2a',
  white: '#c9c4b8',
  rust: '#7a4a2e',
  teal: '#2f6f6a',
  mustard: '#a8842e',
}

export const BARREL_COLORS = {
  red: '#9b2f22',
  blue: '#2b4f7a',
  yellow: '#b8862a',
}
