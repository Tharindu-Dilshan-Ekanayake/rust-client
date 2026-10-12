import { Box3, BufferGeometry, Matrix4, Mesh, MeshStandardMaterial, Vector3 } from 'three'

import { assetUrls, BASE_BODY_URL, isRealId, skinIdOrDefault, skinTextureUrl } from '../../bloxity/avatarAssets'
import { loadPartGLB, loadTexture } from '../../bloxity/avatarLoader'

/**
 * First-person arms made from the player's own Bloxity avatar: the arm part
 * they wear (or the base body's), in their skin texture with the shirt drawn
 * on (so the sleeves match). Hand accessories (gloves, watches...) are left off
 * in this game: they don't sit right on a first-person arm.
 *
 * A Bloxity arm is a block from shoulder to hand. Here it's turned to point
 * forward with its front face up, its hand end just past the wrist point that
 * placeArm puts the group at (+Z runs back toward the elbow), and sized for a
 * first-person view: narrower across than the avatar's, and one unit long, so
 * placeArm can stretch it to end at the elbow every frame like the old sleeve.
 */

/** Across the arm, in viewmodel units (the old sleeve was 0.062). */
const WIDTH = 0.056
/** How far the hand end sits past the wrist point, round the grip. */
const REACH = 0.045

const SIDES = {
  L: { slot: 'armLId', mesh: 'default_arm_L', dir: '_L' },
  R: { slot: 'armRId', mesh: 'default_arm_R', dir: '_R' },
}
const KEEP = ['position', 'normal', 'uv']

function firstMesh(root, name) {
  let found = null
  root?.traverse((o) => {
    if (found || !o.isMesh) return
    if (!name || o.name === name) found = o
  })
  return found
}

/** A copy of just what drawing a rigid arm needs. */
function plain(geometry) {
  const g = new BufferGeometry()
  for (const name of KEEP) if (geometry.getAttribute(name)) g.setAttribute(name, geometry.getAttribute(name).clone())
  if (geometry.index) g.setIndex(geometry.index.clone())
  if (!g.getAttribute('normal')) g.computeVertexNormals()
  return g
}

/**
 * Model space (avatar facing +Z, arms hanging down, ~6.4 units tall) to the
 * arm's first-person frame, for an arm whose hand end is centred on `hand`.
 */
function toFirstPerson(hand, scale, length) {
  return new Matrix4()
    .makeScale(scale, scale, length)
    // Hanging down -> pointing forward, front face up (the shoulder end goes to +Z).
    .multiply(new Matrix4().makeRotationX(Math.PI / 2))
    // Facing +Z -> facing away from us, like the camera: the left arm on the left.
    .multiply(new Matrix4().makeRotationY(Math.PI))
    .multiply(new Matrix4().makeTranslation(-hand.x, -hand.y, -hand.z))
}

/**
 * Builds the two arms for an equipped set (null: the default body and skin).
 * Resolves to { L: Mesh[], R: Mesh[] } in first-person arm space, or null if
 * the base body can't be loaded. New meshes and materials every call.
 */
export async function buildBloxArms(equipped) {
  const base = await loadPartGLB(BASE_BODY_URL)
  if (!base) return null
  base.updateMatrixWorld(true)

  const texture =
    (await loadTexture(skinTextureUrl(equipped))) ?? (await loadTexture(assetUrls.skinTexture(skinIdOrDefault(equipped?.skinId))))
  const skin = new MeshStandardMaterial({ map: texture, roughness: 0.92, metalness: 0 })

  const out = {}
  for (const [side, cfg] of Object.entries(SIDES)) {
    const baseArm = firstMesh(base, cfg.mesh)
    if (!baseArm) return null
    // Sized from the base arm, so a bulkier arm part still reads bulkier.
    const box = new Box3().setFromBufferAttribute(baseArm.geometry.getAttribute('position'))
    const hand = new Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2)
    const scale = WIDTH / (box.max.x - box.min.x)
    const length = 1 / (box.max.y - box.min.y)

    let source = baseArm.geometry
    const partId = equipped?.[cfg.slot]
    if (isRealId(partId)) {
      const part = firstMesh(await loadPartGLB(assetUrls.part(side === 'L' ? 'arm_L' : 'arm_R', partId)))
      if (part) source = part.geometry
    }
    const arm = plain(source)
    arm.applyMatrix4(toFirstPerson(hand, scale, length))
    const mesh = new Mesh(arm, skin)
    mesh.position.z = -REACH
    out[side] = [mesh]
  }
  return out
}

/**
 * Puts Bloxity arm meshes on an arm group from makeArm (hiding its own gloved
 * hand and sleeve), or takes them off again with `meshes` null. Things hung on
 * the arm since (a shotgun shell, a grenade) stay where they are.
 */
export function dressArm(arm, meshes) {
  for (const old of arm.userData.blox ?? []) {
    arm.remove(old)
    old.geometry.dispose()
  }
  arm.userData.blox = meshes ?? []
  arm.userData.bloxReach = REACH
  for (const part of arm.userData.parts ?? []) part.visible = !meshes
  for (const mesh of arm.userData.blox) arm.add(mesh)
}
