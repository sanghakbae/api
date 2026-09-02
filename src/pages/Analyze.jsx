import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useWorkbench, blankRequest } from '../App.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { analyzeSite, hostOf, getWorkerBase, setWorkerBase, LOCAL_BASE } from '../lib/api.js'
import { saveRequest, addHistory, upsertSessionByDomain, getSessionByDomain } from '../lib/store.js'

export default function Analyze() {
  const { user } = useAuth()
  const { setActive } = useWorkbench()
  const navigate = useNavigate()
  const location = useLocation()
  const [url, setUrl] = useState(location.state?.url || '')
  const [cookie, setCookie] = useState('')
  const [showCookie, setShowCookie] = useState(false)
  const [savedSession, setSavedSession] = useState(null) // saved session matching the URL's domain
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [msg, setMsg] = useState('')
  const [local, setLocal] = useState(getWorkerBase() === LOCAL_BASE)

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2500) }

  // Pick up the URL when navigated here from another page (e.g. 세션 클릭), each time.
  useEffect(() => {
    const u = location.state?.url
    if (u) { setUrl(u); setResult(null) }
  }, [location.key])

  // When the URL's domain has a saved session, reuse it automatically.
  useEffect(() => {
    const domain = hostOf(url)
    if (!domain) { setSavedSession(null); return }
    let cancel = false
    getSessionByDomain(user.uid, domain).then((s) => { if (!cancel) setSavedSession(s) }).catch(() => {})
    return () => { cancel = true }
  }, [url, user.uid])

  const switchAnalyzer = (useLocal) => {
    setWorkerBase(useLocal ? LOCAL_BASE : '')
    setLocal(useLocal)
  }

  const run = async () => {
    if (!url) return
    setLoading(true); setError(null); setResult(null)
    // Reuse the saved domain session when the cookie box is empty.
    const effCookie = cookie.trim() || savedSession?.cookie || ''
    try {
      const res = await analyzeSite(url, effCookie)
      setResult(res)
      addHistory(user.uid, { type: 'analyze', url, count: res.count, status: res.reachable === false ? 0 : 200 }).catch(() => {})
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Persist the login cookie as a domain session (updates existing — no duplicates).
  const saveDomainSession = async () => {
    const domain = hostOf(url)
    if (!domain || !cookie.trim()) return
    try {
      await upsertSessionByDomain(user.uid, { name: domain, domain, cookie: cookie.trim() })
      setSavedSession({ domain, cookie: cookie.trim() })
      flash(`'${domain}' 세션 저장됨 — 테스터/분석에서 자동 적용됩니다 ✓`)
    } catch (e) {
      setError(`세션 저장 실패: ${e.message}`)
    }
  }

  const toTester = (ep) => {
    setActive({ ...blankRequest(), name: ep.summary || ep.url, method: ep.method, url: ep.url })
    navigate('/tester')
  }

  const saveEp = async (ep) => {
    try {
      await saveRequest(user.uid, {
        ...blankRequest(), name: ep.summary || `${ep.method} ${ep.url}`, method: ep.method, url: ep.url,
      })
      flash('저장됨 ✓')
    } catch (e) {
      setError(`저장 실패: ${e.message}`)
    }
  }

  return (
    <div className="page-pad">
      <header className="page-head">
        <h2>URL 분석</h2>
        {msg && <span className="ok">{msg}</span>}
      </header>
      <p className="muted small">
        사이트 주소를 입력하면 OpenAPI/Swagger 스펙, GraphQL 인트로스펙션, JS 번들 내 fetch/axios 호출을 탐지해 엔드포인트를 추출합니다.
        <br />공개 사이트는 그냥 분석하고, 로그인이 필요한 사이트는 아래 “🔒 쿠키”에 로그인 쿠키를 넣어 분석하세요.
      </p>

      <div className="analyzer-loc">
        <span className="muted small">분석기 위치:</span>
        <div className="seg">
          <button className={!local ? 'seg-btn on' : 'seg-btn'} onClick={() => switchAnalyzer(false)}>☁️ 클라우드</button>
          <button className={local ? 'seg-btn on' : 'seg-btn'} onClick={() => switchAnalyzer(true)}>💻 로컬(내 PC)</button>
        </div>
        <span className="muted small">
          {local
            ? '사내망 사이트는 로컬로. 이 PC에서 npm run worker:dev 실행 필요 (localhost:8787).'
            : '공개 인터넷 사이트용. 사내망/VPN 전용 사이트는 “로컬”로 전환하세요.'}
        </span>
      </div>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button className="link-btn" onClick={() => setShowCookie((v) => !v)}>
            🔒 로그인 쿠키 {cookie ? '(입력됨)' : '(선택)'} {showCookie ? '▲' : '▼'}
          </button>
          {!cookie.trim() && savedSession && (
            <span className="chip">🍪 저장된 '{savedSession.domain}' 세션 자동 사용 중</span>
          )}
        </div>
        {showCookie && (
          <>
            <textarea
              className="cookie-input"
              rows={2}
              placeholder="로그인이 필요한 사이트만: 브라우저 F12 → Application → Cookies에서 복사해 붙여넣기   예) sid=abc; token=xyz"
              value={cookie}
              onChange={(e) => setCookie(e.target.value)}
            />
            <div className="cookie-help">
              <span className="muted small">공개 사이트는 비워두세요. 입력하면 이 쿠키로 로그인된 상태로 분석합니다.</span>
              {cookie.trim() && hostOf(url) && (
                <button className="link-btn" onClick={saveDomainSession}>🍪 '{hostOf(url)}' 세션으로 저장</button>
              )}
            </div>
          </>
        )}
      </div>

      {error && <div className="error-box">{error}</div>}

      {loading && <div className="loading"><span className="spinner" /> 분석 중…</div>}

      {result && !loading && (
        <div className="analyze-result">
          {result.reachable === false && (
            <div className="error-box">
              대상 사이트에 접근할 수 없습니다 — 사내망/VPN 전용이거나, 봇 차단으로 외부(클라우드) 접근이 막혀 있을 수 있습니다.
              {!local && (
                <>
                  <br />사내망 사이트라면 <button className="link-btn" onClick={() => switchAnalyzer(true)}>💻 로컬 분석기로 전환</button> 후
                  이 PC에서 <code>npm run worker:dev</code>를 실행하고 다시 분석하세요.
                </>
              )}
            </div>
          )}
          <div className="sources">
            {result.sources.length === 0
              ? <span className="muted">{result.reachable === false ? '접근 불가' : '탐지된 API 엔드포인트가 없습니다 (SPA·로그인 필요·비표준 경로일 수 있음).'}</span>
              : result.sources.map((s, i) => <span key={i} className="source-tag">{s.type}</span>)}
            <span className="muted">· {result.count}개</span>
          </div>

          {(() => {
            const eps = result.endpoints || []
            const testable = eps.filter((e) => !e.guessed)
            const uncertain = eps.filter((e) => e.guessed)
            const row = (ep, i) => (
              <li key={i} className={`ep-item${ep.guessed ? ' ep-guess' : ''}`}>
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
            )
            return (
              <>
                <div className="ep-group-title">✅ 테스트 가능 <span className="muted">({testable.length}) — 호스트가 확실한 엔드포인트</span></div>
                {testable.length === 0
                  ? <div className="empty">바로 테스트 가능한 엔드포인트가 없습니다.</div>
                  : <ul className="ep-list">{testable.map(row)}</ul>}

                {uncertain.length > 0 && (
                  <>
                    <div className="ep-group-title warn">⚠️ 확인 필요 <span className="muted">({uncertain.length}) — 경로만 찾음, 호스트는 추정(다른 서버일 수 있음)</span></div>
                    <div className="g-warn">
                      아래는 코드에서 <b>경로만</b> 발견해 현재 사이트 주소를 붙인 추정값입니다. 실제 API는 다른 서버(백엔드/외부 SDK)에 있을 수 있어 그대로 보내면 404가 날 수 있어요.
                      정확히 하려면 <b>F12 → Network</b>에서 실제 요청의 도메인을 확인하거나, 테스터에서 <b>호스트만 바꿔</b> 보내세요.
                    </div>
                    <ul className="ep-list">{uncertain.map(row)}</ul>
                  </>
                )}
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}
