import { useMemo } from 'react'

import { segmentTransform } from './geometryUtils.js'
import { boxGeo, cylGeo } from './materials.js'

/** Box mesh with world-scaled UVs. `position` is the box centre. */
export function Box({ size, tile = 2, material, shadow = true, ...props }) {
  return (
    <mesh
      geometry={boxGeo(size[0], size[1], size[2], tile)}
      material={material}
      castShadow={shadow}
      receiveShadow
      {...props}
    />
  )
}

/** Vertical cylinder centred at `position`. */
export function Cyl({ r, h, segments = 20, tile = 2, openEnded = false, rTop, material, shadow = true, ...props }) {
  return (
    <mesh
      geometry={cylGeo(r, h, segments, tile, openEnded, rTop ?? r)}
      material={material}
      castShadow={shadow}
      receiveShadow
      {...props}
    />
  )
}

/** Thin rod between two points (wires, rails, braces). */
export function Rod({ a, b, r = 0.03, material, segments = 6, shadow = false }) {
  const t = useMemo(() => segmentTransform(a, b), [a, b])
  return (
    <mesh
      geometry={cylGeo(r, t.length, segments, 1)}
      material={material}
      position={t.position}
      quaternion={t.quaternion}
      castShadow={shadow}
    />
  )
}
