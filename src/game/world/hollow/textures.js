import { seededRandom } from '../../../shared/math.js'
import { cached, canvas, finish, hex, makeFbm, makeNoise, mix, paint } from '../textures.js'

/**
 * Procedural textures for Hollow Creek: the leaf-strewn autumn lawns, wet mud
 * along the creek, dark water, the church plaza's cobbles, straw, dead bark,
 * pine needles, pumpkin skin and the carved faces that glow in them, cobwebs,
 * the engraving on the headstones, and the soft round falloff the lamps and
 * pumpkins throw on the ground. Painted once into canvases like the other
 * maps'; the pale ones are tinted by their material colour.
 */

const clamp01 = (v) => Math.min(1, Math.max(0, v))

/* ---------------------------------------------------------------------------
 * Ground
 * ------------------------------------------------------------------------- */

/**
 * Autumn lawn: tired dark grass with bare patches, strewn with fallen leaves
 * (orange, rust, ochre, brown), one tile per 5 m.
 */
export const leafLawnTexture = () =>
  cached('hc:leafLawn', () => {
    const rand = seededRandom(9101)
    const fbm = makeFbm(rand, 4, 5)
    const blade = makeNoise(220, rand)
    const patch = makeNoise(9, rand)
    const S = 512
    const grass = hex('#56653a')
    const dry = hex('#7a6e44')
    const soil = hex('#4a3b2a')
    const c = paint(S, (u, v) => {
      const n = fbm(u, v)
      let col = mix(grass, dry, clamp01((n - 0.35) * 1.8))
      // Worn bare patches.
      col = mix(col, soil, clamp01((patch(u, v) - 0.66) * 3.2) * 0.75)
      // Blades: fine light and dark streaks.
      const b = blade(u, v * 0.5)
      col = mix(col, [col[0] * 1.25, col[1] * 1.25, col[2] * 1.1], clamp01((b - 0.6) * 2.5) * 0.5)
      col = mix(col, [col[0] * 0.65, col[1] * 0.65, col[2] * 0.6], clamp01((0.4 - b) * 2.5) * 0.5)
      return col
    })
    const ctx = c.getContext('2d')
    const leaf = ['#c8682a', '#a8401e', '#d79a34', '#7a3f22', '#b8822e', '#8a2e1a']
    for (let i = 0; i < 520; i++) {
      const x = rand() * S
      const y = rand() * S
      const r = 2.2 + rand() * 3.2
      const turn = rand() * Math.PI
      const color = leaf[Math.floor(rand() * leaf.length)]
      const alpha = 0.65 + rand() * 0.35
      // Drawn again across the edges it overlaps, so the tile stays seamless.
      for (const ox of [-S, 0, S]) {
        for (const oy of [-S, 0, S]) {
          if (x + ox < -r || x + ox > S + r || y + oy < -r || y + oy > S + r) continue
          ctx.save()
          ctx.translate(x + ox, y + oy)
          ctx.rotate(turn)
          ctx.fillStyle = color
          ctx.globalAlpha = alpha
          ctx.beginPath()
          ctx.ellipse(0, 0, r, r * 0.55, 0, 0, Math.PI * 2)
          ctx.fill()
          // A darker vein down the middle.
          ctx.globalAlpha = 0.4
          ctx.strokeStyle = '#3a2214'
          ctx.lineWidth = 0.6
          ctx.beginPath()
          ctx.moveTo(-r, 0)
          ctx.lineTo(r, 0)
          ctx.stroke()
          ctx.restore()
        }
      }
    }
    return finish(c)
  })

/** Wet dark mud with pebbles: the creek banks and the paths. */
export const mudTexture = () =>
  cached('hc:mud', () => {
    const rand = seededRandom(9113)
    const fbm = makeFbm(rand, 4, 5)
    const fine = makeNoise(160, rand)
    const S = 512
    const c = paint(S, (u, v) => {
      const n = fbm(u, v)
      const f = fine(u, v)
      let col = mix(hex('#3a2e24'), hex('#5a4a3a'), clamp01(n * 1.3 - 0.2))
      col = mix(col, [col[0] * 0.7, col[1] * 0.7, col[2] * 0.72], clamp01((0.45 - f) * 2) * 0.5)
      // Puddled, wetter dips.
      col = mix(col, hex('#2a231e'), clamp01((0.32 - n) * 4) * 0.6)
      return col
    })
    const ctx = c.getContext('2d')
    for (let i = 0; i < 260; i++) {
      const g = 90 + rand() * 60
      ctx.fillStyle = `rgba(${g},${g * 0.95},${g * 0.88},0.85)`
      ctx.beginPath()
      ctx.ellipse(rand() * S, rand() * S, 1.5 + rand() * 3, 1.2 + rand() * 2.2, rand() * 3, 0, Math.PI * 2)
      ctx.fill()
    }
    return finish(c)
  })

/** Creek water: dark, a little green, with ripple streaks running along it. */
export const waterTexture = () =>
  cached('hc:water', () => {
    const rand = seededRandom(9127)
    const flow = makeNoise(18, rand)
    const ripple = makeNoise(90, rand)
    const S = 256
    return finish(
      paint(S, (u, v) => {
        const f = flow(u * 0.5, v)
        const r = ripple(u * 4, v * 0.6)
        let col = mix(hex('#1c2a2c'), hex('#2e3e3a'), f)
        col = mix(col, hex('#5a6e70'), clamp01((r - 0.7) * 3) * 0.5)
        return col
      }),
    )
  })

/** Cobblestones for the church plaza: rounded grey setts in rows, dark joints, moss. */
export const cobbleTexture = () =>
  cached('hc:cobble', () => {
    const rand = seededRandom(9139)
    const fbm = makeFbm(rand, 4, 4)
    const S = 512
    const c = paint(S, (u, v) => {
      const n = fbm(u, v)
      return mix(hex('#2c2a28'), hex('#3a3634'), n)
    })
    const ctx = c.getContext('2d')
    const rows = 12
    const h = S / rows
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * h * 0.55
      for (let x = -h; x < S + h; x += h * 1.1) {
        const g = 92 + rand() * 46
        const w = h * (0.95 + rand() * 0.15)
        ctx.fillStyle = `rgb(${g},${g * 0.98},${g * 0.94})`
        ctx.beginPath()
        ctx.roundRect(x + off + 2, r * h + 2, w - 4, h - 4, 6)
        ctx.fill()
        if (rand() < 0.2) {
          ctx.fillStyle = 'rgba(70,90,50,0.45)'
          ctx.fillRect(x + off + 2, r * h + h - 7, w - 4, 4)
        }
      }
    }
    return finish(c)
  })

/** Light falling on the ground round a lamp or a pumpkin: a soft round falloff (tinted by the material). */
export const poolTexture = () =>
  cached('hc:pool', () => {
    const c = canvas(128)
    const ctx = c.getContext('2d')
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, 'rgba(255,255,255,0.95)')
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)')
    g.addColorStop(0.6, 'rgba(255,255,255,0.16)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
    return finish(c, { srgb: false, repeat: false })
  })

/* ---------------------------------------------------------------------------
 * Things
 * ------------------------------------------------------------------------- */

/** Straw: golden strands every which way, darker underneath. */
export const hayTexture = () =>
  cached('hc:hay', () => {
    const rand = seededRandom(9151)
    const S = 256
    const c = paint(S, () => hex('#a8873e'))
    const ctx = c.getContext('2d')
    for (let i = 0; i < 1400; i++) {
      const x = rand() * S
      const y = rand() * S
      const a = (rand() - 0.5) * 0.9
      const l = 6 + rand() * 16
      const g = rand()
      ctx.strokeStyle = g < 0.45 ? '#e2c46a' : g < 0.8 ? '#c9a24e' : '#7a5e2a'
      ctx.globalAlpha = 0.7
      ctx.lineWidth = 0.8 + rand()
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l)
      ctx.stroke()
    }
    return finish(c)
  })

/** Dead bark: grey-brown ridges running up the trunk, near black in the cracks. */
export const barkTexture = () =>
  cached('hc:bark', () => {
    const rand = seededRandom(9163)
    const ridge = makeNoise(26, rand)
    const fbm = makeFbm(rand, 4, 4)
    const S = 256
    return finish(
      paint(S, (u, v) => {
        const r = ridge(u * 3, v * 0.25)
        const n = fbm(u, v)
        let col = mix(hex('#3a322c'), hex('#6a5e52'), clamp01(n * 1.2 - 0.1))
        col = mix(col, hex('#1c1714'), clamp01((0.38 - r) * 3) * 0.85)
        return col
      }),
    )
  })

/** Pine needles over the cones: dark green streaks hanging down. */
export const needlesTexture = () =>
  cached('hc:needles', () => {
    const rand = seededRandom(9177)
    const streak = makeNoise(40, rand)
    const fbm = makeFbm(rand, 4, 4)
    const S = 256
    return finish(
      paint(S, (u, v) => {
        const s = streak(u * 4, v * 0.6)
        const n = fbm(u, v)
        let col = mix(hex('#1e2e22'), hex('#3a5236'), clamp01(n * 1.3 - 0.15))
        col = mix(col, hex('#0e1610'), clamp01((0.42 - s) * 3) * 0.7)
        col = mix(col, hex('#58704a'), clamp01((s - 0.72) * 4) * 0.4)
        return col
      }),
    )
  })

/** Pumpkin skin: orange with deep grooves between the ribs (u runs round), a paler bloom. */
export const pumpkinTexture = () =>
  cached('hc:pumpkin', () => {
    const rand = seededRandom(9181)
    const fbm = makeFbm(rand, 4, 4)
    const S = 256
    return finish(
      paint(S, (u, v) => {
        const rib = Math.abs(Math.sin(u * Math.PI * 9))
        const n = fbm(u, v)
        let col = mix(hex('#d8721e'), hex('#f09a34'), clamp01(n * 1.2 - 0.1))
        col = mix(col, hex('#8a3a0e'), clamp01((0.25 - rib) * 4) * 0.8)
        // Paler towards the top and bottom.
        col = mix(col, hex('#e8b060'), clamp01(Math.abs(v - 0.5) * 2 - 0.7) * 0.6)
        return col
      }),
    )
  })

/** Carved faces, four in a row, the holes glowing (alpha outside the cuts). */
export const FACE_COUNT = 4
export const faceTexture = () =>
  cached('hc:faces', () => {
    const W = 512
    const H = 128
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const ctx = c.getContext('2d')
    const glow = (x0) => {
      const g = ctx.createRadialGradient(x0 + 64, 70, 4, x0 + 64, 70, 60)
      g.addColorStop(0, '#fff2b0')
      g.addColorStop(0.5, '#ffb43a')
      g.addColorStop(1, '#e8601a')
      return g
    }
    const tri = (pts) => {
      ctx.beginPath()
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
      ctx.closePath()
      ctx.fill()
    }
    for (let i = 0; i < FACE_COUNT; i++) {
      const x = i * 128
      ctx.fillStyle = glow(x)
      if (i === 0) {
        // Classic: triangle eyes, triangle nose, toothy grin.
        tri([[x + 30, 52], [x + 52, 52], [x + 41, 32]])
        tri([[x + 76, 52], [x + 98, 52], [x + 87, 32]])
        tri([[x + 58, 66], [x + 70, 66], [x + 64, 56]])
        ctx.beginPath()
        ctx.moveTo(x + 22, 78)
        ctx.quadraticCurveTo(x + 64, 118, x + 106, 78)
        ctx.quadraticCurveTo(x + 64, 96, x + 22, 78)
        ctx.fill()
        ctx.clearRect(x + 48, 82, 8, 8)
        ctx.clearRect(x + 72, 82, 8, 8)
      } else if (i === 1) {
        // Angry: slanted eyes, a jagged mouth.
        tri([[x + 26, 40], [x + 54, 50], [x + 30, 58]])
        tri([[x + 102, 40], [x + 74, 50], [x + 98, 58]])
        tri([[x + 60, 60], [x + 68, 60], [x + 64, 70]])
        ctx.beginPath()
        const pts = [[x + 24, 80], [x + 36, 92], [x + 46, 82], [x + 56, 96], [x + 64, 84], [x + 72, 96], [x + 82, 82], [x + 92, 92], [x + 104, 80], [x + 96, 104], [x + 32, 104]]
        pts.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)))
        ctx.closePath()
        ctx.fill()
      } else if (i === 2) {
        // Round eyes, an O mouth: surprised.
        for (const ex of [40, 88]) {
          ctx.beginPath()
          ctx.arc(x + ex, 46, 12, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.beginPath()
        ctx.ellipse(x + 64, 88, 16, 20, 0, 0, Math.PI * 2)
        ctx.fill()
      } else {
        // Sly: one squint, one round, a lopsided smile.
        tri([[x + 26, 50], [x + 54, 44], [x + 52, 52]])
        ctx.beginPath()
        ctx.arc(x + 88, 46, 11, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(x + 30, 82)
        ctx.quadraticCurveTo(x + 70, 108, x + 104, 72)
        ctx.quadraticCurveTo(x + 70, 92, x + 30, 82)
        ctx.fill()
      }
    }
    return finish(c, { repeat: false })
  })

/** Cobwebs: radial threads and spiral rings, white on transparent. */
export const cobwebTexture = () =>
  cached('hc:cobweb', () => {
    const rand = seededRandom(9199)
    const S = 256
    const c = canvas(S)
    const ctx = c.getContext('2d')
    ctx.strokeStyle = 'rgba(235,235,240,0.75)'
    ctx.lineWidth = 1.2
    // Anchored in the top-left corner, spreading out into the quarter circle.
    const spokes = 9
    const angles = []
    for (let i = 0; i < spokes; i++) angles.push((i / (spokes - 1)) * (Math.PI / 2) + (rand() - 0.5) * 0.06)
    for (const a of angles) {
      ctx.beginPath()
      ctx.moveTo(4, 4)
      ctx.lineTo(4 + Math.cos(a) * 250, 4 + Math.sin(a) * 250)
      ctx.stroke()
    }
    ctx.lineWidth = 0.9
    for (let r = 24; r < 240; r += 18 + rand() * 6) {
      ctx.beginPath()
      angles.forEach((a, i) => {
        const rr = r * (0.94 + rand() * 0.1)
        const x = 4 + Math.cos(a) * rr
        const y = 4 + Math.sin(a) * rr
        if (i === 0) ctx.moveTo(x, y)
        else ctx.quadraticCurveTo(4 + Math.cos(a - 0.1) * rr * 0.9, 4 + Math.sin(a - 0.1) * rr * 0.9, x, y)
      })
      ctx.stroke()
    }
    return finish(c, { repeat: false })
  })

/** What's carved on the headstones: R.I.P., a name line and the dates, dark on transparent. */
export const engravingTexture = () =>
  cached('hc:engraving', () => {
    const c = canvas(256)
    const ctx = c.getContext('2d')
    ctx.fillStyle = 'rgba(30,28,26,0.85)'
    ctx.textAlign = 'center'
    ctx.font = 'bold 54px Georgia, serif'
    ctx.fillText('R.I.P.', 128, 92)
    ctx.fillRect(58, 120, 140, 6)
    ctx.font = '28px Georgia, serif'
    ctx.fillText('1887 – 1931', 128, 168)
    ctx.fillRect(84, 196, 88, 4)
    return finish(c, { repeat: false })
  })
