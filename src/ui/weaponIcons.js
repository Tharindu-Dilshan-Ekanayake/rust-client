import { useSyncExternalStore } from 'react'
import { Matrix4, Vector3 } from 'three'

import { createWeaponModel } from '../game/models/weaponModels.js'
import { WEAPONS } from '../shared/weapons.js'

/**
 * Gun icons drawn from the guns themselves: each gun's 3D model, flattened to
 * its side silhouette (barrel to the right) on a canvas, once, in an idle
 * moment. Every gun gets an icon that is exactly its shape, however many guns
 * there are. Until one is ready, callers fall back to a hand-drawn icon.
 */

const HEIGHT = 96
/** Coverage samples per pixel, each way (4 x 4: smooth edges). */
const SS = 4
const icons = new Map()
const listeners = new Set()
let version = 0
const queue = []
let idleQueued = false

const _m = new Matrix4()
const _a = new Vector3()
const _b = new Vector3()
const _c = new Vector3()

/** x along the segment p -> q at height y (p, q as [x, y]). */
const along = (px, py, qx, qy, y) => (qy - py > 1e-9 ? px + ((qx - px) * (y - py)) / (qy - py) : qx)

/**
 * Marks the coverage samples (`w` wide) whose centres a triangle covers, a
 * row at a time. Every triangle is filled into the same mask, so the result
 * is their union, without seams where they meet.
 */
function fillTriangle(cover, w, h, ax, ay, bx, by, cx, cy) {
  // Sorted top to bottom: a, b, c.
  if (ay > by) [ax, ay, bx, by] = [bx, by, ax, ay]
  if (by > cy) [bx, by, cx, cy] = [cx, cy, bx, by]
  if (ay > by) [ax, ay, bx, by] = [bx, by, ax, ay]
  const y0 = Math.max(0, Math.ceil(ay - 0.5))
  const y1 = Math.min(h - 1, Math.floor(cy - 0.5))
  for (let y = y0; y <= y1; y++) {
    const py = y + 0.5
    const xa = along(ax, ay, cx, cy, py)
    const xb = py < by ? along(ax, ay, bx, by, py) : along(bx, by, cx, cy, py)
    const x0 = Math.max(0, Math.ceil(Math.min(xa, xb) - 0.5))
    const x1 = Math.min(w - 1, Math.floor(Math.max(xa, xb) - 0.5))
    if (x1 >= x0) cover.fill(1, y * w + x0, y * w + x1 + 1)
  }
}

/** The silhouette of a gun as { url, aspect } (width / height), or null if it can't be built. */
function draw(id) {
  // As it comes (its default attachments): the model the menus build anyway.
  const model = createWeaponModel(id)
  model.updateMatrixWorld(true)
  const inv = new Matrix4().copy(model.matrixWorld).invert()
  const tris = []
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  model.traverse((o) => {
    if (!o.isMesh || !o.visible || o.name === 'shadowProxy' || o.name === 'lod' || o.material?.transparent || o.material?.isMeshBasicMaterial) return
    const pos = o.geometry.getAttribute('position')
    const index = o.geometry.index
    _m.multiplyMatrices(inv, o.matrixWorld)
    const n = index ? index.count : pos.count
    for (let i = 0; i < n; i += 3) {
      const ia = index ? index.getX(i) : i
      const ib = index ? index.getX(i + 1) : i + 1
      const ic = index ? index.getX(i + 2) : i + 2
      _a.fromBufferAttribute(pos, ia).applyMatrix4(_m)
      _b.fromBufferAttribute(pos, ib).applyMatrix4(_m)
      _c.fromBufferAttribute(pos, ic).applyMatrix4(_m)
      // Side view: forward (-z) to the right, up is up.
      const t = [-_a.z, _a.y, -_b.z, _b.y, -_c.z, _c.y]
      tris.push(t)
      for (let k = 0; k < 6; k += 2) {
        minX = Math.min(minX, t[k])
        maxX = Math.max(maxX, t[k])
        minY = Math.min(minY, t[k + 1])
        maxY = Math.max(maxY, t[k + 1])
      }
    }
  })
  if (!tris.length) return null
  const h = maxY - minY
  const w = maxX - minX
  const scale = (HEIGHT - 4) / h
  const width = Math.ceil(w * scale) + 4
  // Filled into a coverage mask SS x SS finer than the icon, then averaged
  // down to alpha. (A canvas path of thousands of triangles took up to most
  // of a second to fill; this takes a few milliseconds.)
  const sw = width * SS
  const sh = HEIGHT * SS
  const cover = new Uint8Array(sw * sh)
  const X = (x) => (2 + (x - minX) * scale) * SS
  const Y = (y) => (HEIGHT - 2 - (y - minY) * scale) * SS
  for (const t of tris) {
    if (Math.abs((t[2] - t[0]) * (t[5] - t[1]) - (t[4] - t[0]) * (t[3] - t[1])) < 1e-12) continue
    fillTriangle(cover, sw, sh, X(t[0]), Y(t[1]), X(t[2]), Y(t[3]), X(t[4]), Y(t[5]))
  }
  const canvas = document.createElement('canvas')
  canvas.height = HEIGHT
  canvas.width = width
  // A CPU canvas: reading a GPU one back (toDataURL) waits on the GPU, which
  // mid-match is busy drawing the game (most of a second on an iGPU).
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const img = ctx.createImageData(width, HEIGHT)
  const px = img.data
  const full = SS * SS
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < width; x++) {
      let n = 0
      for (let j = 0; j < SS; j++) {
        const row = (y * SS + j) * sw + x * SS
        for (let i = 0; i < SS; i++) n += cover[row + i]
      }
      if (!n) continue
      const k = (y * width + x) * 4
      px[k] = px[k + 1] = px[k + 2] = 255
      px[k + 3] = Math.round((n * 255) / full)
    }
  }
  ctx.putImageData(img, 0, 0)
  return { url: canvas.toDataURL(), aspect: width / HEIGHT }
}

function notify() {
  version++
  for (const l of listeners) l()
}

const whenIdle = (fn) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 40))

function runQueue() {
  idleQueued = false
  const id = queue.shift()
  if (id && !icons.has(id)) {
    try {
      icons.set(id, draw(id))
    } catch {
      icons.set(id, null)
    }
    notify()
  }
  if (queue.length && !idleQueued) {
    idleQueued = true
    whenIdle(runQueue)
  }
}

/** Queues icons to be drawn in idle time (the ones asked for first jump the queue). */
export function prepareWeaponIcons(ids, first = false) {
  for (const id of ids) {
    if (icons.has(id) || queue.includes(id) || !WEAPONS[id] || id === 'knife') continue
    if (first) queue.unshift(id)
    else queue.push(id)
  }
  if (queue.length && !idleQueued) {
    idleQueued = true
    whenIdle(runQueue)
  }
}

const subscribe = (l) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
const getVersion = () => version

/** A gun's silhouette { url, aspect }, or null while it's being drawn (it re-renders when ready). */
export function useWeaponIcon(id) {
  useSyncExternalStore(subscribe, getVersion)
  const icon = icons.get(id)
  if (icon === undefined && WEAPONS[id] && id !== 'knife') prepareWeaponIcons([id], true)
  return icon ?? null
}
