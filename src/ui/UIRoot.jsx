import { useEffect } from 'react'

import { sfx } from '../audio/sfx.js'
import { IS_TOUCH, isLocked, releaseLock, requestLock } from '../game/player/input.js'
import { useGameStore } from '../store/gameStore.js'
import { ClassEditorScreen } from './ClassEditor.jsx'
import HUD from './HUD.jsx'
import { Connecting, DeploySelect, TeamSelect } from './Lobby.jsx'
import { LoadingScreen, MainMenu, SettingsScreen } from './Menus.jsx'
import { ModeSelect } from './PlayScreen.jsx'
import { ClassPicker, DeathScreen, MatchEnd, PauseMenu, SettingsOverlay } from './Overlays.jsx'
import TouchControls from './TouchControls.jsx'
import { useViewport } from './uiScale.js'

const inMatch = (s) => s.gameState === 'playing' || s.gameState === 'dead'

/**
 * Keyboard shortcuts that belong to the UI rather than the character:
 * Tab (scoreboard), B (class picker), Esc (menus), plus pointer-lock bookkeeping.
 */
function useGlobalKeys() {
  useEffect(() => {
    const onKeyDown = (e) => {
      const s = useGameStore.getState()
      if (e.target instanceof HTMLInputElement) return
      if (e.code === 'Tab' && (inMatch(s) || s.gameState === 'ended')) {
        e.preventDefault()
        if (!s.scoreboardOpen) useGameStore.setState({ scoreboardOpen: true })
      }
      if (e.code === 'KeyB' && inMatch(s) && !e.repeat) {
        if (s.overlay === 'classPicker') {
          useGameStore.setState({ overlay: null })
          requestLock()
        } else {
          useGameStore.setState({ overlay: 'classPicker' })
          releaseLock()
        }
      }
      if (e.code === 'Escape' && s.overlay && inMatch(s) && !isLocked()) {
        if (s.overlay === 'settings') useGameStore.setState({ overlay: 'pause' })
        else {
          useGameStore.setState({ overlay: null })
          requestLock()
        }
      }
    }
    const onKeyUp = (e) => {
      if (e.code === 'Tab') useGameStore.setState({ scoreboardOpen: false })
    }
    const onLockChange = () => {
      const locked = isLocked()
      const s = useGameStore.getState()
      useGameStore.setState({ pointerLocked: locked })
      // Losing the lock mid-match (Esc) opens the menu; the match keeps running.
      if (!locked && !s.overlay && inMatch(s)) useGameStore.setState({ overlay: 'pause' })
      if (locked && s.overlay) useGameStore.setState({ overlay: null })
    }
    // Mid-match, Ctrl (prone) + W would close the tab: ask first instead.
    const onBeforeUnload = (e) => {
      if (!inMatch(useGameStore.getState())) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    // Browsers keep audio suspended until the first gesture.
    const unlock = () => sfx.unlockAudio()
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('pointerdown', unlock)
    // Pointer lock, or on touch the player tapping in / pausing (input.js).
    window.addEventListener('dl:lockchange', onLockChange)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('dl:lockchange', onLockChange)
    }
  }, [])
}

/** Phones held upright: the game is played sideways. */
function RotatePrompt() {
  return (
    <div className="dl-rotate">
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect x="20" y="8" width="24" height="44" rx="4" />
        <path d="M10 40a24 24 0 0 0 20 16M54 24A24 24 0 0 0 34 8" />
        <path d="M30 56l-4-3 3-4M34 8l4 3-3 4" />
      </svg>
      <div className="dl-h">Turn your phone sideways</div>
      <div className="dl-muted">Modern Guns is played in landscape.</div>
    </div>
  )
}

export function UIRoot() {
  const gameState = useGameStore((s) => s.gameState)
  const menuScreen = useGameStore((s) => s.menuScreen)
  const lobbyStep = useGameStore((s) => s.lobbyStep)
  const overlay = useGameStore((s) => s.overlay)
  const editorFromLoading = useGameStore((s) => s.editorFromLoading)
  const locked = useGameStore((s) => s.pointerLocked)
  const { scale, portrait } = useViewport()
  const volume = useGameStore((s) => s.settings.volume)
  const musicVolume = useGameStore((s) => s.settings.musicVolume)
  useGlobalKeys()

  useEffect(() => {
    sfx.setVolume(volume)
  }, [volume])
  useEffect(() => {
    sfx.setMusicVolume(musicVolume ?? 0.3)
  }, [musicVolume])
  // Score at full level in the menus, tucked under the action in a match (where
  // distant artillery and gunfire take over).
  useEffect(() => {
    sfx.setMusicMode(gameState === 'playing' || gameState === 'dead' ? 'match' : 'menu')
  }, [gameState])

  // Smaller screens get the same layout scaled down (ui/uiScale.js): laid out
  // at 1/scale the size, then shrunk to fit.
  const fit = scale < 1 ? { width: `${100 / scale}%`, height: `${100 / scale}%`, transform: `scale(${scale})` } : undefined
  const touchPlay = IS_TOUCH && gameState === 'playing' && locked && !overlay
  return (
    <>
    <div className={`dl-root ${IS_TOUCH ? 'dl-touch' : ''}`} style={fit}>
      {gameState === 'loading' && <LoadingScreen />}
      {gameState === 'loading' && editorFromLoading && <ClassEditorScreen />}

      {gameState === 'menu' && menuScreen === 'main' && <MainMenu />}
      {gameState === 'menu' && menuScreen === 'mode' && <ModeSelect />}
      {gameState === 'menu' && menuScreen === 'classes' && <ClassEditorScreen />}
      {gameState === 'menu' && menuScreen === 'settings' && <SettingsScreen />}

      {gameState === 'lobby' && lobbyStep === 'connecting' && <Connecting />}
      {gameState === 'lobby' && lobbyStep === 'team' && <TeamSelect />}
      {gameState === 'lobby' && lobbyStep === 'deploy' && <DeploySelect />}

      {(gameState === 'playing' || gameState === 'dead') && <HUD />}
      {gameState === 'dead' && !overlay && <DeathScreen />}
      {gameState === 'ended' && <MatchEnd />}

      {overlay === 'pause' && <PauseMenu />}
      {overlay === 'classPicker' && <ClassPicker />}
      {overlay === 'settings' && <SettingsOverlay />}
    </div>
    {touchPlay && <TouchControls scale={scale} />}
    {IS_TOUCH && portrait && <RotatePrompt />}
    </>
  )
}

export default UIRoot
