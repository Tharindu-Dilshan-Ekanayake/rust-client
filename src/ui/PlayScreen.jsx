import { useRef, useState } from 'react'

import { net, normalizeRoomCode } from '../net/network.js'
import { MATCH_RULES, MAX_PLAYERS, MODE_LABELS, MODES, ROOM_CODE_LENGTH } from '../shared/constants.js'
import { MAPS } from '../shared/maps.js'
import { EQUIPMENT, WEAPONS } from '../shared/weapons.js'
import { useGameStore } from '../store/gameStore.js'
import { Button, Icon } from './common.jsx'
import { MapPicker } from './MapPicker.jsx'
import { uiClick, uiHover } from './uiUtils.js'

/* ---------------------------------------------------------------------------
 * Find a match: quick play on the left, private rooms on the right
 * ------------------------------------------------------------------------- */

const MODE_INFO = {
  [MODES.TDM]: {
    blurb: 'Alpha vs Bravo. Hold the lanes with your team — first side to the kill limit wins.',
    chips: ['4 V 4', `${MATCH_RULES.tdm.scoreLimit} KILLS`, `${MATCH_RULES.tdm.timeLimit / 60} MIN`],
  },
  [MODES.FFA]: {
    blurb: 'Everyone is a target. Spawns put you far from the fight — then it finds you.',
    chips: [`${MAX_PLAYERS} PLAYERS`, `${MATCH_RULES.ffa.scoreLimit} KILLS`, `${MATCH_RULES.ffa.timeLimit / 60} MIN`],
  },
}

/** Big faint emblem behind each mode card. */
function ModeEmblem({ mode }) {
  if (mode === MODES.TDM) {
    // Two shields squaring up.
    const shield = 'M0 0h52v34c0 22-14 36-26 44C14 70 0 56 0 34z'
    return (
      <svg className="emblem" viewBox="0 0 140 90" aria-hidden>
        <path d={shield} transform="translate(8 6)" fill="var(--alpha)" />
        <path d={shield} transform="translate(80 6)" fill="var(--bravo)" />
        <text x="70" y="52" textAnchor="middle" fontSize="20" fontWeight="700" fill="currentColor" fontFamily="var(--head)">
          VS
        </text>
      </svg>
    )
  }
  return (
    <svg className="emblem" viewBox="0 0 90 90" aria-hidden>
      <circle cx="45" cy="45" r="30" fill="none" stroke="var(--accent)" strokeWidth="5" />
      <circle cx="45" cy="45" r="5" fill="var(--accent)" />
      {[[45, 2, 45, 24], [45, 66, 45, 88], [2, 45, 24, 45], [66, 45, 88, 45]].map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--accent)" strokeWidth="5" />
      ))}
    </svg>
  )
}

function ModeCard({ mode, index }) {
  const info = MODE_INFO[mode]
  return (
    <button
      type="button"
      className={`dl-panel dl-modecard ${mode} dl-slide-up`}
      aria-label={`Quick play: ${MODE_LABELS[mode]}`}
      style={{ animationDelay: `${index * 70}ms` }}
      onMouseEnter={uiHover}
      onClick={() => {
        uiClick()
        net.join(mode)
      }}
    >
      <ModeEmblem mode={mode} />
      <div className="chips">
        {info.chips.map((c) => (
          <span key={c} className="dl-tag">
            {c}
          </span>
        ))}
      </div>
      <div className="body">
        <h2 className="dl-h">{MODE_LABELS[mode]}</h2>
        <p>{info.blurb}</p>
      </div>
      <div className="cta">
        <span>Quick play</span>
        <span className="arrow">→</span>
      </div>
    </button>
  )
}

/** Six letter boxes over one real input: type, paste or backspace as normal. */
function KeyBoxes({ value, onChange, onSubmit }) {
  const input = useRef(null)
  const [focused, setFocused] = useState(false)
  return (
    <div className={`dl-keyboxes ${focused ? 'focused' : ''}`} onClick={() => input.current?.focus()}>
      {Array.from({ length: ROOM_CODE_LENGTH }, (_, i) => (
        <span key={i} className={`box ${value[i] ? 'filled' : ''} ${focused && i === Math.min(value.length, ROOM_CODE_LENGTH - 1) ? 'caret' : ''}`}>
          {value[i] ?? ''}
        </span>
      ))}
      <input
        ref={input}
        aria-label="Room key"
        value={value}
        autoComplete="off"
        spellCheck={false}
        maxLength={ROOM_CODE_LENGTH + 4}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(normalizeRoomCode(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit()
        }}
      />
    </div>
  )
}

function PrivatePanel() {
  const [tab, setTab] = useState('create')
  const [mode, setMode] = useState(MODES.TDM)
  const [size, setSize] = useState(MAX_PLAYERS)
  const [bots, setBots] = useState(true)
  const [code, setCode] = useState('')
  const mapName = useGameStore((s) => MAPS[s.mapChoice]?.name ?? '')
  const ready = code.length === ROOM_CODE_LENGTH
  const join = () => ready && net.joinByCode(code)
  const sizeLabel = (n) => (mode === MODES.TDM ? `${n / 2}v${n / 2}` : `${n}`)
  return (
    <section className="dl-panel dl-private-panel dl-slide-up" style={{ animationDelay: '140ms' }}>
      <div className="dl-section-label">
        <span>Private match</span>
        <span className="hint">Play with friends using a room key</span>
      </div>
      <div className="dl-tabs">
        {[
          ['create', 'Create room'],
          ['join', 'Join with key'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'on' : ''}
            onMouseEnter={uiHover}
            onClick={() => {
              uiClick()
              setTab(id)
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'create' ? (
        <div className="dl-private-body">
          <div className="dl-field">
            <span className="dl-label">Mode</span>
            <div className="dl-optiles">
              {[MODES.TDM, MODES.FFA].map((m) => (
                <button key={m} type="button" className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
                  <strong>{m === MODES.TDM ? 'Team deathmatch' : 'Free for all'}</strong>
                  <small>{m === MODES.TDM ? 'Alpha vs Bravo' : 'Every player for themselves'}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="dl-field">
            <span className="dl-label">Room size</span>
            <div className="dl-seg big">
              {[2, 4, 6, 8].map((n) => (
                <button key={n} type="button" className={size === n ? 'on' : ''} onClick={() => setSize(n)}>
                  {sizeLabel(n)}
                </button>
              ))}
            </div>
          </div>
          <label className="dl-switch">
            <input type="checkbox" checked={bots} onChange={(e) => setBots(e.target.checked)} />
            <span className="track">
              <span className="knob" />
            </span>
            <span>
              <strong>Fill with bots</strong>
              <small>{bots ? 'Empty slots get bots until friends join' : 'Humans only — waits for friends'}</small>
            </span>
          </label>
          <div className="dl-private-summary">
            {mapName} · {MODE_LABELS[mode]} · {sizeLabel(size)} {mode === MODES.TDM ? '' : 'players'} · {bots ? 'bots on' : 'no bots'}
          </div>
          <Button className="primary dl-wide" onClick={() => net.createPrivate({ mode, maxPlayers: size, bots })}>
            Create room &amp; get key
          </Button>
          <p className="dl-fine">You get a {ROOM_CODE_LENGTH}-character key to share. Only people with the key can get in.</p>
        </div>
      ) : (
        <div className="dl-private-body">
          <div className="dl-field">
            <span className="dl-label">Room key</span>
            <KeyBoxes value={code} onChange={setCode} onSubmit={join} />
          </div>
          <Button className="primary dl-wide" disabled={!ready} onClick={join}>
            Join room
          </Button>
          <p className="dl-fine">Ask the host for the key shown in their lobby and pause menu. You can paste it straight in.</p>
          <ol className="dl-steps">
            <li>
              <b>1</b>
              <span>Host creates a room and picks the mode</span>
            </li>
            <li>
              <b>2</b>
              <span>They share the {ROOM_CODE_LENGTH}-character key</span>
            </li>
            <li>
              <b>3</b>
              <span>Everyone enters it here — same lobby, same match</span>
            </li>
          </ol>
        </div>
      )}
    </section>
  )
}

/** Map + current loadout, so you know what you're deploying with. */
function PlayFooter() {
  const cls = useGameStore((s) => s.classes.find((c) => c.id === s.selectedClassId) ?? s.classes[0])
  const mapName = useGameStore((s) => MAPS[s.mapChoice]?.name ?? '')
  const editClasses = () => {
    useGameStore.setState({ editorReturn: 'mode' })
    useGameStore.getState().setMenuScreen('classes')
  }
  return (
    <div className="dl-play-footer dl-slide-up" style={{ animationDelay: '200ms' }}>
      <div className="item">
        <span className="dl-label">Map</span>
        <strong>{mapName}</strong>
      </div>
      <div className="item">
        <span className="dl-label">Class</span>
        <strong>{cls.name}</strong>
        <span className="loadout">
          <Icon name={cls.primary} height={14} />
          {WEAPONS[cls.primary].short} · {WEAPONS[cls.secondary]?.short} · {EQUIPMENT[cls.tactical].name}
        </span>
      </div>
      <Button className="small" onClick={editClasses}>
        Edit classes
      </Button>
    </div>
  )
}

export function ModeSelect() {
  const setMenuScreen = useGameStore((s) => s.setMenuScreen)
  return (
    <div className="dl-screen dark dl-play">
      <div className="dl-frame">
        <div className="dl-frame-head">
          <div>
            <div className="dl-label">Select mode</div>
            <h1 className="dl-h">Find a match</h1>
          </div>
          <Button className="small" onClick={() => setMenuScreen('main')}>
            Back
          </Button>
        </div>
        <div className="dl-play-body">
          <section className="dl-play-quick">
            <div className="dl-section-label">
              <span>Quick play</span>
              <span className="hint">Public match · bots fill empty slots</span>
            </div>
            <MapPicker />
            <div className="dl-play-modes">
              {[MODES.TDM, MODES.FFA].map((mode, i) => (
                <ModeCard key={mode} mode={mode} index={i} />
              ))}
            </div>
            <PlayFooter />
          </section>
          <PrivatePanel />
        </div>
      </div>
    </div>
  )
}

export default ModeSelect
