import { useStore } from '../store/useStore'

export default function FieldSelector() {
  const { fields, toggleField } = useStore()

  if (fields.length === 0) {
    return (
      <div className="panel field-selector-panel">
        <h3>Fields</h3>
        <p className="hint">Connect and start streaming to see available fields.</p>
      </div>
    )
  }

  return (
    <div className="panel field-selector-panel">
      <h3>Fields</h3>
      <div className="field-list">
        {fields.map((f) => (
          <label key={f.name} className="field-item">
            <input
              type="checkbox"
              checked={f.selected}
              onChange={() => toggleField(f.name)}
            />
            <span
              className="color-dot"
              style={{ backgroundColor: f.color }}
            />
            <span className="field-name">{f.name}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
