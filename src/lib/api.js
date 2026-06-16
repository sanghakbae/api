// Client for the Cloudflare Worker: request proxy + URL analyzer.
// The worker base is overridable at runtime (localStorage) so internal/VPN-only
// sites can be analyzed through a LOCAL worker running on the user's machine
// (npm run worker:dev → http://localhost:8787), which sits on the same network.
const ENV_BASE = import.meta.env.VITE_WORKER_BASE || ''
export const LOCAL_BASE = 'http://localhost:8799'

export function getWorkerBase() {
  try { return localStorage.getItem('workerBase') || ENV_BASE } catch { return ENV_BASE }
}
export function setWorkerBase(v) {
  try { v ? localStorage.setItem('workerBase', v) : localStorage.removeItem('workerBase') } catch { /* ignore */ }
}
export function isLocalAnalyzer() { return getWorkerBase() === LOCAL_BASE }

// Replace {{KEY:name}} placeholders with stored API-key values, and apply a
// key's auth injection (header / query / bearer) onto the outgoing request.
export function applyKey(request, key) {
  const out = {
    ...request,
    headers: [...(request.headers || [])],
    params: [...(request.params || [])],
  }
  if (!key) return out
  const sub = (s) => (s || '').replaceAll('{{KEY}}', key.value)
  if (key.location === 'header') {
    out.headers.push({ key: key.headerName || 'Authorization', value: sub(key.template || '{{KEY}}'), enabled: true })
  } else if (key.location === 'bearer') {
    out.headers.push({ key: 'Authorization', value: `Bearer ${key.value}`, enabled: true })
  } else if (key.location === 'query') {
    out.params.push({ key: key.queryName || 'api_key', value: key.value, enabled: true })
  }
  return out
}

// Inject a saved session's cookies as a Cookie header (optional).
export function applySession(request, session) {
  const out = { ...request, headers: [...(request.headers || [])] }
  if (!session || !session.cookie) return out
  out.headers.push({ key: 'Cookie', value: session.cookie, enabled: true })
  return out
}

// Turn an array of Set-Cookie response headers into a single Cookie request string.
// "sid=abc; Path=/; HttpOnly" -> "sid=abc"
export function cookiesFromSetCookie(setCookie = []) {
  return setCookie
    .map((c) => (c || '').split(';')[0].trim())
    .filter(Boolean)
    .join('; ')
}

function buildUrl(url, params) {
  try {
    const u = new URL(url)
    for (const p of params || []) {
      if (p.enabled !== false && p.key) u.searchParams.append(p.key, p.value ?? '')
    }
    return u.toString()
  } catch {
    return url
  }
}

// Host (domain) of a URL, used to match domain-scoped sessions. '' if invalid.
export function hostOf(url) {
  try { return new URL(url).host } catch { return '' }
}

// Parse a cURL command (e.g. copied from browser DevTools → Network → Copy as cURL)
// into our request shape. Handles -X, -H/--header, -d/--data*, -b/--cookie, -u.
export function parseCurl(text) {
  const clean = (text || '').replace(/\\\r?\n/g, ' ').trim()
  const tokens = []
  const re = /"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+)/g
  let m
  while ((m = re.exec(clean)) !== null) {
    if (m[1] !== undefined) tokens.push(m[1].replace(/\\(.)/g, '$1'))
    else if (m[2] !== undefined) tokens.push(m[2])
    else tokens.push(m[3])
  }
  const out = { method: '', url: '', headers: [], body: '', params: [] }
  const valueFlags = new Set(['-A', '--user-agent', '-e', '--referer'])
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t === 'curl') continue
    else if (t === '-X' || t === '--request') out.method = (tokens[++i] || '').toUpperCase()
    else if (t === '-H' || t === '--header') {
      const h = tokens[++i] || ''
      const idx = h.indexOf(':')
      if (idx > 0) out.headers.push({ key: h.slice(0, idx).trim(), value: h.slice(idx + 1).trim(), enabled: true })
    } else if (t === '-b' || t === '--cookie') {
      out.headers.push({ key: 'Cookie', value: tokens[++i] || '', enabled: true })
    } else if (['-d', '--data', '--data-raw', '--data-binary', '--data-ascii', '--data-urlencode'].includes(t)) {
      out.body = tokens[++i] || ''
    } else if (t === '-u' || t === '--user') {
      try { out.headers.push({ key: 'Authorization', value: 'Basic ' + btoa(tokens[++i] || ''), enabled: true }) } catch { /* ignore */ }
    } else if (t === '--url') out.url = tokens[++i] || ''
    else if (valueFlags.has(t)) i++ // consume the value of a flag we don't model
    else if (t.startsWith('-')) { /* boolean flag like --compressed: skip */ }
    else if (!out.url) out.url = t
  }
  if (!out.method) out.method = out.body ? 'POST' : 'GET'
  return out
}

// Render a request as a copy-pasteable cURL command.
export function toCurl(request) {
  const parts = [`curl -X ${request.method || 'GET'}`]
  parts.push(`'${buildUrl(request.url, request.params)}'`)
  for (const h of request.headers || []) {
    if (h.enabled !== false && h.key) parts.push(`-H '${h.key}: ${(h.value ?? '').replace(/'/g, "'\\''")}'`)
  }
  if (!['GET', 'HEAD'].includes(request.method) && request.body) {
    parts.push(`-d '${request.body.replace(/'/g, "'\\''")}'`)
  }
  return parts.join(' \\\n  ')
}

// Send a request through the Worker proxy. Returns timing + parsed response.
export async function sendRequest(request) {
  const headers = {}
  for (const h of request.headers || []) {
    if (h.enabled !== false && h.key) headers[h.key] = h.value ?? ''
  }
  const target = buildUrl(request.url, request.params)
  const started = performance.now()
  const res = await fetch(`${getWorkerBase()}/proxy`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      method: request.method || 'GET',
      url: target,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body || undefined,
    }),
  })
  const elapsed = Math.round(performance.now() - started)
  const data = await res.json()
  return { ...data, elapsed, targetUrl: target }
}

// Ask the Worker to analyze a site URL and return discovered endpoints.
// `cookie` is optional — pass it to analyze a login-protected site.
export async function analyzeSite(url, cookie = '') {
  let res
  try {
    res = await fetch(`${getWorkerBase()}/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url, cookie: cookie.trim() || undefined }),
      signal: AbortSignal.timeout(30000),
    })
  } catch (e) {
    if (e.name === 'TimeoutError') throw new Error('분석 시간 초과 (대상 사이트가 응답하지 않습니다)')
    if (isLocalAnalyzer()) throw new Error('로컬 분석기에 연결할 수 없습니다. 이 PC에서 `npm run worker:dev`가 실행 중인지 확인하세요 (localhost:8787).')
    throw new Error(`분석 요청 실패: ${e.message}`)
  }
  if (!res.ok) throw new Error(`분석 실패 (${res.status})`)
  return res.json()
}
