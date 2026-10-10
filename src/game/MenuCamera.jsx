import { useFrame, useThree } from '@react-three/fiber'
import { useEffect } from 'react'

/** Slow cinematic orbit around the map, behind every menu. */
export function MenuCamera({ radius = 42, height = 17, speed = 0.04 }) {
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    camera.fov = 55
    camera.updateProjectionMatrix()
  }, [camera])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * speed + 0.6
    const r = radius + Math.sin(clock.elapsedTime * 0.07) * 4
    camera.position.set(Math.cos(t) * r, height + Math.sin(clock.elapsedTime * 0.11) * 2.5, Math.sin(t) * r)
    camera.lookAt(0, 4, 0)
  })
  return null
}

export default MenuCamera
