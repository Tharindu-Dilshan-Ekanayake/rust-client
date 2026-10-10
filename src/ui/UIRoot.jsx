import { useEffect } from 'react'

import { sfx } from '../audio/sfx.js'
import { releaseLock, requestLock } from '../game/player/input.js'
import { useGameStore } from '../store/gameStore.js'
import { ClassEditorScreen } from './ClassEditor.jsx'
import HUD from './HUD.jsx'
import { Connecting, DeploySelect, TeamSelect } from './Lobby.jsx'
import { LoadingScreen, MainMenu, SettingsScreen } from './Menus.jsx'
import { ModeSelect } from './PlayScreen.jsx'
import { ClassPicker, DeathScreen, MatchEnd, PauseMenu, SettingsOverlay } from './Overlays.jsx'

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
      if (e.code === 'Escape' && s.overlay && inMatch(s) && !document.pointerLockElement) {
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
      const locked = Boolean(document.pointerLockElement)
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
    document.addEventListener('pointerlockchange', onLockChange)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('pointerlockchange', onLockChange)
    }
  }, [])
}

export function UIRoot() {
  const gameState = useGameStore((s) => s.gameState)
  const menuScreen = useGameStore((s) => s.menuScreen)
  const lobbyStep = useGameStore((s) => s.lobbyStep)
  const overlay = useGameStore((s) => s.overlay)
  const editorFromLoading = useGameStore((s) => s.editorFromLoading)
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

  return (
    <div className="dl-root">
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
  )
}

export default UIRoot
