import { seededRandom } from '../../../shared/math.js'
import { cached, canvas, finish, hex, makeFbm, makeNoise, mix, paint } from '../textures.js'

/**
 * Procedural textures for Palmwood: plywood sheets, tarps, packed red earth,
 * tropical grass, the rutted mud of the track, one atlas for every leaf in the
 * map (banana, coconut palm, grass tufts), safety mesh, camo netting, painted
 * drums and the stencilled marks on the walls. Painted into canvases once, like
 * the other maps'; the pale ones are tinted by their material colour.
 */

const clamp01 = (v) => Math.min(1, Math.max(0, v))

/* ---------------------------------------------------------------------------
 * Walls
 * ------------------------------------------------------------------------- */

/**
 * Plywood: two 1.22 x 2.44 m sheets side by side per tile (2.44 m), each its
 * own shade, with long grain, the odd football patch, nail rows over the studs,
 * dark seams, weathering streaks from the top and a damp stain at the foot.
 */
export const plywoodTexture = () =>
  cached('pw:plywood', () => {
    const rand = seededRandom(5101)
    const grain = makeNoise(24, rand)
    const fine = makeNoise(160, rand)
    const fbm = makeFbm(rand, 4, 4)
    const streak = makeNoise(40, rand)
    const tones = [hex('#d9b78a'), hex('#c9a271'), hex('#e0c194'), hex('#cfa97a')]
    const S = 512
    const c = paint(S, (u, v, x, y) => {
      const sheet = u < 0.5 ? 0 : 1
      const row = v < 0.5 ? 0 : 1
      let col = tones[(sheet + row * 2) % tones.length]
      // Face grain runs up the sheet (the long way), gently wavy.
      const g = grain(u * 3 + Math.sin(v * 9 + sheet * 2) * 0.05 + sheet * 0.37, v * 0.22 + row * 0.5)
      const f = fine(u * 0.2, v)
      col = mix(col, [col[0] * 0.8, col[1] * 0.75, col[2] * 0.66], clamp01((g - 0.4) * 1.2) * 0.42 + f * 0.1)
      // Weathering: grey streaks running down from the top of each sheet.
      const st = streak(u * 6, v * 0.35)
      const fromTop = 1 - (v % 0.5) * 2
      col = mix(col, [150, 140, 128], clamp01((st - 0.55) * 2.2) * 0.35 * fromTop)
      // Damp at the foot of the wall (the bottom of the tile).
      const n = fbm(u, v)
      col = mix(col, [110, 86, 60], clamp01((v - 0.86) * 5 + (n - 0.5) * 0.4) * 0.55)
      // Seams between sheets, nail rows over the studs (every 0.4 m).
      const su = (u * 2) % 1
      if (su < 0.006 || su > 0.994 || Math.abs(v - 0.5) < 0.004) col = mix(col, [70, 52, 36], 0.75)
      const stud = ((u * 2.44) / 0.4) % 1
      if ((stud < 0.012 || stud > 0.988) && (y % 18) < 3) col = mix(col, [64, 58, 52], 0.7)
      if (Math.abs(su - 0.012) < 0.004 && (y % 14) < 3) col = mix(col, [64, 58, 52], 0.7)
      return col
    })
    const ctx = c.getContext('2d')
    // Football patches (oval plugs) and a few knots.
    for (let i = 0; i < 9; i++) {
      const x = rand() * S
      const y = rand() * S
      ctx.fillStyle = `rgba(${150 + rand() * 40},${110 + rand() * 30},${70 + rand() * 20},0.55)`
      ctx.beginPath()
      ctx.ellipse(x, y, 7 + rand() * 4, 3 + rand() * 2, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = 'rgba(90,60,35,0.6)'
      ctx.beginPath()
      ctx.ellipse(rand() * S, rand() * S, 3 + rand() * 3, 2 + rand() * 2, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    return finish(c)
  })

/** Pale tarpaulin with folds and creases, a grommet hem along one edge (tinted per tarp). */
export const tarpTexture = () =>
  cached('pw:tarp', () => {
    const rand = seededRandom(5113)
    const fbm = makeFbm(rand, 3, 4)
    const crease = makeNoise(10, rand)
    const weave = makeNoise(200, rand)
    const c = paint(256, (u, v) => {
      const n = fbm(u, v)
      const k = crease(u * 1.2, v * 1.2)
      let g = 200 + n * 45 - Math.abs(k - 0.5) * 70
      g += (weave(u, v) - 0.5) * 10
      // Sun-faded patches.
      if (n > 0.66) g += (n - 0.66) * 80
      const hem = v > 0.96 ? 0.82 : 1
      return [g * hem, g * hem, g * hem]
    })
    const ctx = c.getContext('2d')
    ctx.fillStyle = 'rgba(210,205,190,0.9)'
    for (let x = 16; x < 256; x += 64) {
      ctx.beginPath()
      ctx.arc(x, 250, 3, 0, Math.PI * 2)
      ctx.fill()
    }
    return finish(c)
  })

/* ---------------------------------------------------------------------------
 * Ground
 * ------------------------------------------------------------------------- */

/** Packed red-brown earth with pebbles, leaf litter and damp patches. */
export const earthTexture = () =>
  cached('pw:earth', () => {
    const rand = seededRandom(5131)
    const fbm = makeFbm(rand, 4, 5)
    const grain = makeNoise(160, rand)
    const litter = makeNoise(64, rand)
    const light = hex('#c99a6a')
    const dark = hex('#9a6c48')
    const damp = hex('#7a5638')
    const leaf = hex('#8c7a3c')
    const c = paint(512, (u, v) => {
      const n = fbm(u, v)
      const g = grain(u, v)
      let col = mix(dark, light, clamp01(n * 1.35 - 0.12 + (g - 0.5) * 0.3))
      if (n < 0.36) col = mix(col, damp, (0.36 - n) * 2.2)
      const l = litter(u, v)
      if (l > 0.74) col = mix(col, leaf, (l - 0.74) * 2.4)
      if (g > 0.9) col = mix(col, [220, 200, 170], (g - 0.9) * 5)
      return col
    })
    return finish(c)
  })

/** Lush tropical grass: deep greens, sunlit yellow-green blades, the odd bare spot. */
export const jungleGrassTexture = () =>
  cached('pw:grass', () => {
    const rand = seededRandom(5147)
    const fbm = makeFbm(rand, 4, 5)
    const blades = makeNoise(220, rand)
    const clump = makeNoise(36, rand)
    const deep = hex('#3e6d24')
    const mid = hex('#5f9a2f')
    const sun = hex('#9cc44a')
    const bare = hex('#a07a50')
    const c = paint(512, (u, v) => {
      const n = fbm(u, v)
      const b = blades(u, v * 0.4)
      const k = clump(u, v)
      let col = mix(deep, mid, clamp01(n * 1.4 - 0.1))
      col = mix(col, sun, clamp01((b - 0.55) * 1.8) * 0.55 + clamp01(k - 0.7) * 0.4)
      if (n < 0.28) col = mix(col, bare, (0.28 - n) * 3)
      return col
    })
    return finish(c)
  })

/**
 * The track: rutted red mud along the length (v), across the width (u). Two
 * dark wheel ruts with tread marks and puddle stains, a grassy hump between
 * them, the edges fading into the earth either side.
 */
export const trackTexture = () =>
  cached('pw:track', () => {
    const rand = seededRandom(5153)
    const fbm = makeFbm(rand, 4, 5)
    const grain = makeNoise(140, rand)
    const tuft = makeNoise(48, rand)
    const mud = hex('#9c6a44')
    const rut = hex('#6e4a30')
    const wet = hex('#5a3c28')
    const grass = hex('#6c8f34')
    const edge = hex('#b48a5c')
    const c = paint(512, (u, v) => {
      const n = fbm(u, v)
      const g = grain(u, v)
      let col = mix(mud, edge, clamp01(n - 0.2) * 0.6)
      // Ruts, wandering a little.
      for (const c0 of [0.3, 0.7]) {
        const c1 = c0 + Math.sin(v * Math.PI * 2 * 2 + c0 * 9) * 0.02
        const d = Math.abs(u - c1)
        if (d < 0.07) {
          const k = 1 - d / 0.07
          col = mix(col, rut, k * 0.75)
          // Tread chevrons.
          if (d < 0.05 && ((v * 160 + Math.abs(u - c1) * 40) % 1) < 0.3) col = mix(col, wet, 0.35)
          if (n < 0.4) col = mix(col, wet, (0.4 - n) * 2 * k)
        }
      }
      // Grassy hump down the middle, grass creeping in at the edges.
      const t = tuft(u, v)
      const mid = 1 - Math.min(1, Math.abs(u - 0.5) / 0.1)
      const side = clamp01((Math.abs(u - 0.5) - 0.38) / 0.12)
      col = mix(col, grass, clamp01(t - 0.45) * 1.3 * mid + clamp01(t - 0.35) * side * 0.9)
      col = mix(col, edge, side * 0.35)
      return mix(col, [col[0] * 0.85, col[1] * 0.83, col[2] * 0.8], g * 0.3)
    })
    return finish(c)
  })

/* ---------------------------------------------------------------------------
 * Foliage atlas
 *
 * 1024 x 1024: top-left a fresh banana leaf, top-right an old torn one (both
 * drawn along x, petiole at the left), bottom-left a coconut palm frond (along
 * x), bottom-right a clump of grass blades (rooted at the bottom). One texture,
 * so every leaf in the map is one material and the batcher draws them together.
 * ------------------------------------------------------------------------- */

/** UV rectangles in the atlas: [u0, v0, u1, v1] (v up). */
export const FOLIAGE_UV = Object.freeze({
  banana: [0.0, 0.5, 0.5, 1.0],
  bananaOld: [0.5, 0.5, 1.0, 1.0],
  frond: [0.0, 0.0, 0.75, 0.5],
  tuft: [0.76, 0.0, 1.0, 0.5],
})

function drawBananaLeaf(ctx, x0, y0, w, h, rand, old) {
  const cy = y0 + h / 2
  const len = w * 0.96
  const half = h * 0.44
  // Leaf outline: broad paddle, blunt tip.
  const outline = (s) => {
    ctx.moveTo(x0 + 8, cy)
    ctx.bezierCurveTo(x0 + len * 0.15, cy + s * half * 0.9, x0 + len * 0.8, cy + s * half * 1.02, x0 + len, cy + s * half * 0.25)
    ctx.lineTo(x0 + len, cy)
  }
  const grd = ctx.createLinearGradient(0, cy - half, 0, cy + half)
  if (old) {
    grd.addColorStop(0, '#9a8a3a')
    grd.addColorStop(0.5, '#7f8a36')
    grd.addColorStop(1, '#a88c44')
  } else {
    grd.addColorStop(0, '#4f9a33')
    grd.addColorStop(0.5, '#3c8a2a')
    grd.addColorStop(1, '#5aa83a')
  }
  ctx.fillStyle = grd
  ctx.beginPath()
  outline(-1)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  outline(1)
  ctx.closePath()
  ctx.fill()
  // Lateral veins, nearly perpendicular to the midrib.
  ctx.lineWidth = 1.2
  for (let x = x0 + 20; x < x0 + len - 6; x += 6) {
    const t = (x - x0) / len
    const reach = half * Math.min(1, Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.5 + 0.2)) * (t > 0.85 ? (1 - t) * 6 : 1)
    ctx.strokeStyle = old ? 'rgba(140,120,60,0.35)' : 'rgba(110,170,70,0.35)'
    for (const s of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(x, cy)
      ctx.lineTo(x + 10, cy + s * reach * 0.95)
      ctx.stroke()
    }
  }
  // Tears along the veins, from the edge in (more on old leaves).
  ctx.globalCompositeOperation = 'destination-out'
  const tears = old ? 26 : 9
  for (let i = 0; i < tears; i++) {
    const x = x0 + 40 + rand() * (len - 60)
    const s = rand() < 0.5 ? -1 : 1
    const depth = half * (0.35 + rand() * 0.6)
    ctx.lineWidth = old ? 2.2 : 1.6
    ctx.beginPath()
    ctx.moveTo(x + 10, cy + s * half * 1.1)
    ctx.lineTo(x + 10 * (1 - depth / half), cy + s * (half * 1.1 - depth))
    ctx.stroke()
  }
  if (old) {
    // Ragged, eaten edges.
    for (let i = 0; i < 40; i++) {
      ctx.beginPath()
      ctx.arc(x0 + 30 + rand() * (len - 30), cy + (rand() < 0.5 ? -1 : 1) * half * (0.85 + rand() * 0.2), 3 + rand() * 6, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.globalCompositeOperation = 'source-over'
  // Browned margins on old leaves.
  if (old) {
    ctx.strokeStyle = 'rgba(120,80,40,0.55)'
    ctx.lineWidth = 6
    ctx.beginPath()
    outline(-1)
    ctx.stroke()
    ctx.beginPath()
    outline(1)
    ctx.stroke()
  }
  // Midrib.
  ctx.strokeStyle = old ? '#b9a85a' : '#b7cf6a'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(x0, cy)
  ctx.lineTo(x0 + len, cy)
  ctx.stroke()
}

function drawFrond(ctx, x0, y0, w, h, rand) {
  const cy = y0 + h / 2
  const len = w * 0.97
  // Leaflets: long tapering blades angled toward the tip, longest a third of
  // the way along, close together so the frond reads as a frond far off too.
  for (let i = 0; i < 58; i++) {
    const t = i / 58
    const x = x0 + 12 + t * (len - 24)
    const l = h * 0.48 * Math.sin(Math.min(1, t * 1.6 + 0.12) * Math.PI * 0.5) * (1 - t * 0.5) * (0.88 + rand() * 0.24)
    for (const s of [-1, 1]) {
      const tone = 0.82 + rand() * 0.3
      ctx.fillStyle = `rgb(${Math.round(66 * tone)},${Math.round(132 * tone)},${Math.round(42 * tone)})`
      const bx = x + l * 0.6
      const by = cy + s * l * 0.92
      const base = 7
      ctx.beginPath()
      ctx.moveTo(x - base, cy)
      ctx.quadraticCurveTo(x + l * 0.2, cy + s * l * 0.45, bx, by)
      ctx.quadraticCurveTo(x + l * 0.32, cy + s * l * 0.38, x + base, cy)
      ctx.closePath()
      ctx.fill()
    }
  }
  // Rachis.
  ctx.strokeStyle = '#8a8a3c'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.moveTo(x0, cy)
  ctx.lineTo(x0 + len, cy)
  ctx.stroke()
}

function drawTuft(ctx, x0, y0, w, h, rand) {
  for (let i = 0; i < 46; i++) {
    const bx = x0 + w * 0.5 + (rand() - 0.5) * w * 0.35
    const top = y0 + h * (0.15 + rand() * 0.45)
    const lean = (rand() - 0.5) * w * 0.9
    const tone = 0.8 + rand() * 0.4
    ctx.strokeStyle = `rgb(${Math.round(85 * tone)},${Math.round(150 * tone)},${Math.round(50 * tone)})`
    ctx.lineWidth = 3 + rand() * 3
    ctx.beginPath()
    ctx.moveTo(bx, y0 + h)
    ctx.quadraticCurveTo(bx + lean * 0.2, top + (y0 + h - top) * 0.4, bx + lean, top)
    ctx.stroke()
  }
}

export const foliageTexture = () =>
  cached('pw:foliage', () => {
    const rand = seededRandom(5171)
    const S = 1024
    const c = canvas(S)
    const ctx = c.getContext('2d')
    ctx.lineCap = 'round'
    // Canvas y runs down; atlas v runs up (top half of the canvas is v 0.5..1).
    drawBananaLeaf(ctx, 0, 0, 512, 512, rand, false)
    drawBananaLeaf(ctx, 512, 0, 512, 512, rand, true)
    drawFrond(ctx, 0, 512, 768, 512, rand)
    drawTuft(ctx, 778, 512, 246, 512, rand)
    const t = finish(c, { repeat: false })
    t.anisotropy = 4
    return t
  })

/** Coconut palm bark: grey-brown with the rings of old leaf scars. */
export const palmBarkTexture = () =>
  cached('pw:palmBark', () => {
    const rand = seededRandom(5179)
    const fbm = makeFbm(rand, 4, 4)
    const fine = makeNoise(90, rand)
    const c = paint(128, (u, v) => {
      const ring = Math.abs(((v * 8 + fbm(u, v) * 0.4) % 1) - 0.5) * 2
      let col = mix(hex('#6a5a48'), hex('#9a8a74'), fbm(u * 2, v) * 0.8 + fine(u, v) * 0.2)
      if (ring > 0.82) col = mix(col, [60, 48, 38], (ring - 0.82) * 4)
      return col
    })
    return finish(c)
  })

/** Banana pseudo-stem: green streaked with brown, peeling sheaths. */
export const bananaStemTexture = () =>
  cached('pw:bananaStem', () => {
    const rand = seededRandom(5189)
    const streak = makeNoise(40, rand)
    const fbm = makeFbm(rand, 3, 4)
    const c = paint(128, (u, v) => {
      const s = streak(u * 3, v * 0.2)
      let col = mix(hex('#5f7f34'), hex('#8aa24a'), s)
      const n = fbm(u, v)
      if (n > 0.6) col = mix(col, hex('#7a5a36'), (n - 0.6) * 2.2)
      return col
    })
    return finish(c)
  })

/* ---------------------------------------------------------------------------
 * Netting, mesh, drums, marks
 * ------------------------------------------------------------------------- */

/** Orange safety mesh: oval holes in a plastic net (alpha-tested). One tile per metre. */
export const safetyMeshTexture = () =>
  cached('pw:mesh', () => {
    const c = paint(128, (u, v) => {
      const cu = (u * 10) % 1
      const cv = ((v * 6) + (Math.floor(u * 10) % 2) * 0.5) % 1
      const d = Math.hypot((cu - 0.5) / 0.38, (cv - 0.5) / 0.42)
      return d < 1 ? [0, 0, 0, 0] : [236, 110, 34, 255]
    })
    return finish(c)
  })

/** Green camouflage netting: leafy blotches with holes (alpha-tested). */
export const jungleCamoTexture = () =>
  cached('pw:camo', () => {
    const rand = seededRandom(5197)
    const fbm = makeFbm(rand, 5, 4)
    const holes = makeNoise(20, rand)
    const c = paint(256, (u, v) => {
      const n = fbm(u, v)
      const h = holes(u, v)
      const col = n < 0.42 ? hex('#3c4a26') : n < 0.55 ? hex('#5f6e34') : n < 0.68 ? hex('#4a4a2c') : hex('#7d8248')
      return [...col, h > 0.6 ? 0 : 255]
    })
    return finish(c)
  })

/** A steel drum's side (u round, v up): ribs, a painted body, splashes of paint. */
export const drumTexture = () =>
  cached('pw:drum', () => {
    const rand = seededRandom(5209)
    const fbm = makeFbm(rand, 4, 3)
    const blue = hex('#2f6fae')
    const c = paint(256, (u, v) => {
      const n = fbm(u, v)
      let col = mix(blue, hex('#4f8ac4'), n * 0.6)
      // Rolling hoops a third and two thirds up.
      for (const r of [0.33, 0.67]) {
        const d = Math.abs(v - r)
        if (d < 0.03) col = mix(col, [col[0] * 0.6, col[1] * 0.6, col[2] * 0.6], 1 - d / 0.03)
      }
      if (v < 0.04 || v > 0.96) col = mix(col, [60, 64, 70], 0.6)
      return col
    })
    const ctx = c.getContext('2d')
    const splats = ['#e8d23a', '#7bd145', '#f08a2c', '#e8d23a', '#58c7d8']
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = splats[i % splats.length]
      const x = rand() * 256
      const y = 30 + rand() * 196
      const r = 3 + rand() * 7
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
      for (let k = 0; k < 5; k++) {
        const a = rand() * Math.PI * 2
        ctx.beginPath()
        ctx.arc(x + Math.cos(a) * r * 1.6, y + Math.sin(a) * r * 1.6, r * 0.3, 0, Math.PI * 2)
        ctx.fill()
      }
      // A drip.
      ctx.fillRect(x - 1, y, 2, 6 + rand() * 14)
    }
    return finish(c)
  })

/** Glyphs stencilled on walls, in a 4 x 2 atlas: a red ring round each. */
export const MARK_GLYPHS = Object.freeze(['1', '2', '3', 'A', 'B', 'C', 'Z', '!'])
export const markTexture = () =>
  cached('pw:marks', () => {
    const S = 512
    const c = canvas(S)
    const ctx = c.getContext('2d')
    const cell = S / 4
    MARK_GLYPHS.forEach((g, i) => {
      const cx = (i % 4) * cell + cell / 2
      const cy = Math.floor(i / 4) * cell + cell / 2
      ctx.strokeStyle = 'rgba(196,40,32,0.92)'
      ctx.lineWidth = 9
      ctx.beginPath()
      ctx.arc(cx, cy, cell * 0.38, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = 'rgba(196,40,32,0.92)'
      ctx.font = `bold ${Math.round(cell * 0.5)}px Impact, "Arial Black", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(g, cx, cy + 3)
      // Overspray and drips.
      for (let k = 0; k < 4; k++) ctx.fillRect(cx - cell * 0.2 + k * cell * 0.13, cy + cell * 0.34, 2, 8 + k * 3)
    })
    return finish(c, { repeat: false })
  })
