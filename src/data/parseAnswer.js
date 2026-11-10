// Splits an agent answer (markdown: a bold headline, then "- " bullets) into
// { headline, bullets }. Answers without bullets are split into sentences.
export function parseAnswer(text) {
  const lines = String(text)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const bullets = []
  const prose = []

  for (const line of lines) {
    const match = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)/)
    if (match) bullets.push(match[1])
    else prose.push(line)
  }

  if (bullets.length === 0 && prose.length === 1) {
    const sentences = prose[0].split(/(?<=[.!?])\s+/).filter((sentence) => sentence.length > 20)
    if (sentences.length > 1) {
      return { headline: sentences[0], bullets: sentences.slice(1) }
    }
  }

  return { headline: prose.join(' '), bullets }
}
