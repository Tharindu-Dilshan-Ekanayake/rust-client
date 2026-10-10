import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  PlaneGeometry,
  PointLight,
  Points,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector3,
} from 'three'

import { runtime } from '../runtime.js'
import { bulletHoleTexture, softDotTexture, smokeTexture } from '../world/textures.js'
import { registerFx } from './fxApi.js'

/* ---------------------------------------------------------------------------
 * CPU-simulated, GPU-drawn particle pool
 * ------------------------------------------------------------------------- */

const VERT = /* glsl */ `
  attribute float size;
  attribute float alpha;
  attribute vec3 color;
  uniform float uScale;
  varying float vAlpha;
  varying vec3 vColor;
  #include <fog_pars_vertex>
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = size * uScale / max(0.1, -mvPosition.z);
    vAlpha = alpha;
    vColor = color;
    #include <fog_vertex>
  }
`
const FRAG = /* glsl */ `
  uniform sampler2D map;
  varying float vAlpha;
  varying vec3 vColor;
  #include <fog_pars_fragment>
  void main() {
    vec4 t = texture2D(map, gl_PointCoord);
    gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha);
    if (gl_FragColor.a < 0.01) discard;
    #include <fog_fragment>
  }
`

class ParticlePool {
  constructor(max, { additive = false, texture }) {
    this.max = max
    this.cursor = 0
    this.pos = new Float32Array(max * 3)
    this.col = new Float32Array(max * 3)
    this.alpha = new Float32Array(max)
    this.size = new Float32Array(max)
    this.vel = new Float32Array(max * 3)
    this.life = new Float32Array(max)
    this.maxLife = new Float32Array(max)
    this.size0 = new Float32Array(max)
    this.size1 = new Float32Array(max)
    this.alpha0 = new Float32Array(max)
    this.gravity = new Float32Array(max)
    this.drag = new Float32Array(max)

    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(this.pos, 3))
    g.setAttribute('color', new BufferAttribute(this.col, 3))
    g.setAttribute('alpha', new BufferAttribute(this.alpha, 1))
    g.setAttribute('size', new BufferAttribute(this.size, 1))
    this.geometry = g
    this.material = new ShaderMaterial({
      uniforms: UniformsUtils.merge([UniformsLib.fog, { map: { value: null }, uScale: { value: 400 } }]),
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      fog: true,
      blending: additive ? AdditiveBlending : NormalBlending,
    })
    this.material.uniforms.map.value = texture
    this.points = new Points(g, this.material)
    this.points.frustumCulled = false
    this.points.renderOrder = additive ? 6 : 5
  }

  spawn(p, v, { life = 1, size = 0.3, sizeEnd = size, color = [1, 1, 1], alpha = 1, gravity = 0, drag = 0 }) {
    const i = this.cursor
    this.cursor = (this.cursor + 1) % this.max
    this.pos.set([p[0], p[1], p[2]], i * 3)
    this.vel.set([v[0], v[1], v[2]], i * 3)
    this.col.set(color, i * 3)
    this.life[i] = life
    this.maxLife[i] = life
    this.size0[i] = size
    this.size1[i] = sizeEnd
    this.size[i] = size
    this.alpha0[i] = alpha
    this.alpha[i] = alpha
    this.gravity[i] = gravity
    this.drag[i] = drag
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        if (this.alpha[i] !== 0) this.alpha[i] = 0
        continue
      }
      this.life[i] -= dt
      const t = 1 - Math.max(0, this.life[i]) / this.maxLife[i]
      const k = i * 3
      const damp = Math.max(0, 1 - this.drag[i] * dt)
      this.vel[k] *= damp
      this.vel[k + 1] = this.vel[k + 1] * damp - this.gravity[i] * dt
      this.vel[k + 2] *= damp
      this.pos[k] += this.vel[k] * dt
      this.pos[k + 1] += this.vel[k + 1] * dt
      this.pos[k + 2] += this.vel[k + 2] * dt
      this.size[i] = this.size0[i] + (this.size1[i] - this.size0[i]) * t
      // Quick fade-in, long fade-out.
      this.alpha[i] = this.alpha0[i] * Math.min(1, t * 8) * (1 - t * t)
    }
    const a = this.geometry.attributes
    a.position.needsUpdate = true
    a.color.needsUpdate = true
    a.alpha.needsUpdate = true
    a.size.needsUpdate = true
  }
}

const rand = (a, b) => a + Math.random() * (b - a)
const toArr = (v) => (Array.isArray(v) ? v : [v.x, v.y, v.z])

function randomDir(spreadUp = 0) {
  const u = Math.random() * 2 - 1
  const th = Math.random() * Math.PI * 2
  const s = Math.sqrt(1 - u * u)
  return [s * Math.cos(th), Math.abs(u) * (1 - spreadUp) + spreadUp * Math.random(), s * Math.sin(th)]
}

/**
 * Fires that never go out: the burnt-out APC smoulders in the yard, and big
 * black columns rise beyond the walls — the war going on around the map.
 * rate: particles/s; size: [start, end]; rise: m/s; life: s.
 */
const PLUMES = [
  { p: [-5.3, 1.9, 11.3], rate: 7, size: [0.9, 5.5], rise: 1.6, life: 7, spread: 0.5, dark: 0.16, fire: true },
  { p: [-62, 4, -44], rate: 5, size: [6, 22], rise: 3.4, life: 14, spread: 3, dark: 0.12 },
  { p: [58, 4, 26], rate: 4, size: [5, 18], rise: 3, life: 13, spread: 2.5, dark: 0.14 },
  { p: [24, 4, -70], rate: 4, size: [7, 24], rise: 3.6, life: 15, spread: 3.5, dark: 0.11 },
  { p: [-40, 3, 64], rate: 3, size: [5, 16], rise: 2.6, life: 12, spread: 2.5, dark: 0.15 },
]
/** Wind that bends the columns (matches the drifting sand). */
const PLUME_WIND = [1.1, 0, 0.45]

const SAND = [0.82, 0.68, 0.5]
const SMOKE_DARK = [0.35, 0.31, 0.27]
const FIRE = [1.0, 0.62, 0.22]

/* ---------------------------------------------------------------------------
 * Effects component: owns all pools and wires up `fx`
 * ------------------------------------------------------------------------- */

/** Length of a tracer streak in metres. */
const TRACER_LENGTH = 3.5

export function Effects() {
  const { scene, camera, size, gl } = useThree()

  const sys = useMemo(() => {
    const dust = new ParticlePool(900, { texture: smokeTexture() })
    const plume = new ParticlePool(700, { texture: smokeTexture() })
    const glow = new ParticlePool(500, { additive: true, texture: softDotTexture() })

    const tracerGeo = new BoxGeometry(1, 1, 1)
    tracerGeo.translate(0, 0, -0.5)
    const tracers = Array.from({ length: 40 }, () => {
      const m = new Mesh(
        tracerGeo,
        new MeshBasicMaterial({ color: '#ffd38a', transparent: true, opacity: 0.7, blending: AdditiveBlending, depthWrite: false }),
      )
      m.visible = false
      m.frustumCulled = false
      return { mesh: m, from: new Vector3(), dir: new Vector3(), dist: 0, age: 0, speed: 0, active: false }
    })

    const decalGeo = new PlaneGeometry(0.13, 0.13)
    const decalMat = new MeshBasicMaterial({
      map: bulletHoleTexture(),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
    })
    const decals = Array.from({ length: 120 }, () => {
      const m = new Mesh(decalGeo, decalMat)
      m.visible = false
      return m
    })

    const lights = Array.from({ length: 4 }, () => {
      const l = new PointLight('#ffb35a', 0, 12, 1.8)
      return { light: l, until: 0, start: 0, peak: 0 }
    })

    const group = new Group()
    group.add(dust.points, glow.points, plume.points)
    for (const t of tracers) group.add(t.mesh)
    for (const d of decals) group.add(d)
    for (const l of lights) group.add(l.light)
    return { dust, glow, plume, plumeAcc: PLUMES.map(() => Math.random()), tracers, decals, decalCursor: 0, lights, group }
  }, [])

  useEffect(() => {
    scene.add(sys.group)
    return () => scene.remove(sys.group)
  }, [scene, sys])

  useEffect(() => {
    const flashLight = (pos, color, peak, ms, distance = 12) => {
      // Reuse the light that will expire soonest; lights are never added/removed
      // at runtime, which would force every material to recompile.
      const slot = sys.lights.reduce((a, b) => (a.until < b.until ? a : b))
      slot.light.position.set(pos[0], pos[1], pos[2])
      slot.light.color.set(color)
      slot.light.distance = distance
      slot.peak = peak
      slot.start = performance.now()
      slot.until = slot.start + ms
    }

    const impl = {
      tracer(from, to, weapon, local = false) {
        const t = sys.tracers.find((x) => !x.active) ?? sys.tracers[0]
        const a = toArr(from)
        const b = toArr(to)
        t.from.set(a[0], a[1], a[2])
        t.dir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2])
        t.dist = t.dir.length()
        if (t.dist < 0.5) return
        t.dir.divideScalar(t.dist)
        // Shots coming at us stop short of the camera; otherwise the last few metres
        // of the streak smear across the whole screen.
        const cam = runtime.camera
        if (cam && !local) {
          const near = cam.position.distanceTo(t.from.clone().addScaledVector(t.dir, t.dist))
          if (near < 3) t.dist = Math.max(0.5, t.dist - (3 - near))
        }
        // Our own tracers start a little way out so they don't smear across the screen.
        if (local) {
          const skip = Math.min(t.dist - 0.5, 1.6)
          t.from.addScaledVector(t.dir, skip)
          t.dist -= skip
        }
        t.age = 0
        t.speed = weapon === 'sniper' ? 520 : 380
        t.thick = weapon === 'sniper' ? 0.022 : 0.012
        t.active = true
        t.mesh.visible = true
      },
      impact(point, normal) {
        const p = toArr(point)
        const n = normal ? [normal.x ?? normal[0], normal.y ?? normal[1], normal.z ?? normal[2]] : [0, 1, 0]
        for (let i = 0; i < 6; i++) {
          const d = randomDir(0.3)
          sys.dust.spawn(p, [n[0] * 1.8 + d[0] * 1.2, n[1] * 1.8 + d[1] * 1.5, n[2] * 1.8 + d[2] * 1.2], {
            life: rand(0.5, 1.1),
            size: rand(0.12, 0.2),
            sizeEnd: rand(0.5, 0.9),
            color: SAND,
            alpha: 0.75,
            gravity: 1.5,
            drag: 2.5,
          })
        }
        for (let i = 0; i < 3; i++) {
          const d = randomDir(0.2)
          sys.glow.spawn(p, [n[0] * 3 + d[0] * 4, n[1] * 3 + d[1] * 4, n[2] * 3 + d[2] * 4], {
            life: rand(0.08, 0.18),
            size: 0.06,
            sizeEnd: 0.02,
            color: [1, 0.8, 0.45],
            gravity: 9,
          })
        }
        if (normal) {
          const decal = sys.decals[sys.decalCursor]
          sys.decalCursor = (sys.decalCursor + 1) % sys.decals.length
          decal.position.set(p[0] + n[0] * 0.012, p[1] + n[1] * 0.012, p[2] + n[2] * 0.012)
          decal.lookAt(p[0] + n[0], p[1] + n[1], p[2] + n[2])
          decal.rotateZ(Math.random() * Math.PI)
          decal.visible = true
        }
      },
      blood(point) {
        const p = toArr(point)
        for (let i = 0; i < 9; i++) {
          const d = randomDir(0.4)
          sys.dust.spawn(p, [d[0] * 2.2, d[1] * 1.8, d[2] * 2.2], {
            life: rand(0.25, 0.5),
            size: rand(0.08, 0.14),
            sizeEnd: rand(0.3, 0.45),
            color: [0.55, 0.06, 0.05],
            alpha: 0.9,
            gravity: 4,
            drag: 3,
          })
        }
      },
      muzzle(point, weapon) {
        flashLight(toArr(point), '#ffb35a', weapon === 'sniper' ? 26 : 14, 60, 9)
      },
      puff(point) {
        const p = toArr(point)
        for (let i = 0; i < 14; i++) {
          const d = randomDir(0.5)
          sys.dust.spawn([p[0], p[1] + 0.2, p[2]], [d[0] * 3, d[1] * 2, d[2] * 3], {
            life: rand(0.8, 1.6),
            size: 0.4,
            sizeEnd: rand(1.4, 2.2),
            color: [0.85, 0.85, 0.82],
            alpha: 0.6,
            drag: 2.2,
          })
        }
      },
      explosion(point, kind = 'frag') {
        const p = toArr(point)
        if (kind === 'flash') {
          flashLight(p, '#ffffff', 70, 160, 20)
          for (let i = 0; i < 18; i++) {
            const d = randomDir()
            sys.glow.spawn(p, [d[0] * 6, d[1] * 6, d[2] * 6], { life: rand(0.1, 0.25), size: 0.7, sizeEnd: 2.2, color: [1, 1, 1] })
          }
          return
        }
        flashLight(p, '#ff9a3c', 60, 320, 22)
        for (let i = 0; i < 34; i++) {
          const d = randomDir(0.35)
          const s = rand(2, 7)
          sys.glow.spawn([p[0], p[1] + 0.3, p[2]], [d[0] * s, d[1] * s, d[2] * s], {
            life: rand(0.25, 0.55),
            size: rand(0.8, 1.4),
            sizeEnd: rand(1.8, 3.0),
            color: Math.random() < 0.5 ? FIRE : [1, 0.85, 0.45],
            drag: 4,
          })
        }
        for (let i = 0; i < 26; i++) {
          const d = randomDir(0.45)
          const s = rand(1.5, 4.5)
          sys.dust.spawn([p[0], p[1] + 0.4, p[2]], [d[0] * s, d[1] * s * 0.8 + 1, d[2] * s], {
            life: rand(2.0, 3.6),
            size: rand(1.0, 1.8),
            sizeEnd: rand(3.5, 5.5),
            color: Math.random() < 0.5 ? SMOKE_DARK : [0.55, 0.47, 0.38],
            alpha: 0.65,
            drag: 1.6,
            gravity: -0.3,
          })
        }
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * Math.PI * 2
          sys.dust.spawn([p[0], p[1] + 0.15, p[2]], [Math.cos(a) * rand(5, 9), rand(0.3, 1.2), Math.sin(a) * rand(5, 9)], {
            life: rand(1.0, 1.8),
            size: 0.5,
            sizeEnd: 2.4,
            color: SAND,
            alpha: 0.7,
            drag: 2.6,
          })
        }
        for (let i = 0; i < 24; i++) {
          const d = randomDir(0.55)
          const s = rand(6, 12)
          sys.dust.spawn(p, [d[0] * s, d[1] * s, d[2] * s], {
            life: rand(0.8, 1.4),
            size: 0.1,
            sizeEnd: 0.08,
            color: [0.15, 0.12, 0.1],
            alpha: 1,
            gravity: 14,
          })
        }
      },
    }
    return registerFx(impl)
  }, [sys])

  useFrame((_state, dt) => {
    const step = Math.min(dt, 0.05)
    // Point sizes are in world units; convert with the current projection.
    const scale = (size.height * gl.getPixelRatio()) / (2 * Math.tan((camera.fov * Math.PI) / 360))
    sys.dust.material.uniforms.uScale.value = scale
    sys.glow.material.uniforms.uScale.value = scale
    sys.dust.update(step)
    // Keep the war fires burning.
    sys.plume.material.uniforms.uScale.value = scale
    PLUMES.forEach((pl, i) => {
      sys.plumeAcc[i] += pl.rate * step
      while (sys.plumeAcc[i] >= 1) {
        sys.plumeAcc[i] -= 1
        const j = () => (Math.random() - 0.5) * pl.spread
        const shade = pl.dark + Math.random() * 0.06
        sys.plume.spawn(
          [pl.p[0] + j(), pl.p[1], pl.p[2] + j()],
          [PLUME_WIND[0] * (0.4 + Math.random() * 0.4) + j() * 0.2, pl.rise * (0.8 + Math.random() * 0.4), PLUME_WIND[2] * (0.4 + Math.random() * 0.4) + j() * 0.2],
          { life: pl.life * (0.8 + Math.random() * 0.4), size: pl.size[0], sizeEnd: pl.size[1], color: [shade, shade * 0.95, shade * 0.9], alpha: 0.75, gravity: -0.15, drag: 0.08 },
        )
        if (pl.fire && Math.random() < 0.8) {
          sys.glow.spawn([pl.p[0] + j() * 0.8, pl.p[1] - 0.3, pl.p[2] + j() * 0.8], [j() * 0.3, 1.2 + Math.random(), j() * 0.3], {
            life: rand(0.35, 0.7),
            size: rand(0.35, 0.7),
            sizeEnd: 0.1,
            color: FIRE,
            alpha: 0.9,
            gravity: -0.5,
          })
        }
      }
    })
    sys.plume.update(step)
    sys.glow.update(step)

    for (const t of sys.tracers) {
      if (!t.active) continue
      t.age += step
      // The streak's head stops at the impact; its tail keeps going until it gets
      // there too. (Clamping the tail to the head left a streak parked at the end
      // of every shot.)
      const travelled = t.age * t.speed
      const head = Math.min(t.dist, travelled)
      const tail = Math.max(0, travelled - TRACER_LENGTH)
      if (tail >= t.dist - 0.01 || t.age > 1.5) {
        t.active = false
        t.mesh.visible = false
        continue
      }
      const m = t.mesh
      m.position.copy(t.from).addScaledVector(t.dir, head)
      m.lookAt(m.position.x + t.dir.x, m.position.y + t.dir.y, m.position.z + t.dir.z)
      m.scale.set(t.thick, t.thick, Math.max(0.05, head - tail))
    }

    const now = performance.now()
    for (const l of sys.lights) {
      if (now >= l.until) {
        if (l.light.intensity !== 0) l.light.intensity = 0
        continue
      }
      const k = 1 - (now - l.start) / (l.until - l.start)
      l.light.intensity = l.peak * k * k
    }
  })

  return null
}

export default Effects
