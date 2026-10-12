import { BufferGeometry, MeshStandardMaterial, NearestFilter, Quaternion, SkinnedMesh, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { BACK_BONE, HAT_BONE, NECK_OFFSET_BONE, PART_SLOTS } from '../bloxity/avatarAssets'

/**
 * Rig manipulation for the base `player.glb` character.
 *
 * The rig's real structure (confirmed by reading player.glb directly):
 *   character
 *     - default_arm_L / default_arm_R / default_head
 *     - default_leg_L / default_leg_R / default_torso   (6 SkinnedMeshes, 1 skeleton)
 *     - Rig1
 *         - Spine1 > Spine2 > { ArmL_Offset > ArmL1 > ArmL2,
 *                               ArmR_Offset > ArmR1 > ArmR2,
 *                               Neck_Offset > Neck1 }
 *         - LegL_Offset > LegL1 > LegL2, LegR_Offset > LegR1 > LegR2
 *
 * Two consequences drive everything below:
 *  1. Body parts are NOT attached to bones. Each is a separate SkinnedMesh sharing one
 *     skeleton, so equipping a part means swapping that mesh's geometry (remapping
 *     skin indices into the base skeleton's bone order first).
 *  2. Accessories DO attach to bones: hats to `Neck1`, back items to `Spine2`.
 *
 * player.glb ships no animation clips, so the character is posed, not animated.
 */

/**
 * Walks the loaded rig and collects everything later operations need.
 *
 * @param {import('three').Object3D} root
 */
export function collectRig(root) {
  const rig = {
    root,
    skeleton: null,
    /** slot -> SkinnedMesh */
    partMeshes: {},
    /** slot -> the pristine geometry to restore on unequip */
    originalGeometries: {},
    /** bone name -> { bone, origPos, origQuat, origScale } */
    bones: {},
    /** The rest pose with the proportions applied (see applyProportions). */
    rest: null,
    hatBone: null,
    backBone: null,
    neckOffsetBindY: 0,
    skinnedMeshes: [],
    /** Rest Y of the character root, so the run-cycle bob can return to it. */
    rootRestY: root.position.y,
  }

  const meshBySlot = new Map(
    Object.entries(PART_SLOTS).map(([slot, cfg]) => [cfg.mesh.toLowerCase(), slot]),
  )

  root.traverse((node) => {
    if (node.isSkinnedMesh) {
      node.castShadow = true
      node.receiveShadow = true
      rig.skinnedMeshes.push(node)
      if (!rig.skeleton) rig.skeleton = node.skeleton

      const slot = meshBySlot.get((node.name || '').toLowerCase())
      if (slot) {
        rig.partMeshes[slot] = node
        rig.originalGeometries[slot] = node.geometry.clone()
      }
    } else if (node.isMesh) {
      node.castShadow = true
      node.receiveShadow = true
    }
  })

  const skeleton = rig.skeleton
  if (skeleton) {
    for (const bone of skeleton.bones) {
      // Proportions are re-applied every frame from these rest values.
      bone.matrixAutoUpdate = true
      // Bones are posed through their quaternions only: skip three mirroring
      // every change into `rotation` (an Euler conversion per bone, several
      // times a frame per player).
      bone.quaternion._onChange(noop)
      rig.bones[bone.name] = {
        bone,
        origPos: bone.position.clone(),
        origQuat: bone.quaternion.clone(),
        origScale: bone.scale.clone(),
      }
    }

    // Bone local axes are NOT world-aligned in this rig: a limb bone's local X
    // points along world -Z and its local Z along world -X, so rotating a leg about
    // its local X swings it sideways instead of forward/back. The offsets differ per
    // bone (Spine1 is identity, ArmL2 is off by ~14 degrees), so rather than hardcode
    // an axis, record for each bone the local-space axis matching each character-space
    // axis and animate about those.
    root.updateMatrixWorld(true)
    const rootQuat = new Quaternion()
    root.getWorldQuaternion(rootQuat)
    const rootQuatInv = rootQuat.invert()
    const boneWorld = new Quaternion()

    for (const bone of skeleton.bones) {
      const entry = rig.bones[bone.name]
      if (!entry) continue
      bone.getWorldQuaternion(boneWorld)
      // Bone orientation relative to the character, then inverted: this maps a
      // character-space axis into the bone's own local frame.
      const relInv = rootQuatInv.clone().multiply(boneWorld).invert()
      /** Local axis to rotate about for forward/back swing. */
      entry.axisX = new Vector3(1, 0, 0).applyQuaternion(relInv).normalize()
      /** Local axis to rotate about for lateral sway. */
      entry.axisZ = new Vector3(0, 0, 1).applyQuaternion(relInv).normalize()
      /** Local axis to rotate about for turning (yaw), e.g. bringing a hand inward. */
      entry.axisY = new Vector3(0, 1, 0).applyQuaternion(relInv).normalize()
    }

    rig.hatBone = skeleton.bones.find((b) => b.name === HAT_BONE) || null
    rig.backBone = skeleton.bones.find((b) => b.name === BACK_BONE) || null

    const neckIndex = skeleton.bones.findIndex((b) => b.name === NECK_OFFSET_BONE)
    if (neckIndex >= 0) {
      // elements[13] is the Y translation of the inverted bind matrix.
      rig.neckOffsetBindY = skeleton.boneInverses[neckIndex].clone().invert().elements[13]
    }
  }

  return rig
}

/** The body's material (the skin texture goes on as its map once loaded). */
export function avatarSkinMaterial() {
  return new MeshStandardMaterial({ color: 0xffffff, metalness: 0, roughness: 1 })
}

/**
 * SkeletonUtils.clone gives each body mesh its own Skeleton over the same
 * bones, so the same bone matrices were computed and uploaded six times per
 * avatar every frame. Point every mesh at the first one's.
 */
export function shareSkeleton(rig) {
  const shared = rig.skeleton
  if (!shared) return
  for (const mesh of rig.skinnedMeshes) {
    const own = mesh.skeleton
    if (!own || own === shared || own.bones.length !== shared.bones.length) continue
    const same = own.bones.every((b, i) => b === shared.bones[i]) && own.boneInverses.every((m, i) => m.equals(shared.boneInverses[i]))
    if (!same) continue
    mesh.skeleton = shared
    own.dispose()
  }
}

const BODY_ATTRIBUTES = ['position', 'normal', 'uv', 'skinIndex', 'skinWeight']

/**
 * Once assembled, the six body parts share a skeleton, a material and the skin
 * texture, so they're drawn as one mesh: one draw and one shadow draw per
 * player instead of six each. The parts stay in the rig, hidden, for the next
 * assembly (unmergeBody). Anything that doesn't line up leaves them as they are.
 *
 * The merged mesh is frustum-culled against its bind-pose bounds, padded for
 * limbs swinging and proportions stretching (the parts never were culled).
 */
export function mergeBody(rig) {
  unmergeBody(rig)
  const parts = rig.skinnedMeshes
  const first = parts[0]
  if (parts.length < 2 || !first?.parent) return
  const lines = parts.every(
    (m) =>
      m.skeleton === first.skeleton &&
      m.material === first.material &&
      m.parent === first.parent &&
      m.bindMode === first.bindMode &&
      m.bindMatrix.equals(first.bindMatrix) &&
      m.matrix.equals(first.matrix) &&
      BODY_ATTRIBUTES.every((a) => m.geometry.getAttribute(a)),
  )
  if (!lines) return
  const indexed = parts.every((m) => m.geometry.index)
  let merged
  try {
    const geos = parts.map((m) => {
      const g = new BufferGeometry()
      if (indexed) g.setIndex(m.geometry.index)
      const src = indexed ? m.geometry : m.geometry.toNonIndexed()
      for (const a of BODY_ATTRIBUTES) g.setAttribute(a, src.getAttribute(a))
      return g
    })
    merged = mergeGeometries(geos, false)
  } catch {
    merged = null
  }
  if (!merged) return
  merged.computeBoundingSphere()
  const body = new SkinnedMesh(merged, first.material)
  body.name = 'mergedBody'
  body.castShadow = true
  body.receiveShadow = true
  first.matrix.decompose(body.position, body.quaternion, body.scale)
  body.bindMode = first.bindMode
  body.bind(first.skeleton, first.bindMatrix)
  body.boundingSphere = merged.boundingSphere.clone()
  body.boundingSphere.radius *= 1.5
  first.parent.add(body)
  for (const m of parts) m.visible = false
  rig.mergedBody = body
}

export function unmergeBody(rig) {
  const body = rig.mergedBody
  if (!body) return
  body.parent?.remove(body)
  body.geometry.dispose()
  rig.mergedBody = null
  for (const m of rig.skinnedMeshes) m.visible = true
}

/** Bloxity textures are authored unflipped and pixel-art filtered. */
export function configureAvatarTexture(texture) {
  if (!texture) return texture
  texture.flipY = false
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.needsUpdate = true
  return texture
}

/**
 * Applies the skin texture to every skinned mesh of the base body.
 * The base body ships with an empty texture, so this always runs - with skin "0"
 * standing in when nothing is equipped.
 */
export function applySkin(rig, texture) {
  if (!texture) return
  for (const mesh of rig.skinnedMeshes) {
    if (!mesh.material) continue
    mesh.material.map = texture
    mesh.material.needsUpdate = true
  }
}

/**
 * Swaps a body part's geometry onto its base skinned mesh.
 *
 * A part GLB carries its own skeleton whose bone *order* may differ from the base
 * rig's. Its `skinIndex` attribute therefore has to be remapped by bone name, or the
 * limb deforms against the wrong bones.
 *
 * @param {object} rig from `collectRig`
 * @param {string} slot key of PART_SLOTS
 * @param {import('three').Object3D|null} partScene loaded GLB scene, or null to reset
 */
export function applyPart(rig, slot, partScene) {
  const targetMesh = rig.partMeshes[slot]
  if (!targetMesh) return

  // Unequipped / failed download: restore the part baked into player.glb.
  if (!partScene) {
    const original = rig.originalGeometries[slot]
    if (original && targetMesh.geometry !== original) targetMesh.geometry = original
    return
  }

  let skinnedSource = null
  let plainSource = null
  partScene.traverse((node) => {
    if (node.isSkinnedMesh && !skinnedSource) skinnedSource = node
    else if (node.isMesh && !plainSource) plainSource = node
  })

  if (!skinnedSource) {
    // Some parts ship as plain meshes; use them as-is.
    if (plainSource) targetMesh.geometry = plainSource.geometry
    return
  }

  const baseSkeleton = rig.skeleton
  if (!baseSkeleton || !skinnedSource.skeleton) {
    targetMesh.geometry = skinnedSource.geometry
    return
  }

  const geometry = skinnedSource.geometry.clone()

  const baseIndexByName = new Map()
  baseSkeleton.bones.forEach((bone, i) => baseIndexByName.set(bone.name, i))

  const remap = new Map()
  skinnedSource.skeleton.bones.forEach((bone, i) => {
    const baseIndex = baseIndexByName.get(bone.name)
    if (baseIndex !== undefined) remap.set(i, baseIndex)
  })

  const skinIndex = geometry.getAttribute('skinIndex')
  if (skinIndex) {
    const array = skinIndex.array
    for (let i = 0; i < array.length; i += 1) {
      const mapped = remap.get(array[i])
      if (mapped !== undefined) array[i] = mapped
    }
    skinIndex.needsUpdate = true
  }

  targetMesh.geometry = geometry
}

/**
 * Attaches a hat or back accessory to its bone.
 * Offsets are the SDK's own: hats sit at y=0.8 on `Neck1`, back items at the origin
 * of `Spine2`.
 */
export function attachAccessory(rig, kind, object) {
  const bone = kind === 'hat' ? rig.hatBone : rig.backBone
  if (!object || !bone) return null

  object.scale.setScalar(1)
  object.position.set(0, kind === 'hat' ? 0.8 : 0, 0)
  object.traverse((child) => {
    if (child.isMesh) child.castShadow = true
  })

  bone.add(object)
  return object
}

/**
 * Applies Bloxity body proportions.
 *
 * Must run every frame: each bone is reset to its rest transform before the
 * multipliers are re-applied, which is what makes the result idempotent and lets
 * proportion changes take effect live.
 *
 * `height`, `armLength`, `headScale` and `neckHeight` are applied exactly as the
 * Bloxity portal does, so the in-game body matches the preview. The remaining three
 * (`shoulderWidth`, `torsoScaleX`, `legOffsetX`) are not implemented in the SDK's
 * preview renderer; they are applied here in the spirit of their names and are the
 * ones to sanity-check against the portal.
 */
export function applyProportions(rig, proportions) {
  if (!rig.skeleton || !proportions) return

  // The proportioned rest pose only changes with the proportions: it's worked
  // out when they do, and every other frame the bones are just reset to it.
  let rest = rig.rest
  let changed = !rest
  for (let i = 0; !changed && i < PROPORTIONS.length; i++) changed = (proportions[PROPORTIONS[i]] ?? 1) !== rest.values[i]
  if (changed) rest = rig.rest = restPose(rig, proportions)

  // Overall height is a scale on the character root, not on a bone.
  rig.root.scale.set(1, rest.values[0], 1)
  for (const pose of rest.bones) {
    pose.bone.position.copy(pose.position)
    pose.bone.quaternion.copy(pose.quaternion)
    pose.bone.scale.copy(pose.scale)
  }
}

const PROPORTIONS = ['height', 'armLength', 'headScale', 'neckHeight', 'shoulderWidth', 'torsoScaleX', 'legOffsetX']
function noop() {}

/** Puts every bone in its rest pose with the proportions applied, and records it. */
function restPose(rig, proportions) {
  const values = PROPORTIONS.map((k) => proportions[k] ?? 1)
  const [height, armLength, headScale, neckHeight, shoulderWidth, torsoScaleX, legOffsetX] = values
  const bones = []

  for (const bone of rig.skeleton.bones) {
    const rest = rig.bones[bone.name]
    if (!rest) continue

    const { origScale, origPos, origQuat } = rest
    bone.position.copy(origPos)
    bone.quaternion.copy(origQuat)
    bone.scale.copy(origScale)

    const name = bone.name

    if (name.startsWith('Arm')) {
      bone.scale.y = origScale.y * armLength
      // Not in the SDK preview: widen the shoulders by pushing the arm roots out.
      if (name === 'ArmL_Offset' || name === 'ArmR_Offset') {
        bone.position.x = origPos.x * shoulderWidth
      }
    } else if (name === NECK_OFFSET_BONE) {
      // Keeps the head sitting on the neck as height/headScale change, then applies
      // neckHeight against the bind-pose offset.
      bone.position.y += (height - headScale) * origPos.y
      bone.position.y += rig.neckOffsetBindY * (neckHeight - 1) * 0.8
    } else if (name === HAT_BONE) {
      // Divided by height so the head stays uniform inside the stretched root.
      bone.scale.set(
        origScale.x * headScale,
        origScale.y * (headScale / height),
        origScale.z * headScale,
      )
    } else if (name === BACK_BONE) {
      // Not in the SDK preview: torso width.
      bone.scale.x = origScale.x * torsoScaleX
    } else if (name === 'LegL_Offset' || name === 'LegR_Offset') {
      // Not in the SDK preview: leg splay, mirrored about the rig centre.
      bone.position.x = origPos.x * legOffsetX
    }
    bones.push({ bone, position: bone.position.clone(), quaternion: bone.quaternion.clone(), scale: bone.scale.clone() })
  }
  return { values, bones }
}

/* ---------------------------------------------------------------------------
 * Procedural animation
 *
 * player.glb ships zero animation clips, so a walk/run/jump cycle has to be
 * driven directly on the bones. Rotations are *multiplied onto* whatever
 * applyProportions() just wrote, so this must run immediately after it in the
 * same frame - proportions reset each bone to its rest pose, which is exactly
 * the clean base a pose needs. The rest pose has the arms hanging straight down.
 * ------------------------------------------------------------------------- */

const _animQ = new Quaternion()

/**
 * How far the chest leans in when crouched (radians). The caller lowers the
 * model by CROUCH_DROP (metres, at the game's 1.8 m scale) so the planted foot
 * and the kneeling knee meet the ground.
 */
export const CROUCH_LEAN = 0.4
export const CROUCH_DROP = 0.335

/**
 * Rotates a bone about one of its precomputed character-space axes.
 * `which` is 'axisX' (forward/back swing), 'axisZ' (lateral sway) or 'axisY' (twist).
 */
function rotateBone(rig, name, which, angle) {
  if (!angle) return
  const entry = rig.bones[name]
  const axis = entry?.[which]
  if (!axis) return
  entry.bone.quaternion.multiply(_animQ.setFromAxisAngle(axis, angle))
}

/**
 * Swing a bone forward/back - the plane a walk cycle actually moves in. Signs:
 * negative swings a hanging limb (arm, leg) forward; positive tips an upright
 * bone (spine, neck) forward, negative tips it back.
 */
const swing = (rig, name, angle) => rotateBone(rig, name, 'axisX', angle)
/** Sway a limb out to the side. */
const sway = (rig, name, angle) => rotateBone(rig, name, 'axisZ', angle)
/** Turn about the vertical axis (blading the torso, turning the head). */
const twist = (rig, name, angle) => rotateBone(rig, name, 'axisY', angle)

/**
 * Poses the rig for the current motion state.
 *
 * @param {object} rig from `collectRig`
 * @param {{ time: number, speed: number, grounded: boolean, maxSpeed: number,
 *           aim?: boolean, pitch?: number, crouch?: boolean, climbing?: boolean, climbPhase?: number,
 *           melee?: number, prone?: number, slide?: number, blade?: number,
 *           ik?: object|null }} motion
 *   `speed` is horizontal speed in world units/sec; `maxSpeed` is what counts as a
 *   full-amplitude run, so the cycle scales smoothly from a walk to a sprint.
 *   `aim` raises both arms (used only when no `ik` targets are given).
 *   `prone` / `slide` are 0..1 blends; `blade` turns the torso (radians) for a
 *   shooter's stance while the head keeps looking ahead.
 *   With `ik`, the arms are left alone here and solved onto the weapon afterwards.
 *   `climbPhase` is the climber's height in rungs, so the limbs move with the climb.
 */
export function animateRig(rig, motion) {
  if (!rig?.skeleton || !motion) return

  const {
    time = 0,
    speed = 0,
    grounded = true,
    maxSpeed = 6,
    aim = false,
    pitch = 0,
    crouch = false,
    climbing = false,
    climbPhase = time * 2.2,
    melee = 0,
    prone = 0,
    slide = 0,
    blade = 0,
    ik = null,
  } = motion
  const ratio = Math.min(speed / Math.max(maxSpeed, 0.001), 1)
  const armsFree = !ik
  // Time since the last pose, for the walk cycle below (0 on the first call or after a pause).
  const dt = rig.lastTime === undefined ? 0 : Math.min(0.1, Math.max(0, time - rig.lastTime))
  rig.lastTime = time

  rig.root.position.y = rig.rootRestY

  // Dev aid (AvatarPreview probe mode): apply raw rotations and nothing else.
  if (motion.probe) {
    for (const [bone, axis, angle] of motion.probe) rotateBone(rig, bone, axis, angle)
    return
  }

  if (climbing) {
    // Hand over hand, one cycle per two rungs: one arm reaches high for the next
    // rung while the other, bent, pulls; the opposite knee steps up a rung.
    const c = Math.sin(climbPhase * Math.PI)
    swing(rig, 'ArmL1', -2.6 + c * 0.45)
    swing(rig, 'ArmR1', -2.6 - c * 0.45)
    swing(rig, 'ArmL2', -0.25 - Math.max(0, c) * 0.6)
    swing(rig, 'ArmR2', -0.25 - Math.max(0, -c) * 0.6)
    swing(rig, 'LegL1', -0.45 - Math.max(0, c) * 0.65)
    swing(rig, 'LegR1', -0.45 - Math.max(0, -c) * 0.65)
    swing(rig, 'LegL2', 0.55 + Math.max(0, c) * 0.85)
    swing(rig, 'LegR2', 0.55 + Math.max(0, -c) * 0.85)
    // Chest in to the ladder, head tipped back to look up it.
    swing(rig, 'Spine1', 0.06)
    swing(rig, 'Neck1', -0.25)
    return
  }

  if (prone > 0.5) {
    // Lying on the belly (the caller tips the body over), propped up on the
    // elbows: chest raised, head up behind the gun, legs apart with the feet
    // turned out. Crawling scissors the legs and works the knees.
    const crawl = Math.sin(time * 6) * Math.min(1, ratio * 3)
    sway(rig, 'LegL1', -0.2 + crawl * 0.16)
    sway(rig, 'LegR1', 0.2 + crawl * 0.16)
    swing(rig, 'LegL2', 0.1 + Math.max(0, crawl) * 0.7)
    swing(rig, 'LegR2', 0.25 + Math.max(0, -crawl) * 0.7)
    // Body is face-down: tipping the spine "back" raises the chest off the ground,
    // tipping the neck back brings the face up to look along the ground.
    swing(rig, 'Spine1', -0.24)
    swing(rig, 'Neck1', -1.1 - pitch * 0.4)
    if (armsFree) {
      swing(rig, 'ArmL1', -2.6)
      swing(rig, 'ArmR1', -2.6)
    }
    return
  }

  if (slide > 0.05) {
    // Feet first, leaning back.
    swing(rig, 'LegL1', -1.45 * slide)
    swing(rig, 'LegR1', -1.1 * slide)
    swing(rig, 'LegR2', 1.2 * slide)
    swing(rig, 'Spine1', -0.32 * slide)
  }

  // --- Legs (and arms when free) -------------------------------------------------
  if (slide > 0.5) {
    // Held above.
  } else if (!grounded) {
    swing(rig, 'LegL1', -0.55)
    swing(rig, 'LegL2', 0.75)
    swing(rig, 'LegR1', 0.3)
    swing(rig, 'LegR2', 0.2)
    if (armsFree && !aim) {
      sway(rig, 'ArmL1', -0.5)
      sway(rig, 'ArmR1', 0.5)
    }
    swing(rig, 'Spine1', -0.1)
  } else if (crouch) {
    // Low ready: still, it's a kneel (left foot planted, right knee down);
    // moving, a bent-knee duck walk. Blended so starting to move flows.
    const k = Math.min(1, ratio * 4)
    const phase = time * 7
    const c = Math.sin(phase) * k
    swing(rig, 'LegL1', -1.45 + (1.45 - 1.05) * k + c * 0.35)
    swing(rig, 'LegL2', 1.45 + Math.max(0, -c) * 0.5)
    swing(rig, 'LegR1', -1.1 + (1.1 - 1.05) * k - c * 0.35)
    swing(rig, 'LegR2', 2.5 + (1.45 - 2.5) * k + Math.max(0, c) * 0.5)
    swing(rig, 'Spine1', CROUCH_LEAN)
    // Keep the eyes level while the chest leans in.
    swing(rig, 'Neck1', -CROUCH_LEAN * 0.85)
    rig.root.position.y = rig.rootRestY + Math.abs(Math.cos(phase)) * 0.06 * k
  } else if (ratio < 0.04) {
    const idle = Math.sin(time * 1.6)
    if (armsFree && !aim) {
      sway(rig, 'ArmL1', -0.07 - idle * 0.03)
      sway(rig, 'ArmR1', 0.07 + idle * 0.03)
    }
    swing(rig, 'Spine1', idle * 0.02)
    rig.root.position.y = rig.rootRestY + idle * 0.03
  } else {
    // Step frequency rises with speed so a sprint doesn't look like a moonwalk.
    // The phase is integrated, not time x frequency: with that, every small
    // change in speed (a real player's moves arrive with network jitter) threw
    // the legs to a different point of the cycle, minutes' worth of steps at once.
    rig.gaitPhase = ((rig.gaitPhase ?? 0) + dt * (5 + ratio * 5)) % (Math.PI * 2)
    const phase = rig.gaitPhase
    const cycle = Math.sin(phase)
    const legAmp = (crouch ? 0.5 : 0.85) * ratio
    const armAmp = 0.7 * ratio

    // Legs swing in opposition; knees fold on the backswing only.
    swing(rig, 'LegL1', cycle * legAmp)
    swing(rig, 'LegR1', -cycle * legAmp)
    swing(rig, 'LegL2', Math.max(0, -cycle) * 1.1 * ratio)
    swing(rig, 'LegR2', Math.max(0, cycle) * 1.1 * ratio)

    if (armsFree && !aim) {
      swing(rig, 'ArmL1', -cycle * armAmp)
      swing(rig, 'ArmR1', cycle * armAmp)
      swing(rig, 'ArmL2', -Math.max(0, cycle) * 0.5 * ratio)
      swing(rig, 'ArmR2', -Math.max(0, -cycle) * 0.5 * ratio)
    }

    // Lean into the run, and bob once per step (twice per full cycle).
    swing(rig, 'Spine1', 0.14 * ratio)
    rig.root.position.y = rig.rootRestY + Math.abs(Math.cos(phase)) * 0.18 * ratio
  }

  // --- Upper body ---------------------------------------------------------------
  // Shooter's stance: torso bladed, head turned back to face the target.
  if (blade) {
    twist(rig, 'Spine1', blade)
    twist(rig, 'Neck1', -blade * 0.85)
  }
  if (armsFree) {
    if (aim) {
      swing(rig, 'ArmL1', -1.5 - pitch * 0.9)
      swing(rig, 'ArmR1', -1.38 - pitch * 0.9 - melee * 0.9)
    } else if (melee > 0) {
      swing(rig, 'ArmR1', -0.5 - Math.sin(melee * Math.PI) * 1.6)
    }
  }

  // Look up/down: mostly the head, a little through the chest.
  swing(rig, 'Spine2', -pitch * 0.25)
  swing(rig, 'Neck1', -pitch * 0.6)
}

/* ---------------------------------------------------------------------------
 * Two-bone arm IK: puts a hand on a world-space target
 * ------------------------------------------------------------------------- */

const _s = new Vector3()
const _e = new Vector3()
const _w = new Vector3()
const _t = new Vector3()
const _p = new Vector3()
const _u = new Vector3()
const _v = new Vector3()
const _elbow = new Vector3()
const _hand = new Vector3()
const _qa = new Quaternion()
const _qb = new Quaternion()
const _qp = new Quaternion()
const _at = new Vector3()
const _size = new Vector3()

/**
 * Rotates `bone` (in world terms) so the point `from` on it swings onto the
 * line toward `to`. World matrices must be current (see solveArms); this keeps
 * them so for the bone and everything below it.
 */
function aimBone(bone, from, to) {
  _s.setFromMatrixPosition(bone.matrixWorld)
  _u.copy(from).sub(_s)
  _v.copy(to).sub(_s)
  if (_u.lengthSq() < 1e-10 || _v.lengthSq() < 1e-10) return
  _qa.setFromUnitVectors(_u.normalize(), _v.normalize())
  bone.matrixWorld.decompose(_at, _qb, _size)
  _qb.premultiply(_qa)
  bone.parent.matrixWorld.decompose(_at, _qp, _size)
  bone.quaternion.copy(_qp.invert().multiply(_qb))
  bone.updateMatrixWorld(true)
}

/**
 * Bends one arm so its hand reaches `target` (world space), elbow toward `pole`.
 * Out-of-reach targets get a straight arm pointing at them.
 *
 * @param {'L'|'R'} side
 */
export function solveArm(rig, side, target, pole) {
  const upper = rig.bones[`Arm${side}1`]?.bone
  const lower = rig.bones[`Arm${side}2`]?.bone
  const end = rig.bones[`Arm${side}2_leaf`]?.bone
  if (!upper || !lower || !end || !target) return

  _s.setFromMatrixPosition(upper.matrixWorld)
  _e.setFromMatrixPosition(lower.matrixWorld)
  _w.setFromMatrixPosition(end.matrixWorld)
  const shoulder = _t.copy(_s)
  const l1 = shoulder.distanceTo(_e)
  const l2 = _e.distanceTo(_w)
  if (l1 < 1e-5 || l2 < 1e-5) return

  const toTarget = _hand.copy(target).sub(shoulder)
  const raw = toTarget.length()
  if (raw < 1e-5) return
  const dir = toTarget.divideScalar(raw)
  const d = Math.min(Math.max(raw, Math.abs(l1 - l2) + 1e-3), (l1 + l2) * 0.999)

  // Bend plane: toward the pole, perpendicular to the shoulder->hand line.
  _p.copy(pole ?? _p.set(0, -1, 0).add(shoulder)).sub(shoulder)
  _p.addScaledVector(dir, -_p.dot(dir))
  if (_p.lengthSq() < 1e-8) _p.set(0, -1, 0).addScaledVector(dir, -dir.y)
  _p.normalize()

  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a))
  _elbow.copy(shoulder).addScaledVector(dir, a).addScaledVector(_p, h)
  const handPos = _v.copy(shoulder).addScaledVector(dir, d)
  const handTarget = _w.copy(handPos)

  aimBone(upper, _e, _elbow)
  _e.setFromMatrixPosition(lower.matrixWorld)
  _u.setFromMatrixPosition(end.matrixWorld)
  const tip = _p.copy(_u)
  aimBone(lower, tip, handTarget)
}

/**
 * Solves both arms onto the targets in `ik` ({ right, left, poleR, poleL }, all
 * world-space Vector3s; any may be null). Call after `animateRig`.
 */
export function solveArms(rig, ik) {
  if (!rig?.skeleton || !ik) return
  // The solver reads matrixWorld directly: bring each arm (and the chain it
  // hangs from) up to date, not the whole body; the render does the rest.
  if (ik.right) {
    rig.bones.ArmR1?.bone.updateWorldMatrix(true, true)
    solveArm(rig, 'R', ik.right, ik.poleR)
  }
  if (ik.left) {
    rig.bones.ArmL1?.bone.updateWorldMatrix(true, true)
    solveArm(rig, 'L', ik.left, ik.poleL)
  }
}
