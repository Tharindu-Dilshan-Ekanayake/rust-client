import { AdditiveBlending, CanvasTexture, Group, Sprite, SpriteMaterial, SRGBColorSpace } from 'three'

import { flareTexture } from '../world/textures.js'

/** Sprites drawn over other players: name tags, the muzzle flash, a sniper's scope glint. */

const nameplateCache = new Map()
export function nameplateMaterial(name, color, onTop) {
  const key = `${name}|${color}|${onTop}`
  if (nameplateCache.has(key)) return nameplateCache.get(key)
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 96
  const ctx = c.getContext('2d')
  ctx.font = '700 54px Rajdhani, Oswald, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 8
  ctx.strokeStyle = 'rgba(0,0,0,0.75)'
  ctx.strokeText(name.toUpperCase(), 256, 50)
  ctx.fillStyle = color
  ctx.fillText(name.toUpperCase(), 256, 50)
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  const mat = new SpriteMaterial({ map: tex, depthTest: !onTop, depthWrite: false, transparent: true })
  nameplateCache.set(key, mat)
  return mat
}

export const glintMaterial = new SpriteMaterial({
  map: flareTexture(),
  color: '#fff6dc',
  blending: AdditiveBlending,
  depthWrite: false,
  transparent: true,
  sizeAttenuation: false,
})
export const flashMaterial = new SpriteMaterial({
  map: flareTexture(),
  color: '#ffcf7a',
  blending: AdditiveBlending,
  depthWrite: false,
  transparent: true,
})

/** One of each, for the shader warm-up (their shaders took ~0.1 s to build at first sight). */
export function spriteShowcase() {
  const g = new Group()
  for (const material of [nameplateMaterial('A', '#ffffff', true), nameplateMaterial('A', '#ffffff', false), glintMaterial, flashMaterial]) {
    g.add(new Sprite(material))
  }
  return g
}
