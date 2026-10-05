import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'

// Smaller satellite node representing one tool branching off the Tool Hub.
export default function ToolNode({ tool, active, dimmed, onHover, onSelect, selected }) {
  const mesh = useRef()
  const [hovered, setHovered] = useState(false)
  const color = new THREE.Color(tool.color)

  useFrame((state, delta) => {
    if (mesh.current) {
      mesh.current.rotation.y += delta * (active ? 1 : 0.2)
      const targetScale = hovered || selected ? 1.25 : 1
      mesh.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.2)
    }
  })

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
      <Billboard position={[0, 0.55, 0]}>
        <Text fontSize={0.14} color={hovered || active ? '#ffffff' : '#8a97b5'} anchorX="center" anchorY="middle">
          {tool.label}
        </Text>
      </Billboard>
    </group>
  )
}
