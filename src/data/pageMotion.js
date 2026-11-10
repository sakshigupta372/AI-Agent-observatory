// Root page animation for Astro's client router; keyframes live in PageTransitions.astro.
const out = { name: 'obs-page-out', duration: '0.3s', easing: 'cubic-bezier(0.7, 0, 0.84, 0)', fillMode: 'both' }
const into = { name: 'obs-page-in', duration: '0.65s', delay: '0.1s', easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fillMode: 'both' }

export const pageMotion = {
  forwards: { old: out, new: into },
  backwards: { old: out, new: into },
}
