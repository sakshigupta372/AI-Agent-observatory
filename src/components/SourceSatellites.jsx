import { useMemo } from 'react'
import { Billboard, Text } from '@react-three/drei'

function place(origin, index, total) {
  const angle = (index / Math.max(total, 1)) * Math.PI * 2 - Math.PI / 2
  return [
    origin[0] + Math.cos(angle) * 1.25,
    origin[1] + 0.55 + (index % 2) * 0.28,
    origin[2] + Math.sin(angle) * 1.25,
  ]
}

export default function SourceSatellites({ origin, sources = [], onHover, onSelect }) {
  const placed = useMemo(
    () => sources.slice(0, 6).map((source, index) => ({ ...source, position: place(origin, index, Math.min(sources.length, 6)) })),
    [origin, sources]
  )
  if (!placed.length) return null

  return (
    <group>
      {placed.map((source) => (
        <mesh
          key={source.url || source.title}
          position={source.position}
          onPointerOver={(event) => {
            event.stopPropagation()
            document.body.style.cursor = 'pointer'
            onHover?.({
              id: source.url,
              label: 'SOURCE',
              status: source.publishedDate || 'NO DATE ON PAGE',
              description: source.title,
              tech: source.url,
            })
          }}
          onPointerOut={(event) => {
            event.stopPropagation()
            document.body.style.cursor = 'auto'
            onHover?.(null)
          }}
          onClick={(event) => {
            event.stopPropagation()
            onSelect?.(source)
          }}
        >
          <sphereGeometry args={[0.12, 12, 12]} />
          <meshBasicMaterial color="#ffb168" toneMapped={false} />
          <Billboard position={[0, 0.22, 0]}>
            <Text fontSize={0.07} color="#ffd7b0" anchorX="center" maxWidth={1.4}>
              {(source.title || 'Source').slice(0, 42)}
            </Text>
          </Billboard>
        </mesh>
      ))}
    </group>
  )
}
