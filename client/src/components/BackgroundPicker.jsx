import { useRef, useState } from 'react'
import Icon from './icons.jsx'

function VideoCard({ bg, selected, onSelect }) {
  const videoRef = useRef(null)

  const handleEnter = () => {
    const v = videoRef.current
    if (v) {
      v.currentTime = 0
      v.play().catch(() => {})
    }
  }
  const handleLeave = () => {
    const v = videoRef.current
    if (v) v.pause()
  }

  return (
    <button
      className={`bg-card ${selected ? 'selected' : ''}`}
      onClick={() => onSelect && onSelect({ ...bg, type: 'video' })}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <video
        ref={videoRef}
        src={bg.videoUrl || bg.url || bg.previewUrl}
        muted
        loop
        playsInline
        preload="metadata"
      />
      {selected && (
        <span className="bg-check">
          <Icon name="check" size={14} strokeWidth={3} />
        </span>
      )}
      <span className="bg-alt">{bg.alt || 'Fondo de video'}</span>
      {bg.author && (
        <a
          className="bg-author"
          href={bg.authorUrl || '#'}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          <Icon name="camera" size={12} /> {bg.author}
        </a>
      )}
    </button>
  )
}

function PhotoCard({ photo, selected, onSelect }) {
  return (
    <button
      className={`bg-card ${selected ? 'selected' : ''}`}
      onClick={() => onSelect && onSelect({ ...photo, type: 'photo' })}
    >
      <img src={photo.thumbUrl || photo.photoUrl || photo.url} alt={photo.alt || 'Foto'} loading="lazy" />
      {selected && (
        <span className="bg-check">
          <Icon name="check" size={14} strokeWidth={3} />
        </span>
      )}
      <span className="bg-alt">{photo.alt || 'Foto de fondo'}</span>
      {photo.author && (
        <a
          className="bg-author"
          href={photo.authorUrl || '#'}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          <Icon name="camera" size={12} /> {photo.author}
        </a>
      )}
    </button>
  )
}

export default function BackgroundPicker(props) {
  const currentTab = props.tab || props.bgTab || 'video'
  const setCurrentTab = props.setTab || props.setBgTab || (() => {})
  const currentResults = props.results || props.bgResults || []
  const photoResults = props.photoResults || []
  const currentSelected = props.selected || props.background || null
  const handleSelect = props.onSelect || props.setBackground || (() => {})
  const handleSearch = props.onSearch || (() => {})
  const searching = props.searching || props.status?.searching || false
  const error = props.searchError || props.status?.error || null
  const phrase = props.phrase || ''
  const [manualQuery, setManualQuery] = useState('')

  const submitManual = (e) => {
    e.preventDefault()
    const q = manualQuery.trim()
    if (!q || searching || !props.onManualSearch) return
    props.onManualSearch(q)
  }

  const isPhoto = currentTab === 'photo'
  const items = isPhoto ? photoResults : currentResults

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">
          <Icon name="image" size={15} /> Fondo
        </h2>
        {items.length > 0 && (
          <button className="btn btn-ghost" onClick={handleSearch} disabled={searching || !phrase.trim()}>
            <Icon name="refresh" size={14} /> Otros
          </button>
        )}
      </div>

      <div style={{ marginBottom: '14px' }}>
        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={handleSearch}
          disabled={searching || !phrase.trim()}
        >
          {searching ? (
            <>
              <span className="spinner small" /> Buscando fondos…
            </>
          ) : (
            <>
              <Icon name="zap" size={15} /> Buscar fondos para mi frase
            </>
          )}
        </button>
        {!phrase.trim() && (
          <p className="muted small" style={{ marginTop: '6px', textAlign: 'center' }}>
            Escribe una frase en el apartado Texto para buscar fondos.
          </p>
        )}
      </div>

      {props.onManualSearch && (
        <form className="manual-search" onSubmit={submitManual}>
          <input
            type="text"
            value={manualQuery}
            onChange={(e) => setManualQuery(e.target.value)}
            placeholder="O busca tú: lluvia, playa, gimnasio…"
            maxLength={100}
          />
          <button type="submit" className="btn btn-secondary" disabled={searching || !manualQuery.trim()}>
            Buscar
          </button>
        </form>
      )}

      <div className="bg-tabs">
        <button
          type="button"
          className={currentTab === 'video' ? 'active' : ''}
          onClick={() => setCurrentTab('video')}
        >
          <Icon name="play" size={14} /> Videos
        </button>
        <button
          type="button"
          className={currentTab === 'photo' ? 'active' : ''}
          onClick={() => setCurrentTab('photo')}
        >
          <Icon name="camera" size={14} /> Fotos
        </button>
      </div>

      {searching && (
        <div className="bg-status">
          <span className="spinner" />
          <p>{isPhoto ? 'Buscando las mejores fotos para tu frase...' : 'Buscando los mejores fondos para tu frase...'}</p>
        </div>
      )}

      {error && !searching && (
        <div className="bg-status error">
          <p>
            <Icon name="warning" size={14} /> {error}
          </p>
          <button className="btn btn-secondary" onClick={handleSearch} disabled={!phrase.trim()}>
            <Icon name="refresh" size={14} /> Reintentar
          </button>
        </div>
      )}

      {!searching && !error && items.length === 0 && (
        <div className="bg-status empty">
          <p>
            <Icon name="play" size={16} /> Aún no hay fondos.
          </p>
          <p className="muted small">Haz clic en «Buscar fondos para mi frase» arriba para obtener sugerencias de Pexels.</p>
        </div>
      )}

      {!searching && items.length > 0 && !isPhoto && (
        <div className="bg-grid">
          {items.map((bg) => (
            <VideoCard
              key={bg.id}
              bg={bg}
              selected={currentSelected?.id === bg.id && currentSelected?.type === 'video'}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}

      {!searching && items.length > 0 && isPhoto && (
        <div className="photo-grid">
          {items.map((p) => (
            <PhotoCard
              key={p.id}
              photo={p}
              selected={currentSelected?.id === p.id && currentSelected?.type === 'photo'}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}
    </section>
  )
}
