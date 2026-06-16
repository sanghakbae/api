// Editable parameter table for documenting an API (name / type / required / memo).
export default function ParamTable({ rows, onChange }) {
  const update = (i, patch) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const add = () => onChange([...rows, { name: '', type: 'string', required: false, memo: '' }])
  const remove = (i) => onChange(rows.filter((_, idx) => idx !== i))

  return (
    <div className="ptable">
      <div className="ptable-head">
        <span>이름</span><span>타입</span><span>필수</span><span>설명</span><span></span>
      </div>
      {rows.map((r, i) => (
        <div className="ptable-row" key={i}>
          <input className="kv-input" placeholder="name" value={r.name} onChange={(e) => update(i, { name: e.target.value })} />
          <input className="kv-input" placeholder="string" value={r.type} onChange={(e) => update(i, { type: e.target.value })} />
          <input type="checkbox" checked={!!r.required} onChange={(e) => update(i, { required: e.target.checked })} title="필수" />
          <input className="kv-input" placeholder="설명" value={r.memo} onChange={(e) => update(i, { memo: e.target.value })} />
          <button className="icon-btn" onClick={() => remove(i)} title="삭제">✕</button>
        </div>
      ))}
      <button className="link-btn" onClick={add}>+ 행 추가</button>
    </div>
  )
}
