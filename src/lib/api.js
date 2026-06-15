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
export async function analyzeSite(url) {
  const res = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!res.ok) throw new Error(`분석 실패 (${res.status})`)
  return res.json()
}
