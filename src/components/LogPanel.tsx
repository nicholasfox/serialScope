import { useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'

export default function LogPanel() {
  const { rawLogs } = useStore()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [rawLogs.length])

  return (
    <div className="panel log-panel">
      <h3>Raw Log</h3>
      <div className="log-container" ref={containerRef}>
        {rawLogs.length === 0 ? (
          <span className="hint">Waiting for data...</span>
        ) : (
          rawLogs.map((line, i) => (
            <div key={i} className="log-line">
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
