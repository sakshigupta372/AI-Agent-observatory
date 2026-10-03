import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Billboard, Line } from '@react-three/drei'
import * as THREE from 'three'

const PENDING_COLOR = new THREE.Color('#3a4766')
const ACTIVE_COLOR = new THREE.Color('#a78bff')
const DONE_COLOR = new THREE.Color('#6effc7')

function arrangeTasks(center, count) {
  const spread = Math.min(0.62 * (count - 1), 3.2)
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0.5 : i / (count - 1)
    const x = center[0] - spread / 2 + t * spread
    const y = center[1] - 1.35 + Math.sin(t * Math.PI) * 0.22
    const z = center[2] + 1.15
    return [x, y, z]
  })
}

// Decomposes the Planner's current request into a sequence of floating task
// cards. As `trigger` progresses, tasks highlight in order, pulse while
// "executing", and settle into a completed (checked) state, with a small
// glowing marker traveling to the next task — visually communicating that
// the agent is breaking a complex request into executable steps.
export default function PlannerTasks({ center, trigger }) {
  const nodeRefs = useRef([])
  const checkRefs = useRef([])
  const packetRef = useRef()
  const triggerKeyRef = useRef(null)
  const triggerStartRef = useRef(0)

  const tasks = trigger?.tasks ?? []
  const positions = useMemo(() => arrangeTasks(center, tasks.length || 1), [center, tasks.length])

  useFrame((state) => {
    if (!trigger || tasks.length === 0) return

    if (triggerKeyRef.current !== trigger.key) {
      triggerKeyRef.current = trigger.key
      triggerStartRef.current = state.clock.elapsedTime
    }

    const elapsedMs = (state.clock.elapsedTime - triggerStartRef.current) * 1000
    const duration = trigger.duration ?? 1000
    const perTask = duration / tasks.length
    const rawIndex = Math.floor(elapsedMs / perTask)
    const activeIndex = Math.min(tasks.length - 1, rawIndex)
    const progressInTask = Math.min(1, (elapsedMs % perTask) / perTask)
    const allDone = rawIndex >= tasks.length

    nodeRefs.current.forEach((mesh, i) => {
      if (!mesh) return
      const done = allDone || i < activeIndex || (i === activeIndex && progressInTask > 0.82)
      const active = !done && i === activeIndex

      if (done) {
        mesh.material.color.copy(DONE_COLOR)
        mesh.material.emissiveIntensity = 0.9
        mesh.scale.setScalar(1)
      } else if (active) {
        mesh.material.color.copy(ACTIVE_COLOR)
        mesh.material.emissiveIntensity = 1.7
        const pulse = 1 + Math.sin(state.clock.elapsedTime * 8) * 0.14
        mesh.scale.setScalar(pulse)
      } else {
        mesh.material.color.copy(PENDING_COLOR)
        mesh.material.emissiveIntensity = 0.25
        mesh.scale.setScalar(0.82)
      }

      if (checkRefs.current[i]) {
        checkRefs.current[i].visible = done
      }
    })

    if (packetRef.current) {
      const nextIndex = activeIndex + 1
      if (!allDone && nextIndex < tasks.length && progressInTask > 0.6) {
        const localT = (progressInTask - 0.6) / 0.4
        const from = new THREE.Vector3(...positions[activeIndex])
        const to = new THREE.Vector3(...positions[nextIndex])
        packetRef.current.visible = true
        packetRef.current.position.copy(from.lerp(to, Math.min(localT, 1)))
      } else {
        packetRef.current.visible = false
      }
    }
  })

  if (tasks.length === 0) return null

  return (
    <group>
      {positions.slice(0, -1).map((pos, i) => (
        <Line key={i} points={[pos, positions[i + 1]]} color="#5a6a90" lineWidth={1} transparent opacity={0.45} />
      ))}

      {positions.map((pos, i) => (
        <group key={i} position={pos}>
          <mesh ref={(el) => (nodeRefs.current[i] = el)}>
            <octahedronGeometry args={[0.15, 0]} />
            <meshStandardMaterial
              color={PENDING_COLOR}
              emissive={PENDING_COLOR}
              emissiveIntensity={0.25}
              roughness={0.4}
              metalness={0.4}
              toneMapped={false}
            />
          </mesh>

          <Billboard position={[0, 0.3, 0]} visible={false} ref={(el) => (checkRefs.current[i] = el)}>
            <Text fontSize={0.16} color="#6effc7" anchorX="center" anchorY="middle">
              {'✓'}
            </Text>
          </Billboard>

          <Billboard position={[0, -0.26, 0]}>
            <Text
              fontSize={0.082}
              color="#9fb3d9"
              anchorX="center"
              anchorY="middle"
              maxWidth={1.1}
              textAlign="center"
            >
              {tasks[i]}
            </Text>
          </Billboard>
        </group>
      ))}

      <mesh ref={packetRef} visible={false}>
        <sphereGeometry args={[0.05, 10, 10]} />
        <meshBasicMaterial color="#a78bff" toneMapped={false} />
      </mesh>
    </group>
  )
}
