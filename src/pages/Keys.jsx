import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { listKeys, saveKey, deleteKey } from '../lib/store.js'

const emptyKey = () => ({ name: '', value: '', location: 'bearer', headerName: 'Authorization', queryName: 'api_key', template: 'Bearer {{KEY}}' })

export default function Keys() {
  const { user } = useAuth()
  const [keys, setKeys] = useState(null)
  const [editing, setEditing] = useState(null)
  const [reveal, setReveal] = useState({})
  const [err, setErr] = useState(null)

  const load = () => listKeys(user.uid).then(setKeys).catch((e) => { setErr(e.message); setKeys([]) })
  useEffect(() => { load() }, [user.uid])

  const submit = async (e) => {
    e.preventDefault()
    if (!editing.name || !editing.value) return
    setErr(null)
    try {
      await saveKey(user.uid, editing)
      setEditing(null)
      load()
    } catch (e) {
      setErr(`저장 실패: ${e.message}`)
    }
  }

  const remove = async (id) => {
    if (!confirm('이 키를 삭제할까요?')) return
    try {
      await deleteKey(user.uid, id)
      load()
    } catch (e) {
      setErr(`삭제 실패: ${e.message}`)
    }
  }

  if (keys === null) return <div className="page-pad muted">불러오는 중…</div>

  return (
    <div className="page-pad">
      <header className="page-head">
        <h2>API 키 <span className="muted">({keys.length})</span></h2>
        <button className="btn primary" onClick={() => setEditing(emptyKey())}>+ 새 키</button>
      </header>

      {err && <div className="error-box">{err}</div>}

      <p className="muted small">
        외부 API 인증정보를 저장해두면 테스터에서 선택해 요청에 자동 주입됩니다.
        값에 <code>{'{{KEY}}'}</code> 토큰을 쓰면 해당 위치에 키 값이 치환됩니다.
      </p>

      {keys.length === 0 && !editing && <div className="empty">저장된 API 키가 없습니다. “+ 새 키”로 외부 API 인증정보를 추가하세요.</div>}

      <ul className="key-list">
        {keys.map((k) => (
          <li key={k.id} className="key-item">
            <div>
              <div className="key-name">{k.name}</div>
              <div className="key-detail muted small">
                {k.location} · {reveal[k.id] ? k.value : '••••••••' + (k.value || '').slice(-4)}
                <button className="link-btn" onClick={() => setReveal((r) => ({ ...r, [k.id]: !r[k.id] }))}>
                  {reveal[k.id] ? '숨기기' : '보기'}
                </button>
              </div>
            </div>
            <div className="key-actions">
              <button className="link-btn" onClick={() => setEditing(k)}>편집</button>
              <button className="link-btn danger" onClick={() => remove(k.id)}>삭제</button>
            </div>
          </li>
        ))}
      </ul>

      {editing && (
        <form className="key-form" onSubmit={submit}>
          <h3>{editing.id ? '키 편집' : '새 키'}</h3>
          <label>이름<input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="예: GitHub 토큰" /></label>
          <label>키 값<input value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} placeholder="시크릿 값" /></label>
          <label>주입 위치
            <select value={editing.location} onChange={(e) => setEditing({ ...editing, location: e.target.value })}>
              <option value="bearer">Authorization: Bearer</option>
              <option value="header">커스텀 헤더</option>
              <option value="query">쿼리 파라미터</option>
            </select>
          </label>
          {editing.location === 'header' && (
            <>
              <label>헤더 이름<input value={editing.headerName} onChange={(e) => setEditing({ ...editing, headerName: e.target.value })} /></label>
              <label>값 템플릿<input value={editing.template} onChange={(e) => setEditing({ ...editing, template: e.target.value })} placeholder="{{KEY}} 또는 Token {{KEY}}" /></label>
            </>
          )}
          {editing.location === 'query' && (
            <label>파라미터 이름<input value={editing.queryName} onChange={(e) => setEditing({ ...editing, queryName: e.target.value })} /></label>
          )}
          <div className="form-actions">
            <button type="button" className="btn ghost" onClick={() => setEditing(null)}>취소</button>
            <button type="submit" className="btn primary">저장</button>
          </div>
        </form>
      )}
    </div>
  )
}
