import { rotate3 } from '../shared/math.js'

/** The map from above: everything solid, taller things brighter. */
export function drawMapPlan(map, size) {
  const half = map.half
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')
  const scale = size / (half * 2 + 3)
  const tx = (x) => size / 2 + x * scale
  ctx.fillStyle = 'rgba(214,160,106,0.10)'
  ctx.fillRect(tx(-half), tx(-half), half * 2 * scale, half * 2 * scale)
  for (const col of map.colliders()) {
    if (col.shape === 'box') {
      if (col.half[0] > 20 || col.half[2] > 20) continue
      const top = col.p[1] + col.half[1]
      ctx.fillStyle = top > 2.2 ? 'rgba(232,230,225,0.55)' : 'rgba(232,230,225,0.28)'
      ctx.beginPath()
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const c3 = rotate3([sx * col.half[0], col.half[1], sz * col.half[2]], col.q)
        ctx.lineTo(tx(col.p[0] + c3[0]), tx(col.p[2] + c3[2]))
      }
      ctx.closePath()
      ctx.fill()
    } else {
      const axis = rotate3([0, 1, 0], col.q)
      if (Math.abs(axis[1]) > 0.9) {
        ctx.fillStyle = col.halfHeight * 2 > 2.2 ? 'rgba(232,230,225,0.55)' : 'rgba(232,230,225,0.28)'
        ctx.beginPath()
        ctx.arc(tx(col.p[0]), tx(col.p[2]), col.r * scale, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.strokeStyle = 'rgba(232,230,225,0.4)'
        ctx.lineWidth = col.r * 2 * scale
        ctx.lineCap = 'butt'
        ctx.beginPath()
        ctx.moveTo(tx(col.p[0] - axis[0] * col.halfHeight), tx(col.p[2] - axis[2] * col.halfHeight))
        ctx.lineTo(tx(col.p[0] + axis[0] * col.halfHeight), tx(col.p[2] + axis[2] * col.halfHeight))
        ctx.stroke()
      }
    }
  }
  ctx.strokeStyle = 'rgba(242,163,58,0.5)'
  ctx.lineWidth = 2
  ctx.strokeRect(tx(-half), tx(-half), half * 2 * scale, half * 2 * scale)
  return { canvas: c, scale, size }
}
