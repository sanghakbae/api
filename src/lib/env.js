// Simple environment variables stored in localStorage. Use {{name}} in any
// URL / header / query / body field and it is replaced at send time.
// e.g. {{baseUrl}} = https://api.example.com
const KEY = 'envVars'

export function getEnv() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}
export function setEnv(obj) {
  try { localStorage.setItem(KEY, JSON.stringify(obj || {})) } catch { /* ignore */ }
}

// Replace {{name}} tokens in a string using the current env.
export function subst(str, env = getEnv()) {
  if (typeof str !== 'string' || !str.includes('{{')) return str
  return str.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (m, name) =>
    Object.prototype.hasOwnProperty.call(env, name) ? env[name] : m)
}

// Apply env substitution across a whole request object.
export function applyEnv(request, env = getEnv()) {
  const s = (v) => subst(v, env)
  return {
    ...request,
    url: s(request.url),
    body: s(request.body),
    headers: (request.headers || []).map((h) => ({ ...h, key: s(h.key), value: s(h.value) })),
    params: (request.params || []).map((p) => ({ ...p, key: s(p.key), value: s(p.value) })),
  }
}
