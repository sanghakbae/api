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
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const run = async () => {
    if (!url) return
    setLoading(true); setError(null); setResult(null)
    try {
      setResult(await analyzeSite(url))
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
        사이트 주소를 입력하면 OpenAPI/Swagger 스펙, GraphQL 인트로스펙션, 페이지 내 fetch/axios 호출을 탐지해 엔드포인트를 추출합니다.
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

      {error && <div className="error-box">{error}</div>}

      {result && (
        <div className="analyze-result">
          <div className="sources">
            {result.sources.length === 0
              ? <span className="muted">탐지된 API 소스가 없습니다.</span>
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
