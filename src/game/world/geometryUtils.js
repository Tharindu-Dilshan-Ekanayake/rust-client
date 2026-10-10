import { useMemo } from 'react'
import { Euler, Matrix4, Quaternion, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const _up = new Vector3(0, 1, 0)

/** Transform that stretches a unit-height Y cylinder/box between two points. */
export function segmentTransform(a, b) {
  const va = new Vector3(...a)
  const vb = new Vector3(...b)
  const dir = vb.clone().sub(va)
  const length = dir.length()
  const q = new Quaternion().setFromUnitVectors(_up, dir.clone().normalize())
  const mid = va.add(vb).multiplyScalar(0.5)
  return { position: mid, quaternion: q, length }
}

/**
 * Merges many static pieces sharing one material into a single draw call.
 * `pieces` is [{ geometry, position, quaternion?, rotation? (Euler array) }].
 */
export function useMerged(pieces) {
  return useMemo(() => {
    const m = new Matrix4()
    const q = new Quaternion()
    const s = new Vector3(1, 1, 1)
    const geos = pieces.map((p) => {
      const g = p.geometry.clone()
      if (p.quaternion) q.copy(p.quaternion)
      else if (p.rotation) q.setFromEuler(new Euler(p.rotation[0], p.rotation[1], p.rotation[2]))
      else q.identity()
      const pos = Array.isArray(p.position) ? new Vector3(...p.position) : p.position
      m.compose(pos, q, s)
      g.applyMatrix4(m)
      return g
    })
    const merged = mergeGeometries(geos, false)
    geos.forEach((g) => g.dispose())
    return merged
  }, [pieces])
}
