import { useState } from 'react'
import { generateDescription } from '../lib/api.js'
import Icon from './icons.jsx'

// Componente controlado: el estado vive en App para que la descripción
// persista al navegar entre herramientas y tras exportar.
export default function DescriptionPanel({
  phrase,
  desc,
  setDesc,
  onDescChange,
  text,
  descText,
  onTextChange,
  setDescText,
}) {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  const currentDesc = desc || null
  const currentText = text !== undefined ? text : (descText !== undefined ? descText : (currentDesc?.description || ''))

  const updateDesc = (val) => {
    if (typeof onDescChange === 'function') onDescChange(val)
    if (typeof setDesc === 'function') setDesc(val)
  }

  const updateText = (val) => {
    if (typeof onTextChange === 'function') onTextChange(val)
    if (typeof setDescText === 'function') setDescText(val)
  }

  const hasPhrase = Boolean(phrase && phrase.trim())
  const hasDesc = Boolean(currentDesc && (currentDesc.description || currentText))

  const handleGenerate = async () => {
    if (!hasPhrase) return
    setGenerating(true)
    setError(null)
    try {
      const data = await generateDescription(phrase)
      const nextDesc = {
        description: data.description || '',
        hashtags: data.hashtags || [],
        source: data.source || null,
      }
      updateDesc(nextDesc)
      updateText(nextDesc.description)
    } catch (err) {
      setError(err.message || 'Error al generar la descripción')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = async () => {
    if (!currentDesc && !currentText) return
    const content = currentText || currentDesc?.description || ''
    const tags = (currentDesc?.hashtags || []).join(' ')
    const full = tags ? `${content}\n\n${tags}` : content
    try {
      await navigator.clipboard.writeText(full)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = full
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">
          <Icon name="fileText" size={15} /> Descripción para tu post
        </h2>
        {currentDesc?.source && (
          <span className={`chip chip-source ${currentDesc.source}`}>
            {currentDesc.source === 'ai' ? (
              <>
                <Icon name="sparkles" size={12} /> IA
              </>
            ) : (
              <>
                <Icon name="cpu" size={12} /> Local
              </>
            )}
          </span>
        )}
      </div>

      {!hasPhrase && <p className="muted">Escribe una frase primero</p>}

      {hasPhrase && (
        <>
          {error && (
            <p className="error-msg">
              <Icon name="warning" size={14} /> {error}
            </p>
          )}

          {generating && (
            <div className="render-loading">
              <span className="spinner" />
              <p className="muted small">Generando descripción...</p>
            </div>
          )}

          {!generating && !hasDesc && (
            <button className="btn btn-primary btn-big" onClick={handleGenerate}>
              <Icon name="sparkles" size={15} /> Generar descripción
            </button>
          )}

          {!generating && hasDesc && (
            <>
              <textarea
                className="description-textarea"
                value={currentText}
                onChange={(e) => updateText(e.target.value)}
                rows={5}
                placeholder="Descripción de tu publicación..."
              />
              {(currentDesc?.hashtags || []).length > 0 && (
                <div className="hashtag-chips">
                  {currentDesc.hashtags.map((h) => (
                    <span key={h} className="chip">#{String(h).replace(/^#/, '')}</span>
                  ))}
                </div>
              )}
              <div className="desc-actions">
                <button className="btn btn-secondary" onClick={handleCopy}>
                  {copied ? (
                    <>
                      <Icon name="check" size={14} /> ¡Copiado!
                    </>
                  ) : (
                    <>
                      <Icon name="copy" size={14} /> Copiar
                    </>
                  )}
                </button>
                <button className="btn btn-secondary" onClick={handleGenerate}>
                  <Icon name="refresh" size={14} /> Regenerar
                </button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  )
}