import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { Suspense, useEffect } from 'react'

import MenuCamera from './MenuCamera.jsx'
import SceneEnvironment from './SceneEnvironment.jsx'
import DustlineMap from './world/DustlineMap.jsx'

/**
 * Dev-only map viewer: `/?preview=map` orbits, or pin a view with
 * `/?preview=map&cam=x,y,z&look=x,y,z`. Handy for checking art against colliders
 * without joining a match.
 */
function FixedCamera({ cam, look, fov }) {
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    camera.fov = fov
    camera.updateProjectionMatrix()
  }, [camera, fov])
  useFrame(() => {
    camera.position.set(...cam)
    camera.lookAt(...look)
  })
  return null
}

export function MapPreview() {
  const params = new URLSearchParams(window.location.search)
  const parse = (key) => params.get(key)?.split(',').map(Number)
  const cam = parse('cam')
  const look = parse('look') ?? [0, 2, 0]
  const fov = Number(params.get('fov') || 60)
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Canvas shadows="percentage" camera={{ fov, near: 0.05, far: 600 }} dpr={[1, 1.5]}>
        <Suspense fallback={null}>
          <SceneEnvironment />
          <Physics>
            <DustlineMap />
          </Physics>
        </Suspense>
        {cam ? <FixedCamera cam={cam} look={look} fov={fov} /> : <MenuCamera />}
      </Canvas>
    </div>
  )
}

export default MapPreview
