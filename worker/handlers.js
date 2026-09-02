// Shared request-proxy + URL-analyzer logic.
// Used by both the standalone Worker (local dev) and Cloudflare Pages Functions (production).

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  // Allow an HTTPS site (e.g. api.sanghak.kr) to call a LOCAL worker on the
  // user's machine (Chrome Private Network Access requires this on preflight).
  'Access-Control-Allow-Private-Network': 'true',
}

export const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', ...CORS } })

// SSRF guard for the CLOUD worker: refuse private/loopback/metadata targets.
// (The local worker passes localMode=true and skips this so intranet sites work.)
export function isBlockedTarget(target) {
  try {
    const h = new URL(target).hostname.toLowerCase()
    if (h === 'metadata.google.internal') return true
    if (/^(localhost|0\.0\.0\.0|::1|127\.|10\.|192\.168\.|169\.254\.)/.test(h)) return true
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true
    return false
  } catch { return true }
}

export async function handleProxy(request, { localMode = false } = {}) {
  const { method = 'GET', url, headers = {}, body } = await request.json()
  if (!url) return json({ error: 'url required' }, 400)
  if (!localMode && isBlockedTarget(url)) return json({ error: '사설/내부 주소는 클라우드에서 차단됩니다. 사내망 주소는 “로컬” 모드로 보내세요.' }, 403)
  const started = Date.now()
  let upstream
  try {
    // 25s timeout so an unreachable / hanging host returns an error instead of stalling.
    upstream = await fetch(url, {
      method, headers, body: body ?? undefined, redirect: 'follow',
      signal: AbortSignal.timeout(25000),
    })
  } catch (e) {
    const timedOut = e?.name === 'TimeoutError'
    return json({ error: timedOut ? '대상 서버가 응답하지 않습니다 (타임아웃). 사내망/VPN 전용이거나 외부 접근이 차단된 주소일 수 있습니다.' : `요청 실패: ${e?.message || e}` }, 502)
  }
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

export async function handleAnalyze(request, { localMode = false } = {}) {
  const { url, cookie } = await request.json()
  if (!url) return json({ error: 'url required' }, 400)
  if (!localMode && isBlockedTarget(url)) return json({ error: '사설/내부 주소는 클라우드에서 차단됩니다. 사내망 주소는 “로컬” 모드로 분석하세요.', reachable: false, sources: [], count: 0, endpoints: [] }, 403)
  const origin = new URL(url).origin
  const endpoints = []
  const sources = []
  let rootReachable = false

  // Optional login cookie: when provided, attach it to every probe so the
  // analyzer can see behind a login. Public sites just leave it empty.
  const authHeaders = cookie ? { cookie } : {}

  // Each probe gets its own timeout so a slow / auth-gated / unresponsive target
  // can never hang the whole analysis.
  const TIMEOUT_MS = 6000
  const fetchT = (u, opts = {}) =>
    fetch(u, { ...opts, headers: { ...authHeaders, ...(opts.headers || {}) }, signal: AbortSignal.timeout(TIMEOUT_MS) })

  // Extract API-looking URLs from a blob of HTML/JS source text into `found`.
  const PATTERNS = [
    /["'`](https?:\/\/[^"'`\s]*\/(?:api|v\d|rest|graphql|svc|service)\/[^"'`\s]*)["'`]/gi,
    /["'`](\/(?:api|v\d|rest|svc|service)\/[a-zA-Z0-9_\-/{}.:]+)["'`]/g,
    /["'`]([a-zA-Z0-9_\-/{}.:]*\.(?:do|json|jsp|action))(?:\?[^"'`]*)?["'`]/g, // .do/.json/.jsp/.action
    /fetch\(\s*["'`]([^"'`]+)["'`]/g,
    /axios(?:\.[a-z]+)?\(\s*["'`]([^"'`]+)["'`]/g,
    /\.(?:get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/gi,             // $.post(...), http.get(...)
    /\bopen\(\s*["'`][A-Z]+["'`]\s*,\s*["'`]([^"'`]+)["'`]/g,                // XMLHttpRequest.open(method, url)
    /\burl\s*:\s*["'`]([^"'`]+)["'`]/g,                                       // jQuery ajax { url: '...' }
  ]
  // Returns { url, guessed } — guessed=true means the host is NOT known from the
  // source (a bare path like /v1/...), so we prefixed the page origin as a guess.
  // Absolute URLs found in the source (with their own host) are reliable.
  const norm = (raw) => {
    let path = raw, guessed = false
    if (path.startsWith('//')) path = 'https:' + path
    else if (path.startsWith('/')) { path = origin + path; guessed = true }
    else if (!/^https?:\/\//.test(path)) {
      try { path = new URL(path, url).toString(); guessed = true } catch { return null }
    }
    if (!/^https?:\/\//.test(path) || path.length > 300) return null
    return { url: path, guessed }
  }
  // Paths that belong to third-party SDKs (Firebase/Google auth, analytics…) —
  // they show up inside library bundles but are NOT the site's own API. Skip them
  // so we don't attach the wrong host and mislead.
  // Firebase / Google Identity Toolkit & analytics SDK internals — present in
  // library bundles, NOT the site's own API. Filtered out to avoid noise.
  const THIRD_PARTY = /(accounts[:/]|:signInWith|:signUp|:sendOobCode|:lookup|:start|:finalize|:withdraw|mfaEnrollment|mfaSignIn|recaptcha(Params|Config|Enterprise)|passwordPolicy|createAuthUri|getOobConfirmationCode|securetoken|identitytoolkit|googleapis|google-analytics|googletagmanager|gtag|firebaseio|firebaseinstallations|firebaselogging|firebaseremoteconfig|\/v1\/projects|__cookies__|\/token$)/i
  const scanText = (text, found) => {
    for (const re of PATTERNS) {
      let m
      while ((m = re.exec(text)) !== null) {
        const raw = m[1]
        if (/[$%]\{|%7B|%24|[{}]/.test(raw)) continue        // template-literal / interpolation artifacts
        const n = norm(raw)
        if (!n) continue
        if (n.guessed && THIRD_PARTY.test(raw)) continue      // library-internal path, unknown host
        if (/^\/__/.test(new URL(n.url).pathname)) continue   // internal (__cookies__ etc.)
        // Skip junk from minified code: path must have a segment of 3+ chars or a dot.
        try { const p = new URL(n.url).pathname; if (!/[a-z0-9]{3,}/i.test(p) && !p.includes('.')) continue } catch { continue }
        if (!found.has(n.url)) found.set(n.url, n.guessed)
      }
    }
  }

  // 1) Probe common OpenAPI / Swagger spec locations.
  const specPhase = async () => {
    const specPaths = [
      '/openapi.json', '/openapi.yaml', '/swagger.json', '/v3/api-docs',
      '/api-docs', '/api/openapi.json', '/.well-known/openapi.json',
    ]
    await Promise.all(specPaths.map(async (p) => {
      try {
        const r = await fetchT(origin + p, { headers: { accept: 'application/json' } })
        if (r.ok && (r.headers.get('content-type') || '').match(/json|yaml/)) {
          const spec = await r.json().catch(() => null)
          if (spec && spec.paths) {
            sources.push({ type: 'openapi', url: origin + p })
            for (const [path, methods] of Object.entries(spec.paths)) {
              for (const mth of Object.keys(methods)) {
                if (['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(mth)) {
                  endpoints.push({
                    method: mth.toUpperCase(),
                    url: (spec.servers?.[0]?.url || origin) + path,
                    summary: methods[mth].summary || methods[mth].operationId || '',
                    source: 'openapi',
                  })
                }
              }
            }
          }
        }
      } catch { /* ignore */ }
    }))
  }

  // 2) GraphQL introspection.
  const graphqlPhase = async () => {
    await Promise.all(['/graphql', '/api/graphql'].map(async (gqlPath) => {
      try {
        const r = await fetchT(origin + gqlPath, {
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
    }))
  }

  // 3) Fetch the page HTML, then also fetch its linked JS bundles (SPAs put their
  //    API calls there) and scan everything for endpoint patterns.
  const htmlPhase = async () => {
    const found = new Map() // url -> guessed(bool)
    const forms = []
    const links = new Set()
    let scannedJs = 0
    try {
      const r = await fetchT(url)
      rootReachable = true
      const html = await r.text()
      scanText(html, found)

      // <form action method> — the real endpoints of server-rendered apps.
      let fm
      const formRe = /<form\b([^>]*)>/gi
      while ((fm = formRe.exec(html)) !== null) {
        const attrs = fm[1]
        const action = (attrs.match(/action\s*=\s*["']([^"']*)["']/i) || [])[1]
        const method = (attrs.match(/method\s*=\s*["']([^"']*)["']/i) || [])[1]
        const u = norm(action || url)
        if (u) forms.push({ method: (method || 'GET').toUpperCase(), url: u.url })
      }

      // Internal <a href> page links (capped) — useful targets on server-rendered sites.
      let am
      const aRe = /<a\b[^>]+href\s*=\s*["']([^"']+)["']/gi
      while ((am = aRe.exec(html)) !== null && links.size < 40) {
        const h = am[1]
        if (/^(#|javascript:|mailto:|tel:)/i.test(h)) continue
        const u = norm(h)
        if (u && new URL(u.url).origin === origin) links.add(u.url)
      }

      // Collect linked scripts / module preloads, resolve to absolute, scan up to 12.
      const refs = new Set()
      for (const re of [/<script[^>]+src=["']([^"']+)["']/gi, /<link[^>]+href=["']([^"']+\.js[^"']*)["']/gi]) {
        let m
        while ((m = re.exec(html)) !== null) {
          try { refs.add(new URL(m[1], url).toString()) } catch { /* skip */ }
        }
      }
      const jsUrls = [...refs].filter((u) => /\.js(\?|$)/i.test(u)).slice(0, 12)
      await Promise.all(jsUrls.map(async (ju) => {
        try {
          const jr = await fetchT(ju)
          if (jr.ok) { scanText(await jr.text(), found); scannedJs++ }
        } catch { /* ignore */ }
      }))
    } catch { /* ignore */ }

    if (found.size || forms.length || links.size) {
      sources.push({ type: 'static', url, scannedJs })
      for (const [u, guessed] of found) endpoints.push({ method: 'GET', url: u, summary: '', source: 'code', guessed })
      for (const f of forms) endpoints.push({ method: f.method, url: f.url, summary: '폼 제출', source: 'form', guessed: false })
      for (const u of links) endpoints.push({ method: 'GET', url: u, summary: '페이지 링크', source: 'link', guessed: false })
    }
  }

  // Run all three phases concurrently.
  await Promise.all([specPhase(), graphqlPhase(), htmlPhase()])

  // De-duplicate by method+url.
  const seen = new Set()
  const unique = endpoints.filter((e) => {
    const k = e.method + ' ' + e.url
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  return json({ url, origin, reachable: rootReachable, sources, count: unique.length, endpoints: unique })
}
