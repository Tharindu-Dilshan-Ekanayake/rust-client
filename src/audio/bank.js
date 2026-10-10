/**
 * Sound bank: every game sound rendered once, sample by sample, into
 * AudioBuffers (with a few variations each) when audio starts. No audio files.
 *
 * Rendering offline lets each sound be built from many layers — a gunshot is a
 * supersonic crack, a muzzle blast with a closing filter, a low boom, the
 * action cycling, and early reflections, then soft-clipped like a recording —
 * which would be far too many live nodes per shot.
 */

const SR = 44100

/* ---------------------------------------------------------------------------
 * DSP building blocks
 * ------------------------------------------------------------------------- */

function rng(seed) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
}

/** RBJ biquad, coefficients settable per sample block (for sweeps). */
class Biquad {
  constructor(type, freq, q = 0.707) {
    this.type = type
    this.x1 = this.x2 = this.y1 = this.y2 = 0
    this.set(freq, q)
  }
  set(freq, q = this.q) {
    this.q = q
    const w = (2 * Math.PI * Math.min(freq, SR * 0.45)) / SR
    const cos = Math.cos(w)
    const alpha = Math.sin(w) / (2 * q)
    let b0
    let b1
    let b2
    if (this.type === 'lowpass') {
      b0 = (1 - cos) / 2
      b1 = 1 - cos
      b2 = (1 - cos) / 2
    } else if (this.type === 'highpass') {
      b0 = (1 + cos) / 2
      b1 = -(1 + cos)
      b2 = (1 + cos) / 2
    } else {
      // bandpass, constant 0 dB peak
      b0 = alpha
      b1 = 0
      b2 = -alpha
    }
    const a0 = 1 + alpha
    this.b0 = b0 / a0
    this.b1 = b1 / a0
    this.b2 = b2 / a0
    this.a1 = (-2 * cos) / a0
    this.a2 = (1 - alpha) / a0
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2
    this.x2 = this.x1
    this.x1 = x
    this.y2 = this.y1
    this.y1 = y
    return y
  }
}

const buf = (seconds) => new Float32Array(Math.ceil(seconds * SR))
const expEnv = (t, tau) => Math.exp(-t / tau)
const attack = (t, a) => (a <= 0 ? 1 : Math.min(1, t / a))

/**
 * Adds filtered noise into `out` from `start` seconds: envelope from attack +
 * exponential decay, filter cutoff gliding from `freq` to `freqTo`.
 */
function noiseLayer(out, rand, { start = 0, dur, tau, att = 0.0004, type = 'lowpass', freq, freqTo = freq, q = 0.707, gain = 1, stages = 1 }) {
  const filters = Array.from({ length: stages }, () => new Biquad(type, freq, q))
  const n0 = Math.floor(start * SR)
  const len = Math.floor(dur * SR)
  for (let i = 0; i < len && n0 + i < out.length; i++) {
    const t = i / SR
    if (i % 32 === 0 && freqTo !== freq) {
      const f = freq * Math.pow(freqTo / freq, Math.min(1, t / dur))
      for (const flt of filters) flt.set(f)
    }
    let x = rand() * 2 - 1
    for (const flt of filters) x = flt.run(x)
    out[n0 + i] += x * gain * attack(t, att) * expEnv(t, tau)
  }
}

/** A sine with an exponential pitch glide and decay (booms, thuds, rings). */
function toneLayer(out, { start = 0, dur, tau, att = 0.0008, from, to = from, glide = dur, gain = 1, wave = 'sine' }) {
  const n0 = Math.floor(start * SR)
  const len = Math.floor(dur * SR)
  let phase = 0
  for (let i = 0; i < len && n0 + i < out.length; i++) {
    const t = i / SR
    const f = from * Math.pow(to / from, Math.min(1, t / glide))
    phase += (2 * Math.PI * f) / SR
    const s = wave === 'tri' ? (2 / Math.PI) * Math.asin(Math.sin(phase)) : Math.sin(phase)
    out[n0 + i] += s * gain * attack(t, att) * expEnv(t, tau)
  }
}

/** Metallic hit: a handful of inharmonic partials with their own decays. */
function metalLayer(out, rand, { start = 0, base, partials = [1, 2.76, 5.4, 8.93], tau, gain = 1 }) {
  partials.forEach((p, k) => {
    toneLayer(out, { start, dur: tau * 6, tau: tau / (1 + k * 0.6), att: 0.0002, from: base * p * (0.98 + rand() * 0.04), gain: gain / (1 + k * 0.7) })
  })
}

/** Short broadband tick (latches, clicks), band-limited around `freq`. */
function clickLayer(out, rand, { start = 0, freq = 3500, q = 4, tau = 0.0025, gain = 1 }) {
  noiseLayer(out, rand, { start, dur: tau * 8, tau, att: 0.0001, type: 'bandpass', freq, q, gain: gain * 3 })
}

/** Adds lowpassed, delayed copies of the signal (walls and ground nearby). */
function reflections(out, list) {
  const dry = out.slice()
  for (const { delay, gain, cutoff } of list) {
    const lp = new Biquad('lowpass', cutoff, 0.6)
    const d = Math.floor(delay * SR)
    for (let i = 0; i + d < out.length; i++) out[i + d] += lp.run(dry[i]) * gain
  }
}

/** tanh soft clip for density, then normalise to `level` peak. */
function finish(out, { drive = 1, level = 0.9, fadeOut = 0.02 } = {}) {
  let peak = 1e-6
  const k = Math.tanh(drive)
  for (let i = 0; i < out.length; i++) {
    out[i] = drive > 1 ? Math.tanh(out[i] * drive) / k : out[i]
    peak = Math.max(peak, Math.abs(out[i]))
  }
  const fade = Math.floor(fadeOut * SR)
  for (let i = 0; i < out.length; i++) {
    let v = (out[i] / peak) * level
    const left = out.length - i
    if (left < fade) v *= left / fade
    out[i] = v
  }
  return out
}

/* ---------------------------------------------------------------------------
 * Gunshots
 * ------------------------------------------------------------------------- */

/**
 * @param p crack: supersonic snap amount; blast: {tau, freq} of the muzzle blast;
 *   boom: {from, to, tau, gain}; mech: {t, freq, gain} action noise; refl: early
 *   reflections; len: seconds; drive: saturation.
 */
function gunshot(p, seed) {
  const rand = rng(seed)
  const out = buf(p.len)
  const v = 0.92 + rand() * 0.16
  if (p.crack) noiseLayer(out, rand, { dur: 0.012, tau: 0.0011, att: 0.00005, type: 'highpass', freq: 2600, gain: p.crack * 1.6 })
  noiseLayer(out, rand, { dur: p.blast.tau * 8, tau: p.blast.tau * v, att: 0.0003, freq: p.blast.freq, freqTo: p.blast.freqTo ?? 420, gain: p.blast.gain ?? 1.4, stages: 2 })
  // A brighter layer on top of the blast gives the "crack" body.
  noiseLayer(out, rand, { dur: p.blast.tau * 3, tau: p.blast.tau * 0.35, att: 0.0002, type: 'bandpass', freq: p.blast.mid ?? 1800, q: 0.9, gain: 0.9 })
  toneLayer(out, { dur: p.boom.tau * 6, tau: p.boom.tau, from: p.boom.from * v, to: p.boom.to, glide: p.boom.tau * 2, gain: p.boom.gain ?? 1.1 })
  if (p.mech) {
    clickLayer(out, rand, { start: p.mech.t, freq: p.mech.freq, q: 6, tau: 0.004, gain: p.mech.gain })
    metalLayer(out, rand, { start: p.mech.t + 0.004, base: p.mech.freq * 0.55, tau: 0.012, gain: p.mech.gain * 0.25 })
  }
  if (p.tail) noiseLayer(out, rand, { start: 0.02, dur: p.len - 0.02, tau: p.tail.tau, att: 0.03, freq: p.tail.freq, freqTo: p.tail.freq * 0.4, gain: p.tail.gain })
  reflections(out, p.refl)
  return finish(out, { drive: p.drive ?? 2.2, level: 0.95 })
}

const GUNS = {
  ar: {
    len: 0.65,
    crack: 0.9,
    blast: { tau: 0.016, freq: 6500, freqTo: 600, mid: 1900 },
    boom: { from: 170, to: 52, tau: 0.03, gain: 1.15 },
    mech: { t: 0.028, freq: 3100, gain: 0.35 },
    tail: { tau: 0.16, freq: 1400, gain: 0.12 },
    refl: [
      { delay: 0.031, gain: 0.32, cutoff: 3000 },
      { delay: 0.072, gain: 0.2, cutoff: 1800 },
      { delay: 0.13, gain: 0.12, cutoff: 1200 },
    ],
  },
  hornet: {
    len: 0.5,
    crack: 0.7,
    blast: { tau: 0.011, freq: 7500, freqTo: 900, mid: 2400 },
    boom: { from: 230, to: 90, tau: 0.02, gain: 0.8 },
    mech: { t: 0.02, freq: 3800, gain: 0.4 },
    tail: { tau: 0.1, freq: 1800, gain: 0.08 },
    refl: [
      { delay: 0.028, gain: 0.28, cutoff: 3200 },
      { delay: 0.065, gain: 0.16, cutoff: 1900 },
    ],
  },
  pistol: {
    len: 0.55,
    crack: 0.6,
    blast: { tau: 0.012, freq: 6000, freqTo: 800, mid: 2100 },
    boom: { from: 210, to: 75, tau: 0.024, gain: 0.95 },
    mech: { t: 0.024, freq: 3300, gain: 0.3 },
    tail: { tau: 0.12, freq: 1600, gain: 0.09 },
    refl: [
      { delay: 0.03, gain: 0.3, cutoff: 3000 },
      { delay: 0.07, gain: 0.17, cutoff: 1700 },
    ],
  },
  viper: {
    len: 1.0,
    crack: 0.75,
    blast: { tau: 0.03, freq: 5200, freqTo: 380, mid: 1500 },
    boom: { from: 135, to: 40, tau: 0.05, gain: 1.35 },
    tail: { tau: 0.28, freq: 1100, gain: 0.16 },
    drive: 2.6,
    refl: [
      { delay: 0.04, gain: 0.38, cutoff: 2400 },
      { delay: 0.095, gain: 0.26, cutoff: 1500 },
      { delay: 0.18, gain: 0.16, cutoff: 900 },
    ],
  },
  sniper: {
    len: 1.8,
    crack: 1.1,
    blast: { tau: 0.045, freq: 5000, freqTo: 260, mid: 1300 },
    boom: { from: 105, to: 30, tau: 0.09, gain: 1.6 },
    tail: { tau: 0.55, freq: 900, gain: 0.24 },
    drive: 3,
    refl: [
      { delay: 0.05, gain: 0.42, cutoff: 2200 },
      { delay: 0.16, gain: 0.3, cutoff: 1200 },
      { delay: 0.34, gain: 0.22, cutoff: 800 },
      { delay: 0.6, gain: 0.14, cutoff: 600 },
    ],
  },
}

/** Suppressed: no muzzle blast to speak of — a "pfft", the action, the bullet's snap. */
function suppressed(kind, seed) {
  const rand = rng(seed)
  const out = buf(0.4)
  const rifle = kind !== 'pistol'
  if (rifle) noiseLayer(out, rand, { start: 0.006, dur: 0.01, tau: 0.0009, att: 0.00005, type: 'highpass', freq: 3500, gain: kind === 'sniper' ? 0.6 : 0.35 })
  noiseLayer(out, rand, { dur: 0.12, tau: kind === 'sniper' ? 0.03 : 0.018, att: 0.002, freq: 1300, freqTo: 300, gain: 1.4, stages: 2 })
  toneLayer(out, { dur: 0.12, tau: 0.025, from: kind === 'sniper' ? 120 : 160, to: 60, gain: 0.7 })
  clickLayer(out, rand, { start: 0.018, freq: 3400, q: 6, tau: 0.004, gain: kind === 'sniper' ? 0.2 : 0.55 })
  metalLayer(out, rand, { start: 0.022, base: 1700, tau: 0.01, gain: 0.15 })
  reflections(out, [{ delay: 0.03, gain: 0.18, cutoff: 1500 }])
  return finish(out, { drive: 1.5, level: 0.8 })
}

/* ---------------------------------------------------------------------------
 * Foley: reloads, bolts, knife, footsteps, bodies
 * ------------------------------------------------------------------------- */

/** Metal-on-metal slide (charging handles, bolts, magazines in the well). */
function scrape(out, rand, start, dur, from, to, gain) {
  noiseLayer(out, rand, { start, dur, tau: dur * 0.9, att: dur * 0.25, type: 'bandpass', freq: from, freqTo: to, q: 2.5, gain: gain * 2 })
}

const FOLEY = {
  magRelease: (r) => {
    const o = buf(0.12)
    clickLayer(o, r, { freq: 4200, gain: 0.7 })
    clickLayer(o, r, { start: 0.012, freq: 2600, gain: 0.5 })
    return o
  },
  magOut: (r) => {
    const o = buf(0.35)
    clickLayer(o, r, { freq: 3800, gain: 0.6 })
    scrape(o, r, 0.01, 0.11, 1500, 2300, 0.5)
    toneLayer(o, { start: 0.12, dur: 0.08, tau: 0.015, from: 320, to: 220, gain: 0.25 })
    return o
  },
  magPouch: (r) => {
    const o = buf(0.3)
    noiseLayer(o, r, { dur: 0.25, tau: 0.08, att: 0.04, freq: 900, freqTo: 600, gain: 0.5 })
    clickLayer(o, r, { start: 0.14, freq: 2200, gain: 0.25 })
    return o
  },
  magIn: (r) => {
    const o = buf(0.35)
    scrape(o, r, 0, 0.07, 1800, 2600, 0.45)
    clickLayer(o, r, { start: 0.075, freq: 3000, q: 3, tau: 0.004, gain: 1 })
    metalLayer(o, r, { start: 0.078, base: 1900, tau: 0.02, gain: 0.35 })
    toneLayer(o, { start: 0.075, dur: 0.1, tau: 0.02, from: 170, to: 110, gain: 0.5 })
    return o
  },
  magTap: (r) => {
    const o = buf(0.2)
    toneLayer(o, { dur: 0.1, tau: 0.018, from: 150, to: 90, gain: 0.7 })
    noiseLayer(o, r, { dur: 0.05, tau: 0.008, freq: 1200, gain: 0.4 })
    return o
  },
  chargePull: (r) => {
    const o = buf(0.3)
    clickLayer(o, r, { freq: 3600, gain: 0.5 })
    scrape(o, r, 0.01, 0.13, 2200, 3600, 0.55)
    return o
  },
  boltSlam: (r) => {
    const o = buf(0.45)
    clickLayer(o, r, { freq: 2600, q: 2.5, tau: 0.005, gain: 1.2 })
    metalLayer(o, r, { start: 0.002, base: 1450, tau: 0.035, gain: 0.55 })
    toneLayer(o, { dur: 0.12, tau: 0.03, from: 210, to: 120, gain: 0.45 })
    // Buffer spring twang.
    toneLayer(o, { start: 0.004, dur: 0.3, tau: 0.06, from: 640, to: 600, gain: 0.08, wave: 'tri' })
    return o
  },
  slideRelease: (r) => {
    const o = buf(0.3)
    clickLayer(o, r, { freq: 3200, q: 3, tau: 0.004, gain: 1.1 })
    metalLayer(o, r, { start: 0.002, base: 2100, tau: 0.025, gain: 0.45 })
    return o
  },
  boltUp: (r) => {
    const o = buf(0.15)
    clickLayer(o, r, { freq: 2800, gain: 0.7 })
    metalLayer(o, r, { start: 0.003, base: 1600, tau: 0.015, gain: 0.2 })
    return o
  },
  boltBack: (r) => {
    const o = buf(0.3)
    scrape(o, r, 0, 0.16, 1700, 2900, 0.6)
    clickLayer(o, r, { start: 0.16, freq: 2400, gain: 0.8 })
    return o
  },
  boltForward: (r) => {
    const o = buf(0.3)
    scrape(o, r, 0, 0.13, 2900, 1800, 0.6)
    clickLayer(o, r, { start: 0.13, freq: 2200, q: 3, gain: 1 })
    metalLayer(o, r, { start: 0.132, base: 1300, tau: 0.02, gain: 0.3 })
    return o
  },
  boltDown: (r) => {
    const o = buf(0.15)
    clickLayer(o, r, { freq: 2500, q: 3, gain: 1 })
    toneLayer(o, { dur: 0.06, tau: 0.012, from: 260, gain: 0.3 })
    return o
  },
  cylinderOpen: (r) => {
    const o = buf(0.3)
    clickLayer(o, r, { freq: 3400, gain: 0.8 })
    scrape(o, r, 0.01, 0.08, 2600, 1900, 0.3)
    metalLayer(o, r, { start: 0.08, base: 1700, tau: 0.03, gain: 0.25 })
    return o
  },
  shellsDrop: (r) => {
    const o = buf(0.7)
    for (let i = 0; i < 6; i++) {
      const t = 0.05 + r() * 0.4
      metalLayer(o, r, { start: t, base: 3200 + r() * 1800, partials: [1, 2.1, 3.7], tau: 0.03, gain: 0.25 + r() * 0.2 })
    }
    return o
  },
  speedloader: (r) => {
    const o = buf(0.3)
    scrape(o, r, 0, 0.06, 2000, 2500, 0.35)
    clickLayer(o, r, { start: 0.07, freq: 2700, gain: 0.8 })
    noiseLayer(o, r, { start: 0.08, dur: 0.12, tau: 0.03, type: 'bandpass', freq: 4200, q: 2, gain: 0.35 })
    return o
  },
  cylinderClose: (r) => {
    const o = buf(0.3)
    clickLayer(o, r, { freq: 3000, q: 3, tau: 0.004, gain: 1.1 })
    metalLayer(o, r, { start: 0.002, base: 1800, tau: 0.03, gain: 0.4 })
    return o
  },
  hammer: (r) => {
    const o = buf(0.12)
    clickLayer(o, r, { freq: 3800, gain: 0.7 })
    clickLayer(o, r, { start: 0.02, freq: 2600, gain: 0.5 })
    return o
  },
  dryFire: (r) => {
    const o = buf(0.12)
    clickLayer(o, r, { freq: 3300, q: 5, gain: 0.9 })
    return o
  },
  weaponRaise: (r) => {
    const o = buf(0.35)
    noiseLayer(o, r, { dur: 0.2, tau: 0.06, att: 0.03, freq: 1100, freqTo: 700, gain: 0.45 })
    for (let i = 0; i < 3; i++) clickLayer(o, r, { start: 0.04 + i * 0.03 + r() * 0.02, freq: 2500 + r() * 1500, gain: 0.25 })
    return o
  },
  knifeDraw: (r) => {
    const o = buf(0.9)
    scrape(o, r, 0, 0.16, 2600, 5200, 0.5)
    metalLayer(o, r, { start: 0.12, base: 2150, partials: [1, 1.62, 2.53, 3.61], tau: 0.18, gain: 0.45 })
    return o
  },
  knifeSwing: (r) => {
    const o = buf(0.35)
    // Air torn past the blade: a band of noise sweeping up then down.
    const flt = new Biquad('bandpass', 400, 1.4)
    for (let i = 0; i < o.length; i++) {
      const t = i / SR
      const k = Math.min(1, t / 0.28)
      if (i % 32 === 0) flt.set(450 + Math.sin(k * Math.PI) * 2600, 1.4)
      const env = Math.sin(Math.min(1, t / 0.26) * Math.PI) ** 2
      o[i] += flt.run(r() * 2 - 1) * env * 2.2
    }
    noiseLayer(o, r, { dur: 0.3, tau: 0.12, att: 0.08, freq: 260, gain: 0.25 })
    return o
  },
  meleeSwing: (r) => {
    const o = buf(0.35)
    noiseLayer(o, r, { dur: 0.3, tau: 0.1, att: 0.08, freq: 500, freqTo: 1400, gain: 0.6 })
    for (let i = 0; i < 2; i++) clickLayer(o, r, { start: 0.03 + i * 0.05, freq: 2400, gain: 0.2 })
    return o
  },
  knifeHit: (r) => {
    const o = buf(0.45)
    // Thud into the body, a wet cut, a bit of kit rattling.
    toneLayer(o, { dur: 0.2, tau: 0.04, from: 130, to: 55, gain: 1.1 })
    noiseLayer(o, r, { dur: 0.15, tau: 0.035, att: 0.002, freq: 900, freqTo: 300, gain: 1, stages: 2 })
    noiseLayer(o, r, { start: 0.005, dur: 0.06, tau: 0.012, type: 'bandpass', freq: 3200, q: 1.5, gain: 0.6 })
    noiseLayer(o, r, { start: 0.04, dur: 0.12, tau: 0.04, type: 'bandpass', freq: 650, q: 2, gain: 0.5 })
    return o
  },
  buttHit: (r) => {
    const o = buf(0.35)
    toneLayer(o, { dur: 0.18, tau: 0.035, from: 110, to: 50, gain: 1.1 })
    clickLayer(o, r, { freq: 1800, q: 2, gain: 0.6 })
    noiseLayer(o, r, { dur: 0.1, tau: 0.02, freq: 700, gain: 0.6 })
    return o
  },
  stepSand: (r) => {
    const o = buf(0.18)
    toneLayer(o, { dur: 0.08, tau: 0.018, from: 95, to: 60, gain: 0.35 })
    for (let i = 0; i < 9; i++) {
      noiseLayer(o, r, { start: r() * 0.06, dur: 0.012, tau: 0.003, att: 0.0005, type: 'bandpass', freq: 1500 + r() * 2200, q: 1.2, gain: 0.25 + r() * 0.2 })
    }
    return o
  },
  stepMetal: (r) => {
    const o = buf(0.3)
    toneLayer(o, { dur: 0.1, tau: 0.02, from: 120, to: 80, gain: 0.45 })
    clickLayer(o, r, { freq: 1600, q: 2, gain: 0.35 })
    metalLayer(o, r, { start: 0.002, base: 620 + r() * 120, partials: [1, 2.3, 4.1, 6.6], tau: 0.05, gain: 0.3 })
    return o
  },
  brass: (r) => {
    const o = buf(0.45)
    for (let i = 0; i < 3; i++) metalLayer(o, r, { start: i * (0.05 + r() * 0.05), base: 3600 + r() * 1600, partials: [1, 2.2, 3.9], tau: 0.025, gain: 0.5 / (i + 1) })
    return o
  },
  impact: (r) => {
    const o = buf(0.25)
    toneLayer(o, { dur: 0.06, tau: 0.01, from: 300, to: 140, gain: 0.5 })
    noiseLayer(o, r, { dur: 0.15, tau: 0.03, att: 0.001, freq: 2800, freqTo: 700, gain: 0.8 })
    clickLayer(o, r, { freq: 4500, gain: 0.4 })
    return o
  },
  land: (r) => {
    const o = buf(0.3)
    toneLayer(o, { dur: 0.15, tau: 0.035, from: 100, to: 50, gain: 1 })
    noiseLayer(o, r, { dur: 0.15, tau: 0.04, freq: 700, gain: 0.6 })
    for (let i = 0; i < 6; i++) noiseLayer(o, r, { start: r() * 0.05, dur: 0.01, tau: 0.003, type: 'bandpass', freq: 2000 + r() * 2000, gain: 0.2 })
    return o
  },
  bonecrunch: (r) => {
    const o = buf(0.45)
    toneLayer(o, { dur: 0.3, tau: 0.06, from: 85, to: 36, gain: 1.2 })
    noiseLayer(o, r, { dur: 0.2, tau: 0.05, freq: 800, gain: 0.9, stages: 2 })
    for (let i = 0; i < 4; i++) clickLayer(o, r, { start: 0.01 + r() * 0.04, freq: 1800 + r() * 1200, q: 3, gain: 0.35 })
    return o
  },
  hurt: (r) => {
    const o = buf(0.3)
    toneLayer(o, { dur: 0.2, tau: 0.04, from: 120, to: 60, gain: 0.9 })
    noiseLayer(o, r, { dur: 0.15, tau: 0.035, freq: 600, gain: 0.6 })
    return o
  },
  /** Low-health breathing: formant-filtered breath, kept soft (no hiss). */
  breathIn: (r) => {
    const o = buf(0.7)
    noiseLayer(o, r, { dur: 0.6, tau: 0.35, att: 0.25, type: 'bandpass', freq: 650, freqTo: 900, q: 1.6, gain: 0.7 })
    noiseLayer(o, r, { dur: 0.6, tau: 0.35, att: 0.25, type: 'bandpass', freq: 1250, freqTo: 1500, q: 2, gain: 0.35 })
    return o
  },
  breathOut: (r) => {
    const o = buf(0.9)
    noiseLayer(o, r, { dur: 0.8, tau: 0.3, att: 0.05, type: 'bandpass', freq: 600, freqTo: 420, q: 1.4, gain: 0.8 })
    noiseLayer(o, r, { dur: 0.6, tau: 0.25, att: 0.05, type: 'bandpass', freq: 1100, freqTo: 800, q: 2, gain: 0.25 })
    return o
  },
  gasp: (r) => {
    const o = buf(0.3)
    noiseLayer(o, r, { dur: 0.22, tau: 0.08, att: 0.02, type: 'bandpass', freq: 900, freqTo: 1400, q: 1.8, gain: 0.9 })
    return o
  },
}

/* ---------------------------------------------------------------------------
 * Explosions and the distant battle
 * ------------------------------------------------------------------------- */

const BIG = {
  explosion: (r) => {
    const o = buf(2.6)
    noiseLayer(o, r, { dur: 0.02, tau: 0.003, att: 0.0001, type: 'highpass', freq: 2000, gain: 1.4 })
    noiseLayer(o, r, { dur: 2.5, tau: 0.45, att: 0.002, freq: 2600, freqTo: 120, gain: 1.6, stages: 2 })
    toneLayer(o, { dur: 1.6, tau: 0.3, from: 70, to: 26, glide: 0.8, gain: 1.6 })
    // Debris pattering down.
    for (let i = 0; i < 18; i++) noiseLayer(o, r, { start: 0.25 + r() * 1.4, dur: 0.02, tau: 0.005, type: 'bandpass', freq: 1500 + r() * 2500, gain: 0.2 * r() })
    reflections(o, [
      { delay: 0.09, gain: 0.35, cutoff: 900 },
      { delay: 0.28, gain: 0.25, cutoff: 600 },
      { delay: 0.6, gain: 0.15, cutoff: 400 },
    ])
    return finish(o, { drive: 2.5, level: 0.95 })
  },
  flashbang: (r) => {
    const o = buf(1.2)
    noiseLayer(o, r, { dur: 0.6, tau: 0.08, att: 0.0005, freq: 7000, freqTo: 900, gain: 1.6 })
    toneLayer(o, { dur: 0.4, tau: 0.08, from: 140, to: 50, gain: 1 })
    reflections(o, [{ delay: 0.07, gain: 0.3, cutoff: 1800 }, { delay: 0.2, gain: 0.2, cutoff: 900 }])
    return finish(o, { drive: 2.5, level: 0.95 })
  },
  distantArtillery: (r) => {
    const o = buf(4)
    noiseLayer(o, r, { dur: 3.8, tau: 0.9, att: 0.03, freq: 380, freqTo: 90, gain: 1.4, stages: 2 })
    toneLayer(o, { dur: 3, tau: 0.7, att: 0.02, from: 48, to: 28, glide: 2, gain: 1.2 })
    reflections(o, [{ delay: 0.5, gain: 0.4, cutoff: 250 }, { delay: 1.3, gain: 0.25, cutoff: 180 }])
    return finish(o, { drive: 1.4, level: 0.9, fadeOut: 0.5 })
  },
  distantBurst: (r) => {
    const o = buf(2.2)
    const shots = 3 + Math.floor(r() * 6)
    for (let i = 0; i < shots; i++) {
      const t = i * (0.085 + r() * 0.02)
      noiseLayer(o, r, { start: t, dur: 0.3, tau: 0.05, att: 0.001, freq: 900, freqTo: 250, gain: 1, stages: 2 })
    }
    reflections(o, [{ delay: 0.35, gain: 0.35, cutoff: 500 }, { delay: 0.8, gain: 0.2, cutoff: 350 }])
    return finish(o, { drive: 1.3, level: 0.8, fadeOut: 0.4 })
  },
}

/* ---------------------------------------------------------------------------
 * Building the bank
 * ------------------------------------------------------------------------- */

/** name -> [render(seed) -> Float32Array], with how many variations to keep. */
function recipes() {
  const list = []
  for (const [id, p] of Object.entries(GUNS)) list.push([id, 4, (s) => gunshot(p, s)])
  list.push(['suppressedRifle', 3, (s) => suppressed('rifle', s)])
  list.push(['suppressedPistol', 3, (s) => suppressed('pistol', s)])
  list.push(['suppressedSniper', 2, (s) => suppressed('sniper', s)])
  const counts = { stepSand: 6, stepMetal: 4, impact: 4, brass: 3, knifeSwing: 3, knifeHit: 2, breathIn: 2, breathOut: 2 }
  for (const [name, fn] of Object.entries(FOLEY)) {
    list.push([name, counts[name] ?? 2, (s) => finish(fn(rng(s)), { level: 0.85 })])
  }
  for (const [name, fn] of Object.entries(BIG)) list.push([name, name.startsWith('distant') ? 3 : 2, (s) => fn(rng(s))])
  return list
}

/**
 * Renders everything into AudioBuffers on `ctx`, yielding between sounds so
 * the page stays responsive. Resolves to a Map of name -> AudioBuffer[].
 */
export async function buildBank(ctx) {
  const bank = new Map()
  let seed = 1
  for (const [name, count, render] of recipes()) {
    const variants = []
    for (let v = 0; v < count; v++) {
      const data = render(seed++ * 7919)
      const b = ctx.createBuffer(1, data.length, SR)
      b.copyToChannel(data, 0)
      variants.push(b)
    }
    bank.set(name, variants)
    await new Promise((r) => setTimeout(r, 0))
  }
  return bank
}

/**
 * Reload foley per weapon, as (fraction of the reload time, sound). The
 * `empty` list adds the charging handle / slide / bolt at the end.
 */
export const RELOAD_FOLEY = {
  ar: {
    tactical: [[0.08, 'magRelease'], [0.13, 'magOut'], [0.36, 'magPouch'], [0.58, 'magIn'], [0.68, 'magTap']],
    empty: [[0.06, 'magRelease'], [0.1, 'magOut'], [0.3, 'magPouch'], [0.5, 'magIn'], [0.58, 'magTap'], [0.76, 'chargePull'], [0.84, 'boltSlam']],
  },
  hornet: {
    tactical: [[0.1, 'magRelease'], [0.15, 'magOut'], [0.55, 'magIn']],
    empty: [[0.08, 'magRelease'], [0.12, 'magOut'], [0.48, 'magIn'], [0.74, 'chargePull'], [0.82, 'boltSlam']],
  },
  pistol: {
    tactical: [[0.12, 'magRelease'], [0.16, 'magOut'], [0.6, 'magIn']],
    empty: [[0.1, 'magRelease'], [0.14, 'magOut'], [0.52, 'magIn'], [0.8, 'slideRelease']],
  },
  sniper: {
    tactical: [[0.06, 'boltUp'], [0.12, 'boltBack'], [0.3, 'magOut'], [0.58, 'magIn'], [0.8, 'boltForward'], [0.9, 'boltDown']],
  },
  viper: {
    tactical: [[0.08, 'cylinderOpen'], [0.2, 'shellsDrop'], [0.55, 'speedloader'], [0.8, 'cylinderClose']],
  },
}

export const reloadFoley = (weaponId, empty) => {
  const f = RELOAD_FOLEY[weaponId]
  if (!f) return []
  return (empty && f.empty) || f.tactical
}
