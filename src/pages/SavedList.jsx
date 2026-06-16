import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkbench, blankRequest } from '../App.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { listRequests, deleteRequest, saveRequest, listHistory, clearHistory, deleteHistory } from '../lib/store.js'

export default function SavedList() {
  const { user } = useAuth()
  const { setActive } = useWorkbench()
  const navigate = useNavigate()
  const [tab, setTab] = useState('saved') // saved | recent
  const [items, setItems] = useState(null)
  const [filter, setFilter] = useState('')
  const [history, setHistory] = useState(null)

  const load = () => listRequests(user.uid).then(setItems).catch(() => setItems([]))
  const loadHistory = () => listHistory(user.uid).then(setHistory).catch(() => setHistory([]))
  useEffect(() => { load(); loadHistory() }, [user.uid])

  const open = (item) => {
    setActive({ ...blankRequest(), ...item, headers: item.headers || [], params: item.params || [] })
    navigate('/tester')
  }

  const remove = async (e, id) => {
    e.stopPropagation()
    if (!confirm('삭제할까요?')) return
    await deleteRequest(user.uid, id); load()
  }
  const duplicate = async (e, item) => {
    e.stopPropagation()
    const { id, ...rest } = item
    await saveRequest(user.uid, { ...rest, name: `${item.name || '요청'} (복사본)` }); load()
  }
  const rename = async (e, item) => {
    e.stopPropagation()
    const name = prompt('새 이름', item.name || '')
    if (name == null) return
    await saveRequest(user.uid, { ...item, name }); load()
  }
  const setFolder = async (e, item) => {
    e.stopPropagation()
    const folder = prompt('폴더 이름 (비우면 미분류)', item.folder || '')
    if (folder == null) return
    await saveRequest(user.uid, { ...item, folder: folder.trim() }); load()
  }

  if (items === null) return <div className="page-pad muted">불러오는 중…</div>

  const shown = items.filter((i) =>
    (i.name || '').toLowerCase().includes(filter.toLowerCase()) ||
    (i.url || '').toLowerCase().includes(filter.toLowerCase()))

  // Group by folder
  const groups = {}
  for (const it of shown) (groups[it.folder || '미분류'] ??= []).push(it)
  const folderNames = Object.keys(groups).sort((a, b) => (a === '미분류') - (b === '미분류') || a.localeCompare(b))

  return (
    <div className="page-pad">
      <header className="page-head">
        <div className="tabs" style={{ border: 'none', margin: 0 }}>
          <button className={tab === 'saved' ? 'tab active' : 'tab'} onClick={() => setTab('saved')}>📁 저장됨 ({items.length})</button>
          <button className={tab === 'recent' ? 'tab active' : 'tab'} onClick={() => { loadHistory(); setTab('recent') }}>🕘 최근 ({history?.length ?? 0})</button>
        </div>
        {tab === 'saved'
          ? <input className="search" placeholder="검색…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          : <button className="link-btn danger" onClick={async () => { if (confirm('최근 기록을 모두 지울까요?')) { await clearHistory(user.uid); setHistory([]) } }}>최근 기록 지우기</button>}
      </header>

      {tab === 'saved' && (shown.length === 0 ? (
        <div className="empty">{filter ? '검색 결과가 없습니다.' : '저장된 요청이 없습니다. 테스터에서 요청을 만들고 💾 저장하세요.'}</div>
      ) : (
        folderNames.map((folder) => (
          <div key={folder} className="folder-group">
            <div className="folder-title">📁 {folder} <span className="muted">({groups[folder].length})</span></div>
            <ul className="saved-list">
              {groups[folder].map((item) => (
                <li key={item.id} className="saved-item" onClick={() => open(item)}>
                  <span className={`method-badge m-${(item.method || 'GET').toLowerCase()}`}>{item.method}</span>
                  <div className="saved-meta">
                    <div className="saved-name">{item.name || '(이름 없음)'}</div>
                    <div className="saved-url">{item.url}</div>
                  </div>
                  <div className="ep-actions">
                    <button className="link-btn" onClick={(e) => rename(e, item)}>이름</button>
                    <button className="link-btn" onClick={(e) => setFolder(e, item)}>폴더</button>
                    <button className="link-btn" onClick={(e) => duplicate(e, item)}>복제</button>
                    <button className="icon-btn" onClick={(e) => remove(e, item.id)} title="삭제">🗑</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))
      ))}

      {tab === 'recent' && (history === null ? (
        <div className="muted">불러오는 중…</div>
      ) : history.length === 0 ? (
        <div className="empty">최근 보낸 요청이 없습니다. 테스터에서 요청을 전송하면 DB에 자동 기록되어 언제든 다시 볼 수 있습니다.</div>
      ) : (
        <ul className="saved-list">
          {history.map((item) => {
            const isAnalyze = item.type === 'analyze'
            // For request history, load only the request fields (drop history id/meta).
            const openItem = () => isAnalyze
              ? navigate('/analyze', { state: { url: item.url } })
              : (setActive({ ...blankRequest(), method: item.method, url: item.url, headers: item.headers || [], params: item.params || [], body: item.body || '' }), navigate('/tester'))
            return (
              <li key={item.id} className="saved-item" onClick={openItem}>
                <span className={`method-badge ${isAnalyze ? 'm-analyze' : `m-${(item.method || 'GET').toLowerCase()}`}`}>
                  {isAnalyze ? '분석' : item.method}
                </span>
                <div className="saved-meta">
                  <div className="saved-url">{item.url}</div>
                  <div className="muted small">
                    {isAnalyze
                      ? `${item.count ?? 0}개 발견`
                      : `${item.status ? `상태 ${item.status}` : ''}${item.elapsed != null ? ` · ${item.elapsed}ms` : ''}`}
                    {item.createdAt?.toDate ? ` · ${item.createdAt.toDate().toLocaleString('ko-KR')}` : ''}
                  </div>
                </div>
                <div className="ep-actions">
                  <button className="icon-btn" onClick={async (e) => { e.stopPropagation(); await deleteHistory(user.uid, item.id); loadHistory() }} title="삭제">🗑</button>
                </div>
              </li>
            )
          })}
        </ul>
      ))}
    </div>
  )
}
