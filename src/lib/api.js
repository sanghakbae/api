// Client for the Cloudflare Worker: request proxy + URL analyzer.
const BASE = import.meta.env.VITE_WORKER_BASE || ''

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
  const res = await fetch(`${BASE}/proxy`, {
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
    res = await fetch(`${BASE}/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url, cookie: cookie.trim() || undefined }),
      signal: AbortSignal.timeout(30000),
    })
  } catch (e) {
    if (e.name === 'TimeoutError') throw new Error('분석 시간 초과 (대상 사이트가 응답하지 않습니다)')
    throw new Error(`분석 요청 실패: ${e.message}`)
  }
  if (!res.ok) throw new Error(`분석 실패 (${res.status})`)
  return res.json()
}
