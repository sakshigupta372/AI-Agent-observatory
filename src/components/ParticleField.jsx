import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Subtle ambient floating particles to give the scene depth and a sense
// of a living data environment, without distracting from the nodes.
export default function ParticleField({ count = 500, color = '#7fa8ff' }) {
  const points = useRef()
  const material = useRef()
  const target = useRef(new THREE.Color(color))

  useEffect(() => {
    target.current.set(color)
  }, [color])

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 30
      arr[i * 3 + 1] = (Math.random() - 0.5) * 18
      arr[i * 3 + 2] = (Math.random() - 0.5) * 30
    }
    return arr
  }, [count])

  useFrame((state) => {
    if (points.current) {
      points.current.rotation.y = state.clock.elapsedTime * 0.01
    }
    if (material.current) material.current.color.lerp(target.current, 0.05)
  })

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        ref={material}
        size={0.025}
        color={color}
        transparent
        opacity={0.5}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  )
}
