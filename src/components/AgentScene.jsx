import { useState, useMemo, useRef, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import AgentNode from './AgentNode.jsx'
import ToolNode from './ToolNode.jsx'
import Connection from './Connection.jsx'
import ParticleField from './ParticleField.jsx'
import InfoPanel from './InfoPanel.jsx'
import DataPacket from './DataPacket.jsx'
import RunConsole from './RunConsole.jsx'
import ResponsePanel from './ResponsePanel.jsx'
import TracePanel from './TracePanel.jsx'
import MemorySpace from './MemorySpace.jsx'
import MemoryStatsPanel from './MemoryStatsPanel.jsx'
import PlannerTasks from './PlannerTasks.jsx'
import { useAgentExecution } from '../hooks/useAgentExecution.js'
import {
  NODES,
  TOOLS,
  CONNECTIONS,
  TOOL_CONNECTIONS,
} from '../data/agentArchitecture.js'

const nodeById = Object.fromEntries(NODES.map((n) => [n.id, n]))
const toolById = Object.fromEntries(TOOLS.map((t) => [t.id, t]))
const positionOf = (id) => (nodeById[id] ?? toolById[id]).position

// A connection is active if it matches the execution engine's current
// edge, regardless of direction (tool results travel back toward the hub).
function connectionActive(a, b, activeConnection) {
  if (!activeConnection) return false
  const [x, y] = activeConnection
  return (a === x && b === y) || (a === y && b === x)
}

export default function AgentScene() {
  const [hovered, setHovered] = useState(null)
  const [selected, setSelected] = useState(null)
  const [packets, setPackets] = useState([])
  const lastPacketKey = useRef(null)

  const exec = useAgentExecution()
  const displayed = hovered || selected

  useEffect(() => {
    const trig = exec.packetTrigger
    if (!trig || trig.key === lastPacketKey.current) return
    lastPacketKey.current = trig.key

    const [a, b] = trig.connection
    const from = positionOf(a)
    const to = positionOf(b)
    const color =
      a === 'memory' || b === 'memory'
        ? '#ff8fd0'
        : a === 'toolhub' || b === 'toolhub'
        ? '#ffb168'
        : '#9fe8ff'

    const spawned = Array.from({ length: trig.count }).map((_, i) => ({
      id: `${trig.key}-${i}`,
      from,
      to,
      duration: trig.duration,
      delay: i * 130,
      color,
    }))
    setPackets((prev) => [...prev, ...spawned])
  }, [exec.packetTrigger])

  const removePacket = (id) => setPackets((prev) => prev.filter((p) => p.id !== id))

  return (
    <div className="canvas-wrap">
      <Canvas
        camera={{ position: [0, 3, 14], fov: 50 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#05070d']} />
        <fog attach="fog" args={['#05070d', 12, 34]} />

        <ambientLight intensity={0.25} />
        <directionalLight position={[6, 10, 6]} intensity={0.5} color="#bcd4ff" />

        <Stars radius={60} depth={30} count={1500} factor={2} fade speed={0.4} />
        <ParticleField count={400} />

        {CONNECTIONS.map(([a, b]) => (
          <Connection
            key={`${a}-${b}`}
            from={nodeById[a].position}
            to={nodeById[b].position}
            active={connectionActive(a, b, exec.activeConnection)}
          />
        ))}

        {TOOL_CONNECTIONS.map(([a, b]) => (
          <Connection
            key={`${a}-${b}`}
            from={nodeById[a].position}
            to={toolById[b].position}
            active={connectionActive(a, b, exec.activeConnection)}
            color="#ffb168"
          />
        ))}

        <MemorySpace center={nodeById.memory.position} trigger={exec.memoryTrigger} />
        <PlannerTasks center={nodeById.planner.position} trigger={exec.plannerTrigger} />

        {packets.map((p) => (
          <DataPacket
            key={p.id}
            from={p.from}
            to={p.to}
            duration={p.duration}
            delay={p.delay}
            color={p.color}
            onComplete={() => removePacket(p.id)}
          />
        ))}

        {NODES.map((node) => (
          <AgentNode
            key={node.id}
            node={node}
            active={exec.activeNodeId === node.id}
            selected={selected?.id === node.id}
            onHover={setHovered}
            onSelect={setSelected}
          />
        ))}

        {TOOLS.map((tool) => (
          <ToolNode
            key={tool.id}
            tool={tool}
            active={exec.activeTool === tool.id}
            selected={selected?.id === tool.id}
            onHover={setHovered}
            onSelect={setSelected}
          />
        ))}

        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          minDistance={5}
          maxDistance={28}
          autoRotate={!exec.running}
          autoRotateSpeed={0.3}
          enableDamping
          dampingFactor={0.08}
        />
      </Canvas>

      <InfoPanel node={displayed} />
      <TracePanel trace={exec.trace} running={exec.running} />
      <MemoryStatsPanel stats={exec.memoryStats} />
      <ResponsePanel response={exec.response} />
      <RunConsole
        running={exec.running}
        label={exec.label}
        onRun={exec.run}
      />
    </div>
  )
}
