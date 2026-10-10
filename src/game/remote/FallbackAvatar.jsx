import { useFrame } from '@react-three/fiber'
import { Component, useRef } from 'react'

/**
 * Plain blocky stand-in used while the Bloxity rig downloads, or if the avatar CDN
 * is unreachable. Same proportions and motion inputs as the real avatar.
 */
export function FallbackAvatar({ motionRef, color = '#5d7fa6' }) {
  const legL = useRef(null)
  const legR = useRef(null)
  const armL = useRef(null)
  const armR = useRef(null)
  useFrame(() => {
    const m = motionRef?.current
    if (!m) return
    const ratio = Math.min(1, m.speed / (m.maxSpeed || 6))
    const swing = Math.sin(m.time * (5 + ratio * 5)) * 0.8 * ratio
    if (legL.current) legL.current.rotation.x = m.crouch ? -1.1 : swing
    if (legR.current) legR.current.rotation.x = m.crouch ? -1.0 : -swing
    const aimX = m.aim ? -1.5 - (m.pitch || 0) : -swing * 0.8
    if (armL.current) armL.current.rotation.x = m.aim ? aimX : swing * 0.8
    if (armR.current) armR.current.rotation.x = m.aim ? aimX : -swing * 0.8
  })
  return (
    <group>
      <mesh position={[0, 1.55, 0]} castShadow>
        <boxGeometry args={[0.42, 0.42, 0.42]} />
        <meshStandardMaterial color="#e2b48c" />
      </mesh>
      <mesh position={[0, 1.05, 0]} castShadow>
        <boxGeometry args={[0.62, 0.62, 0.32]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {[
        [armL, 0.42],
        [armR, -0.42],
      ].map(([ref, x], i) => (
        <group key={i} ref={ref} position={[x, 1.32, 0]}>
          <mesh position={[0, -0.28, 0]} castShadow>
            <boxGeometry args={[0.22, 0.6, 0.24]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </group>
      ))}
      {[
        [legL, 0.16],
        [legR, -0.16],
      ].map(([ref, x], i) => (
        <group key={i} ref={ref} position={[x, 0.74, 0]}>
          <mesh position={[0, -0.37, 0]} castShadow>
            <boxGeometry args={[0.28, 0.74, 0.28]} />
            <meshStandardMaterial color="#3b3f45" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Swaps to `fallback` if the avatar throws (e.g. player.glb 404s). */
export class AvatarErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(err) {
    console.warn('[avatar] falling back to blocky avatar:', err?.message ?? err)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
