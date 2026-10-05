import { useMemo } from 'react'

function orbitsFrom(memories) {
  const seen = new Set()
  const items = []
  for (let index = memories.length - 1; index >= 0 && items.length < 8; index -= 1) {
    const memory = memories[index]
    if (!memory?.query || seen.has(memory.query)) continue
    seen.add(memory.query)
    items.push(memory)
  }
  return items
}

export default function QueryOrbits({ center, memories = [], onRecall, onHover }) {
  const orbits = useMemo(() => orbitsFrom(memories), [memories])
  if (!orbits.length) return null

  return (
    <group>
      {orbits.map((memory, index) => {
        const angle = (index / orbits.length) * Math.PI * 2
        const position = [
          center[0] + Math.cos(angle) * 1.7,
          center[1] + Math.sin(angle * 2) * 0.35,
          center[2] + Math.sin(angle) * 1.7,
        ]
        return (
          <mesh
            key={memory.id}
            position={position}
            onPointerOver={(event) => {
              event.stopPropagation()
              document.body.style.cursor = 'pointer'
              onHover?.({
                id: memory.id,
                label: 'PAST RUN',
                status: new Date(memory.createdAt).toLocaleString(),
                description: memory.query,
                tech: memory.summary,
              })
            }}
            onPointerOut={(event) => {
              event.stopPropagation()
              document.body.style.cursor = 'auto'
              onHover?.(null)
            }}
            onClick={(event) => {
              event.stopPropagation()
              onRecall?.(memory)
            }}
          >
            <icosahedronGeometry args={[0.12, 0]} />
            <meshBasicMaterial color="#6ea8ff" wireframe />
          </mesh>
        )
      })}
    </group>
  )
}
