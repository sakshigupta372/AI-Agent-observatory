import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const IDLE = new THREE.Color('#05070d')

export default function Atmosphere({ color }) {
  const { scene } = useThree()
  const current = useRef(new THREE.Color('#05070d'))
  const target = useRef(new THREE.Color('#05070d'))
  const tint = useRef(new THREE.Color('#05070d'))

  useFrame(() => {
    if (color) tint.current.set(color)
    else tint.current.copy(IDLE)
    target.current.copy(IDLE).lerp(tint.current, color ? 0.28 : 0)
    current.current.lerp(target.current, 0.045)
    scene.background = current.current
    if (scene.fog) scene.fog.color.copy(current.current)
  })

  return null
}
