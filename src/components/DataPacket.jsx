import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { buildArcCurve } from '../utils/curve.js'

// A glowing sphere that travels along the same arc as a Connection tube,
// representing a unit of information moving between pipeline components.
export default function DataPacket({ from, to, duration, delay = 0, color = '#9fe8ff', onComplete }) {
  const mesh = useRef()
  const light = useRef()
  const curve = useMemo(() => buildArcCurve(from, to), [from, to])
  const elapsed = useRef(-delay)
  const done = useRef(false)

  useFrame((_, delta) => {
    if (done.current) return
    elapsed.current += delta * 1000

    if (elapsed.current < 0) {
      if (mesh.current) mesh.current.visible = false
      return
    }

    const t = Math.min(elapsed.current / duration, 1)
    const point = curve.getPoint(t)
    if (mesh.current) {
      mesh.current.visible = true
      mesh.current.position.copy(point)
    }
    if (light.current) light.current.position.copy(point)

    if (t >= 1) {
      done.current = true
      onComplete?.()
    }
  })

  return (
    <group>
      <mesh ref={mesh} visible={false}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <pointLight ref={light} color={color} intensity={1.5} distance={2} decay={2} />
    </group>
  )
}
