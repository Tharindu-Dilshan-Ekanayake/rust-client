import { seededRandom } from '../../../shared/math.js'
import { cached, canvas, finish, hex, makeFbm, makeNoise, mix, paint } from '../textures.js'

/**
 * Procedural textures for Atomic Acres: lawns, asphalt, sidewalks, lap siding,
 * shingles, fieldstone, floors and the signs. Like the rest of the map art they
 * are painted into canvases once at startup; greyscale ones are tinted by their
 * material colour so one texture serves every house.
 */

const clamp01 = (v) => Math.min(1, Math.max(0, v))

/* ---------------------------------------------------------------------------
 * Ground
 * ------------------------------------------------------------------------- */

/** Mown suburban lawn: patchy greens, fine blades, the odd dry or clover spot. */
export const grassTexture = () =>
  cached('acres:grass', () => {
    const rand = seededRandom(301)
    const fbm = makeFbm(rand, 4, 5)
    const blades = makeNoise(256, rand)
    const fine = makeNoise(128, rand)
    const dark = hex('#3f6a26')
    const mid = hex('#5f8f34')
    const light = hex('#86ad4a')
    const dry = hex('#a9a25a')
    const c = paint(512, (u, v) => {
      const n = fbm(u, v)
      const b = blades(u, v * 0.35)
      let col = mix(dark, mid, clamp01(n * 1.5 - 0.15))
      col = mix(col, light, clamp01((b - 0.55) * 1.6) * 0.6)
      // Mower stripes, very faint.
      const stripe = Math.sin(u * Math.PI * 4) * 0.5 + 0.5
      col = mix(col, light, stripe * 0.06)
      const f = fine(u, v)
      if (n > 0.66) col = mix(col, dry, (n - 0.66) * 1.6)
      return mix(col, [col[0] * 0.75, col[1] * 0.78, col[2] * 0.7], f * 0.35)
    })
    return finish(c)
  })

/** Dry desert dirt past the yards: pale dust with sparse scrub. */
export const dirtTexture = () =>
  cached('acres:dirt', () => {
    const rand = seededRandom(313)
    const fbm = makeFbm(rand, 4, 5)
    const grain = makeNoise(128, rand)
    const tufts = makeNoise(48, rand)
    const a = hex('#c9b48c')
    const b = hex('#a48b63')
    const scrub = hex('#7c7a48')
    const c = paint(512, (u, v) => {
      const n = fbm(u, v)
      let col = mix(b, a, clamp01(n * 1.3 - 0.1 + (grain(u, v) - 0.5) * 0.25))
      const t = tufts(u, v)
      if (t > 0.72) col = mix(col, scrub, (t - 0.72) * 2.2)
      return col
    })
    return finish(c)
  })

/** Worn asphalt: aggregate speckle, tar-sealed cracks, darker wheel tracks. */
export const asphaltTexture = () =>
  cached('acres:asphalt', () => {
    const rand = seededRandom(331)
    const fbm = makeFbm(rand, 4, 4)
    const speck = makeNoise(256, rand)
    const c = paint(512, (u, v) => {
      const n = fbm(u, v)
      const s = speck(u, v)
      let g = 70 + n * 26
      if (s > 0.8) g += (s - 0.8) * 160
      if (s < 0.12) g -= 18
      return [g, g * 1.0, g * 1.02]
    })
    const ctx = c.getContext('2d')
    // Hairline cracks: short wandering runs, sealed with tar.
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (let i = 0; i < 7; i++) {
      ctx.strokeStyle = `rgba(28,28,30,${0.22 + rand() * 0.15})`
      ctx.lineWidth = 0.8 + rand() * 1.2
      let x = rand() * 512
      let y = rand() * 512
      let a = rand() * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(x, y)
      for (let k = 0; k < 26; k++) {
        a += (rand() - 0.5) * 0.9
        x += Math.cos(a) * 5
        y += Math.sin(a) * 5
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    // Oil drips.
    for (let i = 0; i < 6; i++) {
      const x = rand() * 512
      const y = rand() * 512
      const g = ctx.createRadialGradient(x, y, 0, x, y, 20 + rand() * 30)
      g.addColorStop(0, 'rgba(15,15,18,0.35)')
      g.addColorStop(1, 'rgba(15,15,18,0)')
      ctx.fillStyle = g
      ctx.fillRect(x - 60, y - 60, 120, 120)
    }
    return finish(c)
  })

/** Poured sidewalk slabs: one slab per tile, scored joints at the edges. */
export const sidewalkTexture = () =>
  cached('acres:sidewalk', () => {
    const rand = seededRandom(337)
    const fbm = makeFbm(rand, 4, 4)
    const pits = makeNoise(96, rand)
    const light = hex('#d3cec2')
    const dark = hex('#aaa496')
    const c = paint(256, (u, v, x, y) => {
      let col = mix(dark, light, clamp01(fbm(u, v) * 1.4 - 0.1))
      if (pits(u, v) > 0.85) col = mix(col, [120, 114, 104], 0.4)
      // Joints on two edges (the neighbouring tiles supply the other two).
      if (x < 3 || y < 3) col = mix(col, [96, 90, 82], 0.75)
      return col
    })
    return finish(c)
  })

/* ---------------------------------------------------------------------------
 * Buildings (greyscale ones are tinted per material)
 * ------------------------------------------------------------------------- */

/** Painted lap siding: eight boards a tile, each casting a thin shadow line under its lap. */
export const sidingTexture = () =>
  cached('acres:siding', () => {
    const rand = seededRandom(347)
    const grain = makeNoise(64, rand)
    const fbm = makeFbm(rand, 4, 3)
    const c = paint(256, (u, v) => {
      const board = (v * 8) % 1
      let g = 0.93 - board * 0.08
      if (board > 0.9) g = 0.62
      else if (board > 0.86) g = 0.8
      g *= 0.94 + grain(u * 0.3, v * 8) * 0.06 + (fbm(u, v) - 0.5) * 0.06
      return [g * 255, g * 255, g * 255]
    })
    return finish(c)
  })

/** Asphalt shingles: staggered rows of tabs, each a slightly different shade. */
export const shingleTexture = () =>
  cached('acres:shingles', () => {
    const rand = seededRandom(353)
    const fine = makeNoise(128, rand)
    const shades = Array.from({ length: 256 }, () => 0.78 + rand() * 0.22)
    const c = paint(256, (u, v) => {
      const row = Math.floor(v * 8)
      const rv = (v * 8) % 1
      const shift = row % 2 ? 0.5 : 0
      const col = Math.floor(u * 6 + shift)
      const cu = (u * 6 + shift) % 1
      let g = shades[(row * 7 + col * 13) & 255]
      if (rv > 0.86) g *= 0.55
      if (cu < 0.03) g *= 0.6
      g *= 0.88 + fine(u, v) * 0.18
      return [g * 255, g * 255, g * 255]
    })
    return finish(c)
  })

/** Fieldstone: rounded stones of mixed greys and tans set in pale mortar. */
export const stoneTexture = () =>
  cached('acres:stone', () => {
    const rand = seededRandom(359)
    const size = 512
    const c = canvas(size)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#b9b2a4'
    ctx.fillRect(0, 0, size, size)
    const tones = ['#8d877d', '#a39a8a', '#7a7368', '#b0a690', '#968a78', '#6f6a62', '#a8a195', '#8b7f6c']
    const stones = []
    for (let row = 0; row < 7; row++) {
      let x = rand() * 40
      while (x < size) {
        const w = 50 + rand() * 60
        stones.push({ x: x + w / 2, y: row * (size / 7) + size / 14 + (rand() - 0.5) * 12, w, h: size / 7 - 8 - rand() * 10 })
        x += w + 6 + rand() * 6
      }
    }
    for (const s of stones) {
      for (const ox of [-size, 0, size]) {
        for (const oy of [-size, 0, size]) {
          const cx = s.x + ox
          const cy = s.y + oy
          if (cx < -80 || cx > size + 80 || cy < -80 || cy > size + 80) continue
          ctx.fillStyle = tones[Math.floor(((s.x * 7 + s.y * 13) % 8 + 8) % 8)]
          ctx.beginPath()
          const n = 9
          for (let k = 0; k < n; k++) {
            const a = (k / n) * Math.PI * 2
            const r = 0.86 + ((Math.sin(s.x * 3.1 + k * 2.3) + 1) / 2) * 0.14
            ctx.lineTo(cx + Math.cos(a) * (s.w / 2) * r, cy + Math.sin(a) * (s.h / 2) * r)
          }
          ctx.closePath()
          ctx.fill()
          // Lit top edge, shaded bottom.
          ctx.strokeStyle = 'rgba(255,255,255,0.12)'
          ctx.lineWidth = 3
          ctx.stroke()
          const g = ctx.createLinearGradient(cx, cy - s.h / 2, cx, cy + s.h / 2)
          g.addColorStop(0, 'rgba(255,255,255,0.08)')
          g.addColorStop(1, 'rgba(0,0,0,0.22)')
          ctx.fillStyle = g
          ctx.fill()
        }
      }
    }
    return finish(c)
  })

/** Red brick for the cottage's base and the pillars' caps. */
export const brickRedTexture = () =>
  cached('acres:brick', () => {
    const rand = seededRandom(367)
    const tones = Array.from({ length: 64 }, () => mix(hex('#8e3b2b'), hex('#b5583c'), rand()))
    const c = paint(256, (u, v) => {
      const row = Math.floor(v * 8)
      const rv = (v * 8) % 1
      const cu = (u * 4 + (row % 2) * 0.5) % 1
      const col = Math.floor(u * 4 + (row % 2) * 0.5)
      if (rv > 0.88 || cu > 0.95) return [196, 186, 170]
      return tones[(row * 5 + col * 3) & 63]
    })
    return finish(c)
  })

/** Oak floorboards, staggered. */
export const woodFloorTexture = () =>
  cached('acres:woodFloor', () => {
    const rand = seededRandom(373)
    const grain = makeNoise(16, rand)
    const fine = makeNoise(128, rand)
    const offsets = Array.from({ length: 8 }, () => rand())
    const a = hex('#8a5a32')
    const b = hex('#b98754')
    const c = paint(256, (u, v) => {
      const plank = Math.floor(v * 8)
      const along = (u + offsets[plank]) % 1
      const g = Math.sin((u * 40 + grain(u, v * 8) * 6 + plank * 2.1) * Math.PI) * 0.5 + 0.5
      let col = mix(a, b, g * 0.5 + fine(u, v) * 0.3 + offsets[plank] * 0.2)
      if ((v * 8) % 1 > 0.94 || along < 0.01) col = mix(col, [52, 34, 20], 0.7)
      return col
    })
    return finish(c)
  })

/** Black and white kitchen checkerboard. */
export const checkerTexture = () =>
  cached('acres:checker', () => {
    const rand = seededRandom(379)
    const n = makeNoise(64, rand)
    const c = paint(256, (u, v) => {
      const on = (Math.floor(u * 8) + Math.floor(v * 8)) % 2 === 0
      const grout = (u * 8) % 1 < 0.04 || (v * 8) % 1 < 0.04
      const w = n(u, v) * 18
      if (grout) return [150, 146, 140]
      return on ? [238 - w, 234 - w, 226 - w] : [38 + w, 40 + w, 44 + w]
    })
    return finish(c)
  })

/** Speckled terrazzo for the modern house. */
export const terrazzoTexture = () =>
  cached('acres:terrazzo', () => {
    const rand = seededRandom(383)
    const c = canvas(256)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#d9d4ca'
    ctx.fillRect(0, 0, 256, 256)
    const chips = ['#9a8f80', '#c27b58', '#6f7f84', '#efe9de', '#4c4a46', '#b9a17a']
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = chips[Math.floor(rand() * chips.length)]
      const r = 1 + rand() * 3
      const x = rand() * 256
      const y = rand() * 256
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    return finish(c)
  })

/** Low-pile carpet (greyscale, tinted). */
export const carpetTexture = () =>
  cached('acres:carpet', () => {
    const rand = seededRandom(389)
    const n = makeNoise(128, rand)
    const fbm = makeFbm(rand, 4, 3)
    const c = paint(128, (u, v) => {
      const g = 0.82 + n(u, v) * 0.12 + (fbm(u, v) - 0.5) * 0.08
      return [g * 255, g * 255, g * 255]
    })
    return finish(c)
  })

/** Painted plaster (greyscale, tinted per room). */
export const plasterTexture = () =>
  cached('acres:plaster', () => {
    const rand = seededRandom(397)
    const fbm = makeFbm(rand, 4, 4)
    const c = paint(128, (u, v) => {
      const g = 0.9 + (fbm(u, v) - 0.5) * 0.08
      return [g * 255, g * 255, g * 255]
    })
    return finish(c)
  })

/** Vertical cedar fence boards with dark gaps and the nails. */
export const fenceBoardTexture = () =>
  cached('acres:fence', () => {
    const rand = seededRandom(401)
    const grain = makeNoise(24, rand)
    const fbm = makeFbm(rand, 4, 4)
    const tones = Array.from({ length: 8 }, () => rand())
    const a = hex('#7b5a3c')
    const b = hex('#a8845c')
    const c = paint(256, (u, v) => {
      const board = Math.floor(u * 8)
      const bu = (u * 8) % 1
      if (bu > 0.94) return [40, 30, 22]
      const g = Math.sin((v * 22 + grain(u * 8, v) * 4 + board) * Math.PI) * 0.5 + 0.5
      let col = mix(a, b, g * 0.35 + tones[board] * 0.45 + fbm(u, v) * 0.2)
      // Silvered and weathered toward the bottom.
      col = mix(col, [130, 124, 112], Math.max(0, v - 0.7) * 0.6)
      return col
    })
    return finish(c)
  })

/** Dense leaves for hedges and tree crowns. */
export const leafTexture = () =>
  cached('acres:leaves', () => {
    const rand = seededRandom(409)
    const size = 256
    const c = canvas(size)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#2c4a1c'
    ctx.fillRect(0, 0, size, size)
    const greens = ['#3d6526', '#4f7a2f', '#5f8c37', '#6f9a40', '#3a5e24', '#7ea64a']
    for (let i = 0; i < 2600; i++) {
      const x = rand() * size
      const y = rand() * size
      const r = 2.5 + rand() * 4.5
      const a = rand() * Math.PI
      ctx.fillStyle = greens[Math.floor(rand() * greens.length)]
      for (const ox of [-size, 0, size]) {
        for (const oy of [-size, 0, size]) {
          if (x + ox < -10 || x + ox > size + 10 || y + oy < -10 || y + oy > size + 10) continue
          ctx.beginPath()
          ctx.ellipse(x + ox, y + oy, r, r * 0.55, a, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
    return finish(c)
  })

/** Light blue pool tiles with darker grout. */
export const poolTileTexture = () =>
  cached('acres:poolTile', () => {
    const rand = seededRandom(419)
    const n = makeNoise(64, rand)
    const c = paint(256, (u, v) => {
      const grout = (u * 8) % 1 < 0.05 || (v * 8) % 1 < 0.05
      if (grout) return [170, 196, 204]
      const w = n(u, v) * 22
      return [118 + w, 186 + w, 206 + w]
    })
    return finish(c)
  })

/** Corrugated cladding (greyscale), vertical ribs, for the modern house's panels. */
export const panelTexture = () =>
  cached('acres:panel', () => {
    const rand = seededRandom(421)
    const fbm = makeFbm(rand, 4, 3)
    const c = paint(256, (u, v, x) => {
      const rib = (x % 32) / 32
      let g = 0.92
      if (rib < 0.06) g = 0.7
      else if (rib < 0.1) g = 1.0
      g *= 0.95 + (fbm(u, v) - 0.5) * 0.1
      return [g * 255, g * 255, g * 255]
    })
    return finish(c)
  })

/* ---------------------------------------------------------------------------
 * Signs and decals
 * ------------------------------------------------------------------------- */

const ROUNDED = (ctx, x, y, w, h, r) => {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Little atom: nucleus and three orbits. */
function atom(ctx, x, y, r, color, width = 6) {
  ctx.save()
  ctx.translate(x, y)
  ctx.strokeStyle = color
  ctx.lineWidth = width
  for (const a of [0, Math.PI / 3, -Math.PI / 3]) {
    ctx.save()
    ctx.rotate(a)
    ctx.beginPath()
    ctx.ellipse(0, 0, r, r * 0.36, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** The town sign: a retro billboard. */
export const welcomeSignTexture = () =>
  cached('acres:welcome', () => {
    const c = canvas(1024)
    c.height = 448
    const ctx = c.getContext('2d')
    const W = 1024
    const H = 448
    // Weathered teal board with a cream panel.
    ctx.fillStyle = '#2f7f77'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#f1e6c8'
    ROUNDED(ctx, 26, 26, W - 52, H - 52, 34)
    ctx.fill()
    ctx.strokeStyle = '#c8452f'
    ctx.lineWidth = 10
    ROUNDED(ctx, 44, 44, W - 88, H - 88, 26)
    ctx.stroke()
    // Starburst behind the name.
    ctx.save()
    ctx.translate(808, 120)
    ctx.fillStyle = '#e5a83a'
    for (let i = 0; i < 16; i++) {
      ctx.rotate(Math.PI / 8)
      ctx.beginPath()
      ctx.moveTo(0, -8)
      ctx.lineTo(70, 0)
      ctx.lineTo(0, 8)
      ctx.fill()
    }
    ctx.restore()
    atom(ctx, 170, 236, 95, '#2f7f77', 9)
    ctx.fillStyle = '#2f3b3a'
    ctx.textAlign = 'center'
    ctx.font = 'italic 700 46px Georgia, "Times New Roman", serif'
    ctx.fillText('Welcome to', 620, 132)
    ctx.fillStyle = '#c8452f'
    ctx.font = '900 112px "Arial Black", "Trebuchet MS", Arial, sans-serif'
    ctx.fillText('ATOMIC', 620, 250)
    ctx.fillText('ACRES', 620, 352)
    ctx.fillStyle = '#2f3b3a'
    ctx.font = '700 28px "Trebuchet MS", Arial, sans-serif'
    ctx.fillText('A MODERN TOWN FOR THE ATOMIC AGE', 512, 404)
    // Sun-bleached grime.
    const rand = seededRandom(431)
    for (let k = 0; k < 500; k++) {
      ctx.fillStyle = `rgba(${90 + rand() * 40},${80 + rand() * 30},${60 + rand() * 20},${rand() * 0.08})`
      ctx.fillRect(rand() * W, rand() * H, 3 + rand() * 18, 2 + rand() * 10)
    }
    return finish(c, { repeat: false })
  })

/** Green street-name blade. */
export const streetBladeTexture = (name) =>
  cached(`acres:blade:${name}`, () => {
    const c = canvas(512)
    c.height = 96
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#1f6b3d'
    ctx.fillRect(0, 0, 512, 96)
    ctx.strokeStyle = '#f2f2ea'
    ctx.lineWidth = 5
    ROUNDED(ctx, 8, 8, 496, 80, 10)
    ctx.stroke()
    ctx.fillStyle = '#f2f2ea'
    ctx.font = '700 54px "Arial Narrow", Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(name, 256, 51)
    return finish(c, { repeat: false })
  })

/** The moving company on the trailer's sides. */
export const trailerLogoTexture = () =>
  cached('acres:trailerLogo', () => {
    const c = canvas(1024)
    c.height = 256
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, 1024, 256)
    ctx.fillStyle = '#b7322b'
    ctx.font = 'italic 900 118px Georgia, "Times New Roman", serif'
    ctx.textAlign = 'center'
    ctx.fillText('Sunbelt', 512, 118)
    ctx.fillStyle = '#2d2d2d'
    ctx.font = '700 46px "Trebuchet MS", Arial, sans-serif'
    ctx.fillText('MOVING  &  STORAGE', 512, 182)
    ctx.font = '700 26px "Trebuchet MS", Arial, sans-serif'
    ctx.fillText('COAST TO COAST · SINCE 1938', 512, 228)
    // Swoosh under the name.
    ctx.strokeStyle = '#b7322b'
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.moveTo(250, 140)
    ctx.quadraticCurveTo(512, 158, 780, 132)
    ctx.stroke()
    return finish(c, { repeat: false })
  })

/** Black lettering for the bus: SCHOOL BUS over the windscreen and back. */
export const busSignTexture = () =>
  cached('acres:busSign', () => {
    const c = canvas(512)
    c.height = 96
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#f1b322'
    ctx.fillRect(0, 0, 512, 96)
    ctx.fillStyle = '#141414'
    ctx.font = '900 64px "Arial Black", Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('SCHOOL BUS', 256, 52)
    return finish(c, { repeat: false })
  })

/** The bus's side: district name under the windows. */
export const busSideTexture = () =>
  cached('acres:busSide', () => {
    const c = canvas(1024)
    c.height = 64
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, 1024, 64)
    ctx.fillStyle = '#151515'
    ctx.font = '700 40px "Trebuchet MS", Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('ATOMIC ACRES SCHOOL DISTRICT  No. 7', 512, 34)
    return finish(c, { repeat: false })
  })

/** Road closed sign for the barricade. */
export const roadClosedTexture = () =>
  cached('acres:roadClosed', () => {
    const c = canvas(512)
    c.height = 160
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#f2efe6'
    ctx.fillRect(0, 0, 512, 160)
    ctx.fillStyle = '#141414'
    ctx.font = '900 76px "Arial Black", Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('ROAD CLOSED', 256, 84)
    ctx.strokeStyle = '#141414'
    ctx.lineWidth = 8
    ctx.strokeRect(10, 10, 492, 140)
    return finish(c, { repeat: false })
  })

/** Orange and white barricade stripes. */
export const barricadeStripeTexture = () =>
  cached('acres:stripes', () => {
    const c = paint(128, (u, v) => (((u + v) * 4) % 1 < 0.5 ? [232, 112, 36] : [242, 240, 232]))
    return finish(c)
  })

/** The clock on the water tower. */
export const clockTexture = () =>
  cached('acres:clock', () => {
    const c = canvas(512)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#f3efe2'
    ctx.beginPath()
    ctx.arc(256, 256, 250, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = 16
    ctx.strokeStyle = '#2c2c2c'
    ctx.stroke()
    ctx.fillStyle = '#2c2c2c'
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      ctx.save()
      ctx.translate(256 + Math.sin(a) * 200, 256 - Math.cos(a) * 200)
      ctx.rotate(a)
      ctx.fillRect(-7, -24, 14, i % 3 ? 34 : 48)
      ctx.restore()
    }
    // A quarter to eight.
    const hand = (a, len, w) => {
      ctx.save()
      ctx.translate(256, 256)
      ctx.rotate(a)
      ctx.fillRect(-w / 2, -len, w, len + 20)
      ctx.restore()
    }
    hand((7.75 / 12) * Math.PI * 2, 120, 18)
    hand((45 / 60) * Math.PI * 2, 180, 12)
    ctx.beginPath()
    ctx.arc(256, 256, 18, 0, Math.PI * 2)
    ctx.fill()
    return finish(c, { repeat: false })
  })

/** Yellow and black fallout shelter sign. */
export const shelterSignTexture = () =>
  cached('acres:shelter', () => {
    const c = canvas(256)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#f0c419'
    ctx.fillRect(0, 0, 256, 256)
    ctx.fillStyle = '#141414'
    ctx.beginPath()
    ctx.arc(128, 104, 20, 0, Math.PI * 2)
    ctx.fill()
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 3
      ctx.beginPath()
      ctx.moveTo(128, 104)
      ctx.arc(128, 104, 74, a - 0.5, a + 0.5)
      ctx.closePath()
      ctx.fill()
    }
    ctx.fillStyle = '#f0c419'
    ctx.beginPath()
    ctx.arc(128, 104, 28, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#141414'
    ctx.beginPath()
    ctx.arc(128, 104, 18, 0, Math.PI * 2)
    ctx.fill()
    ctx.font = '900 30px "Arial Black", Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('FALLOUT', 128, 214)
    ctx.fillText('SHELTER', 128, 244)
    return finish(c, { repeat: false })
  })

/** Test site warning for the perimeter fence. */
export const warningSignTexture = () =>
  cached('acres:warning', () => {
    const c = canvas(512)
    c.height = 320
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#efe9dc'
    ctx.fillRect(0, 0, 512, 320)
    ctx.fillStyle = '#b52a22'
    ctx.fillRect(0, 0, 512, 92)
    ctx.fillStyle = '#efe9dc'
    ctx.font = '900 66px "Arial Black", Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('WARNING', 256, 50)
    ctx.fillStyle = '#1b1b1b'
    ctx.font = '800 40px "Trebuchet MS", Arial, sans-serif'
    ctx.fillText('NUCLEAR TEST SITE', 256, 150)
    ctx.font = '700 30px "Trebuchet MS", Arial, sans-serif'
    ctx.fillText('NO TRESPASSING BEYOND', 256, 210)
    ctx.fillText('THIS POINT', 256, 252)
    return finish(c, { repeat: false })
  })

/** White star for the army jeep's hood. */
export const starTexture = () =>
  cached('acres:star', () => {
    const c = canvas(256)
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, 256, 256)
    ctx.fillStyle = '#e9e6da'
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 46 : 112
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      ctx.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r)
    }
    ctx.closePath()
    ctx.fill()
    ctx.lineWidth = 10
    ctx.strokeStyle = '#e9e6da'
    ctx.beginPath()
    ctx.arc(128, 128, 122, 0, Math.PI * 2)
    ctx.stroke()
    return finish(c, { repeat: false })
  })

/** Cardboard for the moving boxes (with a strip of tape). */
export const cardboardTexture = () =>
  cached('acres:cardboard', () => {
    const rand = seededRandom(433)
    const n = makeNoise(64, rand)
    const c = paint(128, (u, v) => {
      const w = n(u, v) * 16
      if (Math.abs(u - 0.5) < 0.06) return [196 - w, 170 - w, 122 - w]
      return [178 - w, 140 - w, 92 - w]
    })
    return finish(c)
  })
