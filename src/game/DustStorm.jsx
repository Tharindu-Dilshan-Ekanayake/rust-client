import { useFrame, useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import { BufferAttribute, BufferGeometry, Color, NormalBlending, ShaderMaterial } from 'three'

import { seededRandom } from '../shared/math.js'
import { STORM_WIND } from './environment.js'
import { smokeTexture } from './world/textures.js'

/**
 * The dust storm: torn scraps and grit tumbling through the air on the wind,
 * sheets of sand blowing low across the yard, and gusts that thicken the haze.
 * Particles live in a box that follows the camera and are moved entirely on
 * the GPU (wrapped round the box in the vertex shader), so they cost no CPU.
 */


const BOX = [84, 0, 84]

const vertexShader = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform vec3 uCam;
  uniform vec3 uBox;
  uniform vec3 uWind;
  uniform float uSize;
  uniform float uScale;
  uniform float uBob;
  uniform float uNear;
  varying float vAlpha;
  varying float vSpin;
  varying float vSeed;
  void main() {
    float speed = 0.65 + 0.7 * fract(aSeed * 7.13);
    vec3 p = position + uWind * uTime * speed;
    p.y += sin(uTime * (1.3 + aSeed) + aSeed * 40.0) * uBob;
    // Wrap round the camera on the ground plane; heights stay put.
    vec2 rel = mod(p.xz - uCam.xz + uBox.xz * 0.5, uBox.xz) - uBox.xz * 0.5;
    vec3 world = vec3(uCam.x + rel.x, max(p.y, 0.05), uCam.z + rel.y);
    vec4 mv = viewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mv;
    float dist = -mv.z;
    gl_PointSize = min(uSize * (0.5 + fract(aSeed * 3.7)) * uScale / max(dist, 0.5), 900.0);
    // Fade toward the edges of the box (so wrapping never pops) and right up close.
    float edge = 1.0 - smoothstep(0.32, 0.5, max(abs(rel.x) / uBox.x, abs(rel.y) / uBox.z));
    vAlpha = edge * smoothstep(uNear * 0.4, uNear, dist);
    vSpin = uTime * (1.5 + aSeed * 6.0) + aSeed * 20.0;
    vSeed = aSeed;
  }
`

const flakeFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  varying float vSpin;
  varying float vSeed;
  void main() {
    vec2 q = gl_PointCoord - 0.5;
    float c = cos(vSpin);
    float s = sin(vSpin);
    q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
    // Tumbling: the scrap turns edge-on and back.
    q.x *= 1.6 + 2.4 * abs(sin(vSpin * 0.6 + vSeed * 3.0));
    float a = smoothstep(0.5, 0.28, length(q)) * uOpacity * vAlpha;
    if (a < 0.02) discard;
    gl_FragColor = vec4(uColor * (0.75 + 0.5 * fract(vSeed * 13.1)), a);
  }
`

const sheetFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  varying float vSpin;
  varying float vSeed;
  void main() {
    vec2 q = gl_PointCoord - 0.5;
    float r = vSeed * 6.28 + vSpin * 0.05;
    q = vec2(cos(r) * q.x - sin(r) * q.y, sin(r) * q.x + cos(r) * q.y) + 0.5;
    float a = texture2D(uMap, q).a * uOpacity * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
  }
`

function layer({ count, seed, height, heightBias, size, color, opacity, bob, near, windScale, fragment, map }) {
  const rand = seededRandom(seed)
  const pos = new Float32Array(count * 3)
  const seeds = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rand() - 0.5) * BOX[0]
    pos[i * 3 + 1] = height[0] + Math.pow(rand(), heightBias) * (height[1] - height[0])
    pos[i * 3 + 2] = (rand() - 0.5) * BOX[2]
    seeds[i] = rand()
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  geo.setAttribute('aSeed', new BufferAttribute(seeds, 1))
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader: fragment,
    uniforms: {
      uTime: { value: 0 },
      uCam: { value: [0, 0, 0] },
      uBox: { value: BOX },
      uWind: { value: STORM_WIND.map((v) => v * windScale) },
      uSize: { value: size },
      uScale: { value: 400 },
      uBob: { value: bob },
      uNear: { value: near },
      uColor: { value: new Color(color) },
      uOpacity: { value: opacity },
      ...(map ? { uMap: { value: map } } : {}),
    },
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
  })
  return { geo, material, base: opacity }
}

const COUNTS = { low: [220, 18], medium: [520, 40], high: [950, 70] }

export function DustStorm({ quality = 'high' }) {
  const gl = useThree((s) => s.gl)
  const [flakes, sheets] = COUNTS[quality] ?? COUNTS.high
  const layers = useMemo(
    () => [
      // Torn scraps, grit and dry leaves whipping past at every height.
      layer({ count: flakes, seed: 911, height: [0.2, 24], heightBias: 1.7, size: 0.16, color: '#2c241c', opacity: 0.85, bob: 0.8, near: 1.2, windScale: 1.15, fragment: flakeFragment }),
      // Sheets of sand blowing low across the ground.
      layer({ count: sheets, seed: 377, height: [0.4, 5], heightBias: 1.4, size: 9, color: '#c2a57c', opacity: 0.2, bob: 0.3, near: 5, windScale: 0.85, fragment: sheetFragment, map: smokeTexture() }),
    ],
    [flakes, sheets],
  )
  useFrame(({ camera, clock, scene, size }) => {
    const t = clock.elapsedTime
    // Gusts come and go: thicker sand and closer haze, then a lull.
    const gust = 0.5 + 0.5 * Math.sin(t * 0.11) * Math.sin(t * 0.27 + 1.3)
    const scale = (size.height * gl.getPixelRatio()) / 2
    for (const l of layers) {
      const u = l.material.uniforms
      u.uTime.value = t
      u.uCam.value = [camera.position.x, camera.position.y, camera.position.z]
      u.uScale.value = scale
      u.uOpacity.value = l.base * (0.6 + 0.7 * gust)
    }
    if (scene.fog) {
      scene.fog.near = 20 - 8 * gust
      scene.fog.far = 125 - 40 * gust
    }
  })
  return layers.map((l, i) => <points key={i} geometry={l.geo} material={l.material} frustumCulled={false} renderOrder={3} />)
}

export default DustStorm
