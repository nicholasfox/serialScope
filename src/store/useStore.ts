import { create } from 'zustand'
import type { FieldSelectorOption, DataPoint } from '../types'

const COLORS = [
  '#0072B2',  // blue
  '#E69F00',  // orange
  '#009E73',  // green
  '#F0E442',  // yellow
  '#56B4E9',  // sky blue
  '#D55E00',  // vermillion
  '#CC79A7',  // pink
  '#999999',  // grey
]

type SourceType = 'serial' | 'file'

const PREFIX = 'ss_'

function loadFrom<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}
function saveTo(key: string, value: unknown) {
  localStorage.setItem(PREFIX + key, JSON.stringify(value))
}

interface AppStore {
  sourceType: SourceType
  connected: boolean
  connecting: boolean
  portName: string
  baudRate: number
  filePath: string
  rawLogs: string[]
  maxLogLines: number
  dataPoints: DataPoint[]
  maxDataPoints: number
  maxPoints: number
  fields: FieldSelectorOption[]
  streaming: boolean
  error: string | null

  setSourceType: (v: SourceType) => void
  setConnected: (v: boolean) => void
  setConnecting: (v: boolean) => void
  setPortName: (v: string) => void
  setBaudRate: (v: number) => void
  setFilePath: (v: string) => void
  addRawLog: (line: string) => void
  addDataPoint: (point: DataPoint) => void
  updateFields: (fieldNames: string[]) => void
  toggleField: (name: string) => void
  setStreaming: (v: boolean) => void
  setError: (v: string | null) => void
  setMaxPoints: (v: number) => void
  resetConnection: () => void
}

export const useStore = create<AppStore>((set, get) => ({
  sourceType: loadFrom<SourceType>('sourceType', 'serial'),
  connected: false,
  connecting: false,
  portName: loadFrom<string>('portName', ''),
  baudRate: loadFrom<number>('baudRate', 115200),
  filePath: loadFrom<string>('filePath', ''),
  rawLogs: [],
  maxLogLines: 1000,
  dataPoints: [],
  maxDataPoints: 10000,
  maxPoints: loadFrom<number>('maxPoints', 500),
  fields: [],
  streaming: false,
  error: null,

  setSourceType: (v) => { saveTo('sourceType', v); set({ sourceType: v }) },
  setConnected: (v) => set({ connected: v }),
  setConnecting: (v) => set({ connecting: v }),
  setPortName: (v) => { saveTo('portName', v); set({ portName: v }) },
  setBaudRate: (v) => { saveTo('baudRate', v); set({ baudRate: v }) },
  setFilePath: (v) => { saveTo('filePath', v); set({ filePath: v }) },

  addRawLog: (line) => {
    const { rawLogs, maxLogLines } = get()
    const updated = [...rawLogs, line]
    if (updated.length > maxLogLines) updated.splice(0, updated.length - maxLogLines)
    set({ rawLogs: updated })
  },

  addDataPoint: (point) => {
    const { dataPoints, maxDataPoints } = get()
    if (dataPoints.length >= maxDataPoints) {
      set({ dataPoints: [...dataPoints.slice(-maxDataPoints + 1), point] })
    } else {
      set({ dataPoints: [...dataPoints, point] })
    }
  },

  updateFields: (fieldNames) => {
    const { fields } = get()
    const existing = new Set(fields.map((f) => f.name))
    const newFields = fieldNames.filter((n) => !existing.has(n))
    if (newFields.length === 0) return

    const colorIndex = fields.length
    const noFieldsYet = fields.length === 0
    const merged = [
      ...fields,
      ...newFields.map((name, i) => ({
        name,
        selected: noFieldsYet && i === 0,
        color: COLORS[(colorIndex + i) % COLORS.length],
      })),
    ]
    merged.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

    const persisted = loadFrom<string[]>('selectedFields', [])
    if (persisted.length > 0) {
      const ps = new Set(persisted)
      for (const f of merged) f.selected = ps.has(f.name)
    }

    set({ fields: merged })
  },

  toggleField: (name) => {
    const { fields } = get()
    const updated = fields.map((f) =>
      f.name === name ? { ...f, selected: !f.selected } : f,
    )
    set({ fields: updated })
    saveTo('selectedFields', updated.filter(f => f.selected).map(f => f.name))
  },

  setStreaming: (v) => set({ streaming: v }),
  setError: (v) => set({ error: v }),

  setMaxPoints: (v) => { saveTo('maxPoints', v); set({ maxPoints: v }) },

  resetConnection: () => {
    set({
      connected: false,
      connecting: false,
      streaming: false,
      error: null,
      dataPoints: [],
      fields: [],
    })
  },
}))
