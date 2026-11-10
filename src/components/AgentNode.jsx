import { useRef, useState, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import NodeLabel from './NodeLabel.jsx'

const LABEL_OFFSET = [0, 1.05, 0]
// The memory node is wrapped in its point clouds, so its label sits above them.
const MEMORY_LABEL_OFFSET = [0, 1.85, 0]

// A single holographic "core" representing one component of the agent
// pipeline. Built from a faceted icosahedron shell + inner glowing core +
// a rotating ring, so it reads as a machine rather than a plain sphere.
export default function AgentNode({ node, label, active, dimmed, confidence, onHover, onSelect, selected, reducedMotion = false }) {
  const group = useRef()
  const ring = useRef()
  const shell = useRef()
  const [hovered, setHovered] = useState(false)

  const color = useMemo(() => new THREE.Color(node.color), [node.color])
  const scaleTarget = useMemo(() => new THREE.Vector3(), [])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const spin = reducedMotion ? 0 : 1
    if (ring.current) {
      ring.current.rotation.z += delta * (active ? 1.4 : 0.3) * spin
      ring.current.rotation.x = Math.PI / 2.4 + Math.sin(t * 0.3) * 0.05 * spin
    }
    if (shell.current) {
      shell.current.rotation.y += delta * (active ? 0.6 : 0.15) * spin
    }
    if (group.current) {
      const s = hovered || selected ? 1.18 : active ? 1.1 : 1
      group.current.scale.lerp(scaleTarget.set(s, s, s), 0.15)
      group.current.position.y = node.position[1] + Math.sin(t * 0.6 + node.position[0]) * 0.08 * spin
    }
  })

  const emissiveIntensity = active ? 2.2 : hovered || selected ? 1.4 : dimmed ? 0.12 : 0.6
  const labelState = active ? 'active' : hovered || selected ? 'hover' : dimmed ? 'dim' : 'idle'

  return (
    <group
      ref={group}
      position={node.position}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        onHover?.(node)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={(e) => {
        e.stopPropagation()
        setHovered(false)
        onHover?.(null)
        document.body.style.cursor = 'auto'
      }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect?.(node)
      }}
    >
      <mesh>
        <icosahedronGeometry args={[0.42, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          roughness={0.25}
          metalness={0.6}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={shell}>
        <icosahedronGeometry args={[0.62, 1]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={active ? 0.9 : dimmed ? 0.1 : 0.35} />
      </mesh>

      <mesh ref={ring} rotation={[Math.PI / 2.4, 0, 0]}>
        <torusGeometry args={[0.85, 0.012, 8, 64]} />
        <meshBasicMaterial color={color} transparent opacity={active ? 0.95 : dimmed ? 0.12 : 0.4} toneMapped={false} />
      </mesh>

      <pointLight color={color} intensity={active ? 3 : dimmed ? 0.15 : 1} distance={4} decay={2} />

      <NodeLabel
        text={label ?? node.label}
        short={node.short}
        offset={node.id === 'memory' ? MEMORY_LABEL_OFFSET : LABEL_OFFSET}
        state={labelState}
        score={confidence}
      />
    </group>
  )
}
