import { CanvasTexture, NoColorSpace, RepeatWrapping, SRGBColorSpace } from 'three'

import { seededRandom } from '../../shared/math.js'

/**
 * Procedural surface maps for weapons: colour, roughness and normal maps painted
 * on canvases at load time (no image files). Each finish is a height field plus
 * tint rules; the normal map is derived from the height so scratches, stippling
 * and wood grain all catch the light.
 */

const SIZE = 256

function canvas(size = SIZE) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  return c
}

/** Tileable value noise with `cells` lattice cells across. */
function noise(cells, rand) {
  const g = new Float32Array(cells * cells)
  for (let i = 0; i < g.length; i++) g[i] = rand()
  const s = (t) => t * t * (3 - 2 * t)
  return (u, v) => {
    const x = u * cells
    const y = v * cells
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const tx = s(x - x0)
    const ty = s(y - y0)
    const xa = ((x0 % cells) + cells) % cells
    const ya = ((y0 % cells) + cells) % cells
    const xb = (xa + 1) % cells
    const yb = (ya + 1) % cells
    const a = g[ya * cells + xa]
    const b = g[ya * cells + xb]
    const c = g[yb * cells + xa]
    const d = g[yb * cells + xb]
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty
  }
}

function finish(c, { color = false, repeat = 1 } = {}) {
  const t = new CanvasTexture(c)
  t.wrapS = RepeatWrapping
  t.wrapT = RepeatWrapping
  t.repeat.set(repeat, repeat)
  t.colorSpace = color ? SRGBColorSpace : NoColorSpace
  t.anisotropy = 8
  t.needsUpdate = true
  return t
}

/** Paints a Float32 height field into a tangent-space normal map. */
function normalFromHeight(h, size, strength) {
  const c = canvas(size)
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(size, size)
  const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength
      const len = Math.hypot(dx, dy, 1)
      const i = (y * size + x) * 4
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255
      img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return c
}

/** Fills a canvas from `fn(u, v, x, y) -> [r, g, b]`. */
function paint(size, fn) {
  const c = canvas(size)
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = fn(x / size, y / size, x, y)
      const i = (y * size + x) * 4
      img.data[i] = r
      img.data[i + 1] = g
      img.data[i + 2] = b
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return c
}

/** Thin random scratches drawn into a height field (negative = groove). */
function scratch(h, size, rand, count, depth) {
  for (let k = 0; k < count; k++) {
    let x = rand() * size
    let y = rand() * size
    const ang = rand() * Math.PI
    const len = 8 + rand() * 50
    const dx = Math.cos(ang)
    const dy = Math.sin(ang)
    for (let s = 0; s < len; s++) {
      const xi = ((Math.round(x) % size) + size) % size
      const yi = ((Math.round(y) % size) + size) % size
      h[yi * size + xi] -= depth * (0.5 + 0.5 * Math.sin((s / len) * Math.PI))
      x += dx
      y += dy
    }
  }
}

const cache = new Map()
const once = (key, build) => {
  if (!cache.has(key)) cache.set(key, build())
  return cache.get(key)
}

/**
 * Hard-anodised / parkerised metal: faint mottling and fine scratches. Returns
 * { map, roughnessMap, normalMap } (the colour map is near-white so the
 * material colour sets the tone).
 */
export const metalFinish = () =>
  once('metal', () => {
    const rand = seededRandom(91)
    const n1 = noise(6, rand)
    const n2 = noise(48, rand)
    const h = new Float32Array(SIZE * SIZE)
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) h[y * SIZE + x] = n2(x / SIZE, y / SIZE) * 0.25
    scratch(h, SIZE, rand, 140, 0.9)
    const map = paint(SIZE, (u, v, x, y) => {
      const m = 0.9 + n1(u, v) * 0.1 + Math.min(0, h[y * SIZE + x]) * -0.25
      const g = Math.min(255, 255 * m)
      return [g, g, g]
    })
    const rough = paint(SIZE, (u, v, x, y) => {
      // Scratches burnish the finish, so they're shinier than the rest.
      const r = 0.5 + n1(u, v) * 0.18 + Math.min(0, h[y * SIZE + x]) * 0.5
      const g = Math.max(0, Math.min(255, r * 255))
      return [g, g, g]
    })
    return {
      map: finish(map, { color: true, repeat: 28 }),
      roughnessMap: finish(rough, { repeat: 28 }),
      normalMap: finish(normalFromHeight(h, SIZE, 2.2), { repeat: 28 }),
    }
  })

/** Cerakote / painted finish: matte, slightly orange-peel, a little grime. */
export const paintFinish = () =>
  once('paint', () => {
    const rand = seededRandom(97)
    const n1 = noise(5, rand)
    const n2 = noise(64, rand)
    const h = new Float32Array(SIZE * SIZE)
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) h[y * SIZE + x] = n2(x / SIZE, y / SIZE)
    scratch(h, SIZE, rand, 40, 0.6)
    const map = paint(SIZE, (u, v, x, y) => {
      const grime = n1(u, v)
      const m = 0.86 + grime * 0.14 + Math.min(0, h[y * SIZE + x] - 0.2) * 0.2
      const g = Math.min(255, 255 * m)
      return [g, g * 0.99, g * 0.96]
    })
    return {
      map: finish(map, { color: true, repeat: 22 }),
      normalMap: finish(normalFromHeight(h, SIZE, 0.9), { repeat: 22 }),
    }
  })

/** Polymer with moulded stippling (grips, handguards, magazines). */
export const stippleFinish = () =>
  once('stipple', () => {
    const rand = seededRandom(103)
    const n = noise(96, rand)
    const h = new Float32Array(SIZE * SIZE)
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const v = n(x / SIZE, y / SIZE)
        h[y * SIZE + x] = v > 0.55 ? (v - 0.55) * 2.4 : 0
      }
    }
    const map = paint(SIZE, (u, v, x, y) => {
      const g = 225 + h[y * SIZE + x] * 30
      return [g, g, g]
    })
    return {
      map: finish(map, { color: true, repeat: 34 }),
      normalMap: finish(normalFromHeight(h, SIZE, 2.6), { repeat: 34 }),
    }
  })

/** Varnished hardwood with long grain and the odd darker streak. */
export const woodFinish = () =>
  once('wood', () => {
    const rand = seededRandom(107)
    const n1 = noise(4, rand)
    const n2 = noise(32, rand)
    const h = new Float32Array(SIZE * SIZE)
    const map = paint(SIZE, (u, v, x, y) => {
      const warp = n1(u, v) * 3.2
      const ring = 0.5 + 0.5 * Math.sin((v * 34 + warp) * Math.PI)
      const fine = n2(u * 0.25, v)
      const t = ring * 0.6 + fine * 0.4
      h[y * SIZE + x] = ring * 0.3
      return [70 + t * 58, 40 + t * 34, 22 + t * 18]
    })
    return {
      map: finish(map, { color: true, repeat: 7 }),
      normalMap: finish(normalFromHeight(h, SIZE, 1.2), { repeat: 7 }),
    }
  })

/** Brushed stainless: fine streaks running one way. */
export const brushedFinish = () =>
  once('brushed', () => {
    const rand = seededRandom(109)
    const streak = noise(128, rand)
    const h = new Float32Array(SIZE * SIZE)
    const map = paint(SIZE, (u, v, x, y) => {
      const s = streak(u * 0.04, v)
      h[y * SIZE + x] = s * 0.4
      const g = 200 + s * 55
      return [g, g, g]
    })
    scratch(h, SIZE, rand, 30, 0.5)
    const rough = paint(SIZE, (u, v) => {
      const g = 70 + streak(u * 0.04, v) * 60
      return [g, g, g]
    })
    return {
      map: finish(map, { color: true, repeat: 20 }),
      roughnessMap: finish(rough, { repeat: 20 }),
      normalMap: finish(normalFromHeight(h, SIZE, 1.4), { repeat: 20 }),
    }
  })

/** Rubber: soft fine grain, very matte. */
export const rubberFinish = () =>
  once('rubber', () => {
    const rand = seededRandom(113)
    const n = noise(80, rand)
    const h = new Float32Array(SIZE * SIZE)
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) h[y * SIZE + x] = n(x / SIZE, y / SIZE) * 0.5
    return { normalMap: finish(normalFromHeight(h, SIZE, 1.6), { repeat: 30 }) }
  })
