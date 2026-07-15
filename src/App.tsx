import ConnectionPanel from './components/ConnectionPanel'
import WaveformChart from './components/WaveformChart'
import FieldSelector from './components/FieldSelector'
import LogPanel from './components/LogPanel'
import { useStore } from './store/useStore'

export default function App() {
  const error = useStore((s) => s.error)
  const connected = useStore((s) => s.connected)

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>SerialScope</h1>
        <span className="subtitle">无线通信设备调试工具</span>
        {connected && <span className="status-dot" />}
      </header>

      {error && (
        <div className="error-bar">
          <span>{error}</span>
          <button onClick={() => useStore.getState().setError(null)}>×</button>
        </div>
      )}

      <div className="app-layout">
        <aside className="sidebar">
          <ConnectionPanel />
          <div className="sidebar-scroll">
            <FieldSelector />
          </div>
        </aside>
        <main className="main-content">
          <WaveformChart />
          <LogPanel />
        </main>
      </div>
    </div>
  )
}
