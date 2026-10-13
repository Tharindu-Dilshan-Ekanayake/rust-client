import { BELFRY } from '../shared/mapHollow.js'

/**
 * What a map sounds like between the gunfire, in a match (audio/sfx.js
 * plays it). With none, it's a war somewhere beyond the walls: distant
 * artillery and bursts. Hollow Creek has a Halloween night instead: wind in
 * the pines and crickets under everything, the church bell tolling from its
 * belfry now and then, and owls, crows and far-off wolves out in the woods,
 * each from its own direction.
 *
 * `calls` are one-shots placed at a random bearing `radius` metres from the
 * middle of the map (`ref` is the panner's reference distance: bigger carries
 * further), one every `every` seconds.
 */
const AMBIENCE = {
  hollow: Object.freeze({
    bed: 'nightBed',
    bedVolume: 0.18,
    bell: {
      pos: [(BELFRY.x0 + BELFRY.x1) / 2, (BELFRY.belfry[0] + BELFRY.belfry[1]) / 2, (BELFRY.z0 + BELFRY.z1) / 2],
      strikes: 3,
      gap: 2.6,
      first: 5,
      every: [70, 120],
      volume: 0.85,
      ref: 18,
    },
    every: [7, 15],
    calls: [
      { sound: 'owl', weight: 4, radius: [26, 44], height: 9, ref: 8, volume: 0.55 },
      { sound: 'crow', weight: 3, radius: [18, 40], height: 7, ref: 8, volume: 0.5 },
      { sound: 'wolfHowl', weight: 2, radius: [110, 160], height: 20, ref: 50, volume: 0.7 },
    ],
  }),
}

/** The ambience for a map, or null for the distant battle. */
export const ambienceFor = (mapId) => AMBIENCE[mapId] ?? null
