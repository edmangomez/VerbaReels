import { useCallback, useEffect, useState } from 'react'
import { getLibrary, deleteLibraryItem } from '../lib/api.js'
import Icon from './icons.jsx'

const TABS = [
  { key: 'reels', label: <><Icon name="play" size={14} /> Reels</> },
  { key: 'phrases', label: <><Icon name="text" size={14} /> Frases</> },
  { key: 'images', label: <><Icon name="camera" size={14} /> Posts</> },
]

function shortDate(iso) {
  try {
    return new Date(iso).toLocaleDateString()
  } catch {
    return ''
  }
}

function displayTitle(item) {
  const t = item?.title || item?.phrase || item?.text || ''
  return truncate(t, 45)
}

function truncate(text, n = 40) {
  const t = String(text || '')
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}

export default function LibraryPanel({ onUsePhrase }) {
  const [activeTab, setActiveTab] = useState('reels')
  const [library, setLibrary] = useState({ reels: [], phrases: [], images: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getLibrary()
      setLibrary({
        reels: data.reels || [],
        phrases: data.phrases || [],
        images: data.images || [],
      })
    } catch (err) {
      setError(err.message || 'Error al cargar la biblioteca')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleDelete = async (type, id) => {
    try {
      await deleteLibraryItem(type, id)
      setLibrary((lib) => ({
        ...lib,
        [type]: lib[type].filter((item) => item.id !== id),
      }))
    } catch (err) {
      setError(err.message || 'Error al eliminar')
    }
  }

  const items = library[activeTab] || []
  const isEmpty = !loading && items.length === 0

  return (
    <section className="card">
      <h2 className="card-title">
        <Icon name="library" size={15} /> Mi biblioteca
      </h2>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {error && (
          <p className="error-msg">
            <Icon name="warning" size={14} /> {error}
          </p>
        )}

        {loading && (
          <div className="render-loading">
            <span className="spinner" />
            <p className="muted small">Cargando biblioteca...</p>
          </div>
        )}

        {isEmpty && (
          <p className="muted">Aún no has exportado nada — tus reels y posts aparecerán aquí 🎬</p>
        )}

        {!loading && items.length > 0 && (
          <div className="library-grid">
            {activeTab === 'reels' && items.map((r) => (
              <div key={r.id} className="lib-item">
                <video src={r.url} poster={r.thumbUrl || undefined} muted preload="metadata" />
                <div className="lib-info">
                  <p className="lib-title">{displayTitle(r)}</p>
                  <p className="muted small">{shortDate(r.createdAt)}</p>
                </div>
                <div className="lib-actions">
                  <a className="btn btn-secondary" href={r.url} download><Icon name="download" size={14} /></a>
                  <button className="btn btn-secondary" onClick={() => handleDelete('reels', r.id)}><Icon name="trash" size={14} /></button>
                </div>
              </div>
            ))}

            {activeTab === 'phrases' && items.map((p) => (
              <div key={p.id} className="lib-item">
                <div className="lib-info">
                  <p className="lib-title">{displayTitle(p)}</p>
                  <p className="muted small">{shortDate(p.createdAt)}</p>
                </div>
                <div className="lib-actions">
                  {onUsePhrase && (
                    <button className="btn btn-secondary" onClick={() => onUsePhrase(p.text)}>
                      <Icon name="copy" size={14} /> Usar
                    </button>
                  )}
                  <button className="btn btn-secondary" onClick={() => handleDelete('phrases', p.id)}><Icon name="trash" size={14} /></button>
                </div>
              </div>
            ))}

            {activeTab === 'images' && items.map((img) => (
              <div key={img.id} className="lib-item">
                <img src={img.url} alt={img.phrase || ''} />
                <div className="lib-info">
                  <p className="lib-title">{displayTitle(img)}</p>
                  <p className="muted small">
                    {img.size === 'portrait' ? 'Post 1080×1356' : `Imagen ${img.width}×${img.height}`} · {shortDate(img.createdAt)}
                  </p>
                </div>
                <div className="lib-actions">
                  <a className="btn btn-secondary" href={img.url} download><Icon name="download" size={14} /></a>
                  <button className="btn btn-secondary" onClick={() => handleDelete('images', img.id)}><Icon name="trash" size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
