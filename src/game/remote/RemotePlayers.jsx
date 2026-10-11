import { useFrame } from '@react-three/fiber'
import { memo, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { AdditiveBlending, CanvasTexture, Object3D, SpriteMaterial, SRGBColorSpace, Vector3 } from 'three'

import { sfx } from '../../audio/sfx.js'
import { renderTime, sampleRemote } from '../../net/network.js'
import { PLAYER } from '../../shared/constants.js'
import { ladderAt } from '../../shared/map.js'
import { parseKit } from '../../shared/weapons.js'
import { useGameStore } from '../../store/gameStore.js'
import { createWeaponModel } from '../models/weaponModels.js'
import { CROUCH_DROP, CROUCH_LEAN } from '../avatarRig.js'
import PlayerAvatar from '../PlayerAvatar.jsx'
import { runtime } from '../runtime.js'
import { flareTexture } from '../world/textures.js'
import { AvatarErrorBoundary, FallbackAvatar } from './FallbackAvatar.jsx'

const ENEMY_COLOR = '#E5484D'
const FRIEND_COLOR = '#3FA9F5'

const nameplateCache = new Map()
function nameplateMaterial(name, color, onTop) {
  const key = `${name}|${color}|${onTop}`
  if (nameplateCache.has(key)) return nameplateCache.get(key)
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 96
  const ctx = c.getContext('2d')
  ctx.font = '700 54px Rajdhani, Oswald, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 8
  ctx.strokeStyle = 'rgba(0,0,0,0.75)'
  ctx.strokeText(name.toUpperCase(), 256, 50)
  ctx.fillStyle = color
  ctx.fillText(name.toUpperCase(), 256, 50)
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  const mat = new SpriteMaterial({ map: tex, depthTest: !onTop, depthWrite: false, transparent: true })
  nameplateCache.set(key, mat)
  return mat
}

const glintMaterial = new SpriteMaterial({
  map: flareTexture(),
  color: '#fff6dc',
  blending: AdditiveBlending,
  depthWrite: false,
  transparent: true,
  sizeAttenuation: false,
})
const flashMaterial = new SpriteMaterial({
  map: flareTexture(),
  color: '#ffcf7a',
  blending: AdditiveBlending,
  depthWrite: false,
  transparent: true,
})

const _sample = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, vx: 0, vy: 0, vz: 0 }
const _v = new Vector3()
const _local = new Vector3()

function parseAvatar(json) {
  try {
    const a = json ? JSON.parse(json) : null
    return { equipped: a?.equipped ?? null, proportions: a?.proportions ?? {} }
  } catch {
    return { equipped: null, proportions: {} }
  }
}

/**
 * How each kind of weapon is carried, in the player's own frame (feet at the
 * origin, facing +Z). `pivot` is the shoulder point the gun pitches about, `hold`
 * offsets the gun from it, and `blade` turns the torso into a shooter's stance.
 * The arms are then solved onto the gun's grip and fore-end.
 */
const HOLDS = {
  // Lowered rifle: carried across the chest, muzzle up and to the left.
  rifle: { pivot: [-0.2, 1.27, -0.05], hold: [0, -0.02, 0.33], blade: -0.66, low: [-0.34, 1.04, 0.22], lowRot: [-0.58, 1.12, 0], lowHold: 0.1, prone: [-0.12, 0.52, -0.08] },
  // Lowered pistol: one hand, muzzle down.
  pistol: { pivot: [-0.12, 1.3, 0.0], hold: [0, 0.02, 0.42], blade: -0.26, low: [-0.3, 1.06, 0.29], lowRot: [1.0, 0, 0], lowHold: 0.1, oneHandLow: true, prone: [-0.05, 0.5, -0.04] },
  knife: { pivot: [-0.33, 1.05, 0.28], hold: [0, 0, 0], blade: 0, low: [-0.33, 1.05, 0.28], lowRot: [0.9, 0, 0], lowHold: 0, oneHandLow: true, prone: [-0.3, 0.25, 0.1] },
}
const LONG_GUNS = new Set(['ar', 'sniper', 'smg', 'shotgun', 'lmg', 'rpg'])
const holdFor = (id) => (LONG_GUNS.has(id) ? HOLDS.rifle : id === 'knife' ? HOLDS.knife : HOLDS.pistol)
const lerp = (a, b, t) => a + (b - a) * t
const ease = (t) => t * t * (3 - 2 * t)

const RemotePlayer = memo(function RemotePlayer({ id }) {
  const root = useRef(null)
  const body = useRef(null)
  const pivot = useRef(null)
  const holder = useRef(null)
  const nameplate = useRef(null)
  const glint = useRef(null)
  const flash = useRef(null)
  const weaponRef = useRef({ id: '', model: null, muzzle: null, grip: null, support: null, mag: null, sight: null })
  const motion = useRef({
    time: 0,
    speed: 0,
    grounded: true,
    maxSpeed: 6,
    aim: true,
    pitch: 0,
    crouch: false,
    climbing: false,
    melee: 0,
    prone: 0,
    slide: 0,
    blade: 0,
    ik: null,
  })
  const ik = useMemo(() => ({ right: new Vector3(), left: new Vector3(), poleR: new Vector3(), poleL: new Vector3() }), [])
  const smooth = useRef({ crouch: 0, prone: 0, slide: 0, aim: 1, lastStep: 0, wasSliding: false, deadPose: 0 })
  const [avatarJson, setAvatarJson] = useState(() => runtime.remotes.get(id)?.avatar ?? '')
  const [plate, setPlate] = useState({ name: '', color: ENEMY_COLOR, onTop: false })
  const avatar = useMemo(() => parseAvatar(avatarJson), [avatarJson])

  useEffect(() => () => holder.current?.clear(), [])

  // Runs before the avatar's own frame, so the arm IK sees this frame's gun pose.
  useFrame((state, dt) => {
    const r = runtime.remotes.get(id)
    const g = root.current
    if (!r || !g) return
    if (r.avatar !== avatarJson) setAvatarJson(r.avatar)

    const myTeam = useGameStore.getState().team
    const mode = useGameStore.getState().mode
    const friendly = mode === 'tdm' && r.team === myTeam
    const wantColor = friendly ? FRIEND_COLOR : ENEMY_COLOR
    if (plate.name !== r.name || plate.color !== wantColor || plate.onTop !== friendly) {
      setPlate({ name: r.name, color: wantColor, onTop: friendly })
    }

    const now = performance.now()
    const alive = r.state === 'alive'
    const deadFor = r.state === 'dead' ? now - r.deadAt : 0
    const visible = alive || (r.state === 'dead' && deadFor < 3200)
    g.visible = visible
    r.alive = alive
    if (!visible) return

    if (sampleRemote(id, renderTime(), _sample)) {
      g.position.set(_sample.x, _sample.y, _sample.z)
      // The model faces +Z; a view yaw of 0 looks down -Z.
      g.rotation.y = _sample.yaw + Math.PI
      r.pos.set(_sample.x, _sample.y, _sample.z)
      r.yaw = _sample.yaw
      r.pitch = _sample.pitch
      r.speed = Math.hypot(_sample.vx, _sample.vz)
      r.vy = _sample.vy
    }

    // On a ladder the body faces it, whichever way the climber is looking.
    const onLadder = alive && r.climbing ? ladderAt(r.pos.x, r.pos.y, r.pos.z) : null
    if (onLadder) g.rotation.y = Math.atan2(-onLadder.exitDir[0], -onLadder.exitDir[2]) + Math.PI

    // --- Stance blends --------------------------------------------------------------
    const s = smooth.current
    const k = Math.min(1, dt * 10)
    const proneNow = alive && Boolean(r.prone)
    const slideNow = alive && Boolean(r.slide) && !proneNow
    s.prone += ((proneNow ? 1 : 0) - s.prone) * Math.min(1, dt * 7)
    s.slide += ((slideNow ? 1 : 0) - s.slide) * Math.min(1, dt * 14)
    s.crouch += ((r.crouch && !proneNow ? 1 : 0) - s.crouch) * k
    r.renderStance = s.prone > 0.5 ? 2 : s.crouch > 0.5 || s.slide > 0.5 ? 1 : 0
    r.renderCrouch = r.renderStance === 1
    const pr = ease(s.prone)
    const sl = s.slide
    // How far the hips drop (crouched, sliding, or flat on the ground), and where
    // that leaves the shoulders once the crouched chest leans in.
    const crouchK = s.crouch * (1 - sl)
    const hipDrop = crouchK * CROUCH_DROP + sl * 0.62
    const drop = lerp(hipDrop + crouchK * 0.675 * (1 - Math.cos(CROUCH_LEAN)), 1.0, pr)
    const lean = crouchK * 0.675 * Math.sin(CROUCH_LEAN)

    if (slideNow && !s.wasSliding) {
      sfx.play('slide', { pos: [g.position.x, g.position.y + 0.3, g.position.z], volume: 0.7, ref: 3 })
    }
    s.wasSliding = slideNow

    // --- Body: lying down, crouching, death -----------------------------------------------
    if (body.current) {
      const b = body.current
      if (r.state === 'dead') {
        const t = Math.min(1, deadFor / 380)
        b.rotation.set(pr > 0.5 ? Math.PI / 2 : -t * t * (Math.PI / 2), 0, 0)
        b.position.set(0, (pr > 0.5 ? 0.24 : -hipDrop) - Math.max(0, (deadFor - 2200) / 1000) * 0.6, pr > 0.5 ? -1.45 : 0)
      } else {
        // Prone: tip forward about the feet, then slide back so the head sits where
        // the player actually is. Lift so the chest rests on the ground, not in it.
        b.rotation.set(pr * (Math.PI / 2), 0, 0)
        b.position.set(0, lerp(-hipDrop, 0.24, pr), -1.45 * pr)
      }
    }

    // --- Motion inputs for the rig ----------------------------------------------------------
    const m = motion.current
    m.time += dt
    m.speed = alive ? r.speed : 0
    m.maxSpeed = PLAYER.walkSpeed * (r.sprint ? PLAYER.sprintMultiplier : 1)
    m.grounded = Math.abs(r.vy) < 1.8 || r.climbing || slideNow
    m.climbing = alive && r.climbing
    m.climbPhase = onLadder ? r.pos.y / onLadder.rungs[1] : m.time * 2.2
    m.crouch = Boolean(r.crouch) && !proneNow
    m.prone = pr
    m.slide = sl
    m.pitch = r.pitch ?? 0
    const sprinting = r.sprint && r.speed > 2 && !slideNow
    m.aim = alive && !r.climbing && !sprinting && r.weapon !== 'knife'
    const sinceMelee = now - (r.meleeAt ?? 0)
    m.melee = sinceMelee < 300 ? sinceMelee / 300 : 0

    // --- Held weapon ---------------------------------------------------------------------------
    const w = weaponRef.current
    // A melee (V or a slash) puts the knife in hand for the swing.
    const weaponId = now - (r.meleeAt ?? -1e9) < 520 ? 'knife' : r.weapon || 'ar'
    const kitKey = `${weaponId}|${r.kit ?? ''}`
    if (holder.current && w.id !== kitKey) {
      holder.current.clear()
      const model = createWeaponModel(weaponId, parseKit(r.kit)[weaponId])
      model.rotation.y = Math.PI
      holder.current.add(model)
      w.id = kitKey
      w.model = model
      w.muzzle = model.getObjectByName('muzzle')
      w.grip = model.getObjectByName('grip')
      w.mag = model.getObjectByName('mag')
      w.sight = model.getObjectByName('sight')
      w.magRestY = w.mag?.position.y ?? 0
      w.warhead = model.getObjectByName('warhead')
      // Third-person support hand: on the fore-end, but no further out than the
      // blocky arms can actually reach.
      const lh = model.getObjectByName('leftHand')
      w.support = null
      if (lh) {
        w.support = new Object3D()
        w.support.name = 'support'
        w.support.position.set(0, lh.position.y, Math.max(lh.position.z, -0.32))
        model.add(w.support)
      }
    }

    const hold = holdFor(weaponId)
    const sinceReload = now - (r.reloadAt ?? -1e9)
    const reloading = sinceReload >= 0 && sinceReload < (r.reloadDur ?? 0)
    const reloadT = reloading ? sinceReload / r.reloadDur : 0
    const sinceThrow = now - (r.throwAt ?? -1e9)
    const throwing = sinceThrow >= 0 && sinceThrow < 650
    const holding = alive && !r.climbing
    const wantAim = holding && !sprinting && !throwing && weaponId !== 'knife'
    s.aim += ((wantAim ? 1 : 0) - s.aim) * Math.min(1, dt * 9)
    const aimK = ease(s.aim)
    m.blade = hold.blade * aimK * (1 - pr) * (1 - sl * 0.5)

    if (holder.current) holder.current.visible = holding || (r.state === 'dead' && deadFor < 250)
    if (pivot.current && holder.current) {
      const pv = pivot.current
      const hd = holder.current
      // Aiming pose vs lowered (sprinting / throwing) pose, blended.
      // Standing/crouched pivot, blended to the flat-on-the-ground one when prone.
      const ax = lerp(lerp(hold.low[0], hold.pivot[0], aimK), hold.prone[0], pr)
      const ay = lerp(lerp(hold.low[1], hold.pivot[1], aimK) - drop * (1 - pr), hold.prone[1], pr)
      const az = lerp(lerp(hold.low[2], hold.pivot[2], aimK) + lean, hold.prone[2], pr)
      pv.position.set(ax, ay, az)
      pv.rotation.set(
        lerp(hold.lowRot[0], -m.pitch * 0.9, aimK) * (1 - pr) + pr * -m.pitch * 0.4,
        lerp(hold.lowRot[1], 0, aimK),
        lerp(hold.lowRot[2], 0, aimK),
      )
      hd.position.set(hold.hold[0] * aimK, hold.hold[1] * aimK, lerp(hold.lowHold, hold.hold[2], Math.max(aimK, pr)))
      hd.rotation.set(0, 0, 0)
      // Recoil: a quick shove back and muzzle climb after each shot.
      const sinceShot = now - (r.firedAt ?? -1e9)
      if (alive && sinceShot < 140 && weaponId !== 'knife') {
        const kick = 1 - sinceShot / 140
        const heavy = { sniper: 2.2, viper: 1.8, shotgun: 2, rpg: 2.4 }[weaponId] ?? 1
        hd.position.z -= 0.035 * kick * heavy
        pv.rotation.x -= 0.07 * kick * heavy
      }
      // Reload: tip the gun, pull the mag down and slap it back in.
      if (reloading) {
        const tip = Math.sin(Math.min(1, reloadT * 1.15) * Math.PI)
        hd.rotation.z = 0.55 * tip
        pv.rotation.x += 0.35 * tip
      }
      if (w.mag) w.mag.position.y = w.magRestY
      if (w.warhead) {
        // The rocket's gone once fired, until a reload slides the next one in.
        const loadedAt = (r.reloadAt ?? -1e9) + (r.reloadDur ?? 0) * 0.62
        w.warhead.visible = !((r.firedAt ?? -1e9) > (loadedAt <= now ? loadedAt : -1e9))
      }
      if (reloading && w.mag) {
        const out = reloadT < 0.25 ? reloadT / 0.25 : reloadT < 0.6 ? 1 : Math.max(0, 1 - (reloadT - 0.6) / 0.15)
        w.mag.position.y = w.magRestY - 0.25 * out
      }
      // Knife slash.
      if (weaponId === 'knife') {
        pv.rotation.x = 0.9 - m.melee * 1.6
        pv.rotation.y = Math.sin(m.melee * Math.PI) * -0.9
      } else if (m.melee > 0) {
        // Rifle-butt bash.
        pv.rotation.x -= Math.sin(m.melee * Math.PI) * 0.5
        pv.position.z += Math.sin(m.melee * Math.PI) * 0.2
      }
    }

    // --- Hands onto the gun (two-bone IK, solved in the avatar's frame) --------------------
    m.ik = null
    if (holding && pivot.current && w.grip) {
      g.updateWorldMatrix(true, true)
      w.grip.getWorldPosition(ik.right)
      // Elbows down and out (and back for the trailing arm); prone, they rest on
      // the ground ahead of the shoulders.
      ik.poleR.copy(g.localToWorld(_local.set(lerp(-0.95, -0.7, pr), lerp(0.65 - drop, -0.2, pr), lerp(-0.45, 0.25, pr))))
      ik.poleL.copy(g.localToWorld(_local.set(lerp(0.95, 0.7, pr), lerp(0.65 - drop, -0.2, pr), lerp(0.1, 0.35, pr))))
      let left = null
      if (throwing) {
        // Off hand winds back past the ear, then whips forward.
        const t = sinceThrow / 650
        const back = t < 0.4 ? t / 0.4 : Math.max(0, 1 - (t - 0.4) / 0.2)
        const fwd = t < 0.4 ? 0 : Math.min(1, (t - 0.4) / 0.25)
        left = g.localToWorld(_local.set(lerp(0.45, 0.3, fwd), 1.62 - drop + back * 0.15, lerp(-0.25 * back, 0.75, fwd)))
      } else if (reloading && w.mag) {
        const grab = reloadT < 0.15 ? reloadT / 0.15 : reloadT < 0.75 ? 1 : Math.max(0, 1 - (reloadT - 0.75) / 0.2)
        w.mag.getWorldPosition(_v)
        _v.y -= 0.12
        if (w.support) w.support.getWorldPosition(ik.left)
        else ik.left.copy(_v)
        left = ik.left.lerp(_v, grab)
      } else if (w.support && weaponId !== 'knife' && !(hold.oneHandLow && aimK < 0.5)) {
        w.support.getWorldPosition(ik.left)
        left = ik.left
      }
      if (left && left !== ik.left) ik.left.copy(left)
      m.ik = { right: ik.right, left: left ? ik.left : null, poleR: ik.poleR, poleL: ik.poleL }
    }

    // Muzzle flash for ~50 ms after a shot.
    if (flash.current) {
      const flashing = alive && !r.quiet && now - r.firedAt < 55 && w.muzzle
      flash.current.visible = Boolean(flashing)
      if (flashing) {
        w.muzzle.getWorldPosition(_v)
        g.worldToLocal(flash.current.position.copy(_v))
        const big = r.weapon === 'sniper' ? 0.9 : r.weapon === 'viper' ? 0.7 : 0.55
        flash.current.scale.setScalar(big * (0.8 + Math.random() * 0.4))
        flash.current.material.rotation = Math.random() * Math.PI
      }
    }

    // Scope glint: enemies scoped in with a sniper flash a star you can see across the map.
    if (glint.current) {
      const glinting = alive && !friendly && r.ads && r.weapon === 'sniper' && w.sight
      glint.current.visible = Boolean(glinting)
      if (glinting) {
        const pulse = 0.045 + Math.sin(now * 0.012) * 0.012
        glint.current.scale.setScalar(pulse)
        w.sight.getWorldPosition(_v)
        g.worldToLocal(glint.current.position.copy(_v))
        glint.current.position.z += 0.25
      }
    }

    // Name: teammates always (through walls); enemies only under your crosshair.
    if (nameplate.current) {
      nameplate.current.visible = alive && (friendly || runtime.aimTargetId === id)
      nameplate.current.position.y = 2.15 - drop
    }

    // Hands and boots on the rungs.
    if (onLadder) {
      const rung = Math.floor(r.pos.y / (onLadder.rungs[1] * 2))
      if (rung !== s.climbRung && runtime.camera && runtime.camera.position.distanceTo(g.position) < 25) {
        sfx.play('ladderRung', { pos: [g.position.x, g.position.y + 1.2, g.position.z], volume: 0.5, ref: 2.5 })
      }
      s.climbRung = rung
    }

    // Footsteps you can hear.
    if (alive && m.grounded && r.speed > 2.4 && !r.crouch && !proneNow && !slideNow) {
      const interval = r.sprint ? 270 : 360
      if (now - s.lastStep > interval) {
        s.lastStep = now
        const cam = runtime.camera
        if (cam && cam.position.distanceTo(g.position) < 20) {
          sfx.play('footstep', {
            pos: [g.position.x, g.position.y, g.position.z],
            volume: r.sprint ? 0.55 : 0.38,
            ref: 2.5,
            surface: g.position.y > 0.3 ? 'metal' : 'sand',
          })
        }
      }
    }
  }, -0.5)

  const fallbackColor = plate.color === FRIEND_COLOR ? '#3d6f9c' : '#8d3b3b'
  return (
    <group ref={root}>
      <group ref={body}>
        <AvatarErrorBoundary fallback={<FallbackAvatar motionRef={motion} color={fallbackColor} />}>
          <Suspense fallback={<FallbackAvatar motionRef={motion} color={fallbackColor} />}>
            <PlayerAvatar
              targetHeight={PLAYER.height}
              motionRef={motion}
              equipped={avatar.equipped}
              proportions={avatar.proportions}
            />
          </Suspense>
        </AvatarErrorBoundary>
      </group>
      {/* The gun lives outside the body so lying down doesn't point it at the ground. */}
      <group ref={pivot}>
        <group ref={holder} />
      </group>
      <sprite ref={flash} material={flashMaterial} visible={false} />
      <sprite ref={glint} material={glintMaterial} visible={false} renderOrder={10} />
      {plate.name && (
        <sprite
          ref={nameplate}
          material={nameplateMaterial(plate.name, plate.color, plate.onTop)}
          scale={[1.6, 0.3, 1]}
          position={[0, 2.15, 0]}
          renderOrder={plate.onTop ? 20 : 0}
        />
      )}
    </group>
  )
})

/** All other players in the room. */
export function RemotePlayers() {
  const ids = useGameStore((s) => s.remoteIds)
  return ids.map((id) => <RemotePlayer key={id} id={id} />)
}

export default RemotePlayers
