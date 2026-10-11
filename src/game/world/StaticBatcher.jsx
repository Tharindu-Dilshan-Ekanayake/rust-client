import { useLayoutEffect, useRef } from 'react'
import { BufferAttribute, DoubleSide, FrontSide, Matrix4, Mesh, MeshBasicMaterial, Vector3 } from 'three'
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

/** Depth-only copy for shadow proxies: positions (and the index) are all a shadow needs. */
function positionsOnly(geo) {
  for (const name of Object.keys(geo.attributes)) if (name !== 'position') geo.deleteAttribute(name)
  geo.clearGroups()
  return geo
}

function mergeAll(geos) {
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
  return merged
}

const proxyMaterials = { [FrontSide]: new MeshBasicMaterial({ side: FrontSide }), [DoubleSide]: new MeshBasicMaterial({ side: DoubleSide }) }

/**
 * A mesh that only exists in the sun's shadow map: in the main pass its draw
 * range is emptied just before drawing (onBeforeRender runs there, not in the
 * shadow pass) and restored after.
 */
function shadowProxy(geometry, side) {
  const mesh = new Mesh(geometry, proxyMaterials[side])
  mesh.castShadow = true
  mesh.receiveShadow = false
  mesh.matrixAutoUpdate = false
  let count = 0
  mesh.onBeforeRender = () => {
    count = geometry.drawRange.count
    geometry.drawRange.count = 0
  }
  mesh.onAfterRender = () => {
    geometry.drawRange.count = count
  }
  return mesh
}

function isDynamic(obj, root) {
  for (let o = obj; o && o !== root; o = o.parent) if (o.userData?.dynamic) return true
  return false
}

function hasDynamic(obj) {
  let found = false
  obj.traverse((o) => {
    if (o.userData?.dynamic) found = true
  })
  return found
}

/**
 * Stops three.js recomputing the matrices of things that never move. By
 * default every object's world matrix is rebuilt every frame (any parent that
 * auto-updates forces its whole subtree), which for a map of thousands of
 * pieces was ~10% of the frame. Static subtrees are updated once and skipped
 * from then on; on a path down to something animated (`userData.dynamic`) the
 * groups stop forcing their children but still let the animated part through.
 * Records what it changed in `log` so it can be undone.
 */
function freezeStatic(obj, log) {
  if (obj.userData?.dynamic) return
  if (!hasDynamic(obj)) {
    obj.updateMatrixWorld(true)
    log.push(obj)
    obj.matrixAutoUpdate = false
    obj.matrixWorldAutoUpdate = false
    return
  }
  obj.updateMatrix()
  log.push(obj)
  obj.matrixAutoUpdate = false
  for (const child of obj.children) freezeStatic(child, log)
}

/**
 * Merges every static mesh under it into one mesh per (material, shadow flags,
 * spatial cell). The map is hundreds of small boxes sharing a handful of
 * materials, so this turns ~1,500 draw calls into a few hundred while keeping
 * frustum culling useful (cells are `cell` metres square).
 *
 * Solid shadow casters don't cast from their visible batches: they're merged a
 * second time, positions only, into one depth-only proxy per cell, so the sun's
 * shadow pass is a handful of draw calls instead of one per batch. (Alpha-tested
 * fences and fronds keep casting themselves, holes and all.)
 *
 * Instanced, skinned, depth-writing transparent and `userData.dynamic` meshes
 * are left alone. Originals are hidden rather than removed, so React still owns
 * them.
 */
export function StaticBatcher({ children, cell = 32 }) {
  const root = useRef(null)
  const out = useRef(null)

  useLayoutEffect(() => {
    const group = root.current
    const target = out.current
    if (!group || !target) return undefined
    group.updateMatrixWorld(true)
    const toLocal = new Matrix4().copy(group.matrixWorld).invert()

    const buckets = new Map()
    const proxies = new Map()
    const m = new Matrix4()
    group.traverse((obj) => {
      if (!obj.isMesh || obj.isInstancedMesh || obj.isSkinnedMesh || !obj.visible) return
      const mat = obj.material
      if (!mat || Array.isArray(mat) || isDynamic(obj, group)) return
      // Decals (transparent, no depth write) merge fine; other transparent things need sorting.
      if (mat.transparent && mat.depthWrite) return
      _centre.setFromMatrixPosition(obj.matrixWorld)
      const cellKey = `${Math.floor(_centre.x / cell)},${Math.floor(_centre.z / cell)}`
      const proxied = obj.castShadow && !mat.transparent && !(mat.alphaTest > 0)
      if (proxied) {
        const side = mat.side === FrontSide ? FrontSide : DoubleSide
        const pk = `${cellKey}|${side}`
        if (!proxies.has(pk)) proxies.set(pk, { side, geos: [] })
        const g = positionsOnly(obj.geometry.clone())
        g.applyMatrix4(m.multiplyMatrices(toLocal, obj.matrixWorld))
        proxies.get(pk).geos.push(g)
      }
      const cast = obj.castShadow && !proxied
      const key = `${mat.uuid}|${cast}|${obj.receiveShadow}|${cellKey}`
      if (!buckets.has(key)) buckets.set(key, { cast, items: [] })
      buckets.get(key).items.push(obj)
    })

    const created = []
    const hidden = []
    const uncast = []
    for (const { cast, items } of buckets.values()) {
      if (items.length < 2) {
        // Left as it is, but its shadow now comes from the proxy.
        for (const src of items) {
          if (src.castShadow && !cast) {
            src.castShadow = false
            uncast.push(src)
          }
        }
        continue
      }
      const merged = mergeAll(
        items.map((mesh) => {
          const g = mesh.geometry.clone()
          g.applyMatrix4(m.multiplyMatrices(toLocal, mesh.matrixWorld))
          return normalise(g)
        }),
      )
      if (!merged) continue
      const mesh = new Mesh(merged, items[0].material)
      mesh.castShadow = cast
      mesh.receiveShadow = items[0].receiveShadow
      mesh.matrixAutoUpdate = false
      target.add(mesh)
      created.push(mesh)
      for (const src of items) {
        src.visible = false
        src.matrixAutoUpdate = false
        hidden.push(src)
      }
    }
    for (const { side, geos } of proxies.values()) {
      const merged = mergeAll(geos)
      if (!merged) continue
      const mesh = shadowProxy(merged, side)
      target.add(mesh)
      created.push(mesh)
    }

    // Everything here is static (bar the `dynamic` parts): freeze the matrices,
    // including the plain groups above us that would otherwise force updates.
    const frozen = []
    group.parent?.updateMatrixWorld(true)
    for (let o = group.parent; o && !o.isScene; o = o.parent) {
      o.updateMatrix()
      frozen.push(o)
      o.matrixAutoUpdate = false
    }
    freezeStatic(group, frozen)
    freezeStatic(target, frozen)

    return () => {
      for (const src of uncast) src.castShadow = true
      for (const o of frozen) {
        o.matrixAutoUpdate = true
        o.matrixWorldAutoUpdate = true
      }
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
