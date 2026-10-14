import { PLANE } from '../../../shared/mapTerminal.js'
import { seededRandom } from '../../../shared/math.js'
import { cached, finish } from '../textures.js'

/**
 * Procedural textures for Skyport Terminal: the apron's concrete, the hall's
 * polished stone and the lounges' carpet, wall cladding and ceiling tiles,
 * the container panels, the signs and screens, and the jet's livery.
 *
 * All drawn with plain canvas operations (rectangles, lines, gradients, text),
 * not pixel by pixel, so each takes a few milliseconds: they're painted while
 * the menus are idle and must never hitch them.
 */

function canvas(w, h = w) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

/** Speckles: `n` little rectangles in random greys round `base` (a grain over a flat fill). */
function speckle(ctx, w, h, rand, n, spread, alpha, size = 2) {
  for (let i = 0; i < n; i++) {
    const v = Math.round((rand() - 0.5) * spread)
    ctx.fillStyle = v > 0 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`
    const s = 1 + Math.floor(rand() * size)
    ctx.fillRect(rand() * w, rand() * h, s, s)
  }
}

/** Soft blotches (stains, damp, wear): radial gradients of a colour fading out. */
function blotches(ctx, w, h, rand, n, rgb, alpha, r0, r1) {
  for (let i = 0; i < n; i++) {
    const x = rand() * w
    const y = rand() * h
    const r = r0 + rand() * (r1 - r0)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(${rgb},${alpha * (0.5 + rand() * 0.5)})`)
    g.addColorStop(1, `rgba(${rgb},0)`)
    ctx.fillStyle = g
    // Drawn three times across each edge, so the texture still tiles.
    for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) ctx.fillRect(x + dx - r, y + dy - r, r * 2, r * 2)
  }
}

/**
 * The apron (5 m a tile, one slab): pale concrete, a darker joint round the
 * slab, grain and aggregate, oil and rubber stains, the odd crack.
 */
export const tarmacTexture = () =>
  cached('tm:tarmac', () => {
    const S = 512
    const rand = seededRandom(5101)
    const c = canvas(S)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#a9a7a1'
    ctx.fillRect(0, 0, S, S)
    blotches(ctx, S, S, rand, 14, '120,118,112', 0.18, 40, 140)
    blotches(ctx, S, S, rand, 10, '196,194,186', 0.16, 40, 120)
    speckle(ctx, S, S, rand, 9000, 1, 0.08, 2)
    speckle(ctx, S, S, rand, 1600, 1, 0.16, 1)
    // Oil and rubber.
    blotches(ctx, S, S, rand, 5, '52,50,46', 0.22, 10, 34)
    // A hairline crack or two.
    ctx.strokeStyle = 'rgba(60,58,54,0.5)'
    ctx.lineWidth = 1
    for (let i = 0; i < 3; i++) {
      let x = rand() * S
      let y = rand() * S
      ctx.beginPath()
      ctx.moveTo(x, y)
      for (let k = 0; k < 12; k++) {
        x += (rand() - 0.5) * 22
        y += (rand() - 0.3) * 18
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    // The joint round the slab (sealant, darker), half on each edge so slabs meet in one line.
    ctx.fillStyle = 'rgba(48,46,42,0.85)'
    ctx.fillRect(0, 0, S, 3)
    ctx.fillRect(0, 0, 3, S)
    ctx.fillStyle = 'rgba(48,46,42,0.5)'
    ctx.fillRect(0, S - 2, S, 2)
    ctx.fillRect(S - 2, 0, 2, S)
    return finish(c)
  })

/** Asphalt for the kerbside road: dark, fine aggregate, a little worn. */
export const asphaltTexture = () =>
  cached('tm:asphalt', () => {
    const S = 256
    const rand = seededRandom(5131)
    const c = canvas(S)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#4c4c4a'
    ctx.fillRect(0, 0, S, S)
    blotches(ctx, S, S, rand, 8, '90,90,86', 0.2, 20, 70)
    speckle(ctx, S, S, rand, 6000, 1, 0.12, 2)
    return finish(c)
  })

/**
 * Polished stone floor (1.2 m a tile: four 60 cm slabs): near-white, faint
 * grey veins, the slightest difference from slab to slab, hairline grout.
 */
export const stoneTexture = () =>
  cached('tm:stone', () => {
    const S = 256
    const rand = seededRandom(5201)
    const c = canvas(S)
    const ctx = c.getContext('2d')
    const half = S / 2
    for (const [x, y] of [[0, 0], [half, 0], [0, half], [half, half]]) {
      const k = 236 + Math.round((rand() - 0.5) * 10)
      ctx.fillStyle = `rgb(${k},${k},${k - 2})`
      ctx.fillRect(x, y, half, half)
      // Veins: a few soft wandering lines.
      ctx.save()
      ctx.beginPath()
      ctx.rect(x, y, half, half)
      ctx.clip()
      for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = `rgba(150,150,154,${0.12 + rand() * 0.15})`
        ctx.lineWidth = 0.6 + rand() * 1.4
        let px = x + rand() * half
        let py = y
        ctx.beginPath()
        ctx.moveTo(px, py)
        while (py < y + half) {
          px += (rand() - 0.5) * 14
          py += 6 + rand() * 10
          ctx.lineTo(px, py)
        }
        ctx.stroke()
      }
      ctx.restore()
    }
    speckle(ctx, S, S, rand, 1200, 1, 0.05, 1)
    ctx.fillStyle = 'rgba(120,120,118,0.55)'
    for (const t of [0, half]) {
      ctx.fillRect(t, 0, 1, S)
      ctx.fillRect(0, t, S, 1)
    }
    return finish(c)
  })

/** Carpet (2 m a tile): fine loop pile, a faint woven grid. Tinted per lounge. */
export const carpetTexture = () =>
  cached('tm:carpet', () => {
    const S = 256
    const rand = seededRandom(5301)
    const c = canvas(S)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#c8c8c8'
    ctx.fillRect(0, 0, S, S)
    speckle(ctx, S, S, rand, 14000, 1, 0.1, 1)
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.lineWidth = 1
    for (let i = 0; i < S; i += 16) {
      ctx.beginPath()
      ctx.moveTo(i + 0.5, 0)
      ctx.lineTo(i + 0.5, S)
      ctx.moveTo(0, i + 0.5)
      ctx.lineTo(S, i + 0.5)
      ctx.stroke()
    }
    return finish(c)
  })

/**
 * Metal cladding (3 m a tile): rectangular panels with dark joints, a little
 * difference from panel to panel. White outside the terminal, any tint.
 */
export const claddingTexture = () =>
  cached('tm:cladding', () => {
    const S = 512
    const rand = seededRandom(5401)
    const c = canvas(S)
    const ctx = c.getContext('2d')
    const cols = 2
    const rows = 4
    const pw = S / cols
    const ph = S / rows
    for (let i = 0; i < cols; i++) {
      for (let k = 0; k < rows; k++) {
        const v = 226 + Math.round((rand() - 0.5) * 12)
        const g = ctx.createLinearGradient(0, k * ph, 0, (k + 1) * ph)
        g.addColorStop(0, `rgb(${v + 6},${v + 6},${v + 6})`)
        g.addColorStop(1, `rgb(${v - 6},${v - 6},${v - 5})`)
        ctx.fillStyle = g
        ctx.fillRect(i * pw, k * ph, pw, ph)
      }
    }
    speckle(ctx, S, S, rand, 2000, 1, 0.04, 1)
    ctx.fillStyle = 'rgba(70,72,76,0.8)'
    for (let i = 0; i <= cols; i++) ctx.fillRect(i * pw - 2, 0, 4, S)
    for (let k = 0; k <= rows; k++) ctx.fillRect(0, k * ph - 2, S, 4)
    return finish(c)
  })

/** Smooth plaster for the walls inside (3 m a tile): almost flat, a faint trowel cloud. */
export const plasterTexture = () =>
  cached('tm:plaster', () => {
    const S = 256
    const rand = seededRandom(5501)
    const c = canvas(S)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#ececea'
    ctx.fillRect(0, 0, S, S)
    blotches(ctx, S, S, rand, 10, '220,220,216', 0.4, 30, 90)
    blotches(ctx, S, S, rand, 6, '250,250,248', 0.4, 30, 90)
    speckle(ctx, S, S, rand, 1500, 1, 0.03, 1)
    return finish(c)
  })

/** Ceiling tiles (2.4 m a tile): a 60 cm grid of white tiles in a grey T-bar grid. */
export const ceilingTexture = () =>
  cached('tm:ceiling', () => {
    const S = 256
    const rand = seededRandom(5601)
    const c = canvas(S)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#e8e8e6'
    ctx.fillRect(0, 0, S, S)
    speckle(ctx, S, S, rand, 5000, 1, 0.05, 1)
    ctx.fillStyle = 'rgba(150,152,154,0.9)'
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(i * 64, 0, 2, S)
      ctx.fillRect(0, i * 64, S, 2)
    }
    return finish(c)
  })

/** Ribbed aluminium (1 m a tile) for the cargo containers: vertical ribs, rivet lines. */
export const ribTexture = () =>
  cached('tm:rib', () => {
    const S = 128
    const rand = seededRandom(5701)
    const c = canvas(S)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#c4c6c8'
    ctx.fillRect(0, 0, S, S)
    for (let x = 0; x < S; x += 16) {
      const g = ctx.createLinearGradient(x, 0, x + 16, 0)
      g.addColorStop(0, 'rgba(255,255,255,0.35)')
      g.addColorStop(0.5, 'rgba(0,0,0,0)')
      g.addColorStop(1, 'rgba(0,0,0,0.22)')
      ctx.fillStyle = g
      ctx.fillRect(x, 0, 16, S)
    }
    blotches(ctx, S, S, rand, 4, '90,92,96', 0.2, 10, 40)
    ctx.fillStyle = 'rgba(60,60,60,0.5)'
    for (let x = 4; x < S; x += 8) {
      ctx.fillRect(x, 6, 2, 2)
      ctx.fillRect(x, S - 8, 2, 2)
    }
    return finish(c)
  })

/** Brushed steel (2 m a tile): fine horizontal streaks. */
export const brushedTexture = () =>
  cached('tm:brushed', () => {
    const S = 256
    const rand = seededRandom(5801)
    const c = canvas(S)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#b8bcc0'
    ctx.fillRect(0, 0, S, S)
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
      ctx.fillRect(rand() * S, rand() * S, 20 + rand() * 80, 1)
    }
    return finish(c)
  })

/** Shop shelves (one bay, 1.2 m wide and high): rows of goods in all colours. */
export const goodsTexture = () =>
  cached('tm:goods', () => {
    const S = 256
    const rand = seededRandom(5901)
    const c = canvas(S)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#3a3a3c'
    ctx.fillRect(0, 0, S, S)
    const palette = ['#c0392b', '#2e86c1', '#f1c40f', '#27ae60', '#ecf0f1', '#8e44ad', '#e67e22', '#16a085', '#d35400', '#bdc3c7', '#2c3e50', '#f39c12']
    const rows = 4
    const rh = S / rows
    for (let r = 0; r < rows; r++) {
      let x = 2
      while (x < S - 4) {
        const w = 5 + rand() * 14
        const h = rh * (0.45 + rand() * 0.45)
        ctx.fillStyle = palette[Math.floor(rand() * palette.length)]
        ctx.fillRect(x, (r + 1) * rh - 6 - h, w - 1, h)
        ctx.fillStyle = 'rgba(255,255,255,0.18)'
        ctx.fillRect(x, (r + 1) * rh - 6 - h, 2, h)
        x += w
      }
      // The shelf's edge.
      ctx.fillStyle = '#d8d8d4'
      ctx.fillRect(0, (r + 1) * rh - 6, S, 6)
    }
    return finish(c)
  })

/** Seat fabric (0.5 m a tile): dark blue with a fine weave. */
export const fabricTexture = () =>
  cached('tm:fabric', () => {
    const S = 128
    const rand = seededRandom(6001)
    const c = canvas(S)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#d0d0d0'
    ctx.fillRect(0, 0, S, S)
    for (let y = 0; y < S; y += 2) {
      ctx.fillStyle = y % 4 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'
      ctx.fillRect(0, y, S, 1)
    }
    speckle(ctx, S, S, rand, 1500, 1, 0.08, 1)
    return finish(c)
  })

/** Hatching for the no-parking boxes on the apron: yellow diagonals on clear. */
export const hatchTexture = () =>
  cached('tm:hatch', () => {
    const S = 128
    const c = canvas(S)
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, S, S)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 22
    for (let i = -2; i < 3; i++) {
      ctx.beginPath()
      ctx.moveTo(i * S - 10, S + 10)
      ctx.lineTo((i + 1) * S + 10, -10)
      ctx.stroke()
    }
    return finish(c)
  })

/* ---------------------------------------------------------------------------
 * Signs and screens: one atlas, drawn unlit so they always read
 * ------------------------------------------------------------------------- */

const SIGN_W = 1024
const SIGN_H = 1024
/** Each sign's cell in the atlas: [x, y, w, h] in pixels (y down). */
export const SIGN_CELLS = Object.freeze({
  gate3: [0, 0, 512, 128],
  gate45: [512, 0, 512, 128],
  security: [0, 128, 512, 128],
  checkin: [512, 128, 512, 128],
  books: [0, 256, 512, 128],
  dutyfree: [512, 256, 512, 128],
  cafe: [0, 384, 512, 128],
  lounge: [512, 384, 512, 128],
  vip: [0, 512, 512, 128],
  toilets: [512, 512, 256, 128],
  exit: [768, 512, 256, 128],
  info: [512, 640, 128, 128],
  stand: [640, 640, 128, 128],
  arrow: [768, 640, 128, 128],
  noStep: [896, 640, 128, 128],
  logo: [0, 640, 512, 128],
  baggage: [0, 768, 512, 128],
  staff: [512, 768, 512, 128],
  jet: [0, 896, 512, 128],
  fuel: [512, 896, 512, 128],
})

const GLYPHS = {
  // Simple pictograms drawn with paths, centred in a cell.
  man: (ctx, x, y, s) => {
    ctx.beginPath()
    ctx.arc(x, y - s * 0.32, s * 0.11, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillRect(x - s * 0.13, y - s * 0.18, s * 0.26, s * 0.3)
    ctx.fillRect(x - s * 0.12, y + s * 0.12, s * 0.09, s * 0.3)
    ctx.fillRect(x + s * 0.03, y + s * 0.12, s * 0.09, s * 0.3)
  },
  woman: (ctx, x, y, s) => {
    ctx.beginPath()
    ctx.arc(x, y - s * 0.32, s * 0.11, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(x - s * 0.06, y - s * 0.18)
    ctx.lineTo(x + s * 0.06, y - s * 0.18)
    ctx.lineTo(x + s * 0.2, y + s * 0.18)
    ctx.lineTo(x - s * 0.2, y + s * 0.18)
    ctx.closePath()
    ctx.fill()
    ctx.fillRect(x - s * 0.1, y + s * 0.18, s * 0.07, s * 0.24)
    ctx.fillRect(x + s * 0.03, y + s * 0.18, s * 0.07, s * 0.24)
  },
  plane: (ctx, x, y, s) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(-Math.PI / 4)
    ctx.beginPath()
    ctx.ellipse(0, 0, s * 0.42, s * 0.06, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(-s * 0.05, 0)
    ctx.lineTo(s * 0.08, -s * 0.36)
    ctx.lineTo(s * 0.16, -s * 0.36)
    ctx.lineTo(s * 0.12, 0)
    ctx.lineTo(s * 0.16, s * 0.36)
    ctx.lineTo(s * 0.08, s * 0.36)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(-s * 0.36, 0)
    ctx.lineTo(-s * 0.3, -s * 0.14)
    ctx.lineTo(-s * 0.25, -s * 0.14)
    ctx.lineTo(-s * 0.27, 0)
    ctx.lineTo(-s * 0.25, s * 0.14)
    ctx.lineTo(-s * 0.3, s * 0.14)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  },
  arrowR: (ctx, x, y, s) => {
    ctx.beginPath()
    ctx.moveTo(x - s * 0.3, y - s * 0.07)
    ctx.lineTo(x + s * 0.05, y - s * 0.07)
    ctx.lineTo(x + s * 0.05, y - s * 0.2)
    ctx.lineTo(x + s * 0.32, y)
    ctx.lineTo(x + s * 0.05, y + s * 0.2)
    ctx.lineTo(x + s * 0.05, y + s * 0.07)
    ctx.lineTo(x - s * 0.3, y + s * 0.07)
    ctx.closePath()
    ctx.fill()
  },
}

/** Text fitted to a width: shrinks the font until it fits. */
function fitText(ctx, text, x, y, maxW, size, weight = 'bold', family = 'Arial, Helvetica, sans-serif') {
  let s = size
  do {
    ctx.font = `${weight} ${s}px ${family}`
    if (ctx.measureText(text).width <= maxW) break
    s -= 2
  } while (s > 8)
  ctx.fillText(text, x, y)
}

export const signTexture = () =>
  cached('tm:signs', () => {
    const c = canvas(SIGN_W, SIGN_H)
    const ctx = c.getContext('2d')
    ctx.textBaseline = 'middle'
    const yellow = '#ffc82e'
    // Wayfinding: yellow on black, a pictogram on the left and maybe an arrow.
    const wayfinding = (cell, text, glyph, arrow = false, fg = yellow, bg = '#141416') => {
      const [x, y, w, h] = SIGN_CELLS[cell]
      ctx.fillStyle = bg
      ctx.fillRect(x, y, w, h)
      ctx.fillStyle = fg
      if (glyph) {
        ctx.fillRect(x + 10, y + 10, h - 20, h - 20)
        ctx.fillStyle = bg
        GLYPHS[glyph](ctx, x + h / 2, y + h / 2, h * 0.75)
        ctx.fillStyle = fg
      }
      ctx.textAlign = 'left'
      const left = x + (glyph ? h + 6 : 24)
      fitText(ctx, text, left, y + h / 2 + 2, w - (left - x) - (arrow ? h : 20), 64)
      if (arrow) GLYPHS.arrowR(ctx, x + w - h / 2, y + h / 2, h * 0.8)
    }
    wayfinding('gate3', 'GATE 3', 'plane')
    wayfinding('gate45', 'GATES 4-5', 'plane', true)
    wayfinding('security', 'SECURITY CHECK', null, true)
    wayfinding('checkin', 'CHECK-IN  A1-A12', null)
    wayfinding('books', 'BOOKS & NEWS', null, false, '#ffffff', '#1c3a6e')
    wayfinding('dutyfree', 'DUTY FREE', null, false, '#ffffff', '#6e1c3a')
    wayfinding('cafe', 'SKYPORT CAFÉ', null, false, '#2b1a10', '#e8c48a')
    wayfinding('lounge', 'SKY LOUNGE', null, true)
    wayfinding('vip', 'VIP LOUNGE', null, false, '#e8d49a', '#111214')
    wayfinding('baggage', 'BAGGAGE HALL', null, true)
    wayfinding('staff', 'STAFF ONLY', null, false, '#ffffff', '#8a1a1a')
    // Toilets: the two figures.
    {
      const [x, y, w, h] = SIGN_CELLS.toilets
      ctx.fillStyle = '#141416'
      ctx.fillRect(x, y, w, h)
      ctx.fillStyle = yellow
      GLYPHS.man(ctx, x + w * 0.3, y + h / 2, h * 0.8)
      GLYPHS.woman(ctx, x + w * 0.7, y + h / 2, h * 0.8)
    }
    // Exit: white on green.
    {
      const [x, y, w, h] = SIGN_CELLS.exit
      ctx.fillStyle = '#138a3c'
      ctx.fillRect(x, y, w, h)
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      fitText(ctx, 'EXIT', x + w / 2, y + h / 2 + 2, w - 30, 72)
    }
    // Information: a white i on blue.
    {
      const [x, y, w, h] = SIGN_CELLS.info
      ctx.fillStyle = '#1f5fbf'
      ctx.fillRect(x, y, w, h)
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.font = 'bold 96px Georgia, serif'
      ctx.fillText('i', x + w / 2, y + h / 2 + 6)
    }
    // The stand number painted on the apron (white on clear, drawn on black here; used as a mask).
    {
      const [x, y, w, h] = SIGN_CELLS.stand
      ctx.fillStyle = '#000000'
      ctx.fillRect(x, y, w, h)
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.font = 'bold 120px Arial, sans-serif'
      ctx.fillText('9', x + w / 2, y + h / 2 + 6)
    }
    {
      const [x, y, w, h] = SIGN_CELLS.arrow
      ctx.fillStyle = '#000000'
      ctx.fillRect(x, y, w, h)
      ctx.fillStyle = '#ffffff'
      ctx.save()
      ctx.translate(x + w / 2, y + h / 2)
      ctx.rotate(-Math.PI / 2)
      GLYPHS.arrowR(ctx, 0, 0, w * 0.9)
      ctx.restore()
    }
    {
      const [x, y, w, h] = SIGN_CELLS.noStep
      ctx.fillStyle = '#000000'
      ctx.fillRect(x, y, w, h)
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      fitText(ctx, 'NO STEP', x + w / 2, y + h / 2 + 2, w - 10, 30)
    }
    // The airport's name for the front of the terminal: white on deep blue.
    {
      const [x, y, w, h] = SIGN_CELLS.logo
      ctx.fillStyle = '#0f2f6b'
      ctx.fillRect(x, y, w, h)
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      fitText(ctx, 'SKYPORT', x + w / 2 + 30, y + h / 2 + 4, w - 120, 96)
      ctx.fillStyle = '#ffc82e'
      GLYPHS.plane(ctx, x + 64, y + h / 2, h * 0.85)
    }
    // Stencils for the trucks.
    {
      const [x, y, w, h] = SIGN_CELLS.jet
      ctx.fillStyle = '#f4f4f2'
      ctx.fillRect(x, y, w, h)
      ctx.fillStyle = '#c0392b'
      ctx.textAlign = 'center'
      fitText(ctx, 'JET A-1', x + w / 2, y + h / 2 + 2, w - 40, 84)
    }
    {
      const [x, y, w, h] = SIGN_CELLS.fuel
      ctx.fillStyle = '#f4f4f2'
      ctx.fillRect(x, y, w, h)
      ctx.fillStyle = '#1f5fbf'
      ctx.textAlign = 'center'
      fitText(ctx, 'SKYPORT CATERING', x + w / 2, y + h / 2 + 2, w - 40, 60)
    }
    return finish(c, { repeat: false })
  })

/** UVs [u0, v0, u1, v1] of a sign cell (v up, as three.js expects). */
export function signUV(name) {
  const [x, y, w, h] = SIGN_CELLS[name]
  return [x / SIGN_W, 1 - (y + h) / SIGN_H, (x + w) / SIGN_W, 1 - y / SIGN_H]
}

/** The morning it all stopped: one flight got out, nothing else is going anywhere. */
const FLIGHTS = [
  ['07:40', 'REYKJAVIK', 'SK 214', '1', 'DEPARTED'],
  ['08:05', 'LISBON', 'AV 3120', '4', 'CANCELLED'],
  ['08:20', 'HELSINKI', 'NL 881', '2', 'CANCELLED'],
  ['08:35', 'CAIRO', 'SK 559', '5', 'CANCELLED'],
  ['08:50', 'TOKYO', 'AV 702', '3', 'CANCELLED'],
  ['09:10', 'MONTREAL', 'NL 1337', '1', 'CANCELLED'],
  ['09:25', 'NAIROBI', 'SK 120', '4', 'CANCELLED'],
  ['09:40', 'SANTIAGO', 'AV 4410', '2', 'CANCELLED'],
  ['10:05', 'OSLO', 'NL 618', '5', 'CANCELLED'],
  ['10:20', 'DUBLIN', 'SK 903', '3', 'CANCELLED'],
]
const STATUS_COLOUR = { DEPARTED: '#8a96a8', BOARDING: '#3ee07a', DELAYED: '#ff5a4a', 'GATE OPEN': '#ffd24a', 'ON TIME': '#e8eef6', CANCELLED: '#ff5a4a' }

/** The departures screens: a header and ten flights, white and yellow on dark blue. */
export const boardTexture = () =>
  cached('tm:board', () => {
    const W = 512
    const H = 320
    const c = canvas(W, H)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#0b1a33'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#16325e'
    ctx.fillRect(0, 0, W, 40)
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'left'
    ctx.font = 'bold 26px Arial, sans-serif'
    ctx.fillText('DEPARTURES', 16, 21)
    ctx.textAlign = 'right'
    ctx.font = 'bold 18px Arial, sans-serif'
    ctx.fillText('09:02', W - 14, 21)
    const cols = [12, 82, 262, 368, 404]
    ctx.font = 'bold 13px Arial, sans-serif'
    ctx.fillStyle = '#9fb4d8'
    ctx.textAlign = 'left'
    ;['TIME', 'DESTINATION', 'FLIGHT', 'GATE', 'REMARKS'].forEach((t, i) => ctx.fillText(t, cols[i], 52))
    FLIGHTS.forEach((f, r) => {
      const y = 76 + r * 24
      if (r % 2) {
        ctx.fillStyle = 'rgba(255,255,255,0.04)'
        ctx.fillRect(0, y - 12, W, 24)
      }
      ctx.font = 'bold 16px Arial, sans-serif'
      f.forEach((t, i) => {
        ctx.fillStyle = i === 4 ? STATUS_COLOUR[t] : i === 0 ? '#ffd24a' : '#f2f4f8'
        ctx.fillText(t, cols[i], y)
      })
    })
    return finish(c, { repeat: false })
  })

/** Adverts on the hall's screens: three panels side by side (u thirds). */
export const advertTexture = () =>
  cached('tm:adverts', () => {
    const W = 768
    const H = 256
    const c = canvas(W, H)
    const ctx = c.getContext('2d')
    const ad = (i, top, bottom, title, sub, ink) => {
      const g = ctx.createLinearGradient(i * 256, 0, i * 256 + 256, H)
      g.addColorStop(0, top)
      g.addColorStop(1, bottom)
      ctx.fillStyle = g
      ctx.fillRect(i * 256, 0, 256, H)
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.beginPath()
      ctx.arc(i * 256 + 190, 80, 70, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = ink
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      fitText(ctx, title, i * 256 + 18, 170, 220, 44)
      ctx.font = '20px Arial, sans-serif'
      ctx.fillText(sub, i * 256 + 20, 205)
    }
    ad(0, '#f29a3c', '#d4385a', 'FLY FURTHER', 'with SKYPORT AIR', '#ffffff')
    ad(1, '#2fb7a4', '#1d5f9e', 'SUMMER SALE', 'up to 40% off at Duty Free', '#ffffff')
    ad(2, '#f6e7c8', '#e2b46c', 'ARCTIC BLOOM', 'the new fragrance', '#4a2a10')
    return finish(c, { repeat: false })
  })

/* ---------------------------------------------------------------------------
 * The jet's livery: one texture round the whole fuselage
 *
 * u runs nose (0) to tail (1), v round the section from the right side's
 * middle (0) up over the top (0.25), down the left side (0.5) and under the
 * belly (0.75), measured round each section's own centre (see fuselageAt).
 * ------------------------------------------------------------------------- */

const LIV_W = 2048
const LIV_H = 1024
const zToU = (z) => (z - PLANE.nose) / (PLANE.tail - PLANE.nose)
/** Angle (round the section, from the right side's middle) of height `y` on side `side` of the constant body. */
const angleAt = (side, y) => {
  const a = Math.asin(Math.max(-1, Math.min(1, (y - PLANE.yc) / PLANE.R)))
  return side > 0 ? a : Math.PI - a
}
const px = (z) => zToU(z) * LIV_W
const py = (a) => (1 - (((a / (Math.PI * 2)) % 1) + 1) % 1) * LIV_H

/** The cabin windows' positions along the fuselage (both sides): [z]. */
export const CABIN_WINDOWS = Object.freeze(
  (() => {
    const out = []
    for (let z = -6.2; z < 19.9; z += 0.53) {
      if (PLANE.doors.some((d) => z > d.z0 - 0.35 && z < d.z1 + 0.35)) continue
      out.push(+z.toFixed(3))
    }
    return out
  })(),
)
/** Window band: bottom and top height on the side. */
export const WINDOW_Y = Object.freeze([4.62, 4.98])

export const liveryTexture = () =>
  cached('tm:livery', () => {
    const c = canvas(LIV_W, LIV_H)
    const ctx = c.getContext('2d')
    const rand = seededRandom(6201)
    // White over the top, light grey belly below the cheatline.
    ctx.fillStyle = '#f4f5f6'
    ctx.fillRect(0, 0, LIV_W, LIV_H)
    // The belly: v from 0.62 to 0.88 (angles round the bottom).
    ctx.fillStyle = '#c9ccd0'
    ctx.fillRect(0, py(Math.PI * 2 * 0.88), LIV_W, py(Math.PI * 2 * 0.62) - py(Math.PI * 2 * 0.88))
    // A faint panel grid and the odd streak of grime.
    ctx.fillStyle = 'rgba(80,86,96,0.18)'
    for (let z = PLANE.nose + 2; z < PLANE.tail; z += 1.25) ctx.fillRect(px(z), 0, 1, LIV_H)
    for (let k = 1; k < 16; k++) ctx.fillRect(0, (LIV_H * k) / 16, LIV_W, 1)
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(120,110,96,${0.03 + rand() * 0.05})`
      ctx.fillRect(rand() * LIV_W, rand() * LIV_H, 20 + rand() * 120, 2 + rand() * 6)
    }
    const band = (side, y0, y1, colour, z0 = PLANE.nose + 1.2, z1 = PLANE.tail - 0.8) => {
      const a0 = angleAt(side, y0)
      const a1 = angleAt(side, y1)
      const top = Math.min(py(a0), py(a1))
      const bottom = Math.max(py(a0), py(a1))
      ctx.fillStyle = colour
      ctx.fillRect(px(z0), top, px(z1) - px(z0), bottom - top)
    }
    for (const side of [-1, 1]) {
      // Cheatline: a deep blue band under the windows and a thin red one under that.
      // (Both above the section's middle, so neither wraps round the texture's edge.)
      band(side, 4.26, 4.5, '#163d7a')
      band(side, 4.205, 4.235, '#c8282e')
      // Windows: dark rounded panes.
      for (const z of CABIN_WINDOWS) {
        const a0 = angleAt(side, WINDOW_Y[0])
        const a1 = angleAt(side, WINDOW_Y[1])
        const x0 = px(z - 0.12)
        const x1 = px(z + 0.12)
        const t = Math.min(py(a0), py(a1))
        const b = Math.max(py(a0), py(a1))
        ctx.fillStyle = '#20262e'
        ctx.beginPath()
        ctx.roundRect(x0, t, x1 - x0, b - t, 4)
        ctx.fill()
        ctx.fillStyle = 'rgba(160,190,220,0.35)'
        ctx.fillRect(x0 + 1, t + 1, (x1 - x0) * 0.4, (b - t) * 0.45)
      }
      // Door outlines (round the open ones too: the frame you see from outside).
      ctx.strokeStyle = 'rgba(70,76,84,0.85)'
      ctx.lineWidth = 2
      for (const d of [...PLANE.doors, ...PLANE.shut].filter((o) => o.side === side)) {
        const a0 = angleAt(side, PLANE.floor - 0.02)
        const a1 = angleAt(side, PLANE.doorTop + 0.04)
        const t = Math.min(py(a0), py(a1))
        const b = Math.max(py(a0), py(a1))
        ctx.beginPath()
        ctx.roundRect(px(d.z0 - 0.05), t, px(d.z1 + 0.05) - px(d.z0 - 0.05), b - t, 8)
        ctx.stroke()
      }
      // The airline's name over the forward windows, readable from either side:
      // on the right the fuselage runs tail-to-nose across the screen, on the
      // left the section's angle runs down the screen.
      const name = document.createElement('canvas')
      name.width = 900
      name.height = 120
      const n = name.getContext('2d')
      n.fillStyle = '#163d7a'
      n.textBaseline = 'middle'
      n.textAlign = 'center'
      n.font = 'bold 104px Arial, Helvetica, sans-serif'
      n.fillText('SKYPORT AIR', 450, 64)
      const a0 = angleAt(side, 5.12)
      const a1 = angleAt(side, 5.62)
      const t = Math.min(py(a0), py(a1))
      const b = Math.max(py(a0), py(a1))
      const x0 = px(-4.4)
      const x1 = px(6.4)
      ctx.save()
      ctx.translate((x0 + x1) / 2, (t + b) / 2)
      ctx.scale(side > 0 ? -1 : 1, side > 0 ? 1 : -1)
      ctx.drawImage(name, -(x1 - x0) / 2, -(b - t) / 2, x1 - x0, b - t)
      ctx.restore()
      // The registration on the rear fuselage.
      const reg = document.createElement('canvas')
      reg.width = 300
      reg.height = 60
      const r = reg.getContext('2d')
      r.fillStyle = '#3a3e44'
      r.textBaseline = 'middle'
      r.textAlign = 'center'
      r.font = 'bold 48px Arial, sans-serif'
      r.fillText('SP-KYA', 150, 32)
      const ra0 = angleAt(side, 4.9)
      const ra1 = angleAt(side, 5.2)
      const rt = Math.min(py(ra0), py(ra1))
      const rb = Math.max(py(ra0), py(ra1))
      ctx.save()
      ctx.translate((px(21.0) + px(23.6)) / 2, (rt + rb) / 2)
      ctx.scale(side > 0 ? -1 : 1, side > 0 ? 1 : -1)
      ctx.drawImage(reg, -(px(23.6) - px(21.0)) / 2, -(rb - rt) / 2, px(23.6) - px(21.0), rb - rt)
      ctx.restore()
    }
    // Cockpit windows on the nose: dark panes either side and across the front of the top.
    const noseWin = (z0, z1, a0, a1) => {
      for (const side of [-1, 1]) {
        const p0 = side > 0 ? a0 : Math.PI - a1
        const p1 = side > 0 ? a1 : Math.PI - a0
        const t = Math.min(py(p0), py(p1))
        const b = Math.max(py(p0), py(p1))
        ctx.fillStyle = '#1a1e24'
        ctx.beginPath()
        ctx.roundRect(px(z0), t, px(z1) - px(z0), b - t, 3)
        ctx.fill()
      }
    }
    noseWin(-14.6, -13.75, 0.62, 1.12)
    noseWin(-13.65, -12.85, 0.42, 0.95)
    noseWin(-12.75, -12.15, 0.36, 0.72)
    // The radome: a slightly different grey at the very tip.
    ctx.fillStyle = '#dfe2e6'
    ctx.fillRect(0, 0, px(-15.4), LIV_H)
    return finish(c, { repeat: false })
  })

/** The fin: the airline's mark, a blue field with a golden bird, the same on both faces. */
export const finTexture = () =>
  cached('tm:fin', () => {
    const S = 512
    const c = canvas(S)
    const ctx = c.getContext('2d')
    const g = ctx.createLinearGradient(0, S, S, 0)
    g.addColorStop(0, '#0f2f6b')
    g.addColorStop(1, '#1f5fbf')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)
    ctx.fillStyle = '#ffc82e'
    GLYPHS.plane(ctx, S * 0.55, S * 0.5, S * 0.8)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 10
    ctx.beginPath()
    ctx.arc(S * 0.55, S * 0.5, S * 0.32, 0, Math.PI * 2)
    ctx.stroke()
    return finish(c, { repeat: false })
  })

/** Engine fan face: dark blades round a spinner (the spinner's swirl in the middle). */
export const fanTexture = () =>
  cached('tm:fan', () => {
    const S = 256
    const c = canvas(S)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#16181c'
    ctx.fillRect(0, 0, S, S)
    ctx.translate(S / 2, S / 2)
    for (let i = 0; i < 22; i++) {
      ctx.rotate((Math.PI * 2) / 22)
      const g = ctx.createLinearGradient(0, 0, S / 2, 0)
      g.addColorStop(0, '#3a3e46')
      g.addColorStop(1, '#646a74')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(S * 0.08, -2)
      ctx.lineTo(S * 0.5, -10)
      ctx.lineTo(S * 0.5, 6)
      ctx.lineTo(S * 0.08, 4)
      ctx.closePath()
      ctx.fill()
    }
    ctx.fillStyle = '#d8dade'
    ctx.beginPath()
    ctx.arc(0, 0, S * 0.1, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#2a2c30'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(0, 0, S * 0.07, 0, Math.PI * 1.2)
    ctx.stroke()
    return finish(c, { repeat: false })
  })

/**
 * The cabin's lining (two window pitches a tile, 1.06 m along, the whole way
 * round): pale panels, the window reveals, and the light coming in through
 * them (the same texture lights them: see tm.lining).
 */
export const liningTexture = () =>
  cached('tm:lining', () => {
    const W = 128
    const H = 512
    const c = canvas(W, H)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#e6e4de'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(0,0,0,0.06)'
    ctx.fillRect(W / 2 - 1, 0, 2, H)
    return finish(c)
  })

/* ---------------------------------------------------------------------------
 * War damage
 * ------------------------------------------------------------------------- */

/**
 * A scorch mark (no tiling, alpha): soot thick in the middle, feathering out
 * in uneven lobes, streaks thrown out round it the way a blast throws them.
 */
export const scorchTexture = () =>
  cached('tm:scorch', () => {
    const S = 256
    const rand = seededRandom(6301)
    const c = canvas(S)
    const ctx = c.getContext('2d')
    const blob = (x, y, r, a) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, `rgba(14,11,9,${a})`)
      g.addColorStop(0.55, `rgba(22,17,13,${a * 0.6})`)
      g.addColorStop(1, 'rgba(30,24,18,0)')
      ctx.fillStyle = g
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }
    blob(S / 2, S / 2, S * 0.42, 0.85)
    for (let i = 0; i < 14; i++) {
      const a = rand() * Math.PI * 2
      const d = S * (0.08 + rand() * 0.22)
      blob(S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, S * (0.07 + rand() * 0.12), 0.35 + rand() * 0.3)
    }
    // Streaks out from the middle.
    ctx.lineCap = 'round'
    for (let i = 0; i < 40; i++) {
      const a = rand() * Math.PI * 2
      const r0 = S * (0.1 + rand() * 0.1)
      const r1 = S * (0.3 + rand() * 0.18)
      const g = ctx.createLinearGradient(S / 2 + Math.cos(a) * r0, S / 2 + Math.sin(a) * r0, S / 2 + Math.cos(a) * r1, S / 2 + Math.sin(a) * r1)
      g.addColorStop(0, 'rgba(16,12,10,0.55)')
      g.addColorStop(1, 'rgba(16,12,10,0)')
      ctx.strokeStyle = g
      ctx.lineWidth = 1 + rand() * 4
      ctx.beginPath()
      ctx.moveTo(S / 2 + Math.cos(a) * r0, S / 2 + Math.sin(a) * r0)
      ctx.lineTo(S / 2 + Math.cos(a) * r1, S / 2 + Math.sin(a) * r1)
      ctx.stroke()
    }
    return finish(c, { repeat: false })
  })

/**
 * The crashed jet's skin (u along it, v round it, like the livery): its
 * white paint gone grey with soot, the cheatline in pieces, burnt through to
 * black and blistered brown in patches, panel seams and rivet lines.
 */
export const wreckSkinTexture = () =>
  cached('tm:wreckSkin', () => {
    const W = 512
    const H = 256
    const rand = seededRandom(6401)
    const c = canvas(W, H)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#b9b4ab'
    ctx.fillRect(0, 0, W, H)
    blotches(ctx, W, H, rand, 18, '96,90,82', 0.35, 20, 90)
    // The cheatline under the windows, both sides (v = 0.04 and 0.46).
    for (const v of [0.035, 0.465]) {
      ctx.fillStyle = '#23345e'
      ctx.fillRect(0, (1 - v) * H - 7, W, 9)
      ctx.fillStyle = '#b8322c'
      ctx.fillRect(0, (1 - v) * H + 4, W, 3)
    }
    // Panel seams and rivets.
    ctx.strokeStyle = 'rgba(40,36,32,0.45)'
    ctx.lineWidth = 1
    for (let x = 0; x < W; x += 64) {
      ctx.beginPath()
      ctx.moveTo(x + 0.5, 0)
      ctx.lineTo(x + 0.5, H)
      ctx.stroke()
    }
    for (let y = 16; y < H; y += 32) {
      ctx.beginPath()
      ctx.moveTo(0, y + 0.5)
      ctx.lineTo(W, y + 0.5)
      ctx.stroke()
    }
    speckle(ctx, W, H, rand, 3000, 1, 0.12, 1)
    // Soot rolling up the sides from the fires (darker low down, round the belly).
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, 'rgba(20,16,12,0.15)')
    g.addColorStop(0.5, 'rgba(20,16,12,0.1)')
    g.addColorStop(0.75, 'rgba(20,16,12,0.7)')
    g.addColorStop(1, 'rgba(20,16,12,0.15)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    // Burnt through: blistered brown rims round black.
    blotches(ctx, W, H, rand, 10, '92,58,30', 0.7, 24, 60)
    blotches(ctx, W, H, rand, 12, '12,10,8', 0.95, 14, 46)
    blotches(ctx, W, H, rand, 30, '20,16,12', 0.5, 6, 18)
    return finish(c)
  })

/** Sandbags (one tile a bag's face): coarse sacking, a seam, grime. */
export const sackTexture = () =>
  cached('tm:sack', () => {
    const S = 128
    const rand = seededRandom(6501)
    const c = canvas(S)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#a08c66'
    ctx.fillRect(0, 0, S, S)
    ctx.globalAlpha = 0.18
    for (let i = 0; i < S; i += 3) {
      ctx.fillStyle = i % 2 ? '#5e4e34' : '#c8b48a'
      ctx.fillRect(i, 0, 1, S)
      ctx.fillRect(0, i, S, 1)
    }
    ctx.globalAlpha = 1
    blotches(ctx, S, S, rand, 8, '70,58,40', 0.3, 10, 40)
    speckle(ctx, S, S, rand, 900, 1, 0.12, 2)
    return finish(c)
  })
