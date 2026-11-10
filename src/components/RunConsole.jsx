import { useEffect, useState } from 'react'
import { Volume2, VolumeX, Download, Play, Loader2, ChevronDown, RotateCcw } from 'lucide-react'
import { EXAMPLE_PROMPTS } from '../data/scenarios.js'
import { Button } from './ui/button.jsx'
import { Input } from './ui/input.jsx'
import { cn } from '../lib/utils.js'

const STEER_TOOLS = [
  ['web_search', 'Web'],
  ['calculator', 'Calculator'],
  ['database', 'Database'],
  ['external_api', 'Document'],
]

const INJECTIONS = [
  ['', 'No failure'],
  ['hallucinated_claim', 'Inject: fake claim'],
  ['irrelevant_retrieval', 'Inject: wrong sources'],
  ['empty_retrieval', 'Inject: empty search'],
  ['tool_timeout', 'Inject: tool timeout'],
]

export default function RunConsole({
  running,
  label,
  onRun,
  awaitingSteer,
  onSteer,
  frames = [],
  onScrub,
  onReplay,
  soundOn,
  onToggleSound,
  onExport,
  canExport,
  inputRef,
  prefillQuery,
}) {
  const [query, setQuery] = useState('')
  const [inject, setInject] = useState('')
  const [scrub, setScrub] = useState(frames.length ? frames.length - 1 : 0)

  useEffect(() => {
    setScrub(Math.max(frames.length - 1, 0))
  }, [frames.length])

  useEffect(() => {
    if (prefillQuery) setQuery(prefillQuery.text)
  }, [prefillQuery])

  const submit = (e) => {
    e.preventDefault()
    const q = query.trim()
    if (!q || running) return
    onRun(q, { inject: inject || undefined })
  }

  return (
    <div className="run-console">
      {running && (
        <div className="flex items-center gap-2 rounded-full border border-border glass px-4 py-1.5 text-xs font-medium text-foreground/90">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
          </span>
          {label}
        </div>
      )}

      {awaitingSteer && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {STEER_TOOLS.map(([id, name]) => (
            <Button key={id} variant="outline" size="sm" onClick={() => onSteer(id)}>
              {name}
            </Button>
          ))}
        </div>
      )}

      {frames.length > 1 && !running && (
        <div className="flex w-full items-center gap-3 rounded-full border border-border glass px-3 py-1.5">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={onReplay}>
            <RotateCcw className="size-3.5" /> Replay
          </Button>
          <input
            type="range"
            min={0}
            max={frames.length - 1}
            value={Math.min(scrub, frames.length - 1)}
            onChange={(event) => {
              const next = Number(event.target.value)
              setScrub(next)
              onScrub(next)
            }}
            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-border accent-primary"
          />
          <Button variant="ghost" size="sm" onClick={() => onScrub(null)}>
            Now
          </Button>
        </div>
      )}

      <form
        className="glass flex w-full items-center gap-2 rounded-2xl p-2 shadow-[0_12px_48px_-12px_rgba(0,0,0,0.7)]"
        onSubmit={submit}
      >
        <Input
          ref={inputRef}
          type="text"
          placeholder="Ask the AI agent something…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={running}
          className="h-10 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
        />

        <div className="relative hidden sm:block">
          <select
            value={inject}
            onChange={(e) => setInject(e.target.value)}
            disabled={running}
            title="Force a failure so you can watch the verifier and replanner react"
            className="h-9 cursor-pointer appearance-none rounded-md border border-input bg-card/40 pl-3 pr-8 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:border-ring focus-visible:outline-none disabled:opacity-50"
          >
            {INJECTIONS.map(([value, name]) => (
              <option key={value} value={value} className="bg-popover text-popover-foreground">
                {name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        </div>

        <Button
          type="button"
          variant={soundOn ? 'secondary' : 'ghost'}
          size="icon"
          className={cn('shrink-0', soundOn && 'text-primary')}
          title={soundOn ? 'Sound on' : 'Sound off'}
          onClick={onToggleSound}
        >
          {soundOn ? <Volume2 /> : <VolumeX />}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          title="Export mission as HTML"
          onClick={onExport}
          disabled={!canExport}
        >
          <Download />
        </Button>

        <Button type="submit" variant="primary" className="shrink-0 gap-2" disabled={running || !query.trim()}>
          {running ? <Loader2 className="animate-spin" /> : <Play />}
          {running ? 'Running…' : 'Run Agent'}
        </Button>
      </form>

      <div className="flex flex-wrap justify-center gap-2">
        {EXAMPLE_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            disabled={running}
            onClick={() => onRun(p, { inject: inject || undefined })}
            className="rounded-full border border-border bg-card/30 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-foreground disabled:opacity-40"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}
