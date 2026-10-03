import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { buildClusterGeometry } from '../data/memoryClusters.js'

// Renders the semantic point clusters around the Memory node, and — when
// `trigger` fires — animates a query vector traveling into the relevant
// cluster and highlights its nearest (top-K) neighbors.
export default function MemorySpace({ center, trigger }) {
  const clusters = useMemo(() => buildClusterGeometry(center), [center])
  const groupRef = useRef()
  const searchRef = useRef()
  const highlightRefs = useRef([])

  const triggerKeyRef = useRef(null)
  const triggerStartRef = useRef(0)

  const activeCluster = useMemo(
    () => clusters.find((c) => c.id === trigger?.clusterId) ?? null,
    [clusters, trigger]
  )
  const topK = trigger?.topK ?? 5
  const highlightPoints = activeCluster ? activeCluster.points.slice(0, topK) : []

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.03
    }

    if (!trigger || !activeCluster) {
      if (searchRef.current) searchRef.current.visible = false
      highlightRefs.current.forEach((m) => m && (m.visible = false))
      return
    }

    if (triggerKeyRef.current !== trigger.key) {
      triggerKeyRef.current = trigger.key
      triggerStartRef.current = state.clock.elapsedTime
    }

    const elapsedMs = (state.clock.elapsedTime - triggerStartRef.current) * 1000
    const duration = trigger.duration ?? 700
    const searchPhaseEnd = duration * 0.45

    if (searchRef.current) {
      if (elapsedMs <= searchPhaseEnd) {
        const localT = Math.min(elapsedMs / searchPhaseEnd, 1)
        const p = new THREE.Vector3(...center).lerp(new THREE.Vector3(...activeCluster.center), localT)
        searchRef.current.position.copy(p)
        searchRef.current.visible = true
      } else {
        searchRef.current.visible = false
      }
    }

    const highlightVisible = elapsedMs > searchPhaseEnd && elapsedMs < duration
    highlightRefs.current.forEach((m) => {
      if (!m) return
      m.visible = highlightVisible
      if (highlightVisible) {
        m.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 10) * 0.15)
      }
    })
  })

  return (
    <group ref={groupRef}>
      {clusters.map((cluster) => (
        <group key={cluster.id}>
          <ClusterPointCloud points={cluster.points} color={cluster.color} />
          <Billboard position={[cluster.center[0], cluster.center[1] + 0.45, cluster.center[2]]}>
            <Text fontSize={0.1} color="#7f8fb5" anchorX="center" anchorY="middle">
              {cluster.label}
            </Text>
          </Billboard>
        </group>
      ))}

      {highlightPoints.map((p, i) => (
        <mesh key={i} position={p} ref={(el) => (highlightRefs.current[i] = el)} visible={false}>
          <sphereGeometry args={[0.065, 10, 10]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      ))}

      <mesh ref={searchRef} visible={false}>
        <sphereGeometry args={[0.08, 10, 10]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
    </group>
  )
}

function ClusterPointCloud({ points, color }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(points.length * 3)
    points.forEach((p, i) => {
      arr[i * 3] = p[0]
      arr[i * 3 + 1] = p[1]
      arr[i * 3 + 2] = p[2]
    })
    return arr
  }, [points])

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={points.length} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.045} color={color} transparent opacity={0.85} sizeAttenuation depthWrite={false} />
    </points>
  )
}
