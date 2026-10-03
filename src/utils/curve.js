import * as THREE from 'three'

// Shared arc shape used by both the static Connection tubes and the
// traveling DataPacket, so packets ride exactly along the visible tube.
export function buildArcCurve(from, to) {
  const start = new THREE.Vector3(...from)
  const end = new THREE.Vector3(...to)
  const mid = start.clone().lerp(end, 0.5)
  mid.y += Math.abs(end.x - start.x) * 0.18 + 0.6
  return new THREE.CatmullRomCurve3([start, mid, end])
}
