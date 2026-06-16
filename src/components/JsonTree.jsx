import { useState } from 'react'

// Collapsible JSON tree. Objects/arrays can be expanded/collapsed.
export default function JsonTree({ data, name, depth = 0, defaultOpen = true }) {
  const [open, setOpen] = useState(depth < 2 ? defaultOpen : false)
  const isObj = data && typeof data === 'object'

  if (!isObj) {
    return (
      <div className="jt-row" style={{ paddingLeft: depth * 14 }}>
        {name !== undefined && <span className="jt-key">{name}: </span>}
        <span className={`jt-val jt-${data === null ? 'null' : typeof data}`}>
          {typeof data === 'string' ? `"${data}"` : String(data)}
        </span>
      </div>
    )
  }

  const entries = Array.isArray(data) ? data.map((v, i) => [i, v]) : Object.entries(data)
  const bracket = Array.isArray(data) ? ['[', ']'] : ['{', '}']

  return (
    <div>
      <div className="jt-row jt-toggle" style={{ paddingLeft: depth * 14 }} onClick={() => setOpen((o) => !o)}>
        <span className="jt-caret">{open ? '▾' : '▸'}</span>
        {name !== undefined && <span className="jt-key">{name}: </span>}
        <span className="jt-bracket">{bracket[0]}</span>
        {!open && <span className="jt-muted">{entries.length}{Array.isArray(data) ? ' items' : ' keys'}{bracket[1]}</span>}
      </div>
      {open && (
        <>
          {entries.map(([k, v]) => (
            <JsonTree key={k} name={k} data={v} depth={depth + 1} />
          ))}
          <div className="jt-row" style={{ paddingLeft: depth * 14 }}><span className="jt-bracket">{bracket[1]}</span></div>
        </>
      )}
    </div>
  )
}
