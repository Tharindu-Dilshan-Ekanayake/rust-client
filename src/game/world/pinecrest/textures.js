import { seededRandom } from '../../../shared/math.js'
import { cached, finish } from '../textures.js'

/**
 * Procedural textures for Pinecrest Lodge: one atlas for every leaf in the map
 * (birch crowns turning gold, pine boughs, dry grass, bracken), the forest
 * floor, the meadow grass and the gravel the ground blends between, granite,
 * birch and pine bark, the water's ripples and the waterfall, and the far
 * mountains and woods.
 *
 * All drawn with plain canvas operations (shapes, lines, gradients), batched
 * by colour, so each takes a few milliseconds: they're painted while the menus
 * are idle and must never hitch them. (The ripples are worked out per pixel,
 * but from a few sines on a small canvas.)
 */

function canvas(w, h = w) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

const pick = (rand, list) => list[Math.floor(rand() * list.length)]
const TAU = Math.PI * 2

/** Calls `fn(x, y)` at (x, y), and again across whichever edges it's within `m` of, so the texture tiles. */
function wrap(w, h, x, y, m, fn) {
  for (const dx of [-w, 0, w]) {
    if ((dx < 0 && x < w - m) || (dx > 0 && x > m)) continue
    for (const dy of [-h, 0, h]) {
      if ((dy < 0 && y < h - m) || (dy > 0 && y > m)) continue
      fn(x + dx, y + dy)
    }
  }
}

/** Speckles: `n` little squares, lighter or darker (a grain over a flat fill). */
function speckle(ctx, w, h, rand, n, alpha, size = 2, rgb = null) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = rgb ? `rgba(${rgb},${alpha})` : rand() < 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`
    const s = 1 + Math.floor(rand() * size)
    ctx.fillRect(rand() * w, rand() * h, s, s)
  }
}

/** Soft blotches: radial gradients of a colour fading out (drawn across the edges too, so it tiles). */
function blotches(ctx, w, h, rand, n, rgb, alpha, r0, r1) {
  for (let i = 0; i < n; i++) {
    const x = rand() * w
    const y = rand() * h
    const r = r0 + rand() * (r1 - r0)
    const a = alpha * (0.5 + rand() * 0.5)
    wrap(w, h, x, y, r, (px, py) => {
      const g = ctx.createRadialGradient(px, py, 0, px, py, r)
      g.addColorStop(0, `rgba(${rgb},${a})`)
      g.addColorStop(1, `rgba(${rgb},0)`)
      ctx.fillStyle = g
      ctx.fillRect(px - r, py - r, r * 2, r * 2)
    })
  }
}

/**
 * Many short strokes, one path per colour: `make(rand)` returns
 * [x, y, angle, length] for each. Wrapped across the edges if `tile`.
 */
function strokes(ctx, w, h, rand, n, colors, width, make, tile = true) {
  const paths = colors.map(() => [])
  for (let i = 0; i < n; i++) paths[Math.floor(rand() * colors.length)].push(make(rand))
  ctx.lineCap = 'round'
  colors.forEach((color, k) => {
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.beginPath()
    for (const [x, y, a, len] of paths[k]) {
      const draw = (px, py) => {
        ctx.moveTo(px, py)
        ctx.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len)
      }
      if (tile) wrap(w, h, x, y, len, draw)
      else draw(x, y)
    }
    ctx.stroke()
  })
}

/** Little leaves or stones, one path per colour: `make(rand)` returns [x, y, rx, ry, angle]. */
function ovals(ctx, w, h, rand, n, colors, make, tile = true) {
  const paths = colors.map(() => [])
  for (let i = 0; i < n; i++) paths[Math.floor(rand() * colors.length)].push(make(rand))
  colors.forEach((color, k) => {
    ctx.fillStyle = color
    ctx.beginPath()
    for (const [x, y, rx, ry, a] of paths[k]) {
      const draw = (px, py) => {
        ctx.moveTo(px + Math.cos(a) * rx, py + Math.sin(a) * rx)
        ctx.ellipse(px, py, rx, ry, a, 0, Math.PI * 2)
      }
      if (tile) wrap(w, h, x, y, rx, draw)
      else draw(x, y)
    }
    ctx.fill()
  })
}

/** A leaf: a pointed oval at (x, y), `len` long, turned `a`. */
function leaf(ctx, x, y, len, w, a) {
  const c = Math.cos(a)
  const s = Math.sin(a)
  const at = (u, v) => [x + u * c - v * s, y + u * s + v * c]
  const [x0, y0] = at(0, 0)
  const [x1, y1] = at(len * 0.5, -w)
  const [x2, y2] = at(len, 0)
  const [x3, y3] = at(len * 0.5, w)
  ctx.moveTo(x0, y0)
  ctx.quadraticCurveTo(x1, y1, x2, y2)
  ctx.quadraticCurveTo(x3, y3, x0, y0)
}

/* ---------------------------------------------------------------------------
 * The foliage atlas
 * ------------------------------------------------------------------------- */

/**
 * Where things are in the foliage atlas: [u0, v0, u1, v1] (v up). Each a
 * little inside its quarter, which is cleared round its edge, so a far card's
 * mipmaps never blend in the next quarter.
 */
const IN = 0.02
export const PC_UV = Object.freeze({
  birch: [IN, 0.5 + IN, 0.5 - IN, 1 - IN],
  pine: [0.5 + IN, 0.5 + IN, 1 - IN, 1 - IN],
  grass: [IN, IN, 0.5 - IN, 0.5 - IN],
  fern: [0.5 + IN, IN, 1 - IN, 0.5 - IN],
})

/**
 * The foliage atlas (1024 px): a clump of small birch leaves in autumn gold
 * on twigs (top left), a pine bough hanging from the trunk (top right: its
 * root at the top, its tip at the bottom: side twigs off a middle one, sprays
 * of needles along each, gaps between), a tuft of dry grass (bottom left) and
 * a frond of bracken gone orange (bottom right). Everything else is clear
 * (cut out by alpha), so all the leaves in the map are one material.
 */
export const foliageTexture = () =>
  cached('pc:foliage', () => {
    const rand = seededRandom(7701)
    const S = 1024
    const H = S / 2
    const c = canvas(S)
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, S, S)

    // Each quarter is drawn clipped to itself, so nothing spills into the next.
    const quarter = (qx, qy) => {
      ctx.restore()
      ctx.save()
      ctx.beginPath()
      ctx.rect(qx * H, qy * H, H, H)
      ctx.clip()
    }
    ctx.save()
    quarter(0, 0)
    // Birch: thin dark twigs, then small leaves thick round a lumpy outline, a few gaps.
    strokes(ctx, S, S, rand, 14, ['#3a3026', '#4a3c30'], 2.2, (r) => {
      const a = -Math.PI / 2 + (r() - 0.5) * 2.6
      return [H / 2, H * 0.72, a, H * (0.18 + r() * 0.16)]
    }, false)
    const golds = ['#e0b03c', '#d29c2e', '#ecc456', '#c6882a', '#dcb64c', '#b8943a', '#d0ac46', '#a4983c', '#bc7428', '#e6ca70']
    const byColor = golds.map(() => [])
    const holes = Array.from({ length: 7 }, () => [H / 2 + (rand() - 0.5) * H * 0.6, H * 0.48 + (rand() - 0.5) * H * 0.6, 20 + rand() * 26])
    for (let i = 0; i < 1900; i++) {
      const a = rand() * TAU
      const r = Math.sqrt(rand()) * H * 0.45 * (0.8 + 0.2 * Math.sin(a * 4 + 0.7))
      const x = H / 2 + Math.cos(a) * r
      const y = H * 0.48 + Math.sin(a) * r * 0.92
      if (holes.some(([hx, hy, hr]) => Math.hypot(x - hx, y - hy) < hr)) continue
      byColor[Math.floor(rand() * golds.length)].push([x, y, 8 + rand() * 8, rand() * TAU])
    }
    golds.forEach((color, k) => {
      ctx.fillStyle = color
      ctx.beginPath()
      for (const [x, y, len, a] of byColor[k]) leaf(ctx, x, y, len, len * 0.42, a)
      ctx.fill()
    })
    // Sun on the top of the clump, shade beneath.
    let g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, 'rgba(255,248,210,0.12)')
    g.addColorStop(1, 'rgba(40,20,0,0.26)')
    ctx.globalCompositeOperation = 'source-atop'
    ctx.fillStyle = g
    ctx.fillRect(0, 0, H, H)
    ctx.globalCompositeOperation = 'source-over'

    quarter(1, 0)
    // Pine bough: a middle twig, side twigs out and down to either side (longer toward the tip),
    // and along every twig sprays of needles fanning forward: dark first, lighter tips over them.
    const cx = H + H / 2
    const twigs = [[cx, 8, cx + 4, H - 26]]
    for (let i = 0; i < 11; i++) {
      const t = (i + 0.6) / 11
      const y = 14 + t * (H - 70)
      for (const s of [-1, 1]) {
        // (Inside the quarter, needles and all.)
        const reach = Math.min(H * (0.12 + 0.34 * t) * (0.8 + rand() * 0.3), H / 2 - 34)
        twigs.push([cx, y + rand() * 8, cx + s * reach, Math.min(H - 36, y + reach * (0.45 + rand() * 0.3))])
      }
    }
    const sprays = (n, colors, width, len, spread) =>
      strokes(ctx, S, S, rand, n, colors, width, (r) => {
        const [x0, y0, x1, y1] = twigs[Math.floor(r() * twigs.length)]
        const t = r()
        const a = Math.atan2(y1 - y0, x1 - x0) + (r() < 0.5 ? -1 : 1) * (0.5 + r() * spread)
        return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, a, len * (0.6 + r() * 0.6)]
      }, false)
    sprays(5200, ['#18271a', '#1e301f', '#223624', '#1a2a1c'], 2.4, 22, 0.6)
    sprays(2600, ['#2c4429', '#33502e', '#28402a'], 2.0, 16, 0.5)
    sprays(900, ['#4a6a3c', '#557445', '#3e5c34'], 1.6, 10, 0.4)
    ctx.strokeStyle = '#3a2a1e'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    for (const [x0, y0, x1, y1] of twigs) {
      ctx.moveTo(x0, y0)
      ctx.lineTo(x0 + (x1 - x0) * 0.7, y0 + (y1 - y0) * 0.7)
    }
    ctx.stroke()

    quarter(0, 1)
    // Dry grass: blades fanning up from the bottom middle of the bottom left.
    const straw = ['#6e6a38', '#8a8048', '#a49658', '#c2ae6c', '#7a7a3e', '#5e6430', '#b8a060']
    ctx.lineCap = 'round'
    for (let i = 0; i < 170; i++) {
      const x0 = H / 2 + (rand() - 0.5) * H * 0.24
      const lean = (rand() - 0.5) * H * 0.55
      const h = H * (0.45 + rand() * 0.5)
      ctx.strokeStyle = pick(rand, straw)
      ctx.lineWidth = 2 + rand() * 2.5
      ctx.beginPath()
      ctx.moveTo(x0, S - 4)
      ctx.quadraticCurveTo(x0 + lean * 0.3, S - h * 0.6, x0 + lean, S - h)
      ctx.stroke()
    }

    quarter(1, 1)
    // Bracken: a dozen fronds standing up from the bottom middle of the bottom right and arching
    // over at their tips, leaflets out to either side of each, shorter toward the tip; rust and orange.
    const rusts = ['#b4602a', '#c47432', '#a85426', '#d08a3c', '#9a5a2a', '#bc6e30', '#8c5a2c']
    const fronds = rusts.map(() => [])
    for (let f = 0; f < 12; f++) {
      const side = (f / 11 - 0.5) * 2
      const len = H * (0.5 + rand() * 0.16) * (1 - Math.abs(side) * 0.25)
      const x0 = H + H / 2 + side * 10
      const y0 = S - 6
      const color = Math.floor(rand() * rusts.length)
      for (let k = 2; k < 22; k++) {
        const t = k / 22
        // Up, leaning out, curling over more toward the tip.
        const a = -Math.PI / 2 + side * (0.35 + t * t * 0.9)
        const x = x0 + Math.sin(side * 0.35) * len * t + Math.cos(a) * len * t * t * 0.25
        const y = y0 - len * t + t * t * t * len * 0.35
        const l = 34 * (1 - t * 0.8) * (0.8 + rand() * 0.3)
        fronds[color].push([x, y, l, a + Math.PI / 2 + 0.35], [x, y, l, a - Math.PI / 2 - 0.35])
      }
    }
    rusts.forEach((color, k) => {
      ctx.fillStyle = color
      ctx.beginPath()
      for (const [x, y, l, a] of fronds[k]) leaf(ctx, x, y, l, l * 0.2, a)
      ctx.fill()
    })
    ctx.restore()

    // Clear gutters between the quarters and round the edge (see PC_UV).
    const gut = Math.round(S * IN * 0.6)
    ctx.clearRect(H - gut, 0, gut * 2, S)
    ctx.clearRect(0, H - gut, S, gut * 2)
    ctx.clearRect(0, 0, gut, S)
    ctx.clearRect(S - gut, 0, gut, S)
    ctx.clearRect(0, 0, S, gut)
    ctx.clearRect(0, S - gut, S, gut)
    const t = finish(c)
    t.anisotropy = 2
    return t
  })

/* ---------------------------------------------------------------------------
 * Bark
 * ------------------------------------------------------------------------- */

/** Birch bark (round the trunk, a metre a tile): chalky white, black lenticels in horizontal dashes, dark scars. */
export const birchBarkTexture = () =>
  cached('pc:birchBark', () => {
    const W = 128
    const Hh = 256
    const rand = seededRandom(7711)
    const c = canvas(W, Hh)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#e6e2d8'
    ctx.fillRect(0, 0, W, Hh)
    blotches(ctx, W, Hh, rand, 10, '150,156,162', 0.3, 10, 34)
    blotches(ctx, W, Hh, rand, 6, '214,196,170', 0.3, 8, 26)
    speckle(ctx, W, Hh, rand, 900, 0.08, 2)
    // Lenticels.
    for (let i = 0; i < 110; i++) {
      const w = 5 + rand() * 24
      const h = 1.2 + rand() * 2.4
      const x = rand() * W
      const y = rand() * Hh
      ctx.fillStyle = `rgba(28,24,22,${0.6 + rand() * 0.35})`
      wrap(W, Hh, x, y, w, (px, py) => ctx.fillRect(px, py, w, h))
    }
    // Scars where branches fell: black chevrons and smudges.
    for (let i = 0; i < 6; i++) {
      const x = rand() * W
      const y = rand() * Hh
      const rx = 7 + rand() * 12
      const ry = 4 + rand() * 7
      ctx.fillStyle = 'rgba(20,18,16,0.85)'
      wrap(W, Hh, x, y, rx, (px, py) => {
        ctx.beginPath()
        ctx.moveTo(px - rx, py - ry * 0.4)
        ctx.lineTo(px, py + ry)
        ctx.lineTo(px + rx, py - ry * 0.4)
        ctx.lineTo(px, py + ry * 0.3)
        ctx.closePath()
        ctx.fill()
      })
    }
    return finish(c)
  })

/** Pine bark (a metre a tile): deep dark furrows between long, irregular reddish-brown plates. */
export const pineBarkTexture = () =>
  cached('pc:pineBark', () => {
    const W = 128
    const Hh = 256
    const rand = seededRandom(7721)
    const c = canvas(W, Hh)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#2e2119'
    ctx.fillRect(0, 0, W, Hh)
    const plates = ['#6a4a34', '#76533a', '#5c4230', '#80583e', '#684c3a', '#725040']
    for (let i = 0; i < 110; i++) {
      const w = 7 + rand() * 14
      const h = 16 + rand() * 40
      const x = rand() * W
      const y = rand() * Hh
      const j = Array.from({ length: 6 }, () => (rand() - 0.5) * 0.5)
      ctx.fillStyle = pick(rand, plates)
      wrap(W, Hh, x, y, h, (px, py) => {
        ctx.beginPath()
        ctx.moveTo(px, py - h / 2)
        ctx.lineTo(px + (w / 2) * (1 + j[0]), py - h / 4)
        ctx.lineTo(px + (w / 2) * (1 + j[1]), py + h / 4)
        ctx.lineTo(px + w * j[2] * 0.3, py + h / 2)
        ctx.lineTo(px - (w / 2) * (1 + j[3]), py + h / 4)
        ctx.lineTo(px - (w / 2) * (1 + j[4]), py - h / 4)
        ctx.closePath()
        ctx.fill()
      })
    }
    speckle(ctx, W, Hh, rand, 1400, 0.14, 2)
    strokes(ctx, W, Hh, rand, 50, ['#1c140e'], 1.5, (r) => [r() * W, r() * Hh, Math.PI / 2 + (r() - 0.5) * 0.3, 20 + r() * 50])
    return finish(c)
  })

/* ---------------------------------------------------------------------------
 * Ground
 * ------------------------------------------------------------------------- */

/**
 * The forest floor (4 m a tile): dark earth almost hidden under fallen
 * leaves (small and packed, mostly browns and dull golds, a few bright ones
 * on top), pine needles and twigs.
 */
export const forestFloorTexture = () =>
  cached('pc:forestFloor', () => {
    const S = 512
    const rand = seededRandom(7731)
    const c = canvas(S)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#4e3a28'
    ctx.fillRect(0, 0, S, S)
    blotches(ctx, S, S, rand, 20, '40,30,20', 0.45, 30, 100)
    blotches(ctx, S, S, rand, 14, '120,90,56', 0.3, 30, 90)
    const leafAt = (r) => {
      const s = 1.5 + r() * 2.5
      return [r() * S, r() * S, s, s * 0.55, r() * Math.PI]
    }
    // Leaves in layers: the old ones under, browner; fresher ones on top; the odd bright one.
    ovals(ctx, S, S, rand, 7000, ['#6a4c30', '#78583a', '#866238', '#5a4228', '#8e6c3e', '#746640'], leafAt)
    ovals(ctx, S, S, rand, 3400, ['#a0703a', '#ae8444', '#946034', '#b4924e', '#845a30', '#988246'], leafAt)
    ovals(ctx, S, S, rand, 500, ['#c89a48', '#bc7e34', '#d0aa56', '#ae6630'], leafAt)
    strokes(ctx, S, S, rand, 900, ['#6a4c2c', '#4a3620', '#80603a'], 1.1, (r) => [r() * S, r() * S, r() * TAU, 5 + r() * 5])
    strokes(ctx, S, S, rand, 50, ['#2e2216'], 1.6, (r) => [r() * S, r() * S, r() * TAU, 10 + r() * 16])
    speckle(ctx, S, S, rand, 2500, 0.25, 2, '24,18,12')
    blotches(ctx, S, S, rand, 12, '36,26,16', 0.25, 20, 60)
    return finish(c)
  })

/** Meadow grass (3 m a tile): dry and olive, blades every way, a few leaves blown onto it. */
export const meadowTexture = () =>
  cached('pc:meadow', () => {
    const S = 512
    const rand = seededRandom(7741)
    const c = canvas(S)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#6e6a3c'
    ctx.fillRect(0, 0, S, S)
    blotches(ctx, S, S, rand, 14, '92,96,48', 0.4, 30, 90)
    blotches(ctx, S, S, rand, 10, '150,136,80', 0.35, 30, 80)
    strokes(ctx, S, S, rand, 7500, ['#8c864a', '#a09858', '#6a6834', '#b8aa66', '#5c6230', '#9a8c4a', '#c4b47a', '#7a7e40'], 1.6, (r) => [r() * S, r() * S, -Math.PI / 2 + (r() - 0.5) * 2.4, 5 + r() * 10])
    ovals(ctx, S, S, rand, 220, ['#c88a30', '#d8a840', '#a8602a'], (r) => {
      const s = 2.5 + r() * 3
      return [r() * S, r() * S, s, s * 0.6, r() * Math.PI]
    })
    speckle(ctx, S, S, rand, 2000, 0.12, 2, '40,36,20')
    return finish(c)
  })

/** Gravel and packed dirt (3 m a tile): the road, the yards, the paths and the creek's bed. */
export const gravelTexture = () =>
  cached('pc:gravel', () => {
    const S = 512
    const rand = seededRandom(7751)
    const c = canvas(S)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#6a6256'
    ctx.fillRect(0, 0, S, S)
    blotches(ctx, S, S, rand, 16, '84,74,60', 0.4, 30, 90)
    blotches(ctx, S, S, rand, 10, '132,126,114', 0.25, 30, 80)
    speckle(ctx, S, S, rand, 9000, 0.1, 2)
    ovals(ctx, S, S, rand, 3000, ['#7c766a', '#686258', '#8a8376', '#5a544c', '#72685a', '#948c7e'], (r) => {
      const s = 1.6 + r() * 3.4
      return [r() * S, r() * S, s, s * (0.6 + r() * 0.3), r() * Math.PI]
    })
    // Dark between the stones, a little light on their tops.
    speckle(ctx, S, S, rand, 3000, 0.3, 2, '30,28,24')
    speckle(ctx, S, S, rand, 900, 0.16, 2, '200,194,182')
    return finish(c)
  })

/**
 * Granite (3 m a tile, laid on from every side by the rock material): grey
 * flecked black, white and pink, darker and lighter in broad patches, dark
 * streaks where water runs down it, lichen in pale green and orange, cracks.
 */
export const graniteTexture = () =>
  cached('pc:granite', () => {
    const S = 512
    const rand = seededRandom(7761)
    const c = canvas(S)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#76746e'
    ctx.fillRect(0, 0, S, S)
    blotches(ctx, S, S, rand, 24, '64,62,58', 0.45, 30, 110)
    blotches(ctx, S, S, rand, 12, '150,146,138', 0.3, 30, 90)
    blotches(ctx, S, S, rand, 8, '128,110,94', 0.22, 20, 70)
    speckle(ctx, S, S, rand, 12000, 0.55, 2, '30,28,26')
    speckle(ctx, S, S, rand, 5000, 0.35, 2, '226,224,218')
    speckle(ctx, S, S, rand, 1500, 0.3, 3, '186,148,134')
    strokes(ctx, S, S, rand, 40, ['rgba(36,34,30,0.22)', 'rgba(50,46,40,0.18)'], 6, (r) => [r() * S, r() * S, Math.PI / 2 + (r() - 0.5) * 0.2, 40 + r() * 100])
    // Lichen.
    blotches(ctx, S, S, rand, 24, '160,170,112', 0.4, 6, 26)
    blotches(ctx, S, S, rand, 8, '200,146,72', 0.32, 5, 18)
    // Cracks.
    ctx.strokeStyle = 'rgba(30,28,26,0.65)'
    ctx.lineWidth = 1.5
    for (let i = 0; i < 8; i++) {
      let x = rand() * S
      let y = rand() * S
      ctx.beginPath()
      ctx.moveTo(x, y)
      for (let k = 0; k < 10; k++) {
        x += (rand() - 0.5) * 30
        y += (rand() - 0.2) * 24
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    return finish(c)
  })

/* ---------------------------------------------------------------------------
 * Water
 * ------------------------------------------------------------------------- */

/**
 * A normal map of small ripples: many little waves every way, the shorter
 * ones lower (it tiles: every wave fits a whole number of times).
 */
export const rippleTexture = () =>
  cached('pc:ripple', () => {
    const S = 256
    const rand = seededRandom(7771)
    const waves = []
    while (waves.length < 18) {
      const kx = Math.round((rand() * 2 - 1) * 11)
      const ky = Math.round((rand() * 2 - 1) * 11)
      const k = Math.hypot(kx, ky)
      if (k < 2) continue
      waves.push({ kx, ky, a: (0.3 + rand() * 0.7) / (k * 6), p: rand() * TAU })
    }
    const c = canvas(S)
    const ctx = c.getContext('2d')
    const img = ctx.createImageData(S, S)
    const d = img.data
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const u = x / S
        const v = y / S
        let dx = 0
        let dy = 0
        for (const w of waves) {
          const k = Math.cos(TAU * (w.kx * u + w.ky * v) + w.p) * w.a * TAU
          dx += k * w.kx
          dy += k * w.ky
        }
        dx *= 0.3
        dy *= 0.3
        const l = Math.hypot(dx, dy, 1)
        const i = (y * S + x) * 4
        d[i] = (-dx / l) * 127 + 128
        d[i + 1] = (dy / l) * 127 + 128
        d[i + 2] = (1 / l) * 127 + 128
        d[i + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
    return finish(c, { srgb: false })
  })

/** The waterfall (tiles top to bottom): streaks of white water, some thin and clear, some thick with foam. */
export const fallTexture = () =>
  cached('pc:fall', () => {
    const W = 128
    const Hh = 256
    const rand = seededRandom(7781)
    const c = canvas(W, Hh)
    const ctx = c.getContext('2d')
    ctx.fillStyle = 'rgba(210,226,228,0.35)'
    ctx.fillRect(0, 0, W, Hh)
    for (let i = 0; i < 180; i++) {
      const x = rand() * W
      const w = 1 + rand() * 4
      const y = rand() * Hh
      const len = 30 + rand() * 160
      const a = 0.2 + rand() * 0.6
      ctx.fillStyle = rand() < 0.7 ? `rgba(244,250,250,${a})` : `rgba(160,190,196,${a})`
      wrap(W, Hh, x, y, len, (px, py) => ctx.fillRect(px, py, w, len))
    }
    return finish(c)
  })

/** Foam where the fall lands: a patch of white bubbles, thick in the middle, thinning out (not tiled). */
export const foamTexture = () =>
  cached('pc:foam', () => {
    const S = 256
    const rand = seededRandom(7791)
    const c = canvas(S)
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, S, S)
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
    g.addColorStop(0, 'rgba(240,246,246,0.7)')
    g.addColorStop(0.6, 'rgba(240,246,246,0.25)')
    g.addColorStop(1, 'rgba(240,246,246,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)
    ovals(ctx, S, S, rand, 700, ['rgba(250,252,252,0.7)', 'rgba(220,234,236,0.6)'], (r) => {
      const a = r() * Math.PI * 2
      const d = Math.sqrt(r()) * S * 0.45
      const s = 1.5 + r() * 5
      return [S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, s, s, 0]
    }, false)
    return finish(c, { repeat: false })
  })

/* ---------------------------------------------------------------------------
 * Far off: the mountains, the woods across the valley
 * ------------------------------------------------------------------------- */

/**
 * The mountains (u round them, tiling; v by height, the same for every peak,
 * so the snow lies down to one line): blue with distance, dark forest along
 * the bottom, bare rock, then snow from a ragged line up, with gullies of
 * rock running up into it and snow streaking down into the rock.
 */
export const mountainTexture = () =>
  cached('pc:mountain', () => {
    const W = 1024
    const Hh = 512
    const rand = seededRandom(7801)
    const c = canvas(W, Hh)
    const ctx = c.getContext('2d')
    const rock = ctx.createLinearGradient(0, 0, 0, Hh)
    rock.addColorStop(0, '#8a93a0')
    rock.addColorStop(1, '#7c8692')
    ctx.fillStyle = rock
    ctx.fillRect(0, 0, W, Hh)
    blotches(ctx, W, Hh, rand, 40, '108,116,128', 0.4, 20, 70)
    const snowAt = (u) => Hh * (0.4 + 0.06 * Math.sin(TAU * 3 * u + 1) + 0.035 * Math.sin(TAU * 7 * u + 2) + 0.02 * Math.sin(TAU * 17 * u + 0.4))
    const treeAt = (u) => Hh * (0.8 + 0.025 * Math.sin(TAU * 5 * u + 0.5) + 0.012 * Math.sin(TAU * 23 * u))
    const snow = ctx.createLinearGradient(0, 0, 0, Hh * 0.5)
    snow.addColorStop(0, '#f2f5f8')
    snow.addColorStop(1, '#d8e0e8')
    ctx.fillStyle = snow
    ctx.beginPath()
    ctx.moveTo(0, 0)
    for (let x = 0; x <= W; x += 2) ctx.lineTo(x, snowAt(x / W))
    ctx.lineTo(W, 0)
    ctx.closePath()
    ctx.fill()
    // Gullies of rock up into the snow, snow down into the rock.
    for (let i = 0; i < 260; i++) {
      const x = rand() * W
      const y0 = snowAt(x / W)
      const len = 20 + rand() * 120
      const up = rand() < 0.6
      ctx.strokeStyle = up ? `rgba(116,124,136,${0.25 + rand() * 0.35})` : `rgba(236,240,244,${0.25 + rand() * 0.35})`
      ctx.lineWidth = 2 + rand() * 5
      ctx.beginPath()
      let px = x
      let py = y0 + (up ? 6 : -6)
      ctx.moveTo(px, py)
      for (let k = 0; k < 6; k++) {
        px += (rand() - 0.5) * 8
        py += ((up ? -1 : 1) * len) / 6
        ctx.lineTo(px, py)
      }
      ctx.stroke()
    }
    // The forest along the bottom, its top a fringe of spires.
    ctx.fillStyle = '#6c7a7e'
    ctx.beginPath()
    ctx.moveTo(0, Hh)
    for (let x = 0; x <= W; x += 6) ctx.lineTo(x, treeAt(x / W) - (x % 12 === 0 ? 8 + rand() * 6 : 0))
    ctx.lineTo(W, Hh)
    ctx.closePath()
    ctx.fill()
    speckle(ctx, W, Hh, rand, 3000, 0.06, 2)
    return finish(c)
  })

/**
 * The woods across the valley as one band (u tiles round; v up): hazy spires
 * behind, the gold crowns of birches, dark pines in front with ragged,
 * uneven boughs, and the wood's dark foot. Clear above, cut out by alpha.
 */
export const forestWallTexture = () =>
  cached('pc:forestWall', () => {
    const W = 1024
    const Hh = 256
    const rand = seededRandom(7811)
    const c = canvas(W, Hh)
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, W, Hh)
    // Each shape drawn again across the side it overhangs, so the band tiles round.
    const wrapX = (x, m, fn) => {
      fn(x)
      if (x < m) fn(x + W)
      if (x > W - m) fn(x - W)
    }
    const pine = (x, top, w, color) => {
      const n = 9 + Math.floor(rand() * 5)
      const jag = Array.from({ length: n * 2 }, () => 0.55 + rand() * 0.75)
      const step = (Hh - top) / n
      ctx.fillStyle = color
      wrapX(x, w, (px) => {
        ctx.beginPath()
        ctx.moveTo(px, top)
        for (let k = 1; k <= n; k++) {
          const t = k / n
          ctx.lineTo(px + (w / 2) * t * jag[k - 1], top + step * (k - 0.3))
          ctx.lineTo(px + (w / 2) * t * 0.4, top + step * k)
        }
        for (let k = n; k >= 1; k--) {
          const t = k / n
          ctx.lineTo(px - (w / 2) * t * 0.4, top + step * k)
          ctx.lineTo(px - (w / 2) * t * jag[n + k - 1], top + step * (k - 0.3))
        }
        ctx.closePath()
        ctx.fill()
      })
    }
    const birch = (x, y, rx, ry, color, shade) => {
      const lumps = Array.from({ length: 14 }, () => [rand() * TAU, Math.sqrt(rand()), 0.25 + rand() * 0.3])
      const blob = (px, dy, k) => {
        ctx.beginPath()
        for (const [a, d, s] of lumps) {
          const bx = px + Math.cos(a) * d * rx
          const by = y + Math.sin(a) * d * ry + dy
          ctx.moveTo(bx + rx * s * k, by)
          ctx.ellipse(bx, by, rx * s * k, ry * s * k, 0, 0, TAU)
        }
        ctx.fill()
      }
      wrapX(x, rx * 1.5, (px) => {
        ctx.fillStyle = '#b8b4a8'
        ctx.fillRect(px - 1.5, y, 3, Hh - y)
        ctx.fillStyle = shade
        blob(px, ry * 0.15, 1)
        ctx.fillStyle = color
        blob(px, -ry * 0.06, 0.82)
      })
    }
    for (let i = 0; i < 90; i++) pine(rand() * W, 20 + rand() * 70, 14 + rand() * 14, pick(rand, ['#46544e', '#4c5a52', '#425048']))
    for (let i = 0; i < 55; i++) birch(rand() * W, 70 + rand() * 70, 14 + rand() * 12, 16 + rand() * 12, pick(rand, ['#a88c4a', '#b49650', '#9a8044', '#a8763c', '#8c8448']), '#5e5032')
    for (let i = 0; i < 80; i++) pine(rand() * W, 60 + rand() * 100, 12 + rand() * 16, pick(rand, ['#1e2a22', '#24322a', '#1a261e', '#2a382e']))
    const foot = ctx.createLinearGradient(0, Hh - 70, 0, Hh)
    foot.addColorStop(0, 'rgba(26,34,28,0)')
    foot.addColorStop(0.45, 'rgba(26,34,28,1)')
    foot.addColorStop(1, 'rgba(22,28,24,1)')
    ctx.fillStyle = foot
    ctx.fillRect(0, Hh - 70, W, 70)
    const t = finish(c)
    t.anisotropy = 2
    return t
  })
