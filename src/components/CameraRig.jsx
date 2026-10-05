import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

export default function CameraRig({ focus, active }) {
  const { camera, controls } = useThree()
  const look = useRef(new THREE.Vector3())
  const desired = useRef(new THREE.Vector3())
  const angle = useRef(0)

  useFrame((_, delta) => {
    if (!active || !focus || !controls) return
    angle.current += delta * 0.18
    look.current.set(focus[0], focus[1], focus[2])
    desired.current.set(focus[0] + Math.sin(angle.current) * 1.5, focus[1] + 1.55, focus[2] + 6.1)
    controls.target.lerp(look.current, 0.08)
    camera.position.lerp(desired.current, 0.06)
    if (typeof controls.update === 'function') controls.update()
  })

  return null
}
