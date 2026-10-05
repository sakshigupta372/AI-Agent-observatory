import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Tube } from '@react-three/drei'
import { buildArcCurve } from '../utils/curve.js'

// A glowing curved tube connecting two node positions. When `active`,
// it brightens to indicate the current execution path.
export default function Connection({ from, to, active, dimmed, ghost, color = '#7fd9ff', onHover }) {
  const matRef = useRef()
  const curve = useMemo(() => buildArcCurve(from, to), [from, to])

  useFrame((state) => {
    if (ghost || !matRef.current) return
    if (matRef.current) {
      const pulse = active
        ? 0.6 + Math.sin(state.clock.elapsedTime * 4) * 0.25
        : dimmed
          ? 0.05
          : 0.18
      matRef.current.opacity = pulse
    }
  })

  if (ghost) {
    return (
      <Tube args={[curve, 24, 0.01, 6, false]}>
        <meshBasicMaterial color="#7d8bb3" transparent opacity={0.28} toneMapped={false} />
      </Tube>
    )
  }

  return (
    <group>
      <Tube args={[curve, 32, active ? 0.02 : 0.012, 8, false]}>
        <meshBasicMaterial
          ref={matRef}
          color={color}
          transparent
          opacity={active ? 0.7 : dimmed ? 0.05 : 0.18}
          toneMapped={false}
        />
      </Tube>
      <Tube
        args={[curve, 16, 0.14, 6, false]}
        onPointerOver={(event) => {
          event.stopPropagation()
          document.body.style.cursor = 'pointer'
          onHover?.(true)
        }}
        onPointerOut={(event) => {
          event.stopPropagation()
          document.body.style.cursor = 'auto'
          onHover?.(false)
        }}
      >
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </Tube>
    </group>
  )
}
