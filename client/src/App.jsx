import { useState, useEffect, useCallback, useRef } from 'react'
import { getFonts, suggestBackgrounds, suggestPhotos, startRender, getRenderStatus, exportPost } from './lib/api.js'
import { VIDEO, DEFAULT_STYLE } from './lib/timing.js'
import Icon from './components/icons.jsx'
import QuoteForm from './components/QuoteForm.jsx'
import FontPicker from './components/FontPicker.jsx'
import BackgroundPicker from './components/BackgroundPicker.jsx'
import TemplatePicker from './components/TemplatePicker.jsx'
import VoicePanel from './components/VoicePanel.jsx'
import DescriptionPanel from './components/DescriptionPanel.jsx'
import LibraryPanel from './components/LibraryPanel.jsx'
import Preview from './components/Preview.jsx'
import CanvaTextToolbar from './components/CanvaTextToolbar.jsx'
import RenderPanel from './components/RenderPanel.jsx'
import SettingsModal from './components/SettingsModal.jsx'

const TOOLS = [
  { key: 'templates', label: 'Plantillas', icon: 'brush' },
  { key: 'text', label: 'Texto', icon: 'text' },
  { key: 'background', label: 'Fondo', icon: 'image' },
  { key: 'voice', label: 'Voz', icon: 'volume' },
  { key: 'desc', label: 'Descripción', icon: 'sparkles' },
  { key: 'library', label: 'Biblioteca', icon: 'library' },
]

function freshState() {
  return {
    mode: 'reel',
    phrase: 'El éxito es la suma de pequeños esfuerzos repetidos día tras día.',
    fontId: 'montserrat',
    textColor: '#FFFFFF',
    duration: 'auto',
    style: { ...DEFAULT_STYLE },
    voiceId: null,
    background: null,
    bgTab: 'suggest',
    bgResults: [],
    photoResults: [],
    bgSource: null,
    exportResult: null,
    exportError: null,
    searchError: null,
    desc: null,
    descText: '',
  }
}

export default function App() {
  const [mode, setModeState] = useState('reel')
  const [phrase, setPhrase] = useState('El éxito es la suma de pequeños esfuerzos repetidos día tras día.')
  const [fontId, setFontId] = useState('montserrat')
  const [fonts, setFonts] = useState([])
  const [textColor, setTextColor] = useState('#FFFFFF')
  const [duration, setDuration] = useState('auto')
  const [style, setStyle] = useState({ ...DEFAULT_STYLE })
  const [voiceId, setVoiceId] = useState(null)

  const [background, setBackground] = useState(null)
  const [bgTab, setBgTab] = useState('suggest')
  const [bgResults, setBgResults] = useState([])
  const [photoResults, setPhotoResults] = useState([])
  const [bgSource, setBgSource] = useState(null)

  const [searching, setSearching] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportResult, setExportResult] = useState(null)
  const [exportError, setExportError] = useState(null)
  const [searchError, setSearchError] = useState(null)

  const [desc, setDesc] = useState(null)
  const [descText, setDescText] = useState('')

  const [activeTool, setActiveTool] = useState('text')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [confirmNew, setConfirmNew] = useState(false)
  const [selectedLayer, setSelectedLayer] = useState(null)

  const selectedExtraBox = selectedLayer && selectedLayer !== 'quote'
    ? (style.extraTexts || []).find((b) => b.id === selectedLayer)
    : null

  const updateExtraBox = useCallback((id, patch) => {
    setStyle((prev) => ({
      ...prev,
      extraTexts: (prev.extraTexts || []).map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }))
  }, [])

  const updateExtraBoxStyle = useCallback((id, updater) => {
    setStyle((prev) => ({
      ...prev,
      extraTexts: (prev.extraTexts || []).map((b) => {
        if (b.id !== id) return b
        return typeof updater === 'function' ? updater(b) : { ...b, ...updater }
      }),
    }))
  }, [])

  const deleteExtraBox = useCallback((id) => {
    setStyle((prev) => ({
      ...prev,
      extraTexts: (prev.extraTexts || []).filter((b) => b.id !== id),
    }))
    setSelectedLayer(null)
  }, [])

  const pollRef = useRef(null)
  const autoSearchedRef = useRef(false)
  const [renderStep, setRenderStep] = useState('')
  const [renderProgress, setRenderProgress] = useState(null)
  const [activeTemplate, setActiveTemplate] = useState(null)

  // Restaurar estado del editor desde localStorage al montar
  useEffect(() => {
    try {
      const saved = localStorage.getItem('reels-editor-state')
      if (saved) {
        const s = JSON.parse(saved)
        if (s.phrase) setPhrase(s.phrase)
        if (s.fontId) setFontId(s.fontId)
        if (s.textColor) setTextColor(s.textColor)
        if (s.duration) setDuration(s.duration)
        if (s.style) setStyle((prev) => ({ ...prev, ...s.style }))
      }
    } catch { /* no crítico */ }

    getFonts()
      .then((data) => setFonts(data.fonts || []))
      .catch(() => setFonts([]))
  }, [])

  // Guardar estado del editor en localStorage (debounced 600ms)
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem('reels-editor-state', JSON.stringify({ phrase, fontId, textColor, duration, style }))
      } catch { /* no crítico */ }
    }, 600)
    return () => clearTimeout(t)
  }, [phrase, fontId, textColor, duration, style])

  const setMode = useCallback((m) => {
    setModeState(m)
    setBgTab(m === 'post' ? 'photo' : 'video')
    setExportResult(null)
    setExportError(null)
  }, [])

  // Búsqueda de fondos. Sin `query` usa la frase (IA/heurística); con `query` busca
  // exactamente ese término en Pexels (búsqueda manual o plantilla).
  const doSearch = useCallback(async (query, { forceSelect = false } = {}) => {
    const manual = (typeof query === 'string' ? query : '').trim()
    if (!manual && !phrase.trim()) return
    autoSearchedRef.current = true
    setSearching(true)
    setSearchError(null)
    try {
      const [bgRes, photoRes] = await Promise.allSettled([
        suggestBackgrounds(phrase, manual || undefined),
        suggestPhotos(phrase, manual || undefined),
      ])

      if (bgRes.status === 'rejected' && photoRes.status === 'rejected') {
        throw bgRes.reason || photoRes.reason || new Error('Error al buscar fondos')
      }

      // el tipo viaja con cada resultado para que Preview/Export sepan qué es
      const videos = bgRes.status === 'fulfilled'
        ? (bgRes.value.results || []).map((v) => ({ ...v, type: 'video' }))
        : []
      const photos = photoRes.status === 'fulfilled'
        ? (photoRes.value.results || []).map((p) => ({ ...p, type: 'photo' }))
        : []

      if (bgRes.status === 'fulfilled') {
        setBgResults(videos)
        setBgSource(bgRes.value.source || null)
      }
      if (photoRes.status === 'fulfilled') setPhotoResults(photos)

      const preferPhoto = mode === 'post' || bgTab === 'photo'
      const candidate = preferPhoto ? (photos[0] || videos[0]) : (videos[0] || photos[0])
      if (candidate && (forceSelect || !background)) setBackground(candidate)
    } catch (err) {
      setSearchError(err.message || 'Error al buscar fondos')
    } finally {
      setSearching(false)
    }
  }, [phrase, mode, bgTab, background])

  const handleSearchBg = useCallback(() => doSearch(), [doSearch])
  const handleManualSearch = useCallback((q) => doSearch(q), [doSearch])

  const applyTemplate = useCallback((t) => {
    setFontId(t.fontId)
    setTextColor(t.textColor)
    setStyle((s) => ({ ...s, ...t.style }))
    setActiveTemplate(t.id)
    doSearch(t.query, { forceSelect: true })
  }, [doSearch])

  // Carga automática al cambiar de pestaña en el picker si aún no hay resultados.
  // La guarda evita reintentos infinitos cuando una búsqueda devuelve 0 resultados.
  useEffect(() => {
    if (autoSearchedRef.current || searching || !phrase.trim()) return
    if ((bgTab === 'photo' && photoResults.length === 0) || (bgTab === 'video' && bgResults.length === 0)) {
      doSearch()
    }
  }, [bgTab, photoResults.length, bgResults.length, phrase, searching, doSearch])

  const handleExport = useCallback(async () => {
    if (!background || !phrase.trim()) return
    setExporting(true)
    setExportError(null)
    setRenderStep('')
    setRenderProgress(null)
    try {
      let data
      const payload = {
        phrase,
        fontId,
        textColor,
        style,
        description: desc?.description || undefined,
        hashtags: (desc?.hashtags || []).length ? desc.hashtags : undefined,
        source: desc?.source || undefined,
      }
      const bgUrl = background.videoUrl || background.photoUrl || background.previewUrl
      if (mode === 'reel') {
        setRenderStep('En cola…')
        const { jobId } = await startRender({ ...payload, duration, videoUrl: bgUrl, voiceId })
        data = await new Promise((resolve, reject) => {
          const poll = async () => {
            try {
              const job = await getRenderStatus(jobId)
              setRenderStep(job.step || '')
              setRenderProgress(typeof job.progress === 'number' ? job.progress : null)
              if (job.status === 'done') return resolve(job.result)
              if (job.status === 'error') return reject(new Error(job.error || 'Error al renderizar'))
              pollRef.current = setTimeout(poll, 1000)
            } catch (err) {
              reject(err)
            }
          }
          poll()
        })
      } else {
        data = await exportPost({ ...payload, photoUrl: bgUrl })
      }
      setExportResult(data)
      setRenderStep('')
      if (data.description && !desc) {
        setDesc({ description: data.description, hashtags: data.hashtags || [], source: data.source || null })
        setDescText(data.description)
      }
    } catch (err) {
      setExportError(err.message || 'Error al exportar')
      setRenderStep('')
    } finally {
      setExporting(false)
      if (pollRef.current) clearTimeout(pollRef.current)
    }
  }, [mode, phrase, fontId, textColor, duration, background, style, voiceId, desc])

  const handleNew = useCallback(() => {
    const s = freshState()
    setModeState(s.mode)
    setPhrase(s.phrase)
    setFontId(s.fontId)
    setTextColor(s.textColor)
    setDuration(s.duration)
    setStyle(s.style)
    setVoiceId(s.voiceId)
    setBackground(s.background)
    setBgTab(s.bgTab)
    setBgResults(s.bgResults)
    setPhotoResults(s.photoResults)
    setBgSource(s.bgSource)
    setExportResult(s.exportResult)
    setExportError(s.exportError)
    setSearchError(s.searchError)
    setDesc(s.desc)
    setDescText(s.descText)
    setRenderStep('')
    setRenderProgress(null)
    setActiveTemplate(null)
    autoSearchedRef.current = false
    setActiveTool('text')
    setConfirmNew(false)
    try { localStorage.removeItem('reels-editor-state') } catch { /* no crítico */ }
  }, [])

  const handleReset = useCallback(() => {
    setExportResult(null)
    setExportError(null)
    setRenderStep('')
  }, [])

  const renderPanel = () => {
    switch (activeTool) {
      case 'templates':
        return (
          <TemplatePicker
            onApply={applyTemplate}
            activeId={activeTemplate}
            busy={searching}
          />
        )
      case 'text':
        return (
          <>
            <QuoteForm
              phrase={phrase}
              setPhrase={setPhrase}
              onSearch={handleSearchBg}
              searchError={searchError}
              mode={mode}
              style={style}
              setStyle={setStyle}
              setSelectedLayer={setSelectedLayer}
            />
            <FontPicker
              fonts={fonts}
              fontId={fontId}
              setFontId={setFontId}
              textColor={textColor}
              setTextColor={setTextColor}
              duration={duration}
              setDuration={setDuration}
              style={style}
              setStyle={setStyle}
              phrase={phrase}
              mode={mode}
            />
          </>
        )
      case 'background':
        return (
          <BackgroundPicker
            mode={mode}
            background={background}
            setBackground={setBackground}
            bgTab={bgTab}
            setBgTab={setBgTab}
            bgResults={bgResults}
            setBgResults={setBgResults}
            photoResults={photoResults}
            setPhotoResults={setPhotoResults}
            bgSource={bgSource}
            phrase={phrase}
            onSearch={handleSearchBg}
            onManualSearch={handleManualSearch}
            searching={searching}
            searchError={searchError}
          />
        )
      case 'voice':
        return (
          <VoicePanel
            phrase={phrase}
            voiceId={voiceId}
            setVoiceId={setVoiceId}
          />
        )
      case 'desc':
        return (
          <DescriptionPanel
            phrase={phrase}
            desc={desc}
            text={descText}
            descText={descText}
            onDescChange={(newDesc) => {
              setDesc(newDesc)
              setDescText(newDesc?.description || '')
            }}
            setDesc={setDesc}
            onTextChange={setDescText}
            setDescText={setDescText}
          />
        )
      case 'library':
        return <LibraryPanel onUsePhrase={(p) => setPhrase(p)} />
      default:
        return null
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <span className="brand">🎬 Reels Studio</span>
          <div className="mode-switch">
            <button
              className={`mode-switch-btn ${mode === 'reel' ? 'active' : ''}`}
              onClick={() => setMode('reel')}
            >
              <Icon name="play" size={14} /> Reel
            </button>
            <button
              className={`mode-switch-btn ${mode === 'post' ? 'active' : ''}`}
              onClick={() => setMode('post')}
            >
              <Icon name="camera" size={14} /> Post
            </button>
          </div>
        </div>

        <div className="topbar-right">
          <button
            className="btn btn-secondary new-btn"
            onClick={() => setConfirmNew(true)}
            title="Empezar un nuevo reel desde cero"
          >
            <Icon name="fileText" size={15} /> Nuevo
          </button>
          <button className="icon-btn" onClick={() => setSettingsOpen(true)} title="Ajustes">
            <Icon name="settings" size={18} />
          </button>
          <button
            className="btn btn-primary export-btn"
            onClick={handleExport}
            disabled={exporting || !background || !phrase.trim()}
          >
            {exporting ? <span className="spinner small" /> : 'Exportar'}
          </button>
        </div>
      </header>

      <div className="editor-body">
        <nav className="tool-rail">
          {TOOLS.map((t) => (
            <button
              key={t.key}
              className={`tool-rail-btn ${activeTool === t.key ? 'active' : ''}`}
              onClick={() => {
                setActiveTool(t.key)
                if (t.key === 'text') setSelectedLayer('quote')
              }}
              title={t.label}
            >
              <Icon name={t.icon} size={20} />
              <span className="tool-rail-label">{t.label}</span>
            </button>
          ))}
        </nav>

        <aside className="side-panel">{renderPanel()}</aside>

        <main
          className="canvas-area"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedLayer(null)
            }
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedLayer(null)
            }
          }}
        >
          <div className="canvas-stage">
            {selectedLayer && (selectedLayer === 'quote' || selectedExtraBox) && (
              <CanvaTextToolbar
                fonts={fonts}
                fontId={selectedExtraBox ? (selectedExtraBox.fontId || fontId) : fontId}
                setFontId={selectedExtraBox ? (fid) => updateExtraBox(selectedExtraBox.id, { fontId: fid }) : setFontId}
                textColor={selectedExtraBox ? (selectedExtraBox.textColor || textColor) : textColor}
                setTextColor={selectedExtraBox ? (col) => updateExtraBox(selectedExtraBox.id, { textColor: col }) : setTextColor}
                style={selectedExtraBox || style}
                setStyle={selectedExtraBox ? (updater) => updateExtraBoxStyle(selectedExtraBox.id, updater) : setStyle}
                phrase={selectedExtraBox ? selectedExtraBox.text : phrase}
                setPhrase={selectedExtraBox ? (txt) => updateExtraBox(selectedExtraBox.id, { text: txt }) : setPhrase}
                onClose={() => setSelectedLayer(null)}
                onDelete={selectedExtraBox ? () => deleteExtraBox(selectedExtraBox.id) : undefined}
              />
            )}
            <Preview
              phrase={phrase}
              setPhrase={setPhrase}
              fontId={fontId}
              fonts={fonts}
              textColor={textColor}
              duration={duration}
              onSetDuration={setDuration}
              mode={mode}
              background={background}
              style={style}
              setStyle={setStyle}
              selectedLayer={selectedLayer}
              setSelectedLayer={setSelectedLayer}
              setActiveTool={setActiveTool}
              voiceId={voiceId}
            />
          </div>

          {(exporting || exportResult || exportError) && (
            <div className="canvas-floating-actions">
              <RenderPanel
                mode={mode}
                disabled={!background || !phrase.trim()}
                onExport={handleExport}
                exporting={exporting}
                rendering={false}
                result={exportResult}
                onReset={handleReset}
                error={exportError}
                renderStep={renderStep}
                progress={renderProgress}
              />
            </div>
          )}
        </main>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {confirmNew && (
        <div className="modal-overlay" onClick={() => setConfirmNew(false)}>
          <div className="modal new-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 className="modal-title">¿Empezar de nuevo?</h3>
              <button className="btn-ghost modal-close" onClick={() => setConfirmNew(false)} aria-label="Cerrar">
                ✕
              </button>
            </div>
            <p className="muted">
              Se borrará la frase, el fondo, la voz, la descripción y los ajustes actuales
              para empezar un nuevo reel desde cero.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmNew(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleNew} autoFocus>
                <Icon name="sparkles" size={15} /> Crear nuevo reel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}