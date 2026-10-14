import { Vector3 } from 'three'

/** Direction toward the hazy late-afternoon sun (west-south-west, ~27° up). */
export const SUN_DIR = new Vector3(-0.72, 0.46, 0.52).normalize()
export const FOG_COLOR = '#b49a74'

/** Storm wind (m/s): blowing debris, sand sheets, drifting motes and smoke all lean this way. */
export const STORM_WIND = [7.2, 0, 3.2]

/**
 * Sky, light and colour per map (see SceneEnvironment). Dustline is a sunset in
 * a sandstorm; Atomic Acres a bright, slightly hazy desert afternoon with clean
 * colours and long views to the mountains; Palmwood a hot tropical morning,
 * high sun, blue sky and saturated greens; Hollow Creek Halloween night: the
 * moon (the "sun" here) high over the church, cold blue light and long
 * shadows, the warm glow of the town's lamps and pumpkins coming from below;
 * Old Quarter a clear, hot afternoon: no haze, no dust, no vignette or grain,
 * just strong sun and clean colour; Bramblewood a soft, bright day under high
 * cloud, lush greens, a little depth haze over the field and nothing laid
 * over the picture; Skyport Terminal dusk after a battle: the sun low and red
 * in the west through a pall of smoke, the sky dark with it overhead, the
 * haze thick and brown; inside, the power out, only the light through the
 * glass and the holes; a drained, gritty grade with a vignette.
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
  palmwood: {
    sunDir: new Vector3(0.46, 0.76, 0.46).normalize(),
    fog: '#d2e0e2',
    fogNear: 55,
    fogFar: 260,
    sky: { horizon: '#dbe8ea', mid: '#a6cae6', zenith: '#4686c8', sun: '#fff4dc', storm: 0, below: [0.42, 0.5, 0.34] },
    hemi: ['#ddeefa', '#5a6a32', 0.95],
    bounce: ['#cfe0c8', 0.5],
    ambient: ['#7a7e6a', 0.3],
    sun: ['#fff2da', 2.9],
    envIntensity: 0.6,
    storm: false,
    shadowSpan: 56,
    menuCam: { radius: 50, height: 19, look: [0, 3, 0] },
    vm: { ambient: ['#7a7e70', 0.35], hemi: ['#eef4f8', '#4c5236', 0.7], sun: ['#fff2da', 1.15] },
    grade: {
      exposure: 1.04,
      contrast: 1.08,
      saturation: 1.12,
      shadowTint: [-0.012, 0.006, 0.012],
      highlightTint: [0.03, 0.02, -0.015],
      vignette: 0.28,
      bleach: 0.05,
      grain: 0.02,
      dust: [0.4, 0.44, 0.42],
      lift: 0.02,
    },
  },
}

ENVIRONMENTS.hollow = {
  sunDir: new Vector3(0.3, 0.62, -0.72).normalize(),
  fog: '#1b2036',
  fogNear: 24,
  fogFar: 155,
  sky: { horizon: '#2a3050', mid: '#182042', zenith: '#060a1c', sun: '#dfe6ff', storm: 0, below: [0.05, 0.06, 0.09], night: 1 },
  hemi: ['#8291cc', '#2a2430', 0.9],
  // Warm from low on the far side: the lamps, the pumpkins and the fires.
  bounce: ['#ff9a52', 0.34],
  ambient: ['#4c527a', 0.44],
  sun: ['#c6d2ff', 1.6],
  envIntensity: 0.5,
  storm: false,
  shadowSpan: 60,
  menuCam: { radius: 48, height: 17, look: [0, 4, -3] },
  vm: { ambient: ['#50587c', 0.5], hemi: ['#a6b2e6', '#2c2632', 0.66], sun: ['#c8d4ff', 0.95] },
  grade: {
    exposure: 1.1,
    contrast: 1.08,
    saturation: 0.95,
    shadowTint: [-0.008, -0.002, 0.03],
    highlightTint: [0.035, 0.014, -0.02],
    vignette: 0.42,
    bleach: 0.04,
    grain: 0.03,
    dust: [0.06, 0.07, 0.14],
    lift: 0.035,
  },
}

ENVIRONMENTS.quarter = {
  sunDir: new Vector3(-0.42, 0.72, 0.55).normalize(),
  fog: '#d6dde4',
  fogNear: 90,
  fogFar: 420,
  sky: { horizon: '#d8e2ea', mid: '#a9c4dc', zenith: '#5f8fc4', sun: '#fff3dc', storm: 0, below: [0.62, 0.55, 0.44] },
  hemi: ['#e6eef6', '#6a5a44', 0.9],
  bounce: ['#e2cfae', 0.5],
  ambient: ['#80786a', 0.3],
  sun: ['#fff1d8', 2.8],
  envIntensity: 0.6,
  storm: false,
  shadowSpan: 62,
  menuCam: { radius: 52, height: 22, look: [0, 4, -4] },
  vm: { ambient: ['#7d786e', 0.35], hemi: ['#eef2f6', '#4c4636', 0.7], sun: ['#fff1d8', 1.15] },
  // Clean: nothing laid over the picture (no vignette, grain, dust or bleach).
  grade: {
    exposure: 1.02,
    contrast: 1.05,
    saturation: 1.04,
    shadowTint: [0, 0, 0],
    highlightTint: [0, 0, 0],
    vignette: 0,
    bleach: 0,
    grain: 0,
    dust: [0, 0, 0],
    lift: 0,
  },
}

ENVIRONMENTS.bramble = {
  sunDir: new Vector3(0.42, 0.68, 0.46).normalize(),
  fog: '#c8d2cc',
  fogNear: 70,
  fogFar: 320,
  sky: { horizon: '#d4dcd8', mid: '#a9bfcf', zenith: '#6a8cb0', sun: '#fff2dc', storm: 0, below: [0.4, 0.46, 0.32] },
  hemi: ['#dde8ee', '#46582e', 0.95],
  bounce: ['#c4d6b4', 0.5],
  ambient: ['#6e7862', 0.32],
  sun: ['#fff0d6', 2.6],
  envIntensity: 0.6,
  storm: false,
  shadowSpan: 64,
  menuCam: { radius: 56, height: 21, look: [4, 3, -6] },
  vm: { ambient: ['#76806e', 0.35], hemi: ['#eef2f6', '#46502e', 0.7], sun: ['#fff0d6', 1.15] },
  // Clean like Old Quarter's: no vignette, grain or dust; a touch more green.
  grade: {
    exposure: 1.03,
    contrast: 1.06,
    saturation: 1.08,
    shadowTint: [-0.006, 0.006, 0.004],
    highlightTint: [0.012, 0.01, -0.006],
    vignette: 0,
    bleach: 0,
    grain: 0,
    dust: [0, 0, 0],
    lift: 0,
  },
}

ENVIRONMENTS.terminal = {
  sunDir: new Vector3(-0.78, 0.38, 0.5).normalize(),
  fog: '#463e3a',
  fogNear: 35,
  fogFar: 360,
  sky: { horizon: '#544640', mid: '#3c3536', zenith: '#1e1e24', sun: '#d8946a', storm: 1, below: [0.07, 0.065, 0.06] },
  hemi: ['#9a9ca6', '#5a504a', 1.2],
  // Firelight from the burning apron, low on the side away from the sun.
  bounce: ['#ff8a4a', 0.24],
  ambient: ['#5a5660', 0.5],
  sun: ['#e8aa82', 1.45],
  envIntensity: 0.32,
  storm: false,
  shadowSpan: 72,
  menuCam: { radius: 72, height: 24, look: [0, 4, -8] },
  vm: { ambient: ['#4e4a52', 0.36], hemi: ['#8a8c96', '#2a2420', 0.42], sun: ['#f0b48c', 0.55] },
  // Gritty: drained colour, bleach-bypass contrast, cold shadows and burnt highlights, grain and a vignette.
  grade: {
    exposure: 1.15,
    contrast: 1.1,
    saturation: 0.72,
    shadowTint: [-0.006, 0.0, 0.014],
    highlightTint: [0.03, 0.012, -0.02],
    vignette: 0.38,
    bleach: 0.16,
    grain: 0.03,
    dust: [0.1, 0.085, 0.075],
    lift: 0.025,
  },
}

export const envFor = (mapId) => ENVIRONMENTS[mapId] ?? ENVIRONMENTS.dustline
