import { useState, useRef, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import { Crosshair, History, Keyboard, Maximize2, Minus, Plus, Route, Share2 } from 'lucide-react'
import AgentNode from './AgentNode.jsx'
import ToolNode from './ToolNode.jsx'
import Connection from './Connection.jsx'
import ParticleField from './ParticleField.jsx'
import InfoPanel from './InfoPanel.jsx'
import DataPacket from './DataPacket.jsx'
import RunConsole from './RunConsole.jsx'
import SpanInspector from './SpanInspector.jsx'
import MemorySpace from './MemorySpace.jsx'
import PlannerTasks from './PlannerTasks.jsx'
import Atmosphere from './Atmosphere.jsx'
import CameraRig from './CameraRig.jsx'
import SourceSatellites from './SourceSatellites.jsx'
import QueryOrbits from './QueryOrbits.jsx'
import Shockwave from './Shockwave.jsx'
import TutorialOverlay from './TutorialOverlay.jsx'
import QueryHistory from './QueryHistory.jsx'
import ShareButton from './ShareButton.jsx'
import GuidedDemo from './GuidedDemo.jsx'
import Legend from './Legend.jsx'
import LabelDeconflict from './LabelDeconflict.jsx'
import RunNarration from './RunNarration.jsx'
import SiteHeader from './SiteHeader.jsx'
import { demoById } from '../data/demos.js'
import { useKeyboardShortcuts, KeyboardShortcutsHelp } from '../hooks/useKeyboardShortcuts.jsx'
import { useAgentExecution } from '../hooks/useAgentExecution.js'
import { useQueryHistory } from '../hooks/useQueryHistory.js'
import { useReducedMotion } from '../hooks/useReducedMotion.js'
import { playZone } from '../audio/zoneAudio.js'
import '../styles/observatory.css'
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

const offsetBy = (p, dx, dy, dz = 0) => [p[0] + dx, p[1] + dy, p[2] + dz]

// How far the graph can be turned to either side of the front view (65°, in
// radians). The pipeline reads left to right, so the orbit stops before the
// graph turns back to front.
const MAX_ORBIT = (65 * Math.PI) / 180

// Everything the camera must keep in frame: each node, its label (with some
// width), and the memory point clouds around the memory node.
const FIT_POINTS = [
  ...NODES.flatMap((node) => {
    const top = node.id === 'memory' ? 2.15 : 1.35
    return [offsetBy(node.position, 0, -0.9), offsetBy(node.position, -1.1, top), offsetBy(node.position, 1.1, top)]
  }),
  ...TOOLS.flatMap((tool) => [offsetBy(tool.position, 0, -0.4), offsetBy(tool.position, -0.8, 0.9), offsetBy(tool.position, 0.8, 0.9)]),
  ...[[-1.9, 0, 0], [1.8, 0, 0], [0, 1.5, 0], [0, -1.5, 0], [0, 0, 1.4], [0, 0, -1.4]].map(([x, y, z]) => offsetBy(nodeById.memory.position, x, y, z)),
]

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

// Only the fact-check support rate is measured; the server's other confidence
// numbers are fixed heuristics, so they are not shown on the map.
function scoreFor(id, exec) {
  if (!exec.confidence || !exec.verdicts?.length) return null
  if (id === 'verifier' || id === 'response') return exec.confidence.verifier
  return null
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]))
}

function ToolButton({ label, onClick, pressed, disabled, children, badge }) {
  return (
    <button type="button" className="obs-tool" aria-label={label} title={label} onClick={onClick} aria-pressed={pressed} disabled={disabled}>
      {children}
      {badge ? <span className="obs-tool-badge">{badge}</span> : null}
    </button>
  )
}

export default function AgentScene() {
  const [hovered, setHovered] = useState(null)
  const [selected, setSelected] = useState(null)
  const [packets, setPackets] = useState([])
  const [memories, setMemories] = useState([])
  const [scrub, setScrub] = useState(null)
  const [soundOn, setSoundOn] = useState(false)
  const [inspectOpen, setInspectOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [prefill, setPrefill] = useState(null)
  const [demoParam, setDemoParam] = useState(() => new URLSearchParams(window.location.search).get('demo'))
  const [details, setDetails] = useState(() => localStorage.getItem('observatory_details') === '1')
  const [follow, setFollow] = useState(() => localStorage.getItem('observatory_follow') === '1')
  const [fitKey, setFitKey] = useState(0)
  const [tourKey, setTourKey] = useState(0)
  const reducedMotion = useReducedMotion()
  const demoOpen = demoParam !== null
  const lastPacketKey = useRef(null)
  const replayLock = useRef(false)
  const controlsRef = useRef(null)
  const queryInputRef = useRef(null)
  const lastHistoryId = useRef(null)

  const exec = useAgentExecution()
  const { history, addToHistory, clearHistory } = useQueryHistory()
  const frame = scrub != null ? exec.frames[scrub] : null
  const view = frame ? { ...exec, ...frame } : exec
  const displayed = hovered || selected
  const focusId = focusIdFrom(view)
  const zone = focusId ? ZONES[focusId] : null
  const focusPos = focusId ? positionOf(focusId) : null
  const highlighting = Boolean((exec.running || frame) && focusId)

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
    const id = exec.runTrace?.id
    if (exec.running || !id || id === lastHistoryId.current) return
    lastHistoryId.current = id
    addToHistory({
      query: exec.query,
      tool: exec.runTrace?.tool,
      result: exec.response || exec.error || '',
    })
  }, [exec.running, exec.runTrace, exec.query, exec.response, exec.error, addToHistory])

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
    if (!connection || reducedMotion) return
    const [a, b] = connection
    const from = positionOf(a)
    const to = positionOf(b)
    if (!from || !to) return
    const feedback = a === 'verifier' && b === 'planner'
    const color = feedback ? '#ff7a8a' : (nodeById[b] ?? toolById[b])?.color || '#9fe8ff'
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

  const handleSelectQuery = (query) => {
    setPrefill({ text: query, id: Date.now() })
    queryInputRef.current?.focus()
    setHistoryOpen(false)
  }

  const handleShare = () => {
    if (!exec.runTrace?.id) return
    setShareOpen(true)
  }

  const focusQueryInput = () => {
    queryInputRef.current?.focus()
  }

  useKeyboardShortcuts({
    onRun: () => {
      if (!exec.running && queryInputRef.current?.value) {
        exec.run(queryInputRef.current.value, {})
      }
    },
    onStop: () => {
      // Esc closes whichever overlay is on top before it stops a run.
      if (showHelp) return setShowHelp(false)
      if (shareOpen) return setShareOpen(false)
      if (historyOpen) return setHistoryOpen(false)
      if (exec.running) exec.stop()
    },
    onReplay: replay,
    onToggleHistory: () => setHistoryOpen(!historyOpen),
    onShare: handleShare,
    onExport: exportMission,
    onShowHelp: () => setShowHelp(true),
    onFocusInput: focusQueryInput,
    enabled: !inspectOpen,
  })

  const toggleDetails = () => {
    setDetails((on) => {
      localStorage.setItem('observatory_details', on ? '0' : '1')
      return !on
    })
  }

  const toggleFollow = () => {
    setFollow((on) => {
      localStorage.setItem('observatory_follow', on ? '0' : '1')
      return !on
    })
  }

  const setDemo = (id) => {
    const url = new URL(window.location.href)
    if (id === undefined) url.searchParams.delete('demo')
    else url.searchParams.set('demo', id || '')
    window.history.replaceState(window.history.state, '', url)
    setDemoParam(id === undefined ? null : id || '')
  }

  const dimmedFor = (id) => Boolean(highlighting && focusId !== id)

  return (
    <div className={`obs-app${details ? ' details' : ''}`}>
      <SiteHeader current="/observatory" pinned />

      <main className="obs-main">
        <section className={`obs-stage canvas-wrap${exec.running && follow ? ' cinematic' : ''}`} aria-label="3D map of the agent pipeline">
          <Canvas camera={{ position: [0, 3, 14], fov: 50 }} gl={{ antialias: true, preserveDrawingBuffer: true }} dpr={[1, 2]}>
            <color attach="background" args={['#05070d']} />
            <fog attach="fog" args={['#05070d', 18, 48]} />
            <Atmosphere color={zone?.color || null} />

            <ambientLight intensity={0.25} />
            <directionalLight position={[6, 10, 6]} intensity={0.5} color="#bcd4ff" />

            <Stars radius={60} depth={30} count={1500} factor={2} fade speed={reducedMotion ? 0 : 0.4} />
            <ParticleField count={400} color={zone?.color || '#7fa8ff'} />

            {exec.ghostEdges.map((edge, index) => {
              const from = positionOf(edge[0])
              const to = positionOf(edge[1])
              if (!from || !to || sameEdge(edge, view.activeConnection)) return null
              return <Connection key={`ghost-${index}`} from={from} to={to} ghost />
            })}

            {CONNECTIONS.map(([a, b], index) => (
              <Connection
                key={`${a}-${b}`}
                from={nodeById[a].position}
                to={nodeById[b].position}
                color={nodeById[b].color}
                phase={index / CONNECTIONS.length}
                reducedMotion={reducedMotion}
                active={connectionActive(a, b, view.activeConnection)}
                dimmed={highlighting && !connectionActive(a, b, view.activeConnection)}
                onHover={(over) => setHovered(over ? edgeInfo(a, b) : null)}
              />
            ))}

            {exec.feedbackCount > 0 && (
              <Connection
                from={nodeById.verifier.position}
                to={nodeById.planner.position}
                active
                color="#ff7a8a"
                reducedMotion={reducedMotion}
                onHover={(over) =>
                  setHovered(
                    over
                      ? {
                          id: 'feedback-edge',
                          label: 'VERIFIER → PLANNER',
                          status: 'FEEDBACK',
                          description: `The verifier rejected claims and sent the failure back to the planner ${exec.feedbackCount} time(s) in this run.`,
                          tech: 'Only drawn when a replan actually happened. Retry limit: 2.',
                        }
                      : null
                  )
                }
              />
            )}

            {TOOL_CONNECTIONS.map(([a, b], index) => (
              <Connection
                key={`${a}-${b}`}
                from={nodeById[a].position}
                to={toolById[b].position}
                color={toolById[b].color}
                phase={index / TOOL_CONNECTIONS.length}
                reducedMotion={reducedMotion}
                active={connectionActive(a, b, view.activeConnection)}
                dimmed={highlighting && !connectionActive(a, b, view.activeConnection)}
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
                spawnPacket(['web_search', 'response'], 1, 900, source.url || source.title)
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
                dimmed={dimmedFor(node.id)}
                confidence={scoreFor(node.id, exec)}
                selected={selected?.id === node.id}
                reducedMotion={reducedMotion}
                onHover={setHovered}
                onSelect={setSelected}
              />
            ))}

            {TOOLS.map((tool) => (
              <ToolNode
                key={tool.id}
                tool={tool}
                active={view.activeTool === tool.id}
                dimmed={dimmedFor(tool.id)}
                selected={selected?.id === tool.id}
                reducedMotion={reducedMotion}
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
              minDistance={4}
              maxDistance={28}
              minAzimuthAngle={-MAX_ORBIT}
              maxAzimuthAngle={MAX_ORBIT}
              enableDamping
              dampingFactor={0.08}
            />
            <LabelDeconflict />
            <CameraRig points={FIT_POINTS} focus={focusPos} follow={follow && exec.running} sway={!exec.running} fitKey={fitKey} reducedMotion={reducedMotion} insetPx={52} />
          </Canvas>

          <div className="letterbox top" />
          <div className="letterbox bottom" />

          {zone && highlighting && (
            <div className="zone-badge" style={{ color: zone.color, borderColor: zone.color }}>
              {zone.name}
            </div>
          )}

          {displayed && <InfoPanel node={displayed} />}

          <Legend />

          <div className="obs-toolbar" role="toolbar" aria-label="View controls">
            <ToolButton label="Query history (H)" onClick={() => setHistoryOpen(!historyOpen)} pressed={historyOpen} badge={history.length || null}>
              <History size={16} />
            </ToolButton>
            <ToolButton label="Share this run (S)" onClick={handleShare} disabled={!exec.runTrace?.id || exec.running}>
              <Share2 size={16} />
            </ToolButton>
            <span className="obs-tool-sep" aria-hidden="true" />
            <ToolButton label="Zoom in" onClick={() => zoomBy(0.8)}>
              <Plus size={16} />
            </ToolButton>
            <ToolButton label="Zoom out" onClick={() => zoomBy(1.25)}>
              <Minus size={16} />
            </ToolButton>
            <ToolButton label="Reset the view to fit the whole graph" onClick={() => setFitKey((k) => k + 1)}>
              <Maximize2 size={16} />
            </ToolButton>
            <ToolButton label="Camera follows the active step" onClick={toggleFollow} pressed={follow}>
              <Crosshair size={16} />
            </ToolButton>
            <span className="obs-tool-sep" aria-hidden="true" />
            <ToolButton label="Replay tour" onClick={() => setTourKey((k) => k + 1)}>
              <Route size={16} />
            </ToolButton>
            <ToolButton label="Keyboard shortcuts (?)" onClick={() => setShowHelp(true)}>
              <Keyboard size={16} />
            </ToolButton>
          </div>
        </section>

        <RunNarration exec={exec} details={details} onInspect={() => exec.runTrace && setInspectOpen(true)}>
          {demoOpen && (
            <GuidedDemo
              demo={demoById(demoParam)}
              exec={exec}
              onPick={(id) => setDemo(id)}
              onClose={() => setDemo(undefined)}
              onInspect={() => exec.runTrace && setInspectOpen(true)}
            />
          )}
        </RunNarration>

        <div className="obs-dock">
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
            onToggleSound={() => setSoundOn(!soundOn)}
            onExport={exportMission}
            canExport={Boolean(exec.response || exec.error)}
            inputRef={queryInputRef}
            prefillQuery={prefill}
          />
          <div className="view-toggle">
            <button type="button" onClick={toggleDetails} aria-pressed={details} title="Show or hide the live event log and memory stats">
              {details ? 'Simple view' : 'Show technical details'}
            </button>
            {exec.runTrace && !exec.running && (
              <button type="button" onClick={() => setInspectOpen(true)}>Inspect run</button>
            )}
            {!demoOpen && (
              <button type="button" onClick={() => setDemo(null)}>Break it yourself</button>
            )}
          </div>
        </div>
      </main>

      {inspectOpen && exec.runTrace && <SpanInspector trace={exec.runTrace} onClose={() => setInspectOpen(false)} />}

      <TutorialOverlay suppressed={demoOpen} replayKey={tourKey} />

      <QueryHistory
        history={history}
        isOpen={historyOpen}
        onToggle={() => setHistoryOpen(!historyOpen)}
        onClear={clearHistory}
        onSelectQuery={handleSelectQuery}
        currentQuery={exec.query}
        showToggle={false}
      />

      {exec.runTrace?.id && (
        <ShareButton
          traceId={exec.runTrace.id}
          query={exec.query}
          disabled={exec.running}
          isOpen={shareOpen}
          onOpenChange={setShareOpen}
          showButton={false}
        />
      )}

      <KeyboardShortcutsHelp isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  )
}
