import { AdditiveBlending, CanvasTexture, CylinderGeometry, Mesh, MeshBasicMaterial } from 'three'

/**
 * Laser sight beam: a thin additive streak from the module's 'laser' marker,
 * fading out ahead of the gun. Your own (first person) is short and fine;
 * other players' are longer and thicker so they show from across a room. One
 * geometry per size, one material for all of them (so one shader).
 */

let material = null
const geometries = new Map()

function beamMaterial() {
  if (!material) {
    const c = document.createElement('canvas')
    c.width = 4
    c.height = 64
    const ctx = c.getContext('2d')
    const grad = ctx.createLinearGradient(0, 0, 0, 64)
    grad.addColorStop(0, 'rgba(255,255,255,0)')
    grad.addColorStop(0.7, 'rgba(255,255,255,0.35)')
    grad.addColorStop(1, 'rgba(255,255,255,1)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 4, 64)
    material = new MeshBasicMaterial({ color: '#ff2414', alphaMap: new CanvasTexture(c), transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false, toneMapped: false })
  }
  return material
}

/** A beam `length` metres long and `radius` thick at the emitter, pointing down -Z. */
export function laserBeam(length = 2.6, radius = 0.0011) {
  const key = `${length}:${radius}`
  if (!geometries.has(key)) {
    geometries.set(key, new CylinderGeometry(radius * 0.82, radius, length, 6, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -length / 2))
  }
  const beam = new Mesh(geometries.get(key), beamMaterial())
  beam.name = 'laserBeam'
  beam.renderOrder = 5
  return beam
}

/** Other players' beams. */
export const remoteLaserBeam = () => laserBeam(4.5, 0.0045)
