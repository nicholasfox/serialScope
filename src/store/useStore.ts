import { create } from 'zustand'
import type { FieldSelectorOption, LineStyleConfig, DataPoint, ParsedData } from '../types'

const COLORS = [
  '#FF2020', '#00DDDD', '#FFDD00', '#3388FF',
  '#00EE00', '#EE44EE', '#FF8C00', '#88FFFF',
  '#9944FF', '#CC2020', '#FF88AA', '#8888FF',
  '#88FF88', '#FFB000', '#FFFFFF', '#888888',
]

const LINE_STYLES: LineStyleConfig[] = [
  'solid',
  [5, 5],
  [2, 4],
  [10, 5],
  [10, 5, 2, 5],
  [10, 3, 2, 3, 2, 3],
  [15, 5, 5, 5],
  [8, 3, 2, 3, 2, 3],
]

const EMPTY = ''

function assignDefaultsToSelected(fields: FieldSelectorOption[]): FieldSelectorOption[] {
  const selected = fields.filter(f => f.selected)
  const usedColors = new Set<string>()
  const usedStyles = new Set<string>()
  for (const f of selected) {
    if (f.color && f.color !== EMPTY) usedColors.add(f.color)
    if (f.lineStyle && f.lineStyle !== 'solid') usedStyles.add(JSON.stringify(f.lineStyle))
  }
  let ci = 0
  let si = 0
  return fields.map(f => {
    if (!f.selected) return { ...f, color: EMPTY, lineStyle: 'solid' }
    if (f.color && f.color !== EMPTY) return f
    while (ci < COLORS.length * 2 && usedColors.has(COLORS[ci % COLORS.length])) ci++
    while (si < LINE_STYLES.length * 2 && usedStyles.has(JSON.stringify(LINE_STYLES[si % LINE_STYLES.length]))) si++
    const color = COLORS[ci % COLORS.length]
    const lineStyle = LINE_STYLES[si % LINE_STYLES.length]
    usedColors.add(color)
    usedStyles.add(JSON.stringify(lineStyle))
    ci++
    si++
    return { ...f, color, lineStyle }
  })
}

interface PersistedField {
  name: string
  color: string
  lineStyle: LineStyleConfig
}

function saveFieldConfig(fields: FieldSelectorOption[]) {
  const selected = fields.filter(f => f.selected).map(f => ({
    name: f.name,
    color: f.color,
    lineStyle: f.lineStyle,
  }))
  saveTo('selectedFields', selected)
}

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
  lineFilter: string
  rawLogs: string[]
  parsedLogs: ParsedData[]
  maxLogLines: number
  maxParsedLines: number
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
  setLineFilter: (v: string) => void
  addRawLog: (line: string) => void
  addParsedLog: (data: ParsedData) => void
  addDataPoint: (point: DataPoint) => void
  updateFields: (fieldNames: string[]) => void
  toggleField: (name: string) => void
  setFieldColor: (name: string, color: string) => void
  setFieldLineStyle: (name: string, lineStyle: LineStyleConfig) => void
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
  lineFilter: loadFrom<string>('lineFilter', ''),
  rawLogs: [],
  parsedLogs: [],
  maxParsedLines: 500,
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
  setLineFilter: (v) => { saveTo('lineFilter', v); set({ lineFilter: v }) },

  addRawLog: (line) => {
    const { rawLogs, maxLogLines } = get()
    const updated = [...rawLogs, line]
    if (updated.length > maxLogLines) updated.splice(0, updated.length - maxLogLines)
    set({ rawLogs: updated })
  },

  addParsedLog: (data) => {
    const { parsedLogs, maxParsedLines } = get()
    const updated = [...parsedLogs, data]
    if (updated.length > maxParsedLines) updated.splice(0, updated.length - maxParsedLines)
    set({ parsedLogs: updated })
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

    const noFieldsYet = fields.length === 0
    const merged = [
      ...fields,
      ...newFields.map((name) => ({
        name,
        selected: false,
        color: EMPTY,
        lineStyle: 'solid' as LineStyleConfig,
      })),
    ]
    merged.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

    const persisted = loadFrom<PersistedField[]>('selectedFields', [])
    if (persisted.length > 0) {
      const map = new Map(persisted.map(p => [p.name, p]))
      for (const f of merged) {
        const p = map.get(f.name)
        if (p) {
          f.selected = true
          f.color = p.color || EMPTY
          f.lineStyle = p.lineStyle !== undefined ? p.lineStyle : 'solid'
        }
      }
    } else if (noFieldsYet && merged.length > 0) {
      merged[0].selected = true
    }

    set({ fields: assignDefaultsToSelected(merged) })
  },

  toggleField: (name) => {
    const { fields } = get()
    const updated = fields.map((f) =>
      f.name === name ? { ...f, selected: !f.selected } : f,
    )
    const assigned = assignDefaultsToSelected(updated)
    set({ fields: assigned })
    saveFieldConfig(assigned)
  },

  setFieldColor: (name, color) => {
    const { fields } = get()
    const updated = fields.map(f => f.name === name ? { ...f, color } : f)
    set({ fields: updated })
    saveFieldConfig(updated)
  },

  setFieldLineStyle: (name, lineStyle) => {
    const { fields } = get()
    const updated = fields.map(f => f.name === name ? { ...f, lineStyle } : f)
    set({ fields: updated })
    saveFieldConfig(updated)
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
