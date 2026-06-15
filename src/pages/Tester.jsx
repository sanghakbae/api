import { useEffect, useState } from 'react'
import { useWorkbench } from '../App.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import KeyValueEditor from '../components/KeyValueEditor.jsx'
import { sendRequest, applyKey, applySession, cookiesFromSetCookie } from '../lib/api.js'
import { saveRequest, listKeys, listSessions, saveSession } from '../lib/store.js'

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

export default function Tester() {
  const { active, setActive } = useWorkbench()
  const { user } = useAuth()
  const [req, setReq] = useState(active)
  const [tab, setTab] = useState('params')
  const [keys, setKeys] = useState([])
  const [sessions, setSessions] = useState([])
  const [response, setResponse] = useState(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [savedMsg, setSavedMsg] = useState('')

  const loadSessions = () => listSessions(user.uid).then(setSessions).catch(() => {})
  useEffect(() => { listKeys(user.uid).then(setKeys).catch(() => {}); loadSessions() }, [user.uid])

  const patch = (p) => setReq((r) => ({ ...r, ...p }))

  const send = async () => {
    if (!req.url) { setError('URL을 입력하세요'); return }
    setSending(true); setError(null); setResponse(null)
    try {
      let prepared = applyKey(req, keys.find((k) => k.id === req.keyId))
      prepared = applySession(prepared, sessions.find((s) => s.id === req.sessionId))
      const res = await sendRequest(prepared)
      setResponse(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  // Capture Set-Cookie from the last response and store it as a reusable session.
  const saveCookies = async (setCookie) => {
    const cookie = cookiesFromSetCookie(setCookie)
    if (!cookie) return
    const name = prompt('세션 이름을 입력하세요', `${req.name || req.url} 세션`)
    if (!name) return
    setError(null)
    try {
      const id = await saveSession(user.uid, { name, cookie })
      await loadSessions()
      patch({ sessionId: id })
      setSavedMsg('세션 저장됨 ✓'); setTimeout(() => setSavedMsg(''), 2000)
    } catch (e) {
      setError(`세션 저장 실패: ${e.message}`)
    }
  }

  const save = async () => {
    const name = req.name || prompt('저장할 이름을 입력하세요', `${req.method} ${req.url}`)
    if (!name) return
    try {
      const id = await saveRequest(user.uid, { ...req, name })
      const saved = { ...req, id, name }
      setReq(saved); setActive(saved)
      setSavedMsg('저장됨 ✓'); setTimeout(() => setSavedMsg(''), 2000)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="tester">
      <header className="page-head">
        <input
          className="name-input"
          placeholder="이름 없는 요청"
          value={req.name}
          onChange={(e) => patch({ name: e.target.value })}
        />
        <div className="head-actions">
          {savedMsg && <span className="ok">{savedMsg}</span>}
          <button className="btn ghost" onClick={save}>💾 저장</button>
        </div>
      </header>

      <div className="url-bar">
        <select className="method" value={req.method} onChange={(e) => patch({ method: e.target.value })}>
          {METHODS.map((m) => <option key={m}>{m}</option>)}
        </select>
        <input
          className="url-input"
          placeholder="https://api.example.com/v1/resource"
          value={req.url}
          onChange={(e) => patch({ url: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button className="btn primary" onClick={send} disabled={sending}>
          {sending ? '전송 중…' : '전송'}
        </button>
      </div>

      <div className="key-select">
        <label>API 키 주입:</label>
        <select value={req.keyId} onChange={(e) => patch({ keyId: e.target.value })}>
          <option value="">없음</option>
          {keys.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
        <label>세션(쿠키):</label>
        <select value={req.sessionId} onChange={(e) => patch({ sessionId: e.target.value })}>
          <option value="">없음</option>
          {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div className="tabs">
        {['params', 'headers', 'body'].map((t) => (
          <button key={t} className={tab === t ? 'tab active' : 'tab'} onClick={() => setTab(t)}>
            {t === 'params' ? '쿼리' : t === 'headers' ? '헤더' : '바디'}
          </button>
        ))}
      </div>

      <div className="tab-body">
        {tab === 'params' && <KeyValueEditor rows={req.params} onChange={(params) => patch({ params })} />}
        {tab === 'headers' && <KeyValueEditor rows={req.headers} onChange={(headers) => patch({ headers })} />}
        {tab === 'body' && (
          <textarea
            className="body-input"
            placeholder='{"key": "value"}'
            value={req.body}
            onChange={(e) => patch({ body: e.target.value })}
          />
        )}
      </div>

      {error && <div className="error-box">{error}</div>}
      {response && <ResponseView res={response} onSaveCookies={saveCookies} />}
    </div>
  )
}

function ResponseView({ res, onSaveCookies }) {
  const [tab, setTab] = useState('body')
  const ok = res.status >= 200 && res.status < 300
  const pretty = res.json ? JSON.stringify(res.json, null, 2) : res.body
  const hasCookies = res.setCookie && res.setCookie.length > 0
  return (
    <div className="response">
      <div className="resp-meta">
        <span className={ok ? 'status ok' : 'status err'}>{res.status} {res.statusText}</span>
        <span className="muted">{res.elapsed} ms</span>
        <span className="muted">{formatSize(res.size)}</span>
        {hasCookies && (
          <button className="link-btn" onClick={() => onSaveCookies(res.setCookie)}>
            🍪 세션으로 저장 ({res.setCookie.length})
          </button>
        )}
      </div>
      <div className="tabs">
        <button className={tab === 'body' ? 'tab active' : 'tab'} onClick={() => setTab('body')}>본문</button>
        <button className={tab === 'headers' ? 'tab active' : 'tab'} onClick={() => setTab('headers')}>헤더</button>
      </div>
      {tab === 'body' && <pre className="code">{pretty}</pre>}
      {tab === 'headers' && (
        <pre className="code">{Object.entries(res.headers || {}).map(([k, v]) => `${k}: ${v}`).join('\n')}</pre>
      )}
    </div>
  )
}

function formatSize(n = 0) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
