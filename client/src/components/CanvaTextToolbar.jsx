import { useState, useRef, useEffect } from 'react'
import { checkPhrase } from '../lib/api.js'
import Icon from './icons.jsx'

const BOX_PRESETS = [
  { label: 'Ninguno', value: '', color: 'transparent' },
  { label: 'Negro', value: 'rgba(0,0,0,0.75)', color: '#111827' },
  { label: 'Blanco', value: 'rgba(255,255,255,0.92)', color: '#FFFFFF' },
  { label: 'Amarillo', value: '#FDE047', color: '#FDE047' },
  { label: 'Cian', value: '#22D3EE', color: '#22D3EE' },
  { label: 'Morado', value: '#8B5CF6', color: '#8B5CF6' },
]

export default function CanvaTextToolbar({
  fonts = [],
  fontId,
  setFontId,
  textColor,
  setTextColor,
  style,
  setStyle,
  phrase = '',
  setPhrase,
  onClose,
  onDelete,
}) {
  const [openFonts, setOpenFonts] = useState(false)
  const [openSpacing, setOpenSpacing] = useState(false)
  const [openEffects, setOpenEffects] = useState(false)
  const [openSpell, setOpenSpell] = useState(false)
  const [checkingSpell, setCheckingSpell] = useState(false)
  const [spellResult, setSpellResult] = useState(null)

  const fontDropdownRef = useRef(null)
  const spacingRef = useRef(null)
  const effectsRef = useRef(null)
  const spellRef = useRef(null)

  const selectedFont = fonts.find((f) => f.id === fontId) || fonts[0]
  const isBold = style.bold === true || (style.bold == null && (selectedFont?.weight || 400) >= 600)

  // Cerrar popovers al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (fontDropdownRef.current && !fontDropdownRef.current.contains(e.target)) setOpenFonts(false)
      if (spacingRef.current && !spacingRef.current.contains(e.target)) setOpenSpacing(false)
      if (effectsRef.current && !effectsRef.current.contains(e.target)) setOpenEffects(false)
      if (spellRef.current && !spellRef.current.contains(e.target)) setOpenSpell(false)
    }
    document.addEventListener('pointerdown', handleClickOutside)
    return () => document.removeEventListener('pointerdown', handleClickOutside)
  }, [])

  const handleSpellCheck = async () => {
    if (!phrase?.trim() || checkingSpell) return
    setCheckingSpell(true)
    try {
      const data = await checkPhrase(phrase)
      setSpellResult(data)
      setOpenSpell(true)
    } catch (err) {
      setSpellResult({ corrected: phrase, issues: [], source: 'none', error: err.message })
      setOpenSpell(true)
    } finally {
      setCheckingSpell(false)
    }
  }

  const applySpellCorrection = () => {
    if (spellResult?.corrected && setPhrase) {
      setPhrase(spellResult.corrected)
      setSpellResult((prev) => (prev ? { ...prev, issues: [] } : null))
      setTimeout(() => setOpenSpell(false), 900)
    }
  }

  const setField = (key, val) => {
    setStyle((prev) => ({ ...prev, [key]: val }))
  }

  const changeFontSize = (delta) => {
    setField('fontSize', Math.max(20, Math.min(140, (Number(style.fontSize) || 92) + delta)))
  }

  const toggleBold = () => {
    setField('bold', !isBold)
  }

  const toggleItalic = () => {
    setField('italic', !style.italic)
  }

  const toggleUppercase = () => {
    setField('uppercase', !style.uppercase)
  }

  const handleCenter = () => {
    setStyle((prev) => ({
      ...prev,
      positionX: 50,
      textAlign: 'center',
    }))
  }

  return (
    <div className="canva-top-toolbar" role="toolbar" aria-label="Herramientas contextuales de texto">
      <div className="canva-top-toolbar-inner">
        {/* GRUPO 1: Tipografía con Menú Personalizado (Dark & High Contrast) */}
        <div className="canva-section">
          <div className="canva-font-dropdown-anchor" ref={fontDropdownRef}>
            <button
              type="button"
              className={`canva-font-trigger ${openFonts ? 'active' : ''}`}
              onClick={() => setOpenFonts(!openFonts)}
              title="Cambiar tipografía"
            >
              <span
                className="canva-font-name"
                style={{ fontFamily: `'${selectedFont?.family || selectedFont?.name || 'Montserrat'}', sans-serif` }}
              >
                {selectedFont?.name || 'Tipografía'}
              </span>
              <Icon name="chevronDown" size={13} className={`canva-chevron ${openFonts ? 'open' : ''}`} />
            </button>

            {openFonts && (
              <div className="canva-font-menu">
                <div className="canva-font-menu-header">Tipografías</div>
                <div className="canva-font-list">
                  {fonts.map((f) => {
                    const isSelected = f.id === fontId
                    return (
                      <button
                        key={f.id}
                        type="button"
                        className={`canva-font-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          setFontId(f.id)
                          setOpenFonts(false)
                        }}
                      >
                        <span
                          className="canva-font-preview"
                          style={{ fontFamily: `'${f.family || f.name}', sans-serif` }}
                        >
                          {f.name}
                        </span>
                        {isSelected && <Icon name="check" size={14} className="canva-font-check" />}
                      </button>
                    )
                  })}
                  {fonts.length === 0 && <div className="canva-font-empty">Cargando fuentes...</div>}
                </div>
              </div>
            )}
          </div>

          {/* Stepper de tamaño */}
          <div className="canva-stepper">
            <button
              type="button"
              className="canva-step-btn"
              onClick={() => changeFontSize(-2)}
              title="Reducir tamaño (2px)"
            >
              <Icon name="minus" size={13} />
            </button>
            <input
              type="number"
              className="canva-num-input"
              value={style.fontSize || 92}
              min={20}
              max={140}
              onChange={(e) => setField('fontSize', Number(e.target.value))}
              title="Tamaño de fuente"
            />
            <button
              type="button"
              className="canva-step-btn"
              onClick={() => changeFontSize(2)}
              title="Aumentar tamaño (2px)"
            >
              <Icon name="plus" size={13} />
            </button>
          </div>

          {/* Color de texto */}
          <label className="canva-color-picker" title="Color de texto">
            <span className="canva-color-letter" style={{ borderBottomColor: textColor }}>
              A
            </span>
            <input
              type="color"
              value={textColor}
              onChange={(e) => setTextColor(e.target.value)}
              className="canva-hidden-color"
            />
          </label>
        </div>

        <div className="canva-divider" />

        {/* GRUPO 2: Formato y Alineación */}
        <div className="canva-section">
          {/* Negrita, Cursiva, Mayúsculas */}
          <div className="canva-btn-group">
            <button
              type="button"
              className={`canva-btn ${isBold ? 'active' : ''}`}
              onClick={toggleBold}
              title="Negrita"
            >
              <strong style={{ fontSize: '0.9rem' }}>B</strong>
            </button>
            <button
              type="button"
              className={`canva-btn ${style.italic ? 'active' : ''}`}
              onClick={toggleItalic}
              title="Cursiva"
            >
              <em style={{ fontSize: '0.9rem', fontStyle: 'italic', fontFamily: 'serif' }}>I</em>
            </button>
            <button
              type="button"
              className={`canva-btn ${style.uppercase ? 'active' : ''}`}
              onClick={toggleUppercase}
              title="Mayúsculas"
            >
              <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>aA</span>
            </button>
          </div>

          <div className="canva-sub-divider" />

          {/* Alineación */}
          <div className="canva-btn-group">
            <button
              type="button"
              className={`canva-btn ${style.textAlign === 'left' ? 'active' : ''}`}
              onClick={() => setField('textAlign', 'left')}
              title="Alinear a la izquierda"
            >
              <Icon name="alignLeft" size={14} />
            </button>
            <button
              type="button"
              className={`canva-btn ${style.textAlign === 'center' ? 'active' : ''}`}
              onClick={() => setField('textAlign', 'center')}
              title="Alinear al centro"
            >
              <Icon name="alignCenter" size={14} />
            </button>
            <button
              type="button"
              className={`canva-btn ${style.textAlign === 'right' ? 'active' : ''}`}
              onClick={() => setField('textAlign', 'right')}
              title="Alinear a la derecha"
            >
              <Icon name="alignRight" size={14} />
            </button>
          </div>
        </div>

        <div className="canva-divider" />

        {/* GRUPO 3: Espaciado, Efectos y Centrado */}
        <div className="canva-section">
          {/* Espaciado */}
          <div className="canva-popover-anchor" ref={spacingRef}>
            <button
              type="button"
              className={`canva-btn ${openSpacing || style.letterSpacing !== 0 || style.lineHeight !== 1.25 || (style.boxWidth && style.boxWidth !== 80) ? 'active' : ''}`}
              onClick={() => setOpenSpacing(!openSpacing)}
              title="Espaciado (interletrado, interlineado y ancho)"
            >
              <Icon name="spacing" size={15} />
            </button>
            {openSpacing && (
              <div className="canva-popover">
                <div className="canva-pop-header">Espaciado y Ancho</div>
                <div className="canva-pop-row">
                  <div className="canva-pop-label">
                    <span>Ancho de caja</span>
                    <span className="small muted">{style.boxWidth || 80}%</span>
                  </div>
                  <input
                    type="range"
                    className="range-bar"
                    min={30}
                    max={95}
                    step={1}
                    value={style.boxWidth || 80}
                    onChange={(e) => setField('boxWidth', Number(e.target.value))}
                  />
                </div>
                <div className="canva-pop-row">
                  <div className="canva-pop-label">
                    <span>Interletrado</span>
                    <span className="small muted">{style.letterSpacing || 0}px</span>
                  </div>
                  <input
                    type="range"
                    className="range-bar"
                    min={-2}
                    max={14}
                    step={1}
                    value={style.letterSpacing || 0}
                    onChange={(e) => setField('letterSpacing', Number(e.target.value))}
                  />
                </div>
                <div className="canva-pop-row">
                  <div className="canva-pop-label">
                    <span>Interlineado</span>
                    <span className="small muted">{(style.lineHeight || 1.25).toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    className="range-bar"
                    min={0.9}
                    max={1.8}
                    step={0.05}
                    value={style.lineHeight || 1.25}
                    onChange={(e) => setField('lineHeight', Number(e.target.value))}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Efectos y Fondo de caja (Sticker) */}
          <div className="canva-popover-anchor" ref={effectsRef}>
            <button
              type="button"
              className={`canva-btn ${openEffects || style.boxBg ? 'active' : ''}`}
              onClick={() => setOpenEffects(!openEffects)}
              title="Efectos de texto y sticker de fondo"
            >
              <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Efectos</span>
            </button>
            {openEffects && (
              <div className="canva-popover canva-popover-wide">
                <div className="canva-pop-header">Fondo de texto (Sticker)</div>
                <div className="canva-presets-grid">
                  {BOX_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      className={`canva-preset-pill ${style.boxBg === p.value ? 'active' : ''}`}
                      onClick={() => setField('boxBg', p.value)}
                    >
                      <span
                        className="canva-preset-dot"
                        style={{
                          background: p.color,
                          border: p.value ? '1px solid #444' : '1px dashed #777',
                        }}
                      />
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>

                <div className="canva-pop-header" style={{ marginTop: 12 }}>
                  Contorno & Sombra
                </div>
                <div className="canva-pop-row">
                  <div className="canva-pop-label">
                    <span>Contorno</span>
                    <span className="small muted">{style.outline}</span>
                  </div>
                  <input
                    type="range"
                    className="range-bar"
                    min={0}
                    max={8}
                    step={1}
                    value={style.outline}
                    onChange={(e) => setField('outline', Number(e.target.value))}
                  />
                </div>
                <div className="canva-pop-row">
                  <div className="canva-pop-label">
                    <span>Sombra</span>
                    <span className="small muted">{style.shadow}</span>
                  </div>
                  <input
                    type="range"
                    className="range-bar"
                    min={0}
                    max={8}
                    step={1}
                    value={style.shadow}
                    onChange={(e) => setField('shadow', Number(e.target.value))}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Botón Centrar */}
          <button
            type="button"
            className="canva-btn canva-btn-accent"
            onClick={handleCenter}
            title="Restablecer posición y centrar texto"
          >
            <Icon name="target" size={14} />
            <span style={{ fontSize: '0.76rem', fontWeight: 600 }}>Centrar</span>
          </button>

          {/* Botón y Popover Revisar Ortografía */}
          {phrase && (
            <div className="canva-popover-anchor" ref={spellRef}>
              <button
                type="button"
                className={`canva-btn canva-btn-spell ${openSpell || (spellResult?.issues?.length > 0) ? 'active' : ''}`}
                onClick={handleSpellCheck}
                disabled={checkingSpell || !phrase.trim()}
                title="Revisar ortografía de la frase con IA / diccionario"
              >
                <Icon name="spell" size={14} />
                <span style={{ fontSize: '0.76rem', fontWeight: 600 }}>
                  {checkingSpell ? 'Revisando…' : 'Ortografía'}
                </span>
                {spellResult?.issues?.length > 0 && (
                  <span className="canva-spell-counter">{spellResult.issues.length}</span>
                )}
              </button>

              {openSpell && (
                <div className="canva-popover canva-popover-spell">
                  <div className="canva-pop-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Revisión ortográfica</span>
                    {spellResult?.source && (
                      <span className={`chip chip-source ${spellResult.source}`} style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                        {spellResult.source === 'ai' ? 'IA' : 'Local'}
                      </span>
                    )}
                  </div>

                  {spellResult?.error ? (
                    <div className="canva-spell-msg error">{spellResult.error}</div>
                  ) : spellResult?.issues?.length > 0 ? (
                    <>
                      <ul className="canva-spell-list">
                        {spellResult.issues.map((c, i) => (
                          <li key={i} className="canva-spell-item">
                            <s className="spell-old">{c.original}</s>
                            <span className="canva-spell-arrow">→</span>
                            <span className="spell-new">{c.corrected}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="canva-spell-actions" style={{ marginTop: 8 }}>
                        <button
                          type="button"
                          className="canva-btn canva-btn-accent"
                          onClick={applySpellCorrection}
                          style={{ width: '100%', justifyContent: 'center' }}
                        >
                          <Icon name="check" size={13} /> Corregir frase
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="canva-spell-msg ok">
                      <Icon name="checkCircle" size={14} /> Sin errores de ortografía
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Botón de eliminar (si aplica) y cerrar / deseleccionar */}
        {(onClose || onDelete) && (
          <div className="canva-section canva-section-close">
            {onDelete && (
              <button
                type="button"
                className="canva-close-btn canva-delete-btn"
                onClick={onDelete}
                title="Eliminar esta caja de texto"
                style={{ color: '#ef4444', marginRight: '2px' }}
              >
                <Icon name="trash" size={15} />
              </button>
            )}
            {onClose && (
              <button
                type="button"
                className="canva-close-btn"
                onClick={onClose}
                title="Deseleccionar texto (Ocultar barra)"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
