import { seededRandom } from '../../../shared/math.js'
import { cached, canvas, finish, hex, makeFbm, makeNoise, mix, paint } from '../textures.js'

/**
 * Procedural textures for Bramblewood: one atlas for every leaf in the map
 * (tree clumps, ivy, tall grass, ferns), the field's old furrows and the
 * weathered barn boards. Painted into canvases once, like the other maps'.
 */

const clamp01 = (v) => Math.min(1, Math.max(0, v))

/**
 * Where things are in the foliage atlas: [u0, v0, u1, v1] (v up). Each a
 * little inside its quarter, which is cleared round its edge: far off, a
 * card's mipmaps would otherwise blend in the solid ivy next door and show it
 * as a pale streak down the card's side.
 */
const IN = 0.02
export const BR_UV = Object.freeze({
  leaves: [IN, 0.5 + IN, 0.5 - IN, 1 - IN],
  ivy: [0.5 + IN, 0.5 + IN, 1 - IN, 1 - IN],
  grass: [IN, IN, 0.5 - IN, 0.5 - IN],
  fern: [0.5 + IN, IN, 1 - IN, 0.5 - IN],
})

const GREENS = ['#3f6a2a', '#4f7d32', '#5c8a38', '#356024', '#6a9440', '#47722e', '#2f5520']

/** A leaf: a pointed oval with a darker midrib, at (x, y), `len` long, turned `a`. */
function leaf(ctx, rand, x, y, len, a, colors = GREENS) {
  const w = len * (0.36 + rand() * 0.12)
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(a)
  ctx.fillStyle = colors[Math.floor(rand() * colors.length)]
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(len * 0.5, -w, len, 0)
  ctx.quadraticCurveTo(len * 0.5, w, 0, 0)
  ctx.fill()
  ctx.strokeStyle = 'rgba(20,40,12,0.35)'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(len * 0.05, 0)
  ctx.lineTo(len * 0.9, 0)
  ctx.stroke()
  ctx.restore()
}

/**
 * The foliage atlas (1024 px): a clump of leaves on twigs for the tree
 * crowns and bushes (top left), a mat of ivy (top right), a tuft of tall
 * grass (bottom left) and a fern (bottom right). Everything else is clear
 * (cut out by alpha), so all the green in the map is one material.
 */
export const foliageTexture = () =>
  cached('br:foliage', () => {
    const rand = seededRandom(9101)
    const S = 1024
    const H = S / 2
    const c = canvas(S)
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, S, S)

    // Leaf clump: a few twigs inside it (none below the leaves: a bare twig
    // under every clump reads as spokes from beneath the tree), leaves thick
    // round a lumpy outline.
    ctx.strokeStyle = '#4a3a28'
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (rand() - 0.5) * 2.2
      ctx.lineWidth = 2 + rand() * 2.5
      ctx.beginPath()
      ctx.moveTo(H / 2, H * 0.74)
      ctx.lineTo(H / 2 + Math.cos(a) * H * 0.26, H * 0.74 + Math.sin(a) * H * 0.3)
      ctx.stroke()
    }
    for (let i = 0; i < 900; i++) {
      const a = rand() * Math.PI * 2
      const r = Math.sqrt(rand()) * H * 0.44 * (0.85 + 0.15 * Math.sin(a * 5 + 1.3))
      const x = H / 2 + Math.cos(a) * r
      const y = H * 0.47 + Math.sin(a) * r * 0.9
      leaf(ctx, rand, x, y, 18 + rand() * 16, rand() * Math.PI * 2)
    }
    // Sun on the top of the clump, shade underneath.
    let g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, 'rgba(255,250,200,0.10)')
    g.addColorStop(1, 'rgba(0,20,0,0.18)')
    ctx.globalCompositeOperation = 'source-atop'
    ctx.fillStyle = g
    ctx.fillRect(0, 0, H, H)
    ctx.globalCompositeOperation = 'source-over'

    // Ivy: a mat of small heart-shaped leaves, ragged at the top, a few gaps.
    const ivyGreens = ['#2e5a22', '#3d6e2c', '#4a7c34', '#27501c', '#55853a']
    for (let i = 0; i < 1500; i++) {
      const x = H + 6 + rand() * (H - 12)
      const top = 40 + Math.sin(x * 0.03) * 22 + rand() * 30
      const y = top + rand() * (H - top - 4)
      leaf(ctx, rand, x, y, 10 + rand() * 9, rand() * Math.PI * 2, ivyGreens)
    }
    ctx.strokeStyle = 'rgba(70,52,34,0.8)'
    ctx.lineWidth = 2
    for (let i = 0; i < 6; i++) {
      let x = H + 40 + rand() * (H - 80)
      ctx.beginPath()
      ctx.moveTo(x, H)
      for (let y = H; y > 60; y -= 20) {
        x += (rand() - 0.5) * 14
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    // Tall grass: blades fanning up from the bottom middle of the bottom left.
    for (let i = 0; i < 140; i++) {
      const x0 = H / 2 + (rand() - 0.5) * H * 0.22
      const lean = (rand() - 0.5) * H * 0.5
      const h = H * (0.5 + rand() * 0.48)
      const t = rand()
      const col = mix(hex('#3f6a26'), hex('#9aa85a'), t * 0.8)
      ctx.strokeStyle = `rgb(${col[0]},${col[1]},${col[2]})`
      ctx.lineWidth = 2 + rand() * 2.5
      ctx.beginPath()
      ctx.moveTo(x0, S)
      ctx.quadraticCurveTo(x0 + lean * 0.3, S - h * 0.6, x0 + lean, S - h)
      ctx.stroke()
    }
    // Fern: fronds radiating from the bottom middle of the bottom right, leaflets down each.
    for (let f = 0; f < 9; f++) {
      const a = -Math.PI / 2 + (f / 8 - 0.5) * 2.6 + (rand() - 0.5) * 0.2
      const len = H * (0.42 + rand() * 0.12)
      const x0 = H + H / 2
      const y0 = S - 6
      for (let k = 0; k < 22; k++) {
        const t = k / 22
        const bend = a + t * 0.35 * Math.sign(Math.cos(a) || 1)
        const x = x0 + Math.cos(bend) * len * t
        const y = y0 + Math.sin(bend) * len * t
        const l = 26 * (1 - t * 0.8)
        leaf(ctx, rand, x, y, l, bend + Math.PI / 2 + 0.3, ['#3c6e28', '#4a7e30', '#356a24'])
        leaf(ctx, rand, x, y, l, bend - Math.PI / 2 - 0.3, ['#3c6e28', '#4a7e30', '#356a24'])
      }
    }
    // Clear gutters between the quarters and round the edge (see BR_UV).
    const gut = Math.round(S * IN * 0.6)
    ctx.clearRect(H - gut, 0, gut * 2, S)
    ctx.clearRect(0, H - gut, S, gut * 2)
    ctx.clearRect(0, 0, gut, S)
    ctx.clearRect(S - gut, 0, gut, S)
    ctx.clearRect(0, 0, S, gut)
    ctx.clearRect(0, S - gut, S, gut)
    // A little anisotropic filtering keeps cards seen at a slant from blurring into pale streaks.
    const t = finish(c)
    t.anisotropy = 2
    return t
  })

/** The field (8 m a tile): old furrows running up the tile, weeds coming through, a few stones. */
export const furrowTexture = () =>
  cached('br:furrows', () => {
    const rand = seededRandom(9201)
    const fbm = makeFbm(rand, 4, 5)
    const fine = makeNoise(160, rand)
    const weeds = makeNoise(24, rand)
    const S = 512
    const c = paint(S, (u, v) => {
      // Ten furrows across the tile, each a ridge and a trough.
      const f = (u * 10) % 1
      const ridge = Math.sin(f * Math.PI)
      const n = fbm(u, v)
      let col = mix(hex('#5a4630'), hex('#8a7050'), clamp01(ridge * 0.8 + (n - 0.5) * 0.5 + (fine(u, v) - 0.5) * 0.3))
      // Grass and weeds along the ridges.
      const w = weeds(u, v)
      if (ridge > 0.6 && w > 0.48) col = mix(col, hex('#6a8a3a'), clamp01((w - 0.48) * 3) * 0.8)
      // Dry straw in the troughs.
      if (ridge < 0.25 && fine(u * 2, v) > 0.7) col = mix(col, hex('#b8a060'), 0.5)
      return col
    })
    return finish(c)
  })

/**
 * Tileable cells for cracked mud: one point anywhere in each square of an
 * `n` x `n` grid; for a point in the tile, the distance to the nearest (f1)
 * and the next (f2) and the nearest one's index.
 */
function makeCells(rand, n) {
  const pts = []
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) pts.push([(i + 0.05 + rand() * 0.9) / n, (j + 0.05 + rand() * 0.9) / n])
  return (u, v) => {
    const ci = Math.floor(u * n)
    const cj = Math.floor(v * n)
    let f1 = 9
    let f2 = 9
    let id = 0
    for (let dj = -2; dj <= 2; dj++) {
      for (let di = -2; di <= 2; di++) {
        const i = ci + di
        const j = cj + dj
        const k = (((j % n) + n) % n) * n + (((i % n) + n) % n)
        const px = pts[k][0] + Math.floor(i / n)
        const py = pts[k][1] + Math.floor(j / n)
        const d = Math.hypot(px - u, py - v)
        if (d < f1) {
          f2 = f1
          f1 = d
          id = k
        } else if (d < f2) f2 = d
      }
    }
    return [f1, f2, id]
  }
}

/**
 * The creek's dry bed (4 m a tile): plates of grey-brown mud of every size,
 * cracked apart and pale where their edges curl, finer cracks across them,
 * smooth silt where it never dried out enough to crack, damp patches, grit.
 */
export const creekBedTexture = () =>
  cached('br:creekBed', () => {
    const rand = seededRandom(9301)
    const cells = makeCells(rand, 13)
    const fine = makeCells(rand, 29)
    const fbm = makeFbm(rand, 4, 4)
    const silt = makeFbm(rand, 3, 3)
    const width = makeNoise(20, rand)
    const grit = makeNoise(240, rand)
    const tone = Array.from({ length: 13 * 13 }, () => rand())
    const c = paint(512, (u, v) => {
      const [f1, f2, id] = cells(u, v)
      const edge = f2 - f1
      const n = fbm(u, v)
      // Where the silt stays smooth, the cracks fade out.
      const cracked = clamp01((0.54 - silt(u, v)) * 5)
      let col = mix(hex('#6a5c4a'), hex('#8e7e64'), clamp01(0.4 + (tone[id] - 0.5) * 0.5 * cracked + (n - 0.5) * 0.9))
      col = mix(col, hex('#5c5040'), clamp01((0.4 - n) * 3) * 0.6)
      const w = 0.003 + width(u, v) * 0.006
      col = mix(col, hex('#a29478'), clamp01(1 - edge / (w * 3.5)) * 0.15 * cracked)
      if (edge < w) col = mix(col, hex('#3e3428'), clamp01(1 - edge / w) * cracked * 0.85)
      const [g1, g2] = fine(u, v)
      if (g2 - g1 < 0.003) col = mix(col, hex('#54483a'), 0.3 * cracked * clamp01(1 - (g2 - g1) / 0.003))
      return mix(col, hex('#4a4034'), clamp01((grit(u, v) - 0.45) * 1.2) * 0.35)
    })
    return finish(c)
  })

/** The creek's banks (3 m a tile): bare earth, darker and lighter in patches, grit, a few small stones, fine roots. */
export const creekBankTexture = () =>
  cached('br:creekBank', () => {
    const rand = seededRandom(9351)
    const fbm = makeFbm(rand, 4, 5)
    const grit = makeNoise(200, rand)
    const stones = makeCells(rand, 11)
    const keep = Array.from({ length: 121 }, () => rand())
    const roots = makeNoise(18, rand)
    const c = paint(512, (u, v) => {
      const n = fbm(u, v)
      let col = mix(hex('#4e4032'), hex('#7c6648'), clamp01(0.5 + (n - 0.5) * 1.8))
      col = mix(col, hex('#362c22'), clamp01((grit(u, v) - 0.5) * 2) * 0.45)
      // A stone here and there, of different sizes, dull.
      const [f1, , id] = stones(u, v)
      const r = 0.006 + keep[id] * 0.016
      if (keep[id] < 0.3 && f1 < r) col = mix(col, hex('#7a7266'), clamp01((r - f1) / 0.004) * 0.75)
      const rt = roots(u, v)
      if (Math.abs(rt - 0.5) < 0.01) col = mix(col, hex('#2a2016'), 0.6)
      return col
    })
    return finish(c)
  })
