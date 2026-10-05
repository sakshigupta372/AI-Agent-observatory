import { pipeline, env } from '@xenova/transformers'

// all-MiniLM-L6-v2 runs locally, so memory embeddings cost nothing per
// run and work without a third embedding provider key.
export const EMBEDDING_DIMS = 384

env.allowLocalModels = false

let extractorPromise = null

function loadExtractor() {
  extractorPromise = extractorPromise || pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
  return extractorPromise
}

export async function embed(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 2000)
  if (!clean) return null
  const extractor = await loadExtractor()
  const output = await extractor(clean, { pooling: 'mean', normalize: true })
  return Array.from(output.data)
}

// Loading MiniLM takes a few seconds, so start it at boot instead of
// paying for it inside the first user's memory lookup.
export function warmEmbedder() {
  loadExtractor().catch(() => {})
}

export function toVectorLiteral(vector) {
  return `[${vector.map((value) => Number(value).toFixed(6)).join(',')}]`
}
