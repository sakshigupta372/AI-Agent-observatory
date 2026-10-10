import { getTrace, listTraces, traceAnalytics } from '../../server/traces.js'

const headers = { 'Content-Type': 'application/json' }

// GET /api/traces            -> recent runs
// GET /api/traces?id=<uuid>  -> one run with every span
// GET /api/traces?view=analytics -> aggregates across stored runs
export async function GET({ url }) {
  try {
    const id = url.searchParams.get('id')
    if (id) {
      const trace = await getTrace(id)
      if (!trace) return new Response(JSON.stringify({ error: 'Trace not found' }), { status: 404, headers })
      return new Response(JSON.stringify({ trace }), { headers })
    }
    if (url.searchParams.get('view') === 'analytics') {
      return new Response(JSON.stringify({ analytics: await traceAnalytics() }), { headers })
    }
    return new Response(JSON.stringify({ traces: await listTraces(60) }), { headers })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
}
