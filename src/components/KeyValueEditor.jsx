export default function KeyValueEditor({ rows, onChange, keyPlaceholder = 'key', valPlaceholder = 'value' }) {
  const update = (i, patch) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r))
    onChange(next)
  }
  const add = () => onChange([...rows, { key: '', value: '', enabled: true }])
  const remove = (i) => onChange(rows.filter((_, idx) => idx !== i))

  return (
    <div className="kv">
      {rows.map((r, i) => (
        <div className="kv-row" key={i}>
          <input
            type="checkbox"
            checked={r.enabled !== false}
            onChange={(e) => update(i, { enabled: e.target.checked })}
          />
          <input
            className="kv-input"
            placeholder={keyPlaceholder}
            value={r.key}
            onChange={(e) => update(i, { key: e.target.value })}
          />
          <input
            className="kv-input"
            placeholder={valPlaceholder}
            value={r.value}
            onChange={(e) => update(i, { value: e.target.value })}
          />
          <button className="icon-btn" onClick={() => remove(i)} title="삭제">✕</button>
        </div>
      ))}
      <button className="link-btn" onClick={add}>+ 추가</button>
    </div>
  )
}
