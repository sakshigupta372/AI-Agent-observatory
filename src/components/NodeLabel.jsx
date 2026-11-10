import { Html } from '@react-three/drei'

// DOM label pinned above a node: always faces the camera, keeps one font size
// at any zoom, and sits low in the stacking order so panels stay on top.
// short replaces the text on narrow canvases; tool labels there only show when active or hovered.
export default function NodeLabel({ text, short, offset, state = 'idle', score = null, tool = false }) {
  return (
    <Html position={offset} center zIndexRange={[3, 0]} pointerEvents="none" wrapperClass="node-label-wrap">
      <span className={`node-label ${state}${tool ? ' tool' : ''}`}>
        <span className={short ? 'full' : undefined}>{text}</span>
        {short && <span className="short" aria-hidden="true">{short}</span>}
        {score != null && <b title="Claims backed by the sources">{score}</b>}
      </span>
    </Html>
  )
}
