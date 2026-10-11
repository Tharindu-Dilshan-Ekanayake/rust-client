import { Client } from '@colyseus/sdk'

import { waitForSDK } from '../bloxity/sdk.js'

/**
 * Where the game server is.
 *
 * Hosted builds (CI builds with VITE_USE_MATCHMAKER=1; any *.play.bloxity.io page
 * too) join through the Bloxity Legion matchmaker at play.bloxity.io: it picks a
 * pod with a free seat, or starts one. Local dev and LAN play talk straight to
 * one server (VITE_SERVER_URL, else this host on :3000).
 */

/** The game's id on Bloxity (My Games). */
export const GAME_ID = import.meta.env.VITE_LEGION_GAME_ID || 'modern-guns'

const host = window.location.hostname

export const USE_MATCHMAKER =
  !import.meta.env.VITE_SERVER_URL && (import.meta.env.VITE_USE_MATCHMAKER === '1' || host.endsWith('.play.bloxity.io'))

export const DIRECT_URL = import.meta.env.VITE_SERVER_URL || `${window.location.protocol}//${host}:3000`

/**
 * A page on <gameId>.dev.play.bloxity.io reaches the dev backend by itself; any
 * other domain reaches prod unless built with VITE_LEGION_VERSION=preview.
 */
const RESOLVE_OPTIONS = import.meta.env.VITE_LEGION_VERSION ? { version: import.meta.env.VITE_LEGION_VERSION } : {}

/** A cold start can take ~45 s; past a minute something is really wrong. */
const GIVE_UP_MS = 60000

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Runs `open(client)` (a joinOrCreate / create / joinById) against a game server
 * and returns its room.
 *
 * Through the matchmaker every attempt resolves a fresh endpoint and builds a NEW
 * Client from it (an endpoint is pinned to one pod, so one from an earlier
 * resolve may point at a pod that is full or gone). A failed resolve or join is
 * retried with backoff until GIVE_UP_MS, unless `fatal(err)` says another try
 * can't help (a wrong room key, say). `onWait(reason)` reports 'cold' (a server
 * is booting for us) and 'retry' so the UI can say what's happening.
 */
export async function openRoom(open, { onWait, fatal = () => false } = {}) {
  if (!USE_MATCHMAKER) return open(new Client(DIRECT_URL))

  const sdk = await waitForSDK()
  const started = Date.now()
  let delay = 800
  for (let attempt = 1; ; attempt++) {
    try {
      const { endpoint, cold } = await sdk.net.resolveEndpoint(GAME_ID, RESOLVE_OPTIONS)
      if (cold) onWait?.('cold')
      return await open(new Client(endpoint))
    } catch (err) {
      if (fatal(err) || Date.now() - started + delay > GIVE_UP_MS) throw err
      console.warn(`[net] join attempt ${attempt} failed, trying again in ${Math.round(delay)} ms:`, err?.message ?? err)
      onWait?.('retry')
      await sleep(delay)
      delay = Math.min(delay * 1.8, 6000)
    }
  }
}
