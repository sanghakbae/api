// Standalone Cloudflare Worker for LOCAL DEV (npm run worker:dev → :8787).
// Vite proxies /proxy and /analyze here during development.
// In production these endpoints are served by Pages Functions (functions/), same origin.
import { handleProxy, handleAnalyze, json, CORS } from './handlers.js'

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
    const { pathname } = new URL(request.url)
    try {
      if (pathname === '/proxy') return await handleProxy(request)
      if (pathname === '/analyze') return await handleAnalyze(request)
      return json({ error: 'not found' }, 404)
    } catch (e) {
      return json({ error: String(e?.message || e) }, 500)
    }
  },
}
