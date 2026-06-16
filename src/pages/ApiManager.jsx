import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkbench, blankRequest } from '../App.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { listApis, saveApi, deleteApi, listSessions, addHistory } from '../lib/store.js'
import { sendRequest, applySession, hostOf } from '../lib/api.js'
import { applyEnv } from '../lib/env.js'
import ParamTable from '../components/ParamTable.jsx'

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const emptyApi = () => ({
  name: '', category: '', method: 'POST', url: '', overview: '',
  requestParams: [], requestExample: '', responseParams: [], responseExample: '', notes: '', version: '',
})

export default function ApiManager() {
  const { user } = useAuth()
  const { setActive } = useWorkbench()
  const navigate = useNavigate()
  const [apis, setApis] = useState(null)
  const [sessions, setSessions] = useState([])
  const [mode, setMode] = useState('list') // list | edit | view
  const [cur, setCur] = useState(null)
  const [filter, setFilter] = useState('')
  const [err, setErr] = useState(null)

  const load = () => listApis(user.uid).then(setApis).catch(() => setApis([]))
  useEffect(() => { load(); listSessions(user.uid).then(setSessions).catch(() => {}) }, [user.uid])

  if (apis === null) return <div className="page-pad muted">불러오는 중…</div>

  if (mode === 'edit') return <ApiEditor api={cur} onCancel={() => setMode('list')} onSaved={() => { load(); setMode('list') }} uid={user.uid} setErr={setErr} err={err} />
  if (mode === 'view') return (
    <ApiView api={cur} sessions={sessions} uid={user.uid}
      onBack={() => setMode('list')}
      onEdit={() => setMode('edit')}
      toTester={(req) => { setActive(req); navigate('/tester') }} />
  )

  const shown = apis.filter((a) => (a.name + a.url + (a.category || '')).toLowerCase().includes(filter.toLowerCase()))
  const groups = {}
  for (const a of shown) (groups[a.category || '미분류'] ??= []).push(a)

  return (
    <div className="page-pad">
      <header className="page-head">
        <h2>API 관리 <span className="muted">({apis.length})</span></h2>
        <div className="head-actions">
          <input className="search" placeholder="검색…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <button className="btn primary" onClick={() => { setCur(emptyApi()); setMode('edit') }}>+ 새 API 등록</button>
        </div>
      </header>
      {err && <div className="error-box">{err}</div>}
      <p className="muted small">API의 주소·요청/응답 규격을 등록해두고, 문서로 보거나 그 자리에서 바로 호출할 수 있습니다.</p>

      {apis.length === 0 ? (
        <div className="empty">등록된 API가 없습니다. “+ 새 API 등록”으로 첫 API를 만들어보세요.</div>
      ) : Object.keys(groups).map((cat) => (
        <div key={cat} className="folder-group">
          <div className="folder-title">🗂️ {cat} <span className="muted">({groups[cat].length})</span></div>
          <ul className="saved-list">
            {groups[cat].map((a) => (
              <li key={a.id} className="saved-item" onClick={() => { setCur(a); setMode('view') }}>
                <span className={`method-badge m-${(a.method || 'GET').toLowerCase()}`}>{a.method}</span>
                <div className="saved-meta">
                  <div className="saved-name">{a.name || '(이름 없음)'}</div>
                  <div className="saved-url">{a.url}</div>
                </div>
                <div className="ep-actions">
                  <button className="link-btn" onClick={(e) => { e.stopPropagation(); setCur(a); setMode('edit') }}>편집</button>
                  <button className="icon-btn" onClick={async (e) => { e.stopPropagation(); if (confirm('삭제할까요?')) { await deleteApi(user.uid, a.id); load() } }} title="삭제">🗑</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function ApiEditor({ api, onCancel, onSaved, uid, setErr, err }) {
  const [a, setA] = useState(api)
  const patch = (p) => setA((x) => ({ ...x, ...p }))
  const save = async () => {
    if (!a.name || !a.url) { setErr('이름과 URL은 필수입니다.'); return }
    setErr(null)
    try { await saveApi(uid, a); onSaved() } catch (e) { setErr(`저장 실패: ${e.message}`) }
  }
  return (
    <div className="page-pad" style={{ maxWidth: 900 }}>
      <header className="page-head">
        <h2>{a.id ? 'API 편집' : '새 API 등록'}</h2>
        <div className="head-actions">
          <button className="btn ghost" onClick={onCancel}>취소</button>
          <button className="btn primary" onClick={save}>💾 저장</button>
        </div>
      </header>
      {err && <div className="error-box">{err}</div>}

      <div className="api-form">
        <div className="row2">
          <label>이름 *<input value={a.name} onChange={(e) => patch({ name: e.target.value })} placeholder="예: 독립청구항 세트 생성" /></label>
          <label>카테고리<input value={a.category} onChange={(e) => patch({ category: e.target.value })} placeholder="예: Specification" /></label>
        </div>
        <div className="row-method">
          <label style={{ flex: '0 0 110px' }}>메서드
            <select value={a.method} onChange={(e) => patch({ method: e.target.value })}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select>
          </label>
          <label style={{ flex: 1 }}>URL *<input value={a.url} onChange={(e) => patch({ url: e.target.value })} placeholder="예: {{baseUrl}}/v2/generate/independent-claim-sets" /></label>
        </div>
        <label>개요<textarea rows={3} value={a.overview} onChange={(e) => patch({ overview: e.target.value })} placeholder="이 API가 하는 일" /></label>

        <h3>요청 파라미터</h3>
        <ParamTable rows={a.requestParams || []} onChange={(requestParams) => patch({ requestParams })} />
        <label>요청 예시 (JSON)<textarea className="mono" rows={6} value={a.requestExample} onChange={(e) => patch({ requestExample: e.target.value })} placeholder='{"data": { ... }}' /></label>

        <h3>응답 필드</h3>
        <ParamTable rows={a.responseParams || []} onChange={(responseParams) => patch({ responseParams })} />
        <label>응답 예시 (JSON)<textarea className="mono" rows={6} value={a.responseExample} onChange={(e) => patch({ responseExample: e.target.value })} placeholder='{"code": 0, "message": "success", "data": [ ... ]}' /></label>

        <div className="row2">
          <label>버전<input value={a.version} onChange={(e) => patch({ version: e.target.value })} placeholder="예: 0.2.0" /></label>
          <label>참고<input value={a.notes} onChange={(e) => patch({ notes: e.target.value })} placeholder="SRS/SDS 링크 등" /></label>
        </div>
      </div>
    </div>
  )
}

function ApiView({ api, sessions, uid, onBack, onEdit, toTester }) {
  const [res, setRes] = useState(null)
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState(null)

  const buildReq = () => ({
    ...blankRequest(),
    name: api.name, method: api.method, url: api.url,
    headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
    body: api.requestExample || '',
  })

  const call = async () => {
    setSending(true); setErr(null); setRes(null)
    try {
      const host = hostOf(api.url)
      const sess = sessions.find((s) => s.domain && s.domain === host)
      const out = applyEnv(applySession(buildReq(), sess))
      const r = await sendRequest(out)
      setRes(r)
      addHistory(uid, { ...out, status: r.status, elapsed: r.elapsed }).catch(() => {})
    } catch (e) { setErr(e.message) } finally { setSending(false) }
  }

  const ok = res && res.status >= 200 && res.status < 300
  const pretty = res ? (res.json ? JSON.stringify(res.json, null, 2) : res.body) : ''

  return (
    <div className="page-pad guide">
      <header className="page-head">
        <h2><span className={`method-badge m-${(api.method || 'GET').toLowerCase()}`}>{api.method}</span> {api.name}</h2>
        <div className="head-actions">
          <button className="btn ghost" onClick={onBack}>← 목록</button>
          <button className="btn ghost" onClick={onEdit}>편집</button>
          <button className="btn ghost" onClick={() => toTester(buildReq())}>🧪 테스터로 열기</button>
          <button className="btn primary" onClick={call} disabled={sending}>{sending ? '호출 중…' : '▶ 바로 호출'}</button>
        </div>
      </header>

      {api.category && <span className="chip">{api.category}</span>}{api.version && <span className="chip">v{api.version}</span>}

      <section className="g-card"><h3>개요</h3><p style={{ whiteSpace: 'pre-wrap' }}>{api.overview || '—'}</p>
        <div className="api-url"><span className={`method-badge m-${(api.method || 'GET').toLowerCase()}`}>{api.method}</span><code>{api.url}</code></div>
      </section>

      {err && <div className="error-box">{err}</div>}
      {res && (
        <section className="g-card">
          <h3>호출 결과 <span className={ok ? 'status ok' : 'status err'}>{res.status} {res.statusText}</span> <span className="muted small">{res.elapsed}ms</span></h3>
          <pre className="code">{pretty || '(빈 응답)'}</pre>
        </section>
      )}

      <section className="g-card"><h3>요청 파라미터</h3>{renderParams(api.requestParams)}
        {api.requestExample && <><div className="muted small" style={{ marginTop: 8 }}>요청 예시</div><pre className="code">{api.requestExample}</pre></>}
      </section>
      <section className="g-card"><h3>응답 필드</h3>{renderParams(api.responseParams)}
        {api.responseExample && <><div className="muted small" style={{ marginTop: 8 }}>응답 예시</div><pre className="code">{api.responseExample}</pre></>}
      </section>
      {api.notes && <section className="g-card"><h3>참고</h3><p>{api.notes}</p></section>}
    </div>
  )
}

function renderParams(rows) {
  if (!rows || rows.length === 0) return <p className="muted small">정의된 항목 없음</p>
  return (
    <table className="doc-table">
      <thead><tr><th>이름</th><th>타입</th><th>필수</th><th>설명</th></tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}><td><code>{r.name}</code></td><td>{r.type}</td><td>{r.required ? '필수' : '-'}</td><td>{r.memo}</td></tr>
        ))}
      </tbody>
    </table>
  )
}
