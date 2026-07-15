import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useStore } from '../store/useStore'
import type { SerialPortInfo } from '../types'

export default function ConnectionPanel() {
  const {
    sourceType, connected, connecting, portName, baudRate, filePath, error,
    setSourceType, setConnected, setConnecting, setPortName, setBaudRate,
    setFilePath, setStreaming, addRawLog, addDataPoint, updateFields,
    setError, resetConnection,
  } = useStore()

  const [ports, setPorts] = useState<SerialPortInfo[]>([])
  const [customPort, setCustomPort] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [selectValue, setSelectValue] = useState('')

  useEffect(() => {
    invoke<SerialPortInfo[]>('list_serial_ports').then((p) => {
      setPorts(p)
      if (portName) {
        const isKnown = p.some((pp) => pp.name === portName)
        if (!isKnown) {
          setShowCustom(true)
          setCustomPort(portName)
          setSelectValue('__custom__')
        } else {
          setSelectValue(portName)
        }
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const unsub1 = listen<Record<string, number>>('data-point', (event) => {
      const fields = event.payload
      const names = Object.keys(fields)
      updateFields(names)

      addDataPoint({
        timestamp: Date.now() / 1000,
        fields,
      })
    })

    const unsub2 = listen<string>('raw-line', (event) => {
      addRawLog(event.payload)
    })

    const unsub3 = listen<string>('source-error', (event) => {
      setError(event.payload)
    })

    const unsub4 = listen<string>('source-status', (event) => {
      addRawLog(`[${new Date().toLocaleTimeString()}] ${event.payload}`)
    })

    return () => {
      unsub1.then((f) => f())
      unsub2.then((f) => f())
      unsub3.then((f) => f())
      unsub4.then((f) => f())
    }
  }, [])

  const handleSelectChange = (val: string) => {
    setSelectValue(val)
    if (val === '__custom__') {
      setShowCustom(true)
      setPortName('')
    } else {
      setShowCustom(false)
      setPortName(val)
    }
  }

  const handleConnectSerial = async () => {
    setConnecting(true)
    setError(null)
    try {
      const p = portName || customPort
      if (!p) throw new Error('No port selected')
      await invoke('stop_file_stream').catch(() => {})
      await invoke('connect_serial', { portName: p, baudRate })
      setConnected(true)
      setPortName(p)
      await invoke('start_data_stream')
      setStreaming(true)
    } catch (e: any) {
      setError(typeof e === 'string' ? e : e.message || 'Connection failed')
    } finally {
      setConnecting(false)
    }
  }

  const handleStartFile = async () => {
    setConnecting(true)
    setError(null)
    try {
      if (!filePath) throw new Error('No file path specified')
      await invoke('stop_file_stream').catch(() => {})
      await invoke('start_file_stream', { filePath, intervalMs: 250 })
      setConnected(true)
      setStreaming(true)
    } catch (e: any) {
      setError(typeof e === 'string' ? e : e.message || 'Failed to start file stream')
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      if (sourceType === 'serial') {
        await invoke('stop_data_stream')
        await invoke('disconnect_serial')
      } else {
        await invoke('stop_file_stream')
      }
    } catch { /* ignore */ }
    setStreaming(false)
    resetConnection()
  }

  return (
    <div className="panel connection-panel">
      <h3>Connection</h3>

      <div className="field-group">
        <label>Data Source</label>
        <div className="source-tabs">
          <button
            className={`tab ${sourceType === 'serial' ? 'active' : ''}`}
            onClick={() => setSourceType('serial')}
            disabled={connected}
          >
            Serial
          </button>
          <button
            className={`tab ${sourceType === 'file' ? 'active' : ''}`}
            onClick={() => setSourceType('file')}
            disabled={connected}
          >
            File
          </button>
        </div>
      </div>

      {sourceType === 'serial' ? (
        <>
          <div className="field-group">
            <label>Serial Port</label>
            <select
              value={selectValue}
              onChange={(e) => handleSelectChange(e.target.value)}
              disabled={connected}
            >
              <option value="">-- Select port --</option>
              {ports.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
              <option value="__custom__">Custom...</option>
            </select>
            {showCustom && (
              <input
                placeholder="e.g. COM3"
                value={customPort}
                onChange={(e) => {
                  setCustomPort(e.target.value)
                  setPortName(e.target.value)
                }}
                disabled={connected}
              />
            )}
          </div>

          <div className="field-group">
            <label>Baud Rate</label>
            <select
              value={baudRate}
              onChange={(e) => setBaudRate(Number(e.target.value))}
              disabled={connected}
            >
              {[9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600].map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </>
      ) : (
        <div className="field-group">
          <label>File Path</label>
          <input
            placeholder="e.g. ./test/asdf.log"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            disabled={connected}
          />
        </div>
      )}

      <div className="field-group">
        {!connected ? (
          <button
            onClick={sourceType === 'serial' ? handleConnectSerial : handleStartFile}
            disabled={connecting}
          >
            {connecting ? 'Connecting...' : sourceType === 'serial' ? 'Connect' : 'Start File Stream'}
          </button>
        ) : (
          <button onClick={handleDisconnect} className="danger">
            Disconnect
          </button>
        )}
      </div>

      {connected && <span className="status-badge connected">Connected</span>}
      {error && <div className="error-message">{error}</div>}
    </div>
  )
}
