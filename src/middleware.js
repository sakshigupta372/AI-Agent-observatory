import { randomUUID } from 'node:crypto'
import { defineMiddleware } from 'astro:middleware'

const COOKIE = 'obs_vid'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

// Gives each browser an anonymous id so the trace explorer only lists that
// visitor's own runs.
export const onRequest = defineMiddleware(async (context, next) => {
  let id = context.cookies.get(COOKIE)?.value
  if (!id || !UUID.test(id)) {
    id = randomUUID()
    context.cookies.set(COOKIE, id, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.RENDER === 'true',
      maxAge: 60 * 60 * 24 * 365,
    })
  }
  context.locals.visitorId = id
  return next()
})
