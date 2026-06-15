// Shared request-proxy + URL-analyzer logic.
// Used by both the standalone Worker (local dev) and Cloudflare Pages Functions (production).

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
}

export const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', ...CORS } })

export async function handleProxy(request) {
  const { method = 'GET', url, headers = {}, body } = await request.json()
  if (!url) return json({ error: 'url required' }, 400)
  const started = Date.now()
  const upstream = await fetch(url, { method, headers, body: body ?? undefined, redirect: 'follow' })
  const elapsed = Date.now() - started
  const text = await upstream.text()
  const resHeaders = {}
  upstream.headers.forEach((v, k) => (resHeaders[k] = v))
  // Set-Cookie must be read as a list (getSetCookie) — forEach folds it into one
  // comma-joined string which corrupts cookies. Surface it so the UI can save a session.
  const setCookie = upstream.headers.getSetCookie ? upstream.headers.getSetCookie() : []
  let parsed
  const ct = upstream.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    try { parsed = JSON.parse(text) } catch { /* keep text */ }
  }
  return json({
    status: upstream.status,
    statusText: upstream.statusText,
    headers: resHeaders,
    setCookie,
    contentType: ct,
    body: text,
    json: parsed,
    size: text.length,
    serverElapsed: elapsed,
  })
}

export async function handleAnalyze(request) {
  const { url } = await request.json()
  if (!url) return json({ error: 'url required' }, 400)
  const origin = new URL(url).origin
  const endpoints = []
  const sources = []

  // 1) Probe common OpenAPI / Swagger spec locations.
  const specPaths = [
    '/openapi.json', '/openapi.yaml', '/swagger.json', '/v3/api-docs',
    '/api-docs', '/api/openapi.json', '/.well-known/openapi.json',
  ]
  for (const p of specPaths) {
    try {
      const r = await fetch(origin + p, { headers: { accept: 'application/json' } })
      if (r.ok && (r.headers.get('content-type') || '').match(/json|yaml/)) {
        const spec = await r.json().catch(() => null)
        if (spec && spec.paths) {
          sources.push({ type: 'openapi', url: origin + p })
          for (const [path, methods] of Object.entries(spec.paths)) {
            for (const m of Object.keys(methods)) {
              if (['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(m)) {
                endpoints.push({
                  method: m.toUpperCase(),
                  url: (spec.servers?.[0]?.url || origin) + path,
                  summary: methods[m].summary || methods[m].operationId || '',
                  source: 'openapi',
                })
              }
            }
          }
        }
      }
    } catch { /* ignore */ }
  }

  // 2) GraphQL introspection.
  for (const gqlPath of ['/graphql', '/api/graphql']) {
    try {
      const r = await fetch(origin + gqlPath, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: '{__schema{queryType{name}}}' }),
      })
      const j = await r.json().catch(() => null)
      if (j && (j.data?.__schema || j.errors)) {
        sources.push({ type: 'graphql', url: origin + gqlPath })
        endpoints.push({ method: 'POST', url: origin + gqlPath, summary: 'GraphQL endpoint', source: 'graphql' })
      }
    } catch { /* ignore */ }
  }

  // 3) Static scan of the HTML/JS for fetch/axios/api-path patterns.
  try {
    const r = await fetch(url)
    const html = await r.text()
    const found = new Set()
    const patterns = [
      /["'`](\/api\/[a-zA-Z0-9_\-/{}.]+)["'`]/g,
      /fetch\(\s*["'`]([^"'`]+)["'`]/g,
      /axios\.[a-z]+\(\s*["'`]([^"'`]+)["'`]/g,
    ]
    for (const re of patterns) {
      let m
      while ((m = re.exec(html)) !== null) {
        let path = m[1]
        if (path.startsWith('/')) path = origin + path
        if (/^https?:\/\//.test(path)) found.add(path)
      }
    }
    if (found.size) {
      sources.push({ type: 'static', url })
      for (const u of found) endpoints.push({ method: 'GET', url: u, summary: '', source: 'static-scan' })
    }
  } catch { /* ignore */ }

  // De-duplicate by method+url.
  const seen = new Set()
  const unique = endpoints.filter((e) => {
    const k = e.method + ' ' + e.url
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  return json({ url, origin, sources, count: unique.length, endpoints: unique })
}
