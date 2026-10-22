import { useEffect, useState } from 'react'
import { getVoices, previewVoiceAudio } from '../lib/api.js'
import Icon from './icons.jsx'

const LOCALE_LABELS = {
  'es-ES': 'España',
  'es-MX': 'México',
  'es-AR': 'Argentina',
  'es-CO': 'Colombia',
  'es-CL': 'Chile',
  'es-US': 'EE.UU.',
  'es-PE': 'Perú',
}

export default function VoicePanel({ phrase, voiceId, setVoiceId }) {
  const [voices, setVoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [previewing, setPreviewing] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)

  const loadVoices = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getVoices()
      setVoices(data.voices || [])
    } catch (err) {
      setError(err.message || 'Error al cargar las voces')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVoices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // revoca el blob URL anterior al desmontar
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl])

  const handlePreview = async (e, voice) => {
    e.stopPropagation()
    if (previewing) return
    setPreviewing(voice.id)
    setError(null)
    try {
      const text = phrase?.trim() || 'Hola, así suena esta voz'
      const blob = await previewVoiceAudio(text, voice.id)
      const objectUrl = URL.createObjectURL(blob)
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      setAudioUrl(objectUrl)
    } catch (err) {
      setError(err.message || 'Error al generar el audio')
    } finally {
      setPreviewing(null)
    }
  }

  return (
    <section className="card">
      <h2 className="card-title">
        <Icon name="mic" size={15} /> Voz narrada (opcional)
      </h2>
      <p className="muted small">Voces neuronales gratis de Microsoft · el reel durará lo que dure la narración</p>

      {loading && (
        <div className="render-loading">
          <span className="spinner" />
          <p className="muted small">Cargando voces...</p>
        </div>
      )}

      {!loading && error && (
        <div className="render-loading">
          <p className="error-msg">
            <Icon name="warning" size={14} /> {error}
          </p>
          <button className="btn btn-secondary" onClick={loadVoices}>
            <Icon name="refresh" size={14} /> Reintentar
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="voice-grid">
          {voices.map((v) => (
            <div key={v.id} className="voice-card-wrapper">
              <button
                className={`voice-card${voiceId === v.id ? ' active' : ''}`}
                onClick={() => setVoiceId(v.id)}
                title={voiceId === v.id ? 'Voz seleccionada' : `Usar la voz de ${v.name}`}
              >
                <span className="voice-name">
                  {v.name} {v.gender}{voiceId === v.id ? ' ✓' : ''}
                </span>
                <span className="voice-locale">{LOCALE_LABELS[v.locale] || v.locale}</span>
              </button>
              <button
                className="voice-listen"
                onClick={(e) => handlePreview(e, v)}
                disabled={previewing === v.id}
                title={`Escuchar ${v.name}`}
              >
                {previewing === v.id ? <span className="spinner small" /> : <Icon name="volume" size={14} />}
              </button>
            </div>
          ))}
        </div>
      )}

      {audioUrl && (
        <audio className="voice-audio-preview" controls autoPlay src={audioUrl} />
      )}

      {voiceId && (
        <button className="btn btn-secondary voice-remove" onClick={() => setVoiceId(null)}>
          <Icon name="trash" size={14} /> Quitar voz
        </button>
      )}
    </section>
  )
}
