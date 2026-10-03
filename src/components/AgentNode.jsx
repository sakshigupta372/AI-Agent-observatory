import { useRef, useState, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'

// A single holographic "core" representing one component of the agent
// pipeline. Built from a faceted icosahedron shell + inner glowing core +
// a rotating ring, so it reads as a machine rather than a plain sphere.
export default function AgentNode({ node, active, onHover, onSelect, selected }) {
  const group = useRef()
  const ring = useRef()
  const shell = useRef()
  const [hovered, setHovered] = useState(false)

  const color = useMemo(() => new THREE.Color(node.color), [node.color])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    if (ring.current) {
      ring.current.rotation.z += delta * (active ? 1.4 : 0.3)
      ring.current.rotation.x = Math.PI / 2.4 + Math.sin(t * 0.3) * 0.05
    }
    if (shell.current) {
      shell.current.rotation.y += delta * (active ? 0.6 : 0.15)
    }
    if (group.current) {
      const targetScale = hovered || selected ? 1.18 : 1
      group.current.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        0.15
      )
      // gentle idle bob
      group.current.position.y =
        node.position[1] + Math.sin(t * 0.6 + node.position[0]) * 0.08
    }
  })

  const emissiveIntensity = active ? 2.2 : hovered ? 1.4 : 0.6

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
      {/* Inner glowing core */}
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

      {/* Outer wireframe shell */}
      <mesh ref={shell}>
        <icosahedronGeometry args={[0.62, 1]} />
        <meshBasicMaterial
          color={color}
          wireframe
          transparent
          opacity={active ? 0.9 : 0.35}
        />
      </mesh>

      {/* Rotating orbit ring */}
      <mesh ref={ring} rotation={[Math.PI / 2.4, 0, 0]}>
        <torusGeometry args={[0.85, 0.012, 8, 64]} />
        <meshBasicMaterial color={color} transparent opacity={active ? 0.95 : 0.4} toneMapped={false} />
      </mesh>

      {/* Point light to cast glow onto fog/particles nearby */}
      <pointLight color={color} intensity={active ? 3 : 1} distance={4} decay={2} />

      {/* Label */}
      <Billboard position={[0, 1.05, 0]}>
        <Text
          fontSize={0.22}
          color={hovered || selected || active ? '#ffffff' : '#9fb3d9'}
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.05}
        >
          {node.label}
        </Text>
      </Billboard>
    </group>
  )
}
