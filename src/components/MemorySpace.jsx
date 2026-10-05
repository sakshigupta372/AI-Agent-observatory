import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { buildClusterGeometry } from '../data/memoryClusters.js'

export default function MemorySpace({ center, trigger, memories = [], litIds = [], onHover, onSelect }) {
  const clusters = useMemo(() => buildClusterGeometry(center), [center])
  const groupRef = useRef()
  const searchRef = useRef()
  const triggerKeyRef = useRef(null)
  const triggerStartRef = useRef(0)
  const lit = useMemo(() => new Set(litIds), [litIds])

  const activeCluster = useMemo(
    () => clusters.find((cluster) => cluster.id === trigger?.clusterId) ?? null,
    [clusters, trigger]
  )

  useFrame((state, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.03

    if (!trigger || !activeCluster || !searchRef.current) {
      if (searchRef.current) searchRef.current.visible = false
      return
    }

    if (triggerKeyRef.current !== trigger.key) {
      triggerKeyRef.current = trigger.key
      triggerStartRef.current = state.clock.elapsedTime
    }

    const elapsedMs = (state.clock.elapsedTime - triggerStartRef.current) * 1000
    const duration = trigger.duration ?? 700
    const searchPhaseEnd = duration * 0.55
    if (elapsedMs <= searchPhaseEnd) {
      const localT = Math.min(elapsedMs / searchPhaseEnd, 1)
      const point = new THREE.Vector3(...center).lerp(new THREE.Vector3(...activeCluster.center), localT)
      searchRef.current.position.copy(point)
      searchRef.current.visible = true
    } else {
      searchRef.current.visible = false
    }
  })

  return (
    <group ref={groupRef}>
      {clusters.map((cluster) => {
        const records = memories.filter((item) => item.clusterId === cluster.id)
        return (
          <group key={cluster.id}>
            <ClusterPointCloud points={cluster.points} color={cluster.color} />
            <mesh
              position={cluster.center}
              onPointerOver={(event) => {
                event.stopPropagation()
                document.body.style.cursor = 'pointer'
                onHover?.(clusterInfo(cluster, records))
              }}
              onPointerOut={(event) => {
                event.stopPropagation()
                document.body.style.cursor = 'auto'
                onHover?.(null)
              }}
              onClick={(event) => {
                event.stopPropagation()
                onSelect?.(clusterInfo(cluster, records))
              }}
            >
              <sphereGeometry args={[0.72, 14, 14]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            {records.map((record, index) => {
              const base = cluster.points[index % cluster.points.length]
              const position = [base[0], base[1] + 0.02, base[2]]
              const active = lit.has(record.id)
              return (
                <mesh
                  key={record.id}
                  position={position}
                  onPointerOver={(event) => {
                    event.stopPropagation()
                    document.body.style.cursor = 'pointer'
                    onHover?.(recordInfo(cluster, record))
                  }}
                  onPointerOut={(event) => {
                    event.stopPropagation()
                    document.body.style.cursor = 'auto'
                    onHover?.(null)
                  }}
                  onClick={(event) => {
                    event.stopPropagation()
                    onSelect?.(recordInfo(cluster, record))
                  }}
                >
                  <sphereGeometry args={[active ? 0.075 : 0.045, 10, 10]} />
                  <meshBasicMaterial color={active ? '#ffffff' : cluster.color} toneMapped={false} />
                </mesh>
              )
            })}
            <Billboard position={[cluster.center[0], cluster.center[1] + 0.48, cluster.center[2]]}>
              <Text fontSize={0.1} color="#7f8fb5" anchorX="center" anchorY="middle">
                {cluster.label}
              </Text>
            </Billboard>
          </group>
        )
      })}

      <mesh ref={searchRef} visible={false}>
        <sphereGeometry args={[0.08, 10, 10]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
    </group>
  )
}

function clusterInfo(cluster, records) {
  const preview = records
    .slice(-3)
    .reverse()
    .map((record) => record.summary)
  return {
    id: cluster.id,
    label: `${cluster.label} space`,
    status: records.length ? `${records.length} SAVED` : 'EMPTY',
    description: records.length
      ? 'Saved runs from this observatory. The bright points are the ones retrieved for the latest query.'
      : 'This neighborhood is empty. A finished run routed here will be stored as a point.',
    tech: preview.length ? preview.join(' · ') : 'No saved runs in this cluster yet.',
    memories: records.slice(-4).reverse(),
  }
}

function recordInfo(cluster, record) {
  return {
    id: record.id,
    label: cluster.label,
    status: new Date(record.createdAt).toLocaleString(),
    description: record.summary,
    tech: record.query,
  }
}

function ClusterPointCloud({ points, color }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(points.length * 3)
    points.forEach((point, index) => {
      arr[index * 3] = point[0]
      arr[index * 3 + 1] = point[1]
      arr[index * 3 + 2] = point[2]
    })
    return arr
  }, [points])

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={points.length} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.035} color={color} transparent opacity={0.35} sizeAttenuation depthWrite={false} />
    </points>
  )
}
