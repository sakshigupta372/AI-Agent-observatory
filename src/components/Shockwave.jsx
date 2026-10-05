import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

export default function Shockwave({ position, token }) {
  const mesh = useRef()
  const seen = useRef(null)
  const started = useRef(0)

  useFrame((state) => {
    if (!mesh.current || !position || !token) return
    if (seen.current !== token) {
      seen.current = token
      started.current = state.clock.elapsedTime
      mesh.current.visible = true
    }
    const life = Math.min((state.clock.elapsedTime - started.current) / 1.15, 1)
    mesh.current.visible = life < 1
    mesh.current.position.set(position[0], position[1], position[2])
    mesh.current.scale.setScalar(0.3 + life * 3.4)
    mesh.current.material.opacity = (1 - life) * 0.75
  })

  return (
    <mesh ref={mesh} visible={false}>
      <sphereGeometry args={[0.42, 20, 20]} />
      <meshBasicMaterial color="#ff5d73" transparent opacity={0.7} wireframe />
    </mesh>
  )
}
