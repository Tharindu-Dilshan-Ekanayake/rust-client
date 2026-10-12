import { BufferGeometry, Euler, Float32BufferAttribute, Matrix3, Matrix4, Quaternion, Uint16BufferAttribute, Uint32BufferAttribute, Vector3 } from 'three'

import { boxGeo } from '../materials.js'

const _m = new Matrix4()
const _local = new Matrix4()
const _nm = new Matrix3()
const _q = new Quaternion()
const _e = new Euler()
const _p = new Vector3()
const _s = new Vector3(1, 1, 1)
const _yAxis = new Vector3(0, 1, 0)

/**
 * Collects pieces of static geometry and merges them into one mesh per
 * material. Buildings and vehicles are hundreds of small boxes; building them
 * as a handful of merged meshes keeps React out of it and gives the static
 * batcher little to do.
 *
 * Pieces are written straight into one growing vertex list per material
 * (position, normal, uv and indices, already transformed), so no geometry is
 * cloned per piece and nothing needs merging at the end.
 */
export class Pieces {
  constructor() {
    /** material -> { pos, nor, uv, idx, count } */
    this.byMaterial = new Map()
    /** Transform applied to everything added (see withFrame), or null. */
    this.frame = null
  }

  /** Any geometry (copied), placed by position + quaternion or Euler rotation, optionally scaled. */
  add(material, geometry, position, rotation, scale) {
    if (!material || !geometry) return this
    if (rotation?.isQuaternion) _q.copy(rotation)
    else if (rotation) _q.setFromEuler(_e.set(rotation[0], rotation[1], rotation[2]))
    else _q.identity()
    _p.set(position[0], position[1], position[2])
    if (scale) _s.set(scale[0], scale[1], scale[2])
    else _s.set(1, 1, 1)
    _local.compose(_p, _q, _s)
    if (this.frame) _m.multiplyMatrices(this.frame, _local)
    else _m.copy(_local)
    _nm.getNormalMatrix(_m)

    let b = this.byMaterial.get(material)
    if (!b) {
      b = { pos: [], nor: [], uv: [], idx: [], count: 0 }
      this.byMaterial.set(material, b)
    }
    const pa = geometry.attributes.position
    const na = geometry.attributes.normal
    const ua = geometry.attributes.uv
    const P = pa.array
    const N = na?.array
    const U = ua?.array
    const e = _m.elements
    const n = _nm.elements
    const base = b.count
    for (let i = 0; i < pa.count; i++) {
      const x = P[i * 3]
      const y = P[i * 3 + 1]
      const z = P[i * 3 + 2]
      b.pos.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14])
      if (N) {
        const nx = N[i * 3]
        const ny = N[i * 3 + 1]
        const nz = N[i * 3 + 2]
        const tx = n[0] * nx + n[3] * ny + n[6] * nz
        const ty = n[1] * nx + n[4] * ny + n[7] * nz
        const tz = n[2] * nx + n[5] * ny + n[8] * nz
        const l = Math.hypot(tx, ty, tz) || 1
        b.nor.push(tx / l, ty / l, tz / l)
      } else {
        b.nor.push(0, 1, 0)
      }
      if (U) b.uv.push(U[i * 2], U[i * 2 + 1])
      else b.uv.push(0, 0)
    }
    if (geometry.index) {
      const I = geometry.index.array
      for (let i = 0; i < I.length; i++) b.idx.push(base + I[i])
    } else {
      for (let i = 0; i < pa.count; i++) b.idx.push(base + i)
    }
    b.count += pa.count
    return this
  }

  /** Box centred on (x, y, z) with world-scaled UVs (one texture tile per `tile` m). */
  box(material, x, y, z, w, h, d, tile = 2, rotation) {
    if (w <= 0.001 || h <= 0.001 || d <= 0.001) return this
    return this.add(material, boxGeo(w, h, d, tile), [x, y, z], rotation)
  }

  /** Box from min/max corners (axis-aligned). */
  aabb(material, x0, y0, z0, x1, y1, z1, tile = 2) {
    return this.box(material, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, tile)
  }

  /** Runs `fn` with everything it adds placed at `position`, turned `rotY` about +Y. */
  withFrame(position, rotY, fn) {
    const prev = this.frame
    const frame = new Matrix4().compose(new Vector3(...position), new Quaternion().setFromAxisAngle(_yAxis, rotY), new Vector3(1, 1, 1))
    this.frame = prev ? prev.clone().multiply(frame) : frame
    try {
      fn(this)
    } finally {
      this.frame = prev
    }
    return this
  }

  /** [{ material, geometry }] — one geometry per material. */
  build() {
    const out = []
    for (const [material, b] of this.byMaterial) {
      if (!b.count) continue
      const g = new BufferGeometry()
      g.setAttribute('position', new Float32BufferAttribute(b.pos, 3))
      g.setAttribute('normal', new Float32BufferAttribute(b.nor, 3))
      g.setAttribute('uv', new Float32BufferAttribute(b.uv, 2))
      g.setIndex(b.count > 65535 ? new Uint32BufferAttribute(b.idx, 1) : new Uint16BufferAttribute(b.idx, 1))
      g.computeBoundingSphere()
      out.push({ material, geometry: g })
    }
    return out
  }
}

const built = new Map()

/**
 * Builds once per page and keeps it: the map's geometry is static and never
 * disposed, so switching maps back and forth reuses it instead of rebuilding.
 */
export function once(key, build) {
  if (!built.has(key)) built.set(key, build())
  return built.get(key)
}
