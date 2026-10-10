import { useLayoutEffect, useRef } from 'react'
import { BufferAttribute, Matrix4, Mesh, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const KEEP = ['position', 'normal', 'uv']
const _centre = new Vector3()

/** Strips a cloned geometry down to the attributes every batch shares. */
function normalise(geo) {
  for (const name of Object.keys(geo.attributes)) if (!KEEP.includes(name)) geo.deleteAttribute(name)
  if (!geo.getAttribute('uv')) {
    geo.setAttribute('uv', new BufferAttribute(new Float32Array(geo.getAttribute('position').count * 2), 2))
  }
  if (!geo.getAttribute('normal')) geo.computeVertexNormals()
  geo.clearGroups()
  return geo
}

function isDynamic(obj, root) {
  for (let o = obj; o && o !== root; o = o.parent) if (o.userData?.dynamic) return true
  return false
}

/**
 * Merges every static mesh under it into one mesh per (material, shadow flags,
 * spatial cell). The map is hundreds of small boxes sharing a handful of
 * materials, so this turns ~1,500 draw calls into a few hundred while keeping
 * frustum culling useful (cells are `cell` metres square).
 *
 * Instanced, skinned, transparent and `userData.dynamic` meshes are left alone.
 * Originals are hidden rather than removed, so React still owns them.
 */
export function StaticBatcher({ children, cell = 16 }) {
  const root = useRef(null)
  const out = useRef(null)

  useLayoutEffect(() => {
    const group = root.current
    const target = out.current
    if (!group || !target) return undefined
    group.updateMatrixWorld(true)
    const toLocal = new Matrix4().copy(group.matrixWorld).invert()

    const buckets = new Map()
    group.traverse((obj) => {
      if (!obj.isMesh || obj.isInstancedMesh || obj.isSkinnedMesh || !obj.visible) return
      const mat = obj.material
      if (!mat || Array.isArray(mat) || mat.transparent || isDynamic(obj, group)) return
      _centre.setFromMatrixPosition(obj.matrixWorld)
      const key = `${mat.uuid}|${obj.castShadow}|${obj.receiveShadow}|${Math.floor(_centre.x / cell)},${Math.floor(_centre.z / cell)}`
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key).push(obj)
    })

    const created = []
    const hidden = []
    const m = new Matrix4()
    for (const list of buckets.values()) {
      if (list.length < 2) continue
      let geos = list.map((mesh) => {
        const g = mesh.geometry.clone()
        g.applyMatrix4(m.multiplyMatrices(toLocal, mesh.matrixWorld))
        return normalise(g)
      })
      // mergeGeometries needs all-indexed or all-not.
      if (geos.some((g) => !g.index) && geos.some((g) => g.index)) {
        geos = geos.map((g) => {
          if (!g.index) return g
          const flat = g.toNonIndexed()
          g.dispose()
          return flat
        })
      }
      const merged = mergeGeometries(geos, false)
      geos.forEach((g) => g.dispose())
      if (!merged) continue
      const mesh = new Mesh(merged, list[0].material)
      mesh.castShadow = list[0].castShadow
      mesh.receiveShadow = list[0].receiveShadow
      mesh.matrixAutoUpdate = false
      target.add(mesh)
      created.push(mesh)
      for (const src of list) {
        src.visible = false
        src.matrixAutoUpdate = false
        hidden.push(src)
      }
    }

    return () => {
      for (const mesh of created) {
        target.remove(mesh)
        mesh.geometry.dispose()
      }
      // Un-hide the originals: StrictMode (and HMR) re-run this effect, and the
      // next pass skips anything invisible — without this the map vanishes in dev.
      for (const src of hidden) {
        src.visible = true
        src.matrixAutoUpdate = true
      }
    }
  }, [cell])

  return (
    <group>
      <group ref={root}>{children}</group>
      <group ref={out} />
    </group>
  )
}

export default StaticBatcher
