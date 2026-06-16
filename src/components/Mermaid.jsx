import { useEffect, useRef, useState } from 'react'

// Renders a Mermaid diagram. mermaid is loaded lazily (dynamic import) so it
// doesn't bloat the main bundle — only the guide page pulls it in.
export default function Mermaid({ chart, id = 'mmd' }) {
  const ref = useRef(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let cancelled = false
    import('mermaid').then(async ({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose', fontFamily: 'inherit' })
      try {
        const { svg } = await mermaid.render(`${id}-svg`, chart)
        if (!cancelled && ref.current) ref.current.innerHTML = svg
      } catch (e) {
        if (!cancelled) setErr(String(e?.message || e))
      }
    }).catch((e) => !cancelled && setErr(String(e)))
    return () => { cancelled = true }
  }, [chart, id])

  if (err) return <pre className="code">다이어그램 로드 실패: {err}</pre>
  return <div className="mermaid-box" ref={ref}>다이어그램 그리는 중…</div>
}
