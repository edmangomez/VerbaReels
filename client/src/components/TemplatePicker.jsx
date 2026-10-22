import { TEMPLATES } from '../lib/templates.js'
import Icon from './icons.jsx'

export default function TemplatePicker({ onApply, activeId, busy }) {
  return (
    <section className="card">
      <h2 className="card-title">
        <Icon name="sparkles" size={15} /> Plantillas
      </h2>
      <p className="muted small" style={{ marginBottom: 12 }}>
        Un clic aplica fuente, color, animación, oscurecimiento y busca un fondo a juego.
      </p>
      <div className="template-grid">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`template-card ${activeId === t.id ? 'active' : ''}`}
            onClick={() => onApply(t)}
            disabled={busy}
            title={t.description}
          >
            <span className="template-thumb" style={{ background: t.preview.bg }}>
              <span style={{ color: t.preview.color, fontFamily: t.preview.font }}>Aa</span>
            </span>
            <span className="template-name">{t.emoji} {t.name}</span>
            <span className="template-desc">{t.description}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
