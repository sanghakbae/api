import { useEffect, useState } from 'react'
import { useWorkbench } from '../App.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import KeyValueEditor from '../components/KeyValueEditor.jsx'
import { sendRequest, applyKey, applySession, cookiesFromSetCookie, hostOf, toCurl, parseCurl } from '../lib/api.js'
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
  const [msg, setMsg] = useState('')
  const [importText, setImportText] = useState(null) // null = closed

  const loadSessions = () => listSessions(user.uid).then(setSessions).catch(() => {})
  useEffect(() => { listKeys(user.uid).then(setKeys).catch(() => {}); loadSessions() }, [user.uid])

  const patch = (p) => setReq((r) => ({ ...r, ...p }))
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2000) }

  // Resolve which session applies: explicit pick, or auto-match by the URL's domain.
  const host = hostOf(req.url)
  const domainSession = sessions.find((s) => s.domain && host && s.domain === host)
  const sessionObj =
    req.sessionId === 'none' ? null
      : req.sessionId ? sessions.find((s) => s.id === req.sessionId)
        : domainSession
  const autoApplied = !req.sessionId && domainSession

  const prepared = () => applySession(applyKey(req, keys.find((k) => k.id === req.keyId)), sessionObj)

  const send = async () => {
    if (!req.url) { setError('URL을 입력하세요'); return }
    setSending(true); setError(null); setResponse(null)
    try {
      setResponse(await sendRequest(prepared()))
    } catch (e) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  const copy = async (text, label) => {
    try { await navigator.clipboard.writeText(text); flash(`${label} 복사됨 ✓`) }
    catch { setError('클립보드 복사 실패') }
  }

  // Capture Set-Cookie from a response and store it as a domain-scoped session.
  const saveCookies = async (setCookie) => {
    const cookie = cookiesFromSetCookie(setCookie)
    if (!cookie) return
    setError(null)
    try {
      const id = await saveSession(user.uid, { name: host || '세션', domain: host, cookie })
      await loadSessions()
      patch({ sessionId: id })
      flash('세션 저장됨 ✓')
    } catch (e) {
      setError(`세션 저장 실패: ${e.message}`)
    }
  }

  const doImport = () => {
    const parsed = parseCurl(importText || '')
    if (!parsed.url) { setError('cURL에서 URL을 찾지 못했습니다. 형식을 확인하세요.'); return }
    setReq((r) => ({ ...r, method: parsed.method, url: parsed.url, headers: parsed.headers, body: parsed.body, params: parsed.params }))
    setImportText(null); setResponse(null); setError(null)
    flash('cURL 가져옴 ✓')
  }

  const save = async () => {
    const name = req.name?.trim() || `${req.method} ${host || req.url}`
    try {
      const id = await saveRequest(user.uid, { ...req, name })
      const saved = { ...req, id, name }
      setReq(saved); setActive(saved)
      flash('저장됨 ✓')
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
          {msg && <span className="ok">{msg}</span>}
          <button className="btn ghost" onClick={() => setImportText('')}>📋 cURL 가져오기</button>
          <button className="btn ghost" onClick={() => copy(toCurl(prepared()), 'cURL')} disabled={!req.url}>cURL 복사</button>
          <button className="btn ghost" onClick={save}>💾 저장</button>
        </div>
      </header>

      {importText !== null && (
        <div className="import-box">
          <div className="muted small">
            브라우저 F12 → <b>Network</b> 탭에서 보고 싶은 요청을 우클릭 →
            <b>Copy → Copy as cURL</b> 한 뒤 여기에 붙여넣으세요.
          </div>
          <textarea
            className="cookie-input"
            rows={4}
            autoFocus
            placeholder="curl 'https://...' -H '...' --data-raw '...'"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
          <div className="form-actions">
            <button className="btn ghost" onClick={() => setImportText(null)}>취소</button>
            <button className="btn primary" onClick={doImport} disabled={!importText.trim()}>가져오기</button>
          </div>
        </div>
      )}

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
        <label>API 키</label>
        <select value={req.keyId} onChange={(e) => patch({ keyId: e.target.value })}>
          <option value="">없음</option>
          {keys.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
        <label>세션</label>
        <select value={req.sessionId} onChange={(e) => patch({ sessionId: e.target.value })}>
          <option value="">자동 (도메인 일치)</option>
          <option value="none">사용 안 함</option>
          {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}{s.domain ? ` · ${s.domain}` : ''}</option>)}
        </select>
        {autoApplied && <span className="chip">🍪 {domainSession.name || host} 자동 적용</span>}
      </div>

      <div className="tabs">
        {['params', 'headers', 'body'].map((t) => (
          <button key={t} className={tab === t ? 'tab active' : 'tab'} onClick={() => setTab(t)}>
            {t === 'params' ? '쿼리' : t === 'headers' ? '헤더' : '바디'}
            {t === 'headers' && req.headers?.length ? ` (${req.headers.length})` : ''}
            {t === 'params' && req.params?.length ? ` (${req.params.length})` : ''}
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
            onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && send()}
          />
        )}
      </div>

      {error && <div className="error-box">{error}</div>}
      {response && <ResponseView res={response} onSaveCookies={saveCookies} onCopy={copy} />}
    </div>
  )
}

function ResponseView({ res, onSaveCookies, onCopy }) {
  const [tab, setTab] = useState('body')
  const ok = res.status >= 200 && res.status < 300
  const pretty = res.json ? JSON.stringify(res.json, null, 2) : res.body
  const headersText = Object.entries(res.headers || {}).map(([k, v]) => `${k}: ${v}`).join('\n')
  const hasCookies = res.setCookie && res.setCookie.length > 0
  return (
    <div className="response">
      <div className="resp-meta">
        <span className={ok ? 'status ok' : 'status err'}>{res.status} {res.statusText}</span>
        <span className="muted">⏱ {res.elapsed} ms</span>
        <span className="muted">⬇ {formatSize(res.size)}</span>
        {hasCookies && (
          <button className="link-btn" onClick={() => onSaveCookies(res.setCookie)}>
            🍪 세션으로 저장 ({res.setCookie.length})
          </button>
        )}
        <span className="spacer" />
        <button className="link-btn" onClick={() => onCopy(tab === 'body' ? pretty : headersText, '응답')}>복사</button>
      </div>
      <div className="tabs">
        <button className={tab === 'body' ? 'tab active' : 'tab'} onClick={() => setTab('body')}>본문</button>
        <button className={tab === 'headers' ? 'tab active' : 'tab'} onClick={() => setTab('headers')}>헤더</button>
      </div>
      {tab === 'body' && <pre className="code">{pretty || '(빈 응답)'}</pre>}
      {tab === 'headers' && <pre className="code">{headersText}</pre>}
    </div>
  )
}

function formatSize(n = 0) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
