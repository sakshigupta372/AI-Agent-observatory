import { useState, useRef, useEffect } from 'react'
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
import Atmosphere from './Atmosphere.jsx'
import CameraRig from './CameraRig.jsx'
import SourceSatellites from './SourceSatellites.jsx'
import QueryOrbits from './QueryOrbits.jsx'
import Shockwave from './Shockwave.jsx'
import { useAgentExecution } from '../hooks/useAgentExecution.js'
import { playZone } from '../audio/zoneAudio.js'
import {
  NODES,
  TOOLS,
  CONNECTIONS,
  TOOL_CONNECTIONS,
  ZONES,
} from '../data/agentArchitecture.js'

const nodeById = Object.fromEntries(NODES.map((n) => [n.id, n]))
const toolById = Object.fromEntries(TOOLS.map((t) => [t.id, t]))
const positionOf = (id) => (nodeById[id] ?? toolById[id])?.position
const labelOf = (id) => (nodeById[id] ?? toolById[id])?.label ?? id

function connectionActive(a, b, activeConnection) {
  if (!activeConnection) return false
  const [x, y] = activeConnection
  return (a === x && b === y) || (a === y && b === x)
}

function focusIdFrom(exec) {
  if (exec.activeNodeId) return exec.activeNodeId
  if (exec.activeTool) return exec.activeTool
  if (exec.activeConnection) return exec.activeConnection[1]
  return null
}

function edgeInfo(a, b) {
  return {
    id: `${a}-${b}`,
    label: `${labelOf(a)} → ${labelOf(b)}`,
    status: 'LINK',
    description: 'Packets travel this path while that stage of the agent is running.',
    tech: `${a} → ${b}`,
  }
}

function scoreFor(id, confidence) {
  if (!confidence) return null
  if (id === 'intent') return confidence.intent
  if (id === 'toolhub' || toolById[id]) return confidence.tool
  if (id === 'llm' || id === 'response') return confidence.answer
  if (id === 'verifier') return confidence.verifier
  return null
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]))
}

export default function AgentScene() {
  const [hovered, setHovered] = useState(null)
  const [selected, setSelected] = useState(null)
  const [packets, setPackets] = useState([])
  const [memories, setMemories] = useState([])
  const [scrub, setScrub] = useState(null)
  const [soundOn, setSoundOn] = useState(false)
  const lastPacketKey = useRef(null)
  const replayLock = useRef(false)
  const controlsRef = useRef(null)

  const exec = useAgentExecution()
  const frame = scrub != null ? exec.frames[scrub] : null
  const view = frame ? { ...exec, ...frame } : exec
  const displayed = hovered || selected
  const focusId = focusIdFrom(view)
  const zone = focusId ? ZONES[focusId] : null
  const focusPos = focusId ? positionOf(focusId) : null
  const cameraActive = Boolean(focusPos && (exec.running || frame))

  useEffect(() => {
    fetch('/api/memory')
      .then((res) => res.json())
      .then((data) => setMemories(data.memories || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (exec.memorySnapshot) setMemories(exec.memorySnapshot)
  }, [exec.memorySnapshot])

  useEffect(() => {
    if (soundOn && focusId) playZone(focusId)
  }, [soundOn, focusId])

  useEffect(() => {
    const trig = exec.packetTrigger
    if (!trig || trig.key === lastPacketKey.current) return
    lastPacketKey.current = trig.key
    spawnPacket(trig.connection, trig.count || 1, trig.duration, trig.key)
  }, [exec.packetTrigger])

  const spawnPacket = (connection, count, duration, key) => {
    if (!connection) return
    const [a, b] = connection
    const from = positionOf(a)
    const to = positionOf(b)
    if (!from || !to) return
    const color = a === 'memory' || b === 'memory' ? '#ff8fd0' : a === 'toolhub' || b === 'toolhub' ? '#ffb168' : '#9fe8ff'
    const spawned = Array.from({ length: count }).map((_, i) => ({
      id: `${key}-${i}-${Math.random()}`,
      from,
      to,
      duration,
      delay: i * 120,
      color,
    }))
    setPackets((prev) => [...prev, ...spawned])
  }

  const removePacket = (id) => setPackets((prev) => prev.filter((p) => p.id !== id))

  const replay = async () => {
    if (replayLock.current || exec.running || exec.frames.length < 2) return
    replayLock.current = true
    for (let index = 0; index < exec.frames.length; index += 1) {
      setScrub(index)
      const step = exec.frames[index]
      if (step.activeConnection) spawnPacket(step.activeConnection, 1, 420, `replay-${index}`)
      await new Promise((resolve) => setTimeout(resolve, 420))
    }
    setScrub(null)
    replayLock.current = false
  }

  const exportMission = () => {
    const canvas = document.querySelector('.canvas-wrap canvas')
    let image = ''
    try {
      image = canvas?.toDataURL('image/png') || ''
    } catch {
      image = ''
    }
    const sources = (exec.sources || [])
      .map((source) => `<li><a href="${escapeHtml(source.url)}">${escapeHtml(source.title)}</a><em>${escapeHtml(source.publishedDate || 'no date published on this page')}</em></li>`)
      .join('')
    const trace = (exec.trace || [])
      .map((entry) => `<li>${escapeHtml(entry.event)} · ${entry.latency}ms</li>`)
      .join('')
    const html = `<!doctype html><meta charset="utf-8"><title>Observatory mission</title>
      <body style="font-family:Segoe UI,sans-serif;background:#070b14;color:#e8eefc;padding:32px">
      <h1>${escapeHtml(exec.query || 'Observatory mission')}</h1>
      ${image ? `<img alt="Observatory graph" src="${image}" style="max-width:100%;border-radius:16px">` : ''}
      <pre style="white-space:pre-wrap">${escapeHtml(exec.response || exec.error || '')}</pre>
      <h2>Sources</h2><ul>${sources}</ul>
      <h2>Trace</h2><ul>${trace}</ul>
      </body>`
    const blob = new Blob([html], { type: 'text/html' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'observatory-mission.html'
    link.click()
  }

  const sameEdge = (edge, other) => edge && other && edge[0] === other[0] && edge[1] === other[1]

  const zoomBy = (factor) => {
    const controls = controlsRef.current
    if (!controls) return
    const camera = controls.object
    const offset = camera.position.clone().sub(controls.target)
    const distance = Math.min(controls.maxDistance, Math.max(controls.minDistance, offset.length() * factor))
    offset.setLength(distance)
    camera.position.copy(controls.target).add(offset)
    controls.update()
  }

  return (
    <div className={`canvas-wrap${exec.running ? ' cinematic' : ''}`}>
      <Canvas camera={{ position: [0, 3, 14], fov: 50 }} gl={{ antialias: true, preserveDrawingBuffer: true }}>
        <color attach="background" args={['#05070d']} />
        <fog attach="fog" args={['#05070d', 12, 34]} />
        <Atmosphere color={zone?.color || null} />

        <ambientLight intensity={0.25} />
        <directionalLight position={[6, 10, 6]} intensity={0.5} color="#bcd4ff" />

        <Stars radius={60} depth={30} count={1500} factor={2} fade speed={0.4} />
        <ParticleField count={400} color={zone?.color || '#7fa8ff'} />

        {exec.ghostEdges.map((edge, index) => {
          const from = positionOf(edge[0])
          const to = positionOf(edge[1])
          if (!from || !to || sameEdge(edge, view.activeConnection)) return null
          return <Connection key={`ghost-${index}`} from={from} to={to} ghost />
        })}

        {CONNECTIONS.map(([a, b]) => (
          <Connection
            key={`${a}-${b}`}
            from={nodeById[a].position}
            to={nodeById[b].position}
            active={connectionActive(a, b, view.activeConnection)}
            dimmed={exec.running && !connectionActive(a, b, view.activeConnection)}
            onHover={(over) => setHovered(over ? edgeInfo(a, b) : null)}
          />
        ))}

        {TOOL_CONNECTIONS.map(([a, b]) => (
          <Connection
            key={`${a}-${b}`}
            from={nodeById[a].position}
            to={toolById[b].position}
            active={connectionActive(a, b, view.activeConnection)}
            dimmed={exec.running && !connectionActive(a, b, view.activeConnection)}
            color="#ffb168"
            onHover={(over) => setHovered(over ? edgeInfo(a, b) : null)}
          />
        ))}

        <MemorySpace
          center={nodeById.memory.position}
          trigger={exec.memoryTrigger}
          memories={memories}
          litIds={exec.memoryLitIds}
          onHover={setHovered}
          onSelect={setSelected}
        />
        <QueryOrbits center={nodeById.user.position} memories={memories} onRecall={exec.recall} onHover={setHovered} />
        <SourceSatellites
          origin={toolById.web_search.position}
          sources={exec.sources}
          onHover={setHovered}
          onSelect={(source) => {
            setSelected({
              id: source.url,
              label: 'SOURCE',
              status: source.publishedDate || 'NO DATE ON PAGE',
              description: source.title,
              tech: source.url,
            })
            spawnPacket([ 'web_search', 'response' ], 1, 900, source.url || source.title)
          }}
        />
        <PlannerTasks center={nodeById.planner.position} trigger={exec.plannerTrigger} />
        <Shockwave position={nodeById.llm.position} token={exec.shockKey} />

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
            active={view.activeNodeId === node.id}
            dimmed={Boolean(exec.running && focusId && focusId !== node.id)}
            confidence={scoreFor(node.id, exec.confidence)}
            selected={selected?.id === node.id}
            onHover={setHovered}
            onSelect={setSelected}
          />
        ))}

        {TOOLS.map((tool) => (
          <ToolNode
            key={tool.id}
            tool={tool}
            active={view.activeTool === tool.id}
            dimmed={Boolean(exec.running && focusId && focusId !== tool.id)}
            selected={selected?.id === tool.id}
            onHover={setHovered}
            onSelect={setSelected}
          />
        ))}

        <OrbitControls
          ref={controlsRef}
          makeDefault
          enablePan
          enableZoom
          enableRotate
          minDistance={5}
          maxDistance={28}
          autoRotate={!cameraActive}
          autoRotateSpeed={0.3}
          enableDamping
          dampingFactor={0.08}
        />
        <CameraRig focus={focusPos} active={cameraActive} />
      </Canvas>

      <div className="letterbox top" />
      <div className="letterbox bottom" />

      <div className="zoom-controls">
        <button type="button" aria-label="Zoom in" onClick={() => zoomBy(0.8)}>+</button>
        <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1.25)}>−</button>
      </div>

      {zone && (
        <div className="zone-badge" style={{ color: zone.color, borderColor: zone.color }}>
          {zone.name}
        </div>
      )}

      {exec.running && exec.streamText && (
        <div className="stream-dock">
          <span>LIVE REASONING</span>
          <p>{exec.streamText}</p>
        </div>
      )}

      <InfoPanel node={displayed} />
      <TracePanel trace={exec.trace} running={exec.running} />
      <MemoryStatsPanel stats={exec.memoryStats} />
      <ResponsePanel
        response={exec.running ? null : exec.response}
        error={exec.running ? null : exec.error}
        sources={exec.running ? [] : exec.sources}
        asOf={exec.asOf}
        verdicts={exec.verdicts}
      />
      <RunConsole
        running={exec.running}
        label={exec.label}
        onRun={exec.run}
        awaitingSteer={exec.awaitingSteer}
        onSteer={exec.steer}
        frames={exec.frames}
        onScrub={setScrub}
        onReplay={replay}
        soundOn={soundOn}
        onToggleSound={() => setSoundOn((value) => !value)}
        onExport={exportMission}
        canExport={Boolean(exec.response || exec.error)}
      />
    </div>
  )
}
