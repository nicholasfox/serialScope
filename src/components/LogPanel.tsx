import { useRef, useEffect, useState } from 'react'
import { useStore } from '../store/useStore'

export default function LogPanel() {
  const { rawLogs, parsedLogs } = useStore()
  const [tab, setTab] = useState<'raw' | 'parsed'>('raw')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [rawLogs.length, parsedLogs.length])

  return (
    <div className="panel log-panel">
      <h3>Log</h3>
      <div className="log-tabs">
        <button
          className={`tab ${tab === 'raw' ? 'active' : ''}`}
          onClick={() => setTab('raw')}
        >
          Raw
        </button>
        <button
          className={`tab ${tab === 'parsed' ? 'active' : ''}`}
          onClick={() => setTab('parsed')}
        >
          Parsed
        </button>
      </div>
      <div className="log-container" ref={containerRef}>
        {tab === 'raw' ? (
          rawLogs.length === 0 ? (
            <span className="hint">Waiting for data...</span>
          ) : (
            rawLogs.map((line, i) => (
              <div key={i} className="log-line">{line}</div>
            ))
          )
        ) : (
          parsedLogs.length === 0 ? (
            <span className="hint">Waiting for data...</span>
          ) : (
            parsedLogs.map((entry, i) => (
              <div key={i} className="log-line parsed-line">
                <span className="parsed-fields">
                  {[
                    ...Object.entries(entry.numeric_fields).map(([k, v]) =>
                      `${k}=${v}`
                    ),
                    ...Object.entries(entry.string_fields).map(([k, v]) =>
                      `${k}="${v}"`
                    ),
                    ...Object.entries(entry.array_fields).map(([k, v]) =>
                      `${k}={${v.join(',')}}`
                    ),
                  ].join(', ')}
                </span>
              </div>
            ))
          )
        )}
      </div>
    </div>
  )
}