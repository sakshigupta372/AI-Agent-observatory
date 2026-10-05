import { health } from '../../server/db.js'
import { listMemories } from '../../server/memoryStore.js'

export async function GET() {
  const [memories, db] = await Promise.all([listMemories(), health()])
  return Response.json({ memories, db })
}
