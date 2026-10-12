import { Object3D } from 'three'

const own = Object3D.prototype.updateMatrixWorld

/**
 * three.js (r186) walks every object in the scene before each render to bring
 * its world matrix up to date, hidden or not, moving or not. Most of the world
 * is neither: pools of spent effects (smoke, decals, tracers) sit hidden, the
 * batched map's originals are hidden, and the map itself never moves. This walk
 * skips:
 *  - hidden subtrees: they're not drawn, and they catch up the frame they're
 *    shown again (the walk runs before anything is drawn);
 *  - frozen subtrees (`matrixWorldAutoUpdate = false`, see StaticBatcher),
 *    unless something above them moved, as three itself did before r15x.
 * Code that needs a hidden object's world matrix asks for it
 * (getWorldPosition and co. call updateWorldMatrix), as with three's own walk.
 * Objects with a walk of their own (cameras) keep it.
 */
function walk(o, force) {
  if (o.matrixAutoUpdate) o.updateMatrix()
  if (o.matrixWorldNeedsUpdate || force) {
    if (o.matrixWorldAutoUpdate) {
      if (o.parent === null) o.matrixWorld.copy(o.matrix)
      else o.matrixWorld.multiplyMatrices(o.parent.matrixWorld, o.matrix)
    }
    o.matrixWorldNeedsUpdate = false
    force = true
  }
  const children = o.children
  for (let i = 0, l = children.length; i < l; i++) {
    const c = children[i]
    if (c.visible === false || (c.matrixWorldAutoUpdate === false && !force)) {
      // Something above it moved while it was skipped: catch up when it's next walked.
      if (force) c.matrixWorldNeedsUpdate = true
      continue
    }
    if (c.updateMatrixWorld === own) walk(c, force)
    else c.updateMatrixWorld(force)
  }
}

/**
 * Gives `root` (a scene) the walk above. A forced update (`updateMatrixWorld(true)`)
 * is still three's full one. Returns the undo.
 */
export function leanMatrixWalk(root) {
  root.updateMatrixWorld = function updateMatrixWorld(force) {
    if (force) own.call(this, true)
    else walk(this, false)
  }
  return () => {
    delete root.updateMatrixWorld
  }
}
