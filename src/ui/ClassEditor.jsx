import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Box3, Group, Vector3 } from 'three'

import { createWeaponModel } from '../game/models/weaponModels.js'
import { StudioEnvironment } from '../game/StudioEnvironment.jsx'
import {
  ATTACHMENT_SLOT_LABELS,
  ATTACHMENT_SLOTS,
  ATTACHMENTS,
  effectiveWeapon,
  EQUIPMENT,
  PRIMARY_OPTIONS,
  SECONDARY_OPTIONS,
  TACTICAL_OPTIONS,
  WEAPONS,
} from '../shared/weapons.js'
import { rankInfo, RANKS } from '../shared/progression.js'
import { useGameStore } from '../store/gameStore.js'
import { Button, Icon } from './common.jsx'
import { RankInsignia } from './RankInsignia.jsx'
import { attachmentSummary } from './uiUtils.js'

/* ---------------------------------------------------------------------------
 * 3D weapon preview
 * ------------------------------------------------------------------------- */

function SpinningWeapon({ id, att }) {
  const group = useRef(null)
  const attKey = `${att?.optic ?? ''}.${att?.muzzle ?? ''}.${att?.mag ?? ''}`
  const model = useMemo(() => {
    const m = createWeaponModel(id, att)
    // Centre and normalise so every weapon fills the card the same way.
    const box = new Box3().setFromObject(m)
    const size = box.getSize(new Vector3())
    const center = box.getCenter(new Vector3())
    m.position.sub(center)
    const wrap = new Group()
    wrap.scale.setScalar(1.25 / Math.max(size.x, size.y, size.z))
    wrap.add(m)
    return wrap
    // eslint-disable-next-line react-hooks/exhaustive-deps -- attKey captures att
  }, [id, attKey])
  const appear = useRef(0)
  useEffect(() => {
    appear.current = 0
  }, [id])
  useFrame((_s, dt) => {
    if (!group.current) return
    group.current.rotation.y += dt * 0.6
    appear.current = Math.min(1, appear.current + dt * 4)
    const e = 1 - (1 - appear.current) ** 3
    group.current.scale.setScalar(0.85 + 0.15 * e)
    group.current.position.y = (1 - e) * -0.15
  })
  return (
    <group ref={group} rotation={[0.25, 0.6, 0]}>
      <primitive object={model} />
    </group>
  )
}

export function WeaponPreview({ id, att }) {
  return (
    // offsetSize: the UI may be scaled down with a CSS transform (ui/uiScale.js);
    // measure the box's own size, not its shrunk on-screen one.
    <Canvas camera={{ position: [0, 0.25, 1.9], fov: 35 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} resize={{ offsetSize: true }}>
      <StudioEnvironment intensity={0.85} />
      <ambientLight intensity={0.25} color="#ffe2c0" />
      <directionalLight position={[2, 3, 2]} intensity={2.2} color="#ffe0b8" />
      <directionalLight position={[-3, 1, -2]} intensity={1.6} color="#a9c2ff" />
      <SpinningWeapon id={id} att={att} />
    </Canvas>
  )
}

/* ---------------------------------------------------------------------------
 * Stat bars
 * ------------------------------------------------------------------------- */

const STAT_KEYS = [
  ['damage', 'Damage'],
  ['fireRate', 'Fire rate'],
  ['range', 'Range'],
  ['mobility', 'Mobility'],
  ['handling', 'Handling'],
]

/**
 * Animated stat bars showing `next` relative to `base` (both stat objects): the
 * difference is a green (better) or red (worse) segment. Hovering compares the
 * hovered weapon or attachment against what's equipped; right after a change,
 * the new setup against the one it replaced.
 */
export function StatBars({ base, next }) {
  return (
    <div className="dl-stats">
      {STAT_KEYS.map(([key, label]) => {
        const v = base[key]
        const o = next ? next[key] : v
        const lo = Math.min(v, o)
        const hi = Math.max(v, o)
        const up = o > v
        return (
          <div className="dl-stat" key={key}>
            <span className="dl-label" style={{ color: 'var(--text)' }}>
              {label}
            </span>
            <div className="bar">
              <div className="fill" style={{ width: `${lo}%` }} />
              <div className={`delta ${up ? 'up' : 'down'}`} style={{ left: `${lo}%`, width: `${hi - lo}%`, opacity: hi > lo ? 1 : 0 }} />
            </div>
            <span className="num" style={{ color: next && o !== v ? (up ? 'var(--good)' : 'var(--bad)') : undefined }}>
              {o}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * Editor
 * ------------------------------------------------------------------------- */

function Slot({ label, name, kind, locked, active, onClick }) {
  return (
    <div className={`dl-slot ${locked ? 'locked' : ''} ${active ? 'active' : ''} ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <div className="dl-label">{label}</div>
      <div className="name">{name}</div>
      {kind && (
        <div className="dl-muted" style={{ fontSize: 11 }}>
          {kind}
        </div>
      )}
    </div>
  )
}

export function ClassEditor({ onBack }) {
  const classes = useGameStore((s) => s.classes)
  const selectedId = useGameStore((s) => s.selectedClassId)
  const selectClass = useGameStore((s) => s.selectClass)
  const updateClass = useGameStore((s) => s.updateClass)
  const rank = useGameStore((s) => rankInfo(s.xp).number)
  const cls = classes.find((c) => c.id === selectedId) ?? classes[0]

  // Which gun the weapon card + attachment pickers are editing.
  const [focus, setFocus] = useState('primary')
  // Hover preview: { weapon } or { slot, value } on the focused weapon.
  const [hover, setHover] = useState(null)
  const [previous, setPrevious] = useState(null)
  useEffect(() => {
    if (!previous) return undefined
    const t = setTimeout(() => setPrevious(null), 1400)
    return () => clearTimeout(t)
  }, [previous])

  const weaponKey = focus === 'primary' ? 'primary' : 'secondary'
  const attKey = focus === 'primary' ? 'primaryAtt' : 'secondaryAtt'
  const weaponId = cls[weaponKey]
  const att = cls[attKey] ?? {}
  const current = effectiveWeapon(weaponId, att)
  const options = focus === 'primary' ? PRIMARY_OPTIONS : SECONDARY_OPTIONS

  const setWeapon = (id) => {
    if (cls.preset || id === weaponId) return
    setPrevious(current.stats)
    updateClass(cls.id, { [weaponKey]: id })
  }
  const setAttachment = (slot, value) => {
    if (cls.preset || att[slot] === value) return
    setPrevious(current.stats)
    updateClass(cls.id, { [attKey]: { ...att, [slot]: value } })
  }

  // What the preview + stat bars show: a hovered option, else the equipped setup.
  let shownId = weaponId
  let shownAtt = att
  if (hover?.weapon && hover.weapon !== weaponId) {
    shownId = hover.weapon
    shownAtt = {}
  } else if (hover?.slot && att[hover.slot] !== hover.value) {
    shownAtt = { ...att, [hover.slot]: hover.value }
  }
  const shown = effectiveWeapon(shownId, shownAtt)
  const bars =
    shown !== current ? { base: current.stats, next: shown.stats } : previous ? { base: previous, next: current.stats } : { base: current.stats, next: null }
  const slots = ATTACHMENT_SLOTS.filter((s) => WEAPONS[weaponId].attachSlots?.[s]?.length > 1)

  return (
    <div className="dl-frame">
      <div className="dl-frame-head">
        <div>
          <div className="dl-label">Loadout</div>
          <h1 className="dl-h">Create-a-class</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto', marginRight: 16 }}>
          <RankInsignia rank={rank} size={34} />
          <div style={{ lineHeight: 1.1 }}>
            <div className="dl-label">Rank {rank}</div>
            <div className="dl-h" style={{ fontSize: 16 }}>
              {RANKS[rank - 1].name}
            </div>
          </div>
        </div>
        <Button className="small" onClick={onBack}>
          Back
        </Button>
      </div>
      <div className="dl-cols">
        <div className="dl-panel" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          <div className="dl-label">Classes</div>
          <div className="dl-list">
            {classes.map((c, i) => (
              <Button
                key={c.id}
                className={`small dl-slide-in ${c.id === cls.id ? 'selected' : ''}`}
                style={{ animationDelay: `${i * 30}ms` }}
                onClick={() => selectClass(c.id)}
              >
                <span>{c.name}</span>
                <span className="meta">
                  {c.preset ? 'PRESET' : `${WEAPONS[c.primary].short} · ${WEAPONS[c.secondary].short}`}
                </span>
              </Button>
            ))}
          </div>
        </div>

        <div className="dl-panel dl-detail" key={cls.id}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <div className="dl-label" style={{ marginBottom: 6 }}>
                {cls.preset ? 'Preset class (read-only)' : 'Class name'}
              </div>
              <input
                className="dl-input"
                value={cls.name}
                disabled={cls.preset}
                maxLength={16}
                onChange={(e) => updateClass(cls.id, { name: e.target.value })}
                style={{ fontSize: 24 }}
              />
            </div>
          </div>

          <div className="dl-slots">
            <Slot
              label="Primary"
              name={WEAPONS[cls.primary].name}
              kind={attachmentSummary(cls.primaryAtt) || WEAPONS[cls.primary].kind}
              active={focus === 'primary'}
              onClick={() => setFocus('primary')}
            />
            <Slot
              label="Secondary"
              name={WEAPONS[cls.secondary].name}
              kind={attachmentSummary(cls.secondaryAtt) || WEAPONS[cls.secondary].kind}
              active={focus === 'secondary'}
              onClick={() => setFocus('secondary')}
            />
            <Slot label="Melee" name={WEAPONS.knife.name} kind="Fixed" locked />
            <Slot label="Lethal" name={EQUIPMENT.frag.name} kind="Fixed" locked />
            <Slot label="Tactical" name={EQUIPMENT[cls.tactical].name} kind={`×${EQUIPMENT[cls.tactical].count}`} />
          </div>

          <div className="dl-weapon-card">
            <div className="dl-preview">
              <WeaponPreview id={shownId} att={shownAtt} />
              <div className="caption">
                <div className="dl-label">{WEAPONS[shownId].kind}</div>
                <div className="dl-h" style={{ fontSize: 26 }}>
                  {WEAPONS[shownId].name}
                </div>
                <div className="dl-muted" style={{ fontSize: 11 }}>
                  {attachmentSummary(shownAtt) || 'No attachments'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <StatBars base={bars.base} next={bars.next} />
              <div className="dl-muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
                {shown.magSize} rd mag · {shown.reserve} reserve · ADS {Math.round(shown.adsTime * 1000)} ms
                {shown.quiet ? ' · hidden from minimap' : ''}
              </div>
            </div>
          </div>

          <div>
            <div className="dl-label" style={{ marginBottom: 8 }}>
              {focus === 'primary' ? 'Primary weapon' : 'Secondary weapon'}
            </div>
            <div className="dl-choice-row">
              {options.map((id) => (
                <Button
                  key={id}
                  className={`${weaponId === id ? 'selected' : ''}`}
                  disabled={cls.preset && weaponId !== id}
                  onMouseEnter={() => setHover({ weapon: id })}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setWeapon(id)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Icon name={id} height={18} />
                    {WEAPONS[id].name}
                  </span>
                  <span className="kind">{WEAPONS[id].kind}</span>
                </Button>
              ))}
            </div>
          </div>

          {slots.length > 0 && (
            <div className="dl-attachments">
              <div className="dl-label">Attachments · {WEAPONS[weaponId].short}</div>
              {slots.map((slot) => (
                <div className="dl-att-row" key={slot}>
                  <span className="dl-label slot">{ATTACHMENT_SLOT_LABELS[slot]}</span>
                  <div className="dl-att-options">
                    {WEAPONS[weaponId].attachSlots[slot].map((value) => {
                      const a = ATTACHMENTS[slot][value]
                      return (
                        <button
                          type="button"
                          key={value}
                          className={`dl-att ${att[slot] === value ? 'on' : ''}`}
                          disabled={cls.preset && att[slot] !== value}
                          title={a.desc}
                          onMouseEnter={() => setHover({ slot, value })}
                          onMouseLeave={() => setHover(null)}
                          onClick={() => setAttachment(slot, value)}
                        >
                          <span className="n">{a.name}</span>
                          <span className="d">{a.desc}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div>
            <div className="dl-label" style={{ marginBottom: 8 }}>
              Tactical
            </div>
            <div className="dl-choice-row">
              {TACTICAL_OPTIONS.map((id) => (
                <Button
                  key={id}
                  className={`${cls.tactical === id ? 'selected' : ''}`}
                  disabled={cls.preset && cls.tactical !== id}
                  onClick={() => !cls.preset && updateClass(cls.id, { tactical: id })}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Icon name={id} height={18} />
                    {EQUIPMENT[id].name}
                  </span>
                  <span className="kind">
                    {id === 'flash' ? 'Blinds + deafens · ×2' : 'Blocks vision for 12 s · ×1'}
                  </span>
                </Button>
              ))}
            </div>
          </div>
          {cls.preset && (
            <div className="dl-muted" style={{ fontSize: 12 }}>
              Presets can’t be edited — pick CLASS 1–5 to build your own.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function ClassEditorScreen() {
  const fromLoading = useGameStore((s) => s.editorFromLoading)
  const back = () => {
    if (fromLoading) {
      useGameStore.setState({ editorFromLoading: false })
      return
    }
    // Back to wherever the editor was opened from (the play screen, or the main menu).
    const to = useGameStore.getState().editorReturn || 'main'
    useGameStore.setState({ editorReturn: '' })
    useGameStore.getState().setMenuScreen(to)
  }
  return (
    <div className="dl-screen dark">
      <ClassEditor onBack={back} />
    </div>
  )
}
