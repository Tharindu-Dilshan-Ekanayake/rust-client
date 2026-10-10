import { Vector3 } from 'three'

import { reloadFoley } from '../../audio/bank.js'
import { sfx } from '../../audio/sfx.js'
import { net } from '../../net/network.js'
import { BULLET_GROUPS } from '../../shared/constants.js'
import { chestPoint, hitboxFor, rayHitbox } from '../../shared/hitbox.js'
import { attachmentsFor, DEFAULT_CLASS, effectiveWeapon, EQUIPMENT, WEAPONS } from '../../shared/weapons.js'
import { useGameStore } from '../../store/gameStore.js'
import { fx } from '../fx/fxApi.js'
import { castMap } from '../physicsQueries.js'
import { runtime } from '../runtime.js'
import { input, isDown, wasPressed, wasReleased } from './input.js'

const _fwd = new Vector3()
const _right = new Vector3()
const _up = new Vector3()
const _dir = new Vector3()

const SLOT_KEYS = ['primary', 'secondary', 'melee']

/** How much each shot blooms the cone; automatics bloom gently, everything else hard. */
const BLOOM = { ar: 0.0055, hornet: 0.007 }

/** Enemies whose hitboxes the local player can hit, at their rendered positions. */
function* enemyTargets() {
  const { mode, team } = useGameStore.getState()
  for (const r of runtime.remotes.values()) {
    if (!r.alive || r.state !== 'alive') continue
    if (mode === 'tdm' && r.team === team) continue
    yield r
  }
}

/**
 * The local player's weapons: firing, reloads, swaps, ADS, melee and grenades.
 *
 * Everything is predicted locally for responsiveness; the server keeps its own
 * ammo count and re-validates every shot, so this can't grant anything it wouldn't.
 */
export class WeaponSystem {
  constructor() {
    this.reset(DEFAULT_CLASS, null)
  }

  reset(cls, ammo) {
    this.cls = cls ?? DEFAULT_CLASS
    this.current = this.cls.primary
    this.ammo = {}
    for (const id of [this.cls.primary, this.cls.secondary]) {
      const w = this.weaponFor(id)
      this.ammo[id] = { mag: w.magSize, reserve: w.reserve }
    }
    this.lethal = EQUIPMENT.frag.count
    this.tacticalKind = this.cls.tactical
    this.tactical = EQUIPMENT[this.cls.tactical].count
    if (ammo) this.applyAmmo(ammo)

    this.reloadUntil = 0
    this.reloadStart = 0
    this.reloadSounds = []
    this.switchUntil = 0
    this.switchStart = 0
    this.nextFireAt = 0
    this.boltUntil = 0
    this.semiArmed = true
    this.ads = 0
    this.bloom = 0
    this.kick = 0
    this.lastShotAt = 0
    this.meleeStart = -10
    this.meleeHitAt = 0
    this.meleeTarget = null
    this.throwStart = -10
    this.cookStart = 0
    this.cooking = false
    this.breath = { holding: false, left: 3, cooldownUntil: 0 }
    this.emptyClickAt = 0
    this.autoReloadAt = 0
  }

  applyAmmo(payload) {
    for (const [id, v] of Object.entries(payload)) {
      if (Array.isArray(v) && this.ammo[id]) {
        // The server's reserve is authoritative; keep our (predicted) magazine
        // unless the server's is fuller (e.g. after a resupply).
        this.ammo[id].reserve = v[1]
        this.ammo[id].mag = Math.max(this.ammo[id].mag, Math.min(v[0], this.weaponFor(id).magSize))
      }
    }
    if (typeof payload.lethal === 'number') this.lethal = payload.lethal
    if (typeof payload.tactical === 'number') this.tactical = payload.tactical
  }

  /** Weapon stats with this class's attachments applied. */
  weaponFor(id) {
    return effectiveWeapon(id, attachmentsFor(this.cls, id))
  }

  get weapon() {
    return this.weaponFor(this.current)
  }

  slotWeapon(slot) {
    return slot === 'primary' ? this.cls.primary : slot === 'secondary' ? this.cls.secondary : 'knife'
  }

  get reloading() {
    return this.reloadUntil > 0
  }

  /* ---- actions ----------------------------------------------------------- */

  switchTo(id, now) {
    if (id === this.current || !WEAPONS[id]) return
    if (id !== this.cls.primary && id !== this.cls.secondary && id !== 'knife') return
    this.cancelReload()
    this.current = id
    this.switchStart = now
    this.switchUntil = now + WEAPONS[id].swapTime
    this.semiArmed = false
    net.send('sw', { w: id })
    sfx.play(id === 'knife' ? 'knifeDraw' : 'weaponRaise', { volume: id === 'knife' ? 0.55 : 0.6 })
  }

  startReload(now) {
    const w = this.weapon
    const a = this.ammo[w.id]
    if (!a || this.reloading || a.mag >= w.magSize || a.reserve <= 0) return
    const dur = a.mag === 0 ? w.reloadEmptyTime : w.reloadTime
    this.reloadStart = now
    this.reloadUntil = now + dur
    // Each gun's own reload foley, timed to the animation; empty reloads add
    // the charging handle / slide / bolt.
    this.reloadSounds = reloadFoley(w.id, a.mag === 0).map(([f, name]) => ({ at: now + dur * f, name }))
    net.send('rl', {})
  }

  cancelReload() {
    this.reloadUntil = 0
    this.reloadSounds = []
  }

  finishReload() {
    const w = this.weapon
    const a = this.ammo[w.id]
    const take = Math.min(w.magSize - a.mag, a.reserve)
    a.mag += take
    a.reserve -= take
    this.reloadUntil = 0
  }

  /** Fires one round. Returns true if a shot went out. */
  fire(now, ctx) {
    const w = this.weapon
    const a = this.ammo[w.id]
    const cam = ctx.camera
    if (!a || a.mag <= 0) {
      if (now - this.emptyClickAt > 0.25) {
        this.emptyClickAt = now
        sfx.play('dryFire')
      }
      if (a && a.reserve > 0 && !this.autoReloadAt) this.autoReloadAt = now + 0.15
      return false
    }
    a.mag -= 1
    this.lastShotAt = now
    this.nextFireAt = now + w.fireInterval
    if (w.fireMode === 'bolt') this.boltUntil = now + w.fireInterval
    this.kick = 1

    // Spread cone: hip vs ADS, plus movement and bloom.
    const scoped = w.scoped && this.ads > 0.95
    let spread = w.hipSpread + (w.adsSpread - w.hipSpread) * this.ads
    if (ctx.moving) spread += w.moveSpread * (1 - this.ads * 0.6)
    if (!ctx.grounded) spread += 0.05
    if (ctx.crouch) spread *= 0.8
    if (ctx.prone) spread *= 0.6
    if (ctx.sliding) spread += 0.02 * (1 - this.ads)
    spread += this.bloom
    if (scoped) spread = ctx.moving ? 0.01 : 0

    cam.getWorldDirection(_fwd)
    _right.set(1, 0, 0).applyQuaternion(cam.quaternion)
    _up.set(0, 1, 0).applyQuaternion(cam.quaternion)
    const r = Math.sqrt(Math.random()) * Math.tan(spread)
    const th = Math.random() * Math.PI * 2
    _dir.copy(_fwd).addScaledVector(_right, Math.cos(th) * r).addScaledVector(_up, Math.sin(th) * r).normalize()

    const o = [cam.position.x, cam.position.y, cam.position.z]
    const d = [_dir.x, _dir.y, _dir.z]
    const mapHit = castMap(o, d, w.range, BULLET_GROUPS, true)
    const maxT = mapHit ? mapHit.toi : w.range

    let best = null
    for (const t of enemyTargets()) {
      const hit = rayHitbox(o, d, hitboxFor(t.pos.x, t.pos.y, t.pos.z, t.renderStance ?? 0, t.yaw))
      if (hit && hit.t < maxT && (!best || hit.t < best.t)) best = { id: t.id, ...hit }
    }
    const dist = best ? best.t : maxT
    const end = [o[0] + d[0] * dist, o[1] + d[1] * dist, o[2] + d[2] * dist]

    fx.tracer(runtime.local.muzzle, end, w.id, true)
    if (best) fx.blood(end)
    else if (mapHit) {
      fx.impact(end, mapHit.normal)
      if (dist < 25) sfx.play('impact', { pos: end, volume: 0.6, ref: 2 })
    }
    net.send('fire', { w: w.id, o, d, e: end, h: best?.id, z: best?.zone })
    if (w.quiet) sfx.play('suppressed', { kind: w.id === 'sniper' ? 'sniper' : w.id === 'ar' ? 'rifle' : 'pistol' })
    else sfx.play(w.id, { volume: 0.9 })

    // Recoil kicks the view up and a little sideways; it recovers in update().
    const k = (1 - this.ads * 0.35) * (ctx.prone ? 0.7 : ctx.crouch ? 0.88 : 1)
    runtime.view.recoilPitch += w.recoil.vertical * k * (0.85 + Math.random() * 0.3)
    runtime.view.recoilYaw += (Math.random() - 0.5) * 2 * w.recoil.horizontal * k
    this.bloom = Math.min(0.07, this.bloom + (BLOOM[w.id] ?? 0.012))
    if (w.id === 'sniper') runtime.view.shake = Math.min(1, runtime.view.shake + 0.25)
    if (w.fireMode !== 'auto') this.semiArmed = false
    return true
  }

  startMelee(now, ctx) {
    if (now - this.meleeStart < WEAPONS.knife.fireInterval) return
    this.cancelReload()
    this.meleeStart = now
    this.meleeHitAt = now + 0.12
    this.meleeTarget = null
    this.meleeCount = (this.meleeCount ?? 0) + 1
    this.meleeWithKnife = this.current === 'knife'
    sfx.play(this.meleeWithKnife ? 'knifeSwing' : 'meleeSwing', { volume: 0.75 })

    // Pick the closest enemy roughly in front and within lunge range.
    const cam = ctx.camera
    cam.getWorldDirection(_fwd)
    let best = null
    for (const t of enemyTargets()) {
      const c = chestPoint(t.pos.x, t.pos.y, t.pos.z, t.renderStance ?? 0, t.yaw)
      const dx = c[0] - cam.position.x
      const dy = c[1] - cam.position.y
      const dz = c[2] - cam.position.z
      const dist = Math.hypot(dx, dy, dz)
      if (dist > WEAPONS.knife.lungeRange + 0.4) continue
      const dot = (dx * _fwd.x + dy * _fwd.y + dz * _fwd.z) / dist
      if (dot < 0.8) continue
      if (!best || dist < best.dist) best = { id: t.id, dist, dir: [dx / dist, dz / dist] }
    }
    if (best) {
      this.meleeTarget = best.id
      // Lunge: the controller closes the gap over the next ~120 ms.
      if (best.dist > WEAPONS.knife.range * 0.7) ctx.lunge(best.dir, best.dist - 0.9)
    }
  }

  throwGrenade(kind, now, ctx, cook = 0) {
    const cam = ctx.camera
    cam.getWorldDirection(_fwd)
    net.send('th', {
      k: kind,
      o: [cam.position.x, cam.position.y - 0.05, cam.position.z],
      d: [_fwd.x, _fwd.y, _fwd.z],
      cook,
    })
    if (kind === 'frag') this.lethal -= 1
    else this.tactical -= 1
    this.throwStart = now
    this.lastThrowKind = kind
    this.cancelReload()
    sfx.play('throw', { volume: 0.8 })
  }

  /* ---- per frame --------------------------------------------------------- */

  update(dt, now, ctx) {
    const w = this.weapon
    const canAct = ctx.canAct && !ctx.climbing

    for (const s of this.reloadSounds) {
      if (!s.played && now >= s.at) {
        s.played = true
        sfx.play(s.name, { volume: 0.8 })
      }
    }
    if (this.reloading && now >= this.reloadUntil) this.finishReload()
    if (this.boltUntil && now >= this.boltUntil - 0.75 && !this.boltSound) {
      this.boltSound = true
      sfx.play('bolt', { volume: 0.7 })
    }
    if (now >= this.boltUntil) this.boltSound = false

    if (canAct) {
      for (const slot of SLOT_KEYS) {
        if (wasPressed(slot)) this.switchTo(this.slotWeapon(slot), now)
      }
      if (input.mouse.wheel) {
        const order = [this.cls.primary, this.cls.secondary]
        const i = order.indexOf(this.current)
        this.switchTo(order[(i + 1 + order.length) % order.length], now)
      }
      if (wasPressed('reload')) this.startReload(now)
      if (wasPressed('quickMelee')) this.startMelee(now, ctx)
    }

    const busyThrow = now - this.throwStart < 0.45
    const switching = now < this.switchUntil
    const meleeing = now - this.meleeStart < 0.4

    // Quick-melee hit lands a beat after the swing starts.
    if (this.meleeHitAt && now >= this.meleeHitAt) {
      this.meleeHitAt = 0
      net.send('ml', this.meleeTarget ? { h: this.meleeTarget } : {})
      if (this.meleeTarget) sfx.play(this.meleeWithKnife ? 'knifeHit' : 'buttHit', { volume: 0.95 })
    }

    // --- Grenades: G cooks while held, Q throws the tactical ------------------
    if (canAct && wasPressed('lethal') && this.lethal > 0 && !this.cooking && !busyThrow) {
      this.cooking = true
      this.cookStart = now
      this.cancelReload()
      sfx.play('pin', { volume: 0.9 })
    }
    if (this.cooking) {
      const cooked = now - this.cookStart
      if (!ctx.alive) {
        this.cooking = false
      } else if (wasReleased('lethal') || !isDown('lethal') || cooked >= EQUIPMENT.frag.fuse) {
        this.cooking = false
        this.throwGrenade('frag', now, ctx, Math.min(cooked, EQUIPMENT.frag.fuse))
      }
    }
    if (canAct && wasPressed('tactical') && this.tactical > 0 && !this.cooking && !busyThrow) {
      this.throwGrenade(this.tacticalKind, now, ctx)
    }
    runtime.view.cookStart = this.cooking ? this.cookStart : 0

    // --- ADS ---------------------------------------------------------------------
    const wantAds = canAct && input.mouse.right && !ctx.sprinting && !ctx.lowered && w.adsTime > 0 && !busyThrow && !this.cooking
    const adsRate = w.adsTime > 0 ? 1 / w.adsTime : 10
    this.ads = Math.max(0, Math.min(1, this.ads + (wantAds ? adsRate : -adsRate * 1.4) * dt))

    // Hold breath (Shift while scoped): steadies sway for up to 3 s.
    const b = this.breath
    const scoped = w.scoped && this.ads > 0.9
    const wantBreath = scoped && isDown('sprint') && now >= b.cooldownUntil && b.left > 0
    if (wantBreath) {
      if (!b.holding) sfx.play('uiHover')
      b.holding = true
      b.left -= dt
      if (b.left <= 0) {
        b.holding = false
        b.cooldownUntil = now + 2
      }
    } else {
      if (b.holding) b.cooldownUntil = now + 0.6
      b.holding = false
      b.left = Math.min(w.holdBreath ?? 3, b.left + dt * 0.8)
    }
    runtime.view.holdingBreath = b.holding
    runtime.view.breath = b.left / 3
    runtime.view.scoped = scoped

    // --- Firing ------------------------------------------------------------------
    if (!input.mouse.left) this.semiArmed = true
    if (this.autoReloadAt && now >= this.autoReloadAt) {
      this.autoReloadAt = 0
      this.startReload(now)
    }
    const ready = canAct && !switching && !meleeing && !busyThrow && !this.cooking && !this.reloading && !ctx.sprinting && !ctx.lowered
    if (ready && input.mouse.left && now >= this.nextFireAt) {
      if (w.fireMode === 'melee') {
        if (input.mouse.leftPressed) this.startMelee(now, ctx)
      } else if (w.fireMode === 'auto' || this.semiArmed) {
        this.fire(now, ctx)
      }
    } else if (ready && input.mouse.leftPressed && w.fireMode === 'melee') {
      this.startMelee(now, ctx)
    }
    // Firing while sprinting: the press cancels the sprint instead.
    if (canAct && ctx.sprinting && input.mouse.leftPressed) ctx.stopSprint()

    // Recoil recovery + bloom decay once the trigger is released.
    const sinceShot = now - this.lastShotAt
    if (sinceShot > 0.09) {
      const rec = (w.recoil?.recovery ?? 6) * (ctx.prone ? 1.3 : 1)
      const f = Math.exp(-rec * dt)
      runtime.view.recoilPitch *= f
      runtime.view.recoilYaw *= f
      this.bloom *= Math.exp(-5 * dt)
    }
    this.kick = Math.max(0, this.kick - dt * 9)

    // Crosshair size for the HUD.
    let spread = w.hipSpread !== undefined ? w.hipSpread + ((w.adsSpread ?? 0) - w.hipSpread) * this.ads : 0.03
    if (ctx.moving) spread += (w.moveSpread ?? 0) * (1 - this.ads * 0.6)
    if (!ctx.grounded) spread += 0.05
    if (ctx.crouch) spread *= 0.8
    if (ctx.prone) spread *= 0.6
    runtime.view.spread = spread + this.bloom

    return { switching, meleeing, busyThrow }
  }

  /** Viewmodel animation inputs (0..1 progress values, or -1 when idle). */
  animState(now) {
    const w = this.weapon
    return {
      weapon: this.current,
      ads: this.ads,
      kick: this.kick,
      reload: this.reloading ? (now - this.reloadStart) / (this.reloadUntil - this.reloadStart) : -1,
      swap: now < this.switchUntil ? (now - this.switchStart) / (this.switchUntil - this.switchStart) : -1,
      melee: now - this.meleeStart < 0.4 ? (now - this.meleeStart) / 0.4 : -1,
      meleeIndex: this.meleeCount ?? 0,
      throw: now - this.throwStart < 0.45 ? (now - this.throwStart) / 0.45 : -1,
      cooking: this.cooking,
      grenadeKind: this.cooking ? 'frag' : now - this.throwStart < 0.45 ? this.lastThrowKind ?? 'frag' : 'frag',
      bolt: w.fireMode === 'bolt' && now < this.boltUntil ? 1 - (this.boltUntil - now) / w.fireInterval : -1,
      sinceShot: now - this.lastShotAt,
      empty: (this.ammo[w.id]?.mag ?? 1) === 0,
      att: w.att,
      quiet: w.quiet,
      muzzleFlash: now - this.lastShotAt < 0.045,
    }
  }

  hud() {
    const w = this.weapon
    const a = this.ammo[w.id]
    return {
      weapon: w.id,
      magSize: w.magSize ?? 0,
      mag: a ? a.mag : -1,
      reserve: a ? a.reserve : -1,
      lethal: this.lethal,
      tactical: this.tactical,
      tacticalKind: this.tacticalKind,
      reloading: this.reloading,
      cooking: this.cooking,
    }
  }
}
