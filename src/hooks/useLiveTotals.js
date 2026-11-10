import { useEffect, useState } from 'react'

// One analytics request per page, shared by the header, footer and content.
let pending = null

export function useLiveTotals() {
  const [state, setState] = useState({ totals: null, online: null })
  useEffect(() => {
    pending ||= fetch('/api/traces?view=analytics')
      .then((res) => res.json())
      .then((data) => ({ totals: data.analytics?.totals || null, online: Boolean(data.analytics) }))
      .catch(() => ({ totals: null, online: false }))
    let alive = true
    pending.then((value) => alive && setState(value))
    return () => {
      alive = false
    }
  }, [])
  return state
}
