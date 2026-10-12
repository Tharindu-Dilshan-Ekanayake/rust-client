import { getSDK } from '../bloxity/sdk.js'
import { IS_TOUCH } from '../game/player/input.js'

/**
 * On a phone: full screen and landscape, from a tap (browsers only allow it
 * from a user gesture). Inside the Bloxity portal the portal goes full screen
 * itself; on its own the page does, and asks to stay sideways. Every step can
 * be refused; the game carries on regardless.
 */
export function goFullscreen() {
  if (!IS_TOUCH) return
  try {
    const sdk = getSDK()
    if (sdk?.portal?.isEmbeddedInLegion?.()) {
      sdk.portal.requestFullscreen?.()
      return
    }
  } catch {
    // Not embedded, or the SDK isn't there: do it ourselves.
  }
  const lock = () => window.screen?.orientation?.lock?.('landscape').catch(() => {})
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen({ navigationUI: 'hide' }).then(lock, () => {})
    } else {
      lock()
    }
  } catch {
    // No fullscreen here (iOS Safari on iPhone): the rotate prompt still helps.
  }
}
