const FREQ = {
  user: 196,
  intent: 247,
  planner: 294,
  toolhub: 349,
  web_search: 370,
  database: 392,
  calculator: 415,
  external_api: 440,
  memory: 494,
  llm: 523,
  verifier: 587,
  response: 659,
}

let audioContext = null

export function playZone(zoneId) {
  if (!zoneId || typeof window === 'undefined') return
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return
  audioContext = audioContext || new AudioCtx()
  if (audioContext.state === 'suspended') audioContext.resume()

  const now = audioContext.currentTime
  const oscillator = audioContext.createOscillator()
  const gain = audioContext.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = FREQ[zoneId] || 330
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.035, now + 0.04)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42)
  oscillator.connect(gain)
  gain.connect(audioContext.destination)
  oscillator.start(now)
  oscillator.stop(now + 0.45)
}
