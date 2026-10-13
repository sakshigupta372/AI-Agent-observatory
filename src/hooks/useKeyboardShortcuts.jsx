import { useEffect } from 'react'

const SHORTCUTS = {
  ' ': 'Run query (Space)',
  'Escape': 'Stop execution (Esc)',
  'r': 'Replay last run (R)',
  'h': 'Toggle history (H)',
  's': 'Share current run (S)',
  'e': 'Export trace (E)',
  '?': 'Show help (Shift+/)',
  '/': 'Focus query input (/)'
}

export function useKeyboardShortcuts({
  onRun,
  onStop,
  onReplay,
  onToggleHistory,
  onShare,
  onExport,
  onShowHelp,
  onFocusInput,
  enabled = true
}) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)

      if (e.key === ' ' && !isInput && onRun) { e.preventDefault(); onRun() }
      if (e.key === 'Escape' && onStop) { onStop() }
      if (e.key === 'r' && !isInput && onReplay) { e.preventDefault(); onReplay() }
      if (e.key === 'h' && !isInput && onToggleHistory) { e.preventDefault(); onToggleHistory() }
      if (e.key === 's' && !isInput && onShare) { e.preventDefault(); onShare() }
      if (e.key === 'e' && !isInput && onExport) { e.preventDefault(); onExport() }
      if (e.key === '?' && onShowHelp) { e.preventDefault(); onShowHelp() }
      if (e.key === '/' && !isInput && onFocusInput) { e.preventDefault(); onFocusInput() }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, onRun, onStop, onReplay, onToggleHistory, onShare, onExport, onShowHelp, onFocusInput])

  return SHORTCUTS
}

// Help modal component
export function KeyboardShortcutsHelp({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <div className="shortcuts-overlay" onClick={onClose}>
      <div className="shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-header">
          <h2>Keyboard Shortcuts</h2>
          <button onClick={onClose}>✕</button>
        </div>
        
        <div className="shortcuts-list">
          {Object.entries(SHORTCUTS).map(([key, description]) => (
            <div key={key} className="shortcut-item">
              <kbd>{key === ' ' ? 'Space' : key}</kbd>
              <span>{description.split(' (')[0]}</span>
            </div>
          ))}
        </div>
        
        <div className="shortcuts-footer">
          <p>Press <kbd>?</kbd> anytime to see this help</p>
        </div>
      </div>
    </div>
  )
}
