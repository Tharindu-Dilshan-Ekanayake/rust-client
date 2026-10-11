import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { Group, Vector3 } from 'three'

import { useBloxityStore } from '../../bloxity/store.js'
import { runtime } from '../runtime.js'
import { makeArm, placeArm } from './arms.js'
import { buildBloxArms, dressArm } from './bloxArms.js'

/**
 * First-person hands on a ladder. They're drawn in the world (not the
 * viewmodel) so they close round the real rungs: hand over hand, each hand
 * holding a rung while the body rises past it, then reaching two rungs higher
 * while the other hand holds. Going down plays the same cycle backwards.
 */

const smooth = (t) => t * t * (3 - 2 * t)
/** Where a hand grabs at the start of its cycle, above the feet. */
const GRAB_HEIGHT = 1.75
const _side = new Vector3()
const _dir = new Vector3()
const _hand = new Vector3()
const _rest = new Vector3()
const _elbow = new Vector3()

export function ClimbHands() {
  const rig = useMemo(() => {
    const group = new Group()
    const left = makeArm(-1)
    const right = makeArm(1)
    group.add(left, right)
    group.visible = false
    return { group, left, right, arms: [[left, -1, 0], [right, 1, 1]] }
  }, [])

  // The same Bloxity arms as on the gun.
  const equipped = useBloxityStore((s) => s.equipped)
  useEffect(() => {
    let cancelled = false
    buildBloxArms(equipped).then((arms) => {
      if (cancelled || !arms) return
      dressArm(rig.left, arms.L)
      dressArm(rig.right, arms.R)
    })
    return () => {
      cancelled = true
    }
  }, [rig, equipped])

  useFrame(({ camera }) => {
    const l = runtime.local
    const ladder = l.ladder
    rig.group.visible = Boolean(ladder) && l.alive
    if (!rig.group.visible) return
    const [first, step] = ladder.rungs
    _dir.set(ladder.exitDir[0], 0, ladder.exitDir[2])
    _side.set(ladder.side[0], 0, ladder.side[2])
    const body = l.feet.y / step
    const mount = smooth(l.climbMount)

    for (const [arm, s, phase] of rig.arms) {
      // One cycle = two rungs of travel; the right hand runs half a cycle behind.
      const k = (body + phase) / 2
      const cycle = Math.floor(k)
      const f = k - cycle
      const feetAtStart = (2 * cycle - phase) * step
      const held = Math.round((feetAtStart + GRAB_HEIGHT - first) / step)
      // Holding for the first half, then reaching up two rungs.
      const reach = f < 0.5 ? 0 : smooth((f - 0.5) / 0.5)
      let y = first + (held + 2 * reach) * step - 0.02
      // Past the top rung the hands take the grab rails either side instead.
      const onRails = y > ladder.topY
      if (onRails) y = Math.min(y, ladder.topY + 0.8)
      // Just in front of the rung, pulled back off the ladder mid-reach.
      const off = 0.03 + Math.sin(reach * Math.PI) * 0.09
      _hand.set(ladder.foot[0], y, ladder.foot[1]).addScaledVector(_side, s * (onRails ? 0.25 : 0.17)).addScaledVector(_dir, -off)

      // Grabbing on: the hands come up from below the view onto the rungs.
      if (mount < 1) {
        _rest.copy(camera.position).addScaledVector(_dir, 0.15).addScaledVector(_side, s * 0.2)
        _rest.y -= 0.55
        _hand.lerpVectors(_rest, _hand, mount)
      }

      // A forearm's length back toward the body, below and outside the hand, so
      // the fingers come over the rung instead of pointing at the sky.
      _elbow.copy(_hand).addScaledVector(_dir, -0.26).addScaledVector(_side, s * 0.12)
      _elbow.y -= 0.2
      placeArm(arm, _hand, _elbow)
    }
  })

  return <primitive object={rig.group} />
}

export default ClimbHands
