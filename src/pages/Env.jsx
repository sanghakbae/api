import { useState } from 'react'
import { getEnv, setEnv } from '../lib/env.js'

export default function Env() {
  const [rows, setRows] = useState(() => {
    const e = getEnv()
    const r = Object.entries(e).map(([key, value]) => ({ key, value }))
    return r.length ? r : [{ key: '', value: '' }]
  })
  const [msg, setMsg] = useState('')

  const update = (i, patch) => setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const add = () => setRows([...rows, { key: '', value: '' }])
  const remove = (i) => setRows(rows.filter((_, idx) => idx !== i))

  const save = () => {
    const obj = {}
    for (const r of rows) if (r.key.trim()) obj[r.key.trim()] = r.value
    setEnv(obj)
    setMsg('저장됨 ✓'); setTimeout(() => setMsg(''), 2000)
  }

  return (
    <div className="page-pad">
      <header className="page-head">
        <h2>환경변수</h2>
        <div className="head-actions">
          {msg && <span className="ok">{msg}</span>}
          <button className="btn primary" onClick={save}>💾 저장</button>
        </div>
      </header>
      <p className="muted small">
        자주 쓰는 값을 변수로 저장해두고, 테스터의 주소·헤더·바디 어디서나 <code>{'{{이름}}'}</code> 으로 끼워 넣으세요.
        <br />예: 이름 <code>baseUrl</code> = <code>https://api.example.com</code> → 주소칸에 <code>{'{{baseUrl}}/users'}</code> 라고 쓰면 전송할 때 자동으로 바뀝니다.
      </p>

      <div className="kv env-kv">
        {rows.map((r, i) => (
          <div className="kv-row" key={i}>
            <input className="kv-input" placeholder="이름 (예: baseUrl)" value={r.key} onChange={(e) => update(i, { key: e.target.value })} />
            <input className="kv-input" placeholder="값 (예: https://api.example.com)" value={r.value} onChange={(e) => update(i, { value: e.target.value })} />
            <button className="icon-btn" onClick={() => remove(i)} title="삭제">✕</button>
          </div>
        ))}
        <button className="link-btn" onClick={add}>+ 변수 추가</button>
      </div>
    </div>
  )
}
