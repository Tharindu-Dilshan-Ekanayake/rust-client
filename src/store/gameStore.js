import { create } from 'zustand'

import { DEFAULT_MAP, getMap, isMapId } from '../shared/maps.js'
import { rankInfo } from '../shared/progression.js'
import { CLASS_NAME_MAX, CUSTOM_CLASS_COUNT, PRESET_CLASSES, sanitizeClass } from '../shared/weapons.js'

/**
 * UI + session state.
 *
 * Only things React actually renders live here. Per-frame values (camera, weapon
 * spread, remote transforms) live in `game/runtime.js` and are read inside
 * `useFrame`, so the overlay doesn't re-render 60 times a second.
 */

const LS = {
  name: 'dustline.name',
  classes: 'dustline.classes',
  lastClass: 'dustline.lastClass',
  settings: 'dustline.settings',
  xp: 'dustline.xp',
  map: 'dustline.map',
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private mode / blocked storage: settings just won't persist.
  }
}

const customId = (i) => `custom-${i + 1}`

/** The fields a stored class keeps (sanitizeClass adds melee/lethal itself). */
function storedClass(id, clean, preset = false) {
  return {
    id,
    name: clean.name,
    primary: clean.primary,
    primaryAtt: clean.primaryAtt,
    secondary: clean.secondary,
    secondaryAtt: clean.secondaryAtt,
    tactical: clean.tactical,
    preset,
  }
}

/** Fresh custom classes start as a spread of the arsenal. */
const DEFAULT_KITS = [
  ['ar', 'pistol'],
  ['smg', 'hornet'],
  ['shotgun', 'viper'],
  ['sniper', 'pistol'],
  ['lmg', 'rpg'],
]

function defaultCustom(i) {
  const [primary, secondary] = DEFAULT_KITS[i % DEFAULT_KITS.length]
  const clean = sanitizeClass({
    name: `CLASS ${i + 1}`,
    primary,
    primaryAtt: { optic: 'reddot' },
    secondary,
    tactical: i % 2 === 0 ? 'flash' : 'smoke',
  })
  return storedClass(customId(i), clean)
}

function loadClasses() {
  const saved = read(LS.classes, [])
  const custom = Array.from({ length: CUSTOM_CLASS_COUNT }, (_, i) => {
    const s = Array.isArray(saved) ? saved.find((c) => c?.id === customId(i)) : null
    // Older saves have no secondary/attachments; sanitizeClass fills the defaults in.
    const clean = s && sanitizeClass(s)
    return clean ? storedClass(customId(i), clean) : defaultCustom(i)
  })
  return [...PRESET_CLASSES.map((c) => storedClass(c.id, sanitizeClass(c), true)), ...custom]
}

/**
 * Saved settings over the defaults. Low became everyone's starting quality:
 * saves from before that start on Low once, and whatever the player picks
 * after that (it's saved with defaultsVersion 2) sticks.
 */
function loadSettings() {
  const saved = read(LS.settings, {})
  const settings = { ...DEFAULT_SETTINGS, ...saved }
  delete settings.qualityDetected
  if ((saved.defaultsVersion ?? 1) < 2) Object.assign(settings, { quality: 'low', defaultsVersion: 2 })
  return settings
}

export const DEFAULT_SETTINGS = Object.freeze({
  sensitivity: 1.0,
  adsSensitivity: 0.8,
  fov: 75,
  volume: 0.8,
  showFps: false,
  minimap: true,
  invertY: false,
  /** low | medium | high: render scale, shadows, colour grade, dust. Everyone starts on Low. */
  quality: 'low',
  /** Drop a quality level if the frame rate can't keep up (it never raises it). */
  qualityAuto: true,
  /** Bumped when a default changes for everyone (see loadSettings). */
  defaultsVersion: 2,
  musicVolume: 0.3,
  /** Lower the render scale automatically when the frame rate drops. */
  adaptive: true,
})

/** The player's rank number from their stored XP. */
export const currentRank = () => rankInfo(useGameStore.getState().xp).number

/** Wire format for a class: the choices + a name. The server re-validates it. */
export const toWireClass = (c) =>
  c
    ? {
        name: c.name,
        primary: c.primary,
        primaryAtt: c.primaryAtt,
        secondary: c.secondary,
        secondaryAtt: c.secondaryAtt,
        tactical: c.tactical,
      }
    : null

let noticeSeq = 0
let xpSeq = 0
let feedSeq = 0
let damageSeq = 0

export const useGameStore = create((set, get) => ({
  /** loading | menu | lobby | playing | dead | ended */
  gameState: 'loading',
  /** Sub-screen of the main menu: main | classes | settings | mode */
  menuScreen: 'main',
  /** Sub-step while in a room before first spawn: connecting | team | deploy */
  lobbyStep: 'connecting',
  /** In-game overlays that don't pause the match: pause | classPicker | settings */
  overlay: null,
  /** The class editor can be opened from the loading screen before the menu exists. */
  editorFromLoading: false,
  loaded: false,
  pointerLocked: false,

  playerName: read(LS.name, ''),
  classes: loadClasses(),
  selectedClassId: read(LS.lastClass, PRESET_CLASSES[0].id),
  /** Class the current life is using (from the server's spawn message). */
  activeClass: null,
  /** Class queued for the next spawn, or null. */
  pendingClass: null,

  mode: 'tdm',
  /** The map picked in the menus (saved), and the map of the room we're in ('' outside one). */
  mapChoice: isMapId(read(LS.map, '')) ? read(LS.map, '') : DEFAULT_MAP,
  roomMap: '',
  team: '',
  myId: '',
  /** Private room key ('' in public matchmaking rooms) and the room's player cap. */
  roomCode: '',
  maxPlayers: 8,
  connection: { status: 'idle', error: '' },
  settings: loadSettings(),

  /** Throttled plain copy of the room state for scoreboards and lists. */
  room: {
    players: [],
    phase: 'playing',
    host: '',
    timeLeft: 0,
    scoreAlpha: 0,
    scoreBravo: 0,
    scoreLimit: 0,
    winner: '',
    mvp: '',
    restartIn: 0,
  },
  remoteIds: [],
  teamSelect: { deadline: 0, denied: '' },
  deployDeadline: 0,

  hud: {
    hp: 100,
    weapon: 'ar',
    magSize: 0,
    mag: 0,
    reserve: 0,
    lethal: 0,
    tactical: 0,
    tacticalKind: 'flash',
    reloading: false,
    cooking: false,
  },
  killFeed: [],
  notices: [],
  hitmarker: null,
  damageMarks: [],
  death: null,
  matchEnd: null,
  scoreboardOpen: false,

  /** Career XP (kept in this browser; the server awards it per event). */
  xp: Math.max(0, Number(read(LS.xp, 0)) || 0),
  /** XP earned in the current match, by reason, for the end-of-match summary. */
  matchXp: { total: 0, by: {} },
  /** Recent "+100 KILL" popups. */
  xpFeed: [],
  /** Rank-up banner: { id, rank } or null. */
  promotion: null,

  /* ---- actions ---------------------------------------------------------- */

  setMenuScreen: (menuScreen) => set({ menuScreen }),
  openOverlay: (overlay) => set({ overlay }),
  closeOverlay: () => set({ overlay: null }),

  setPlayerName: (name) => {
    const clean = String(name).replace(/[^\w \-.]/g, '').slice(0, 16)
    write(LS.name, clean)
    set({ playerName: clean })
  },

  selectClass: (id) => {
    write(LS.lastClass, id)
    set({ selectedClassId: id })
  },

  updateClass: (id, patch) => {
    const classes = get().classes.map((c) => {
      if (c.id !== id || c.preset) return c
      const next = { ...c, ...patch }
      // A new weapon starts from its own default attachments.
      if (patch.primary && patch.primary !== c.primary && !patch.primaryAtt) next.primaryAtt = {}
      if (patch.secondary && patch.secondary !== c.secondary && !patch.secondaryAtt) next.secondaryAtt = {}
      const clean = sanitizeClass(next)
      // Rejects anything outside the allowed weapon / attachment combinations.
      if (!clean) return c
      const stored = storedClass(c.id, clean)
      if (patch.name !== undefined) {
        // Keep exactly what's typed (even empty) while editing.
        stored.name = String(patch.name).replace(/[^\w .-]/g, '').toUpperCase().slice(0, CLASS_NAME_MAX)
      }
      return stored
    })
    write(
      LS.classes,
      classes.filter((c) => !c.preset).map((c) => Object.fromEntries(Object.entries(c).filter(([k]) => k !== 'preset'))),
    )
    set({ classes })
  },

  getClass: (id) => get().classes.find((c) => c.id === id) ?? get().classes[0],

  setMapChoice: (id) => {
    if (!isMapId(id)) return
    write(LS.map, id)
    set({ mapChoice: id })
  },

  setSettings: (patch) => {
    const settings = { ...get().settings, ...patch }
    write(LS.settings, settings)
    set({ settings })
  },

  pushNotice: (text, ms = 3000, tone = 'info') => {
    const id = ++noticeSeq
    set((s) => ({ notices: [...s.notices.slice(-3), { id, text, tone, until: performance.now() + ms }] }))
    setTimeout(() => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })), ms)
  },

  pushKill: (entry) => {
    const id = ++feedSeq
    set((s) => ({ killFeed: [...s.killFeed.slice(-5), { ...entry, id }] }))
    setTimeout(() => set((s) => ({ killFeed: s.killFeed.filter((k) => k.id !== id) })), 5000)
  },

  pushDamage: (angle) => {
    const id = ++damageSeq
    set((s) => ({ damageMarks: [...s.damageMarks.slice(-4), { id, angle }] }))
    setTimeout(() => set((s) => ({ damageMarks: s.damageMarks.filter((d) => d.id !== id) })), 1200)
  },

  /** Adds XP; returns the new rank number when it's a promotion, else 0. */
  addXp: (amount, why = '') => {
    const n = Math.max(0, Math.round(Number(amount) || 0))
    if (!n) return 0
    const s = get()
    const before = rankInfo(s.xp).number
    const xp = s.xp + n
    write(LS.xp, xp)
    const after = rankInfo(xp).number
    const id = ++xpSeq
    set({
      xp,
      matchXp: { total: s.matchXp.total + n, by: { ...s.matchXp.by, [why]: (s.matchXp.by[why] ?? 0) + n } },
      xpFeed: [...s.xpFeed.slice(-4), { id, n, why }],
    })
    setTimeout(() => set((st) => ({ xpFeed: st.xpFeed.filter((x) => x.id !== id) })), 2200)
    if (after <= before) return 0
    set({ promotion: { id, rank: after } })
    setTimeout(() => set((st) => (st.promotion?.id === id ? { promotion: null } : {})), 5500)
    return after
  },

  resetMatchXp: () => set({ matchXp: { total: 0, by: {} }, xpFeed: [] }),

  setHud: (patch) => {
    const hud = get().hud
    for (const k in patch) {
      if (hud[k] !== patch[k]) {
        set({ hud: { ...hud, ...patch } })
        return
      }
    }
  },
}))

export const getGame = () => useGameStore.getState()

/** Id of the map on screen: the room's while in one, otherwise the one picked in the menus. */
export const activeMapId = (s = useGameStore.getState()) => s.roomMap || s.mapChoice

/** The map on screen (shared/maps.js), outside React. */
export const activeMap = () => getMap(activeMapId())

/** The map on screen, as a hook. */
export const useActiveMap = () => getMap(useGameStore((s) => s.roomMap || s.mapChoice))
