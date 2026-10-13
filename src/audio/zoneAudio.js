// Frequency mapping for each zone in the agent pipeline
// Based on musical notes for harmonic progression through the execution flow
const FREQ = {
  user: 196,        // G3 - Start of query
  intent: 247,      // B3 - Intent detection
  planner: 294,     // D4 - Planning
  toolhub: 349,     // F4 - Tool dispatch
  web_search: 370,  // F#4 - Web search
  database: 392,    // G4 - Database query
  calculator: 415,  // G#4 - Calculator
  external_api: 440,// A4 - External API
  memory: 494,      // B4 - Memory retrieval
  llm: 523,         // C5 - LLM reasoning
  verifier: 587,    // D5 - Verification
  response: 659,    // E5 - Final response
}

// Waveform types for different zone categories
const WAVE_TYPE = {
  user: 'sine',
  intent: 'sine',
  planner: 'triangle',
  toolhub: 'sine',
  web_search: 'sawtooth',
  database: 'square',
  calculator: 'triangle',
  external_api: 'sawtooth',
  memory: 'square',
  llm: 'sine',
  verifier: 'triangle',
  response: 'sine',
}

let audioContext = null
let userInteracted = false

// Initialize audio context on first user interaction
if (typeof window !== 'undefined') {
  const initAudio = () => {
    userInteracted = true
    document.removeEventListener('click', initAudio)
    document.removeEventListener('keydown', initAudio)
  }
  document.addEventListener('click', initAudio)
  document.addEventListener('keydown', initAudio)
}

/**
 * Play a tone for a specific zone transition
 * @param {string} zoneId - The zone identifier (e.g., 'intent', 'planner')
 * @param {object} options - Playback options
 */
export function playZone(zoneId, options = {}) {
  if (!zoneId || typeof window === 'undefined' || !userInteracted) return
  
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return
  
  audioContext = audioContext || new AudioCtx()
  if (audioContext.state === 'suspended') audioContext.resume()

  const now = audioContext.currentTime
  const frequency = FREQ[zoneId] || 330
  const waveType = WAVE_TYPE[zoneId] || 'sine'
  const volume = options.volume || 0.035
  const duration = options.duration || 0.42

  // Create oscillator for the primary tone
  const oscillator = audioContext.createOscillator()
  const gain = audioContext.createGain()
  
  oscillator.type = waveType
  oscillator.frequency.value = frequency
  
  // Envelope: quick attack, sustained hold, gentle release
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.04)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
  
  oscillator.connect(gain)
  gain.connect(audioContext.destination)
  oscillator.start(now)
  oscillator.stop(now + duration + 0.03)
}

/**
 * Play a success tone (rising chord)
 */
export function playSuccess() {
  if (typeof window === 'undefined' || !userInteracted) return
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return
  
  audioContext = audioContext || new AudioCtx()
  if (audioContext.state === 'suspended') audioContext.resume()

  const now = audioContext.currentTime
  const notes = [523, 659, 784] // C5, E5, G5 (major chord)
  
  notes.forEach((freq, i) => {
    const osc = audioContext.createOscillator()
    const gain = audioContext.createGain()
    
    osc.type = 'sine'
    osc.frequency.value = freq
    
    const delay = i * 0.08
    gain.gain.setValueAtTime(0.0001, now + delay)
    gain.gain.exponentialRampToValueAtTime(0.025, now + delay + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.35)
    
    osc.connect(gain)
    gain.connect(audioContext.destination)
    osc.start(now + delay)
    osc.stop(now + delay + 0.4)
  })
}

/**
 * Play an error tone (descending dissonance)
 */
export function playError() {
  if (typeof window === 'undefined' || !userInteracted) return
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return
  
  audioContext = audioContext || new AudioCtx()
  if (audioContext.state === 'suspended') audioContext.resume()

  const now = audioContext.currentTime
  const notes = [440, 392, 349] // A4, G4, F4 (descending)
  
  notes.forEach((freq, i) => {
    const osc = audioContext.createOscillator()
    const gain = audioContext.createGain()
    
    osc.type = 'sawtooth'
    osc.frequency.value = freq
    
    const delay = i * 0.12
    gain.gain.setValueAtTime(0.0001, now + delay)
    gain.gain.exponentialRampToValueAtTime(0.03, now + delay + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.4)
    
    osc.connect(gain)
    gain.connect(audioContext.destination)
    osc.start(now + delay)
    osc.stop(now + delay + 0.45)
  })
}

/**
 * Play a data packet transmission sound
 */
export function playPacket() {
  if (typeof window === 'undefined' || !userInteracted) return
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return
  
  audioContext = audioContext || new AudioCtx()
  if (audioContext.state === 'suspended') audioContext.resume()

  const now = audioContext.currentTime
  const osc = audioContext.createOscillator()
  const gain = audioContext.createGain()
  
  osc.type = 'sine'
  osc.frequency.setValueAtTime(800, now)
  osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08)
  
  gain.gain.setValueAtTime(0.015, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08)
  
  osc.connect(gain)
  gain.connect(audioContext.destination)
  osc.start(now)
  osc.stop(now + 0.1)
}

/**
 * Play ambient background hum (for active execution state)
 */
export function playAmbient(active = true) {
  if (typeof window === 'undefined' || !userInteracted) return
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return
  
  audioContext = audioContext || new AudioCtx()
  if (audioContext.state === 'suspended') audioContext.resume()

  // This would typically manage a persistent background tone
  // For now, just a simple implementation
  if (active) {
    const now = audioContext.currentTime
    const osc = audioContext.createOscillator()
    const gain = audioContext.createGain()
    
    osc.type = 'sine'
    osc.frequency.value = 65.41 // C2 - very low
    
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.008, now + 0.5)
    
    osc.connect(gain)
    gain.connect(audioContext.destination)
    osc.start(now)
    osc.stop(now + 2)
  }
}
