// In-memory limits. They reset on restart and are per instance, which is
// enough for a single Render service; move to Redis/Postgres before scaling out.

const buckets = new Map()

function sweep(now) {
  if (buckets.size < 5000) return
  for (const [key, bucket] of buckets) if (now >= bucket.reset) buckets.delete(key)
}

function take(key, limit, reset, now) {
  let bucket = buckets.get(key)
  if (!bucket || now >= bucket.reset) {
    bucket = { count: 0, reset }
    buckets.set(key, bucket)
  }
  if (bucket.count >= limit) return Math.max(1, Math.ceil((bucket.reset - now) / 1000))
  bucket.count += 1
  return 0
}

const envInt = (name, fallback) => {
  const value = Number(process.env[name] ?? import.meta.env?.[name])
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}

const WINDOW_MS = 10 * 60 * 1000

export const LIMITS = {
  route: envInt('ROUTES_PER_10_MIN', 30),
  execute: envInt('RUNS_PER_10_MIN', 10),
  daily: envInt('DAILY_RUN_CAP', 300),
}

// The first X-Forwarded-For entry can be forged, so the visitor cookie and
// the site-wide daily cap are checked as well; the daily cap is what bounds spend.
export function clientIp(request, clientAddress) {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0].trim() || clientAddress || 'unknown'
}

export function checkLimits({ phase, ip, visitorId }) {
  const now = Date.now()
  sweep(now)
  const limit = phase === 'route' ? LIMITS.route : LIMITS.execute
  const windowReset = now + WINDOW_MS

  for (const key of [`${phase}:ip:${ip}`, visitorId && `${phase}:vid:${visitorId}`].filter(Boolean)) {
    const wait = take(key, limit, windowReset, now)
    if (wait) {
      return {
        retryAfter: wait,
        error: `Too many requests. You can run ${limit} ${phase === 'route' ? 'questions' : 'agent runs'} every 10 minutes; try again in ${Math.ceil(wait / 60)} min.`,
      }
    }
  }

  if (phase !== 'route') {
    const midnight = new Date(now)
    midnight.setUTCHours(24, 0, 0, 0)
    const wait = take(`daily:${midnight.toISOString().slice(0, 10)}`, LIMITS.daily, midnight.getTime(), now)
    if (wait) {
      return {
        retryAfter: wait,
        error: 'The demo has reached its daily run limit, which keeps model and search costs bounded. It resets at midnight UTC; recorded runs on Traces and Evaluations are still available.',
      }
    }
  }
  return null
}
