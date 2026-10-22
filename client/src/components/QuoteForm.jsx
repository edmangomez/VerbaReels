import { useState, useCallback } from 'react'
import { checkPhrase } from '../lib/api.js'
import Icon from './icons.jsx'

export default function QuoteForm({ phrase, setPhrase, bgSource, style = {}, setStyle, setSelectedLayer }) {
  const [checking, setChecking] = useState(false)
  const [spell, setSpell] = useState(null) // { corrected, issues, source }

  const handleAddTextBox = useCallback(() => {
    if (!setStyle) return
    const id = `box_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`
    const currentList = Array.isArray(style.extraTexts) ? style.extraTexts : []
    const count = currentList.length
    const initialY = count === 0 ? 22 : count === 1 ? 76 : Math.min(85, Math.max(15, 20 + count * 12))
    const newBox = {
      id,
      text: 'Texto adicional',
      fontSize: 52,
      positionX: 50,
      positionY: initialY,
      boxWidth: 70,
      textAlign: 'center',
      bold: false,
      italic: false,
      uppercase: false,
      textColor: '#FFFFFF',
      boxBg: '',
    }
    setStyle((prev) => ({
      ...prev,
      extraTexts: [...(prev.extraTexts || []), newBox],
    }))
    if (setSelectedLayer) {
      setSelectedLayer(id)
    }
  }, [setStyle, style.extraTexts, setSelectedLayer])

  const handleCheck = useCallback(async () => {
    if (!phrase.trim() || checking) return
    setChecking(true)
    try {
      const data = await checkPhrase(phrase)
      setSpell(data)
    } catch (err) {
      setSpell({ corrected: phrase, issues: [], source: 'none', error: err.message })
    } finally {
      setChecking(false)
    }
  }, [phrase, checking])

  const applyCorrection = useCallback(() => {
    if (spell?.corrected) {
      setPhrase(spell.corrected)
      setSpell(null)
    }
  }, [spell, setPhrase])

  const dismissSpell = useCallback(() => setSpell(null), [])

  return (
    <section className="card">
      <h2 className="card-title">
        <Icon name="text" size={16} /> Tu frase
      </h2>
      <div className="quote-field">
        <textarea
          value={phrase}
          maxLength={200}
          onChange={(e) => {
            setPhrase(e.target.value)
            if (spell) setSpell(null)
          }}
          placeholder="Escribe la frase de tu reel o post… ej: «El éxito es la suma de pequeños esfuerzos»"
          rows={5}
        />
        <div className="quote-counter">{phrase.length}/200</div>
      </div>

      {setStyle && (
        <div className="add-textbox-container">
          <button
            type="button"
            className="canva-add-text-btn"
            onClick={handleAddTextBox}
            title="Agregar una nueva caja de texto al lienzo"
          >
            <Icon name="text" size={16} />
            <span>Agregar caja de texto</span>
            <span className="canva-add-plus-badge">+</span>
          </button>
        </div>
      )}

      {spell?.issues?.length > 0 && (
        <div className={`spell-box ${spell.error ? 'spell-error' : ''}`}>
          <div className="spell-box-head">
            <Icon name="spell" size={15} />
            <span>
              {spell.error
                ? 'No se pudo revisar la ortografía'
                : `${spell.issues.length} ${spell.issues.length === 1 ? 'corrección encontrada' : 'correcciones encontradas'}`}
            </span>
            <span className={`chip chip-source ${spell.source}`}>
              {spell.source === 'ai' ? <><Icon name="sparkles" size={12} /> IA</> : <><Icon name="cpu" size={12} /> Local</>}
            </span>
          </div>
          {!spell.error && (
            <>
              <ul className="spell-list">
                {spell.issues.map((c, i) => (
                  <li key={i}>
                    <s className="spell-old">{c.original}</s>
                    <Icon name="arrowLeft" size={13} className="flip-h" />
                    <span className="spell-new">{c.corrected}</span>
                  </li>
                ))}
              </ul>
              <div className="spell-actions">
                <button className="btn btn-secondary btn-sm" onClick={applyCorrection}>
                  <Icon name="check" size={14} /> Corregir
                </button>
                <button className="btn btn-ghost btn-sm" onClick={dismissSpell}>
                  Ignorar
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {spell && spell.issues?.length === 0 && !spell.error && (
        <div className="spell-box spell-ok">
          <Icon name="checkCircle" size={15} />
          <span>Sin errores de ortografía</span>
          <span className={`chip chip-source ${spell.source}`}>
            {spell.source === 'ai' ? <><Icon name="sparkles" size={12} /> IA</> : <><Icon name="cpu" size={12} /> Local</>}
          </span>
        </div>
      )}

      <div className="quote-actions">
        <button
          className="btn btn-secondary"
          onClick={handleCheck}
          disabled={checking || !phrase.trim()}
          title="Revisar ortografía de la frase"
        >
          <Icon name="spell" size={15} />
          {checking ? '…' : 'Revisar ortografía'}
        </button>
        {bgSource && (
          <span className={`chip chip-source ${bgSource}`}>
            {bgSource === 'ai' ? <><Icon name="sparkles" size={12} /> IA</> : <><Icon name="cpu" size={12} /> Local</>}
          </span>
        )}
      </div>
    </section>
  )
}