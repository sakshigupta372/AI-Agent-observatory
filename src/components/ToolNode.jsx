import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import NodeLabel from './NodeLabel.jsx'

const LABEL_OFFSET = [0, 0.62, 0]

// Smaller satellite node representing one tool branching off the Tool Hub.
export default function ToolNode({ tool, label, active, dimmed, onHover, onSelect, selected, reducedMotion = false }) {
  const mesh = useRef()
  const [hovered, setHovered] = useState(false)
  const color = useMemo(() => new THREE.Color(tool.color), [tool.color])
  const scaleTarget = useMemo(() => new THREE.Vector3(), [])

  useFrame((state, delta) => {
    if (!mesh.current) return
    if (!reducedMotion) mesh.current.rotation.y += delta * (active ? 1 : 0.2)
    const s = hovered || selected ? 1.25 : active ? 1.15 : 1
    mesh.current.scale.lerp(scaleTarget.set(s, s, s), 0.2)
  })

  const labelState = active ? 'active' : hovered || selected ? 'hover' : dimmed ? 'dim' : 'idle'

  return (
    <group
      position={tool.position}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        onHover?.(tool)
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
        onSelect?.(tool)
      }}
    >
      <mesh ref={mesh}>
        <octahedronGeometry args={[0.28, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={active ? 2 : hovered || selected ? 1.2 : dimmed ? 0.08 : 0.5}
          roughness={0.3}
          metalness={0.5}
          toneMapped={false}
        />
      </mesh>
      <pointLight color={color} intensity={active ? 1.8 : dimmed ? 0.08 : 0.4} distance={2.4} decay={2} />
      <NodeLabel text={label ?? tool.label} short={tool.short} offset={LABEL_OFFSET} state={labelState} tool />
    </group>
  )
}
