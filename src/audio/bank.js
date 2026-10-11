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
/** Sample rate the bank is rendered at (AudioBuffers resample on playback). */
export const BANK_SAMPLE_RATE = SR

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

/** tanh soft clip (density without hard clipping), peak-preserving. */
function softClip(out, drive) {
  const k = Math.tanh(drive)
  for (let i = 0; i < out.length; i++) out[i] = Math.tanh(out[i] * drive) / k
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
 * A gunshot is mostly *noise*, not a note: anything pitched (a sine sweeping
 * down) makes it sound like a drum. So it's built as
 *   - the supersonic crack: a sharp N-wave and a hiss of very high noise,
 *   - the muzzle blast: broadband noise with a split envelope — a hard spike,
 *     then a body that darkens as it dies (punch + weight),
 *   - the pressure wave: one push-pull lobe (felt, not heard as a tone) plus
 *     low-passed noise for the thump,
 *   - the action cycling, the tail and early reflections off nearby walls,
 * then driven into a soft clipper like a hot recording.
 */
function gunshot(p, seed) {
  const rand = rng(seed)
  const out = buf(p.len)
  const v = 0.9 + rand() * 0.2
  if (p.crack) {
    const n = Math.max(2, Math.floor(0.0005 * SR))
    for (let i = 0; i < n; i++) out[i] += (i < n / 2 ? 1 : -0.8) * p.crack * 1.4
    noiseLayer(out, rand, { dur: 0.008, tau: 0.0009, att: 0.00003, type: 'highpass', freq: 3500, gain: p.crack * 1.3 })
  }
  const b = p.blast
  noiseLayer(out, rand, { dur: b.tau1 * 10, tau: b.tau1, att: 0.00008, freq: 14000, freqTo: 3200, gain: b.punch })
  noiseLayer(out, rand, { dur: b.tau2 * 9, tau: b.tau2 * v, att: 0.0002, freq: b.freq, freqTo: b.freqTo, gain: b.body })
  noiseLayer(out, rand, { dur: b.tau2 * 4, tau: b.tau2 * 0.5, att: 0.0002, type: 'bandpass', freq: b.mid, q: 0.8, gain: 0.8 })
  // Pressure push-pull: one positive lobe, a smaller negative one.
  const lobe = p.pulse.len
  const n1 = Math.floor(lobe * SR)
  for (let i = 0; i < n1 * 3 && i < out.length; i++) {
    const t = i / n1
    out[i] += t < 1 ? Math.sin(t * Math.PI) * p.pulse.gain : -Math.sin(((t - 1) / 2) * Math.PI) * p.pulse.gain * 0.35
  }
  noiseLayer(out, rand, { dur: p.low.tau * 8, tau: p.low.tau, att: 0.0015, freq: p.low.freq, freqTo: p.low.freq * 0.6, gain: p.low.gain * 5, stages: 2 })
  if (p.mech) {
    clickLayer(out, rand, { start: p.mech.t, freq: p.mech.freq, q: 6, tau: 0.004, gain: p.mech.gain })
    metalLayer(out, rand, { start: p.mech.t + 0.004, base: p.mech.freq * 0.55, tau: 0.012, gain: p.mech.gain * 0.25 })
  }
  if (p.tail) noiseLayer(out, rand, { start: 0.015, dur: p.len - 0.015, tau: p.tail.tau, att: 0.02, freq: p.tail.freq, freqTo: p.tail.freq * 0.35, gain: p.tail.gain })
  if (p.extra) p.extra(out, rand)
  // Saturate the shot itself, then add the echoes at their own level. (Echoes
  // added before the soft clip came back nearly as loud as the shot, and read
  // as a second, muffled bang a few hundred ms later.)
  softClip(out, p.drive ?? 3.2)
  reflections(out, p.refl)
  return finish(out, { level: 0.95 })
}

const REFL_NEAR = [
  { delay: 0.029, gain: 0.3, cutoff: 3200 },
  { delay: 0.068, gain: 0.2, cutoff: 1900 },
  { delay: 0.125, gain: 0.12, cutoff: 1200 },
]

const GUNS = {
  ar: {
    len: 0.75,
    crack: 0.85,
    blast: { tau1: 0.0025, tau2: 0.022, freq: 7000, freqTo: 900, mid: 1900, punch: 1.0, body: 1.2 },
    pulse: { len: 0.008, gain: 1.0 },
    low: { freq: 210, tau: 0.035, gain: 1 },
    mech: { t: 0.03, freq: 3200, gain: 0.3 },
    tail: { tau: 0.2, freq: 1700, gain: 0.14 },
    refl: REFL_NEAR,
  },
  smg: {
    len: 0.6,
    crack: 0.45,
    blast: { tau1: 0.002, tau2: 0.016, freq: 8000, freqTo: 1100, mid: 2300, punch: 1.0, body: 1.1 },
    pulse: { len: 0.006, gain: 0.75 },
    low: { freq: 260, tau: 0.026, gain: 0.8 },
    mech: { t: 0.02, freq: 3800, gain: 0.35 },
    tail: { tau: 0.14, freq: 1900, gain: 0.1 },
    refl: REFL_NEAR,
  },
  lmg: {
    len: 0.85,
    crack: 0.95,
    blast: { tau1: 0.003, tau2: 0.028, freq: 6200, freqTo: 700, mid: 1600, punch: 1.0, body: 1.3 },
    pulse: { len: 0.01, gain: 1.2 },
    low: { freq: 170, tau: 0.045, gain: 1.2 },
    mech: { t: 0.035, freq: 2600, gain: 0.35 },
    tail: { tau: 0.26, freq: 1500, gain: 0.16 },
    drive: 3.5,
    refl: REFL_NEAR,
  },
  hornet: {
    len: 0.55,
    crack: 0.35,
    blast: { tau1: 0.0018, tau2: 0.014, freq: 8500, freqTo: 1200, mid: 2500, punch: 1.0, body: 1.0 },
    pulse: { len: 0.005, gain: 0.6 },
    low: { freq: 280, tau: 0.022, gain: 0.7 },
    mech: { t: 0.018, freq: 4000, gain: 0.38 },
    tail: { tau: 0.12, freq: 2000, gain: 0.09 },
    refl: REFL_NEAR,
  },
  pistol: {
    len: 0.6,
    crack: 0.3,
    blast: { tau1: 0.002, tau2: 0.017, freq: 7000, freqTo: 1000, mid: 2100, punch: 1.0, body: 1.1 },
    pulse: { len: 0.007, gain: 0.85 },
    low: { freq: 240, tau: 0.028, gain: 0.85 },
    mech: { t: 0.025, freq: 3400, gain: 0.3 },
    tail: { tau: 0.15, freq: 1700, gain: 0.1 },
    refl: REFL_NEAR,
  },
  viper: {
    len: 1.0,
    crack: 0.5,
    blast: { tau1: 0.003, tau2: 0.034, freq: 5600, freqTo: 600, mid: 1500, punch: 1.0, body: 1.35 },
    pulse: { len: 0.011, gain: 1.35 },
    low: { freq: 160, tau: 0.05, gain: 1.2 },
    tail: { tau: 0.32, freq: 1300, gain: 0.18 },
    drive: 3.6,
    refl: [
      { delay: 0.04, gain: 0.36, cutoff: 2400 },
      { delay: 0.095, gain: 0.25, cutoff: 1500 },
      { delay: 0.18, gain: 0.16, cutoff: 900 },
    ],
  },
  sniper: {
    len: 1.9,
    crack: 1.2,
    blast: { tau1: 0.0035, tau2: 0.05, freq: 5600, freqTo: 420, mid: 1300, punch: 1.0, body: 1.45 },
    pulse: { len: 0.014, gain: 1.6 },
    low: { freq: 120, tau: 0.08, gain: 1.4 },
    tail: { tau: 0.45, freq: 1100, gain: 0.2 },
    drive: 4,
    refl: [
      { delay: 0.05, gain: 0.3, cutoff: 2200 },
      { delay: 0.16, gain: 0.16, cutoff: 1200 },
      { delay: 0.34, gain: 0.08, cutoff: 700 },
    ],
  },
  shotgun: {
    len: 1.2,
    crack: 0,
    blast: { tau1: 0.004, tau2: 0.045, freq: 5200, freqTo: 480, mid: 1200, punch: 1.0, body: 1.5 },
    pulse: { len: 0.015, gain: 1.7 },
    low: { freq: 140, tau: 0.07, gain: 1.5 },
    tail: { tau: 0.38, freq: 1200, gain: 0.22 },
    drive: 4,
    refl: [
      { delay: 0.045, gain: 0.38, cutoff: 2200 },
      { delay: 0.12, gain: 0.26, cutoff: 1300 },
      { delay: 0.24, gain: 0.15, cutoff: 800 },
    ],
  },
  rpg: {
    len: 2.2,
    crack: 0,
    blast: { tau1: 0.004, tau2: 0.06, freq: 4200, freqTo: 380, mid: 1000, punch: 0.8, body: 1.4 },
    pulse: { len: 0.018, gain: 1.6 },
    low: { freq: 110, tau: 0.09, gain: 1.4 },
    tail: { tau: 0.5, freq: 900, gain: 0.2 },
    drive: 3,
    // The rocket motor lighting off and roaring away.
    extra: (out, rand) => {
      noiseLayer(out, rand, { start: 0.03, dur: 1.6, tau: 0.5, att: 0.06, type: 'bandpass', freq: 500, freqTo: 1900, q: 0.9, gain: 1.6 })
      noiseLayer(out, rand, { start: 0.03, dur: 1.4, tau: 0.45, att: 0.05, freq: 900, freqTo: 300, gain: 0.8 })
    },
    refl: [
      { delay: 0.06, gain: 0.35, cutoff: 1800 },
      { delay: 0.2, gain: 0.22, cutoff: 900 },
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

/** Unpitched low knock (boot heels, palms on a mag): low-passed noise, no tone to ring like a drum. */
function thump(out, rand, start, freq, tau, gain) {
  noiseLayer(out, rand, { start, dur: tau * 7, tau, att: 0.0015, freq, stages: 2, gain: gain * 4 })
}

/**
 * Steel part hitting steel: a hard tick, a knock through the gun's body and a
 * cluster of inharmonic ringing modes (that ring is what reads as "metal").
 */
function clank(out, rand, { start = 0, base = 1400, tau = 0.06, gain = 1, knock = 700, ring = 1 }) {
  noiseLayer(out, rand, { start, dur: 0.012, tau: 0.0015, att: 0.0001, type: 'highpass', freq: 2500, gain: gain * 1.3 })
  noiseLayer(out, rand, { start, dur: 0.09, tau: 0.012, att: 0.0003, type: 'bandpass', freq: knock, q: 1.6, gain: gain * 2.4 })
  metalLayer(out, rand, { start, base: base * (0.96 + rand() * 0.08), partials: [1, 1.47, 2.09, 2.56, 3.18, 3.91, 4.8], tau, gain: gain * 0.7 * ring })
}

/** Hard contact: a broadband crack well under a millisecond (what makes a hit sound hard and close). */
function contact(out, rand, start, gain, bright = 3000) {
  noiseLayer(out, rand, { start, dur: 0.004, tau: 0.0005, att: 0.00002, type: 'highpass', freq: bright, gain: gain * 2 })
}

/** Hollow body resonance: a short, damped band of noise (a polymer mag, the receiver, a palm on it). */
function body(out, rand, start, freq, q, tau, gain) {
  noiseLayer(out, rand, { start, dur: tau * 7, tau, att: 0.0004, type: 'bandpass', freq, q, gain: gain * 3 })
}

const RING_RATIOS = [1, 1.52, 2.11, 2.73, 3.42, 4.18, 5.07, 6.1]

/** A small steel part ringing: dense inharmonic modes, the high ones dying first. */
function ring(out, rand, start, base, tau, gain, modes = 6) {
  for (let k = 0; k < modes; k++) {
    toneLayer(out, { start, dur: tau * 5, tau: tau / (1 + k * 0.45), att: 0.0002, from: base * RING_RATIOS[k] * (0.97 + rand() * 0.06), gain: gain / (1 + k * 0.5) })
  }
}

/**
 * Stick-slip friction: a part dragged along metal or polymer. Real sliding
 * isn't smooth noise but a fast run of tiny grabs, which is what makes a
 * magazine or a bolt sound like it's scraping along a rail.
 */
function friction(out, rand, { start = 0, dur, from, to = from, rate = 150, gain = 1, q = 1.4 }) {
  const flt = new Biquad('bandpass', from, q)
  const n0 = Math.floor(start * SR)
  const len = Math.floor(dur * SR)
  let phase = 0
  let speed = 1
  for (let i = 0; i < len && n0 + i < out.length; i++) {
    const t = i / SR
    if (i % 32 === 0) {
      flt.set(from * Math.pow(to / from, t / dur))
      speed = 0.75 + rand() * 0.5
    }
    phase += (rate * speed) / SR
    const grab = Math.exp(-(phase % 1) * 9)
    const env = Math.pow(Math.sin(Math.PI * Math.min(1, t / dur)), 0.6)
    out[n0 + i] += flt.run(rand() * 2 - 1) * env * (0.3 + 0.7 * grab) * gain * 2.5
  }
}

/** A spring under load letting go: a short wiry twang. */
function spring(out, start, freq, tau, gain) {
  toneLayer(out, { start, dur: tau * 6, tau, att: 0.0005, from: freq * 1.08, to: freq, glide: tau * 2, gain, wave: 'tri' })
  toneLayer(out, { start, dur: tau * 4, tau: tau * 0.6, att: 0.0005, from: freq * 2.71, gain: gain * 0.35 })
}

/** Loose small parts: a quick run of tiny metallic ticks (springs, rounds in a mag). */
function rattle(out, rand, start, span, count, gain) {
  for (let i = 0; i < count; i++) {
    metalLayer(out, rand, { start: start + rand() * span, base: 2600 + rand() * 2400, partials: [1, 2.2, 3.7], tau: 0.008 + rand() * 0.01, gain: gain * (0.4 + rand() * 0.6) })
  }
}

/** Grit crunching under a boot: many tiny high clicks scattered over `span`. */
function grains(out, rand, start, span, count, lo, hi, gain) {
  for (let i = 0; i < count; i++) {
    const t = start + Math.pow(rand(), 1.6) * span
    noiseLayer(out, rand, { start: t, dur: 0.008, tau: 0.0012 + rand() * 0.0015, att: 0.0001, type: 'bandpass', freq: lo + rand() * (hi - lo), q: 1.4, gain: gain * (0.3 + rand() * 0.7) * 2.5 })
  }
}

const FOLEY = {
  magRelease: (r) => {
    // Thumb on the release button, then the catch letting go of the mag.
    const o = buf(0.14)
    contact(o, r, 0, 0.35, 4000)
    body(o, r, 0.001, 2200, 4, 0.004, 0.35)
    contact(o, r, 0.008, 0.5)
    ring(o, r, 0.008, 2600, 0.012, 0.22, 4)
    friction(o, r, { start: 0.012, dur: 0.05, from: 1800, to: 2600, rate: 200, gain: 0.3 })
    return o
  },
  magOut: (r) => {
    // Out of the well: the drag along the walls, rounds shifting, a knock as it clears.
    const o = buf(0.36)
    friction(o, r, { dur: 0.085, from: 1500, to: 2800, rate: 160, gain: 0.75 })
    rattle(o, r, 0.01, 0.08, 5, 0.22)
    contact(o, r, 0.085, 0.4)
    body(o, r, 0.085, 900, 2.5, 0.01, 0.5)
    ring(o, r, 0.087, 1900, 0.02, 0.2, 5)
    return o
  },
  magDrop: (r) => {
    // The empty mag landing in the sand: a dull thud, grit, the follower rattling, a little bounce.
    const o = buf(0.5)
    body(o, r, 0, 220, 0.9, 0.03, 1)
    grains(o, r, 0.002, 0.06, 18, 2500, 6500, 0.25)
    rattle(o, r, 0.01, 0.12, 6, 0.3)
    body(o, r, 0.11, 300, 1.2, 0.015, 0.35)
    return o
  },
  magPouch: (r) => {
    // Velcro tearing open, the mag dragged out of cordura, knocking the kit.
    const o = buf(0.45)
    grains(o, r, 0, 0.12, 40, 1800, 5200, 0.35)
    noiseLayer(o, r, { dur: 0.3, tau: 0.08, att: 0.03, freq: 1200, gain: 0.5 })
    friction(o, r, { start: 0.12, dur: 0.1, from: 900, to: 1400, rate: 90, gain: 0.4 })
    body(o, r, 0.22, 700, 2, 0.01, 0.3)
    rattle(o, r, 0.2, 0.06, 3, 0.15)
    return o
  },
  magIn: (r) => {
    // Up the well, then seated hard: the catch snaps in ("shk-CLACK"), the
    // loudest and most metallic part of a reload. The seat lands at 60 ms.
    const o = buf(0.42)
    friction(o, r, { dur: 0.06, from: 1600, to: 3000, rate: 170, gain: 0.8 })
    contact(o, r, 0.06, 1, 2500)
    body(o, r, 0.06, 520, 2.2, 0.014, 1)
    ring(o, r, 0.061, 2300, 0.035, 0.45, 6)
    contact(o, r, 0.064, 0.5, 5000)
    spring(o, 0.062, 1150, 0.015, 0.06)
    rattle(o, r, 0.062, 0.03, 3, 0.15)
    return o
  },
  magTap: (r) => {
    // A palm slapped on the baseplate to be sure.
    const o = buf(0.25)
    body(o, r, 0, 360, 1.2, 0.012, 1)
    noiseLayer(o, r, { dur: 0.03, tau: 0.004, att: 0.0005, freq: 900, gain: 0.6 })
    contact(o, r, 0, 0.2)
    rattle(o, r, 0.004, 0.03, 3, 0.12)
    ring(o, r, 0.002, 1700, 0.015, 0.12, 4)
    return o
  },
  chargePull: (r) => {
    // Unlatch, drag the carrier back against the buffer spring, hit the stop.
    const o = buf(0.36)
    contact(o, r, 0, 0.5, 3500)
    ring(o, r, 0, 2900, 0.01, 0.2, 4)
    friction(o, r, { start: 0.012, dur: 0.11, from: 2000, to: 3400, rate: 220, gain: 0.8 })
    toneLayer(o, { start: 0.015, dur: 0.11, tau: 0.08, att: 0.01, from: 700, to: 1100, gain: 0.04, wave: 'tri' })
    contact(o, r, 0.125, 0.6)
    ring(o, r, 0.126, 1700, 0.03, 0.4, 6)
    body(o, r, 0.125, 600, 2, 0.01, 0.4)
    return o
  },
  boltSlam: (r) => {
    // The carrier slams home and the lugs lock: a hard crack, the whole gun
    // thunking, steel ringing, the buffer spring humming after.
    const o = buf(0.5)
    contact(o, r, 0, 1.2, 2000)
    body(o, r, 0, 420, 1.6, 0.02, 1.2)
    ring(o, r, 0.001, 1450, 0.07, 0.8, 8)
    contact(o, r, 0.006, 0.4)
    ring(o, r, 0.007, 2650, 0.03, 0.35, 5)
    spring(o, 0.004, 620, 0.06, 0.07)
    rattle(o, r, 0.01, 0.05, 3, 0.12)
    return o
  },
  slideRelease: (r) => {
    // Slide stop down, the slide snapping forward onto a fresh round.
    const o = buf(0.36)
    contact(o, r, 0, 0.4, 4000)
    friction(o, r, { start: 0.004, dur: 0.02, from: 2500, to: 1800, rate: 300, gain: 0.5 })
    contact(o, r, 0.024, 1.1, 2200)
    body(o, r, 0.024, 480, 1.8, 0.014, 0.9)
    ring(o, r, 0.025, 1900, 0.05, 0.6, 7)
    spring(o, 0.026, 820, 0.04, 0.06)
    return o
  },
  boltUp: (r) => {
    const o = buf(0.16)
    contact(o, r, 0, 0.6, 3000)
    ring(o, r, 0.001, 2600, 0.014, 0.3, 5)
    friction(o, r, { start: 0.004, dur: 0.03, from: 2400, to: 2900, rate: 260, gain: 0.3 })
    return o
  },
  boltBack: (r) => {
    const o = buf(0.32)
    friction(o, r, { dur: 0.15, from: 1700, to: 3000, rate: 180, gain: 0.8 })
    contact(o, r, 0.15, 0.7)
    ring(o, r, 0.151, 1500, 0.035, 0.5, 6)
    return o
  },
  boltForward: (r) => {
    const o = buf(0.36)
    friction(o, r, { dur: 0.12, from: 3000, to: 1900, rate: 200, gain: 0.8 })
    contact(o, r, 0.12, 1)
    ring(o, r, 0.121, 1300, 0.05, 0.6, 7)
    body(o, r, 0.12, 500, 1.8, 0.012, 0.6)
    return o
  },
  boltDown: (r) => {
    const o = buf(0.2)
    contact(o, r, 0, 0.9, 2500)
    body(o, r, 0, 600, 2, 0.01, 0.7)
    ring(o, r, 0.001, 2200, 0.022, 0.35, 5)
    return o
  },
  cylinderOpen: (r) => {
    const o = buf(0.3)
    contact(o, r, 0, 0.6, 3500)
    friction(o, r, { start: 0.01, dur: 0.07, from: 2600, to: 1900, rate: 260, gain: 0.35 })
    contact(o, r, 0.08, 0.7)
    ring(o, r, 0.081, 1700, 0.04, 0.5, 6)
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
    friction(o, r, { dur: 0.06, from: 2000, to: 2500, rate: 240, gain: 0.4 })
    rattle(o, r, 0.02, 0.05, 6, 0.3)
    contact(o, r, 0.07, 0.7)
    ring(o, r, 0.071, 2000, 0.03, 0.4, 5)
    return o
  },
  cylinderClose: (r) => {
    const o = buf(0.35)
    contact(o, r, 0, 1.1, 2200)
    body(o, r, 0, 520, 1.8, 0.012, 0.8)
    ring(o, r, 0.001, 1800, 0.05, 0.6, 7)
    return o
  },
  pumpBack: (r) => {
    // Forend racked back: the action bars drag, the hull kicks out, the bolt hits the rear.
    const o = buf(0.26)
    contact(o, r, 0, 0.4)
    friction(o, r, { start: 0.004, dur: 0.08, from: 1300, to: 2400, rate: 140, gain: 0.85 })
    contact(o, r, 0.085, 0.9, 2200)
    body(o, r, 0.085, 420, 1.6, 0.014, 0.8)
    ring(o, r, 0.086, 1150, 0.045, 0.55, 7)
    return o
  },
  pumpForward: (r) => {
    // ...and slammed forward: the bolt locks with the loudest clack of the cycle.
    const o = buf(0.32)
    friction(o, r, { dur: 0.07, from: 2400, to: 1500, rate: 150, gain: 0.8 })
    contact(o, r, 0.072, 1.2, 2000)
    body(o, r, 0.072, 380, 1.5, 0.018, 1.1)
    ring(o, r, 0.073, 1250, 0.06, 0.7, 8)
    spring(o, 0.075, 540, 0.04, 0.05)
    return o
  },
  shellInsert: (r) => {
    // A shell thumbed past the lifter into the tube: brass on steel, a click.
    const o = buf(0.22)
    friction(o, r, { dur: 0.04, from: 1600, to: 2600, rate: 220, gain: 0.5 })
    contact(o, r, 0.045, 0.8, 3000)
    body(o, r, 0.045, 700, 2, 0.01, 0.5)
    ring(o, r, 0.046, 2400, 0.02, 0.3, 5)
    spring(o, 0.046, 1400, 0.012, 0.04)
    return o
  },
  lidOpen: (r) => {
    const o = buf(0.36)
    contact(o, r, 0, 0.6, 3000)
    spring(o, 0.004, 700, 0.05, 0.08)
    ring(o, r, 0.04, 900, 0.06, 0.6, 7)
    body(o, r, 0.04, 450, 1.5, 0.015, 0.5)
    return o
  },
  lidClose: (r) => {
    const o = buf(0.42)
    contact(o, r, 0, 1.2, 2000)
    body(o, r, 0, 380, 1.4, 0.022, 1.1)
    ring(o, r, 0.001, 820, 0.08, 0.8, 8)
    contact(o, r, 0.015, 0.6, 4000)
    ring(o, r, 0.016, 2400, 0.02, 0.3, 4)
    return o
  },
  beltLay: (r) => {
    const o = buf(0.4)
    for (let i = 0; i < 7; i++) metalLayer(o, r, { start: i * 0.03 + r() * 0.01, base: 2800 + r() * 900, partials: [1, 2.2, 3.6], tau: 0.015, gain: 0.25 })
    return o
  },
  rocketSlide: (r) => {
    const o = buf(0.45)
    scrape(o, r, 0, 0.3, 700, 1200, 0.6)
    noiseLayer(o, r, { dur: 0.3, tau: 0.12, att: 0.05, freq: 500, gain: 0.3 })
    return o
  },
  rocketSeat: (r) => {
    const o = buf(0.35)
    contact(o, r, 0, 0.7, 1800)
    body(o, r, 0, 200, 1.2, 0.03, 1)
    ring(o, r, 0.003, 700, 0.06, 0.5, 6)
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
    // Boot on packed sand and grit: an unpitched heel knock, sand giving under
    // it with a crunch of grains, then the toe rolling off.
    const o = buf(0.26)
    thump(o, r, 0, 150 + r() * 60, 0.012, 0.42 + r() * 0.18)
    noiseLayer(o, r, { dur: 0.08, tau: 0.028, att: 0.005, type: 'bandpass', freq: 1300 + r() * 700, q: 0.9, gain: 0.55 })
    grains(o, r, 0.002, 0.06, 16 + Math.floor(r() * 8), 2200, 7000, 0.28)
    const toe = 0.07 + r() * 0.035
    noiseLayer(o, r, { start: toe, dur: 0.07, tau: 0.022, att: 0.008, type: 'bandpass', freq: 1700 + r() * 900, q: 1, gain: 0.32 })
    grains(o, r, toe, 0.045, 8 + Math.floor(r() * 6), 2600, 7500, 0.18)
    return o
  },
  ladderRung: (r) => {
    // Glove slapping onto a steel rung, the ladder humming against its brackets.
    const o = buf(0.35)
    thump(o, r, 0, 260, 0.01, 0.5)
    clank(o, r, { base: 560 + r() * 160, tau: 0.06, gain: 0.7, knock: 520, ring: 0.9 })
    noiseLayer(o, r, { dur: 0.04, tau: 0.01, att: 0.002, type: 'bandpass', freq: 1800, q: 1.2, gain: 0.4 })
    return o
  },
  stepMetal: (r) => {
    // Boot on a steel deck: a dull knock and the plate ringing under it.
    const o = buf(0.35)
    thump(o, r, 0, 200, 0.014, 0.45)
    clank(o, r, { base: 380 + r() * 120, tau: 0.07, gain: 0.55, knock: 450, ring: 0.8 })
    grains(o, r, 0.003, 0.04, 6, 3000, 7000, 0.15)
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
    const o = buf(0.35)
    thump(o, r, 0, 140, 0.03, 1.1)
    noiseLayer(o, r, { dur: 0.15, tau: 0.04, freq: 700, gain: 0.6 })
    grains(o, r, 0.002, 0.08, 18, 2000, 6500, 0.3)
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

/**
 * Peak level per foley sound. Normalising them all to the same peak made a
 * pouch rustle as loud as a bolt slamming home; real reloads go soft scrape,
 * soft scrape, CLACK.
 */
const FOLEY_LEVEL = {
  magRelease: 0.45,
  magOut: 0.6,
  magDrop: 0.45,
  magPouch: 0.32,
  magIn: 0.95,
  magTap: 0.6,
  chargePull: 0.7,
  boltSlam: 1,
  slideRelease: 0.9,
  boltUp: 0.5,
  boltBack: 0.65,
  boltForward: 0.8,
  boltDown: 0.7,
  pumpBack: 0.8,
  pumpForward: 0.95,
  shellInsert: 0.6,
  lidOpen: 0.6,
  lidClose: 0.9,
  beltLay: 0.45,
  cylinderOpen: 0.6,
  cylinderClose: 0.85,
  speedloader: 0.6,
  shellsDrop: 0.45,
  rocketSlide: 0.6,
  rocketSeat: 0.85,
}

/** name -> [render(seed) -> Float32Array], with how many variations to keep. */
/** The bank as [name, variant count, render(seed) -> Float32Array], in the order they're needed (gunshots first). */
export function bankRecipes() {
  return recipes()
}

function recipes() {
  const list = []
  for (const [id, p] of Object.entries(GUNS)) list.push([id, 4, (s) => gunshot(p, s)])
  list.push(['suppressedRifle', 3, (s) => suppressed('rifle', s)])
  list.push(['suppressedPistol', 3, (s) => suppressed('pistol', s)])
  list.push(['suppressedSniper', 2, (s) => suppressed('sniper', s)])
  const counts = { stepSand: 8, stepMetal: 4, ladderRung: 4, impact: 4, brass: 3, knifeSwing: 3, knifeHit: 2, breathIn: 2, breathOut: 2, magIn: 3, boltSlam: 3, magOut: 3, chargePull: 3 }
  for (const [name, fn] of Object.entries(FOLEY)) {
    list.push([name, counts[name] ?? 2, (s) => finish(fn(rng(s)), { level: FOLEY_LEVEL[name] ?? 0.85 })])
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
 * Key moments of a magazine reload, as fractions of its length. The viewmodel
 * animates from these and the foley below is cued from them, so the click is
 * heard exactly when the mag seats. An empty reload is quicker through the
 * mag change because it still has the charging handle (or slide) to work.
 */
export const RELOAD_KEYS = Object.freeze({
  tactical: Object.freeze({ release: 0.08, out: 0.14, fallEnd: 0.34, pouch: 0.36, seat: 0.62, tap: 0.68 }),
  empty: Object.freeze({ release: 0.05, out: 0.1, fallEnd: 0.26, pouch: 0.28, seat: 0.5, tap: 0.56, charge: 0.72, slam: 0.84 }),
})

/** magIn's seat lands 60 ms into the sound; with the reload's length known, cue it that early. */
const SEAT_LEAD = 0.06
/** The dropped mag hits the ground this long after it leaves the well. */
const DROP_FALL = 0.34

/** A magazine reload's foley from the keys: the mag change, then (empty) the bolt. */
function magFoley(empty, { pouch = true, tap = true, bolt = 'carbine', drop = true } = {}) {
  const k = RELOAD_KEYS[empty ? 'empty' : 'tactical']
  const ev = [[k.release, 'magRelease'], [k.out, 'magOut'], [k.seat, 'magIn', SEAT_LEAD]]
  if (pouch) ev.push([k.pouch, 'magPouch'])
  if (tap) ev.push([k.tap, 'magTap'])
  if (empty && drop) ev.push([k.out, 'magDrop', -DROP_FALL])
  if (empty && bolt === 'carbine') ev.push([k.charge, 'chargePull'], [k.slam, 'boltSlam'])
  if (empty && bolt === 'slide') ev.push([k.slam, 'slideRelease'])
  return ev
}

/**
 * Reload foley per weapon, as [fraction of the reload time, sound, lead in
 * seconds]: the lead shifts a sound earlier (or later, if negative) so its
 * key moment lands on the fraction.
 */
export const RELOAD_FOLEY = {
  ar: { tactical: magFoley(false), empty: magFoley(true) },
  hornet: { tactical: magFoley(false, { pouch: false, tap: false }), empty: magFoley(true, { pouch: false, tap: false }) },
  pistol: { tactical: magFoley(false, { pouch: false, tap: false }), empty: magFoley(true, { pouch: false, tap: false, bolt: 'slide' }) },
  smg: { tactical: magFoley(false, { pouch: false }), empty: magFoley(true, { pouch: false }) },
  // Feed cover up, box swapped, belt laid on the tray, cover slammed (charged first when empty).
  lmg: {
    tactical: [[0.05, 'lidOpen'], [0.1, 'magRelease'], [0.14, 'magOut'], [0.36, 'magPouch'], [0.62, 'magIn', SEAT_LEAD], [0.72, 'beltLay'], [0.82, 'lidClose']],
    empty: [[0.02, 'chargePull'], [0.07, 'lidOpen'], [0.11, 'magRelease'], [0.14, 'magOut'], [0.14, 'magDrop', -DROP_FALL], [0.36, 'magPouch'], [0.62, 'magIn', SEAT_LEAD], [0.72, 'beltLay'], [0.82, 'lidClose']],
  },
  rpg: {
    tactical: [[0.12, 'weaponRaise'], [0.42, 'rocketSlide'], [0.68, 'rocketSeat']],
  },
  sniper: {
    tactical: [[0.03, 'boltUp'], [0.07, 'boltBack'], [0.14, 'magOut'], [0.62, 'magIn', SEAT_LEAD], [0.8, 'boltForward'], [0.9, 'boltDown']],
  },
  viper: {
    tactical: [[0.08, 'cylinderOpen'], [0.2, 'shellsDrop'], [0.55, 'speedloader'], [0.8, 'cylinderClose']],
  },
}

/**
 * Foley events for a reload of `duration` seconds. Shotguns load a shell at a
 * time, so theirs is built from the shell count (and racked if it was empty).
 */
export const reloadFoley = (weaponId, empty, duration = 0, shell = null) => {
  if (shell && duration > 0) {
    // Whole shells only: an empty reload has a little extra on the end for the rack.
    const shells = Math.max(1, Math.floor((duration - shell.start) / shell.time + 0.01))
    const events = []
    for (let k = 0; k < shells; k++) events.push([(shell.start + (k + 0.6) * shell.time) / duration, 'shellInsert'])
    if (empty) events.push([Math.max(0, 1 - 0.27 / duration), 'pumpBack'], [Math.max(0, 1 - 0.12 / duration), 'pumpForward'])
    return events
  }
  const f = RELOAD_FOLEY[weaponId]
  if (!f) return []
  const list = (empty && f.empty) || f.tactical
  // Leads are in seconds: without a duration, fall back to a typical reload.
  const d = duration > 0 ? duration : 2.4
  return list.map(([at, name, lead = 0]) => [Math.min(0.98, Math.max(0, at - lead / d)), name]).sort((p, q) => p[0] - q[0])
}
