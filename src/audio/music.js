/**
 * Background score: a 16-bar war loop in D minor, rendered once in an
 * OfflineAudioContext (string pads, a low drone, taiko war drums, snare rolls,
 * a tense string ostinato and a brass motif), then looped seamlessly.
 */

const BPM = 80
const BEAT = 60 / BPM
const BAR = BEAT * 4
const BARS = 16
const LOOP = BAR * BARS
const TAIL = 4

const NOTE = { C: 0, 'C#': 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 }
const hz = (name, octave) => 440 * Math.pow(2, (NOTE[name] + (octave + 1) * 12 - 69) / 12)

/** Two-bar chords: Dm, Bb, Gm, A — then Dm, F, C, A for the second half. */
const CHORDS = [
  [['D', 3], ['F', 3], ['A', 3]],
  [['Bb', 2], ['D', 3], ['F', 3]],
  [['G', 2], ['Bb', 2], ['D', 3]],
  [['A', 2], ['C#', 3], ['E', 3]],
  [['D', 3], ['F', 3], ['A', 3]],
  [['F', 2], ['A', 2], ['C', 3]],
  [['C', 3], ['E', 3], ['G', 3]],
  [['A', 2], ['C#', 3], ['E', 3]],
]

function noiseBuffer(ctx) {
  const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const d = b.getChannelData(0)
  let s = 12345
  for (let i = 0; i < d.length; i++) {
    s = (s * 16807) % 2147483647
    d[i] = (s / 2147483647) * 2 - 1
  }
  return b
}

function pad(ctx, dest, freq, start, dur, gain, pan) {
  const g = ctx.createGain()
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(700, start)
  lp.frequency.linearRampToValueAtTime(1300, start + dur * 0.5)
  lp.frequency.linearRampToValueAtTime(800, start + dur)
  const p = ctx.createStereoPanner()
  p.pan.value = pan
  g.gain.setValueAtTime(0, start)
  g.gain.linearRampToValueAtTime(gain, start + 1.2)
  g.gain.setValueAtTime(gain, start + dur - 0.3)
  g.gain.linearRampToValueAtTime(0, start + dur + 1.4)
  for (const detune of [-9, 0, 8]) {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = freq
    o.detune.value = detune
    o.connect(lp)
    o.start(start)
    o.stop(start + dur + 1.5)
  }
  lp.connect(g)
  g.connect(p)
  p.connect(dest)
}

function drone(ctx, dest, freq, start, dur) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, start)
  g.gain.linearRampToValueAtTime(0.16, start + 0.8)
  g.gain.setValueAtTime(0.16, start + dur - 0.2)
  g.gain.linearRampToValueAtTime(0, start + dur + 1)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 260
  for (const [type, mul, lvl] of [['sine', 1, 1], ['sawtooth', 1, 0.35], ['sine', 0.5, 0.6]]) {
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.value = freq * mul
    const og = ctx.createGain()
    og.gain.value = lvl
    o.connect(og)
    og.connect(lp)
    o.start(start)
    o.stop(start + dur + 1.1)
  }
  lp.connect(g)
  g.connect(dest)
}

function taiko(ctx, dest, noise, t, vel) {
  const o = ctx.createOscillator()
  o.frequency.setValueAtTime(68, t)
  o.frequency.exponentialRampToValueAtTime(36, t + 0.35)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.9 * vel, t + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
  o.connect(g)
  g.connect(dest)
  o.start(t)
  o.stop(t + 0.65)
  const n = ctx.createBufferSource()
  n.buffer = noise
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 420
  const ng = ctx.createGain()
  ng.gain.setValueAtTime(0.0001, t)
  ng.gain.exponentialRampToValueAtTime(0.6 * vel, t + 0.002)
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
  n.connect(lp)
  lp.connect(ng)
  ng.connect(dest)
  n.start(t, Math.random())
  n.stop(t + 0.2)
}

function snare(ctx, dest, noise, t, vel) {
  const n = ctx.createBufferSource()
  n.buffer = noise
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1900
  bp.Q.value = 0.8
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.32 * vel, t + 0.002)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
  n.connect(bp)
  bp.connect(g)
  g.connect(dest)
  n.start(t, Math.random())
  n.stop(t + 0.1)
}

function pluck(ctx, dest, freq, t, vel) {
  const o = ctx.createOscillator()
  o.type = 'sawtooth'
  o.frequency.value = freq
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(1800, t)
  lp.frequency.exponentialRampToValueAtTime(500, t + 0.15)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.09 * vel, t + 0.006)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
  o.connect(lp)
  lp.connect(g)
  g.connect(dest)
  o.start(t)
  o.stop(t + 0.22)
}

function brass(ctx, dest, freq, t, dur) {
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.Q.value = 1.2
  lp.frequency.setValueAtTime(300, t)
  lp.frequency.linearRampToValueAtTime(1600, t + dur * 0.6)
  lp.frequency.linearRampToValueAtTime(600, t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(0.12, t + dur * 0.4)
  g.gain.linearRampToValueAtTime(0, t + dur + 0.3)
  for (const [mul, detune] of [[1, -5], [1, 6], [1.5, 0]]) {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = freq * mul
    o.detune.value = detune
    o.connect(lp)
    o.start(t)
    o.stop(t + dur + 0.4)
  }
  lp.connect(g)
  g.connect(dest)
}

function swell(ctx, dest, noise, t, dur) {
  const n = ctx.createBufferSource()
  n.buffer = noise
  n.loop = true
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 5000
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.12, t + dur)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.4)
  n.connect(hp)
  hp.connect(g)
  g.connect(dest)
  n.start(t)
  n.stop(t + dur + 0.5)
}

/** Renders the loop; resolves to a stereo AudioBuffer exactly LOOP seconds long. */
export async function renderMusic(sampleRate = 44100) {
  const ctx = new OfflineAudioContext(2, Math.ceil((LOOP + TAIL) * sampleRate), sampleRate)
  const noise = noiseBuffer(ctx)
  const bus = ctx.createGain()
  bus.gain.value = 0.8
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -16
  comp.ratio.value = 3
  bus.connect(comp)
  comp.connect(ctx.destination)

  for (let c = 0; c < 8; c++) {
    const start = c * 2 * BAR
    const chord = CHORDS[c]
    chord.forEach(([n, o], i) => pad(ctx, bus, hz(n, o), start, 2 * BAR, 0.035, (i - 1) * 0.35))
    drone(ctx, bus, hz(chord[0][0], 1), start, 2 * BAR)
  }
  // War drums from bar 3: a heavy pattern on the 16th grid.
  const hits = [[0, 1], [6, 0.6], [8, 0.9], [11, 0.45], [12, 0.8], [14, 0.4]]
  for (let bar = 2; bar < BARS; bar++) {
    for (const [step, vel] of hits) taiko(ctx, bus, noise, bar * BAR + (step * BEAT) / 4, vel)
    // Snare roll building into every fourth bar.
    if (bar % 4 === 3) {
      for (let s = 8; s < 16; s++) snare(ctx, bus, noise, bar * BAR + (s * BEAT) / 4, 0.3 + ((s - 8) / 8) * 0.7)
    }
  }
  // Tense string ostinato from bar 5: root and fifth in eighths.
  for (let bar = 4; bar < BARS; bar++) {
    const chord = CHORDS[Math.floor(bar / 2)]
    for (let e = 0; e < 8; e++) {
      const [n, o] = e % 4 === 3 ? chord[2] : chord[0]
      pluck(ctx, bus, hz(n, o + 1), bar * BAR + (e * BEAT) / 2, e % 2 === 0 ? 1 : 0.6)
    }
  }
  // Brass motif over the second half, with a cymbal swell leading in.
  swell(ctx, bus, noise, 6 * BAR, 2 * BAR)
  const motif = [['D', 3, 2], ['F', 3, 1], ['E', 3, 1], ['D', 3, 2], ['A', 2, 2]]
  let t = 8 * BAR
  for (const [n, o, bars] of motif) {
    brass(ctx, bus, hz(n, o), t, bars * BAR - 0.2)
    t += bars * BAR
  }

  const rendered = await ctx.startRendering()
  // Fold the tail back onto the start so the loop point is seamless.
  const len = Math.ceil(LOOP * sampleRate)
  const out = new AudioBuffer({ length: len, numberOfChannels: 2, sampleRate })
  for (let ch = 0; ch < 2; ch++) {
    const src = rendered.getChannelData(ch)
    const dst = out.getChannelData(ch)
    dst.set(src.subarray(0, len))
    for (let i = len; i < src.length; i++) dst[i - len] += src[i]
  }
  return out
}
