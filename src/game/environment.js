import { Vector3 } from 'three'

/** Direction toward the hazy late-afternoon sun (west-south-west, ~27° up). */
export const SUN_DIR = new Vector3(-0.72, 0.46, 0.52).normalize()
export const FOG_COLOR = '#b49a74'

/** Storm wind (m/s): blowing debris, sand sheets, drifting motes and smoke all lean this way. */
export const STORM_WIND = [7.2, 0, 3.2]

/**
 * Sky, light and colour per map (see SceneEnvironment). Dustline is a sunset in
 * a sandstorm; Atomic Acres a bright, slightly hazy desert afternoon with clean
 * colours and long views to the mountains.
 */
export const ENVIRONMENTS = {
  dustline: {
    sunDir: SUN_DIR,
    fog: FOG_COLOR,
    fogNear: 20,
    fogFar: 120,
    sky: { horizon: FOG_COLOR, mid: '#bfa682', zenith: '#7f7a70', sun: '#ffcf98', storm: 1, below: [0.66, 0.52, 0.36] },
    hemi: ['#e6d2b2', '#6a5038', 0.72],
    bounce: ['#b4c2d8', 0.75],
    ambient: ['#8a6a4c', 0.34],
    sun: ['#ffc88e', 3.0],
    envIntensity: 0.55,
    storm: true,
    shadowSpan: 46,
    menuCam: { radius: 42, height: 17, look: [0, 4, 0] },
    /** First-person gun lighting (the weapon has its own little scene). */
    vm: { ambient: ['#8a6a52', 0.35], hemi: ['#ffe2bd', '#4a3a2c', 0.65], sun: ['#ffcf94', 1.2] },
    grade: null,
  },
  acres: {
    sunDir: new Vector3(-0.5, 0.74, 0.45).normalize(),
    fog: '#d3c9b6',
    fogNear: 50,
    fogFar: 280,
    sky: { horizon: '#ddd2bc', mid: '#c0c8cc', zenith: '#6e93c0', sun: '#fff1d4', storm: 0, below: [0.5, 0.47, 0.36] },
    hemi: ['#e4ecf4', '#5b5a3a', 0.9],
    bounce: ['#c9d8ee', 0.55],
    ambient: ['#7d7b6e', 0.28],
    sun: ['#fff0d8', 2.7],
    envIntensity: 0.6,
    storm: false,
    shadowSpan: 62,
    menuCam: { radius: 58, height: 21, look: [0, 3, 0] },
    vm: { ambient: ['#7d7b70', 0.35], hemi: ['#eef2f6', '#4c4a36', 0.7], sun: ['#fff0d8', 1.15] },
    grade: {
      exposure: 1.04,
      contrast: 1.07,
      saturation: 1.0,
      shadowTint: [-0.012, 0.004, 0.014],
      highlightTint: [0.03, 0.016, -0.018],
      vignette: 0.3,
      bleach: 0.08,
      grain: 0.022,
      dust: [0.42, 0.42, 0.44],
      lift: 0.025,
    },
  },
}

export const envFor = (mapId) => ENVIRONMENTS[mapId] ?? ENVIRONMENTS.dustline
