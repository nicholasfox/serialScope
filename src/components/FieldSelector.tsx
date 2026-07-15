import { useStore } from '../store/useStore'
import type { LineStyleConfig } from '../types'

const LINE_STYLE_OPTIONS: { value: LineStyleConfig; label: string; title: string }[] = [
  { value: 'solid', label: '━━━', title: '实线' },
  { value: [5, 5], label: '━ ━', title: '虚线' },
  { value: [2, 4], label: '···', title: '点线' },
  { value: [10, 5], label: '━━ ━', title: '长划线' },
  { value: [10, 5, 2, 5], label: '━·━·', title: '划线点' },
  { value: [10, 3, 2, 3, 2, 3], label: '━··━', title: '划线双点' },
  { value: [15, 5, 5, 5], label: '━ ━━', title: '长短组合' },
  { value: [8, 3, 2, 3, 2, 3], label: '━··', title: '双点划线' },
]

function styleIndex(ls: LineStyleConfig): number {
  const s = JSON.stringify(ls)
  return LINE_STYLE_OPTIONS.findIndex(o => JSON.stringify(o.value) === s)
}

export default function FieldSelector() {
  const { fields, lineFilter, toggleField, setLineFilter, setFieldColor, setFieldLineStyle } = useStore()

  const selected = fields.filter((f) => f.selected)
  const available = fields.filter((f) => !f.selected)

  return (
    <div className="panel field-panel">
      <h3>Line Filter</h3>
      <div className="field-group">
        <input
          placeholder="逗号分隔，如 CNT, ASDF"
          value={lineFilter}
          onChange={(e) => setLineFilter(e.target.value)}
          className="filter-input"
        />
        <span className="hint">只解析以这些前缀开头的行</span>
      </div>

      <h3>Selected (波形显示)</h3>
      <div className="field-list selected-list">
        {selected.length === 0 ? (
          <span className="hint">从下方勾选字段</span>
        ) : (
          selected.map((f) => {
            const si = styleIndex(f.lineStyle)
            return (
              <div key={f.name} className="selected-row">
                <div className="color-picker-wrap">
                  <input
                    type="color"
                    value={f.color || '#ff0000'}
                    onChange={(e) => setFieldColor(f.name, e.target.value)}
                    title="选择颜色"
                  />
                </div>
                <select
                  className="line-style-select"
                  value={si >= 0 ? si.toString() : '0'}
                  onChange={(e) => setFieldLineStyle(f.name, LINE_STYLE_OPTIONS[Number(e.target.value)].value)}
                >
                  {LINE_STYLE_OPTIONS.map((opt, i) => (
                    <option key={i} value={i} title={opt.title}>{opt.label}</option>
                  ))}
                </select>
                <span className="field-name">{f.name}</span>
                <button
                  className="chip-remove"
                  onClick={() => toggleField(f.name)}
                  title="移除"
                >
                  ×
                </button>
              </div>
            )
          })
        )}
      </div>

      <h3>Available</h3>
      <div className="field-list available-list">
        {available.length === 0 ? (
          <span className="hint">暂无可用字段</span>
        ) : (
          available.map((f) => (
            <label key={f.name} className="field-item">
              <input
                type="checkbox"
                checked={false}
                onChange={() => toggleField(f.name)}
              />
              <span>{f.name}</span>
            </label>
          ))
        )}
      </div>
    </div>
  )
}