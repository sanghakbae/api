import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { listSessions, saveSession, deleteSession } from '../lib/store.js'

const emptySession = () => ({ name: '', domain: '', cookie: '' })

export default function Sessions() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState(null)
  const [editing, setEditing] = useState(null)
  const [err, setErr] = useState(null)

  const load = () => listSessions(user.uid).then(setSessions).catch((e) => { setErr(e.message); setSessions([]) })
  useEffect(() => { load() }, [user.uid])

  const submit = async (e) => {
    e.preventDefault()
    if (!editing.name || !editing.cookie) return
    setErr(null)
    try {
      await saveSession(user.uid, editing)
      setEditing(null)
      load()
    } catch (e) {
      setErr(`저장 실패: ${e.message}`)
    }
  }

  const remove = async (id) => {
    if (!confirm('이 세션을 삭제할까요?')) return
    try {
      await deleteSession(user.uid, id)
      load()
    } catch (e) {
      setErr(`삭제 실패: ${e.message}`)
    }
  }

  if (sessions === null) return <div className="page-pad muted">불러오는 중…</div>

  return (
    <div className="page-pad">
      <header className="page-head">
        <h2>세션 <span className="muted">({sessions.length})</span></h2>
        <button className="btn primary" onClick={() => setEditing(emptySession())}>+ 새 세션</button>
      </header>

      {err && <div className="error-box">{err}</div>}

      <p className="muted small">
        로그인이 필요한 사이트의 쿠키를 <b>도메인별</b>로 저장해두면, 테스터에서 그 도메인 요청에 <code>Cookie</code>가 자동 적용됩니다.
        보통은 URL 분석/테스터 화면에서 바로 저장되니, 여기선 직접 관리만 하면 됩니다.
      </p>

      {sessions.length === 0 && !editing && (
        <div className="empty">아직 저장된 세션이 없습니다. 로그인이 필요한 사이트를 분석/테스트할 때 쿠키를 넣으면 여기에 쌓입니다.</div>
      )}

      <ul className="key-list">
        {sessions.map((s) => (
          <li key={s.id} className="key-item">
            <div style={{ minWidth: 0 }}>
              <div className="key-name">{s.name} {s.domain && <span className="chip">{s.domain}</span>}</div>
              <div className="key-detail muted small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.cookie}</div>
            </div>
            <div className="key-actions">
              <button className="link-btn" onClick={() => setEditing(s)}>편집</button>
              <button className="link-btn danger" onClick={() => remove(s.id)}>삭제</button>
            </div>
          </li>
        ))}
      </ul>

      {editing && (
        <form className="key-form" onSubmit={submit}>
          <h3>{editing.id ? '세션 편집' : '새 세션'}</h3>
          <label>이름<input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="예: 운영 로그인" /></label>
          <label>도메인 (자동 적용 대상)<input value={editing.domain || ''} onChange={(e) => setEditing({ ...editing, domain: e.target.value })} placeholder="예: api.example.com" /></label>
          <label>쿠키<textarea rows={3} value={editing.cookie} onChange={(e) => setEditing({ ...editing, cookie: e.target.value })} placeholder="sid=abc123; token=xyz" /></label>
          <div className="form-actions">
            <button type="button" className="btn ghost" onClick={() => setEditing(null)}>취소</button>
            <button type="submit" className="btn primary">저장</button>
          </div>
        </form>
      )}
    </div>
  )
}
