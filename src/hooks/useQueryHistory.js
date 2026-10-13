import { useCallback, useState } from 'react'

const STORAGE_KEY = 'observatory_query_history'
const MAX_ENTRIES = 20

function readStored() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function writeStored(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Storage can be full or unavailable (e.g. private browsing); history
    // still works for the rest of the session via in-memory state.
  }
}

export function useQueryHistory() {
  const [history, setHistory] = useState(readStored)

  const addToHistory = useCallback((entry) => {
    setHistory((prev) => {
      const next = [{ id: Date.now(), timestamp: Date.now(), ...entry }, ...prev].slice(0, MAX_ENTRIES)
      writeStored(next)
      return next
    })
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
    writeStored([])
  }, [])

  return { history, addToHistory, clearHistory }
}
