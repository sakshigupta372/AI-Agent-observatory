import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import node from '@astrojs/node'

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
  server: {
    port: 4331,
    // The standalone server defaults to localhost, which a hosting proxy cannot
    // reach. Render sets RENDER=true at build time, so bind all interfaces there
    // while keeping local dev private to this machine.
    host: process.env.RENDER === 'true' || process.env.HOST === '0.0.0.0' ? true : false,
  },
})
