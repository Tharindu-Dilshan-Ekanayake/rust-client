import { useProgress } from '@react-three/drei'
import { useEffect, useState } from 'react'

import { useBloxity } from '../bloxity/BloxityContext'
import { MAX_PLAYERS } from '../shared/constants.js'
import { MAP_NAME } from '../shared/map.js'
import { useGameStore } from '../store/gameStore.js'
import { Button } from './common.jsx'
import { RankCard } from './Progression.jsx'

const TIPS = [
  ['Cook grenades', ' by holding G — release to throw. Hold too long and it goes off in your hand.'],
  ['Smoke blocks bot vision.', ' Pop one to cross the pipeline gap.'],
  ['Hold Shift', ' while scoped with the Longhaul to steady your breath.'],
  ['The tower ladder', ' is the only way up — and you can’t shoot while climbing.'],
  ['The container stacks have ladders.', ' Walk off the top onto one to slide back down.'],
  ['Press V', ' to quick-melee with any weapon. Close the gap and it lunges.'],
  ['Change class with B', ' any time — it applies on your next spawn.'],
  ['Sprint and tap C', ' to slide into cover. Jump out of a slide to keep the speed.'],
  ['Hold C or press Ctrl', ' to go prone — steadier aim, smaller target.'],
  ['Dead players drop ammo.', ' Walk over the green boxes to resupply.'],
  ['The control shack', ' has an ammo crate that refills everything.'],
  ['Flashbangs', ' hit hardest if you’re looking at them. Turn away!'],
  ['The torn end of the pipe', ' is a ramp — run along the top to reach the shack roof.'],
]

function Logo({ small = false }) {
  return (
    <div className="dl-logo" style={small ? { transform: 'scale(0.6)', transformOrigin: 'left bottom' } : undefined}>
      <div className="big">
        DUST<span>LINE</span>
      </div>
      <div className="sub">{MAP_NAME.toUpperCase()}</div>
    </div>
  )
}

export function LoadingScreen() {
  const { progress, active } = useProgress()
  const loaded = useGameStore((s) => s.loaded)
  const { game } = useBloxity()
  const [tip, setTip] = useState(() => Math.floor(Math.random() * TIPS.length))
  const [minDone, setMinDone] = useState(false)
  const [shown, setShown] = useState(5)

  useEffect(() => {
    game.loadingStep('Loading Dustline Pumpstation…')
    const a = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 3800)
    const b = setTimeout(() => setMinDone(true), 1800)
    return () => {
      clearInterval(a)
      clearTimeout(b)
    }
  }, [game])

  // Real asset progress when the loader is busy, otherwise a smooth creep so the
  // bar never sits still.
  useEffect(() => {
    const id = setInterval(() => {
      setShown((s) => {
        const target = loaded ? 100 : active ? Math.max(progress * 0.9, s) : Math.min(90, s + 4)
        return s + (target - s) * 0.35
      })
    }, 80)
    return () => clearInterval(id)
  }, [loaded, active, progress])

  useEffect(() => {
    if (!loaded || !minDone) return
    game.loadingEnd()
    const s = useGameStore.getState()
    useGameStore.setState({
      gameState: 'menu',
      menuScreen: s.editorFromLoading ? 'classes' : 'main',
      editorFromLoading: false,
    })
  }, [loaded, minDone, game])

  const editing = useGameStore((s) => s.editorFromLoading)
  if (editing) return null

  const [b, rest] = TIPS[tip]
  return (
    <div className="dl-screen dl-loading">
      <Logo />
      <div className="dl-progress">
        <div style={{ width: `${Math.round(shown)}%` }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20 }}>
        <div className="dl-tip" key={tip}>
          <b>{b}</b>
          {rest}
        </div>
        <Button className="small" onClick={() => useGameStore.setState({ editorFromLoading: true })}>
          Edit Classes
        </Button>
      </div>
      <div className="dl-label" style={{ marginTop: 8 }}>
        Loading {Math.round(shown)}%
      </div>
    </div>
  )
}

function AccountChip() {
  const { identity, isLoggedIn, login, logout, status } = useBloxity()
  const name = identity?.displayName || identity?.username || 'Guest'
  return (
    <div className="dl-panel dl-account dl-interactive">
      {identity?.pfp ? <img src={identity.pfp} alt="" /> : <div className="initial">{name.charAt(0).toUpperCase()}</div>}
      <div style={{ lineHeight: 1.15 }}>
        <div className="dl-h" style={{ fontSize: 16 }}>
          {name}
        </div>
        <div className="dl-muted" style={{ fontSize: 11 }}>
          {isLoggedIn ? 'Signed in with Bloxity' : 'Playing as guest'}
        </div>
      </div>
      {isLoggedIn ? (
        <Button className="small ghost" onClick={logout}>
          Log out
        </Button>
      ) : (
        <Button className="small primary" onClick={login} disabled={status !== 'ready'}>
          {status === 'ready' ? 'Log in' : '…'}
        </Button>
      )}
    </div>
  )
}

export function MainMenu() {
  const playerName = useGameStore((s) => s.playerName)
  const setPlayerName = useGameStore((s) => s.setPlayerName)
  const setMenuScreen = useGameStore((s) => s.setMenuScreen)
  const connection = useGameStore((s) => s.connection)
  const { identity } = useBloxity()
  const placeholder = identity?.displayName || identity?.username || 'ENTER NAME'

  return (
    <div className="dl-screen dim">
      <AccountChip />
      <RankCard />
      <div className="dl-menu dl-slide-in">
        <Logo small />
        <div>
          <div className="dl-label" style={{ marginBottom: 6 }}>
            Callsign
          </div>
          <input
            className="dl-input"
            value={playerName}
            maxLength={16}
            placeholder={placeholder}
            onChange={(e) => setPlayerName(e.target.value)}
          />
        </div>
        <div className="dl-menu-buttons">
          <Button className="primary" onClick={() => setMenuScreen('mode')}>
            Play <small>TDM · FFA · up to {MAX_PLAYERS} players</small>
          </Button>
          <Button onClick={() => setMenuScreen('classes')}>
            Classes <small>Create-a-class</small>
          </Button>
          <Button onClick={() => setMenuScreen('settings')}>
            Settings <small>Mouse · FOV · audio</small>
          </Button>
        </div>
        {connection.status === 'error' && (
          <div className="dl-tooltip" style={{ textTransform: 'none', letterSpacing: 0.5 }}>
            {connection.error}
          </div>
        )}
      </div>
      <div className="dl-panel dl-mapcard dl-slide-up">
        <div className="dl-label">Map</div>
        <div className="dl-h" style={{ fontSize: 24 }}>
          {MAP_NAME}
        </div>
        <div className="dl-muted" style={{ fontSize: 12, marginTop: 4 }}>
          Abandoned desert pumping station · sunset · 45 × 45 m
        </div>
      </div>
    </div>
  )
}

const KEYS = [
  ['W A S D', 'Move'],
  ['Mouse', 'Look'],
  ['Left click', 'Fire'],
  ['Right click', 'Aim down sights'],
  ['Space', 'Jump'],
  ['Shift', 'Sprint / hold breath (scoped)'],
  ['C', 'Crouch (tap) · prone (hold)'],
  ['Ctrl', 'Prone'],
  ['Shift + C', 'Slide (while sprinting)'],
  ['R', 'Reload'],
  ['1 / 2 / 3', 'Primary / secondary / knife'],
  ['V', 'Quick melee'],
  ['G (hold)', 'Cook + throw frag'],
  ['Q', 'Tactical (flash / smoke)'],
  ['B', 'Change class'],
  ['Tab', 'Scoreboard'],
  ['Esc', 'Menu'],
]

export function SettingsPanel({ onBack }) {
  const settings = useGameStore((s) => s.settings)
  const setSettings = useGameStore((s) => s.setSettings)
  const slider = (key, label, min, max, step, fmt = (v) => v.toFixed(2)) => (
    <div className="dl-settings-row" key={key}>
      <span className="dl-label" style={{ color: 'var(--text)' }}>
        {label}
      </span>
      <input type="range" min={min} max={max} step={step} value={settings[key]} onChange={(e) => setSettings({ [key]: Number(e.target.value) })} />
      <span className="v">{fmt(settings[key])}</span>
    </div>
  )
  const toggle = (key, label) => (
    <div className="dl-settings-row" key={key}>
      <span className="dl-label" style={{ color: 'var(--text)' }}>
        {label}
      </span>
      <input type="checkbox" checked={Boolean(settings[key])} onChange={(e) => setSettings({ [key]: e.target.checked })} />
      <span />
    </div>
  )
  const choice = (key, label, options) => (
    <div className="dl-settings-row" key={key}>
      <span className="dl-label" style={{ color: 'var(--text)' }}>
        {label}
      </span>
      <div className="dl-seg">
        {options.map(([value, text]) => (
          <button key={value} type="button" className={settings[key] === value ? 'on' : ''} onClick={() => setSettings({ [key]: value })}>
            {text}
          </button>
        ))}
      </div>
      <span />
    </div>
  )
  return (
    <div className="dl-frame">
      <div className="dl-frame-head">
        <div>
          <div className="dl-label">Options</div>
          <h1 className="dl-h">Settings</h1>
        </div>
        <Button className="small" onClick={onBack}>
          Back
        </Button>
      </div>
      <div className="dl-cols" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="dl-panel dl-detail">
          <div className="dl-label">Controls</div>
          {slider('sensitivity', 'Mouse sensitivity', 0.2, 3, 0.05)}
          {slider('adsSensitivity', 'ADS sensitivity', 0.3, 1.5, 0.05)}
          {toggle('invertY', 'Invert Y')}
          <div className="dl-label" style={{ marginTop: 10 }}>
            Video
          </div>
          {slider('fov', 'Field of view', 65, 100, 1, (v) => `${v}°`)}
          {choice('quality', 'Graphics quality', [
            ['low', 'Low'],
            ['medium', 'Med'],
            ['high', 'High'],
          ])}
          {toggle('adaptive', 'Auto resolution')}
          {toggle('minimap', 'Minimap')}
          {toggle('showFps', 'Show FPS')}
          <div className="dl-label" style={{ marginTop: 10 }}>
            Audio
          </div>
          {slider('volume', 'Master volume', 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`)}
          {slider('musicVolume', 'Music volume', 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`)}
        </div>
        <div className="dl-panel dl-detail">
          <div className="dl-label">Key bindings</div>
          <div className="dl-keys">
            {KEYS.map(([k, v]) => (
              <span key={k} style={{ display: 'contents' }}>
                <kbd>{k}</kbd>
                <span>{v}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function SettingsScreen() {
  const setMenuScreen = useGameStore((s) => s.setMenuScreen)
  return (
    <div className="dl-screen dark">
      <SettingsPanel onBack={() => setMenuScreen('main')} />
    </div>
  )
}
