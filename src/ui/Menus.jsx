import { useProgress } from '@react-three/drei'
import { useEffect, useState } from 'react'

import { useBloxity } from '../bloxity/BloxityContext'
import { MAX_PLAYERS } from '../shared/constants.js'
import { useActiveMap, useGameStore } from '../store/gameStore.js'
import { Button } from './common.jsx'
import { MapPicker } from './MapPicker.jsx'
import { goFullscreen } from './mobile.js'
import { IS_TOUCH } from '../game/player/input.js'
import { RankCard } from './Progression.jsx'
import { TouchIcon } from './TouchControls.jsx'

const COMMON_TIPS = [
  ['Cook grenades', ' by holding G — release to throw. Hold too long and it goes off in your hand.'],
  ['Hold Shift', ' while scoped with the Longhaul to steady your breath.'],
  ['Press V', ' to whip out the knife and slash with any weapon. Close the gap and it lunges.'],
  ['Change class with B', ' any time — it applies on your next spawn.'],
  ['Sprint and tap C', ' to slide into cover. Jump out of a slide to keep the speed.'],
  ['Hold C or press Ctrl', ' to go prone — steadier aim, smaller target.'],
  ['Dead players drop ammo.', ' Walk over the green boxes to resupply.'],
  ['Flashbangs', ' hit hardest if you’re looking at them. Turn away!'],
]
const MAP_TIPS = {
  dustline: [
    ['Smoke blocks bot vision.', ' Pop one to cross the open yard round the refinery.'],
    ['The derrick ladder', ' is the only way up it — and you can’t shoot while climbing.'],
    ['Run up the refinery conveyor', ' onto its deck; ladders go on up to the tank platform and the tower top.'],
    ['The container stacks have ladders.', ' Walk off the top onto one to slide back down.'],
    ['The control shack', ' has an ammo crate that refills everything.'],
    ['The fallen end of the pipeline', ' is a ramp — run up it and along the top of the pipe by the north wall.'],
  ],
  acres: [
    ['Upstairs windows', ' in both houses look right down on the cul-de-sac.'],
    ['Step out onto the carport', ' (yellow house) or the garage roof (green house) from the upstairs doors.'],
    ['The moving truck is open', ' — run up its ramp and fight from among the boxes.'],
    ['The school bus', ' has its doors open front and back, and every window down.'],
    ['Climb the water tower', ' for a view of the whole town. The ladder is the only way up.'],
    ['The pool house and the garden shed', ' have ammo crates that refill everything.'],
    ['The pool is empty.', ' Drop in for cover — the steps are at the shallow end.'],
    ['Not everyone in town is real.', ' Watch out for the mannequins.'],
  ],
  palmwood: [
    ['The Frame’s top floor is open to the sky', ' — run up the stairs on its east or west side.'],
    ['The camo deck', ' beside the Frame is low cover in the middle of the loop.'],
    ['Climb the lookout towers', ' in the corners to see over the roofs. The ladder is the only way up.'],
    ['The tin shed and the hut', ' have ammo crates that refill everything.'],
    ['The market stalls', ' have counters to shoot over.'],
    ['Banana leaves hide you,', ' but they won’t stop a bullet.'],
  ],
  quarter: [
    ['The Skeleton in the middle', ' has stairs up its east side to the first floor and on to the open top, and a ladder up its west face.'],
    ['Get up on the roofs:', ' the apartments’ stairwell goes all the way up, and the east block’s stairs climb its outside.'],
    ['The teahouse roof', ' is up the stairs in its courtyard; the workshop’s, up the ladder at its east end.'],
    ['Balcony railings and the Skeleton’s stud frames', ' stop you, not bullets.'],
    ['The container on Market Street', ' and the yard walls are solid cover. The tin fences round the building site too.'],
    ['The teahouse courtyard and the car park', ' have ammo crates that refill everything.'],
    ['Watch the balconies', ' over the north alley and round the courtyard house.'],
  ],
  hollow: [
    ['Climb the burning watchtower', ' by the creek to see over the barn and the park. The ladder is the only way up.'],
    ['The barn has a hayloft.', ' The stairs run up the inside of its east wall.'],
    ['Step out onto the carport roof', ' (west house) or the garage roof (east house) from the upstairs doors.'],
    ['The church is open', ' — doors front and back, and a side door to the churchyard. The pews are low cover.'],
    ['Iron railings and picket fences', ' stop you, not bullets.'],
    ['The garden sheds', ' next to the two big houses have ammo crates that refill everything.'],
    ['The witch on the roundabout', ' is solid cover right in the middle of town.'],
  ],
  terminal: [
    ['Walk the jet bridge', ' from Gate 3 upstairs straight into the jet’s cabin.'],
    ['Search & Destroy:', ' bomb site A is inside the terminal’s east hall, B inside the jet’s cabin by the wing exits.'],
    ['Out of the jet three ways:', ' slide down from the front right door, step out onto a wing over it, or take the airstair truck at the back.'],
    ['Glass breaks.', ' The first bullet (or a knife) shatters a pane and stops there; the next goes through, and so can you.'],
    ['Up to the gates', ' by the escalators or the grand stair in the hall, the stairs at either end, or the steel stairs outside the east end.'],
    ['The free airstair truck', ' off the end of the pier is a lookout over the stand.'],
    ['The pier’s fallen floor', ' is a ramp from the baggage hall up to its gates.'],
    ['The crashed jet is a tunnel:', ' in at its broken middle, out through the nose.'],
    ['Container stacks, the fuel truck and the bus', ' are solid cover on the apron.'],
    ['The hideout behind the toilets and the corner by the south fence', ' have ammo crates that refill everything.'],
  ],
  bramble: [
    ['The dry creek is a trench.', ' Drop into its bed to cross the middle out of sight; crouch to get under the bridge and the boardwalk.'],
    ['Climb the water tower', ' to watch the whole field. The ladder is the only way up.'],
    ['The barn has a hayloft.', ' The stairs run up the inside of its east wall, and its north window looks down the field.'],
    ['The bridge’s low walls and the burnt-out tank', ' are solid cover in the middle of the map.'],
    ['Hay bales, hedges and the ruin’s broken walls', ' stop bullets. Tall grass and bushes only hide you.'],
    ['The sheds in the meadow and behind the houses', ' have ammo crates that refill everything.'],
    ['Rail fences', ' stop you, not bullets.'],
  ],
  pinecrest: [
    ['The creek’s gully is a trench', ' right across the map: drop in anywhere, and walk under the road’s bridge.'],
    ['Search & Destroy:', ' bomb site A is in the lodge’s den downstairs, B in the glasshouse’s middle aisle.'],
    ['Glass breaks.', ' The glasshouse’s panes shatter at the first bullet (or a knife); then you can shoot, or walk, through.'],
    ['Climb the granite outcrops', ' up their ramps of rock to see over the woods.'],
    ['The lodge has an upstairs', ' — the stairs run up its west wall, and the wing joins it through a door on each floor.'],
    ['Below the waterfall', ' a timber stair climbs the cliff from the creek’s bed to the glasshouse.'],
    ['The substation’s chain-link and the tarps on it', ' stop you, not bullets.'],
    ['The boathouse and the workshop', ' have ammo crates that refill everything.'],
  ],
}
const tipsFor = (mapId) => [...COMMON_TIPS, ...(MAP_TIPS[mapId] ?? [])]

function Logo({ small = false }) {
  const map = useActiveMap()
  return (
    <div className="dl-logo" style={small ? { transform: 'scale(0.6)', transformOrigin: 'left bottom' } : undefined}>
      <div className="big">
        MODERN <span>GUNS</span>
      </div>
      <div className="sub">{map.name.toUpperCase()}</div>
    </div>
  )
}

export function LoadingScreen() {
  const { progress, active } = useProgress()
  const loaded = useGameStore((s) => s.loaded)
  const { game } = useBloxity()
  const map = useActiveMap()
  const tips = tipsFor(map.id)
  const [tip, setTip] = useState(() => Math.floor(Math.random() * tips.length))
  const [minDone, setMinDone] = useState(false)
  const [shown, setShown] = useState(5)

  useEffect(() => {
    game.loadingStep(`Loading ${map.name}…`)
    const a = setInterval(() => setTip((t) => (t + 1) % tips.length), 3800)
    const b = setTimeout(() => setMinDone(true), 1800)
    return () => {
      clearInterval(a)
      clearTimeout(b)
    }
  }, [game, map.name, tips.length])

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

  const [b, rest] = tips[tip % tips.length]
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

/**
 * Who you're playing as. The game opens already signed in to the Bloxity
 * account from the portal, or as a Bloxity guest when there isn't one, so there
 * is nothing to log in or out of here.
 */
function AccountChip() {
  const { identity, isLoggedIn } = useBloxity()
  const name = identity?.displayName || identity?.username || 'Guest'
  return (
    <div className="dl-panel dl-account dl-interactive">
      {identity?.pfp ? <img src={identity.pfp} alt="" /> : <div className="initial">{name.charAt(0).toUpperCase()}</div>}
      <div style={{ lineHeight: 1.15 }}>
        <div className="dl-h" style={{ fontSize: 16 }}>
          {name}
        </div>
        <div className="dl-muted" style={{ fontSize: 11 }}>
          {isLoggedIn ? 'Bloxity account' : 'Guest'}
        </div>
      </div>
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
          <Button
            className="primary"
            onClick={() => {
              // Phones: full screen and sideways from here on (needs this tap).
              goFullscreen()
              setMenuScreen('mode')
            }}
          >
            Play <small>TDM · S&amp;D · FFA · up to {MAX_PLAYERS} players</small>
          </Button>
          <Button onClick={() => setMenuScreen('classes')}>
            Classes <small>Create-a-class</small>
          </Button>
          <Button onClick={() => setMenuScreen('settings')}>
            Settings <small>{IS_TOUCH ? 'Look' : 'Mouse'} · FOV · audio</small>
          </Button>
        </div>
        {connection.status === 'error' && (
          <div className="dl-tooltip" style={{ textTransform: 'none', letterSpacing: 0.5 }}>
            {connection.error}
          </div>
        )}
      </div>
      {/* Pick the map right here; the scene behind the menu switches to it. */}
      <div className="dl-panel dl-mapcard dl-slide-up">
        <MapPicker compact />
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
  ['V', 'Quick knife'],
  ['G (hold)', 'Cook + throw frag'],
  ['Q', 'Tactical (flash / smoke)'],
  ['B', 'Change class'],
  ['Tab', 'Scoreboard'],
  ['Esc', 'Menu'],
]

/** The same, for the on-screen controls (ui/TouchControls.jsx), with each button's icon. */
const TOUCH_KEYS = [
  ['Left thumb', 'Move: the stick jumps to where you touch'],
  ['Stick fully up', 'Sprint'],
  ['Right side drag', 'Look'],
  ['Fire', 'Fire (drag while holding to aim)', 'bullet'],
  ['Aim', 'Aim down sights (tap on / off)', 'aim'],
  ['Jump', 'Jump', 'jump'],
  ['Crouch', 'Crouch (tap) · prone (hold) · slide (while sprinting)', 'crouch'],
  ['Reload', 'Reload', 'reload'],
  ['Swap', 'Primary / secondary', 'swap'],
  ['Frag (hold)', 'Cook + throw frag', 'frag'],
  ['Tactical', 'Tactical (flash / smoke)', 'tactical'],
  ['Knife', 'Quick knife', 'knife'],
  ['Top buttons', 'Menu · scoreboard', 'pause'],
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
  const choice = (key, label, options, extra = {}) => (
    <div className="dl-settings-row" key={key}>
      <span className="dl-label" style={{ color: 'var(--text)' }}>
        {label}
      </span>
      <div className="dl-seg">
        {options.map(([value, text]) => (
          <button key={value} type="button" className={settings[key] === value ? 'on' : ''} onClick={() => setSettings({ [key]: value, ...extra })}>
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
          {slider('sensitivity', IS_TOUCH ? 'Look sensitivity' : 'Mouse sensitivity', 0.2, 3, 0.05)}
          {slider('adsSensitivity', 'ADS sensitivity', 0.3, 1.5, 0.05)}
          {toggle('invertY', 'Invert Y')}
          {IS_TOUCH && slider('touchOpacity', 'Button opacity', 0.25, 1, 0.05, (v) => `${Math.round(v * 100)}%`)}
          <div className="dl-label" style={{ marginTop: 10 }}>
            Video
          </div>
          {slider('fov', 'Field of view', 65, 100, 1, (v) => `${v}°`)}
          {choice(
            'quality',
            'Graphics quality',
            [
              ['low', 'Low'],
              ['medium', 'Med'],
              ['high', 'High'],
            ],
            { qualityAuto: false },
          )}
          {toggle('qualityAuto', 'Auto quality')}
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
          <div className="dl-label">{IS_TOUCH ? 'Touch controls' : 'Key bindings'}</div>
          <div className="dl-keys">
            {(IS_TOUCH ? TOUCH_KEYS : KEYS).map(([k, v, icon]) => (
              <span key={k} style={{ display: 'contents' }}>
                <kbd className={icon ? 'icon' : undefined}>
                  {icon && <TouchIcon name={icon} />}
                  {k}
                </kbd>
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
