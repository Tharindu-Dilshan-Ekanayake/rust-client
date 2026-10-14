import { useLayoutEffect, useRef } from 'react'
import { BufferAttribute, DoubleSide, FrontSide, Matrix4, Mesh, MeshBasicMaterial, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { SHADOW_ONLY_LAYER } from '../layers.js'

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

/**
 * A key for everything about a material except its colour: materials with the
 * same key draw identically apart from the tint, so their meshes can share one
 * batch with the tint moved into vertex colours (diffuse = colour x vertex
 * colour, both linear, so the result is exactly the same). Anything this can't
 * describe (custom shader hooks, vertex colours of its own) keys on its uuid.
 */
function tintlessKey(mat) {
  if (mat.vertexColors) return mat.uuid
  let key = mat.type
  for (const k of Object.keys(mat).sort()) {
    if (k === 'uuid' || k === 'name' || k === 'id' || k === 'version' || k === 'userData' || k === 'color' || k === '_listeners') continue
    const v = mat[k]
    let s
    if (typeof v === 'function') return mat.uuid
    if (v === null || v === undefined) s = ''
    else if (typeof v !== 'object') s = String(v)
    else if (v.isTexture) s = v.uuid
    else if (v.isColor) s = `${v.r},${v.g},${v.b}`
    else if (v.isVector2 || v.isVector3 || v.isEuler) s = v.toArray().join(',')
    else {
      try {
        s = JSON.stringify(v)
      } catch {
        return mat.uuid
      }
    }
    key += `|${k}=${s}`
  }
  return key
}

/** One white, vertex-coloured copy per tintless key (see tintlessKey). */
const tinted = new Map()
function tintedMaterial(key, mat) {
  if (!tinted.has(key)) {
    const m = mat.clone()
    m.color.setRGB(1, 1, 1)
    m.vertexColors = true
    tinted.set(key, m)
  }
  return tinted.get(key)
}

/**
 * Layered alpha-tested leaves (`userData.prepass`) are drawn twice: first
 * depth only, before everything else (the same shader, so it cuts out exactly
 * the same holes, nudged a hair deeper), then lit, after the rest, testing
 * against that depth without writing it. Cut-outs turn off the GPU's early
 * depth test, so in one pass every leaf behind another gets fully lit and then
 * covered; this way only the front one is, and whatever's hidden behind the
 * leaves isn't drawn either. The two share their program (only render state
 * differs), so nothing more compiles.
 */
const depthPasses = new Map()
const litPasses = new Map()
function depthPassOf(mat) {
  if (!depthPasses.has(mat)) {
    const m = mat.clone()
    m.colorWrite = false
    m.polygonOffset = true
    m.polygonOffsetFactor = 1
    m.polygonOffsetUnits = 1
    depthPasses.set(mat, m)
  }
  return depthPasses.get(mat)
}
function litPassOf(mat) {
  if (!litPasses.has(mat)) {
    const m = mat.clone()
    m.depthWrite = false
    litPasses.set(mat, m)
  }
  return litPasses.get(mat)
}

/** Bakes a material colour into a geometry's vertex colours. */
function addTint(geo, color) {
  const n = geo.getAttribute('position').count
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    a[i * 3] = color.r
    a[i * 3 + 1] = color.g
    a[i * 3 + 2] = color.b
  }
  geo.setAttribute('color', new BufferAttribute(a, 3))
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
 * A mesh that only exists in the sun's shadow map: it lives on the shadow-only
 * layer, which the sun's shadow camera sees and the view camera skips outright.
 */
function shadowProxy(geometry, side) {
  const mesh = new Mesh(geometry, proxyMaterials[side])
  mesh.castShadow = true
  mesh.receiveShadow = false
  mesh.matrixAutoUpdate = false
  mesh.layers.set(SHADOW_ONLY_LAYER)
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
 * frustum culling useful (cells are `cell` metres square, centred on the
 * origin: the whole ±30 m arena is one cell, so it costs one draw per
 * material, and only the outskirts around it are split up for culling).
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
export function StaticBatcher({ children, cell = 64 }) {
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
      const cellKey = `${Math.floor(_centre.x / cell + 0.5)},${Math.floor(_centre.z / cell + 0.5)}`
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
      const look = tintlessKey(mat)
      const key = `${look}|${cast}|${obj.receiveShadow}|${cellKey}`
      if (!buckets.has(key)) buckets.set(key, { cast, look, items: [] })
      buckets.get(key).items.push(obj)
    })

    const created = []
    const hidden = []
    const uncast = []
    for (const { cast, look, items } of buckets.values()) {
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
      // Same material throughout: draw with it. Only the colour differs: one
      // white vertex-coloured copy, each piece's colour baked into its vertices.
      const mixed = items.some((it) => it.material !== items[0].material)
      const merged = mergeAll(
        items.map((mesh) => {
          const g = mesh.geometry.clone()
          g.applyMatrix4(m.multiplyMatrices(toLocal, mesh.matrixWorld))
          normalise(g)
          return mixed ? addTint(g, mesh.material.color) : g
        }),
      )
      if (!merged) continue
      const mesh = new Mesh(merged, mixed ? tintedMaterial(look, items[0].material) : items[0].material)
      mesh.castShadow = cast
      mesh.receiveShadow = items[0].receiveShadow
      mesh.matrixAutoUpdate = false
      target.add(mesh)
      created.push(mesh)
      if (mesh.material.userData.prepass) {
        const pre = new Mesh(merged, depthPassOf(mesh.material))
        pre.renderOrder = -1
        pre.matrixAutoUpdate = false
        target.add(pre)
        created.push(pre)
        mesh.material = litPassOf(mesh.material)
        mesh.renderOrder = 1
      }
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
