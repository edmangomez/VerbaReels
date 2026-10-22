import { downloadVideo } from '../lib/api.js'

const STEPS = [
  { key: 'En cola', label: 'En cola…' },
  { key: 'Sintetizando', label: 'Sintetizando voz…' },
  { key: 'Iniciando', label: 'Iniciando render…' },
  { key: 'Renderizando', label: 'Renderizando video…' },
  { key: 'Generando miniatura', label: 'Generando miniatura…' },
  { key: 'Generando descripción', label: 'Generando descripción…' },
]

function matchStep(renderStep) {
  if (!renderStep) return -1
  return STEPS.findIndex((s) => renderStep.includes(s.key))
}

export default function RenderPanel({ mode, disabled, onExport, onRender, exporting, rendering, result, onReset, error, renderStep, progress }) {
  const isReel = mode !== 'post'
  const handle = onExport || onRender

  if (exporting || rendering) {
    const activeIdx = matchStep(renderStep)
    return (
      <section className="card render-panel">
        <h2 className="card-title">
          {isReel ? '🎬 Exportando reel' : '🖼️ Exportando post'}
        </h2>
        <div className="render-loading">
          <span className="spinner big" />
          {isReel && renderStep ? (
            <div className="render-steps">
              {STEPS.map((s, i) => {
                const done = i < activeIdx
                const active = i === activeIdx
                return (
                  <div
                    key={s.key}
                    className={`render-step ${done ? 'done' : ''} ${active ? 'active' : ''}`}
                  >
                    <span className="step-dot">{done ? '✓' : active ? '●' : '○'}</span>
                    <span className="step-label">{s.label}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p>Exportando {isReel ? 'tu reel' : 'tu post'}… hasta 1 minuto</p>
          )}
          {isReel && typeof progress === 'number' && (
            <div className="render-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="render-progress-track">
                <div className="render-progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <span className="render-progress-label">{progress}%</span>
            </div>
          )}
          <p className="muted small">No cierres esta pestaña mientras se procesa.</p>
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="card render-panel">
        <h2 className="card-title">📤 Exportar</h2>
        <p className="error-msg">❌ {error}</p>
        <button className="btn btn-secondary" onClick={onReset} style={{ marginTop: '0.75rem' }}>
          🔄 Intentar de nuevo
        </button>
      </section>
    )
  }

  if (result) {
    const isPostResult = !isReel || (!result.videoUrl && result.imageUrl)
    if (isPostResult && result.imageUrl) {
      return (
        <section className="card render-panel">
          <h2 className="card-title">✅ ¡Tu post está listo!</h2>
          <img className="export-image" src={result.imageUrl} alt="Post exportado" />
          <div className="render-actions">
            <a className="btn btn-primary" href={result.imageUrl} download="post.png">
              ⬇️ Descargar PNG
            </a>
            <button className="btn btn-secondary" onClick={onReset}>
              🔄 Crear otro
            </button>
          </div>
        </section>
      )
    }

    if (result.videoUrl) {
      return (
        <section className="card render-panel">
          <h2 className="card-title">✅ ¡Tu reel está listo!</h2>
          {result.duration != null && (
            <span className="duration-badge">⏱️ {result.duration}s</span>
          )}
          <video
            className="render-video"
            src={result.videoUrl}
            poster={result.thumbUrl || undefined}
            controls
            playsInline
          />
          <div className="render-actions">
            <a
              className="btn btn-primary"
              href={result.videoUrl}
              download="reel.mp4"
              onClick={(e) => {
                e.preventDefault()
                downloadVideo(result.videoUrl)
              }}
            >
              ⬇️ Descargar MP4
            </a>
            <button className="btn btn-secondary" onClick={onReset}>
              🔄 Crear otro
            </button>
          </div>
        </section>
      )
    }
  }

  return (
    <section className="card render-panel">
      <h2 className="card-title">📤 Exportar</h2>
      <button className="btn btn-primary btn-big" onClick={handle} disabled={disabled}>
        {isReel ? '🎬 Exportar Reel' : '🖼️ Exportar Post'}
      </button>
      {disabled && (
        <p className="muted small">Escribe una frase y elige un fondo.</p>
      )}
    </section>
  )
}
