// Standalone Cloudflare Worker for LOCAL DEV (npm run worker:dev → :8799) and
// the deployed cloud proxy. Routes /proxy and /analyze to the shared handlers.
//
// Abuse protection:
//  - Origin allowlist: only our app (api.sanghak.kr / localhost) may use the proxy,
//    so the public workers.dev URL can't be used as an anonymous open proxy.
//  - SSRF guard: the CLOUD worker refuses private / metadata targets. The LOCAL
//    worker (localhost) allows them on purpose — that's how intranet sites work.
import { handleProxy, handleAnalyze, json, CORS } from './handlers.js'

const ALLOWED_ORIGINS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/api\.sanghak\.kr$/,
]
const originAllowed = (o) => !!o && ALLOWED_ORIGINS.some((re) => re.test(o))

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
    const { pathname, hostname } = new URL(request.url)
    const localMode = hostname === 'localhost' || hostname === '127.0.0.1'
    try {
      if (pathname === '/proxy' || pathname === '/analyze') {
        const origin = request.headers.get('Origin')
        if (!originAllowed(origin)) return json({ error: '허용되지 않은 출처입니다 (이 프록시는 API Manager 전용).' }, 403)
        if (pathname === '/proxy') return await handleProxy(request, { localMode })
        return await handleAnalyze(request, { localMode })
      }
      return json({ error: 'not found' }, 404)
    } catch (e) {
      return json({ error: String(e?.message || e) }, 500)
    }
  },
}
