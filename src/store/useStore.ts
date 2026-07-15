import { create } from 'zustand'
import type { FieldSelectorOption, DataPoint } from '../types'

const COLORS = [
  '#5470c6', '#91cc75', '#fac858', '#ee6666',
  '#73c0de', '#3ba272', '#fc8452', '#9a60b4',
  '#ea7ccc', '#2f4554',
]

interface AppStore {
  connected: boolean
  connecting: boolean
  portName: string
  baudRate: number
  rawLogs: string[]
  maxLogLines: number
  dataPoints: DataPoint[]
  maxDataPoints: number
  fields: FieldSelectorOption[]
  streaming: boolean
  error: string | null

  setConnected: (v: boolean) => void
  setConnecting: (v: boolean) => void
  setPortName: (v: string) => void
  setBaudRate: (v: number) => void
  addRawLog: (line: string) => void
  addDataPoint: (point: DataPoint) => void
  updateFields: (fieldNames: string[]) => void
  toggleField: (name: string) => void
  setStreaming: (v: boolean) => void
  setError: (v: string | null) => void
  resetConnection: () => void
}

export const useStore = create<AppStore>((set, get) => ({
  connected: false,
  connecting: false,
  portName: '',
  baudRate: 115200,
  rawLogs: [],
  maxLogLines: 1000,
  dataPoints: [],
  maxDataPoints: 10000,
  fields: [],
  streaming: false,
  error: null,

  setConnected: (v) => set({ connected: v }),
  setConnecting: (v) => set({ connecting: v }),
  setPortName: (v) => set({ portName: v }),
  setBaudRate: (v) => set({ baudRate: v }),

  addRawLog: (line) => {
    const { rawLogs, maxLogLines } = get()
    const updated = [...rawLogs, line]
    if (updated.length > maxLogLines) updated.splice(0, updated.length - maxLogLines)
    set({ rawLogs: updated })
  },

  addDataPoint: (point) => {
    const { dataPoints, maxDataPoints } = get()
    const updated = [...dataPoints, point]
    if (updated.length > maxDataPoints) updated.splice(0, updated.length - maxDataPoints)
    set({ dataPoints: updated })
  },

  updateFields: (fieldNames) => {
    const { fields } = get()
    const existing = new Set(fields.map((f) => f.name))
    const newFields = fieldNames.filter((n) => !existing.has(n))
    if (newFields.length === 0) return

    const colorIndex = fields.length
    set({
      fields: [
        ...fields,
        ...newFields.map((name, i) => ({
          name,
          selected: true,
          color: COLORS[(colorIndex + i) % COLORS.length],
        })),
      ],
    })
  },

  toggleField: (name) => {
    set({
      fields: get().fields.map((f) =>
        f.name === name ? { ...f, selected: !f.selected } : f,
      ),
    })
  },

  setStreaming: (v) => set({ streaming: v }),
  setError: (v) => set({ error: v }),

  resetConnection: () => {
    set({
      connected: false,
      connecting: false,
      streaming: false,
      error: null,
    })
  },
}))
