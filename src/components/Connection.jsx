import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Tube } from '@react-three/drei'
import * as THREE from 'three'
import { buildArcCurve } from '../utils/curve.js'

// Shared by every edge; never disposed because they live as long as the scene module.
const ARROW_GEOMETRY = new THREE.ConeGeometry(0.075, 0.2, 12)
const PULSE_GEOMETRY = new THREE.SphereGeometry(0.04, 10, 10)
const UP = new THREE.Vector3(0, 1, 0)
const ARROW_AT = 0.6

// A curved tube between two nodes, with an arrowhead showing the direction of
// flow and (unless reduced motion is requested) a pulse travelling along it.
export default function Connection({ from, to, active, dimmed, ghost, color = '#7fd9ff', onHover, reducedMotion = false, phase = 0 }) {
  const matRef = useRef()
  const pulseRef = useRef()
  const curve = useMemo(() => buildArcCurve(from, to), [from, to])
  const arrow = useMemo(() => {
    const position = curve.getPointAt(ARROW_AT)
    const tangent = curve.getTangentAt(ARROW_AT).normalize()
    return { position, quaternion: new THREE.Quaternion().setFromUnitVectors(UP, tangent) }
  }, [curve])
  const scratch = useMemo(() => new THREE.Vector3(), [])

  useFrame((state) => {
    if (ghost) return
    const t = state.clock.elapsedTime
    if (matRef.current) {
      matRef.current.opacity = active ? (reducedMotion ? 0.75 : 0.6 + Math.sin(t * 4) * 0.25) : dimmed ? 0.06 : 0.22
    }
    if (pulseRef.current) {
      pulseRef.current.visible = !reducedMotion && !dimmed
      if (pulseRef.current.visible) {
        const speed = active ? 0.9 : 0.22
        curve.getPointAt((t * speed + phase) % 1, scratch)
        pulseRef.current.position.copy(scratch)
      }
    }
  })

  if (ghost) {
    return (
      <Tube args={[curve, 24, 0.01, 6, false]}>
        <meshBasicMaterial color="#7d8bb3" transparent opacity={0.28} toneMapped={false} />
      </Tube>
    )
  }

  const markOpacity = active ? 1 : dimmed ? 0.12 : 0.55

  return (
    <group>
      <Tube args={[curve, 32, active ? 0.022 : 0.013, 8, false]}>
        <meshBasicMaterial ref={matRef} color={color} transparent opacity={0.22} toneMapped={false} />
      </Tube>
      <mesh geometry={ARROW_GEOMETRY} position={arrow.position} quaternion={arrow.quaternion}>
        <meshBasicMaterial color={color} transparent opacity={markOpacity} toneMapped={false} />
      </mesh>
      <mesh ref={pulseRef} geometry={PULSE_GEOMETRY}>
        <meshBasicMaterial color={color} transparent opacity={active ? 1 : 0.7} toneMapped={false} />
      </mesh>
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
