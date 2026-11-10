import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

const EVERY_N_FRAMES = 4
const GAP = 3

// Screen-space pass over the DOM node labels: when two overlap, the lower one
// stays and the upper one is lifted just clear of it. Active labels never move.
export default function LabelDeconflict() {
  const { gl } = useThree()
  const frame = useRef(0)

  useFrame(() => {
    frame.current += 1
    if (frame.current % EVERY_N_FRAMES) return
    const root = gl.domElement.parentElement?.parentElement
    if (!root) return
    const labels = [...root.querySelectorAll('.node-label')].filter((el) => el.offsetWidth > 0)
    // Measure the wrapper drei positions, not the label itself, so an in-flight
    // translate transition never feeds back into the layout.
    const boxes = labels.map((el) => {
      const r = (el.parentElement || el).getBoundingClientRect()
      return { el, shift: Number(el.dataset.shift || 0), left: r.left, right: r.right, top: r.top, bottom: r.bottom, fixed: el.classList.contains('active') }
    })
    boxes.sort((a, b) => (a.fixed === b.fixed ? b.bottom - a.bottom : a.fixed ? -1 : 1))

    const placed = []
    for (const box of boxes) {
      let top = box.top
      let bottom = box.bottom
      if (!box.fixed) {
        let moved = true
        while (moved) {
          moved = false
          for (const other of placed) {
            const overlapX = box.left < other.right + GAP && box.right > other.left - GAP
            const overlapY = top < other.bottom + GAP && bottom > other.top - GAP
            if (overlapX && overlapY) {
              const lift = bottom - (other.top - GAP)
              top -= lift
              bottom -= lift
              moved = true
            }
          }
        }
      }
      placed.push({ left: box.left, right: box.right, top, bottom })
      const shift = Math.round(top - box.top)
      if (shift !== box.shift) {
        box.el.dataset.shift = String(shift)
        box.el.style.transform = shift ? `translateY(${shift}px)` : ''
      }
    }
  })

  return null
}
