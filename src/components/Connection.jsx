import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Tube } from '@react-three/drei'
import { buildArcCurve } from '../utils/curve.js'

// A glowing curved tube connecting two node positions. When `active`,
// it brightens to indicate the current execution path.
export default function Connection({ from, to, active, color = '#7fd9ff' }) {
  const matRef = useRef()

  const curve = useMemo(() => buildArcCurve(from, to), [from, to])

  useFrame((state) => {
    if (matRef.current) {
      const pulse = active
        ? 0.6 + Math.sin(state.clock.elapsedTime * 4) * 0.25
        : 0.18
      matRef.current.opacity = pulse
    }
  })

  return (
    <Tube args={[curve, 32, active ? 0.02 : 0.012, 8, false]}>
      <meshBasicMaterial
        ref={matRef}
        color={color}
        transparent
        opacity={active ? 0.7 : 0.18}
        toneMapped={false}
      />
    </Tube>
  )
}
