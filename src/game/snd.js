import { SND } from '../shared/constants.js'
import { activeMap, useGameStore } from '../store/gameStore.js'
import { runtime } from './runtime.js'

/**
 * Search & Destroy helpers for the client: the map's bomb sites, what the
 * local player can do with Use, and who the dead are watching. The rules
 * themselves are the server's (rust-server/src/game/searchDestroy.js); this
 * only mirrors enough of them to show prompts and lock movement in time.
 */

/** The map's bomb sites: [{ id, p }]. */
export const sitesOf = (map = activeMap()) => map.snd?.sites ?? []

/** The site whose plant zone holds a feet position, or null (as the server decides it). */
export function siteAt(x, y, z, map = activeMap()) {
  return sitesOf(map).find((s) => Math.hypot(x - s.p[0], z - s.p[2]) <= SND.siteRadius && Math.abs(y - s.p[1]) < 1.8) ?? null
}

/** What holding Use would do for the local player right now: 'plant' | 'defuse' | ''. */
export function actionHint() {
  const s = runtime.snd
  const l = runtime.local
  const { mode, myId, team } = useGameStore.getState()
  if (mode !== 'snd' || !l.alive) return ''
  if (s.phase === 'live' && s.bombState === 'carried' && s.carrier === myId && siteAt(l.feet.x, l.feet.y, l.feet.z)) return 'plant'
  if (s.phase === 'planted' && team && team !== s.attackers && Math.hypot(l.feet.x - s.x, l.feet.y - s.y, l.feet.z - s.z) <= SND.defuseRange) {
    return 'defuse'
  }
  return ''
}

/** Movement is locked: the round's freeze. */
export const frozen = () => useGameStore.getState().mode === 'snd' && runtime.snd.phase === 'freeze'

/** Living teammates to watch, in a stable order. */
export function spectateCandidates() {
  const { team } = useGameStore.getState()
  return [...runtime.remotes.values()].filter((r) => r.state === 'alive' && r.team === team).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
}

/** Watch the next (or previous) living teammate; keeps the current one when it's still alive and `step` is 0. */
export function cycleSpectate(step = 1) {
  const list = spectateCandidates()
  if (!list.length) {
    runtime.spectateId = ''
    useGameStore.setState({ spectateId: '' })
    return
  }
  const i = list.findIndex((r) => r.id === runtime.spectateId)
  let next
  if (i < 0) next = list[0]
  else if (step === 0) next = list[i]
  else next = list[(i + step + list.length) % list.length]
  runtime.spectateId = next.id
  if (useGameStore.getState().spectateId !== next.id) useGameStore.setState({ spectateId: next.id })
}
