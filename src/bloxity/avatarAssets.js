/**
 * URL construction and slot metadata for Bloxity avatar assets.
 *
 * The shapes here are not guesses: they mirror the assembly logic inside
 * legion-sdk.min.js (the same code that renders the avatar preview in the Bloxity
 * portal), so an avatar built with this file matches what the player sees there.
 *
 * `avatar.getEquipped()` returns:
 *   { hatId, backId, skinId, headId, armLId, armRId, legLId, legRId, torsoId,
 *     hairId, maskId, neckId, chestId, waistId, handId, shoesId, faceId, pantsId, shirtId }
 */

export const AVATAR_CDN = 'https://static.bloxity.io/avatars'
export const BLOXITY_API = 'https://api.bloxity.io'

/** The base humanoid body + skeleton. All other assets modify this. */
export const BASE_BODY_URL = `${AVATAR_CDN}/player.glb`

/** Bone that hats attach to, from player.glb's skeleton. */
export const HAT_BONE = 'Neck1'
/** Bone that back items attach to. */
export const BACK_BONE = 'Spine2'
/** Bone whose bind-pose Y drives the neckHeight proportion. */
export const NECK_OFFSET_BONE = 'Neck_Offset'

/** Skin id used when nothing is equipped — the base body has no baked-in texture. */
export const DEFAULT_SKIN_ID = '0'

/**
 * Body-part slots.
 *
 * Each maps an equipped id onto a named skinned mesh already present in player.glb.
 * A part is applied by swapping that mesh's *geometry*, not by attaching a new
 * object — that is what keeps it bound to the shared skeleton.
 */
export const PART_SLOTS = {
  head: { idKey: 'headId', mesh: 'default_head', dir: 'head', suffix: '' },
  arm_L: { idKey: 'armLId', mesh: 'default_arm_L', dir: 'arms', suffix: '_L' },
  arm_R: { idKey: 'armRId', mesh: 'default_arm_R', dir: 'arms', suffix: '_R' },
  leg_L: { idKey: 'legLId', mesh: 'default_leg_L', dir: 'legs', suffix: '_L' },
  leg_R: { idKey: 'legRId', mesh: 'default_leg_R', dir: 'legs', suffix: '_R' },
  torso: { idKey: 'torsoId', mesh: 'default_torso', dir: 'torso', suffix: '' },
}

/** Values that all mean "nothing equipped". Superset of the SDK's own check. */
const EMPTY_IDS = new Set(['-1', '', 'undefined', 'null'])

/**
 * @param {unknown} id
 * @returns {boolean} true when the id names a real asset worth fetching
 */
export function isRealId(id) {
  if (id === null || id === undefined) return false
  return !EMPTY_IDS.has(String(id).trim())
}

export const assetUrls = {
  part: (slot, id) => {
    const { dir, suffix } = PART_SLOTS[slot]
    return `${AVATAR_CDN}/parts/${dir}/${id}${suffix}.glb`
  },
  skinTexture: (id) => `${AVATAR_CDN}/skins/${id}.png`,
  hatMesh: (id) => `${AVATAR_CDN}/items/hats/${id}.obj`,
  hatTexture: (id) => `${AVATAR_CDN}/textures/hats/${id}.png`,
  backMesh: (id) => `${AVATAR_CDN}/items/back/${id}.obj`,
  backTexture: (id) => `${AVATAR_CDN}/textures/back/${id}.png`,
  /** Hand accessories (gloves, watches...): authored on the left hand, mirrored for the right. */
  handMesh: (id) => `${AVATAR_CDN}/items/hand/${id}.obj`,
  handTexture: (id) => `${AVATAR_CDN}/textures/hand/${id}.png`,
}

/** Clothing the API draws onto the skin texture, in the order the SDK puts it in the URL. */
const CLOTHING = [
  ['pantsId', 'pn'],
  ['shirtId', 'sh'],
  ['faceId', 'fc'],
]
const worn = (id) => isRealId(id) && String(id).trim() !== '0'

/**
 * The body texture for an equipped set, the way the SDK's getSkinTextureUrl()
 * builds it: the skin with the worn pants, shirt and face already drawn on
 * (`/v1/avatar/skin-texture/s{skin}_pn{..}_sh{..}_fc{..}.png`), or the plain
 * skin when none of those is worn. Works for anyone's equipped set, not just ours.
 */
export function skinTextureUrl(equipped) {
  const skin = worn(equipped?.skinId) ? String(equipped.skinId).trim() : DEFAULT_SKIN_ID
  const clothes = CLOTHING.filter(([key]) => worn(equipped?.[key]))
  if (!clothes.length) return assetUrls.skinTexture(skin)
  return `${BLOXITY_API}/v1/avatar/skin-texture/s${skin}${clothes.map(([key, tag]) => `_${tag}${String(equipped[key]).trim()}`).join('')}.png`
}

/** Skin ids fall back to "0" rather than being skipped. */
export const skinIdOrDefault = (id) => (isRealId(id) ? String(id) : DEFAULT_SKIN_ID)
