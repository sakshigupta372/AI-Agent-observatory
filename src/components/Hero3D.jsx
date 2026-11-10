import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Float, Lightformer, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'

// Sky gradient painted onto a plane behind the objects so the glass has
// something to refract (a CSS background is invisible to transmission).
function SkyBackdrop() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 512
    const ctx = canvas.getContext('2d')
    const grad = ctx.createLinearGradient(0, 0, 0, 512)
    grad.addColorStop(0, '#b9d5f5')
    grad.addColorStop(0.45, '#7fa8e0')
    grad.addColorStop(1, '#4f80c6')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 32, 512)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])
  return (
    <mesh position={[0, 0, -6]} scale={[40, 22, 1]}>
      <planeGeometry />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  )
}

function Glass({ color = '#ffffff', roughness = 0, thickness = 0.7, ...props }) {
  return (
    <meshPhysicalMaterial
      color={color}
      transmission={1}
      roughness={roughness}
      thickness={thickness}
      ior={1.45}
      clearcoat={1}
      clearcoatRoughness={0.1}
      attenuationColor={color}
      attenuationDistance={6}
      iridescence={0.5}
      iridescenceIOR={1.3}
      specularIntensity={1}
      envMapIntensity={1.4}
      {...props}
    />
  )
}

function Ceramic({ color }) {
  return <meshPhysicalMaterial color={color} roughness={0.32} clearcoat={1} clearcoatRoughness={0.15} sheen={0.6} sheenColor="#ffffff" />
}

const BEADS = [
  [-0.9, 1.5, 0.6, 0.11, '#ffffff'],
  [0.8, 1.75, -0.4, 0.08, '#ffe3c8'],
  [2.1, -0.1, 0.7, 0.1, '#ffffff'],
  [-2.1, -0.6, 0.9, 0.07, '#d9ccff'],
]

function Composition() {
  const group = useRef()
  useFrame((state, delta) => {
    const g = group.current
    if (!g) return
    const targetY = state.pointer.x * 0.25
    const targetX = -state.pointer.y * 0.12
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, targetY, 3, delta)
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, targetX, 3, delta)
  })

  return (
    <group ref={group} position={[1.75, -0.35, 0]} scale={0.72}>
      {/* frosted pedestals */}
      <RoundedBox args={[1.6, 0.9, 1.4]} radius={0.12} position={[0, -0.95, 0]}>
        <Glass color="#eef4ff" roughness={0.35} thickness={2} />
      </RoundedBox>
      <RoundedBox args={[1.1, 0.55, 1.1]} radius={0.1} position={[-1.35, -1.12, 0.3]}>
        <Glass color="#e6f7f1" roughness={0.3} thickness={1.6} />
      </RoundedBox>
      <RoundedBox args={[1, 1.3, 1]} radius={0.1} position={[1.3, -0.75, -0.3]}>
        <Glass color="#f3eefc" roughness={0.4} thickness={2} />
      </RoundedBox>

      {/* the retry loop */}
      <Float speed={1.6} rotationIntensity={0.6} floatIntensity={0.6}>
        <mesh position={[-0.05, 0.6, 0]} rotation={[0.3, 0.5, 0.2]}>
          <torusGeometry args={[0.62, 0.22, 48, 120]} />
          <Ceramic color="#f2c7a0" />
        </mesh>
      </Float>

      {/* planner */}
      <Float speed={2} rotationIntensity={0.3} floatIntensity={0.8}>
        <mesh position={[1.35, 0.4, -0.2]}>
          <sphereGeometry args={[0.45, 64, 64]} />
          <Glass color="#ffffff" thickness={1.8} />
        </mesh>
      </Float>

      {/* fact-checker */}
      <Float speed={1.4} rotationIntensity={1.2} floatIntensity={0.5}>
        <mesh position={[-1.35, -0.45, 0.35]}>
          <icosahedronGeometry args={[0.42, 0]} />
          <Glass color="#b8f0dc" thickness={1.2} />
        </mesh>
      </Float>

      {/* memory */}
      <Float speed={1.8} rotationIntensity={0.8} floatIntensity={0.9}>
        <mesh position={[-2.4, 0.5, -0.6]} rotation={[0, 0, 0.6]}>
          <capsuleGeometry args={[0.18, 0.55, 16, 32]} />
          <Ceramic color="#f4b6c9" />
        </mesh>
      </Float>

      {BEADS.map(([x, y, z, r, color], i) => (
        <Float key={i} speed={2.5} floatIntensity={1.4} rotationIntensity={0}>
          <mesh position={[x, y, z]}>
            <sphereGeometry args={[r, 32, 32]} />
            <Glass color={color} thickness={0.4} />
          </mesh>
        </Float>
      ))}

      {/* tool */}
      <Float speed={1.2} rotationIntensity={1.5} floatIntensity={0.7}>
        <mesh position={[2.45, 0.9, -0.8]} scale={0.32}>
          <torusKnotGeometry args={[0.8, 0.28, 160, 24]} />
          <Glass color="#bfe4ff" thickness={1.4} />
        </mesh>
      </Float>

    </group>
  )
}

export default function Hero3D() {
  return (
    <Canvas
      className="hero-3d"
      dpr={[1, 1.6]}
      camera={{ position: [0, 0.4, 6.2], fov: 38 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <SkyBackdrop />
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 4]} intensity={1.6} />
      <Composition />
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={3} position={[0, 5, -2]} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={2} position={[-5, 1, 1]} rotation-y={Math.PI / 2} scale={[8, 2, 1]} />
        <Lightformer form="rect" intensity={2} position={[5, 1, 1]} rotation-y={-Math.PI / 2} scale={[8, 2, 1]} />
        <Lightformer form="ring" color="#ffe1c4" intensity={2.5} position={[2, 3, 4]} scale={2} />
      </Environment>
    </Canvas>
  )
}
