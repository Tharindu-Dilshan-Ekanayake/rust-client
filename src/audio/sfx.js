/**
 * Sound effects and music (Web Audio). No audio files: the sound bank
 * (audio/bank.js) renders layered gunshots, foley and explosions into buffers
 * when audio starts, the score (audio/music.js) is rendered offline, and a few
 * simple UI blips are still synthesised live.
 *
 * Everything shares one outdoor reverb, and distant sounds arrive late (speed
 * of sound) and muffled.
 *
 * World sounds are positional (PannerNode + a distance low-pass so far gunfire
 * sounds muffled); UI sounds are not.
 */

import { WEAPONS } from '../shared/weapons.js'
import { buildBank } from './bank.js'
import { renderMusic } from './music.js'

let ctx = null
let master = null
let sfxBus = null
let reverbIn = null
let musicGain = null
let noiseBuffer = null
let volume = 0.8
let ringing = null
/** name -> AudioBuffer[] once rendered. */
let bank = null
let musicBuffer = null
let musicSource = null
let musicVolume = 0.3
let musicMode = 'menu'
let ambienceTimer = 0
/** The map's own ambience (game/ambience.js), or null for the distant battle. */
let ambience = null
/** The looping bed under a map's ambience: { src, gain } while it plays. */
let bed = null
let bedTimer = 0
let bellTimer = 0

/** Generated outdoor impulse response: a few hard early reflections, then a dusty tail. */
function outdoorIR(c) {
  const len = Math.floor(c.sampleRate * 1.9)
  const ir = c.createBuffer(2, len, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch)
    let lp = 0
    for (let i = 0; i < len; i++) {
      const t = i / c.sampleRate
      // Darker as it decays: air and sand soak up the highs.
      const k = 0.15 + 0.6 * Math.exp(-t * 3)
      lp += ((Math.random() * 2 - 1) - lp) * k
      d[i] = lp * Math.exp(-t * 3.2) * (t < 0.012 ? t / 0.012 : 1)
    }
    // Early reflections as short scattered bursts (a wall of sandbags and
    // containers is rough, not a mirror). Single-sample spikes combed every
    // shot through them into a hollow, tin-can colour.
    for (const [at, g] of [[0.021, 0.5], [0.037, 0.36], [0.061, 0.28], [0.094, 0.2], [0.15, 0.13]]) {
      const j = Math.floor((at + ch * 0.004) * c.sampleRate)
      const spread = Math.floor(0.006 * c.sampleRate)
      for (let k = 0; k < spread && j + k < len; k++) d[j + k] += (Math.random() * 2 - 1) * g * 0.45 * Math.exp(-k / (0.0015 * c.sampleRate))
    }
  }
  return ir
}

function ensure() {
  if (ctx) return ctx
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = volume
  // A gentle compressor keeps eight players' worth of gunfire from clipping.
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.ratio.value = 4
  comp.attack.value = 0.003
  comp.release.value = 0.15
  sfxBus = ctx.createGain()
  sfxBus.connect(comp)
  comp.connect(master)
  // Brick-wall-ish limiter on the very end so stacked gunfire never clips.
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -3
  limiter.knee.value = 0
  limiter.ratio.value = 20
  limiter.attack.value = 0.001
  limiter.release.value = 0.08
  master.connect(limiter)
  limiter.connect(ctx.destination)

  const convolver = ctx.createConvolver()
  convolver.buffer = outdoorIR(ctx)
  reverbIn = ctx.createGain()
  reverbIn.gain.value = 0.6
  reverbIn.connect(convolver)
  convolver.connect(comp)

  musicGain = ctx.createGain()
  musicGain.gain.value = 0
  musicGain.connect(master)

  startBank(ctx)
  renderMusic(ctx.sampleRate)
    .then((buffer) => {
      musicBuffer = buffer
      startMusic()
    })
    .catch((err) => console.warn('[audio] music render failed', err))

  const len = ctx.sampleRate * 2
  noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  return ctx
}

/**
 * Fills the sound bank from a worker (so rendering it never stutters the game),
 * a sound at a time; anything not ready yet falls back to the live synth.
 */
function startBank(c) {
  bank = new Map()
  const fallback = () =>
    buildBank(c).then((b) => {
      for (const [k, v] of b) bank.set(k, v)
    })
  let worker = null
  try {
    worker = new Worker(new URL('./bankWorker.js', import.meta.url), { type: 'module' })
  } catch {
    fallback()
    return
  }
  worker.onmessage = (e) => {
    const { name, variants, sampleRate, done } = e.data
    if (done) {
      worker.terminate()
      return
    }
    bank.set(
      name,
      variants.map((d) => {
        // Mono, or [left, right] for the wide first-person gunshots.
        const channels = Array.isArray(d) ? d : [d]
        const b = c.createBuffer(channels.length, channels[0].length, sampleRate)
        channels.forEach((ch, i) => b.copyToChannel(ch, i))
        return b
      }),
    )
  }
  worker.onerror = (err) => {
    console.warn('[audio] bank worker failed, rendering here instead', err.message)
    worker.terminate()
    fallback()
  }
  worker.postMessage('go')
}

/** Call from any user gesture: browsers keep audio suspended until one happens. */
export function unlockAudio() {
  const c = ensure()
  if (c && c.state === 'suspended') c.resume()
}

export function setVolume(v) {
  volume = v
  if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05)
}

export function setListener(pos, forward, up) {
  if (!ctx) return
  const l = ctx.listener
  const t = ctx.currentTime
  if (l.positionX) {
    l.positionX.setValueAtTime(pos.x, t)
    l.positionY.setValueAtTime(pos.y, t)
    l.positionZ.setValueAtTime(pos.z, t)
    l.forwardX.setValueAtTime(forward.x, t)
    l.forwardY.setValueAtTime(forward.y, t)
    l.forwardZ.setValueAtTime(forward.z, t)
    l.upX.setValueAtTime(up.x, t)
    l.upY.setValueAtTime(up.y, t)
    l.upZ.setValueAtTime(up.z, t)
  } else {
    l.setPosition(pos.x, pos.y, pos.z)
    l.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z)
  }
}

let listenerPos = { x: 0, y: 0, z: 0 }
export function setListenerPosition(pos) {
  listenerPos = pos
}

/**
 * Output chain for one sound: optional 3D panner + distance low-pass.
 * Returns the node sources should connect to, or null if audio is unavailable.
 */
function output(opts = {}, reverbSend = 0) {
  if (!ensure()) return null
  const gain = ctx.createGain()
  gain.gain.value = opts.volume ?? 1
  let dist = 0
  if (opts.pos) {
    const dx = opts.pos[0] - listenerPos.x
    const dy = opts.pos[1] - listenerPos.y
    const dz = opts.pos[2] - listenerPos.z
    dist = Math.hypot(dx, dy, dz)
    if (dist > (opts.maxDistance ?? 90)) return null
    const panner = ctx.createPanner()
    panner.panningModel = 'equalpower'
    panner.distanceModel = 'inverse'
    panner.refDistance = opts.ref ?? 4
    panner.rolloffFactor = opts.rolloff ?? 1.1
    panner.maxDistance = 200
    if (panner.positionX) {
      panner.positionX.value = opts.pos[0]
      panner.positionY.value = opts.pos[1]
      panner.positionZ.value = opts.pos[2]
    } else {
      panner.setPosition(opts.pos[0], opts.pos[1], opts.pos[2])
    }
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = Math.max(900, 18000 - dist * 420)
    gain.connect(lp)
    lp.connect(panner)
    panner.connect(sfxBus)
    // Far away, more of what you hear is the echo.
    if (reverbSend > 0) {
      const send = ctx.createGain()
      send.gain.value = Math.min(1, reverbSend * (1 + dist / 25)) * (opts.volume ?? 1)
      lp.connect(send)
      send.connect(reverbIn)
    }
  } else {
    gain.connect(sfxBus)
    if (reverbSend > 0) {
      const send = ctx.createGain()
      send.gain.value = reverbSend
      gain.connect(send)
      send.connect(reverbIn)
    }
  }
  gain.dist = dist
  return gain
}

function noise(dest, { start = 0, dur = 0.1, type = 'bandpass', freq = 1000, q = 0.7, peak = 1, attack = 0.002, sweepTo, rate = 1 }) {
  const t = ctx.currentTime + start
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer
  src.playbackRate.value = rate
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.setValueAtTime(freq, t)
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur)
  f.Q.value = q
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f)
  f.connect(g)
  g.connect(dest)
  src.start(t, Math.random() * 1.5)
  src.stop(t + dur + 0.05)
}

function tone(dest, { start = 0, dur = 0.1, type = 'sine', from = 440, to, peak = 0.5, attack = 0.002 }) {
  const t = ctx.currentTime + start
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(from, t)
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g)
  g.connect(dest)
  osc.start(t)
  osc.stop(t + dur + 0.05)
}

function echo(dest, delay = 0.22, feedback = 0.35, cutoff = 1400) {
  const d = ctx.createDelay(1)
  d.delayTime.value = delay
  const fb = ctx.createGain()
  fb.gain.value = feedback
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = cutoff
  const input = ctx.createGain()
  input.connect(dest)
  input.connect(d)
  d.connect(lp)
  lp.connect(fb)
  fb.connect(d)
  lp.connect(dest)
  // Break the feedback loop after the tail so nodes can be collected.
  setTimeout(() => fb.disconnect(), 2500)
  return input
}

const SOUNDS = {
  ar(out) {
    noise(out, { dur: 0.09, freq: 1700, q: 0.9, peak: 0.9 })
    noise(out, { dur: 0.025, type: 'highpass', freq: 4200, peak: 0.6 })
    tone(out, { dur: 0.07, from: 150, to: 55, peak: 0.8 })
  },
  sniper(out) {
    const wet = echo(out, 0.24, 0.32, 1600)
    noise(wet, { dur: 0.38, type: 'lowpass', freq: 2600, sweepTo: 600, peak: 1 })
    noise(wet, { dur: 0.03, type: 'highpass', freq: 3500, peak: 0.8 })
    tone(wet, { dur: 0.28, from: 85, to: 32, peak: 1 })
  },
  pistol(out) {
    noise(out, { dur: 0.06, type: 'highpass', freq: 1300, peak: 0.75 })
    tone(out, { dur: 0.045, from: 230, to: 90, peak: 0.55 })
  },
  viper(out) {
    // Big-bore revolver: a fat crack with a short slap-back off the walls.
    const wet = echo(out, 0.16, 0.22, 1800)
    noise(wet, { dur: 0.16, type: 'lowpass', freq: 3200, sweepTo: 700, peak: 1 })
    noise(wet, { dur: 0.03, type: 'highpass', freq: 3000, peak: 0.7 })
    tone(wet, { dur: 0.16, from: 120, to: 42, peak: 0.95 })
  },
  hornet(out) {
    noise(out, { dur: 0.055, type: 'highpass', freq: 1900, peak: 0.7 })
    noise(out, { dur: 0.04, freq: 2600, q: 1.2, peak: 0.45 })
    tone(out, { dur: 0.04, from: 260, to: 120, peak: 0.45 })
  },
  suppressed(out, opts) {
    // Muffled thump plus the action cycling: what a can actually sounds like.
    const rate = opts?.rate ?? 1
    noise(out, { dur: 0.07, type: 'lowpass', freq: 900 * rate, peak: 0.5, rate })
    noise(out, { start: 0.012, dur: 0.03, freq: 3200 * rate, q: 4, peak: 0.22 })
    tone(out, { dur: 0.05, from: 110 * rate, to: 60, peak: 0.35 })
  },
  slide(out) {
    // Boots and cloth scraping across sand, fading as the slide bleeds off speed.
    noise(out, { dur: 0.6, freq: 1100, sweepTo: 380, q: 0.55, peak: 0.5, attack: 0.03 })
    noise(out, { dur: 0.5, type: 'lowpass', freq: 320, peak: 0.35, attack: 0.02 })
  },
  prone(out) {
    noise(out, { dur: 0.28, type: 'lowpass', freq: 650, peak: 0.45, attack: 0.02 })
    noise(out, { start: 0.1, dur: 0.12, freq: 1900, q: 2, peak: 0.16 })
  },
  stance(out) {
    noise(out, { dur: 0.12, freq: 1400, q: 1.5, peak: 0.18, attack: 0.01 })
  },
  /** Ragged breath in through the mouth (low health). */
  breathIn(out, opts) {
    const k = opts?.strength ?? 1
    noise(out, { dur: 0.55, freq: 1150, sweepTo: 1750, q: 0.9, peak: 0.2 * k, attack: 0.22 })
    noise(out, { dur: 0.5, type: 'lowpass', freq: 520, peak: 0.08 * k, attack: 0.2 })
  },
  breathOut(out, opts) {
    const k = opts?.strength ?? 1
    noise(out, { dur: 0.75, freq: 950, sweepTo: 520, q: 0.8, peak: 0.24 * k, attack: 0.05 })
    tone(out, { dur: 0.3, type: 'triangle', from: 140, to: 95, peak: 0.03 * k, attack: 0.05 })
  },
  heartbeat(out, opts) {
    const k = opts?.strength ?? 1
    tone(out, { dur: 0.13, from: 62, to: 42, peak: 0.55 * k, attack: 0.01 })
    tone(out, { start: 0.2, dur: 0.15, from: 55, to: 38, peak: 0.4 * k, attack: 0.01 })
  },
  /** Sharp intake of breath when a bullet lands. */
  gasp(out) {
    noise(out, { dur: 0.2, freq: 1500, sweepTo: 2100, q: 1.1, peak: 0.3, attack: 0.015 })
  },
  /** A spent case bouncing on the ground. */
  brass(out) {
    tone(out, { dur: 0.05, type: 'triangle', from: 3900, peak: 0.08 })
    tone(out, { start: 0.07, dur: 0.04, type: 'triangle', from: 5200, peak: 0.05 })
    tone(out, { start: 0.12, dur: 0.03, type: 'triangle', from: 4600, peak: 0.03 })
  },
  /** Heavy landing from a big drop. */
  bonecrunch(out) {
    tone(out, { dur: 0.22, from: 90, to: 38, peak: 0.9, attack: 0.004 })
    noise(out, { dur: 0.16, type: 'lowpass', freq: 700, peak: 0.7, attack: 0.003 })
    noise(out, { start: 0.02, dur: 0.06, freq: 2400, q: 3, peak: 0.25 })
  },
  cylinder(out) {
    for (let i = 0; i < 3; i++) noise(out, { start: i * 0.06, dur: 0.025, freq: 3600, q: 7, peak: 0.18 })
  },
  bolt(out) {
    noise(out, { start: 0.0, dur: 0.04, freq: 2600, q: 3, peak: 0.25 })
    noise(out, { start: 0.22, dur: 0.05, freq: 1900, q: 3, peak: 0.3 })
  },
  swoosh(out) {
    noise(out, { dur: 0.2, freq: 700, sweepTo: 3200, q: 1.4, peak: 0.45, attack: 0.05 })
  },
  stab(out) {
    tone(out, { dur: 0.13, from: 95, to: 40, peak: 0.8 })
    noise(out, { dur: 0.08, type: 'lowpass', freq: 450, peak: 0.6 })
  },
  explosion(out) {
    const wet = echo(out, 0.3, 0.3, 700)
    noise(wet, { dur: 1.5, type: 'lowpass', freq: 1100, sweepTo: 140, peak: 1, attack: 0.005 })
    noise(wet, { dur: 0.08, type: 'highpass', freq: 2500, peak: 0.5 })
    tone(wet, { dur: 1.1, from: 60, to: 24, peak: 1 })
  },
  flashbang(out) {
    noise(out, { dur: 0.35, type: 'highpass', freq: 900, peak: 1 })
    tone(out, { dur: 0.2, from: 120, to: 50, peak: 0.6 })
  },
  smokePop(out) {
    noise(out, { dur: 0.08, freq: 600, peak: 0.5 })
    noise(out, { start: 0.05, dur: 1.6, type: 'highpass', freq: 2600, peak: 0.18, attack: 0.15 })
  },
  hitmarker(out) {
    tone(out, { dur: 0.035, type: 'square', from: 2600, peak: 0.12 })
  },
  headshot(out) {
    tone(out, { dur: 0.04, type: 'square', from: 3400, peak: 0.14 })
    tone(out, { start: 0.03, dur: 0.06, type: 'triangle', from: 1800, peak: 0.12 })
  },
  killConfirm(out) {
    tone(out, { dur: 0.05, type: 'square', from: 1500, peak: 0.12 })
    tone(out, { start: 0.06, dur: 0.09, type: 'square', from: 2300, peak: 0.12 })
  },
  killHead(out) {
    tone(out, { dur: 0.05, type: 'square', from: 1500, peak: 0.12 })
    tone(out, { start: 0.04, dur: 0.12, type: 'triangle', from: 2400, peak: 0.12 })
  },
  /** Promotion: a short rising bugle-ish triad over a low swell. */
  rankUp(out) {
    tone(out, { dur: 0.9, type: 'triangle', from: 110, peak: 0.16, attack: 0.08 })
    for (const [i, f] of [392, 523, 659, 784].entries()) {
      tone(out, { start: i * 0.11, dur: i === 3 ? 0.7 : 0.16, type: 'sawtooth', from: f, peak: 0.05 })
      tone(out, { start: i * 0.11, dur: i === 3 ? 0.8 : 0.18, type: 'triangle', from: f, peak: 0.12 })
    }
  },
  hurt(out) {
    tone(out, { dur: 0.16, from: 120, to: 60, peak: 0.6 })
    noise(out, { dur: 0.12, type: 'lowpass', freq: 600, peak: 0.4 })
  },
  magOut(out) {
    noise(out, { dur: 0.04, freq: 2200, q: 4, peak: 0.3 })
    tone(out, { dur: 0.05, type: 'triangle', from: 600, to: 400, peak: 0.12 })
  },
  magIn(out) {
    noise(out, { dur: 0.05, freq: 1600, q: 4, peak: 0.4 })
    noise(out, { start: 0.09, dur: 0.035, freq: 3000, q: 5, peak: 0.3 })
  },
  dryFire(out) {
    noise(out, { dur: 0.025, freq: 3500, q: 6, peak: 0.25 })
  },
  swap(out) {
    noise(out, { dur: 0.05, freq: 1300, q: 3, peak: 0.22 })
  },
  pin(out) {
    tone(out, { dur: 0.06, type: 'triangle', from: 2400, to: 1900, peak: 0.15 })
    noise(out, { start: 0.04, dur: 0.04, freq: 4000, q: 6, peak: 0.12 })
  },
  throw(out) {
    noise(out, { dur: 0.15, freq: 500, sweepTo: 1600, q: 1, peak: 0.25, attack: 0.04 })
  },
  footstep(out) {
    noise(out, { dur: 0.08, type: 'lowpass', freq: 650 + Math.random() * 250, peak: 0.35, attack: 0.005 })
  },
  land(out) {
    noise(out, { dur: 0.12, type: 'lowpass', freq: 420, peak: 0.6 })
    tone(out, { dur: 0.08, from: 90, to: 50, peak: 0.3 })
  },
  impact(out) {
    noise(out, { dur: 0.05, freq: 2500 + Math.random() * 1500, q: 2, peak: 0.25, rate: 1.4 })
  },
  pickup(out) {
    tone(out, { dur: 0.08, type: 'triangle', from: 880, peak: 0.18 })
    tone(out, { start: 0.08, dur: 0.12, type: 'triangle', from: 1320, peak: 0.18 })
  },
  uiClick(out) {
    tone(out, { dur: 0.025, type: 'square', from: 1150, peak: 0.07 })
  },
  uiHover(out) {
    tone(out, { dur: 0.018, type: 'sine', from: 1800, peak: 0.03 })
  },
  uiDeploy(out) {
    tone(out, { dur: 0.09, type: 'sawtooth', from: 300, to: 700, peak: 0.08 })
    tone(out, { start: 0.08, dur: 0.18, type: 'square', from: 900, peak: 0.06 })
  },
  countdown(out) {
    tone(out, { dur: 0.06, type: 'square', from: 900, peak: 0.07 })
  },
  /* Search & Destroy. */
  /** The planted bomb's beep (faster as it runs down; the caller times it). */
  bombBeep(out) {
    tone(out, { dur: 0.09, type: 'square', from: 2100, peak: 0.09 })
    tone(out, { dur: 0.12, type: 'sine', from: 2100, peak: 0.12 })
  },
  /** Arming: a click, then a rising two-tone chirp. */
  bombPlanted(out) {
    noise(out, { dur: 0.05, freq: 2600, q: 5, peak: 0.4 })
    tone(out, { start: 0.12, dur: 0.14, type: 'square', from: 1200, peak: 0.08 })
    tone(out, { start: 0.28, dur: 0.22, type: 'square', from: 1800, peak: 0.08 })
  },
  /** Disarmed: the beeping winds down. */
  bombDefused(out) {
    tone(out, { dur: 0.55, type: 'triangle', from: 1600, to: 300, peak: 0.16 })
    noise(out, { start: 0.05, dur: 0.05, freq: 3200, q: 6, peak: 0.25 })
  },
  /** Every half-second while planting or defusing. */
  plantTick(out) {
    noise(out, { dur: 0.03, freq: 3600, q: 8, peak: 0.18 })
  },
  /** The bomb going off, heard everywhere: a deep roll under the positioned blast. */
  bombBlast(out) {
    const wet = echo(out, 0.42, 0.42, 420)
    tone(wet, { dur: 2.4, from: 48, to: 18, peak: 1, attack: 0.01 })
    noise(wet, { dur: 2.8, type: 'lowpass', freq: 520, sweepTo: 70, peak: 0.9, attack: 0.02 })
  },
  /** A round about to start: low swell and two notes. */
  roundStart(out) {
    tone(out, { dur: 0.9, type: 'triangle', from: 98, peak: 0.14, attack: 0.1 })
    tone(out, { dur: 0.18, type: 'triangle', from: 440, peak: 0.12 })
    tone(out, { start: 0.2, dur: 0.3, type: 'triangle', from: 587, peak: 0.12 })
  },
  roundGo(out) {
    tone(out, { dur: 0.08, type: 'sawtooth', from: 330, to: 660, peak: 0.08 })
    tone(out, { start: 0.07, dur: 0.35, type: 'triangle', from: 880, peak: 0.16 })
  },
  roundWin(out) {
    for (const [i, f] of [523, 659, 784, 1047].entries()) tone(out, { start: i * 0.09, dur: i === 3 ? 0.7 : 0.14, type: 'triangle', from: f, peak: 0.14 })
    tone(out, { dur: 1, type: 'triangle', from: 131, peak: 0.14, attack: 0.06 })
  },
  roundLoss(out) {
    for (const [i, f] of [392, 349, 294].entries()) tone(out, { start: i * 0.16, dur: i === 2 ? 0.8 : 0.2, type: 'triangle', from: f, peak: 0.13 })
    tone(out, { dur: 1.1, type: 'sine', from: 73, peak: 0.16, attack: 0.08 })
  },
}

/**
 * Plays a named sound.
 * @param {keyof typeof SOUNDS} name
 * @param {{pos?: number[], volume?: number, ref?: number, maxDistance?: number, rate?: number}} [opts]
 */
export function play(name, opts) {
  if (!ensure() || ctx.state !== 'running') return
  // A gun without a voice of its own speaks with its family's, pitched and
  // weighted for it (a Volk is a deeper, heavier VX-7).
  const gun = WEAPONS[name]
  if (gun && !GUNS.has(name)) {
    const voice = gun.sound?.base ?? gun.base
    opts = { ...opts, rate: (opts?.rate ?? 1) * (gun.sound?.rate ?? 1), volume: (opts?.volume ?? 1) * (gun.sound?.gain ?? 1) }
    name = voice
  }
  const sequence = SEQUENCES[name]
  if (sequence && bank) {
    playSequence(sequence.map(([at, n]) => [at, n]), opts)
    return
  }
  if (GUNS.has(name) && bank?.get(name)) {
    playGun(name, opts)
    return
  }
  const banked = bank?.get(bankName(name, opts))
  if (banked) {
    playBuffer(banked, name, opts)
    return
  }
  const fn = SOUNDS[name]
  if (!fn) return
  const out = output(opts)
  if (out) fn(out, opts)
}

/** Which banked sound a play() name maps to (some depend on options). */
function bankName(name, opts) {
  if (name === 'suppressed') return opts?.kind === 'sniper' ? 'suppressedSniper' : opts?.kind === 'pistol' ? 'suppressedPistol' : 'suppressedRifle'
  if (name === 'footstep') return opts?.surface === 'metal' ? 'stepMetal' : 'stepSand'
  return ALIASES[name] ?? name
}

const ALIASES = { swoosh: 'knifeSwing', stab: 'knifeHit', swap: 'weaponRaise', cylinder: 'hammer' }

const GUNS = new Set(['ar', 'smg', 'lmg', 'hornet', 'pistol', 'viper', 'sniper', 'shotgun', 'rpg'])
/** Between these distances a gun crossfades from its close shot to its distant one (m). */
const FAR_FROM = 20
const FAR_TO = 38
/** A burst's ring-out plays once the gun has been quiet this long (longer than any auto gun's gap). */
const TAIL_AFTER_MS = 150
let tailTimer = 0

/**
 * A gunshot. Your own: the wide close shot, and the ring-out once you let go
 * of the trigger. Someone else's: their close shot near you, crossfading into
 * the distant pop-and-roll as they get further away.
 */
function playGun(name, opts = {}) {
  if (!opts.pos) {
    playBuffer(bank.get(name), name, opts)
    const tail = bank.get(`${name}Tail`)
    if (!tail) return
    clearTimeout(tailTimer)
    tailTimer = setTimeout(() => {
      if (ctx?.state === 'running') playBuffer(tail, 'tail', { volume: (opts.volume ?? 1) * 0.7 })
    }, TAIL_AFTER_MS)
    return
  }
  const dist = Math.hypot(opts.pos[0] - listenerPos.x, opts.pos[1] - listenerPos.y, opts.pos[2] - listenerPos.z)
  const far = bank.get(`${name}Far`) ? Math.min(1, Math.max(0, (dist - FAR_FROM) / (FAR_TO - FAR_FROM))) : 0
  const volume = opts.volume ?? 1
  if (far < 1) playBuffer(bank.get(name), name, { ...opts, volume: volume * Math.cos((far * Math.PI) / 2) })
  // The distant version carries further before it fades (the roll is low and loud).
  if (far > 0) playBuffer(bank.get(`${name}Far`), 'far', { ...opts, volume: volume * Math.sin((far * Math.PI) / 2), ref: (opts.ref ?? 4) * 1.6 })
}

/** Sounds that are really a few foley hits in a row (seconds). */
const SEQUENCES = {
  bolt: [[0, 'boltUp'], [0.08, 'boltBack'], [0.3, 'boltForward'], [0.43, 'boltDown']],
}

/** How much of each kind of sound goes to the reverb. */
function reverbFor(name) {
  // Hit markers are UI: bone dry, right in your ear.
  if (/^(hitmarker|headshot|killConfirm|killHead)$/.test(name)) return 0
  if (/^(ar|sniper|pistol|viper|hornet|smg|lmg|shotgun|rpg)$/.test(name)) return 0.32
  // The ring-out and the distant shot carry their own echoes.
  if (name === 'tail') return 0.08
  if (name === 'far') return 0.18
  if (name === 'bulletCrack') return 0.12
  if (name === 'suppressed') return 0.12
  if (/explosion|flashbang|distant/.test(name)) return 0.45
  // The night out in the woods: mostly echo.
  if (/^(churchBell|owl|crow|wolfHowl)$/.test(name)) return 0.35
  if (/footstep|breath|gasp|heartbeat/.test(name)) return 0.02
  return 0.06
}

function playBuffer(variants, name, opts = {}, when = 0) {
  const out = output(opts, reverbFor(name))
  if (!out) return
  const src = ctx.createBufferSource()
  src.buffer = variants[Math.floor(Math.random() * variants.length)]
  // A little pitch spread so repeats never sound copy-pasted.
  src.playbackRate.value = (opts.rate ?? 1) * (0.97 + Math.random() * 0.06)
  if (opts.strength !== undefined) out.gain.value *= 0.25 + opts.strength * 0.3
  src.connect(out)
  // Sound travels ~343 m/s: distant shots and blasts land after their flash.
  const travel = opts.pos ? Math.min(0.4, out.dist / 343) : 0
  src.start(ctx.currentTime + when + travel)
}

/** Plays [seconds, name] events, e.g. reload foley, optionally positioned. */
export function playSequence(events, opts = {}) {
  if (!ensure() || ctx.state !== 'running' || !bank) return
  for (const [at, name] of events) {
    const variants = bank.get(name)
    if (variants) playBuffer(variants, name, opts, at)
  }
}

/* ---------------------------------------------------------------------------
 * Music and the distant battle
 * ------------------------------------------------------------------------- */

function musicTarget() {
  // Quieter under gameplay so it never fights footsteps and gunfire.
  return musicVolume * (musicMode === 'match' ? 0.4 : 1) * 0.5
}

function startMusic() {
  if (!ctx || !musicBuffer || musicSource) return
  musicSource = ctx.createBufferSource()
  musicSource.buffer = musicBuffer
  musicSource.loop = true
  musicSource.connect(musicGain)
  musicSource.start()
  musicGain.gain.setTargetAtTime(musicTarget(), ctx.currentTime, 1.2)
}

export function setMusicVolume(v) {
  musicVolume = v
  if (musicGain) musicGain.gain.setTargetAtTime(musicTarget(), ctx.currentTime, 0.3)
}

/** 'menu' (full) or 'match' (ducked, plus the map's ambience). */
export function setMusicMode(mode) {
  if (mode === musicMode) return
  musicMode = mode
  if (musicGain) musicGain.gain.setTargetAtTime(musicTarget(), ctx.currentTime, 1.5)
  restartAmbience()
}

/** The map's ambience (game/ambience.js ambienceFor), or null for the distant battle. */
export function setAmbience(a) {
  if (a === ambience) return
  ambience = a
  restartAmbience()
}

function restartAmbience() {
  clearTimeout(ambienceTimer)
  clearTimeout(bellTimer)
  stopBed()
  if (musicMode !== 'match') return
  scheduleAmbience()
  if (ambience?.bed) startBed(ambience)
  if (ambience?.bell) scheduleBell(ambience, ambience.bell.first ?? 5)
}

/** A one-off ambient sound at `pos`, carried as far as it likes (`ref` sets how loud it stays). */
function playAmbient(name, pos, { volume = 1, ref = 8, rolloff = 1, rate, variant } = {}, when = 0) {
  const variants = bank?.get(name)
  if (!variants) return
  const out = output({ pos, volume, ref, rolloff, maxDistance: 400 }, reverbFor(name))
  if (!out) return
  const src = ctx.createBufferSource()
  src.buffer = variants[variant ?? Math.floor(Math.random() * variants.length)]
  src.playbackRate.value = rate ?? 0.94 + Math.random() * 0.12
  src.connect(out)
  src.start(ctx.currentTime + when + Math.min(0.4, out.dist / 343))
}

/** One of the map's calls (an owl, a crow, a wolf), from a random bearing round the middle of the map. */
function playCall(a) {
  const total = a.calls.reduce((s, c) => s + c.weight, 0)
  let pick = Math.random() * total
  const call = a.calls.find((c) => (pick -= c.weight) < 0) ?? a.calls[0]
  const bearing = Math.random() * Math.PI * 2
  const r = call.radius[0] + Math.random() * (call.radius[1] - call.radius[0])
  playAmbient(call.sound, [Math.cos(bearing) * r, call.height, Math.sin(bearing) * r], { volume: call.volume, ref: call.ref })
}

/** The bell tolling from its tower: a few strikes of the same bell, then quiet for a minute or two. */
function scheduleBell(a, delay) {
  bellTimer = setTimeout(() => {
    if (musicMode !== 'match' || ambience !== a) return
    const variants = bank?.get('churchBell')
    if (ctx?.state === 'running' && variants) {
      const { pos, strikes = 3, gap = 2.6, volume = 1, ref = 16 } = a.bell
      const variant = Math.floor(Math.random() * variants.length)
      for (let k = 0; k < strikes; k++) playAmbient('churchBell', pos, { volume, ref, rolloff: 0.7, rate: 1, variant }, k * gap)
    }
    const [lo, hi] = a.bell.every
    scheduleBell(a, lo + Math.random() * (hi - lo))
  }, delay * 1000)
}

/** The looped bed (wind, crickets) faded in under everything; waits for the bank if it isn't rendered yet. */
function startBed(a) {
  if (musicMode !== 'match' || ambience !== a || bed) return
  const variants = bank?.get(a.bed)
  if (ctx?.state !== 'running' || !variants) {
    bedTimer = setTimeout(() => startBed(a), 1000)
    return
  }
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, ctx.currentTime)
  gain.gain.setTargetAtTime(a.bedVolume ?? 0.2, ctx.currentTime, 1.2)
  gain.connect(sfxBus)
  const src = ctx.createBufferSource()
  src.buffer = variants[0]
  src.loop = true
  src.connect(gain)
  src.start()
  bed = { src, gain }
}

function stopBed() {
  clearTimeout(bedTimer)
  if (!bed) return
  const { src, gain } = bed
  bed = null
  gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4)
  setTimeout(() => {
    try {
      src.stop()
    } catch {
      // already stopped
    }
    gain.disconnect()
  }, 2500)
}

/** Every so often: the map's calls, or artillery and gunfire somewhere beyond the walls. */
function scheduleAmbience() {
  const a = ambience
  const wait = a?.calls ? (a.every[0] + Math.random() * (a.every[1] - a.every[0])) * 1000 : 7000 + Math.random() * 12000
  ambienceTimer = setTimeout(() => {
    if (musicMode !== 'match') return
    if (ctx?.state === 'running' && bank && a?.calls) playCall(a)
    else if (ctx?.state === 'running' && bank) {
      const artillery = Math.random() < 0.45
      const variants = bank.get(artillery ? 'distantArtillery' : 'distantBurst')
      const pan = ctx.createStereoPanner()
      pan.pan.value = Math.random() * 1.6 - 0.8
      const g = ctx.createGain()
      g.gain.value = (artillery ? 0.32 : 0.2) * (0.6 + Math.random() * 0.4)
      const src = ctx.createBufferSource()
      src.buffer = variants[Math.floor(Math.random() * variants.length)]
      src.playbackRate.value = 0.9 + Math.random() * 0.2
      src.connect(g)
      g.connect(pan)
      pan.connect(sfxBus)
      src.start()
    }
    scheduleAmbience()
  }, wait)
}

/** The flashbang ear-ring: a ~3 kHz tone that fades over `seconds`. */
export function ring(seconds, strength = 1) {
  if (!ensure() || ctx.state !== 'running') return
  if (ringing) {
    try {
      ringing.stop()
    } catch {
      // already stopped
    }
  }
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(3000, t)
  osc.frequency.linearRampToValueAtTime(2900, t + seconds)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.16 * strength, t + 0.03)
  g.gain.exponentialRampToValueAtTime(0.0001, t + seconds + 0.5)
  osc.connect(g)
  g.connect(master)
  // Duck everything else while the ears ring.
  sfxBus.gain.cancelScheduledValues(t)
  sfxBus.gain.setValueAtTime(0.2, t)
  sfxBus.gain.linearRampToValueAtTime(1, t + seconds)
  musicGain.gain.cancelScheduledValues(t)
  musicGain.gain.setValueAtTime(musicTarget() * 0.15, t)
  musicGain.gain.linearRampToValueAtTime(musicTarget(), t + seconds)
  osc.start(t)
  osc.stop(t + seconds + 0.6)
  ringing = osc
}

export const sfx = { audioStatus: () => audioStatus(), play, playSequence, ring, unlockAudio, setVolume, setMusicVolume, setMusicMode, setAmbience, setListener, setListenerPosition }

/** Debug/test hook: what's been rendered so far. */
export const audioStatus = () => ({
  running: ctx?.state === 'running',
  bankSounds: bank ? bank.size : 0,
  ambience: { mode: musicMode, bed: Boolean(bed), night: ['churchBell', 'owl', 'crow', 'wolfHowl', 'nightBed'].filter((n) => bank?.has(n)) },
  music: Boolean(musicBuffer),
  musicSeconds: musicBuffer ? +musicBuffer.duration.toFixed(1) : 0,
  levels: Object.fromEntries(
    [['music', musicBuffer], ...['ar', 'smg', 'lmg', 'shotgun', 'rpg', 'sniper', 'stepSand'].map((n) => [n, bank?.get(n)?.[0]])]
      .filter(([, b]) => b)
      .map(([n, b]) => {
        const d = b.getChannelData(0)
        let peak = 0
        let sum = 0
        for (let i = 0; i < d.length; i++) {
          peak = Math.max(peak, Math.abs(d[i]))
          sum += d[i] * d[i]
        }
        return [n, { peak: +peak.toFixed(2), rms: +Math.sqrt(sum / d.length).toFixed(3) }]
      }),
  ),
})
