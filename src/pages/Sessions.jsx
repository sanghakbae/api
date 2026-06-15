import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { listSessions, saveSession, deleteSession } from '../lib/store.js'

const emptySession = () => ({ name: '', cookie: '' })

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
        쿠키 기반 인증 세션(옵션). 테스터에서 세션을 선택하면 <code>Cookie</code> 헤더로 자동 주입됩니다.
        로그인 요청을 보낸 뒤 응답의 <code>Set-Cookie</code>를 “🍪 세션으로 저장”으로 바로 만들 수도 있습니다.
      </p>

      {sessions.length === 0 && !editing && <p className="muted">저장된 세션이 없습니다.</p>}

      <ul className="key-list">
        {sessions.map((s) => (
          <li key={s.id} className="key-item">
            <div style={{ minWidth: 0 }}>
              <div className="key-name">{s.name}</div>
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
          <label>쿠키<textarea rows={3} value={editing.cookie} onChange={(e) => setEditing({ ...editing, cookie: e.target.value })} placeholder="sid=abc123; token=xyz" style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 7, padding: '8px 10px', fontFamily: 'SF Mono, Menlo, monospace', resize: 'vertical' }} /></label>
          <div className="form-actions">
            <button type="button" className="btn ghost" onClick={() => setEditing(null)}>취소</button>
            <button type="submit" className="btn primary">저장</button>
          </div>
        </form>
      )}
    </div>
  )
}
