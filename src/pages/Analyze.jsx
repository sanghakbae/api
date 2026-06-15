import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkbench, blankRequest } from '../App.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { analyzeSite } from '../lib/api.js'
import { saveRequest } from '../lib/store.js'

export default function Analyze() {
  const { user } = useAuth()
  const { setActive } = useWorkbench()
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [cookie, setCookie] = useState('')
  const [showCookie, setShowCookie] = useState(false)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const run = async () => {
    if (!url) return
    setLoading(true); setError(null); setResult(null)
    try {
      setResult(await analyzeSite(url, cookie))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const toTester = (ep) => {
    setActive({ ...blankRequest(), name: ep.summary || ep.url, method: ep.method, url: ep.url })
    navigate('/tester')
  }

  const saveEp = async (ep) => {
    await saveRequest(user.uid, {
      ...blankRequest(), name: ep.summary || `${ep.method} ${ep.url}`, method: ep.method, url: ep.url,
    })
    alert('저장됨 ✓')
  }

  return (
    <div className="page-pad">
      <header className="page-head"><h2>URL 분석</h2></header>
      <p className="muted small">
        사이트 주소를 입력하면 OpenAPI/Swagger 스펙, GraphQL 인트로스펙션, JS 번들 내 fetch/axios 호출을 탐지해 엔드포인트를 추출합니다.
        <br/>공개 사이트는 그냥 분석하고, 로그인이 필요한 사이트는 아래 “🔒 쿠키”에 로그인 쿠키를 넣어 분석하세요.
      </p>
      <div className="url-bar">
        <input
          className="url-input"
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <button className="btn primary" onClick={run} disabled={loading}>
          {loading ? '분석 중…' : '분석'}
        </button>
      </div>

      <div className="cookie-row">
        <button className="link-btn" onClick={() => setShowCookie((v) => !v)}>
          🔒 로그인 쿠키 {cookie ? '(입력됨)' : '(선택)'} {showCookie ? '▲' : '▼'}
        </button>
        {showCookie && (
          <>
            <textarea
              className="cookie-input"
              rows={2}
              placeholder="로그인이 필요한 사이트만: 브라우저 F12 → Application → Cookies에서 복사해 붙여넣기   예) sid=abc; token=xyz"
              value={cookie}
              onChange={(e) => setCookie(e.target.value)}
            />
            <span className="muted small">공개 사이트는 비워두세요. 입력하면 이 쿠키로 로그인된 상태로 분석합니다.</span>
          </>
        )}
      </div>

      {error && <div className="error-box">{error}</div>}

      {result && (
        <div className="analyze-result">
          {result.reachable === false && (
            <div className="error-box">
              대상 사이트에 접근할 수 없습니다 — 사내망/VPN 전용이거나, 봇 차단으로 외부(클라우드) 접근이 막혀 있을 수 있습니다.
              이런 사이트는 클라우드 분석기로는 볼 수 없습니다.
            </div>
          )}
          <div className="sources">
            {result.sources.length === 0
              ? <span className="muted">{result.reachable === false ? '접근 불가' : '탐지된 API 소스가 없습니다.'}</span>
              : result.sources.map((s, i) => <span key={i} className="source-tag">{s.type}</span>)}
            <span className="muted">· {result.count}개 엔드포인트</span>
          </div>
          <ul className="ep-list">
            {result.endpoints.map((ep, i) => (
              <li key={i} className="ep-item">
                <span className={`method-badge m-${ep.method.toLowerCase()}`}>{ep.method}</span>
                <div className="ep-meta">
                  <div className="ep-url">{ep.url}</div>
                  {ep.summary && <div className="muted small">{ep.summary}</div>}
                  <div className="muted small">via {ep.source}</div>
                </div>
                <div className="ep-actions">
                  <button className="link-btn" onClick={() => toTester(ep)}>테스터로</button>
                  <button className="link-btn" onClick={() => saveEp(ep)}>저장</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
