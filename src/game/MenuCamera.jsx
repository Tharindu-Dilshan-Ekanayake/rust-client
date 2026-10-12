import { useFrame, useThree } from '@react-three/fiber'
import { useEffect } from 'react'

import { useActiveMap } from '../store/gameStore.js'
import { envFor } from './environment.js'

/** Slow cinematic orbit around the map, behind every menu (sized per map). */
export function MenuCamera({ speed = 0.04 }) {
  const { radius, height, look } = envFor(useActiveMap().id).menuCam
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    camera.fov = 55
    camera.updateProjectionMatrix()
  }, [camera])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * speed + 0.6
    const r = radius + Math.sin(clock.elapsedTime * 0.07) * 4
    camera.position.set(Math.cos(t) * r, height + Math.sin(clock.elapsedTime * 0.11) * 2.5, Math.sin(t) * r)
    camera.lookAt(look[0], look[1], look[2])
  })
  return null
}

export default MenuCamera
