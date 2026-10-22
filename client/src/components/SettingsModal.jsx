import { useEffect, useState } from 'react'
import { getSettings, saveSettings, testAI } from '../lib/api.js'

export default function SettingsModal({ open, onClose }) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const [testResult, setTestResult] = useState(null)

  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [pexelsKey, setPexelsKey] = useState('')
  const [hasApiKey, setHasApiKey] = useState(false)
  const [hasPexelsKey, setHasPexelsKey] = useState(false)
  const [apiKeyMasked, setApiKeyMasked] = useState('')
  const [pexelsKeyMasked, setPexelsKeyMasked] = useState('')

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    setTestResult(null)
    setSaved(false)
    getSettings()
      .then((data) => {
        setBaseUrl(data.baseUrl || '')
        setModel(data.model || '')
        setApiKey('')
        setPexelsKey('')
        setHasApiKey(!!data.hasApiKey)
        setHasPexelsKey(!!data.hasPexelsKey)
        setApiKeyMasked(data.apiKeyMasked || '')
        setPexelsKeyMasked(data.pexelsKeyMasked || '')
      })
      .catch((err) => setError(err.message || 'Error al cargar la configuración'))
      .finally(() => setLoading(false))
  }, [open])

  if (!open) return null

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const payload = { baseUrl, model }
      if (apiKey.trim()) payload.apiKey = apiKey.trim()
      if (pexelsKey.trim()) payload.pexelsKey = pexelsKey.trim()
      await saveSettings(payload)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const payload = {
        baseUrl: baseUrl.trim(),
        model: model.trim(),
      }
      if (apiKey.trim()) payload.apiKey = apiKey.trim()
      const r = await testAI(payload)
      setTestResult({ ok: !!r.ok, message: r.message || (r.ok ? 'Conexión exitosa' : 'Sin conexión') })
    } catch (err) {
      setTestResult({ ok: false, message: err.message || 'Error de conexión' })
    } finally {
      setTesting(false)
    }
  }

  const OPENROUTER_MODELS = [
    { id: 'openrouter/free', label: 'openrouter/free (Router Gratis)', desc: 'Enruta automáticamente entre modelos gratuitos disponibles' },
    { id: 'nvidia/nemotron-3.5-lightning:free', label: 'Nemotron 3.5 Lightning (Gratis)', desc: 'Gratuito, veloz y preciso' },
    { id: 'liquid/lfm-2.5-2.6b:free', label: 'Liquid LFM 2.5 (Gratis)', desc: 'Modelo libre muy rápido' },
    { id: 'openrouter/auto', label: 'openrouter/auto', desc: 'Enrutamiento automático de OpenRouter' },
    { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', desc: 'Muy económico y de alta calidad' },
  ]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="card-title">⚙️ Configuración</h2>
          <button className="btn btn-ghost modal-close" onClick={onClose}>✕</button>
        </div>

        {loading && (
          <div className="modal-body"><p className="muted">Cargando configuración...</p></div>
        )}
        {error && !loading && <p className="error-msg">❌ {error}</p>}

        {!loading && (
          <div className="modal-body">
            <div className="settings-group">
              <h3 className="settings-label">🤖 Inteligencia Artificial (OpenAI compatible)</h3>
              <label className="label">Base URL</label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://openrouter.ai/api/v1"
              />
              <label className="label">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasApiKey ? `actual: ${apiKeyMasked}` : 'pega aquí tu API key'}
              />
              <label className="label">Modelo</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="openrouter/free o nvidia/nemotron-3.5-lightning:free"
              />

              <div className="model-suggestions-block">
                <span className="small muted">Modelos sugeridos para OpenRouter:</span>
                <div className="model-chips-row">
                  {OPENROUTER_MODELS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`model-chip ${model === m.id ? 'active' : ''}`}
                      onClick={() => setModel(m.id)}
                      title={m.desc}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <button className="btn btn-secondary" onClick={handleTest} disabled={testing}>
                {testing ? '⏳ Probando...' : '🔍 Probar conexión'}
              </button>
              {testResult && (
                <p className={`test-result ${testResult.ok ? 'ok' : 'fail'}`}>
                  {testResult.ok ? '✅' : '❌'} {testResult.message}
                </p>
              )}
              <p className={`key-status ${hasApiKey ? 'ok' : 'missing'}`}>
                {hasApiKey
                  ? '✅ IA configurada — fondos inteligentes y descripciones con LLM'
                  : '⚠️ Sin IA: se usará el modo heurístico local (funciona igual, con menos calidad)'}
              </p>
            </div>

            <div className="settings-group">
              <h3 className="settings-label">📹 Pexels</h3>
              <label className="label">Pexels API Key</label>
              <input
                type="password"
                value={pexelsKey}
                onChange={(e) => setPexelsKey(e.target.value)}
                placeholder={hasPexelsKey ? `actual: ${pexelsKeyMasked}` : 'pega aquí tu key (gratis en pexels.com/api)'}
              />
              <p className={`key-status ${hasPexelsKey ? 'ok' : 'missing'}`}>
                {hasPexelsKey ? '✅ Pexels configurado — fondos de video disponibles' : '⚠️ Sin key de Pexels no se pueden buscar fondos de video. Consigue una gratis en pexels.com/api'}
              </p>
            </div>

            <div className="modal-actions">
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? '⏳ Guardando...' : '💾 Guardar'}
              </button>
              {saved && <span className="chip saved">Guardado ✓</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
