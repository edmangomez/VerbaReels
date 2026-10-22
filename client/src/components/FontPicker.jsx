import { ANIMATIONS, autoDuration } from '../lib/timing.js'
import Icon from './icons.jsx'

const PRESETS = ['#FFFFFF', '#FDE047', '#F472B6', '#8B5CF6', '#22D3EE', '#F97316']

const ANIM_LABELS = {
  'fade-pop': (
    <>
      <Icon name="sparkles" size={13} /> Fade + Pop
    </>
  ),
  'slide-up': (
    <>
      <Icon name="arrowUp" size={13} /> Deslizarse
    </>
  ),
  'typewriter': (
    <>
      <Icon name="keyboard" size={13} /> Máquina
    </>
  ),
  'static': (
    <>
      <Icon name="ban" size={13} /> Estático
    </>
  ),
  'full-phrase': (
    <>
      <Icon name="pin" size={13} /> Frase completa
    </>
  ),
}

const DURATION_PRESETS = [3, 5, 7, 10, 15, 20, 30, 45, 60]

const BOX_PRESETS = [
  { label: 'Ninguno', value: '', color: 'transparent' },
  { label: 'Negro', value: 'rgba(0,0,0,0.75)', color: '#111827' },
  { label: 'Blanco', value: 'rgba(255,255,255,0.92)', color: '#FFFFFF' },
  { label: 'Amarillo', value: '#FDE047', color: '#FDE047' },
  { label: 'Cian', value: '#22D3EE', color: '#22D3EE' },
  { label: 'Morado', value: '#8B5CF6', color: '#8B5CF6' },
]

const SLIDERS = [
  { key: 'fontSize', label: 'Tamaño (px)', min: 20, max: 140, step: 1 },
  { key: 'boxWidth', label: 'Ancho de caja (%)', min: 30, max: 95, step: 1 },
  { key: 'positionY', label: 'Posición vertical (%)', min: 15, max: 80, step: 1 },
  { key: 'positionX', label: 'Posición horizontal (%)', min: 15, max: 85, step: 1 },
  { key: 'letterSpacing', label: 'Espaciado letras (px)', min: -2, max: 16, step: 1 },
  { key: 'lineHeight', label: 'Interlineado', min: 0.9, max: 2.2, step: 0.05 },
  { key: 'shadow', label: 'Sombra', min: 0, max: 8, step: 1 },
  { key: 'outline', label: 'Contorno', min: 0, max: 8, step: 1 },
  { key: 'overlay', label: 'Oscurecer fondo (%)', min: 0, max: 80, step: 5 },
]

export default function FontPicker({ fonts, fontId, setFontId, textColor, setTextColor, duration, setDuration, style, setStyle, phrase, mode }) {
  const isReel = mode !== 'post'

  const selectedFont = fonts.find((f) => f.id === fontId)
  const selectedFamily = selectedFont ? `'${selectedFont.family || selectedFont.name}', sans-serif` : "'Montserrat', sans-serif"
  const isBold = style.bold === true || (style.bold == null && (selectedFont?.weight || 400) >= 600)

  const setStyleField = (field, value) => {
    setStyle((s) => ({ ...s, [field]: value }))
  }

  // el slider "palabras por bloque" solo aplica a animaciones con bloques
  const usesBlocks = ['fade-pop', 'slide-up', 'typewriter'].includes(style.animation)

  const autoSec = autoDuration(phrase || '')
  const effDurationSec = duration === 'auto' ? autoSec : (Number(duration) || 10)
  const hasPhrase = Boolean(phrase && phrase.trim())
  const autoHint = hasPhrase
    ? `≈${autoSec}s para tu frase`
    : 'se calcula según tu frase'

  const sampleSize = 16 + (Number(style.fontSize) - 20) * 0.12

  return (
    <section className="card">
      <h2 className="card-title">
        <Icon name="brush" size={15} /> Estilo del texto
      </h2>

      <div className="font-grid">
        {fonts.map((f) => (
          <button
            key={f.id}
            className={`font-card ${f.id === fontId ? 'active' : ''}`}
            onClick={() => setFontId(f.id)}
            style={{ fontFamily: `'${f.family || f.name}', sans-serif` }}
          >
            <span className="font-glyph">Aa</span>
            <span className="font-name">{f.name}</span>
          </button>
        ))}
        {fonts.length === 0 && <p className="muted">Cargando fuentes...</p>}
      </div>

      {/* Formato y alineación estilo Canva */}
      <div className="font-format-block panel-divider">
        <div className="font-format-header">
          <label className="label">
            <Icon name="text" size={13} /> Formato y alineación
          </label>
        </div>

        <div className="format-toolbar-card">
          {/* Fila 1: Estilo tipográfico */}
          <div className="format-segmented-strip" role="group" aria-label="Estilo tipográfico">
            <button
              type="button"
              className={`format-tool-btn ${isBold ? 'active' : ''}`}
              onClick={() => setStyleField('bold', !isBold)}
              title="Negrita"
              aria-label="Negrita"
              aria-pressed={isBold}
            >
              <strong className="format-glyph-bold">B</strong>
            </button>
            <button
              type="button"
              className={`format-tool-btn ${style.italic ? 'active' : ''}`}
              onClick={() => setStyleField('italic', !style.italic)}
              title="Cursiva"
              aria-label="Cursiva"
              aria-pressed={!!style.italic}
            >
              <em className="format-glyph-italic">I</em>
            </button>
            <button
              type="button"
              className={`format-tool-btn ${style.uppercase ? 'active' : ''}`}
              onClick={() => setStyleField('uppercase', !style.uppercase)}
              title="Mayúsculas"
              aria-label="Mayúsculas"
              aria-pressed={!!style.uppercase}
            >
              <span className="format-glyph-caps">aA</span>
            </button>
          </div>

          {/* Fila 2: Alineación */}
          <div className="format-segmented-strip" role="group" aria-label="Alineación del texto">
            {[
              { id: 'left', label: 'Izquierda', shortLabel: 'Izq', icon: 'alignLeft' },
              { id: 'center', label: 'Centro', shortLabel: 'Centro', icon: 'alignCenter' },
              { id: 'right', label: 'Derecha', shortLabel: 'Der', icon: 'alignRight' },
            ].map((item) => {
              const active = (style.textAlign || 'center') === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`format-tool-btn ${active ? 'active' : ''}`}
                  onClick={() => setStyleField('textAlign', item.id)}
                  title={`Alinear a la ${item.label.toLowerCase()}`}
                  aria-label={`Alinear a la ${item.label.toLowerCase()}`}
                  aria-pressed={active}
                >
                  <Icon name={item.icon} size={15} />
                  <span className="format-btn-label">{item.shortLabel}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Fondo de texto (Sticker / Resaltado) */}
      <div className="box-bg-block panel-divider">
        <label className="label">Fondo de texto (Sticker)</label>
        <div className="box-presets-row">
          {BOX_PRESETS.map((p) => {
            const active = (style.boxBg || '') === p.value
            return (
              <button
                key={p.label}
                type="button"
                className={`box-preset-pill ${active ? 'active' : ''}`}
                onClick={() => setStyleField('boxBg', p.value)}
              >
                <span className="box-preset-dot" style={{ backgroundColor: p.color, border: p.value ? 'none' : '1px dashed #6b7280' }} />
                <span>{p.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="color-block panel-divider">
        <label className="label">Color del texto</label>
        <div className="color-controls">
          <input
            type="color"
            value={textColor}
            onChange={(e) => setTextColor(e.target.value)}
            className="color-input"
          />
          <div className="presets">
            {PRESETS.map((c) => (
              <button
                key={c}
                className={`preset ${textColor.toLowerCase() === c.toLowerCase() ? 'active' : ''}`}
                style={{ background: c }}
                onClick={() => setTextColor(c)}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>
      </div>

      {isReel && (
        <div className="duration-block panel-divider">
          <div className="duration-block-head">
            <label className="label">⏱️ Duración del video</label>
            <span className="duration-current-badge">
              {duration === 'auto' ? `Auto (${effDurationSec.toFixed(1)}s)` : `${Number(duration).toFixed(1)}s`}
            </span>
          </div>

          {/* Toggle de Modo: Automático vs Personalizado libre */}
          <div className="duration-mode-toggle">
            <button
              type="button"
              className={`duration-mode-btn ${duration === 'auto' ? 'active' : ''}`}
              onClick={() => setDuration('auto')}
              title="Calcula automáticamente la duración óptima según tu frase"
            >
              <Icon name="sparkles" size={13} />
              <span>Automático</span>
            </button>
            <button
              type="button"
              className={`duration-mode-btn ${duration !== 'auto' ? 'active' : ''}`}
              onClick={() => {
                if (duration === 'auto') setDuration(effDurationSec)
              }}
              title="Elige con libertad cuántos segundos dura el video"
            >
              <Icon name="clock" size={13} />
              <span>Personalizado</span>
            </button>
          </div>

          {duration === 'auto' ? (
            <div className="duration-auto-box">
              <p className="auto-hint">
                ✦ {autoHint} (aprox. {effDurationSec.toFixed(1)} seg). El tiempo se calcula según tu frase.
              </p>
              <button
                type="button"
                className="duration-switch-custom-btn"
                onClick={() => setDuration(effDurationSec)}
              >
                Definir segundos manualmente
              </button>
            </div>
          ) : (
            <div className="duration-custom-box">
              {/* Input numérico directo para libertad total */}
              <div className="duration-input-row">
                <div className="duration-input-wrapper">
                  <input
                    type="number"
                    min="1"
                    max="180"
                    step="0.5"
                    value={duration}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value)
                      if (!isNaN(val)) {
                        setDuration(Math.max(1, Math.min(180, Math.round(val * 10) / 10)))
                      }
                    }}
                    className="duration-number-input"
                    aria-label="Duración en segundos"
                  />
                  <span className="duration-unit">seg</span>
                </div>
                <div className="duration-quick-adjust">
                  <button
                    type="button"
                    className="duration-adj-btn"
                    onClick={() => setDuration(Math.max(1, Math.round((Number(duration) - 1) * 10) / 10))}
                    title="Restar 1 segundo"
                  >
                    -1s
                  </button>
                  <button
                    type="button"
                    className="duration-adj-btn"
                    onClick={() => setDuration(Math.min(180, Math.round((Number(duration) + 1) * 10) / 10))}
                    title="Sumar 1 segundo"
                  >
                    +1s
                  </button>
                </div>
              </div>

              {/* Slider continuo */}
              <div className="duration-slider-row">
                <input
                  type="range"
                  className="range-bar"
                  min="2"
                  max="60"
                  step="0.5"
                  value={Math.min(60, Number(duration) || 10)}
                  style={{ '--fill': `${((Math.min(60, Number(duration) || 10) - 2) / (60 - 2)) * 100}%` }}
                  onChange={(e) => setDuration(parseFloat(e.target.value))}
                />
              </div>

              {/* Atajos de duraciones comunes */}
              <div className="duration-chips-grid">
                {DURATION_PRESETS.map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    className={`radio-chip duration-preset-chip ${Number(duration) === sec ? 'active' : ''}`}
                    onClick={() => setDuration(sec)}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isReel && (
        <div className="anim-block panel-divider">
          <label className="label">Animación</label>
          <div className="anim-options">
            {ANIMATIONS.map((a) => (
              <label key={a} className={`radio-chip ${style.animation === a ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="animation"
                  value={a}
                  checked={style.animation === a}
                  onChange={() => setStyleField('animation', a)}
                />
                {ANIM_LABELS[a] || a}
              </label>
            ))}
          </div>
          {/* Ken Burns toggle */}
          <label className="toggle-row" style={{ marginTop: '10px' }}>
            <input
              type="checkbox"
              checked={!!style.kenBurns}
              onChange={(e) => setStyleField('kenBurns', e.target.checked)}
            />
            <span className="toggle-label">
              <Icon name="zap" size={13} /> Ken Burns <span className="muted small">(zoom lento al fondo)</span>
            </span>
          </label>
        </div>
      )}

      {isReel && usesBlocks && (
        <div className="sliders-grid panel-divider">
          <div className="slider-row">
            <div className="slider-head">
              <label className="label">Palabras por bloque</label>
              <span className="slider-value">{style.wordsPerBlock}</span>
            </div>
            <input
              type="range"
              className="range-bar"
              min={1}
              max={4}
              step={1}
              value={style.wordsPerBlock}
              style={{ '--fill': `${((Number(style.wordsPerBlock) - 1) / 3) * 100}%` }}
              onChange={(e) => setStyleField('wordsPerBlock', Number(e.target.value))}
            />
          </div>
        </div>
      )}

      <div className="sliders-grid panel-divider">
        {SLIDERS.map(({ key, label, min, max, step }) => {
          const value = Number(style[key]) || 0
          const pct = ((value - min) / (max - min)) * 100
          return (
            <div key={key} className="slider-row">
              <div className="slider-head">
                <label className="label">{label}</label>
                <span className="slider-value">{style[key]}</span>
              </div>
              <input
                type="range"
                className="range-bar"
                min={min}
                max={max}
                step={step}
                value={style[key]}
                style={{ '--fill': `${pct}%` }}
                onChange={(e) => setStyleField(key, Number(e.target.value))}
              />
              {key === 'fontSize' && (
                <>
                  <div className="size-sample" style={{ fontSize: `${sampleSize}px`, fontFamily: selectedFamily }}>
                    Aa
                  </div>
                  <span className="hint">20 = muy pequeño · 140 = muy grande</span>
                </>
              )}
            </div>
          )
        })}
      </div>

      {selectedFont && (
        <p className="muted small">
          Vista previa con <strong style={{ fontFamily: selectedFamily }}>{selectedFont.name}</strong>
        </p>
      )}
    </section>
  )
}
