import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BufferGeometry,
  CircleGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Matrix4,
  MeshBasicMaterial,
  NormalBlending,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
} from 'three'

import { BAT_FLOCKS, CANDLES, GATE_PIERS, LAMPS, MIST, PIER_TOP, PUMPKINS, SCARECROWS, STATUE, STREETS } from '../../../shared/mapHollow.js'
import { seededRandom } from '../../../shared/math.js'
import { useGameStore } from '../../../store/gameStore.js'
import { envFor } from '../../environment.js'
import { Merged } from '../acres/merge.jsx'
import { once, Pieces } from '../acres/pieces.js'
import { smokeTexture } from '../textures.js'
import { stringBulbs } from './kit.js'
import { hc, LIGHT } from './materials.js'

/**
 * What makes Hollow Creek's night: halos round every light (lamps, carved
 * pumpkins, candles, the cauldron, string bulbs) drawn as one set of
 * camera-facing glows that flicker; the pools of light they throw on the
 * ground, as additive decals; low mist drifting over the graveyard and the
 * creek; bats circling the bell tower and the watchtower. None of it is a
 * real light, so it costs the renderer no lighting work at all.
 */

const ENV = envFor('hollow')

/* ---------------------------------------------------------------------------
 * Where the lights are
 * ------------------------------------------------------------------------- */

/** [x, y, z, size, colour name, flicker] for every glow in town. */
function glowList() {
  return once('hc:glows', () => {
    const out = []
    for (const l of LAMPS) out.push([l.p[0], 3.68, l.p[2], 1.7, 'lamp', 0.03])
    for (const k of PUMPKINS) {
      if (!k.carved) continue
      const f = 0.12 * k.s
      out.push([k.p[0] + Math.sin(k.rotY) * f, k.p[1] + 0.17 * k.s, k.p[2] + Math.cos(k.rotY) * f, 0.95 * k.s, 'orange', 0.22])
    }
    for (const [x, z] of GATE_PIERS) out.push([x + (x < 0 ? -0.12 : 0), PIER_TOP + 0.1, z + (x < 0 ? 0 : 0.12), 0.95, 'orange', 0.22])
    for (const c of CANDLES) out.push([c.p[0], c.p[1] + 0.22, c.p[2], 0.55 + c.n * 0.06, 'flame', 0.3])
    for (const s of SCARECROWS) out.push([s.p[0] + Math.sin(s.rotY) * 0.18, 2.24, s.p[2] + Math.cos(s.rotY) * 0.18, 1.2, 'orange', 0.22])
    // The witch's head and her cauldron.
    const top = STATUE.p[1] + STATUE.base[1] + STATUE.plinth[1]
    out.push([0, top + 3.08 + 0.38, 0.3, 2.4, 'orange', 0.18])
    out.push([0, STATUE.p[1] + 0.95, STATUE.cauldron[0], 2.8, 'brew', 0.12])
    for (const b of stringBulbs()) out.push([b.p[0], b.p[1], b.p[2], 0.3, b.color, 0])
    return out
  })
}

/* ---------------------------------------------------------------------------
 * Halos: one draw for all of them
 * ------------------------------------------------------------------------- */

const glowVertex = /* glsl */ `
  attribute vec3 iPos;
  attribute float iSize;
  attribute vec3 iColor;
  attribute vec2 iFlick;
  uniform float time;
  uniform float fogNear;
  uniform float fogFar;
  varying vec2 vUv;
  varying vec3 vColor;
  void main() {
    vUv = uv;
    float f = 1.0 + iFlick.x * (0.6 * sin(time * 9.0 + iFlick.y * 6.283) + 0.4 * sin(time * 23.0 + iFlick.y * 17.0));
    vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
    mv.xy += position.xy * iSize * (0.9 + 0.1 * f);
    float fog = smoothstep(fogNear, fogFar, -mv.z);
    vColor = iColor * f * (1.0 - fog * 0.85);
    gl_Position = projectionMatrix * mv;
  }
`
const glowFragment = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = exp(-d * d * 4.5) * (1.0 - smoothstep(0.8, 1.0, d));
    gl_FragColor = vec4(vColor, a);
  }
`

export function Glows() {
  const mesh = useRef(null)
  const { geometry, material } = useMemo(() => {
    const list = glowList()
    const base = new PlaneGeometry(1, 1)
    const g = new InstancedBufferGeometry()
    g.index = base.index
    g.setAttribute('position', base.getAttribute('position'))
    g.setAttribute('uv', base.getAttribute('uv'))
    const pos = new Float32Array(list.length * 3)
    const size = new Float32Array(list.length)
    const color = new Float32Array(list.length * 3)
    const flick = new Float32Array(list.length * 2)
    const rand = seededRandom(1907)
    const c = new Color()
    list.forEach(([x, y, z, s, name, f], i) => {
      pos.set([x, y, z], i * 3)
      size[i] = s
      // Halo brightness by kind: the bulbs are tiny points, lamps and fire bloom.
      c.set(LIGHT[name] ?? name).multiplyScalar(name === 'lamp' ? 0.55 : name === 'brew' ? 0.6 : 0.7)
      color.set([c.r, c.g, c.b], i * 3)
      flick.set([f, rand()], i * 2)
    })
    g.setAttribute('iPos', new InstancedBufferAttribute(pos, 3))
    g.setAttribute('iSize', new InstancedBufferAttribute(size, 1))
    g.setAttribute('iColor', new InstancedBufferAttribute(color, 3))
    g.setAttribute('iFlick', new InstancedBufferAttribute(flick, 2))
    g.instanceCount = list.length
    const m = new ShaderMaterial({
      vertexShader: glowVertex,
      fragmentShader: glowFragment,
      uniforms: { time: { value: 0 }, fogNear: { value: ENV.fogNear }, fogFar: { value: ENV.fogFar } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    return { geometry: g, material: m }
  }, [])
  useFrame((state) => {
    material.uniforms.time.value = state.clock.elapsedTime
  })
  return <mesh name="hc-glows" ref={mesh} geometry={geometry} material={material} frustumCulled={false} renderOrder={2} userData={{ dynamic: true }} />
}

/* ---------------------------------------------------------------------------
 * Light on the ground
 * ------------------------------------------------------------------------- */

const poolGeo = new CircleGeometry(1, 24).rotateX(-Math.PI / 2)

export function LightPools() {
  const parts = useMemo(
    () =>
      once('hc:pools', () => {
        const P = new Pieces()
        const pool = (name, x, y, z, r) => P.add(hc.pool(name), poolGeo, [x, y + 0.02, z], null, [r, 1, r])
        for (const l of LAMPS) pool('lamp', l.p[0], 0.018, l.p[2], 4.6)
        for (const k of PUMPKINS) {
          if (!k.carved) continue
          const x = k.p[0] + Math.sin(k.rotY) * 0.3 * k.s
          const z = k.p[2] + Math.cos(k.rotY) * 0.3 * k.s
          // On the island the light stays on the island (never hanging over the road below its curb).
          const room = Math.hypot(x, z) < STREETS.circle.island ? STREETS.circle.island - Math.hypot(x, z) - 0.08 : Infinity
          pool('orange', x, k.p[1], z, Math.min(1.15 * k.s, room))
        }
        for (const [x, z] of GATE_PIERS) pool('orange', x, 0, z, 1.6)
        for (const c of CANDLES) pool('flame', c.p[0], c.p[1], c.p[2], 0.7 + c.n * 0.08)
        for (const s of SCARECROWS) pool('orange', s.p[0], 0, s.p[2], 1.8)
        pool('brew', 0, STATUE.p[1], STATUE.cauldron[0], STREETS.circle.island - STATUE.cauldron[0] - 0.1)
        return P.build()
      }),
    [],
  )
  return <Merged parts={parts} shadow={false} />
}

/* ---------------------------------------------------------------------------
 * Mist: big soft puffs low over the ground, drifting
 * ------------------------------------------------------------------------- */

const mistVertex = /* glsl */ `
  attribute vec3 iPos;
  attribute vec2 iData;
  uniform float time;
  uniform float fogNear;
  uniform float fogFar;
  varying vec2 vUv;
  varying float vAlpha;
  void main() {
    vUv = uv;
    vec3 p = iPos + vec3(sin(time * 0.07 + iData.y * 6.0) * 1.2, sin(time * 0.11 + iData.y * 3.0) * 0.12, cos(time * 0.05 + iData.y * 4.0) * 1.2);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    // A bank of mist right in front of the camera would fill the screen, layer
    // on layer, for next to nothing: it fades out by 3 m and isn't drawn nearer.
    float near = smoothstep(3.0, 7.0, -mv.z);
    mv.xy += position.xy * iData.x * vec2(1.0, 0.45);
    vAlpha = near * (1.0 - smoothstep(fogNear, fogFar, -mv.z) * 0.6);
    gl_Position = near > 0.0 ? projectionMatrix * mv : vec4(0.0, 0.0, 2.0, 1.0);
  }
`
const mistFragment = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 color;
  varying vec2 vUv;
  varying float vAlpha;
  void main() {
    float a = texture2D(map, vUv).a * vAlpha * 0.16;
    gl_FragColor = vec4(color, a);
  }
`

export function Mist() {
  // Mist is all overdraw: on low quality each bank is half as many sheets.
  const low = useGameStore((s) => s.settings.quality) === 'low'
  const { geometry, material } = useMemo(() => {
    const rand = seededRandom(2203)
    const items = []
    for (const m of MIST) {
      const n = Math.max(2, Math.round(m.r / 1.6))
      for (let i = 0; i < n; i++) {
        const a = rand() * Math.PI * 2
        const r = rand() * m.r * 0.7
        const sheet = [m.p[0] + Math.cos(a) * r, 0.55 + rand() * 0.5, m.p[2] + Math.sin(a) * r, m.r * (0.7 + rand() * 0.5), rand()]
        if (!low || i % 2 === 0) items.push(sheet)
      }
    }
    const base = new PlaneGeometry(1, 1)
    const g = new InstancedBufferGeometry()
    g.index = base.index
    g.setAttribute('position', base.getAttribute('position'))
    g.setAttribute('uv', base.getAttribute('uv'))
    g.setAttribute('iPos', new InstancedBufferAttribute(new Float32Array(items.flatMap((it) => it.slice(0, 3))), 3))
    g.setAttribute('iData', new InstancedBufferAttribute(new Float32Array(items.flatMap((it) => [it[3], it[4]])), 2))
    g.instanceCount = items.length
    const m = new ShaderMaterial({
      vertexShader: mistVertex,
      fragmentShader: mistFragment,
      uniforms: {
        time: { value: 0 },
        map: { value: smokeTexture() },
        color: { value: new Color('#7f88a8') },
        fogNear: { value: ENV.fogNear },
        fogFar: { value: ENV.fogFar },
      },
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
    })
    return { geometry: g, material: m }
  }, [low])
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )
  useFrame((state) => {
    material.uniforms.time.value = state.clock.elapsedTime
  })
  return <mesh name="hc-mist" geometry={geometry} material={material} frustumCulled={false} renderOrder={1} userData={{ dynamic: true }} />
}

/* ---------------------------------------------------------------------------
 * Bats
 * ------------------------------------------------------------------------- */

/** A bat: a little body and two wings whose tips sit up (scaling y flaps them). */
function batGeometry() {
  const v = [
    // Left wing, right wing (two triangles each), body.
    0, 0, -0.06, -0.34, 0.1, 0.02, -0.12, 0, 0.1,
    0, 0, -0.06, -0.12, 0, 0.1, 0, 0, 0.12,
    0, 0, -0.06, 0.12, 0, 0.1, 0.34, 0.1, 0.02,
    0, 0, -0.06, 0, 0, 0.12, 0.12, 0, 0.1,
  ]
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(v, 3))
  g.computeVertexNormals()
  return g
}

const _o = new Object3D()
const _m = new Matrix4()

export function Bats() {
  const mesh = useRef(null)
  const bats = useMemo(() => {
    const rand = seededRandom(4007)
    return BAT_FLOCKS.flatMap((f) =>
      Array.from({ length: f.n }, () => ({
        c: f.p,
        r: f.r * (0.6 + rand() * 0.6),
        speed: (0.45 + rand() * 0.4) * (rand() < 0.5 ? -1 : 1),
        phase: rand() * Math.PI * 2,
        bob: rand() * 6,
        size: 0.8 + rand() * 0.6,
      })),
    )
  }, [])
  const geometry = useMemo(() => batGeometry(), [])
  const material = useMemo(() => new MeshBasicMaterial({ color: '#0b0a0e', side: DoubleSide }), [])
  useFrame((state) => {
    const m = mesh.current
    if (!m) return
    const t = state.clock.elapsedTime
    bats.forEach((b, i) => {
      const a = b.phase + t * b.speed
      _o.position.set(b.c[0] + Math.cos(a) * b.r, b.c[1] + Math.sin(t * 0.9 + b.bob) * 0.8, b.c[2] + Math.sin(a) * b.r)
      // Facing along the circle, flapping fast.
      _o.rotation.set(0, -a + (b.speed > 0 ? 0 : Math.PI), Math.sin(t * 2 + b.bob) * 0.25)
      const flap = Math.sin(t * 15 + b.bob * 3)
      _o.scale.set(b.size, b.size * flap, b.size)
      _o.updateMatrix()
      _m.copy(_o.matrix)
      m.setMatrixAt(i, _m)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh name="hc-bats" ref={mesh} args={[geometry, material, bats.length]} frustumCulled={false} userData={{ dynamic: true }} />
}

