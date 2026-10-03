// Semantic clusters inside the 3D vector memory space. Point positions are
// generated with a seeded PRNG so the cloud is stable across re-renders
// instead of reshuffling every time the component mounts.

export const MEMORY_CLUSTERS = [
  { id: 'jobs', label: 'Jobs', color: '#ffb168', offset: [-1.3, 0.55, 0.1] },
  { id: 'users', label: 'Users', color: '#6ea8ff', offset: [1.2, 0.5, 0.35] },
  { id: 'projects', label: 'Projects', color: '#a78bff', offset: [-0.85, -0.65, 0.55] },
  { id: 'conversations', label: 'Conversations', color: '#8fd3ff', offset: [0.95, -0.55, -0.35] },
  { id: 'documents', label: 'Documents', color: '#ff8fd0', offset: [-0.05, 0.95, -0.65] },
  { id: 'preferences', label: 'Preferences', color: '#6effc7', offset: [0.15, -0.95, 0.75] },
]

const POINTS_PER_CLUSTER = 36
const SPREAD = 0.55

function seededRandom(seed) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

export function buildClusterGeometry(memoryCenter) {
  return MEMORY_CLUSTERS.map((cluster, ci) => {
    const rand = seededRandom(ci * 97 + 13)
    const center = [
      memoryCenter[0] + cluster.offset[0],
      memoryCenter[1] + cluster.offset[1],
      memoryCenter[2] + cluster.offset[2],
    ]
    const points = Array.from({ length: POINTS_PER_CLUSTER }, () => [
      center[0] + (rand() - 0.5) * SPREAD,
      center[1] + (rand() - 0.5) * SPREAD,
      center[2] + (rand() - 0.5) * SPREAD,
    ])
    return { ...cluster, center, points }
  })
}
