import { Vector3 } from 'three'

/** Direction toward the hazy late-afternoon sun (west-south-west, ~27° up). */
export const SUN_DIR = new Vector3(-0.72, 0.46, 0.52).normalize()
export const FOG_COLOR = '#b49a74'

/** Storm wind (m/s): blowing debris, sand sheets, drifting motes and smoke all lean this way. */
export const STORM_WIND = [7.2, 0, 3.2]
