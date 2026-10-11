import { createContext, useContext } from 'react'

export const BloxityContext = createContext(null)

/**
 * Access the Bloxity session: `user` (the portal's signed-in account) or `guest`,
 * `isLoggedIn`, `identity` (whichever of the two), `avatar` (equipped IDs),
 * `proportions`, and the `game` loading helpers. There is no login or logout:
 * the player arrives signed in from the portal, or as a guest.
 *
 * Must be called inside a `<BloxityProvider>`.
 */
export function useBloxity() {
  const ctx = useContext(BloxityContext)
  if (!ctx) throw new Error('useBloxity() must be used inside <BloxityProvider>')
  return ctx
}
