import { seededRandom } from '../../../shared/math.js'
import { cached, canvas, finish, hex, makeFbm, makeNoise, mix, paint } from '../textures.js'

/**
 * Procedural textures for Old Quarter: weathered stucco, floor tiles, the
 * dusty ground, stone paving, louvred shutters, striped awnings and the shop
 * signs. Painted into canvases once, like the other maps'. The pale ones are
 * tinted by their material colour, so every stucco wall in town (whatever its
 * colour) is one material and one draw. Nothing in them depends on where the
 * bottom of a wall is: they tile up a wall as well as along it.
 */

const clamp01 = (v) => Math.min(1, Math.max(0, v))

/**
 * Stucco (2.5 m a tile): a pale, trowelled render, cloudy with sun and damp,
 * hairline cracks, patched repairs a shade off, the odd chip down to the
 * block, and faint streaks running down from rain.
 */
export const stuccoTexture = () =>
  cached('oq:stucco', () => {
    const rand = seededRandom(7311)
    const fbm = makeFbm(rand, 4, 5)
    const cloud = makeNoise(6, rand)
    const trowel = makeNoise(48, rand)
    const fine = makeNoise(192, rand)
    const streak = makeNoise(32, rand)
    const S = 512
    const c = paint(S, (u, v) => {
      const n = fbm(u, v)
      let col = mix(hex('#dcd6ca'), hex('#f2eee6'), clamp01(n * 1.25 - 0.1))
      // Trowel swirls and the grit in the render.
      col = mix(col, [col[0] * 0.9, col[1] * 0.89, col[2] * 0.86], clamp01((trowel(u + n * 0.05, v) - 0.5) * 1.6) * 0.35)
      col = mix(col, [col[0] * 0.86, col[1] * 0.85, col[2] * 0.82], clamp01((fine(u, v) - 0.6) * 2.4) * 0.5)
      // Big cloudy patches: sun-bleached and damp-dark.
      const cl = cloud(u, v)
      col = mix(col, [176, 168, 154], clamp01((cl - 0.62) * 2.6) * 0.32)
      col = mix(col, [250, 248, 242], clamp01((0.32 - cl) * 2.6) * 0.3)
      // Rain streaks: thin vertical runs.
      const st = streak(u * 3, v * 0.25)
      col = mix(col, [150, 142, 130], clamp01((st - 0.6) * 3) * 0.28)
      return col
    })
    const ctx = c.getContext('2d')
    // Patched repairs, squarish, a shade off.
    for (let i = 0; i < 7; i++) {
      const w = 30 + rand() * 70
      const h = 24 + rand() * 50
      const k = rand() < 0.5 ? 0.9 : 1.05
      ctx.fillStyle = `rgba(${Math.round(226 * k)},${Math.round(220 * k)},${Math.round(206 * k)},0.42)`
      ctx.fillRect(rand() * (S - w), rand() * (S - h), w, h)
    }
    // Chips down to the block underneath.
    for (let i = 0; i < 6; i++) {
      const x = rand() * S
      const y = rand() * S
      ctx.fillStyle = 'rgba(150,140,124,0.75)'
      ctx.beginPath()
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2
        const r = 4 + rand() * 9
        if (k === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
        else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
      }
      ctx.closePath()
      ctx.fill()
    }
    // Hairline cracks: short wandering lines.
    ctx.strokeStyle = 'rgba(96,88,76,0.55)'
    ctx.lineWidth = 1
    for (let i = 0; i < 9; i++) {
      let x = rand() * S
      let y = rand() * S
      let a = rand() * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(x, y)
      for (let k = 0; k < 10; k++) {
        a += (rand() - 0.5) * 1.1
        x += Math.cos(a) * (5 + rand() * 7)
        y += Math.sin(a) * (5 + rand() * 7)
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    return finish(c)
  })

/** Floor tiles (2 m a tile, 0.4 m tiles): each its own shade, worn in the middle, dark grout. */
export const tileTexture = () =>
  cached('oq:tiles', () => {
    const rand = seededRandom(7411)
    const fbm = makeFbm(rand, 4, 4)
    const fine = makeNoise(128, rand)
    const S = 512
    const n = 5
    const shades = Array.from({ length: n * n }, () => 0.86 + rand() * 0.18)
    const c = paint(S, (u, v) => {
      const tu = u * n
      const tv = v * n
      const i = Math.floor(tu)
      const j = Math.floor(tv)
      const fu = tu - i
      const fv = tv - j
      const grout = fu < 0.03 || fv < 0.03
      if (grout) return mix([120, 112, 100], [100, 94, 84], fbm(u, v))
      const k = shades[(j % n) * n + (i % n)]
      let col = [236 * k, 230 * k, 218 * k]
      // Worn paler where feet go (the middle of the tile), grubby at the edges.
      const edge = Math.min(fu, 1 - fu, fv, 1 - fv)
      col = mix(col, [col[0] * 0.86, col[1] * 0.84, col[2] * 0.8], clamp01((0.12 - edge) * 6) * 0.6)
      col = mix(col, [col[0] * 0.9, col[1] * 0.88, col[2] * 0.84], clamp01((fine(u, v) - 0.55) * 2) * 0.4)
      col = mix(col, [150, 140, 124], clamp01((fbm(u * 2, v * 2) - 0.62) * 2.2) * 0.3)
      return col
    })
    return finish(c)
  })

/**
 * The ground (6 m a tile): packed dusty earth, sun-bleached and trodden,
 * gravel and pebbles, darker damp hollows.
 */
export const dustTexture = () =>
  cached('oq:dust', () => {
    const rand = seededRandom(7511)
    const fbm = makeFbm(rand, 4, 5)
    const grain = makeNoise(160, rand)
    const hollow = makeNoise(5, rand)
    const S = 512
    const a = hex('#d9c39a')
    const b = hex('#b59b70')
    const c = paint(S, (u, v) => {
      const n = fbm(u, v)
      const g = grain(u, v)
      let col = mix(b, a, clamp01(n * 1.3 - 0.12 + (g - 0.5) * 0.3))
      const h = hollow(u, v)
      col = mix(col, [140, 118, 86], clamp01((h - 0.68) * 2.4) * 0.45)
      if (g > 0.9) col = mix(col, [120, 108, 92], 0.6)
      else if (g < 0.08) col = mix(col, [236, 226, 206], 0.5)
      return col
    })
    const ctx = c.getContext('2d')
    // Pebbles.
    for (let i = 0; i < 220; i++) {
      const r = 1.2 + rand() * 2.6
      const t = 110 + rand() * 90
      ctx.fillStyle = `rgba(${t},${t * 0.94},${t * 0.86},0.85)`
      ctx.beginPath()
      ctx.ellipse(rand() * S, rand() * S, r, r * (0.6 + rand() * 0.4), rand() * 3, 0, Math.PI * 2)
      ctx.fill()
    }
    return finish(c)
  })

/** Stone paving (3 m a tile): rectangular slabs in running courses, chipped and grouted with sand. */
export const pavingTexture = () =>
  cached('oq:paving', () => {
    const rand = seededRandom(7611)
    const fbm = makeFbm(rand, 4, 4)
    const fine = makeNoise(96, rand)
    const rows = 6
    const S = 512
    const offs = Array.from({ length: rows }, () => rand())
    const lens = Array.from({ length: rows }, () => 2 + Math.floor(rand() * 3))
    const tones = Array.from({ length: 64 }, () => 0.85 + rand() * 0.2)
    const c = paint(S, (u, v) => {
      const r = Math.floor(v * rows)
      const fv = v * rows - r
      const cols = lens[r]
      const x = (u + offs[r]) * cols
      const k = Math.floor(x)
      const fu = x - k
      const joint = fv < 0.04 || fu < 0.02
      if (joint) return mix([184, 160, 120], [158, 136, 100], fbm(u, v))
      const t = tones[(r * 7 + k * 3) % tones.length]
      let col = [226 * t, 208 * t, 176 * t]
      col = mix(col, [col[0] * 0.84, col[1] * 0.82, col[2] * 0.78], clamp01((fine(u, v) - 0.5) * 1.6) * 0.45)
      col = mix(col, [150, 138, 118], clamp01((fbm(u * 2, v * 2) - 0.6) * 2) * 0.3)
      return col
    })
    return finish(c)
  })

/**
 * Market Street's tarmac (8 m a tile): old and sun-bleached to a dusty grey,
 * sand blown over it in drifts, patched, cracked and tar-sealed.
 */
export const roadTexture = () =>
  cached('oq:road', () => {
    const rand = seededRandom(8011)
    const fbm = makeFbm(rand, 4, 5)
    const speck = makeNoise(256, rand)
    const drift = makeNoise(6, rand)
    const S = 512
    const c = paint(S, (u, v) => {
      const n = fbm(u, v)
      const s = speck(u, v)
      let g = 118 + n * 30
      if (s > 0.82) g += (s - 0.82) * 180
      if (s < 0.1) g -= 22
      let col = [g * 1.02, g, g * 0.95]
      // Sand blown over it.
      col = mix(col, [204, 184, 148], clamp01((drift(u, v) - 0.55) * 2.2) * 0.55)
      return col
    })
    const ctx = c.getContext('2d')
    // Patches of newer, darker tarmac: soft-edged blotches (hard squares read as shadows).
    for (let i = 0; i < 6; i++) {
      const x = rand() * S
      const y = rand() * S
      const r = 30 + rand() * 50
      const g = ctx.createRadialGradient(x, y, r * 0.3, x, y, r)
      g.addColorStop(0, 'rgba(86,84,80,0.22)')
      g.addColorStop(1, 'rgba(86,84,80,0)')
      ctx.fillStyle = g
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }
    ctx.lineCap = 'round'
    for (let i = 0; i < 9; i++) {
      ctx.strokeStyle = `rgba(40,38,36,${0.3 + rand() * 0.2})`
      ctx.lineWidth = 1 + rand() * 1.4
      let x = rand() * S
      let y = rand() * S
      let a = rand() * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(x, y)
      for (let k = 0; k < 24; k++) {
        a += (rand() - 0.5) * 0.9
        x += Math.cos(a) * 5
        y += Math.sin(a) * 5
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    return finish(c)
  })

/** Where things are in the dry plants atlas: [u0, v0, u1, v1]. */
export const DRY_UV = Object.freeze({ grass: [0, 0, 0.5, 1], twigs: [0.5, 0, 1, 1] })

/**
 * Dry plants, one atlas: a tuft of straw-coloured grass (left half) and a
 * cluster of dead twigs with a few brown leaves (right). Cut out by alpha.
 */
export const dryTexture = () =>
  cached('oq:dry', () => {
    const rand = seededRandom(8111)
    const S = 256
    const c = canvas(S)
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, S, S)
    // Grass: blades fanning up from the bottom middle of the left half.
    for (let i = 0; i < 70; i++) {
      const x0 = S * 0.25 + (rand() - 0.5) * S * 0.18
      const lean = (rand() - 0.5) * S * 0.42
      const h = S * (0.45 + rand() * 0.5)
      const tone = 150 + rand() * 70
      ctx.strokeStyle = `rgb(${tone + 30},${tone + 8},${tone * 0.6})`
      ctx.lineWidth = 1.4 + rand() * 1.8
      ctx.beginPath()
      ctx.moveTo(x0, S)
      ctx.quadraticCurveTo(x0 + lean * 0.3, S - h * 0.6, x0 + lean, S - h)
      ctx.stroke()
    }
    // Twigs: branching dark lines from the bottom middle of the right half.
    const twig = (x, y, a, len, w, depth) => {
      const x1 = x + Math.cos(a) * len
      const y1 = y - Math.sin(a) * len
      ctx.strokeStyle = '#5a4634'
      ctx.lineWidth = w
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x1, y1)
      ctx.stroke()
      if (depth === 0) {
        ctx.fillStyle = `rgb(${130 + rand() * 50},${96 + rand() * 30},${52 + rand() * 20})`
        ctx.beginPath()
        ctx.ellipse(x1, y1, 3 + rand() * 3, 1.6 + rand() * 1.4, rand() * 3, 0, Math.PI * 2)
        ctx.fill()
        return
      }
      for (let k = 0; k < 2; k++) twig(x1, y1, a + (rand() - 0.5) * 1.3, len * (0.6 + rand() * 0.2), w * 0.7, depth - 1)
    }
    for (let i = 0; i < 4; i++) twig(S * 0.75 + (rand() - 0.5) * 20, S, Math.PI / 2 + (rand() - 0.5) * 0.8, S * 0.28, 3.2, 4)
    return finish(c)
  })

/** Louvred shutter leaf: slanted slats between stiles, paint worn at the edges (pale, tinted). */
export const louvreTexture = () =>
  cached('oq:louvre', () => {
    const rand = seededRandom(7711)
    const fine = makeNoise(128, rand)
    const S = 256
    const c = paint(S, (u, v) => {
      if (u < 0.08 || u > 0.92 || v < 0.05 || v > 0.95) {
        const w = fine(u, v)
        return w > 0.72 ? [150, 138, 120] : [232, 230, 224]
      }
      const slat = (v * 18) % 1
      // Each slat lit on top, in shadow underneath.
      const shade = slat < 0.55 ? 0.95 - slat * 0.25 : 0.55 + (slat - 0.55) * 0.4
      const w = fine(u, v)
      const base = w > 0.78 ? [160, 148, 128] : [236, 234, 228]
      return base.map((x) => x * shade)
    })
    return finish(c)
  })

/** Awning canvas: broad stripes, faded and dirty (tinted: the dark stripes take the colour). */
export const awningTexture = () =>
  cached('oq:awning', () => {
    const rand = seededRandom(7811)
    const fbm = makeFbm(rand, 4, 4)
    const S = 256
    const c = paint(S, (u, v) => {
      const stripe = Math.floor(u * 8) % 2 === 0
      const n = fbm(u, v)
      let col = stripe ? [255, 255, 255] : [140, 140, 140]
      col = mix(col, [col[0] * 0.82, col[1] * 0.8, col[2] * 0.76], clamp01((n - 0.5) * 1.8) * 0.5)
      // The scalloped hem darkens toward the bottom edge.
      col = mix(col, [col[0] * 0.75, col[1] * 0.72, col[2] * 0.68], clamp01((v - 0.86) * 6) * 0.5)
      return col
    })
    return finish(c)
  })

export const SIGNS = Object.freeze(['CAFE', 'MARKET', 'GARAGE', 'BAKERY'])
const SIGN_COLORS = ['#2f6f5a', '#3d6a8a', '#b8452f', '#d8a23a']

/** The shop signs: four boards in one atlas (one row each), painted letters on faded colour. */
export const signTexture = () =>
  cached('oq:signs', () => {
    const rand = seededRandom(7911)
    const W = 512
    const H = 512
    const c = canvas(W)
    c.height = H
    const ctx = c.getContext('2d')
    SIGNS.forEach((word, i) => {
      const y = i * (H / 4)
      ctx.fillStyle = SIGN_COLORS[i]
      ctx.fillRect(0, y, W, H / 4)
      // Faded, flaking board.
      for (let k = 0; k < 160; k++) {
        ctx.fillStyle = `rgba(255,255,255,${0.04 + rand() * 0.08})`
        ctx.fillRect(rand() * W, y + rand() * (H / 4), 2 + rand() * 16, 2 + rand() * 6)
      }
      ctx.strokeStyle = 'rgba(240,232,214,0.9)'
      ctx.lineWidth = 6
      ctx.strokeRect(8, y + 8, W - 16, H / 4 - 16)
      ctx.fillStyle = '#f2ead8'
      ctx.font = 'bold 74px Impact, "Arial Black", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(word, W / 2, y + H / 8 + 4)
    })
    return finish(c)
  })
