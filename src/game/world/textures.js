import { CanvasTexture, LinearFilter, RepeatWrapping, SRGBColorSpace } from 'three'

import { seededRandom } from '../../shared/math.js'

/**
 * Procedural textures, painted into canvases at startup.
 *
 * The map ships with zero image assets: sand, concrete, rust, corrugated steel and
 * so on are generated here from tileable value noise. Everything is cached, so each
 * texture is built once no matter how many meshes use it.
 */

const cache = new Map()

function canvas(size) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  return c
}

/** Periodic (tileable) value noise on a `cells` x `cells` lattice. */
function makeNoise(cells, rand) {
  const grid = new Float32Array(cells * cells)
  for (let i = 0; i < grid.length; i++) grid[i] = rand()
  const smooth = (t) => t * t * (3 - 2 * t)
  return (u, v) => {
    const x = u * cells
    const y = v * cells
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const tx = smooth(x - x0)
    const ty = smooth(y - y0)
    const xa = ((x0 % cells) + cells) % cells
    const ya = ((y0 % cells) + cells) % cells
    const xb = (xa + 1) % cells
    const yb = (ya + 1) % cells
    const a = grid[ya * cells + xa]
    const b = grid[ya * cells + xb]
    const c = grid[yb * cells + xa]
    const d = grid[yb * cells + xb]
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty
  }
}

/** Fractal noise, roughly 0..1. */
function makeFbm(rand, base = 4, octaves = 4) {
  const layers = Array.from({ length: octaves }, (_, i) => makeNoise(base << i, rand))
  return (u, v) => {
    let sum = 0
    let amp = 0.5
    let norm = 0
    for (const n of layers) {
      sum += n(u, v) * amp
      norm += amp
      amp *= 0.5
    }
    return sum / norm
  }
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

/** Fills a canvas pixel-by-pixel from `shade(u, v) -> [r, g, b, a?]`. */
function paint(size, shade) {
  const c = canvas(size)
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(size, size)
  const d = img.data
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const col = shade(x / size, y / size, x, y)
      const i = (y * size + x) * 4
      d[i] = col[0]
      d[i + 1] = col[1]
      d[i + 2] = col[2]
      d[i + 3] = col[3] ?? 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return c
}

function finish(c, { srgb = true, repeat = true } = {}) {
  const t = new CanvasTexture(c)
  if (srgb) t.colorSpace = SRGBColorSpace
  if (repeat) {
    t.wrapS = RepeatWrapping
    t.wrapT = RepeatWrapping
  }
  t.anisotropy = 8
  t.needsUpdate = true
  return t
}

function cached(key, build) {
  if (!cache.has(key)) cache.set(key, build())
  return cache.get(key)
}

/* ---------------------------------------------------------------------------
 * Surface textures
 * ------------------------------------------------------------------------- */

export const sandTexture = () =>
  cached('sand', () => {
    const rand = seededRandom(11)
    const fbm = makeFbm(rand, 4, 5)
    const grain = makeNoise(128, rand)
    const light = hex('#e2bd86')
    const dark = hex('#b98f5a')
    const c = paint(512, (u, v) => {
      const n = fbm(u, v)
      // Wind ripples: wavy bands perturbed by the noise.
      const ripple = Math.sin((v * 22 + n * 3.2) * Math.PI * 2) * 0.5 + 0.5
      const g = grain(u, v)
      const col = mix(dark, light, Math.min(1, Math.max(0, n * 1.25 - 0.1 + ripple * 0.08 + (g - 0.5) * 0.18)))
      return col
    })
    return finish(c)
  })

export const concreteTexture = () =>
  cached('concrete', () => {
    const rand = seededRandom(23)
    const fbm = makeFbm(rand, 4, 5)
    const pits = makeNoise(96, rand)
    const light = hex('#c9c3b6')
    const dark = hex('#8f897d')
    const c = paint(512, (u, v) => {
      const n = fbm(u, v)
      const p = pits(u, v)
      let col = mix(dark, light, Math.min(1, n * 1.3 - 0.05))
      if (p > 0.86) col = mix(col, [70, 66, 60], (p - 0.86) * 4)
      // Darker grime toward the bottom of each tile (rain run-off).
      col = mix(col, [120, 110, 95], Math.max(0, v - 0.75) * 0.6)
      return col
    })
    const ctx = c.getContext('2d')
    // Form-work tie holes and panel seams, like poured wall panels.
    ctx.fillStyle = 'rgba(40,36,32,0.55)'
    for (const [x, y] of [[96, 128], [416, 128], [96, 384], [416, 384]]) {
      ctx.beginPath()
      ctx.arc(x, y, 7, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.strokeStyle = 'rgba(70,64,56,0.35)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(0, 256)
    ctx.lineTo(512, 256)
    ctx.stroke()
    // A few cracks.
    ctx.strokeStyle = 'rgba(55,50,45,0.5)'
    ctx.lineWidth = 1.5
    for (let i = 0; i < 6; i++) {
      let x = rand() * 512
      let y = rand() * 512
      ctx.beginPath()
      ctx.moveTo(x, y)
      for (let s = 0; s < 8; s++) {
        x += (rand() - 0.5) * 40
        y += rand() * 25
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    return finish(c)
  })

export const rustTexture = () =>
  cached('rust', () => {
    const rand = seededRandom(37)
    const fbm = makeFbm(rand, 6, 5)
    const spots = makeNoise(40, rand)
    const a = hex('#5b3020')
    const b = hex('#a65a2c')
    const c2 = hex('#c98b4f')
    const c = paint(256, (u, v) => {
      const n = fbm(u, v)
      const s = spots(u, v)
      let col = mix(a, b, n)
      if (s > 0.7) col = mix(col, c2, (s - 0.7) * 2.5)
      if (s < 0.18) col = mix(col, [40, 22, 15], (0.18 - s) * 4)
      return col
    })
    return finish(c)
  })

/** Red-orange painted steel with rust streaks: the tower. */
export const paintedSteelTexture = () =>
  cached('paintedSteel', () => {
    const rand = seededRandom(41)
    const fbm = makeFbm(rand, 4, 4)
    const streak = makeNoise(24, rand)
    const paintCol = hex('#b5532f')
    const rustCol = hex('#6b3420')
    const c = paint(256, (u, v) => {
      const n = fbm(u, v)
      const s = streak(u, v * 0.12)
      const t = Math.min(1, Math.max(0, (s - 0.55) * 2.5 + (n - 0.5) * 0.6))
      return mix(mix(paintCol, [200, 110, 70], n * 0.25), rustCol, t)
    })
    return finish(c)
  })

/** Beige tank steel with vertical rust runs and weld seams. */
export const tankTexture = () =>
  cached('tank', () => {
    const rand = seededRandom(53)
    const fbm = makeFbm(rand, 4, 5)
    const streak = makeNoise(48, rand)
    const base = hex('#b9a385')
    const rustCol = hex('#7d4a2a')
    const c = paint(512, (u, v) => {
      const n = fbm(u, v)
      const s = streak(u, v * 0.08)
      let col = mix(mix(base, [150, 130, 105], 1 - n), rustCol, Math.max(0, (s - 0.6) * 2.2) * (0.4 + v * 0.6))
      // Horizontal weld seams every quarter.
      const seam = Math.abs(((v * 4) % 1) - 0.5)
      if (seam > 0.485) col = mix(col, [80, 60, 45], 0.6)
      return col
    })
    return finish(c)
  })

/** Grayscale corrugated sheet: tinted per container via material colour. */
export const corrugatedTexture = () =>
  cached('corrugated', () => {
    const rand = seededRandom(67)
    const fbm = makeFbm(rand, 4, 4)
    const spots = makeNoise(32, rand)
    const c = paint(256, (u, v) => {
      // 16 ridges across the tile.
      const ridge = Math.sin(u * Math.PI * 2 * 16)
      const shade = 0.78 + ridge * 0.16
      const n = fbm(u, v)
      const grime = Math.max(0, v - 0.7) * 0.8
      let g = shade * (0.85 + n * 0.3) - grime * 0.35
      let col = [g * 255, g * 255, g * 255]
      const s = spots(u, v)
      if (s > 0.78) col = mix(col, [120, 70, 45], (s - 0.78) * 3)
      return col
    })
    return finish(c)
  })

export const woodTexture = () =>
  cached('wood', () => {
    const rand = seededRandom(79)
    const grain = makeNoise(8, rand)
    const fine = makeNoise(64, rand)
    const a = hex('#8a6239')
    const b = hex('#b48a58')
    const c = paint(256, (u, v) => {
      const plank = Math.floor(v * 4)
      const g = Math.sin((u * 30 + grain(u, v) * 6 + plank * 1.7) * Math.PI) * 0.5 + 0.5
      let col = mix(a, b, g * 0.6 + fine(u, v) * 0.4)
      if (Math.abs(((v * 4) % 1) - 0.5) > 0.47) col = mix(col, [50, 34, 20], 0.7)
      return col
    })
    return finish(c)
  })

export const grateTexture = () =>
  cached('grate', () => {
    const rand = seededRandom(83)
    const fbm = makeFbm(rand, 4, 3)
    const c = paint(256, (u, v) => {
      const gx = Math.abs(((u * 16) % 1) - 0.5)
      const gy = Math.abs((((u + v) * 16) % 1) - 0.5)
      const bar = gx > 0.38 || gy > 0.4
      const n = fbm(u, v)
      return bar ? mix([95, 85, 75], [140, 95, 60], n) : mix([45, 40, 36], [70, 55, 42], n)
    })
    return finish(c)
  })

/** Painted machine housing (green-grey with wear). */
export const machineTexture = () =>
  cached('machine', () => {
    const rand = seededRandom(97)
    const fbm = makeFbm(rand, 4, 4)
    const wear = makeNoise(30, rand)
    const c = paint(256, (u, v) => {
      const n = fbm(u, v)
      const w = wear(u, v)
      let col = mix(hex('#5d6b55'), hex('#7c8a6f'), n)
      if (w > 0.72) col = mix(col, hex('#8a5a34'), (w - 0.72) * 3)
      return col
    })
    return finish(c)
  })

export const burlapTexture = () =>
  cached('burlap', () => {
    const rand = seededRandom(101)
    const fbm = makeFbm(rand, 4, 3)
    const c = paint(128, (u, v) => {
      const weave = (Math.sin(u * Math.PI * 64) * Math.sin(v * Math.PI * 64)) * 0.5 + 0.5
      return mix(hex('#9c8358'), hex('#c2a979'), fbm(u, v) * 0.7 + weave * 0.3)
    })
    return finish(c)
  })

/** Chain-link fence: transparent with a diamond wire mesh. */
export const chainLinkTexture = () =>
  cached('chainlink', () => {
    const c = canvas(128)
    const ctx = c.getContext('2d')
    ctx.strokeStyle = 'rgba(150,140,125,1)'
    ctx.lineWidth = 2.2
    const step = 32
    for (let i = -128; i <= 256; i += step) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i + 128, 128)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(i + 128, 0)
      ctx.lineTo(i, 128)
      ctx.stroke()
    }
    return finish(c)
  })

/* ---------------------------------------------------------------------------
 * Sprites / decals
 * ------------------------------------------------------------------------- */

export const softDotTexture = () =>
  cached('softDot', () => {
    const c = canvas(64)
    const ctx = c.getContext('2d')
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.35, 'rgba(255,255,255,0.7)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
    return finish(c, { srgb: false, repeat: false })
  })

export const smokeTexture = () =>
  cached('smoke', () => {
    const rand = seededRandom(131)
    const fbm = makeFbm(rand, 3, 4)
    const c = paint(128, (u, v) => {
      const dx = u - 0.5
      const dy = v - 0.5
      const r = Math.sqrt(dx * dx + dy * dy) * 2
      const n = fbm(u, v)
      const a = Math.max(0, 1 - r) ** 1.5 * (0.55 + n * 0.6)
      const g = 200 + n * 55
      return [g, g, g, Math.min(255, a * 255)]
    })
    const t = finish(c, { srgb: false, repeat: false })
    t.minFilter = LinearFilter
    return t
  })

/** Four-point star for muzzle flashes and scope glints. */
export const flareTexture = () =>
  cached('flare', () => {
    const c = canvas(128)
    const ctx = c.getContext('2d')
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.15, 'rgba(255,240,200,0.9)')
    g.addColorStop(0.45, 'rgba(255,200,120,0.25)')
    g.addColorStop(1, 'rgba(255,180,90,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
    ctx.globalCompositeOperation = 'lighter'
    for (const [w, h] of [[128, 6], [6, 128]]) {
      const lg = ctx.createLinearGradient(64 - w / 2, 64 - h / 2, 64 + w / 2, 64 + h / 2)
      lg.addColorStop(0, 'rgba(255,230,180,0)')
      lg.addColorStop(0.5, 'rgba(255,245,220,0.9)')
      lg.addColorStop(1, 'rgba(255,230,180,0)')
      ctx.fillStyle = lg
      ctx.fillRect(64 - w / 2, 64 - h / 2, w, h)
    }
    return finish(c, { srgb: false, repeat: false })
  })

export const bulletHoleTexture = () =>
  cached('bulletHole', () => {
    const rand = seededRandom(149)
    const c = canvas(64)
    const ctx = c.getContext('2d')
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30)
    g.addColorStop(0, 'rgba(15,12,10,1)')
    g.addColorStop(0.25, 'rgba(25,20,16,0.95)')
    g.addColorStop(0.5, 'rgba(60,50,40,0.5)')
    g.addColorStop(1, 'rgba(60,50,40,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2
      const r = 20 + rand() * 10
      ctx.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r)
    }
    ctx.fill()
    return finish(c, { repeat: false })
  })

/** Dead palm frond: a feathered leaf silhouette with alpha. */
export const frondTexture = () =>
  cached('frond', () => {
    const rand = seededRandom(163)
    const c = canvas(256)
    const ctx = c.getContext('2d')
    ctx.strokeStyle = '#6e5a34'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(8, 128)
    ctx.quadraticCurveTo(128, 110, 250, 140)
    ctx.stroke()
    for (let i = 0; i < 46; i++) {
      const t = i / 46
      const x = 10 + t * 236
      const y = 128 - Math.sin(t * Math.PI) * 14 + t * 10
      const len = (1 - Math.abs(t - 0.4)) * 90 * (0.7 + rand() * 0.4)
      const col = rand() < 0.5 ? '#8a7442' : '#a08a52'
      ctx.strokeStyle = col
      ctx.lineWidth = 3
      for (const side of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + len * 0.5, y + side * len * (0.55 + rand() * 0.2))
        ctx.stroke()
      }
    }
    return finish(c, { repeat: false })
  })

/* ---------------------------------------------------------------------------
 * Ruins and decoration
 * ------------------------------------------------------------------------- */

/** Exposed brickwork with chipped plaster and soot, for broken wall edges. */
export const brickTexture = () =>
  cached('brick', () => {
    const rand = seededRandom(181)
    const fbm = makeFbm(rand, 4, 4)
    const patches = makeNoise(5, rand)
    const grain = makeNoise(64, rand)
    const brickH = 1 / 8
    const brickW = 1 / 4
    const c = paint(512, (u, v) => {
      const row = Math.floor(v / brickH)
      const off = row % 2 ? brickW / 2 : 0
      const bu = ((u + off) % brickW) / brickW
      const bv = (v % brickH) / brickH
      const mortar = bu < 0.04 || bv < 0.08
      const n = fbm(u, v)
      const g = grain(u, v)
      const tone = ((row * 7 + Math.floor((u + off) / brickW) * 13) % 5) / 5
      // Sun-faded, dusty brick: small per-brick tone shifts, fine grain, darker edges.
      const edge = Math.min(bu, 1 - bu, bv * 0.5, (1 - bv) * 0.5) < 0.04 ? 0.88 : 1
      let col = mortar
        ? mix([168, 156, 136], [138, 128, 112], n)
        : mix(hex('#8a5640'), hex('#a8725a'), tone * 0.55 + n * 0.3 + g * 0.15).map((x) => x * edge)
      // Large patches of the old plaster render still clinging on.
      const p = patches(u, v) + (n - 0.5) * 0.3 + (g - 0.5) * 0.1
      if (p > 0.755) col = mix([206, 190, 160], [182, 166, 138], g)
      else if (p > 0.74) col = mix(col, [70, 58, 48], 0.55)
      // A film of desert dust over everything, soot in the darker patches.
      col = mix(col, [196, 170, 132], 0.1)
      col = mix(col, [44, 38, 34], Math.max(0, n - 0.66) * 1.6)
      return col
    })
    return finish(c)
  })

/** Camouflage netting: leafy blotches with holes (alpha-tested). */
export const camoTexture = () =>
  cached('camo', () => {
    const rand = seededRandom(197)
    const fbm = makeFbm(rand, 5, 4)
    const holes = makeNoise(18, rand)
    const c = paint(256, (u, v) => {
      const n = fbm(u, v)
      const h = holes(u, v)
      const col = n < 0.42 ? hex('#5a5532') : n < 0.55 ? hex('#8a7a4a') : n < 0.68 ? hex('#6b5a3a') : hex('#a89462')
      return [...col, h > 0.62 ? 0 : 255]
    })
    return finish(c)
  })

/** Dry desert shrub sprite (used on crossed planes). */
export const shrubTexture = () =>
  cached('shrub', () => {
    const rand = seededRandom(211)
    const c = canvas(128)
    const ctx = c.getContext('2d')
    for (let i = 0; i < 70; i++) {
      const x0 = 64 + (rand() - 0.5) * 20
      const a = -Math.PI / 2 + (rand() - 0.5) * 2.4
      const len = 30 + rand() * 60
      ctx.strokeStyle = rand() < 0.5 ? '#7b6a42' : '#9a8556'
      ctx.lineWidth = 1 + rand() * 2
      ctx.beginPath()
      ctx.moveTo(x0, 128)
      ctx.quadraticCurveTo(x0 + Math.cos(a) * len * 0.4, 128 + Math.sin(a) * len * 0.5, x0 + Math.cos(a) * len, 128 + Math.sin(a) * len)
      ctx.stroke()
    }
    return finish(c, { repeat: false })
  })

/** Soft dark blotch for scorch marks on walls and floors. */
export const scorchTexture = () =>
  cached('scorch', () => {
    const rand = seededRandom(223)
    const fbm = makeFbm(rand, 4, 3)
    const c = paint(128, (u, v) => {
      const d = Math.hypot(u - 0.5, v - 0.5) * 2
      const a = Math.max(0, 1 - d) ** 1.4 * (0.6 + fbm(u, v) * 0.6)
      return [20, 16, 12, Math.min(255, a * 230)]
    })
    return finish(c, { repeat: false })
  })

/** Worn yellow/black hazard stripes for platform edges and kick plates. */
export const hazardStripeTexture = () =>
  cached('hazardStripe', () => {
    const rand = seededRandom(211)
    const fbm = makeFbm(rand, 4, 4)
    const yellow = hex('#d8a21e')
    const black = hex('#1f1c19')
    const c = paint(256, (u, v) => {
      const stripe = ((u * 4 + v) % 1) < 0.5
      const n = fbm(u, v)
      let col = stripe ? mix(yellow, [170, 120, 30], n * 0.5) : mix(black, [60, 50, 40], n * 0.4)
      // Scuffed through to bare rusty steel in places.
      if (n > 0.66) col = mix(col, hex('#6e4028'), Math.min(1, (n - 0.66) * 5))
      return col
    })
    return finish(c)
  })

/** Welded square mesh (alpha-tested) for the rusty fence panels on the walls. */
export const weldMeshTexture = () =>
  cached('weldMesh', () => {
    const rand = seededRandom(223)
    const fbm = makeFbm(rand, 4, 3)
    const c = paint(128, (u, v) => {
      const gu = (u * 8) % 1
      const gv = (v * 8) % 1
      const bar = gu < 0.12 || gv < 0.12
      if (!bar) return [0, 0, 0, 0]
      const n = fbm(u, v)
      return [...mix(hex('#5a2e1c'), hex('#a35a30'), n), 255]
    })
    return finish(c)
  })

/** Tall perimeter T-wall concrete: rust runs below the lifting hooks, grime, bullet pocks. */
export const twallTexture = () =>
  cached('twall', () => {
    const rand = seededRandom(229)
    const fbm = makeFbm(rand, 4, 5)
    const pits = makeNoise(80, rand)
    const streaks = makeNoise(20, rand)
    const light = hex('#d3c8b4')
    const dark = hex('#998f80')
    const c = paint(512, (u, v) => {
      const n = fbm(u, v)
      let col = mix(dark, light, Math.min(1, n * 1.35 - 0.1))
      // Rust bleeding down from the two hooks near the top.
      for (const hu of [0.22, 0.78]) {
        const d = Math.abs(u - hu)
        if (d < 0.035 && v > 0.08) col = mix(col, hex('#8a5a3a'), (1 - d / 0.035) * Math.max(0, 0.55 - (v - 0.08) * 0.9) * (0.6 + n * 0.4))
      }
      // Faint water streaks and the sand-blasted lower third.
      const s = streaks(u, v * 0.1)
      if (s > 0.62) col = mix(col, [140, 128, 112], (s - 0.62) * 1.2)
      col = mix(col, hex('#c8ac82'), Math.max(0, v - 0.72) * 1.4)
      const p = pits(u, v)
      if (p > 0.88) col = mix(col, [80, 74, 66], (p - 0.88) * 5)
      return col
    })
    const ctx = c.getContext('2d')
    // A small burst of bullet holes.
    for (let i = 0; i < 5; i++) {
      const x = 120 + rand() * 280
      const y = 140 + rand() * 200
      const r = 3 + rand() * 3
      ctx.fillStyle = 'rgba(150,140,125,0.6)'
      ctx.beginPath()
      ctx.arc(x, y, r * 2.1, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(38,34,30,0.9)'
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    return finish(c)
  })

const GRAFFITI = [
  { word: 'RUST', fill: ['#e8503a', '#f2a33a'], line: '#1a1a1a' },
  { word: 'BLOX', fill: ['#3fa9f5', '#9be3ff'], line: '#101820' },
  { word: 'DUST', fill: ['#f5d33a', '#ffffff'], line: '#2a1a0a' },
  { word: 'ZER0', fill: ['#7ad65a', '#d7ff9a'], line: '#102010' },
  { word: 'OIL', fill: ['#c45ae0', '#ffb3f0'], line: '#1a0a20' },
]

/** Spray-painted tags with outlines, highlights and drips (transparent). */
export const graffitiTexture = (i) =>
  cached(`graffiti:${i}`, () => {
    const g = GRAFFITI[i % GRAFFITI.length]
    const rand = seededRandom(301 + i * 17)
    const c = canvas(512)
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, 512, 512)
    ctx.save()
    ctx.translate(256, 270)
    ctx.rotate((rand() - 0.5) * 0.25)
    ctx.font = 'bold 150px "Arial Black", Impact, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    // Thick dark outline, then a shadow offset, then the gradient fill.
    ctx.strokeStyle = g.line
    ctx.lineWidth = 26
    ctx.strokeText(g.word, 0, 0)
    ctx.fillStyle = g.line
    ctx.fillText(g.word, 8, 8)
    const grad = ctx.createLinearGradient(0, -70, 0, 70)
    grad.addColorStop(0, g.fill[1])
    grad.addColorStop(0.55, g.fill[0])
    grad.addColorStop(1, g.fill[0])
    ctx.fillStyle = grad
    ctx.fillText(g.word, 0, 0)
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.lineWidth = 3
    ctx.strokeText(g.word, -3, -3)
    ctx.restore()
    // Drips running down from the letters.
    ctx.fillStyle = g.fill[0]
    for (let k = 0; k < 7; k++) {
      const x = 90 + rand() * 330
      const len = 20 + rand() * 70
      ctx.fillRect(x, 320, 4, len)
      ctx.beginPath()
      ctx.arc(x + 2, 320 + len, 3.5, 0, Math.PI * 2)
      ctx.fill()
    }
    // Weathering: knock speckles out of the paint.
    ctx.globalCompositeOperation = 'destination-out'
    for (let k = 0; k < 1400; k++) {
      ctx.fillStyle = `rgba(0,0,0,${0.3 + rand() * 0.6})`
      ctx.fillRect(rand() * 512, rand() * 512, 1 + rand() * 3, 1 + rand() * 3)
    }
    ctx.globalCompositeOperation = 'source-over'
    return finish(c, { repeat: false })
  })

/** The refinery's company plate: a red ring round an oil drop with a flame in it, on weathered enamel. */
export const refinerySignTexture = () =>
  cached('refinerySign', () => {
    const rand = seededRandom(919)
    const c = canvas(512)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#e4dccb'
    ctx.fillRect(0, 0, 512, 512)
    // Grime and rust bleeding from the bolts.
    for (let k = 0; k < 900; k++) {
      ctx.fillStyle = `rgba(${90 + rand() * 60},${60 + rand() * 40},${30 + rand() * 20},${rand() * 0.12})`
      ctx.fillRect(rand() * 512, rand() * 512, 2 + rand() * 10, 2 + rand() * 10)
    }
    for (const [x, y] of [[24, 24], [488, 24], [24, 488], [488, 488]]) {
      const g = ctx.createLinearGradient(x, y, x, y + 120)
      g.addColorStop(0, 'rgba(120,60,25,0.55)')
      g.addColorStop(1, 'rgba(120,60,25,0)')
      ctx.fillStyle = g
      ctx.fillRect(x - 5, y, 10, 120)
      ctx.fillStyle = '#5a4a3a'
      ctx.beginPath()
      ctx.arc(x, y, 7, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.lineWidth = 34
    ctx.strokeStyle = '#a62b1f'
    ctx.beginPath()
    ctx.arc(256, 228, 150, 0, Math.PI * 2)
    ctx.stroke()
    // Oil drop with a flame cut into it.
    ctx.fillStyle = '#b8321f'
    ctx.beginPath()
    ctx.moveTo(256, 108)
    ctx.bezierCurveTo(300, 175, 345, 215, 345, 262)
    ctx.arc(256, 262, 89, 0, Math.PI)
    ctx.bezierCurveTo(167, 215, 212, 175, 256, 108)
    ctx.fill()
    ctx.fillStyle = '#efe6d4'
    ctx.beginPath()
    ctx.moveTo(256, 190)
    ctx.bezierCurveTo(296, 240, 300, 300, 256, 318)
    ctx.bezierCurveTo(222, 300, 220, 262, 240, 236)
    ctx.bezierCurveTo(242, 262, 252, 270, 260, 262)
    ctx.bezierCurveTo(270, 240, 262, 214, 256, 190)
    ctx.fill()
    ctx.fillStyle = '#7d2016'
    ctx.font = 'bold 54px "Arial Black", Impact, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('DUSTLINE', 256, 438)
    ctx.font = 'bold 26px Arial, sans-serif'
    ctx.fillText('PETROLEUM CO.', 256, 476)
    // Chipped enamel.
    ctx.globalCompositeOperation = 'multiply'
    for (let k = 0; k < 260; k++) {
      ctx.fillStyle = `rgba(${110 + rand() * 40},${85 + rand() * 30},${60 + rand() * 20},0.8)`
      ctx.beginPath()
      ctx.arc(rand() * 512, rand() * 512, 1 + rand() * 4, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
    return finish(c, { repeat: false })
  })

/**
 * Shelled concrete block for torn walls: big grey-beige blocks in a running
 * bond, chipped corners, soot and dust, scraps of render still on them.
 */
export const blockTexture = () =>
  cached('block', () => {
    const rand = seededRandom(487)
    const fbm = makeFbm(rand, 4, 4)
    const patches = makeNoise(5, rand)
    const grain = makeNoise(64, rand)
    const blockH = 1 / 5
    const blockW = 1 / 2.5
    const c = paint(512, (u, v) => {
      const row = Math.floor(v / blockH)
      const off = row % 2 ? blockW / 2 : 0
      const bu = ((u + off) % blockW) / blockW
      const bv = (v % blockH) / blockH
      const mortar = bu < 0.025 || bv < 0.05
      const n = fbm(u, v)
      const g = grain(u, v)
      const tone = ((row * 5 + Math.floor((u + off) / blockW) * 11) % 7) / 7
      // Chipped arrises: the block's edges go darker and ragged.
      const edgeD = Math.min(bu, 1 - bu, bv * 0.45, (1 - bv) * 0.45)
      const chip = edgeD < 0.03 + g * 0.03 ? 0.8 : 1
      let col = mortar
        ? mix([120, 112, 100], [96, 90, 80], n)
        : mix(hex('#a39885'), hex('#bdb19b'), tone * 0.5 + n * 0.35 + g * 0.15).map((x) => x * chip)
      // Pores in the block face.
      if (!mortar && g > 0.86) col = col.map((x) => x * 0.82)
      // Scraps of the old render.
      const p = patches(u, v) + (n - 0.5) * 0.3 + (g - 0.5) * 0.1
      if (p > 0.76) col = mix([200, 188, 162], [180, 168, 142], g)
      else if (p > 0.745) col = mix(col, [70, 62, 52], 0.5)
      col = mix(col, [190, 168, 132], 0.08)
      col = mix(col, [40, 36, 32], Math.max(0, n - 0.64) * 1.7)
      return col
    })
    return finish(c)
  })

/**
 * Pipeline steel: faded sand-coloured paint over rusty steel. Rust bleeds from
 * the longitudinal weld seam and in streaks round the pipe, paint flakes off in
 * patches, and grime collects in bands (cylinder UVs: u round, v along).
 */
export const pipelineTexture = () =>
  cached('pipeline', () => {
    const rand = seededRandom(733)
    const fbm = makeFbm(rand, 4, 5)
    const flakes = makeFbm(rand, 8, 3)
    const streak = makeNoise(40, rand)
    const grain = makeNoise(96, rand)
    const paintCol = hex('#a8987c')
    const rustCol = hex('#6e3a1e')
    const rustLight = hex('#9a5a2c')
    const c = paint(512, (u, v) => {
      const n = fbm(u, v)
      const g = grain(u, v)
      let col = mix(paintCol, [128, 118, 100], n * 0.6 + g * 0.2)
      // Rust running round the pipe from the top (long streaks across u).
      const s = streak(u * 0.15, v)
      const run = Math.max(0, (s - 0.55) * 2.4) * (0.4 + 0.6 * n)
      col = mix(col, mix(rustCol, rustLight, g), Math.min(1, run))
      // Paint flaking off in patches down to bare rust.
      const f = flakes(u, v)
      if (f > 0.72) col = mix(rustCol, rustLight, g * 0.8)
      else if (f > 0.695) col = mix(col, [60, 44, 32], 0.6)
      // Weld seam along the pipe, with rust bleeding either side.
      const seam = Math.abs(u - 0.5)
      if (seam < 0.006) col = mix(col, [70, 52, 38], 0.8)
      else if (seam < 0.04) col = mix(col, rustCol, (0.04 - seam) * 9 * (0.5 + n * 0.5))
      // Grime band near each girth weld.
      const girth = Math.abs(((v * 2) % 1) - 0.5)
      if (girth > 0.49) col = mix(col, [74, 58, 44], 0.7)
      return col
    })
    return finish(c)
  })

/** The painting helpers, for the other maps' texture sets. */
export { cached, canvas, finish, hex, makeFbm, makeNoise, mix, paint }
