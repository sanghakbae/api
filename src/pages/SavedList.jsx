import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkbench } from '../App.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { listRequests, deleteRequest } from '../lib/store.js'

export default function SavedList() {
  const { user } = useAuth()
  const { setActive } = useWorkbench()
  const navigate = useNavigate()
  const [items, setItems] = useState(null)
  const [filter, setFilter] = useState('')

  const load = () => listRequests(user.uid).then(setItems).catch(() => setItems([]))
  useEffect(() => { load() }, [user.uid])

  const open = (item) => {
    setActive({ ...item, headers: item.headers || [], params: item.params || [] })
    navigate('/tester')
  }

  const remove = async (e, id) => {
    e.stopPropagation()
    if (!confirm('삭제할까요?')) return
    await deleteRequest(user.uid, id)
    load()
  }

  if (items === null) return <div className="page-pad muted">불러오는 중…</div>

  const shown = items.filter((i) =>
    (i.name || '').toLowerCase().includes(filter.toLowerCase()) ||
    (i.url || '').toLowerCase().includes(filter.toLowerCase()))

  return (
    <div className="page-pad">
      <header className="page-head">
        <h2>저장된 API <span className="muted">({items.length})</span></h2>
        <input className="search" placeholder="검색…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </header>
      {shown.length === 0 ? (
        <p className="muted">저장된 요청이 없습니다. 테스터에서 요청을 만들고 저장하세요.</p>
      ) : (
        <ul className="saved-list">
          {shown.map((item) => (
            <li key={item.id} className="saved-item" onClick={() => open(item)}>
              <span className={`method-badge m-${(item.method || 'GET').toLowerCase()}`}>{item.method}</span>
              <div className="saved-meta">
                <div className="saved-name">{item.name || '(이름 없음)'}</div>
                <div className="saved-url">{item.url}</div>
              </div>
              <button className="icon-btn" onClick={(e) => remove(e, item.id)} title="삭제">🗑</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
