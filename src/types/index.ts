export interface SerialPortInfo {
  name: string
  available: boolean
}

export interface ParsedData {
  timestamp: number
  raw: string
  numeric_fields: Record<string, number>
  string_fields: Record<string, string>
  array_fields: Record<string, number[]>
}

export interface FieldSelectorOption {
  name: string
  selected: boolean
  color: string
}

export interface ConnectionConfig {
  type: 'serial' | 'ssh' | 'telnet'
  portName?: string
  baudRate?: number
  host?: string
  port?: number
  username?: string
  password?: string
  command?: string
}

export interface DataPoint {
  timestamp: number
  fields: Record<string, number>
}
