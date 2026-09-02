// Export/import all of the user's data as a single JSON file (backup / migrate).
import {
  listRequests, saveRequest, listApis, saveApi,
  listKeys, saveKey, listSessions, saveSession,
} from './store.js'
import { getEnv, setEnv } from './env.js'

const strip = (arr) => arr.map(({ id, createdAt, updatedAt, ...rest }) => rest)

export async function exportAll(uid) {
  const [requests, apis, keys, sessions] = await Promise.all([
    listRequests(uid), listApis(uid), listKeys(uid), listSessions(uid),
  ])
  return {
    app: 'api-manager', version: 1,
    exportedAt: new Date().toISOString(),
    requests: strip(requests), apis: strip(apis),
    keys: strip(keys), sessions: strip(sessions), env: getEnv(),
  }
}

export function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Additive import: creates new docs (does not delete existing). May duplicate if run twice.
export async function importAll(uid, data) {
  if (!data || data.app !== 'api-manager') throw new Error('이 앱의 백업 파일이 아닙니다.')
  const counts = { requests: 0, apis: 0, keys: 0, sessions: 0 }
  for (const r of data.requests || []) { await saveRequest(uid, r); counts.requests++ }
  for (const a of data.apis || []) { await saveApi(uid, a); counts.apis++ }
  for (const k of data.keys || []) { await saveKey(uid, k); counts.keys++ }
  for (const s of data.sessions || []) { await saveSession(uid, s); counts.sessions++ }
  if (data.env && typeof data.env === 'object') setEnv({ ...getEnv(), ...data.env })
  return counts
}
