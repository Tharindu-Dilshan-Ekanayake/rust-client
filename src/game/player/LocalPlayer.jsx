import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { useEffect, useMemo, useRef } from 'react'
import { Vector3 } from 'three'

import { sfx } from '../../audio/sfx.js'
import { net } from '../../net/network.js'
import { MOVE_SEND_INTERVAL_MS, PLAYER, PLAYER_GROUPS, WALK_GROUPS } from '../../shared/constants.js'
import { hitboxFor, rayHitbox } from '../../shared/hitbox.js'
import { activeMap } from '../../store/gameStore.js'
import { useGameStore } from '../../store/gameStore.js'
import { castMap } from '../physicsQueries.js'
import { on, runtime } from '../runtime.js'
import { endInputFrame, input, isDown, wasPressed } from './input.js'
import { WeaponSystem } from './weaponSystem.js'

const R = PLAYER.radius
const STAND_HALF = PLAYER.height / 2 - R
/** Capsule half-height, full height and eye height per stance. */
const HALF = {
  stand: STAND_HALF,
  crouch: PLAYER.crouchHeight / 2 - R,
  prone: Math.max(0.02, PLAYER.proneHeight / 2 - R),
}
const HEIGHT = { stand: PLAYER.height, crouch: PLAYER.crouchHeight, prone: PLAYER.proneHeight }
const EYE = { stand: PLAYER.eyeHeight, crouch: PLAYER.crouchEyeHeight, prone: PLAYER.proneEyeHeight }
/** Holding C this long goes prone instead of toggling crouch. */
const PRONE_HOLD = 0.32

const _fwd = new Vector3()
const _right = new Vector3()
const _side = new Vector3()
const _up = new Vector3()
const _wish = new Vector3()

/**
 * The local player: a Rapier kinematic character controller driving the first
 * person camera, plus the weapon system. Movement is client-authoritative and
 * streamed to the server at 20 Hz; the server sanity-checks it.
 */
export function LocalPlayer() {
  const { world, rapier } = useRapier()
  const camera = useThree((s) => s.camera)
  const ws = useMemo(() => new WeaponSystem(), [])
  const st = useRef({
    controller: null,
    collider: null,
    half: STAND_HALF,
    /** 'stand' | 'crouch' | 'prone' */
    stance: 'stand',
    /** Active slide: { start, dir: [x, z], speed } */
    slide: null,
    slideReadyAt: 0,
    /** Crouch-key bookkeeping for tap (toggle) vs hold (prone). */
    cDownAt: 0,
    cHoldUsed: false,
    cFromStance: 'stand',
    /** Weapon stays lowered while dropping prone. */
    proneLockUntil: 0,
    roll: 0,
    eye: PLAYER.eyeHeight,
    vel: new Vector3(),
    grounded: true,
    climbing: false,
    /** When the current climb started (hands come up onto the rungs), and the last rung pair heard. */
    climbFrom: 0,
    climbRung: 0,
    sprinting: false,
    sprintBlockUntil: 0,
    lunge: null,
    lastSend: 0,
    stepTimer: 0,
    bobPhase: 0,
    fallSpeed: 0,
    shakeOffset: new Vector3(),
    aimCheck: 0,
    /** After a jump, brushing a ledge must not count as landing (it would kill the jump). */
    airLockUntil: 0,
  })

  // --- Physics body ------------------------------------------------------------
  useEffect(() => {
    const controller = world.createCharacterController(0.03)
    controller.setUp({ x: 0, y: 1, z: 0 })
    controller.enableAutostep(0.42, 0.15, false)
    controller.enableSnapToGround(0.35)
    controller.setMaxSlopeClimbAngle((52 * Math.PI) / 180)
    controller.setMinSlopeSlideAngle((60 * Math.PI) / 180)
    controller.setSlideEnabled(true)
    controller.setApplyImpulsesToDynamicBodies(false)
    const collider = world.createCollider(
      rapier.ColliderDesc.capsule(STAND_HALF, R)
        .setTranslation(0, -50, 0)
        .setCollisionGroups(PLAYER_GROUPS),
    )
    st.current.controller = controller
    st.current.collider = collider
    runtime.local.collider = collider
    return () => {
      runtime.local.collider = null
      try {
        world.removeCollider(collider, false)
        world.removeCharacterController(controller)
      } catch {
        // World already disposed.
      }
    }
  }, [world, rapier])

  // --- Server events -------------------------------------------------------------
  useEffect(() => {
    const setStance = (stance) => {
      const s = st.current
      if (!s.collider || s.stance === stance) return
      const half = HALF[stance]
      const t = s.collider.translation()
      // Keep the feet where they are while the capsule changes height.
      s.collider.setTranslation({ x: t.x, y: t.y + (half - s.half), z: t.z })
      s.collider.setHalfHeight(half)
      s.half = half
      s.stance = stance
    }
    st.current.setStance = setStance

    const offSpawn = on('spawn', (m) => {
      const s = st.current
      setStance('stand')
      s.slide = null
      s.cDownAt = 0
      const [x, y, z] = m.p
      s.collider?.setTranslation({ x, y: y + s.half + R + 0.02, z })
      s.vel.set(0, 0, 0)
      s.climbing = false
      s.lunge = null
      s.eye = PLAYER.eyeHeight
      const l = runtime.local
      l.feet.set(x, y, z)
      l.yaw = m.yaw
      l.pitch = 0
      l.seq = m.seq
      l.alive = true
      runtime.view.recoilPitch = 0
      runtime.view.recoilYaw = 0
      runtime.view.flash = 0
      runtime.view.shake = 0
      ws.reset(m.classData, m.ammo)
      s.lastSend = 0
    })
    const offCorrect = on('correct', (p) => {
      const s = st.current
      s.collider?.setTranslation({ x: p[0], y: p[1] + s.half + R + 0.02, z: p[2] })
      s.vel.set(0, 0, 0)
    })
    const offAmmo = on('ammo', (a) => ws.applyAmmo(a))
    return () => {
      offSpawn()
      offCorrect()
      offAmmo()
    }
  }, [ws])

  useFrame((_state, delta) => {
    const s = st.current
    const l = runtime.local
    const dt = Math.min(delta, 0.05)
    const nowMs = performance.now()
    const now = nowMs / 1000
    const game = useGameStore.getState()
    const playing = game.gameState === 'playing'
    const alive = l.alive && playing
    const canAct = alive && input.locked && !game.overlay

    if (!alive || !s.collider) {
      endInputFrame()
      return
    }

    // --- Look ------------------------------------------------------------------
    const w = ws.weapon
    const adsFov = w.adsFov ?? game.settings.fov
    if (canAct) {
      const zoom = 1 + (adsFov / game.settings.fov - 1) * ws.ads
      const adsScale = 1 + (game.settings.adsSensitivity - 1) * ws.ads
      const sens = 0.0021 * game.settings.sensitivity * zoom * adsScale
      l.yaw -= input.mouse.dx * sens
      l.pitch -= input.mouse.dy * sens * (game.settings.invertY ? -1 : 1)
      l.pitch = Math.max(-1.5, Math.min(1.5, l.pitch))
    }

    // --- Movement intent -----------------------------------------------------------
    let ix = 0
    let iz = 0
    if (canAct) {
      iz = (isDown('forward') ? 1 : 0) - (isDown('back') ? 1 : 0)
      ix = (isDown('right') ? 1 : 0) - (isDown('left') ? 1 : 0)
      // The touch stick, analog: a light push walks slowly.
      if (input.move.x || input.move.z) {
        ix = input.move.x
        iz = input.move.z
      }
    }
    _fwd.set(-Math.sin(l.yaw), 0, -Math.cos(l.yaw))
    const v = s.vel

    // --- Stance: C taps crouch / holds prone / slides out of a sprint; Ctrl prone --------
    /** Room overhead to grow from the current stance to `target`? */
    const roomFor = (target) => {
      const cur = HEIGHT[s.stance]
      const want = HEIGHT[target]
      if (want <= cur) return true
      return !castMap([l.feet.x, l.feet.y + cur - 0.05, l.feet.z], [0, 1, 0], want - cur + 0.1, WALK_GROUPS)
    }
    const endSlide = () => {
      if (!s.slide) return
      s.slide = null
      s.slideReadyAt = now + PLAYER.slideCooldown
    }
    const changeStance = (target) => {
      if (target === s.stance) return
      if (!roomFor(target)) {
        // Can't stand up under here; settle for crouching if that fits.
        if (target === 'stand' && s.stance === 'prone' && roomFor('crouch')) target = 'crouch'
        else return
      }
      if (target !== 'crouch') endSlide()
      s.setStance(target)
      if (target === 'prone') {
        s.proneLockUntil = now + 0.45
        sfx.play('prone', { volume: 0.7 })
      } else {
        sfx.play('stance', { volume: 0.6 })
      }
    }
    const startSlide = () => {
      const hv = Math.hypot(v.x, v.z)
      const dir = hv > 0.5 ? [v.x / hv, v.z / hv] : [_fwd.x, _fwd.z]
      s.slide = { start: now, dir, speed: Math.max(PLAYER.slideSpeed, hv * 1.12) }
      s.setStance('crouch')
      s.cHoldUsed = true
      sfx.play('slide', { volume: 0.85 })
    }

    if (canAct && !s.climbing) {
      if (wasPressed('crouch')) {
        s.cDownAt = now
        s.cHoldUsed = false
        s.cFromStance = s.stance
        if (s.sprinting && s.grounded && !s.slide && now >= s.slideReadyAt) startSlide()
        else if (s.stance !== 'crouch') changeStance('crouch')
      }
      if (s.cDownAt && isDown('crouch') && !s.cHoldUsed && !s.slide && now - s.cDownAt > PRONE_HOLD) {
        s.cHoldUsed = true
        changeStance('prone')
      }
      if (s.cDownAt && !isDown('crouch')) {
        // A quick tap while already crouched stands back up.
        if (!s.cHoldUsed && s.cFromStance === 'crouch' && s.stance === 'crouch') changeStance('stand')
        s.cDownAt = 0
      }
      if (wasPressed('prone')) changeStance(s.stance === 'prone' ? 'stand' : 'prone')
      // Sprinting out of crouch or prone stands you up.
      if (isDown('sprint') && iz > 0 && s.stance !== 'stand' && !s.slide && !input.mouse.right) changeStance('stand')
    }
    if (s.climbing && s.stance !== 'stand') changeStance('stand')

    const sprintHeld = canAct && isDown('sprint') && !input.mouse.right
    s.sprinting =
      sprintHeld && iz > 0 && s.grounded && s.stance === 'stand' && !s.slide && !ws.cooking && now >= s.sprintBlockUntil && !s.climbing
    const crawling = s.stance === 'prone' && Math.hypot(v.x, v.z) > 0.6
    const lowered = s.stance === 'prone' && (crawling || now < s.proneLockUntil)
    const ctx = {
      camera,
      canAct,
      alive,
      climbing: s.climbing,
      sprinting: s.sprinting,
      moving: Math.hypot(s.vel.x, s.vel.z) > 1,
      grounded: s.grounded,
      crouch: s.stance === 'crouch',
      prone: s.stance === 'prone',
      sliding: Boolean(s.slide),
      lowered,
      lunge: (dir, dist) => {
        s.lunge = { x: dir[0], z: dir[1], until: now + Math.min(0.16, Math.max(0.05, dist / 13)) }
      },
      stopSprint: () => {
        s.sprintBlockUntil = now + 0.35
      },
    }

    let speed = PLAYER.walkSpeed * w.moveMultiplier
    if (s.sprinting) speed *= PLAYER.sprintMultiplier
    if (s.stance === 'crouch') speed *= PLAYER.crouchMultiplier
    if (s.stance === 'prone') speed *= PLAYER.proneMultiplier
    if (ws.ads > 0.5) speed *= PLAYER.adsMultiplier

    _right.set(Math.cos(l.yaw), 0, -Math.sin(l.yaw))
    _wish.set(0, 0, 0).addScaledVector(_fwd, iz).addScaledVector(_right, ix)
    // Keys give full speed in any direction; the touch stick scales it by how far it's pushed.
    if (_wish.lengthSq() > 0) _wish.normalize().multiplyScalar(speed * Math.min(1, Math.hypot(ix, iz)))

    if (s.slide) {
      const t = (now - s.slide.start) / PLAYER.slideTime
      if (t >= 1 || !s.grounded) {
        endSlide()
        // Still holding sprint and forward: pop straight back up into the run.
        if (canAct && isDown('sprint') && iz > 0 && roomFor('stand')) changeStance('stand')
      } else {
        // A little steering toward where you're looking, speed bleeding off.
        const [dx, dz] = s.slide.dir
        const cross = dx * _fwd.z - dz * _fwd.x
        const turn = Math.max(-1, Math.min(1, -cross)) * 1.1 * dt
        const c = Math.cos(turn)
        const sn = Math.sin(turn)
        s.slide.dir = [dx * c - dz * sn, dx * sn + dz * c]
        // Holds most of its speed early, then bleeds off: about 5 m of travel.
        const sp = s.slide.speed + (PLAYER.walkSpeed * PLAYER.crouchMultiplier - s.slide.speed) * t * t
        v.x = s.slide.dir[0] * sp
        v.z = s.slide.dir[1] * sp
      }
    }
    if (!s.slide) {
      const accel = s.grounded ? 14 : 3
      const k = Math.min(1, accel * dt)
      v.x += (_wish.x - v.x) * k
      v.z += (_wish.z - v.z) * k
    }

    if (s.lunge) {
      if (now < s.lunge.until) {
        v.x = s.lunge.x * 13
        v.z = s.lunge.z * 13
      } else {
        s.lunge = null
      }
    }

    // --- Ladder ----------------------------------------------------------------------
    const ladder = activeMap().ladderAt(l.feet.x, l.feet.y, l.feet.z)
    // > 0 while looking at the ladder (into whatever it's fixed to).
    const facing = ladder ? _fwd.x * ladder.exitDir[0] + _fwd.z * ladder.exitDir[2] : 0
    const wasClimbing = s.climbing
    if (!s.climbing && ladder && canAct) {
      // From below: walk into it looking at it. From the top: just walk out over
      // the edge onto it, whichever way you're facing.
      const intoIt = iz > 0 && facing > 0.3
      const wish = _wish.length()
      const overTop = l.feet.y > ladder.topY - 0.4 && wish > 0 && -(_wish.x * ladder.exitDir[0] + _wish.z * ladder.exitDir[2]) > 0.3 * wish
      if (intoIt || overTop) {
        s.climbing = true
        s.climbFrom = now
        sfx.play('ladderRung', { volume: 0.5 })
      }
    }
    if (s.climbing) {
      if (!ladder || (canAct && wasPressed('jump'))) {
        if (canAct && wasPressed('jump')) {
          v.set(-ladder.exitDir[0] * 3, 3.5, -ladder.exitDir[2] * 3)
        }
        s.climbing = false
      } else {
        // W climbs the way you're looking: up when facing the ladder, down when
        // facing away from it (side-on, looking down means down).
        const sense = facing > 0.25 ? 1 : facing < -0.25 ? -1 : l.pitch > -0.35 ? 1 : -1
        const climb = canAct ? iz * sense : 0
        v.y = climb * PLAYER.climbSpeed
        v.x = (ladder.x - l.feet.x) * 8
        v.z = (ladder.z - l.feet.z) * 8
        if (climb > 0 && l.feet.y >= ladder.topY + 0.02) {
          // Step off the top onto the platform.
          v.x = ladder.exitDir[0] * 3
          v.z = ladder.exitDir[2] * 3
          v.y = 0.5
        }
        if (climb < 0 && s.grounded && l.feet.y < ladder.base + 0.3) s.climbing = false
        // A hand (and boot) on steel every other rung.
        const rung = Math.floor(l.feet.y / (ladder.rungs[1] * 2))
        if (rung !== s.climbRung && climb !== 0) sfx.play('ladderRung', { volume: 0.32 + Math.random() * 0.1 })
        s.climbRung = rung
      }
    }
    // Off the ladder: the gun comes back up into the hands.
    if (wasClimbing && !s.climbing) ws.raise(now)
    l.ladder = s.climbing ? ladder : null
    l.climbMount = s.climbing ? Math.min(1, (now - s.climbFrom) / 0.25) : 0

    // --- Gravity / jump -------------------------------------------------------------
    if (!s.climbing) {
      if (s.grounded) {
        if (canAct && wasPressed('jump')) {
          if (s.slide && roomFor('stand')) {
            // Slide-cancel jump: stand, hop, keep the momentum.
            endSlide()
            s.setStance('stand')
            v.y = PLAYER.jumpVelocity
            s.grounded = false
            s.airLockUntil = now + 0.18
          } else if (s.stance !== 'stand') {
            changeStance('stand')
          } else {
            v.y = PLAYER.jumpVelocity
            s.grounded = false
            s.airLockUntil = now + 0.18
          }
        } else if (v.y < 0) {
          v.y = -2
        }
      } else {
        v.y -= PLAYER.gravity * dt
        s.fallSpeed = Math.min(s.fallSpeed, v.y)
      }
    }

    // --- Collide and slide ---------------------------------------------------------------
    const desired = { x: v.x * dt, y: v.y * dt, z: v.z * dt }
    s.controller.computeColliderMovement(s.collider, desired, rapier.QueryFilterFlags.EXCLUDE_SENSORS, PLAYER_GROUPS)
    const mv = s.controller.computedMovement()
    const t = s.collider.translation()
    s.collider.setTranslation({ x: t.x + mv.x, y: t.y + mv.y, z: t.z + mv.z })
    const wasGrounded = s.grounded
    s.grounded = s.controller.computedGrounded() && now >= s.airLockUntil
    if (v.y > 0 && mv.y < desired.y * 0.5) v.y = 0 // bumped a ceiling
    // Slid into something: stop the slide rather than grinding along it.
    if (s.slide && Math.hypot(mv.x, mv.z) < Math.hypot(desired.x, desired.z) * 0.35) endSlide()
    if (s.grounded && !wasGrounded) {
      if (s.fallSpeed < -7) sfx.play('land', { volume: Math.min(1, -s.fallSpeed / 14) })
      s.fallSpeed = 0
    }

    const pos = s.collider.translation()
    l.feet.set(pos.x, pos.y - s.half - R, pos.z)
    l.crouch = s.stance === 'crouch'
    l.prone = s.stance === 'prone'
    l.sliding = Boolean(s.slide)
    // 1 at the start of a slide, bleeding to 0 as it slows (speed lines, FOV kick).
    l.slideK = s.slide ? Math.max(0, 1 - (now - s.slide.start) / PLAYER.slideTime) : 0
    l.grounded = s.grounded
    l.climbing = s.climbing
    l.sprinting = s.sprinting
    l.vel.copy(v)

    // --- Weapons ------------------------------------------------------------------------
    ws.update(dt, now, ctx)
    l.weapon = ws.current
    l.ads = ws.ads

    // --- Camera ---------------------------------------------------------------------------
    const eyeTarget = EYE[s.stance] - (s.slide ? 0.14 : 0)
    // Going prone takes a moment; everything else snaps quickly.
    s.eye += (eyeTarget - s.eye) * Math.min(1, dt * (s.stance === 'prone' ? 6 : 12))
    // Hand over hand on a ladder: the body leans toward the hand reaching up.
    const climbSway = l.ladder ? Math.sin((l.feet.y / l.ladder.rungs[1]) * Math.PI) : 0
    s.roll += ((s.slide ? 0.075 : 0) + climbSway * 0.035 - s.roll) * Math.min(1, dt * 10)
    const hSpeed = Math.hypot(v.x, v.z)
    const ratio = s.grounded ? Math.min(1, hSpeed / (PLAYER.walkSpeed * PLAYER.sprintMultiplier)) : 0
    s.bobPhase += dt * (6 + ratio * 6) * (hSpeed > 0.5 ? 1 : 0)
    const bobAmt = ratio * (1 - ws.ads * 0.85)
    const bobY = Math.abs(Math.sin(s.bobPhase)) * 0.045 * bobAmt

    const view = runtime.view
    view.shake = Math.max(0, view.shake - dt * 2.2)
    const sh = view.shake * view.shake
    s.shakeOffset.set((Math.random() - 0.5) * sh * 0.08, (Math.random() - 0.5) * sh * 0.08, 0)

    // Sniper sway while scoped (hold breath steadies it).
    let swayX = 0
    let swayY = 0
    if (w.scoped && ws.ads > 0.5) {
      let amp = (w.sway ?? 0.01) * ws.ads
      if (view.holdingBreath) amp *= 0.12
      else if (ws.breath.cooldownUntil > now) amp *= 1.6
      if (hSpeed > 1) amp *= 2.5
      if (s.stance === 'crouch') amp *= 0.7
      if (s.stance === 'prone') amp *= 0.4
      swayX = (Math.sin(now * 0.9) + Math.sin(now * 2.3) * 0.3) * amp
      swayY = (Math.sin(now * 1.3) * 0.8 + Math.cos(now * 0.6) * 0.3) * amp
    }

    camera.position.set(l.feet.x, l.feet.y + s.eye + bobY, l.feet.z).add(s.shakeOffset)
    if (l.ladder) camera.position.addScaledVector(_side.set(l.ladder.side[0], 0, l.ladder.side[2]), climbSway * 0.035)
    camera.rotation.order = 'YXZ'
    camera.rotation.set(
      l.pitch + view.recoilPitch + swayY,
      l.yaw + view.recoilYaw + swayX,
      (Math.random() - 0.5) * sh * 0.03 - s.roll,
    )
    const adsEase = ws.ads * ws.ads * (3 - 2 * ws.ads)
    const fov = game.settings.fov + (adsFov - game.settings.fov) * adsEase + (s.sprinting ? 5 : 0) + 9 * (l.slideK ?? 0) * (1 - adsEase)
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov += (fov - camera.fov) * Math.min(1, dt * 18)
      camera.updateProjectionMatrix()
    }
    camera.updateMatrixWorld()

    // Approximate muzzle position in the world, for tracer origins.
    camera.getWorldDirection(_fwd)
    _right.set(1, 0, 0).applyQuaternion(camera.quaternion)
    _up.set(0, 1, 0).applyQuaternion(camera.quaternion)
    const reach = { sniper: 1.0, lmg: 0.85, shotgun: 0.85, smg: 0.6, rpg: 0.6, hornet: 0.45 }[w.id] ?? (w.kind === 'Pistol' ? 0.45 : 0.75)
    l.muzzle
      .copy(camera.position)
      .addScaledVector(_fwd, reach)
      .addScaledVector(_right, 0.16 * (1 - ws.ads))
      .addScaledVector(_up, -0.1 * (1 - ws.ads) - 0.03)

    // Viewmodel inputs.
    runtime.vmState = ws.animState(now)
    runtime.vmState.bob = { x: Math.sin(s.bobPhase) * 0.012 * bobAmt, y: bobY * 0.35 }
    runtime.vmState.sprint = s.sprinting || lowered ? 1 : 0
    runtime.vmState.slide = s.slide ? 1 : 0
    runtime.vmState.climbing = s.climbing
    runtime.vmState.lookDx = input.mouse.dx
    runtime.vmState.lookDy = input.mouse.dy

    // --- Footsteps --------------------------------------------------------------------------
    if (s.grounded && hSpeed > 2 && s.stance === 'stand') {
      s.stepTimer -= dt
      if (s.stepTimer <= 0) {
        s.stepTimer = s.sprinting ? 0.28 : 0.38
        // Sand on the ground; anything raised (catwalks, containers, stairs) rings.
        // Left and right feet land a touch differently.
        s.stepLeft = !s.stepLeft
        sfx.play('footstep', {
          volume: (s.sprinting ? 0.34 : 0.26) * (s.stepLeft ? 1 : 0.88),
          rate: s.stepLeft ? 1 : 0.95,
          surface: l.feet.y > 0.3 ? 'metal' : 'sand',
        })
      }
    }

    // --- Who's under the crosshair (enemy nameplates) ---------------------------------------
    s.aimCheck -= dt
    if (s.aimCheck <= 0) {
      s.aimCheck = 0.1
      const o = [camera.position.x, camera.position.y, camera.position.z]
      const d = [_fwd.x, _fwd.y, _fwd.z]
      const wall = castMap(o, d, 80)
      const maxT = wall ? wall.toi : 80
      let best = null
      for (const r of runtime.remotes.values()) {
        if (!r.alive) continue
        const hit = rayHitbox(o, d, hitboxFor(r.pos.x, r.pos.y, r.pos.z, r.renderStance ?? 0, r.yaw), 0.25)
        if (hit && hit.t < maxT && (!best || hit.t < best.t)) best = { id: r.id, t: hit.t }
      }
      runtime.aimTargetId = best?.id ?? ''
    }

    // --- Network + HUD ------------------------------------------------------------------------
    if (nowMs - s.lastSend >= MOVE_SEND_INTERVAL_MS) {
      s.lastSend = nowMs
      const flags =
        (s.stance === 'crouch' ? 1 : 0) |
        (ws.ads > 0.5 ? 2 : 0) |
        (s.sprinting ? 4 : 0) |
        (s.climbing ? 8 : 0) |
        (s.stance === 'prone' ? 16 : 0) |
        (s.slide ? 32 : 0)
      net.send('m', {
        p: [l.feet.x, l.feet.y, l.feet.z],
        yaw: l.yaw,
        pitch: l.pitch,
        f: flags,
        s: l.seq,
        ct: Math.round(nowMs),
      })
    }
    game.setHud(ws.hud())

    endInputFrame()
  }, -1)

  return null
}

export default LocalPlayer
