import { useState, createContext, useContext } from 'react'
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './auth/AuthContext.jsx'
import Login from './pages/Login.jsx'
import Tester from './pages/Tester.jsx'
import SavedList from './pages/SavedList.jsx'
import Keys from './pages/Keys.jsx'
import Sessions from './pages/Sessions.jsx'
import Analyze from './pages/Analyze.jsx'
import ApiManager from './pages/ApiManager.jsx'
import Env from './pages/Env.jsx'
import Guide from './pages/Guide.jsx'

// Shared "active request" so Saved/Analyze can load a request into the Tester.
const WorkbenchContext = createContext(null)
export const useWorkbench = () => useContext(WorkbenchContext)

export const blankRequest = () => ({
  id: null,
  name: '',
  method: 'GET',
  url: '',
  headers: [],
  params: [],
  body: '',
  keyId: '',
  sessionId: '',
})

export default function App() {
  const { user, loading, configured } = useAuth()
  const [active, setActive] = useState(blankRequest())
  const location = useLocation()

  if (!configured) return <ConfigNotice />
  if (loading) return <div className="center">로딩 중…</div>
  if (!user) return <Login />

  return (
    <WorkbenchContext.Provider value={{ active, setActive }}>
      <div className="layout">
        <Sidebar />
        <main className="content">
          <Routes>
            <Route path="/" element={<Navigate to="/tester" replace />} />
            <Route path="/tester" element={<Tester key={active.id || 'new'} />} />
            <Route path="/saved" element={<SavedList />} />
            <Route path="/apis" element={<ApiManager />} />
            <Route path="/keys" element={<Keys />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/env" element={<Env />} />
            <Route path="/guide" element={<Guide />} />
            <Route path="/analyze" element={<Analyze />} />
            <Route path="*" element={<Navigate to="/tester" replace />} />
          </Routes>
        </main>
      </div>
    </WorkbenchContext.Provider>
  )
}

function Sidebar() {
  const { user, signOut } = useAuth()
  const link = ({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')
  return (
    <aside className="sidebar">
      <div className="brand">{'{ }'} API Manager</div>
      <nav>
        <NavLink to="/tester" className={link}>🧪 테스터</NavLink>
        <NavLink to="/apis" className={link}>🗂️ API 관리</NavLink>
        <NavLink to="/saved" className={link}>📁 저장된 API</NavLink>
        <NavLink to="/analyze" className={link}>🔍 URL 분석</NavLink>
        <NavLink to="/keys" className={link}>🔑 API 키</NavLink>
        <NavLink to="/sessions" className={link}>🍪 세션</NavLink>
        <NavLink to="/env" className={link}>🧩 환경변수</NavLink>
        <NavLink to="/guide" className={link}>📖 사용법</NavLink>
      </nav>
      <div className="user">
        <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
        <div className="user-meta">
          <div className="user-name">{user.displayName}</div>
          <button className="link-btn" onClick={signOut}>로그아웃</button>
        </div>
      </div>
    </aside>
  )
}

function ConfigNotice() {
  return (
    <div className="center config-notice">
      <h2>Firebase 설정이 필요합니다</h2>
      <p><code>.env.example</code>를 <code>.env</code>로 복사하고 Firebase 웹앱 키를 채운 뒤 다시 실행하세요.</p>
    </div>
  )
}
