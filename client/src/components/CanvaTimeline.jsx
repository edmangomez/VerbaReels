import { useState, useRef, useMemo, useEffect } from 'react'
import Icon from './icons.jsx'

function formatTime(sec) {
  const total = Math.max(0, Math.floor(sec || 0))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function isVideoUrl(url) {
  if (typeof url !== 'string') return false
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url) || url.includes('video-files') || url.includes('/videos/')
}

export default function CanvaTimeline({
  time = 0,
  duration = 'auto',
  effectiveDuration = 10,
  onSetDuration,
  playing = false,
  onTogglePlay,
  onRestart,
  onSeek,
  phrase = '',
  extraTexts = [],
  background = null,
  voiceId = null,
  selectedLayer = null,
  onSelectLayer,
  onOpenBackground,
  onOpenVoice,
  textTiming = null, // { start: 0, end: effDur }
  onUpdateTextTiming, // ({ start, end }) => void
  onUpdateExtraTextTiming, // (boxId, { start, end }) => void
  onDeleteExtraText, // (boxId) => void
}) {
  const timelineTracksRef = useRef(null)
  const isDraggingScrubberRef = useRef(false)
  const isDraggingTrimRef = useRef(null) // 'start' | 'end' | null
  const isDraggingExtraTrimRef = useRef(null) // { boxId, handle: 'start' | 'end' } | null
  const isDraggingFilmstripTrimRef = useRef(false)
  const filmstripTrimStartRef = useRef({ startX: 0, startDur: 10 })
  const [liveDraggingDur, setLiveDraggingDur] = useState(null)
  const [showDurationPicker, setShowDurationPicker] = useState(false)
  const [timelineTextPinned, setTimelineTextPinned] = useState(true)
  const [showTextTimingMenu, setShowTextTimingMenu] = useState(false)

  const effDur = Math.max(1, Number(effectiveDuration) || Number(duration) || 10)
  const progressPct = Math.max(0, Math.min(100, (time / effDur) * 100))

  // Tiempos de inicio y fin de la frase principal
  const textStart = Math.max(0, Math.min(effDur - 0.3, Number(textTiming?.start ?? 0)))
  const textEnd = Math.max(textStart + 0.3, Math.min(effDur, Number(textTiming?.end ?? effDur)))
  const textLeftPct = (textStart / effDur) * 100
  const textWidthPct = Math.max(6, ((textEnd - textStart) / effDur) * 100)
  const isQuoteActiveNow = time >= textStart && time <= textEnd

  // ¿Debe mostrarse la pista de la frase principal en la timeline?
  // Aparece si la frase está seleccionada, o si está fijada/activa por el usuario
  const isQuoteTrackVisible = timelineTextPinned || selectedLayer === 'quote'

  // Regla de tiempo interactiva
  const { majorTicks, subTicks } = useMemo(() => {
    const step = effDur > 24 ? 10 : effDur > 12 ? 5 : effDur > 6 ? 2 : 1
    const majors = []
    for (let s = 0; s <= effDur; s += step) {
      majors.push({ sec: s, pct: (s / effDur) * 100 })
    }
    if (effDur % step !== 0 && effDur - majors[majors.length - 1].sec > 0.8) {
      majors.push({ sec: Math.round(effDur), pct: 100 })
    }

    const subs = []
    for (let s = 0.5; s < effDur; s += 0.5) {
      if (s % step !== 0) {
        subs.push({ sec: s, pct: (s / effDur) * 100 })
      }
    }

    return { majorTicks: majors, subTicks: subs }
  }, [effDur])

  // Obtener tiempo a partir de la coordenada X
  const getTimeFromPointer = (clientX) => {
    if (!timelineTracksRef.current) return 0
    const rect = timelineTracksRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left))
    const ratio = rect.width > 0 ? x / rect.width : 0
    return ratio * effDur
  }

  // Manejo de scrubber (aguja)
  const handleScrubberPointerDown = (e) => {
    if (e.target.closest('button') || e.target.closest('.canva-trim-handle') || e.target.closest('.canva-filmstrip-trim-handle')) return
    e.stopPropagation()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {}
    isDraggingScrubberRef.current = true
    if (onSeek) onSeek(getTimeFromPointer(e.clientX))
  }

  const handleTracksPointerMove = (e) => {
    if (isDraggingScrubberRef.current && onSeek) {
      onSeek(getTimeFromPointer(e.clientX))
      return
    }

    // Arrastre del borde derecho del clip de video para ajustar la duración total del reel
    if (isDraggingFilmstripTrimRef.current && onSetDuration) {
      const dx = e.clientX - filmstripTrimStartRef.current.startX
      const rect = timelineTracksRef.current?.getBoundingClientRect()
      const trackWidth = rect ? rect.width : 400
      // Escala de sensibilidad: píxeles por segundo basados en el ancho de la pista
      const pxPerSec = Math.max(12, trackWidth / filmstripTrimStartRef.current.startDur)
      const deltaSec = dx / pxPerSec
      const rawDur = Math.max(1.5, Math.min(180, filmstripTrimStartRef.current.startDur + deltaSec))
      const snapped = Math.round(rawDur * 2) / 2 // intervalos suaves de 0.5s
      setLiveDraggingDur(snapped)
      onSetDuration(snapped)
      if (filmstripTrimStartRef.current.wasTextAtEnd && onUpdateTextTiming) {
        onUpdateTextTiming({ start: textStart, end: snapped })
      }
      return
    }

    // Manejo de recorte (trim handles) de la pastilla de texto principal
    if (isDraggingTrimRef.current && onUpdateTextTiming) {
      const currentPointerTime = getTimeFromPointer(e.clientX)
      if (isDraggingTrimRef.current === 'start') {
        const newStart = Math.max(0, Math.min(textEnd - 0.4, currentPointerTime))
        onUpdateTextTiming({ start: Number(newStart.toFixed(1)), end: textEnd })
      } else if (isDraggingTrimRef.current === 'end') {
        const newEnd = Math.max(textStart + 0.4, Math.min(effDur, currentPointerTime))
        onUpdateTextTiming({ start: textStart, end: Number(newEnd.toFixed(1)) })
      }
      return
    }

    // Manejo de recorte (trim handles) de cajas de texto adicionales
    if (isDraggingExtraTrimRef.current && onUpdateExtraTextTiming) {
      const { boxId, handle } = isDraggingExtraTrimRef.current
      const box = (extraTexts || []).find((b) => b.id === boxId)
      if (box) {
        const bStart = Math.max(0, Number(box.start ?? 0))
        const bEnd = Math.max(bStart + 0.3, Math.min(effDur, Number(box.end ?? effDur)))
        const currentPointerTime = getTimeFromPointer(e.clientX)
        if (handle === 'start') {
          const newStart = Math.max(0, Math.min(bEnd - 0.3, currentPointerTime))
          onUpdateExtraTextTiming(boxId, { start: Number(newStart.toFixed(1)), end: bEnd })
        } else if (handle === 'end') {
          const newEnd = Math.max(bStart + 0.3, Math.min(effDur, currentPointerTime))
          onUpdateExtraTextTiming(boxId, { start: bStart, end: Number(newEnd.toFixed(1)) })
        }
      }
      return
    }
  }

  const handleTracksPointerUp = (e) => {
    if (isDraggingScrubberRef.current) {
      try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
      isDraggingScrubberRef.current = false
    }
    if (isDraggingTrimRef.current) {
      isDraggingTrimRef.current = null
    }
    if (isDraggingExtraTrimRef.current) {
      isDraggingExtraTrimRef.current = null
    }
    if (isDraggingFilmstripTrimRef.current) {
      try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
      isDraggingFilmstripTrimRef.current = false
      setLiveDraggingDur(null)
    }
  }

  // Inicio de arrastre de trim handles de texto principal
  const handleTrimStart = (e, handleType) => {
    e.stopPropagation()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    isDraggingTrimRef.current = handleType
  }

  // Inicio de arrastre de trim handles de texto adicional
  const handleExtraTrimStart = (e, boxId, handleType) => {
    e.stopPropagation()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    isDraggingExtraTrimRef.current = { boxId, handle: handleType }
  }

  // Inicio de arrastre del borde derecho del clip de video (duración total)
  const handleFilmstripTrimStart = (e) => {
    e.stopPropagation()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    isDraggingFilmstripTrimRef.current = true
    const wasTextAtEnd = Math.abs(textEnd - effDur) < 0.35
    filmstripTrimStartRef.current = {
      startX: e.clientX,
      startDur: effDur,
      wasTextAtEnd,
    }
    setLiveDraggingDur(effDur)
  }

  // Detección segura de imagen o video para el filmstrip (evita iconos rotos 'Fotogr')
  const bgImage =
    (background?.image && !isVideoUrl(background.image) ? background.image : null) ||
    (background?.thumbUrl && !isVideoUrl(background.thumbUrl) ? background.thumbUrl : null) ||
    (background?.photoUrl && !isVideoUrl(background.photoUrl) ? background.photoUrl : null)

  const bgVideo =
    background?.videoUrl ||
    (isVideoUrl(background?.url) ? background.url : null) ||
    (isVideoUrl(background?.previewUrl) ? background.previewUrl : null)

  const isVideo = background?.type === 'video' || !!bgVideo

  return (
    <div className="canva-timeline-container" role="region" aria-label="Línea de tiempo de video">
      {/* 1. Barra superior: tiempo transcurrido, botón redondo Play/Pause y selector de duración */}
      <div className="canva-timeline-header">
        <div className="canva-timeline-head-left">
          {/* Botón selector de duración editable */}
          <div className="canva-duration-picker-anchor">
            <button
              type="button"
              className="canva-timeline-duration-btn"
              onClick={() => setShowDurationPicker(!showDurationPicker)}
              title="Cambiar la duración del video"
            >
              <Icon name="clock" size={13} />
              <span>{duration === 'auto' ? `Auto (${effDur.toFixed(0)}s)` : `${effDur}s`}</span>
              <Icon name="chevronDown" size={11} className={`canva-chevron ${showDurationPicker ? 'open' : ''}`} />
            </button>

            {/* Popover interactivo para elegir duración con total libertad */}
            {showDurationPicker && (
              <div className="canva-duration-popover" onPointerDown={(e) => e.stopPropagation()}>
                <div className="canva-duration-popover-head">
                  <div className="canva-duration-head-title">
                    <Icon name="clock" size={13} />
                    <span>Duración del Reel</span>
                  </div>
                  <button
                    type="button"
                    className="canva-popover-close-btn"
                    onClick={() => setShowDurationPicker(false)}
                    title="Cerrar"
                  >
                    ✕
                  </button>
                </div>

                {/* Modos: Automático vs Personalizado libre */}
                <div className="canva-duration-mode-tabs">
                  <button
                    type="button"
                    className={`canva-mode-tab ${duration === 'auto' ? 'active' : ''}`}
                    onClick={() => onSetDuration?.('auto')}
                  >
                    <Icon name="sparkles" size={12} />
                    <span>Auto ({effDur.toFixed(0)}s)</span>
                  </button>
                  <button
                    type="button"
                    className={`canva-mode-tab ${duration !== 'auto' ? 'active' : ''}`}
                    onClick={() => {
                      if (duration === 'auto') onSetDuration?.(effDur)
                    }}
                  >
                    <Icon name="clock" size={12} />
                    <span>Libre ({effDur.toFixed(1)}s)</span>
                  </button>
                </div>

                {/* Entrada numérica directa y botones rápidos */}
                <div className="canva-duration-direct-input-block">
                  <div className="canva-duration-input-head">
                    <label className="canva-duration-field-label">Tiempo exacto:</label>
                    <div className="canva-duration-field-wrap">
                      <input
                        type="number"
                        min="1"
                        max="180"
                        step="0.5"
                        value={effDur}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value)
                          if (!isNaN(val)) onSetDuration?.(Math.max(1, Math.min(180, Math.round(val * 10) / 10)))
                        }}
                        className="canva-duration-input-elem"
                        aria-label="Duración del reel en segundos"
                      />
                      <span className="canva-duration-sec-tag">seg</span>
                    </div>
                  </div>

                  <div className="canva-duration-stepper-row">
                    <button
                      type="button"
                      className="canva-step-pill"
                      onClick={() => onSetDuration?.(Math.max(1, Math.round((effDur - 1) * 10) / 10))}
                      title="Restar 1 segundo"
                    >
                      -1s
                    </button>
                    <button
                      type="button"
                      className="canva-step-pill"
                      onClick={() => onSetDuration?.(Math.min(180, Math.round((effDur + 1) * 10) / 10))}
                      title="Sumar 1 segundo"
                    >
                      +1s
                    </button>
                    <button
                      type="button"
                      className="canva-step-pill"
                      onClick={() => onSetDuration?.(Math.max(1, Math.round((effDur - 5) * 10) / 10))}
                      title="Restar 5 segundos"
                    >
                      -5s
                    </button>
                    <button
                      type="button"
                      className="canva-step-pill"
                      onClick={() => onSetDuration?.(Math.min(180, Math.round((effDur + 5) * 10) / 10))}
                      title="Sumar 5 segundos"
                    >
                      +5s
                    </button>
                  </div>

                  {/* Slider continuo */}
                  <input
                    type="range"
                    min="2"
                    max="60"
                    step="0.5"
                    value={Math.min(60, effDur)}
                    onChange={(e) => onSetDuration?.(parseFloat(e.target.value))}
                    className="canva-duration-slider"
                  />
                </div>

                {/* Atajos de duraciones comunes */}
                <div className="canva-duration-presets-grid">
                  {[3, 5, 7, 8, 10, 12, 15, 20, 30, 45, 60].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      className={`canva-preset-chip ${duration !== 'auto' && Number(duration) === sec ? 'active' : ''}`}
                      onClick={() => {
                        onSetDuration?.(sec)
                        setShowDurationPicker(false)
                      }}
                    >
                      {sec}s
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`canva-preset-chip auto-chip ${duration === 'auto' ? 'active' : ''}`}
                    onClick={() => {
                      onSetDuration?.('auto')
                      setShowDurationPicker(false)
                    }}
                  >
                    ✦ Auto
                  </button>
                </div>

                <div className="canva-duration-popover-hint">
                  💡 También puedes arrastrar el borde derecho de la pista de video abajo para cambiar la duración en vivo.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Reproducción central */}
        <div className="canva-timeline-playback-bar">
          <span className="canva-time-display current">{formatTime(time)}</span>
          <button
            type="button"
            className="canva-timeline-circle-play"
            onClick={onTogglePlay}
            title={playing ? 'Pausar reproducción' : 'Iniciar reproducción'}
            aria-label={playing ? 'Pausar' : 'Reproducir'}
          >
            <Icon name={playing ? 'pause' : 'play'} size={14} />
          </button>
          <span
            className="canva-time-display total clickable"
            onClick={() => setShowDurationPicker(true)}
            title="Clic para cambiar duración"
          >
            {formatTime(effDur)}
          </span>
        </div>
      </div>

      {/* 2. Área interactiva de pistas y regla */}
      <div
        className="canva-timeline-tracks-area"
        ref={timelineTracksRef}
        onPointerDown={handleScrubberPointerDown}
        onPointerMove={handleTracksPointerMove}
        onPointerUp={handleTracksPointerUp}
        onPointerCancel={handleTracksPointerUp}
      >
        {/* Regla con marcas de tiempo (Time Ruler) */}
        <div className="canva-timeline-ruler" aria-hidden="true">
          {subTicks.map((tick) => (
            <span
              key={`sub-${tick.sec}`}
              className="canva-ruler-subtick"
              style={{ left: `${tick.pct}%` }}
            />
          ))}
          {majorTicks.map((tick) => (
            <div
              key={`maj-${tick.sec}`}
              className="canva-ruler-majortick"
              style={{ left: `${tick.pct}%` }}
            >
              <span className="canva-ruler-line" />
              <span className="canva-ruler-label">{tick.sec}s</span>
            </div>
          ))}
        </div>

        {/* Aguja / Cabezal de reproducción (Playhead Scrubber) con hit area táctil */}
        <div
          className="canva-timeline-playhead"
          style={{ left: `${progressPct}%` }}
          aria-hidden="true"
        >
          <div className="canva-playhead-needle-head" />
          <div className="canva-playhead-needle-line" />
        </div>

        {/* PISTA 1: Frase principal (con recorte de inicio/fin y opción de ocultar/desaparecer) */}
        {isQuoteTrackVisible ? (
          <div className="canva-timeline-track-row text-track-row">
            <div
              className={`canva-text-track-pill ${selectedLayer === 'quote' ? 'active-layer' : ''} ${!isQuoteActiveNow ? 'timed-hidden' : ''}`}
              style={{
                left: `${textLeftPct}%`,
                width: `${textWidthPct}%`,
              }}
              onClick={(e) => {
                e.stopPropagation()
                onSelectLayer?.('quote')
              }}
              onDoubleClick={(e) => {
                e.stopPropagation()
                onUpdateTextTiming?.({ start: 0, end: effDur })
              }}
              title={`Frase principal (${textStart.toFixed(1)}s a ${textEnd.toFixed(1)}s) — Doble clic para ajustar al video completo (0s–${effDur.toFixed(1)}s)`}
            >
              {/* Agarrador izquierdo de recorte (Trim Start) */}
              <div
                className="canva-trim-handle start"
                onPointerDown={(e) => handleTrimStart(e, 'start')}
                title="Arrastra para cambiar cuándo aparece la frase principal"
              >
                <span className="canva-trim-bar" />
              </div>

              <div className="canva-track-pill-content">
                <Icon name="sparkles" size={12} className="canva-track-icon" />
                <span className="canva-track-label">
                  {(phrase || 'Frase principal').slice(0, 30)}
                </span>
                <span className="canva-track-time-badge">
                  {textStart.toFixed(1)}s–{textEnd.toFixed(1)}s
                </span>
                {(Math.abs(textEnd - effDur) > 0.3 || textStart > 0.1) && (
                  <button
                    type="button"
                    className="canva-track-sync-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      onUpdateTextTiming?.({ start: 0, end: effDur })
                    }}
                    title={`Ajustar frase al video completo (0s a ${effDur.toFixed(1)}s)`}
                  >
                    ↔ Todo
                  </button>
                )}
              </div>

              {/* Botón para ocultar/desaparecer la pista de texto */}
              <button
                type="button"
                className="canva-track-hide-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  setTimelineTextPinned(false)
                  if (selectedLayer === 'quote') onSelectLayer?.(null)
                }}
                title="Ocultar pista de la frase de la línea de tiempo"
              >
                ✕
              </button>

              {/* Agarrador derecho de recorte (Trim End) */}
              <div
                className="canva-trim-handle end"
                onPointerDown={(e) => handleTrimStart(e, 'end')}
                title="Arrastra para cambiar cuándo desaparece la frase principal"
              >
                <span className="canva-trim-bar" />
              </div>
            </div>
          </div>
        ) : (
          /* Mini botón discreto cuando la pista de texto está oculta */
          <div className="canva-timeline-track-row text-collapsed-row">
            <button
              type="button"
              className="canva-show-text-track-btn"
              onClick={(e) => {
                e.stopPropagation()
                setTimelineTextPinned(true)
                onSelectLayer?.('quote')
              }}
              title="Mostrar duración de la frase en la línea de tiempo"
            >
              <Icon name="sparkles" size={12} />
              <span>Mostrar tiempo de la frase</span>
            </button>
          </div>
        )}

        {/* PISTAS DE TEXTOS ADICIONALES (Cada texto en su propia fila independiente con controles de estirar/recortar) */}
        {Array.isArray(extraTexts) &&
          extraTexts.map((box) => {
            const bStart = Math.max(0, Number(box.start ?? 0))
            const bEnd = Math.max(bStart + 0.3, Math.min(effDur, Number(box.end ?? effDur)))
            const bLeft = (bStart / effDur) * 100
            const bWidth = Math.max(6, Math.min(100 - bLeft, ((bEnd - bStart) / effDur) * 100))
            const isBoxActive = time >= bStart && time <= bEnd

            return (
              <div key={box.id} className="canva-timeline-track-row extra-text-track-row">
                <div
                  className={`canva-text-track-pill extra-box-pill ${selectedLayer === box.id ? 'active-layer' : ''} ${!isBoxActive ? 'timed-hidden' : ''}`}
                  style={{ left: `${bLeft}%`, width: `${bWidth}%` }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectLayer?.(box.id)
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    onUpdateExtraTextTiming?.(box.id, { start: 0, end: effDur })
                  }}
                  title={`Texto adicional (${bStart.toFixed(1)}s a ${bEnd.toFixed(1)}s) — Arrastra los bordes para estirar o acortar su duración`}
                >
                  {/* Agarrador izquierdo de recorte (Trim Start) */}
                  <div
                    className="canva-trim-handle start"
                    onPointerDown={(e) => handleExtraTrimStart(e, box.id, 'start')}
                    title="Arrastra para cambiar cuándo aparece este texto"
                  >
                    <span className="canva-trim-bar" />
                  </div>

                  <div className="canva-track-pill-content">
                    <Icon name="text" size={12} className="canva-track-icon" />
                    <span className="canva-track-label">
                      {(box.text || 'Texto adicional').slice(0, 24)}
                    </span>
                    <span className="canva-track-time-badge">
                      {bStart.toFixed(1)}s–{bEnd.toFixed(1)}s
                    </span>
                    {(Math.abs(bEnd - effDur) > 0.3 || bStart > 0.1) && (
                      <button
                        type="button"
                        className="canva-track-sync-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          onUpdateExtraTextTiming?.(box.id, { start: 0, end: effDur })
                        }}
                        title={`Ajustar a la duración completa del video (0s a ${effDur.toFixed(1)}s)`}
                      >
                        ↔ Todo
                      </button>
                    )}
                  </div>

                  {/* Botón para eliminar este texto */}
                  <button
                    type="button"
                    className="canva-track-hide-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteExtraText?.(box.id)
                    }}
                    title="Eliminar este texto"
                  >
                    ✕
                  </button>

                  {/* Agarrador derecho de recorte (Trim End) */}
                  <div
                    className="canva-trim-handle end"
                    onPointerDown={(e) => handleExtraTrimStart(e, box.id, 'end')}
                    title="Arrastra para cambiar cuándo desaparece este texto"
                  >
                    <span className="canva-trim-bar" />
                  </div>
                </div>
              </div>
            )
          })}

        {/* PISTA 2: Video Filmstrip de Fondo con Tira de Fotogramas y Botón (+) */}
        <div className={`canva-timeline-track-row video-track-row ${liveDraggingDur != null ? 'trimming-active' : ''}`}>
          <div
            className={`canva-filmstrip-card ${liveDraggingDur != null ? 'dragging-trim' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              onOpenBackground?.()
            }}
            title="Pista de fondo (Clic para cambiar fondo, arrastra el borde derecho para cambiar duración)"
          >
            {bgImage ? (
              <div className="canva-filmstrip-frames">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((idx) => (
                  <div key={idx} className="canva-filmstrip-frame">
                    <img
                      src={bgImage}
                      alt=""
                      className="canva-filmstrip-img"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                    <div className="canva-frame-separator" />
                  </div>
                ))}
              </div>
            ) : bgVideo ? (
              <div className="canva-filmstrip-frames">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((idx) => (
                  <div key={idx} className="canva-filmstrip-frame">
                    <video
                      src={bgVideo}
                      className="canva-filmstrip-img"
                      muted
                      playsInline
                      preload="metadata"
                    />
                    <div className="canva-frame-separator" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="canva-filmstrip-placeholder">
                <Icon name="image" size={15} />
                <span>Elegir fondo de video o foto</span>
              </div>
            )}

            {/* Agarrador derecho interactivo de recorte/duración (Filmstrip Trim Handle) */}
            <div
              className={`canva-filmstrip-trim-handle end ${liveDraggingDur != null ? 'dragging' : ''}`}
              onPointerDown={handleFilmstripTrimStart}
              title="Arrastra para cambiar la duración total del reel"
              aria-label="Ajustar duración del reel"
            >
              <div className="canva-filmstrip-trim-pill">
                <span className="canva-filmstrip-trim-bar" />
                <span className="canva-filmstrip-trim-bar" />
              </div>
            </div>

            {/* Botón rápido para cambiar fondo dentro del clip */}
            {Boolean(bgImage || bgVideo) && (
              <button
                type="button"
                className="canva-filmstrip-change-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenBackground?.()
                }}
                title="Cambiar fondo de video o foto"
              >
                <Icon name="image" size={11} />
                <span>Fondo</span>
              </button>
            )}

            {/* Badge de duración editable en la esquina inferior izquierda del clip */}
            <button
              type="button"
              className="canva-filmstrip-duration-badge"
              onClick={(e) => {
                e.stopPropagation()
                setShowDurationPicker(true)
              }}
              title="Clic para cambiar duración"
            >
              <Icon name="clock" size={10} />
              {duration === 'auto' ? `Auto (${effDur.toFixed(1)}s)` : `${effDur.toFixed(1)}s`}
            </button>

            {/* Tooltip flotante mientras se arrastra la duración */}
            {liveDraggingDur != null && (
              <div className="canva-filmstrip-drag-tooltip" aria-live="polite">
                <Icon name="clock" size={11} />
                <span>{liveDraggingDur.toFixed(1)}s (Total)</span>
              </div>
            )}
          </div>
        </div>

        {/* PISTA 3: Pista de Audio / Voz y Acceso rápido a Fondo */}
        <div className="canva-timeline-track-row audio-track-row">
          <button
            type="button"
            className={`canva-audio-track-pill ${voiceId ? 'has-audio' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              onOpenVoice?.()
            }}
            title="Configurar voz o música de fondo"
          >
            <Icon name="music" size={13} />
            <span>
              {voiceId ? `Voz IA activa (${voiceId})` : 'Agregar un audio'}
            </span>
          </button>

          <button
            type="button"
            className="canva-audio-track-pill canva-bg-track-pill"
            onClick={(e) => {
              e.stopPropagation()
              onOpenBackground?.()
            }}
            title="Elegir o cambiar fondo"
          >
            <Icon name="image" size={13} />
            <span>{background ? 'Cambiar fondo' : 'Elegir fondo'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
