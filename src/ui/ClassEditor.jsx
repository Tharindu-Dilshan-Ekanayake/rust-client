import { Canvas, useFrame } from '@react-three/fiber'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Box3, Group, Vector3 } from 'three'

import { createWeaponModel } from '../game/models/weaponModels.js'
import { StudioEnvironment } from '../game/StudioEnvironment.jsx'
import {
  ATTACHMENT_SLOT_LABELS,
  ATTACHMENT_SLOTS,
  ATTACHMENTS,
  CATEGORIES,
  effectiveWeapon,
  EQUIPMENT,
  LETHAL_OPTIONS,
  PRIMARY_CATEGORIES,
  PRIMARY_OPTIONS,
  SECONDARY_CATEGORIES,
  SECONDARY_OPTIONS,
  TACTICAL_OPTIONS,
  WEAPONS,
  weaponsIn,
} from '../shared/weapons.js'
import { rankInfo, RANKS } from '../shared/progression.js'
import { useGameStore } from '../store/gameStore.js'
import { Button, Icon } from './common.jsx'
import { RankInsignia } from './RankInsignia.jsx'
import { attachmentNames } from './uiUtils.js'
import { prepareWeaponIcons } from './weaponIcons.js'

/* ---------------------------------------------------------------------------
 * 3D weapon preview
 * ------------------------------------------------------------------------- */

function SpinningWeapon({ id, att }) {
  const group = useRef(null)
  const attKey = `${att?.optic ?? ''}.${att?.muzzle ?? ''}.${att?.mag ?? ''}.${att?.under ?? ''}`
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
const STAT_LABELS = Object.fromEntries(STAT_KEYS)

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

const MINI_STATS = [
  ['damage', 'DMG'],
  ['fireRate', 'RATE'],
  ['range', 'RNG'],
  ['mobility', 'MOB'],
]

/** Four small bars on a weapon row, to compare guns at a glance (touch has no hover). */
function MiniStats({ stats }) {
  return (
    <span className="dl-mini" aria-hidden>
      {MINI_STATS.map(([key, label]) => (
        <span className="row" key={key}>
          <span className="l">{label}</span>
          <span className="bar">
            <span style={{ width: `${stats[key]}%` }} />
          </span>
        </span>
      ))}
    </span>
  )
}

/* ---------------------------------------------------------------------------
 * Weapon and equipment facts
 * ------------------------------------------------------------------------- */

const FIRE_MODES = { auto: 'Full auto', semi: 'Semi-auto', bolt: 'Bolt-action', pump: 'Pump-action', melee: 'Melee' }
const fireModeOf = (w) => (w.category === 'launcher' ? 'Single shot' : w.fireMode === 'burst' ? `${w.burst}-round burst` : (FIRE_MODES[w.fireMode] ?? ''))

function weaponSpecs(w) {
  if (w.fireMode === 'melee') {
    return [
      ['Damage', 'One hit'],
      ['Reach', `${w.range} m`],
    ]
  }
  const damage = w.projectile ? `${w.projectile.damage} blast` : w.pellets ? `${w.pellets} × ${w.damage.chest}` : `${w.damage.chest} · ${w.damage.head} head`
  return [
    ['Damage', damage],
    ['Rate', `${Math.round(60 / w.fireInterval)} RPM`],
    ['Magazine', `${w.magSize} + ${w.reserve}`],
    ['Aim time', `${Math.round(w.adsTime * 1000)} ms`],
  ]
}

function equipmentSpecs(e) {
  const rows = []
  if (e.damage) rows.push(['Damage', `${e.damage}`])
  if (e.radius) rows.push([e.type === 'lethal' ? 'Blast radius' : 'Radius', `${e.radius} m`])
  if (e.trigger) rows.push(['Trigger', `Tripwire · ${e.trigger} m`])
  else if (e.id === 'c4') rows.push(['Trigger', 'Remote'])
  else if (e.fuse) rows.push(['Fuse', `${e.fuse} s${e.sticky ? ' · sticky' : e.id === 'frag' ? ' · cook' : ''}`])
  if (e.duration) rows.push(['Lasts', `${e.duration} s`])
  rows.push(['Carried', `×${e.count}`])
  return rows
}

function Specs({ rows }) {
  return (
    <div className="dl-facts">
      {rows.map(([label, value]) => (
        <div key={label}>
          <span className="dl-label">{label}</span>
          <b>{value}</b>
        </div>
      ))}
    </div>
  )
}

/** What an attachment does to the stats, e.g. "+8 Range" "−6 Handling". */
function AttachmentEffects({ mods }) {
  const fx = Object.entries(mods?.stats ?? {}).filter(([, v]) => v)
  if (!fx.length) return null
  return (
    <span className="fx">
      {fx.map(([k, v]) => (
        <span key={k} className={v > 0 ? 'up' : 'down'}>
          {v > 0 ? '+' : '−'}
          {Math.abs(v)} {STAT_LABELS[k]}
        </span>
      ))}
    </span>
  )
}

/* ---------------------------------------------------------------------------
 * Create-a-class: one choice per screen, in order.
 *
 *   Overview ─ Primary / Secondary ─▶ Category ─▶ Weapon ─▶ Attachments
 *            └ Lethal / Tactical ─▶ Equipment
 *
 * The side panel (3D preview, stats) stays mounted through every step, so
 * moving between screens never rebuilds its WebGL canvas.
 * ------------------------------------------------------------------------- */

const SLOT_LABEL = { primary: 'Primary', secondary: 'Secondary', lethal: 'Lethal', tactical: 'Tactical' }
const CATEGORIES_FOR = { primary: PRIMARY_CATEGORIES, secondary: SECONDARY_CATEGORIES }
const EQUIPMENT_FOR = { lethal: LETHAL_OPTIONS, tactical: TACTICAL_OPTIONS }
const OVERVIEW = { view: 'overview' }

/** Attachment slots worth showing for a gun (the ones with a real choice). */
const slotsOf = (id) => ATTACHMENT_SLOTS.filter((s) => WEAPONS[id].attachSlots?.[s]?.length > 1)

/** The gun a category card shows: the one equipped from it, else its first. */
const faceOf = (cat, equipped) => (WEAPONS[equipped]?.category === cat ? equipped : weaponsIn(cat)[0])

/** One step up from a screen. */
function parentOf(nav, cls) {
  if (nav.view === 'attach') return { view: 'weapon', slot: nav.slot, cat: WEAPONS[cls[nav.slot]].category }
  if (nav.view === 'weapon') return { view: 'category', slot: nav.slot }
  return OVERVIEW
}

/** The path to a screen, each step one you can jump back to. */
function crumbsOf(nav, cls) {
  const out = [{ label: cls.name || 'Class', to: OVERVIEW }]
  if (nav.view === 'overview') return out
  if (nav.view === 'equip') return [...out, { label: SLOT_LABEL[nav.slot], to: nav }]
  out.push({ label: SLOT_LABEL[nav.slot], to: { view: 'category', slot: nav.slot } })
  const cat = nav.view === 'attach' ? WEAPONS[cls[nav.slot]].category : nav.cat
  if (cat) out.push({ label: CATEGORIES[cat].label, to: { view: 'weapon', slot: nav.slot, cat } })
  if (nav.view === 'attach') out.push({ label: WEAPONS[cls[nav.slot]].name, to: nav })
  return out
}

/** What the side panel shows: equipment, or a gun (+ the class slot it's for). */
function sideOf(nav, hover, cls) {
  if (nav.view === 'overview') {
    const f = hover?.focus ?? 'primary'
    if (f === 'lethal' || f === 'tactical') return { equip: cls[f] }
    if (f === 'melee') return { id: 'knife', att: {} }
    return { id: cls[f], att: cls[`${f}Att`] ?? {}, slot: f }
  }
  if (nav.view === 'equip') return { equip: hover?.equip ?? cls[nav.slot] }
  const slot = nav.slot
  const id = cls[slot]
  const att = cls[`${slot}Att`] ?? {}
  if (nav.view === 'category' && hover?.cat) {
    const face = faceOf(hover.cat, id)
    return face === id ? { id, att, slot } : { id: face, att: {}, slot }
  }
  if (nav.view === 'weapon' && hover?.weapon && hover.weapon !== id) return { id: hover.weapon, att: {}, slot }
  if (nav.view === 'attach' && hover?.att && att[hover.att.slot] !== hover.att.value) return { id, att: { ...att, [hover.att.slot]: hover.att.value }, slot }
  return { id, att, slot }
}

function SidePanel({ side, cls, previous }) {
  if (side.equip) {
    const e = EQUIPMENT[side.equip]
    return (
      <>
        <div className="dl-preview">
          <WeaponPreview id={e.id} />
        </div>
        <div className="dl-cc-name">
          <div className="dl-label">{e.type === 'lethal' ? 'Lethal' : 'Tactical'}</div>
          <div className="dl-h">{e.name}</div>
          <div className="desc">{e.desc}</div>
        </div>
        <Specs rows={equipmentSpecs(e)} />
      </>
    )
  }
  const shown = effectiveWeapon(side.id, side.att)
  // Compared against what the class has in that slot.
  const current = side.slot ? effectiveWeapon(cls[side.slot], cls[`${side.slot}Att`] ?? {}) : shown
  const bars =
    shown !== current
      ? { base: current.stats, next: shown.stats }
      : previous && previous.slot === side.slot
        ? { base: previous.stats, next: current.stats }
        : { base: current.stats, next: null }
  const w = WEAPONS[side.id]
  const names = attachmentNames(side.att)
  return (
    <>
      <div className="dl-preview">
        <WeaponPreview id={side.id} att={side.att} />
      </div>
      <div className="dl-cc-name">
        <div className="dl-label">
          {w.kind} · {fireModeOf(w)}
        </div>
        <div className="dl-h">{w.name}</div>
        <div className="desc">{w.desc ?? 'Fixed melee weapon on every class.'}</div>
      </div>
      <StatBars base={bars.base} next={bars.next} />
      <Specs rows={weaponSpecs(shown)} />
      {(names.length > 0 || shown.quiet) && (
        <div className="dl-chips">
          {names.map((n) => (
            <span className="dl-chip" key={n}>
              {n}
            </span>
          ))}
          {shown.quiet && <span className="dl-chip accent">Off the minimap</span>}
        </div>
      )}
    </>
  )
}

/** A primary / secondary card on the overview. */
function WeaponSlot({ slot, cls, locked, onOpen, hover }) {
  const w = WEAPONS[cls[slot]]
  const names = attachmentNames(cls[`${slot}Att`])
  return (
    <Button className={`dl-wslot ${locked ? 'locked' : ''}`} onClick={locked ? undefined : onOpen} {...hover}>
      <span className="ico">
        <Icon name={w.id} height={64} maxWidth={196} />
      </span>
      <span className="txt">
        <span className="dl-label">
          {SLOT_LABEL[slot]} · {CATEGORIES[w.category].label}
        </span>
        <span className="n">{w.name}</span>
        <span className="dl-chips">
          {names.length ? (
            names.map((n) => (
              <span className="dl-chip" key={n}>
                {n}
              </span>
            ))
          ) : (
            <span className="dl-muted">No attachments</span>
          )}
        </span>
      </span>
      {!locked && (
        <span className="go" aria-hidden>
          ›
        </span>
      )}
    </Button>
  )
}

/** A lethal / tactical / melee card on the overview. */
function EquipSlot({ label, icon, name, note, locked, onOpen, hover }) {
  return (
    <Button className={`dl-eslot ${locked ? 'locked' : ''}`} onClick={locked ? undefined : onOpen} {...hover}>
      <span className="dl-label">{label}</span>
      <span className="ico">
        <Icon name={icon} height={30} />
      </span>
      <span className="n">{name}</span>
      <span className="c">{note}</span>
    </Button>
  )
}

export function ClassEditor({ onBack }) {
  const classes = useGameStore((s) => s.classes)
  const selectedId = useGameStore((s) => s.selectedClassId)
  const selectClass = useGameStore((s) => s.selectClass)
  const updateClass = useGameStore((s) => s.updateClass)
  const rank = useGameStore((s) => rankInfo(s.xp).number)
  const cls = classes.find((c) => c.id === selectedId) ?? classes[0]

  const [nav, setNav] = useState(OVERVIEW)
  // Mouse hover only (a tap would leave it stuck): { focus } on the overview,
  // { cat } / { weapon } / { att: { slot, value } } / { equip } in the steps.
  const [hover, setHover] = useState(null)
  // The stats a slot had before the last change, shown as the delta for a moment.
  const [previous, setPrevious] = useState(null)
  useEffect(() => {
    if (!previous) return undefined
    const t = setTimeout(() => setPrevious(null), 1400)
    return () => clearTimeout(t)
  }, [previous])

  // Every gun's icon, drawn in idle moments while the overview is up.
  useEffect(() => {
    prepareWeaponIcons([...PRIMARY_OPTIONS, ...SECONDARY_OPTIONS])
  }, [])

  const go = (to) => {
    setHover(null)
    setNav(to)
  }
  const back = () => (nav.view === 'overview' ? onBack() : go(parentOf(nav, cls)))
  // Escape steps back up, like the Back button.
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Escape') return
      e.preventDefault()
      back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const hoverOn = (h) => ({
    onPointerEnter: (e) => e.pointerType === 'mouse' && setHover(h),
    onPointerLeave: () => setHover(null),
  })

  const statsOf = (slot) => effectiveWeapon(cls[slot], cls[`${slot}Att`] ?? {}).stats

  const pickWeapon = (slot, id) => {
    if (cls.preset) return
    if (id !== cls[slot]) {
      setPrevious({ slot, stats: statsOf(slot) })
      updateClass(cls.id, { [slot]: id })
    }
    // Straight on to its attachments; a gun with none goes back to the class.
    go(slotsOf(id).length ? { view: 'attach', slot } : OVERVIEW)
  }
  const pickAttachment = (slot, part, value) => {
    const att = cls[`${slot}Att`] ?? {}
    if (cls.preset || att[part] === value) return
    setPrevious({ slot, stats: statsOf(slot) })
    updateClass(cls.id, { [`${slot}Att`]: { ...att, [part]: value } })
  }
  const pickEquipment = (slot, id) => {
    if (!cls.preset && cls[slot] !== id) updateClass(cls.id, { [slot]: id })
    go(OVERVIEW)
  }

  const crumbs = crumbsOf(nav, cls)
  const side = sideOf(nav, hover, cls)
  const locked = !!cls.preset

  let body
  if (nav.view === 'overview') {
    body = (
      <div className="dl-cc-overview">
        <div className="dl-cc-classes">
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
                <span className="meta">{c.preset ? 'Preset' : `${WEAPONS[c.primary].short} · ${WEAPONS[c.secondary].short}`}</span>
              </Button>
            ))}
          </div>
        </div>
        <div className="dl-cc-loadout" key={cls.id}>
          <div>
            <div className="dl-label" style={{ marginBottom: 6 }}>
              {locked ? 'Preset class (read-only)' : 'Class name'}
            </div>
            <input
              className="dl-input"
              value={cls.name}
              disabled={locked}
              maxLength={16}
              onChange={(e) => updateClass(cls.id, { name: e.target.value })}
              style={{ fontSize: 22 }}
            />
          </div>
          {['primary', 'secondary'].map((slot) => (
            <WeaponSlot key={slot} slot={slot} cls={cls} locked={locked} onOpen={() => go({ view: 'category', slot })} hover={hoverOn({ focus: slot })} />
          ))}
          <div className="dl-eslots">
            {['lethal', 'tactical'].map((slot) => (
              <EquipSlot
                key={slot}
                label={SLOT_LABEL[slot]}
                icon={cls[slot]}
                name={EQUIPMENT[cls[slot]].name}
                note={`×${EQUIPMENT[cls[slot]].count}`}
                locked={locked}
                onOpen={() => go({ view: 'equip', slot })}
                hover={hoverOn({ focus: slot })}
              />
            ))}
            <EquipSlot label="Melee" icon="knife" name={WEAPONS.knife.name} note="Fixed" locked hover={hoverOn({ focus: 'melee' })} />
          </div>
          {locked && <div className="dl-muted dl-cc-note">Presets can’t be changed. Pick CLASS 1–5 to build your own.</div>}
        </div>
      </div>
    )
  } else if (nav.view === 'category') {
    const equipped = cls[nav.slot]
    body = (
      <>
        <StepHead label={`${SLOT_LABEL[nav.slot]} weapon`} title="Choose a category" hint="Pick a category to see its guns." />
        <div className="dl-cat-grid">
          {CATEGORIES_FOR[nav.slot].map((cat, i) => {
            const guns = weaponsIn(cat)
            const on = WEAPONS[equipped].category === cat
            return (
              <Button
                key={cat}
                className={`dl-cat dl-slide-in ${on ? 'selected' : ''}`}
                style={{ animationDelay: `${i * 40}ms` }}
                onClick={() => go({ view: 'weapon', slot: nav.slot, cat })}
                {...hoverOn({ cat })}
              >
                <span className="top">
                  <span className="dl-label">{CATEGORIES[cat].short}</span>
                  {on && <span className="dl-tag">Equipped</span>}
                </span>
                <span className="ico">
                  <Icon name={faceOf(cat, equipped)} height={54} maxWidth={210} />
                </span>
                <span className="n">{CATEGORIES[cat].label}</span>
                <span className="c">
                  {guns.length} {guns.length === 1 ? 'weapon' : 'weapons'} · {guns.map((g) => WEAPONS[g].short).join(' · ')}
                </span>
              </Button>
            )
          })}
        </div>
      </>
    )
  } else if (nav.view === 'weapon') {
    const equipped = cls[nav.slot]
    const guns = weaponsIn(nav.cat)
    body = (
      <>
        <StepHead label={`${SLOT_LABEL[nav.slot]} · ${guns.length} ${guns.length === 1 ? 'weapon' : 'weapons'}`} title={CATEGORIES[nav.cat].label} hint="Pick a gun. Its attachments come next." />
        <div className="dl-gun-list">
          {guns.map((id, i) => {
            const w = WEAPONS[id]
            const on = id === equipped
            return (
              <Button
                key={id}
                className={`dl-gun dl-slide-in ${on ? 'selected' : ''}`}
                style={{ animationDelay: `${i * 35}ms` }}
                onClick={() => pickWeapon(nav.slot, id)}
                {...hoverOn({ weapon: id })}
              >
                <span className="ico">
                  <Icon name={id} height={42} maxWidth={150} />
                </span>
                <span className="txt">
                  <span className="n">
                    {w.name}
                    {on && <span className="dl-tag">Equipped</span>}
                  </span>
                  <span className="k">
                    {w.kind} · {fireModeOf(w)}
                  </span>
                  <span className="d">{w.desc}</span>
                </span>
                <MiniStats stats={w.stats} />
                <span className="go" aria-hidden>
                  ›
                </span>
              </Button>
            )
          })}
        </div>
      </>
    )
  } else if (nav.view === 'attach') {
    const id = cls[nav.slot]
    const att = cls[`${nav.slot}Att`] ?? {}
    body = (
      <>
        <StepHead label={`${SLOT_LABEL[nav.slot]} · ${WEAPONS[id].kind}`} title={WEAPONS[id].name}>
          <div className="actions">
            <Button className="small ghost" onClick={() => go(parentOf(nav, cls))}>
              Change weapon
            </Button>
            <Button className="small primary" onClick={() => go(OVERVIEW)}>
              Done
            </Button>
          </div>
        </StepHead>
        <div className="dl-attachments">
          {slotsOf(id).map((part, r) => (
            <div className="dl-att-row dl-slide-in" key={part} style={{ animationDelay: `${r * 45}ms` }}>
              <span className="dl-label slot">{ATTACHMENT_SLOT_LABELS[part]}</span>
              <div className="dl-att-options">
                {WEAPONS[id].attachSlots[part].map((value) => {
                  const a = ATTACHMENTS[part][value]
                  return (
                    <button
                      type="button"
                      key={value}
                      className={`dl-att ${att[part] === value ? 'on' : ''}`}
                      title={a.desc}
                      onClick={() => pickAttachment(nav.slot, part, value)}
                      {...hoverOn({ att: { slot: part, value } })}
                    >
                      <span className="n">{a.name}</span>
                      <span className="d">{a.desc}</span>
                      <AttachmentEffects mods={a.mods} />
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </>
    )
  } else {
    const slot = nav.slot
    body = (
      <>
        <StepHead label={`${SLOT_LABEL[slot]} equipment`} title={`Choose a ${slot}`} hint={slot === 'lethal' ? 'One per life; ammo boxes top it up.' : 'Utility to blind or hide.'} />
        <div className="dl-gear-grid">
          {EQUIPMENT_FOR[slot].map((id, i) => {
            const e = EQUIPMENT[id]
            const on = cls[slot] === id
            return (
              <Button
                key={id}
                className={`dl-gear dl-slide-in ${on ? 'selected' : ''}`}
                style={{ animationDelay: `${i * 40}ms` }}
                onClick={() => pickEquipment(slot, id)}
                {...hoverOn({ equip: id })}
              >
                <span className="ico">
                  <Icon name={id} height={38} />
                </span>
                <span className="txt">
                  <span className="n">
                    {e.name}
                    {on && <span className="dl-tag">Equipped</span>}
                  </span>
                  <span className="d">{e.desc}</span>
                </span>
                <span className="c">×{e.count}</span>
              </Button>
            )
          })}
        </div>
      </>
    )
  }

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
        <Button className="small" onClick={back}>
          Back
        </Button>
      </div>
      <div className="dl-cc">
        <div className="dl-panel dl-cc-main">
          {nav.view !== 'overview' && (
            <nav className="dl-crumbs">
              {crumbs.map((c, i) => (
                <Fragment key={i}>
                  {i > 0 && (
                    <span className="sep" aria-hidden>
                      ›
                    </span>
                  )}
                  <button type="button" disabled={i === crumbs.length - 1} onClick={() => go(c.to)}>
                    {c.label}
                  </button>
                </Fragment>
              ))}
            </nav>
          )}
          <div className="dl-cc-view" key={`${nav.view}:${nav.slot ?? ''}:${nav.cat ?? ''}`}>
            {body}
          </div>
        </div>
        <aside className="dl-panel dl-cc-side">
          <SidePanel side={side} cls={cls} previous={previous} />
        </aside>
      </div>
    </div>
  )
}

/** A step's title, with a hint (or the step's buttons) to its right. */
function StepHead({ label, title, hint, children }) {
  return (
    <div className="dl-cc-step">
      <div>
        <div className="dl-label">{label}</div>
        <h2 className="dl-h">{title}</h2>
      </div>
      {children ?? <div className="dl-muted hint">{hint}</div>}
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
