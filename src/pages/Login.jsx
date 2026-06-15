import { useAuth } from '../auth/AuthContext.jsx'

export default function Login() {
  const { signIn, error } = useAuth()
  return (
    <div className="center login">
      <div className="login-card">
        <div className="brand-lg">{'{ }'}</div>
        <h1>API Manager</h1>
        <p className="muted">API를 테스트하고 저장·조회하고, URL로 엔드포인트를 분석합니다.</p>
        <button className="google-btn" onClick={signIn}>
          <span className="g">G</span> Google로 로그인
        </button>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  )
}
