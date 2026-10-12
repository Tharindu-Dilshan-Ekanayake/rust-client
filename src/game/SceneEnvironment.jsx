import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  PMREMGenerator,
  PointsMaterial,
  Scene,
  ShaderMaterial,
  SphereGeometry,
} from 'three'

import { seededRandom } from '../shared/math.js'
import { useActiveMap } from '../store/gameStore.js'
import { envFor, STORM_WIND } from './environment.js'
import { enableShadowOnlyLayer } from './layers.js'
import { runtime } from './runtime.js'
import { DustStorm } from './DustStorm.jsx'
import { softDotTexture } from './world/textures.js'

/**
 * Gradient sky dome: the fog colour at the horizon (so distant ground melts into
 * it) fading to the zenith colour overhead, with a wide glow round the sun. On a
 * stormy map (Dustline) dark banks roll across the upper sky and dust bands the
 * horizon — the hazy look of an oil field in a sandstorm.
 */
function skyMaterial(env, { forEnvironment = false } = {}) {
  const { sky } = env
  return new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        fog: false,
        defines: forEnvironment ? { FOR_ENV: 1 } : {},
        uniforms: {
          horizon: { value: new Color(sky.horizon) },
          mid: { value: new Color(sky.mid) },
          zenith: { value: new Color(sky.zenith) },
          sunColor: { value: new Color(sky.sun) },
          sunDir: { value: env.sunDir.clone() },
          storm: { value: sky.storm },
          below: { value: new Color().setRGB(...sky.below) },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            #ifdef FOR_ENV
              gl_Position = p;
            #else
              gl_Position = p.xyww;
            #endif
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 horizon;
          uniform vec3 mid;
          uniform vec3 zenith;
          uniform vec3 sunColor;
          uniform vec3 sunDir;
          uniform float storm;
          uniform vec3 below;
          varying vec3 vDir;
          void main() {
            vec3 d = normalize(vDir);
            float h = max(d.y, 0.0);
            vec3 col = mix(horizon, mid, smoothstep(0.0, 0.12, h));
            col = mix(col, zenith, smoothstep(0.1, 0.75, h));
            float s = max(dot(d, normalize(sunDir)), 0.0);
            col += sunColor * (pow(s, 4.0) * 0.22 + pow(s, 48.0) * 0.4);
            // Dark storm banks rolling across the upper sky.
            float bank = sin(d.x * 7.0 + d.z * 3.0) * sin(d.z * 5.0 - d.x * 2.0);
            col *= 1.0 - storm * smoothstep(0.15, 0.6, h) * (0.1 + 0.08 * bank);
            // Dust banding low on the horizon.
            col = mix(col, horizon * 1.04, smoothstep(0.18, 0.0, h) * (0.15 + 0.2 * storm));
            col += sunColor * smoothstep(0.9993, 0.99965, s) * 2.0;
            #ifdef FOR_ENV
              // For reflections, the lower hemisphere is warm sand, not sky.
              col = mix(below, col, smoothstep(-0.08, 0.02, d.y));
            #else
              // Below the horizon just continue the haze.
              col = mix(horizon, col, smoothstep(-0.05, 0.02, d.y));
            #endif
            gl_FragColor = vec4(col, 1.0);
            #ifndef FOR_ENV
              #include <tonemapping_fragment>
              #include <colorspace_fragment>
            #endif
          }
        `,
      })
}

/** One sky material per environment, kept: switching maps back and forth reuses its shader. */
const skies = new Map()
const skyFor = (env) => {
  if (!skies.has(env)) skies.set(env, skyMaterial(env))
  return skies.get(env)
}

function SkyDome({ env }) {
  const mesh = useRef(null)
  const material = skyFor(env)
  const geo = useMemo(() => new SphereGeometry(500, 32, 16), [])
  // Keep the dome centred on the camera so it never clips or parallaxes.
  useFrame(({ camera }) => {
    if (mesh.current) mesh.current.position.copy(camera.position)
  })
  return <mesh ref={mesh} geometry={geo} material={material} renderOrder={-1} frustumCulled={false} />
}

/**
 * Image-based lighting baked from the same sky: metals and painted steel pick up
 * the sunset instead of reflecting black (there's no HDR file to load).
 */
function SkyEnvironment({ env }) {
  const gl = useThree((st) => st.gl)
  const scene = useThree((st) => st.scene)
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl)
    const envScene = new Scene()
    const sky = new Mesh(new SphereGeometry(10, 48, 24), skyMaterial(env, { forEnvironment: true }))
    envScene.add(sky)
    const target = pmrem.fromScene(envScene, 0.02)
    scene.environment = target.texture
    scene.environmentIntensity = env.envIntensity
    runtime.envMap = target.texture
    sky.geometry.dispose()
    sky.material.dispose()
    pmrem.dispose()
    return () => {
      if (scene.environment === target.texture) scene.environment = null
      if (runtime.envMap === target.texture) runtime.envMap = null
      target.dispose()
    }
  }, [gl, scene, env])
  return null
}

/**
 * Fine sand carried on the wind: faint motes drifting low across the yard in one
 * direction (and wrapping round), rather than glitter hanging in the air.
 */
const WIND = STORM_WIND.map((v) => v * 0.45)
function WindDust({ count }) {
  const { geo, seeds } = useMemo(() => {
    const rand = seededRandom(613)
    const pos = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rand() - 0.5) * 64
      pos[i * 3 + 1] = 0.15 + rand() * rand() * 3.2
      pos[i * 3 + 2] = (rand() - 0.5) * 64
      seeds[i] = rand() * 100
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pos, 3))
    return { geo: g, seeds }
  }, [count])
  const material = useMemo(
    () =>
      new PointsMaterial({
        map: softDotTexture(),
        color: '#e8d2a8',
        size: 0.09,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      }),
    [],
  )
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const t = state.clock.elapsedTime
    const pos = geo.getAttribute('position')
    const a = pos.array
    for (let i = 0; i < count; i++) {
      const k = seeds[i]
      // Gusty: speed swells and fades per mote; a little lift and tumble.
      const gust = 0.6 + 0.4 * Math.sin(t * 0.5 + k)
      a[i * 3] += WIND[0] * gust * dt
      a[i * 3 + 1] += Math.sin(t * 1.3 + k) * 0.12 * dt
      a[i * 3 + 2] += (WIND[2] + Math.cos(t * 0.8 + k) * 0.4) * gust * dt
      if (a[i * 3] > 32) a[i * 3] -= 64
      if (a[i * 3 + 2] > 32) a[i * 3 + 2] -= 64
      if (a[i * 3 + 2] < -32) a[i * 3 + 2] += 64
      if (a[i * 3 + 1] < 0.05) a[i * 3 + 1] = 0.05
    }
    pos.needsUpdate = true
  })
  return <points geometry={geo} material={material} frustumCulled={false} />
}

/**
 * The map's lighting (environment.js): one shadow-casting sun, sky/ground fill,
 * distance fog, and on a stormy map drifting dust and the storm. `quality`
 * scales the shadow map and the dust.
 */
const SHADOW_SIZES = { low: 1024, medium: 2048, high: 4096 }

export function SceneEnvironment({ dust = true, quality = 'high' }) {
  const map = useActiveMap()
  const env = envFor(map.id)
  const sun = useRef(null)
  const gl = useThree((st) => st.gl)
  // Shadow-only stand-ins (merged map and gun shadows) live on their own layer.
  useEffect(() => enableShadowOnlyLayer(gl), [gl])
  const sunPos = useMemo(() => env.sunDir.clone().multiplyScalar(90), [env])
  const shadowSize = SHADOW_SIZES[quality] ?? 2048
  const span = env.shadowSpan

  useEffect(() => {
    // The sun's target must be in the scene graph for its matrix to update.
    const light = sun.current
    if (!light) return
    light.target.position.set(0, 0, 0)
    light.parent?.add(light.target)
    return () => light.parent?.remove(light.target)
  }, [shadowSize, env])

  return (
    <>
      <color attach="background" args={[env.fog]} />
      <fog key={map.id} attach="fog" args={[env.fog, env.fogNear, env.fogFar]} />
      <SkyDome env={env} />
      <SkyEnvironment env={env} />
      <hemisphereLight args={env.hemi} />
      {/* Cool bounce from the side away from the sun keeps shadowed faces readable. */}
      <directionalLight position={env.sunDir.clone().multiplyScalar(-40).setY(25).toArray()} color={env.bounce[0]} intensity={env.bounce[1]} />
      <ambientLight color={env.ambient[0]} intensity={env.ambient[1]} />
      <directionalLight
        key={`${shadowSize}:${map.id}`}
        ref={sun}
        position={sunPos.toArray()}
        color={env.sun[0]}
        intensity={env.sun[1]}
        castShadow={quality !== 'low'}
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-camera-left={-span}
        shadow-camera-right={span}
        shadow-camera-top={span}
        shadow-camera-bottom={-span}
        shadow-camera-near={1}
        shadow-camera-far={200}
        shadow-bias={-0.0004}
        shadow-normalBias={0.05}
      />
      {dust && env.storm && quality !== 'low' && <WindDust count={quality === 'high' ? 520 : 260} />}
      {dust && env.storm && <DustStorm quality={quality} />}
    </>
  )
}

export default SceneEnvironment
