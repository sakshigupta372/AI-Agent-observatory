import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const Y = new THREE.Vector3(0, 1, 0)
const DEFAULT_DIR = new THREE.Vector3(0, 3, 14).normalize()
// Portrait canvases look down more steeply so the graph's depth fills the height.
const PORTRAIT_DIR = new THREE.Vector3(0, 0.62, 0.78).normalize()
const SWAY = 0.22
const YAW_SAMPLES = 9

// Smallest camera distance that keeps every point inside the frustum for every
// yaw the idle sway can reach, so the motion never pushes a node off screen.
function fitDistance(points, center, dir, fov, aspect, padding, usableHeight, swing) {
  const tanV = Math.tan(THREE.MathUtils.degToRad(fov) / 2) * usableHeight
  const tanH = tanV * aspect
  const view = new THREE.Vector3()
  const forward = new THREE.Vector3()
  const right = new THREE.Vector3()
  const up = new THREE.Vector3()
  const rel = new THREE.Vector3()
  let best = 0
  const samples = swing > 0 ? YAW_SAMPLES : 1
  for (let i = 0; i < samples; i += 1) {
    view.copy(dir).applyAxisAngle(Y, samples > 1 ? -swing + (2 * swing * i) / (samples - 1) : 0)
    forward.copy(view).negate()
    right.crossVectors(forward, Y).normalize()
    up.crossVectors(right, forward).normalize()
    for (const point of points) {
      rel.set(point[0] - center.x, point[1] - center.y, point[2] - center.z)
      const need = rel.dot(view) + Math.max(Math.abs(rel.dot(right)) / tanH, Math.abs(rel.dot(up)) / tanV) * padding
      if (need > best) best = need
    }
  }
  return best
}

// insetPx: space kept clear at the top and bottom of the canvas for the toolbar and legend.
export default function CameraRig({ points, focus, follow, sway = true, fitKey = 0, reducedMotion = false, insetPx = 0 }) {
  const { camera, controls, size } = useThree()
  const goal = useRef(null)
  const fitted = useRef(false)
  const angle = useRef(0)
  const look = useRef(new THREE.Vector3())
  const desired = useRef(new THREE.Vector3())
  const swayBase = useRef(null)
  const swayClock = useRef(0)
  const resting = useRef(0)

  const center = useMemo(() => {
    const box = new THREE.Box3()
    for (const point of points) box.expandByPoint(new THREE.Vector3(...point))
    return box.getCenter(new THREE.Vector3())
  }, [points])

  const fit = (instant) => {
    if (!controls) return
    const offset = camera.position.clone().sub(controls.target)
    const aspect = size.width / Math.max(1, size.height)
    const portrait = aspect < 0.9
    const dir = portrait ? PORTRAIT_DIR.clone() : offset.lengthSq() > 0.0001 ? offset.normalize() : DEFAULT_DIR.clone()
    const padding = portrait ? 1.08 : 1.06
    const usableHeight = Math.max(0.5, 1 - (2 * insetPx) / Math.max(1, size.height))
    const distance = fitDistance(points, center, dir, camera.fov, aspect, padding, usableHeight, portrait ? 0 : SWAY)
    controls.maxDistance = Math.max(28, distance * 1.8)
    controls.minDistance = 4
    const position = center.clone().add(dir.multiplyScalar(distance))
    swayBase.current = null
    resting.current = 0
    if (instant || reducedMotion) {
      camera.position.copy(position)
      controls.target.copy(center)
      controls.update()
      goal.current = null
    } else {
      goal.current = { position, target: center.clone() }
    }
  }

  useEffect(() => {
    if (!controls) return
    fit(!fitted.current)
    fitted.current = true
    // Manual orbit or zoom cancels a fit still animating, and the idle sway
    // restarts around wherever the user left the camera.
    const cancel = () => {
      goal.current = null
      swayBase.current = null
      resting.current = 0
    }
    controls.addEventListener('start', cancel)
    return () => controls.removeEventListener('start', cancel)
  }, [controls, size.width, size.height, fitKey, center, insetPx])

  const following = Boolean(follow && focus)
  const wasFollowing = useRef(false)
  useEffect(() => {
    if (wasFollowing.current && !following) fit(false)
    wasFollowing.current = following
  }, [following])

  useFrame((_, delta) => {
    if (!controls) return
    if (following) {
      angle.current += delta * (reducedMotion ? 0 : 0.18)
      look.current.set(focus[0], focus[1], focus[2])
      desired.current.set(focus[0] + Math.sin(angle.current) * 1.5, focus[1] + 1.55, focus[2] + 6.1)
      controls.target.lerp(look.current, 0.08)
      camera.position.lerp(desired.current, 0.06)
      controls.update()
      return
    }
    if (goal.current) {
      const k = 1 - Math.exp(-delta * 6)
      camera.position.lerp(goal.current.position, k)
      controls.target.lerp(goal.current.target, k)
      controls.update()
      if (camera.position.distanceToSquared(goal.current.position) < 0.0004) goal.current = null
      return
    }
    // Portrait canvases have no side room to spare, so they stay still.
    if (!sway || reducedMotion || size.width < size.height * 0.9) return
    resting.current += delta
    if (resting.current < 1.5) return
    if (swayBase.current == null) {
      swayBase.current = controls.getAzimuthalAngle()
      swayClock.current = 0
    }
    swayClock.current += delta
    controls.setAzimuthalAngle(swayBase.current + Math.sin(swayClock.current * 0.12) * SWAY)
    controls.update()
  })

  return null
}
