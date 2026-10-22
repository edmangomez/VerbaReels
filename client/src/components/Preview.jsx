import { useEffect, useMemo, useRef, useState } from 'react'
import { autoDuration, buildTimeline, normalizeStyle, SAFE_ZONE, clampSafePositionY, wrapTextToLines, HOOK_FONT_SIZE, AUTHOR_FONT_SIZE } from '../lib/timing.js'
import Icon from './icons.jsx'
import CanvaTimeline from './CanvaTimeline.jsx'

const FADE_MS = 300
const FULL_PHRASE_FADE_MS = 400

/**
 * Calcula el estilo de un bloque en un instante dado (segundos)
 * según la animación activa.
 */
function blockStyleAt(block, isLast, isFirst, t, animation, containerWidth = 1080) {
  const { start, end } = block

  if (animation === 'full-phrase') {
    // único bloque de inicio a fin, con fade-in de 400ms como el server \fad(400,0)
    const inMs = FULL_PHRASE_FADE_MS / 1000
    if (t < start) return { opacity: 0 }
    const p = Math.min(1, (t - start) / inMs)
    return { opacity: p }
  }

  if (animation === 'static') {
    // cambio instantáneo entre bloques
    if (t < start) return { opacity: 0 }
    const endT = isLast ? Infinity : end
    if (t >= endT) return { opacity: 0 }
    return { opacity: 1 }
  }

  const slideOffset = (isFirst ? 60 : 30) * ((containerWidth || 1080) / 1080)

  if (t < start) {
    return { opacity: 0, ...(animation === 'slide-up' ? { translateY: slideOffset } : animation === 'fade-pop' ? { scale: 0.86 } : {}) }
  }

  const local = t - start

  // fades SOLO en los extremos (como el render): primer bloque entra con
  // fade, último sale con fade; intermedios transicionan con pop/slide.
  const entryFade = isFirst && local < 0.3 ? Math.min(1, local / 0.3) : 1
  const exitFade = isLast ? Math.max(0, (end - t) / 0.4) : 1

  if (animation === 'fade-pop') {
    const popDur = isFirst ? 0.28 : 0.18
    if (local < popDur) {
      const p = local / popDur
      return { opacity: entryFade * exitFade, scale: 0.86 + 0.14 * p }
    }
    return { opacity: entryFade * exitFade, scale: 1 }
  }

  if (animation === 'slide-up') {
    const slideDur = isFirst ? 0.3 : 0.15
    if (local < slideDur) {
      const p = local / slideDur
      return { opacity: entryFade * exitFade, translateY: slideOffset * (1 - p) }
    }
    return { opacity: entryFade * exitFade, translateY: 0 }
  }

  // typewriter / fallback: fade solo de entrada
  if (isFirst && local < FADE_MS / 1000) {
    const p = local / (FADE_MS / 1000)
    return { opacity: p }
  }
  return { opacity: exitFade }
}

/**
 * Sombra de texto que simula el contorno externo (outline) de libass:
 * 8 direcciones alrededor del glifo + sombra suave al final.
 * El tamaño (o) se escala igual que el render (ASS usa px sobre lienzo 1080).
 */
function buildTextShadow(outline, shadow, outlineMult, containerWidth) {
  const shadows = []
  const o = (outline * outlineMult) * ((containerWidth || 0) / 1080)
  if (o > 0) {
    const d = o * 0.7
    const offsets = [
      [o, 0], [-o, 0], [0, o], [0, -o],
      [d, d], [d, -d], [-d, d], [-d, -d],
    ]
    for (const [x, y] of offsets) {
      shadows.push(`${x.toFixed(2)}px ${y.toFixed(2)}px 0 rgba(0,0,0,0.95)`)
    }
  }
  const sy = shadow * ((containerWidth || 0) / 1080)
  shadows.push(`0 ${sy.toFixed(2)}px ${sy * 1.5}px rgba(0,0,0,.8)`)
  return shadows.join(', ')
}

export default function Preview({
  phrase,
  setPhrase,
  fontId,
  fonts,
  textColor,
  duration,
  onSetDuration,
  mode,
  background,
  style,
  setStyle,
  selectedLayer: propSelectedLayer,
  setSelectedLayer: propSetSelectedLayer,
  setActiveTool,
  voiceId,
}) {
  const [playing, setPlaying] = useState(true)
  const [time, setTime] = useState(0)
  const [containerWidth, setContainerWidth] = useState(0)
  const [showGuides, setShowGuides] = useState(true)
  const [internalSelectedLayer, setInternalSelectedLayer] = useState(null)
  const selectedLayer = propSelectedLayer !== undefined ? propSelectedLayer : internalSelectedLayer
  const setSelectedLayer = propSetSelectedLayer || setInternalSelectedLayer
  const [editingLayerId, setEditingLayerId] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef(null)

  const rafRef = useRef(null)
  const startRef = useRef(0)
  const accRef = useRef(0) // tiempo acumulado antes de la última pausa
  const videoRef = useRef(null)
  const frameRef = useRef(null)
  const progressRef = useRef(null)
  const [scrubbing, setScrubbing] = useState(false)
  const scrubbingRef = useRef(false)

  const normStyle = useMemo(() => normalizeStyle(style || {}), [style])

  // duración efectiva: 'auto' se resuelve con autoDuration según la frase
  const effDuration = useMemo(() => {
    if (duration === 'auto') return autoDuration(phrase || '')
    const n = Number(duration)
    return Number.isFinite(n) && n > 0 ? n : 10
  }, [duration, phrase])

  const timeline = useMemo(
    () => buildTimeline(phrase || 'Tu frase aquí', effDuration, normStyle),
    [phrase, effDuration, normStyle]
  )

  // mide el ancho del contenedor para escalar el texto
  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const update = () => setContainerWidth(el.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const font = fonts.find((f) => f.id === fontId)
  const fontFamily = font ? `'${font.family || font.name}', sans-serif` : "'Montserrat', sans-serif"
  const fontWeight = font && font.weight != null ? font.weight : (font?.family === 'Montserrat' ? 900 : 700)
  const outlineMult = font && font.outlineMult != null ? font.outlineMult : 1

  // reloj con requestAnimationFrame (no aplica en modo post: la frase es fija)
  useEffect(() => {
    if (mode === 'post' || !playing) return

    startRef.current = performance.now()

    const tick = () => {
      if (scrubbingRef.current) {
        // durante el scrub el reloj no avanza: el tiempo lo marca el usuario
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      const elapsed = accRef.current + (performance.now() - startRef.current) / 1000
      if (elapsed >= effDuration) {
        // loop: reset
        accRef.current = 0
        startRef.current = performance.now()
        setTime(0)
        if (videoRef.current) {
          videoRef.current.currentTime = 0
          videoRef.current.play().catch(() => {})
        }
      } else {
        setTime(elapsed)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    startRef.current = performance.now()
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafRef.current)
      // guarda el tiempo transcurrido para poder reanudar donde se quedó
      accRef.current = Math.min(accRef.current + (performance.now() - startRef.current) / 1000, effDuration)
    }
  }, [playing, effDuration, timeline, mode])

  // al cambiar la duración efectiva, reinicia el reloj para evitar saltos
  useEffect(() => {
    accRef.current = 0
    setTime(0)
  }, [effDuration])

  // sincroniza automáticamente la duración del texto si antes cubría el final del video
  const prevDurationRef = useRef(effDuration)
  useEffect(() => {
    const prev = prevDurationRef.current
    prevDurationRef.current = effDuration
    if (prev !== effDuration && setStyle) {
      const currentEnd = style?.textEnd
      if (typeof currentEnd === 'number' && Number.isFinite(currentEnd)) {
        const wasAtEnd = Math.abs(currentEnd - prev) < 0.4
        if (wasAtEnd || currentEnd > effDuration) {
          setStyle((s) => ({
            ...s,
            textEnd: effDuration,
          }))
        }
      }
    }
  }, [effDuration, style?.textEnd, setStyle])

  // pausa/reenuda el video de fondo junto con la animación
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (playing && mode !== 'post') v.play().catch(() => {})
    else v.pause()
  }, [playing, background, mode])

  const togglePlay = () => setPlaying((p) => !p)
  const restart = () => {
    accRef.current = 0
    startRef.current = performance.now()
    setTime(0)
    if (videoRef.current) videoRef.current.currentTime = 0
    setPlaying(true)
  }

  // tiempo correspondiente a una posición x de la barra de progreso
  const timeFromPointer = (clientX) => {
    const el = progressRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0) return 0
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    return Math.min(effDuration, Math.max(0, ratio * effDuration))
  }

  const applyScrubTime = (t) => {
    accRef.current = t
    startRef.current = performance.now()
    setTime(t)
    if (videoRef.current) {
      try {
        videoRef.current.currentTime = t
      } catch { /* el video puede no estar listo aún */ }
    }
  }

  const handleScrubStart = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    scrubbingRef.current = true
    setScrubbing(true)
    applyScrubTime(timeFromPointer(e.clientX))
  }

  const handleScrubMove = (e) => {
    if (!scrubbingRef.current) return
    applyScrubTime(timeFromPointer(e.clientX))
  }

  const handleScrubEnd = () => {
    if (!scrubbingRef.current) return
    scrubbingRef.current = false
    setScrubbing(false)
    startRef.current = performance.now() // el accRef ya tiene el tiempo actual
  }

  const handleTextPointerDown = (e, layerId = 'quote', handleType = 'body') => {
    if (!setStyle) return
    if (editingLayerId === layerId && handleType === 'body') return

    e.stopPropagation()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    setSelectedLayer(layerId)
    setIsDragging(true)

    let posX = 50
    let posY = 42
    let fontSize = 92
    let boxWidth = 80

    if (layerId === 'quote') {
      posX = normStyle.positionX ?? 50
      posY = normStyle.positionY ?? 42
      fontSize = normStyle.fontSize || 92
      boxWidth = normStyle.boxWidth || 80
    } else {
      const box = (normStyle.extraTexts || []).find((b) => b.id === layerId)
      if (box) {
        posX = box.positionX ?? 50
        posY = box.positionY ?? 30
        fontSize = box.fontSize || 52
        boxWidth = box.boxWidth || 70
      }
    }

    dragStartRef.current = {
      layerId,
      clientX: e.clientX,
      clientY: e.clientY,
      posX,
      posY,
      fontSize,
      boxWidth,
      handle: handleType,
    }
  }

  const handlePointerMove = (e) => {
    if (!isDragging || !dragStartRef.current || !setStyle) return
    const { layerId, clientX, clientY, posX, posY, fontSize, boxWidth, handle } = dragStartRef.current
    const dx = e.clientX - clientX
    const dy = e.clientY - clientY
    const cw = containerWidth || 400
    const ch = cw * (mode === 'post' ? 1.255 : 1.777)

    if (layerId === 'quote') {
      if (handle === 'body') {
        const deltaXPct = (dx / cw) * 100
        const deltaYPct = (dy / ch) * 100
        const newX = Math.round(Math.max(5, Math.min(95, posX + deltaXPct)))
        const newY = Math.round(Math.max(10, Math.min(85, posY + deltaYPct)))
        setStyle((prev) => ({ ...prev, positionX: newX, positionY: newY }))
      } else if (handle === 'side-e') {
        const deltaWPct = (dx / cw) * 100 * 2
        const newW = Math.round(Math.max(30, Math.min(96, boxWidth + deltaWPct)))
        setStyle((prev) => ({ ...prev, boxWidth: newW }))
      } else if (handle === 'side-w') {
        const deltaWPct = (-dx / cw) * 100 * 2
        const newW = Math.round(Math.max(30, Math.min(96, boxWidth + deltaWPct)))
        setStyle((prev) => ({ ...prev, boxWidth: newW }))
      } else if (handle.startsWith('corner-')) {
        const delta = (dx + dy) * (handle.includes('se') ? 0.6 : handle.includes('nw') ? -0.6 : 0.6)
        const deltaSize = Math.round((delta / cw) * 120)
        const newSize = Math.max(20, Math.min(140, fontSize + deltaSize))
        setStyle((prev) => ({ ...prev, fontSize: newSize }))
      }
    } else {
      if (handle === 'body') {
        const deltaXPct = (dx / cw) * 100
        const deltaYPct = (dy / ch) * 100
        const newX = Math.round(Math.max(5, Math.min(95, posX + deltaXPct)))
        const newY = Math.round(Math.max(5, Math.min(92, posY + deltaYPct)))
        setStyle((prev) => ({
          ...prev,
          extraTexts: (prev.extraTexts || []).map((b) =>
            b.id === layerId ? { ...b, positionX: newX, positionY: newY } : b
          ),
        }))
      } else if (handle === 'side-e') {
        const deltaWPct = (dx / cw) * 100 * 2
        const newW = Math.round(Math.max(20, Math.min(96, boxWidth + deltaWPct)))
        setStyle((prev) => ({
          ...prev,
          extraTexts: (prev.extraTexts || []).map((b) =>
            b.id === layerId ? { ...b, boxWidth: newW } : b
          ),
        }))
      } else if (handle === 'side-w') {
        const deltaWPct = (-dx / cw) * 100 * 2
        const newW = Math.round(Math.max(20, Math.min(96, boxWidth + deltaWPct)))
        setStyle((prev) => ({
          ...prev,
          extraTexts: (prev.extraTexts || []).map((b) =>
            b.id === layerId ? { ...b, boxWidth: newW } : b
          ),
        }))
      } else if (handle.startsWith('corner-')) {
        const delta = (dx + dy) * (handle.includes('se') ? 0.6 : handle.includes('nw') ? -0.6 : 0.6)
        const deltaSize = Math.round((delta / cw) * 120)
        const newSize = Math.max(20, Math.min(140, fontSize + deltaSize))
        setStyle((prev) => ({
          ...prev,
          extraTexts: (prev.extraTexts || []).map((b) =>
            b.id === layerId ? { ...b, fontSize: newSize } : b
          ),
        }))
      }
    }
  }

  const handlePointerUp = (e) => {
    if (isDragging) {
      try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
      setIsDragging(false)
      dragStartRef.current = null
    }
  }

  const handleDeleteExtraBox = (id) => {
    setStyle?.((prev) => ({
      ...prev,
      extraTexts: (prev.extraTexts || []).filter((b) => b.id !== id),
    }))
    setSelectedLayer(null)
    setEditingLayerId(null)
  }

  const handleCenterLayer = (layerId) => {
    if (layerId === 'quote') {
      setStyle?.((prev) => ({ ...prev, positionX: 50, textAlign: 'center' }))
    } else {
      setStyle?.((prev) => ({
        ...prev,
        extraTexts: (prev.extraTexts || []).map((b) =>
          b.id === layerId ? { ...b, positionX: 50, textAlign: 'center' } : b
        ),
      }))
    }
  }

  const handleUpdateText = (layerId, newText) => {
    if (layerId === 'quote') {
      setPhrase?.(newText)
    } else {
      setStyle?.((prev) => ({
        ...prev,
        extraTexts: (prev.extraTexts || []).map((b) =>
          b.id === layerId ? { ...b, text: newText } : b
        ),
      }))
    }
  }

  // Cálculo de ventana de tiempo de la frase principal
  const textStart = typeof normStyle.textStart === 'number' && Number.isFinite(normStyle.textStart)
    ? Math.max(0, normStyle.textStart)
    : 0
  const textEnd = typeof normStyle.textEnd === 'number' && Number.isFinite(normStyle.textEnd)
    ? Math.min(effDuration, Math.max(textStart + 0.3, normStyle.textEnd))
    : effDuration
  const isQuoteInWindow = mode === 'post' || (time >= textStart && time <= textEnd)

  // bloque visible en el instante actual dentro de su ventana de tiempo
  const activeIdx = isQuoteInWindow
    ? timeline.findIndex((b) => time >= b.start && time < b.end)
    : -1
  const active = activeIdx >= 0 ? timeline[activeIdx] : null
  const isLastBlock = activeIdx === timeline.length - 1

  let overlayStyle = { opacity: 0 }
  const align = normStyle.textAlign || 'center'
  const xTranslate = align === 'left' ? '0%' : align === 'right' ? '-100%' : '-50%'
  const baseTranslate = `translate(${xTranslate}, 0)`
  if (active && isQuoteInWindow) {
    const anim = blockStyleAt(active, isLastBlock, activeIdx === 0, time, normStyle.animation)
    overlayStyle = { opacity: anim.opacity }
    if (anim.scale != null) overlayStyle.transform = `translate(${xTranslate}, 0) scale(${anim.scale})`
    else if (anim.translateY != null) overlayStyle.transform = `translate(${xTranslate}, ${anim.translateY}px)`
    else overlayStyle.transform = baseTranslate
  } else {
    overlayStyle = { opacity: 0, transform: baseTranslate, pointerEvents: 'none' }
  }

  // estilo visual derivado de style (vector stroke -webkit-text-stroke idéntico a libass)
  const fontSizePx = containerWidth > 0 ? containerWidth * (normStyle.fontSize / 1080) : undefined
  const safeY = clampSafePositionY(normStyle.positionY, SAFE_ZONE)
  const outlinePx = (normStyle.outline * outlineMult) * ((containerWidth || 0) / 1080)
  const shadowPx = normStyle.shadow * ((containerWidth || 0) / 1080)

  const textStyle = {
    top: `${safeY}%`,
    left: `${normStyle.positionX ?? 50}%`,
    right: 'auto',
    width: `${normStyle.boxWidth || 80}%`,
    maxWidth: '96%',
    minWidth: '140px',
    boxSizing: 'border-box',
    padding: normStyle.boxBg
      ? `${Math.max(4, 8 * ((containerWidth || 0) / 1080))}px ${Math.max(8, 20 * ((containerWidth || 0) / 1080))}px`
      : '0px',
    margin: 0,
    ...(fontSizePx != null ? { fontSize: `${fontSizePx}px` } : {}),
    fontWeight: normStyle.bold === true ? 900 : normStyle.bold === false ? 400 : fontWeight,
    fontStyle: normStyle.italic ? 'italic' : 'normal',
    textTransform: normStyle.uppercase ? 'uppercase' : 'none',
    textAlign: normStyle.textAlign || 'center',
    letterSpacing: `${(normStyle.letterSpacing || 0) * ((containerWidth || 0) / 1080)}px`,
    lineHeight: normStyle.lineHeight || 1.25,
    WebkitTextStroke: outlinePx > 0 ? `${outlinePx.toFixed(2)}px #000000` : 'none',
    paintOrder: 'stroke fill',
    filter: shadowPx > 0 ? `drop-shadow(0 ${shadowPx.toFixed(2)}px ${shadowPx * 1.2}px rgba(0,0,0,0.85))` : 'none',
    ...(normStyle.boxBg ? {
      backgroundColor: normStyle.boxBg,
      borderRadius: `${Math.max(4, 10 * ((containerWidth || 0) / 1080))}px`,
      boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
    } : {}),
  }

  // riesgo de desbordar la zona segura: línea envuelta más larga vs ancho útil
  const overflowRisk = useMemo(() => {
    const width = containerWidth || 900
    const wrapped = wrapTextToLines((phrase || '').trim(), normStyle.fontSize, normStyle.boxWidth)
    const lines = wrapped ? wrapped.split('\n') : []
    const maxLineChars = lines.reduce((m, l) => Math.max(m, l.length), 0)
    const estWidth = maxLineChars * (fontSizePx || normStyle.fontSize) * 0.55
    const usable = width * (1 - (SAFE_ZONE.leftPct + SAFE_ZONE.rightPct) / 100)
    const totalHeightEst = lines.length * (fontSizePx || normStyle.fontSize) * (normStyle.lineHeight || 1.25)
    const usableHeight = (width * (mode === 'post' ? 1.255 : 1.7778)) * (1 - (SAFE_ZONE.topPct + SAFE_ZONE.bottomPct) / 100)
    return { horizontal: estWidth > usable * 1.05, vertical: totalHeightEst > usableHeight }
  }, [phrase, containerWidth, fontSizePx, normStyle.fontSize, normStyle.boxWidth, normStyle.lineHeight, mode])

  const renderExtraTextBoxes = () => {
    return (normStyle.extraTexts || []).map((box) => {
      const isSelected = selectedLayer === box.id
      const isEditing = editingLayerId === box.id
      const boxAlign = box.textAlign || 'center'
      const boxXTranslate = boxAlign === 'left' ? '0%' : boxAlign === 'right' ? '-100%' : '-50%'
      const boxFontSizePx = containerWidth > 0 ? containerWidth * ((box.fontSize || 52) / 1080) : undefined
      const boxFont = fonts?.find((f) => f.id === box.fontId)
      const boxOutlineMult = boxFont?.outlineMult ?? outlineMult
      const boxOutlinePx = (normStyle.outline * boxOutlineMult) * ((containerWidth || 0) / 1080)
      const boxShadowPx = normStyle.shadow * ((containerWidth || 0) / 1080)
      const boxFontFamily = boxFont ? `'${boxFont.family || boxFont.name}', sans-serif` : fontFamily
      const bStart = typeof box.start === 'number' && Number.isFinite(box.start) ? Math.max(0, box.start) : 0
      const bEnd = typeof box.end === 'number' && Number.isFinite(box.end) ? Math.max(bStart + 0.2, box.end) : effDuration
      const isBoxInWindow = mode === 'post' || (time >= bStart && time <= bEnd) || (!playing && (isSelected || isEditing))

      const boxStyleObj = {
        top: `${box.positionY ?? 30}%`,
        left: `${box.positionX ?? 50}%`,
        transform: `translate(${boxXTranslate}, 0)`,
        width: `${box.boxWidth || 70}%`,
        maxWidth: '96%',
        minWidth: '100px',
        boxSizing: 'border-box',
        padding: box.boxBg
          ? `${Math.max(4, 6 * ((containerWidth || 0) / 1080))}px ${Math.max(6, 16 * ((containerWidth || 0) / 1080))}px`
          : '0px',
        margin: 0,
        opacity: isBoxInWindow ? 1 : 0,
        pointerEvents: isBoxInWindow ? 'auto' : 'none',
        visibility: isBoxInWindow ? 'visible' : 'hidden',
        transition: 'opacity 0.12s ease',
        ...(boxFontSizePx != null ? { fontSize: `${boxFontSizePx}px` } : {}),
        fontWeight: box.bold ? 900 : 500,
        fontStyle: box.italic ? 'italic' : 'normal',
        textTransform: box.uppercase ? 'uppercase' : 'none',
        textAlign: boxAlign,
        letterSpacing: `${(box.letterSpacing || 0) * ((containerWidth || 0) / 1080)}px`,
        lineHeight: box.lineHeight || 1.25,
        WebkitTextStroke: boxOutlinePx > 0 ? `${boxOutlinePx.toFixed(2)}px #000000` : 'none',
        paintOrder: 'stroke fill',
        filter: boxShadowPx > 0 ? `drop-shadow(0 ${boxShadowPx.toFixed(2)}px ${boxShadowPx * 1.2}px rgba(0,0,0,0.85))` : 'none',
        color: box.textColor || textColor,
        fontFamily: boxFontFamily,
        zIndex: isSelected ? 25 : 10,
        ...(box.boxBg ? {
          backgroundColor: box.boxBg,
          borderRadius: `${Math.max(4, 8 * ((containerWidth || 0) / 1080))}px`,
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        } : {}),
      }

      return (
        <div
          key={box.id}
          className={`preview-text extra-text-box ${isSelected ? 'canva-selected' : ''}`}
          style={boxStyleObj}
          onPointerDown={(e) => handleTextPointerDown(e, box.id, 'body')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={(e) => {
            e.stopPropagation()
            setEditingLayerId(box.id)
          }}
        >
          {isSelected && (
            <div className="canva-bbox" onPointerDown={(e) => e.stopPropagation()}>
              <div className="canva-bbox-actions">
                <button
                  type="button"
                  className="canva-bbox-btn"
                  onClick={() => handleCenterLayer(box.id)}
                  title="Centrar texto"
                >
                  <Icon name="target" size={12} /> Centrar
                </button>
                <button
                  type="button"
                  className="canva-bbox-btn"
                  onClick={() => setEditingLayerId(box.id)}
                  title="Editar texto directamente"
                >
                  ✏️ Editar
                </button>
                <button
                  type="button"
                  className="canva-bbox-btn canva-bbox-del-btn"
                  onClick={() => handleDeleteExtraBox(box.id)}
                  title="Eliminar caja de texto"
                >
                  ✕
                </button>
              </div>
              <div className="canva-bbox-border" />
              <span className="canva-handle handle-nw" onPointerDown={(e) => handleTextPointerDown(e, box.id, 'corner-nw')} />
              <span className="canva-handle handle-ne" onPointerDown={(e) => handleTextPointerDown(e, box.id, 'corner-ne')} />
              <span className="canva-handle handle-sw" onPointerDown={(e) => handleTextPointerDown(e, box.id, 'corner-sw')} />
              <span className="canva-handle handle-se" onPointerDown={(e) => handleTextPointerDown(e, box.id, 'corner-se')} />
              <span className="canva-handle handle-w" onPointerDown={(e) => handleTextPointerDown(e, box.id, 'side-w')} title="Ajustar ancho" />
              <span className="canva-handle handle-e" onPointerDown={(e) => handleTextPointerDown(e, box.id, 'side-e')} title="Ajustar ancho" />
            </div>
          )}

          {isEditing ? (
            <textarea
              className="canva-inline-textarea"
              value={box.text}
              onChange={(e) => handleUpdateText(box.id, e.target.value)}
              onBlur={() => setEditingLayerId(null)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setEditingLayerId(null)
              }}
              onPointerDown={(e) => e.stopPropagation()}
              autoFocus
              placeholder="Escribe tu texto…"
              rows={Math.max(1, (box.text || '').split('\n').length)}
            />
          ) : (
            wrapTextToLines((box.text || '').trim() || 'Texto adicional', box.fontSize || 52, box.boxWidth || 70).split('\n').map((line, li, arr) => (
              <span key={li}>
                {line}
                {li < arr.length - 1 ? <br /> : null}
              </span>
            ))
          )}
        </div>
      )
    })
  }

  if (mode === 'post') {
    return (
      <section className="card preview-card">
        <div className="card-head">
          <h2 className="card-title">
            <Icon name="eye" size={15} /> Vista previa
          </h2>
          <button
            className={`guides-toggle ${showGuides ? 'active' : ''}`}
            onClick={() => setShowGuides((s) => !s)}
            title="Mostrar zona segura"
          >
            <Icon name="guides" size={15} />
          </button>
        </div>

        <div
          className={`preview-frame${showGuides ? ' with-guides' : ''}`}
          style={{ aspectRatio: '4 / 5', backgroundColor: 'transparent' }}
          ref={frameRef}
          onPointerDown={(e) => {
            if (!e.target.closest('.preview-text')) {
              setSelectedLayer(null)
              setEditingLayerId(null)
            }
          }}
          onClick={(e) => {
            if (!e.target.closest('.preview-text')) {
              setSelectedLayer(null)
              setEditingLayerId(null)
            }
          }}
        >
          {background?.type === 'photo' ? (
            <img
              src={background.photoUrl || background.url || background.previewUrl}
              alt={background.alt || 'Foto de fondo'}
              className="preview-video"
            />
          ) : background?.type === 'video' ? (
            <video
              ref={videoRef}
              src={background.videoUrl || background.url || background.previewUrl}
              muted
              loop
              playsInline
              preload="auto"
              className="preview-video"
            />
          ) : (
            <div className="preview-placeholder">
              <span className="preview-emoji">🖼️</span>
              <p>Selecciona un fondo (video o foto)</p>
            </div>
          )}

          <ExtraLayers st={normStyle} cw={containerWidth} fontFamily={fontFamily} color={textColor} />
          {renderExtraTextBoxes()}
          {showGuides && <SafeGuides />}
          {overflowRisk.horizontal && (
            <div className="safe-warning">
              <Icon name="warning" size={13} /> Ajusta el tamaño o acorta la frase para respetar la zona segura
            </div>
          )}

          <div
            className={`preview-text ${selectedLayer === 'quote' ? 'canva-selected' : ''}`}
            style={{
              ...textStyle,
              opacity: 1,
              transform: baseTranslate,
              color: textColor,
              fontFamily,
              zIndex: selectedLayer === 'quote' ? 25 : 10,
            }}
            onPointerDown={(e) => handleTextPointerDown(e, 'quote', 'body')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onDoubleClick={(e) => {
              e.stopPropagation()
              setEditingLayerId('quote')
            }}
          >
            {selectedLayer === 'quote' && (
              <div className="canva-bbox" onPointerDown={(e) => e.stopPropagation()}>
                <div className="canva-bbox-actions">
                  <button
                    type="button"
                    className="canva-bbox-btn"
                    onClick={() => handleCenterLayer('quote')}
                    title="Centrar texto"
                  >
                    <Icon name="target" size={12} /> Centrar
                  </button>
                  <button
                    type="button"
                    className="canva-bbox-btn"
                    onClick={() => setEditingLayerId('quote')}
                    title="Editar frase directamente"
                  >
                    ✏️ Editar
                  </button>
                  <button
                    type="button"
                    className="canva-bbox-btn"
                    onClick={() => {
                      setSelectedLayer(null)
                      setEditingLayerId(null)
                    }}
                    title="Cerrar selección"
                  >
                    ✕
                  </button>
                </div>
                <div className="canva-bbox-border" />
                <span className="canva-handle handle-nw" onPointerDown={(e) => handleTextPointerDown(e, 'quote', 'corner-nw')} />
                <span className="canva-handle handle-ne" onPointerDown={(e) => handleTextPointerDown(e, 'quote', 'corner-ne')} />
                <span className="canva-handle handle-sw" onPointerDown={(e) => handleTextPointerDown(e, 'quote', 'corner-sw')} />
                <span className="canva-handle handle-se" onPointerDown={(e) => handleTextPointerDown(e, 'quote', 'corner-se')} />
                <span className="canva-handle handle-w" onPointerDown={(e) => handleTextPointerDown(e, 'quote', 'side-w')} title="Ajustar ancho" />
                <span className="canva-handle handle-e" onPointerDown={(e) => handleTextPointerDown(e, 'quote', 'side-e')} title="Ajustar ancho" />
              </div>
            )}

            {editingLayerId === 'quote' ? (
              <textarea
                className="canva-inline-textarea"
                value={phrase}
                onChange={(e) => handleUpdateText('quote', e.target.value)}
                onBlur={() => setEditingLayerId(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setEditingLayerId(null)
                }}
                onPointerDown={(e) => e.stopPropagation()}
                autoFocus
                placeholder="Escribe tu frase…"
                rows={Math.max(1, (phrase || '').split('\n').length)}
              />
            ) : (
              wrapTextToLines((phrase || '').trim(), normStyle.fontSize, normStyle.boxWidth).split('\n').map((line, li, arr) => (
                <span key={li}>
                  {line}
                  {li < arr.length - 1 ? <br /> : null}
                </span>
              ))
            )}
          </div>
        </div>
      </section>
    )
  }

  // typewriter / bloques: palabras reveladas o formateadas con quiebre exacto
  let renderedText = null
  if (active) {
    if (normStyle.animation === 'typewriter' && Array.isArray(active.words)) {
      renderedText = active.words.map((w, i) => (
        <span key={i} style={{ opacity: time >= w.start ? 1 : 0 }}>
          {w.word}
          {i < active.words.length - 1 ? ' ' : ''}
        </span>
      ))
    } else {
      const formatted = wrapTextToLines(active.text, normStyle.fontSize, normStyle.boxWidth)
      renderedText = formatted.split('\n').map((line, li, arr) => (
        <span key={li}>
          {line}
          {li < arr.length - 1 ? <br /> : null}
        </span>
      ))
    }
  }

  return (
    <section className="card preview-card">
      <div className="card-head">
        <h2 className="card-title">
          <Icon name="eye" size={15} /> Vista previa
        </h2>
        <div className="preview-head-right">
          <span className="preview-time">{time.toFixed(1)}s / {effDuration}s</span>
          <button
            className={`guides-toggle ${showGuides ? 'active' : ''}`}
            onClick={() => setShowGuides((s) => !s)}
            title="Mostrar zona segura"
          >
            <Icon name="guides" size={15} />
          </button>
        </div>
      </div>

      <div
        className={`preview-frame${showGuides ? ' with-guides' : ''}`}
        style={{ aspectRatio: '9 / 16', backgroundColor: 'transparent' }}
        ref={frameRef}
        onPointerDown={(e) => {
          if (!e.target.closest('.preview-text')) {
            setSelectedLayer(null)
          }
        }}
        onClick={(e) => {
          if (!e.target.closest('.preview-text')) {
            setSelectedLayer(null)
          }
        }}
      >
        {background?.type === 'photo' ? (
          <img
            src={background.photoUrl || background.url || background.previewUrl}
            alt={background.alt || 'Foto de fondo'}
            className="preview-video"
          />
        ) : background?.type === 'video' ? (
          <video
            ref={videoRef}
            src={background.videoUrl || background.url || background.previewUrl}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            className="preview-video"
          />
        ) : (
          <div className="preview-placeholder">
            <span className="preview-emoji">🖼️</span>
            <p>Selecciona un fondo (video o foto)</p>
          </div>
        )}

        <ExtraLayers st={normStyle} cw={containerWidth} fontFamily={fontFamily} color={textColor} />
        {renderExtraTextBoxes()}
        {showGuides && <SafeGuides />}
        {overflowRisk.horizontal && (
          <div className="safe-warning">
            <Icon name="warning" size={13} /> Ajusta el tamaño o acorta la frase
          </div>
        )}

        <div
          className={`preview-text ${selectedLayer === 'quote' ? 'canva-selected' : ''}`}
          style={{
            ...textStyle,
            ...overlayStyle,
            color: textColor,
            fontFamily,
            zIndex: selectedLayer === 'quote' ? 25 : 10,
            ...(!isQuoteInWindow && selectedLayer !== 'quote' ? { display: 'none' } : {}),
            ...(!isQuoteInWindow && selectedLayer === 'quote' ? { opacity: 0.35, outline: '1px dashed rgba(255,255,255,0.45)' } : {}),
          }}
          onPointerDown={(e) => handleTextPointerDown(e, 'quote', 'body')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={(e) => {
            e.stopPropagation()
            setEditingLayerId('quote')
          }}
        >
          {selectedLayer === 'quote' && (
            <div className="canva-bbox" onPointerDown={(e) => e.stopPropagation()}>
              <div className="canva-bbox-actions">
                <button
                  type="button"
                  className="canva-bbox-btn"
                  onClick={() => handleCenterLayer('quote')}
                  title="Centrar texto"
                >
                  <Icon name="target" size={12} /> Centrar
                </button>
                <button
                  type="button"
                  className="canva-bbox-btn"
                  onClick={() => setEditingLayerId('quote')}
                  title="Editar frase directamente"
                >
                  ✏️ Editar
                </button>
                <button
                  type="button"
                  className="canva-bbox-btn"
                  onClick={() => {
                    setSelectedLayer(null)
                    setEditingLayerId(null)
                  }}
                  title="Cerrar selección"
                >
                  ✕
                </button>
              </div>
              <div className="canva-bbox-border" />
              <span className="canva-handle handle-nw" onPointerDown={(e) => handleTextPointerDown(e, 'quote', 'corner-nw')} />
              <span className="canva-handle handle-ne" onPointerDown={(e) => handleTextPointerDown(e, 'quote', 'corner-ne')} />
              <span className="canva-handle handle-sw" onPointerDown={(e) => handleTextPointerDown(e, 'quote', 'corner-sw')} />
              <span className="canva-handle handle-se" onPointerDown={(e) => handleTextPointerDown(e, 'quote', 'corner-se')} />
              <span className="canva-handle handle-w" onPointerDown={(e) => handleTextPointerDown(e, 'quote', 'side-w')} title="Ajustar ancho" />
              <span className="canva-handle handle-e" onPointerDown={(e) => handleTextPointerDown(e, 'quote', 'side-e')} title="Ajustar ancho" />
            </div>
          )}

          {editingLayerId === 'quote' ? (
            <textarea
              className="canva-inline-textarea"
              value={phrase}
              onChange={(e) => handleUpdateText('quote', e.target.value)}
              onBlur={() => setEditingLayerId(null)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setEditingLayerId(null)
              }}
              onPointerDown={(e) => e.stopPropagation()}
              autoFocus
              placeholder="Escribe tu frase…"
              rows={Math.max(1, (phrase || '').split('\n').length)}
            />
          ) : (
            renderedText
          )}
        </div>
      </div>

      {mode !== 'post' && (
        <CanvaTimeline
          time={time}
          duration={duration}
          effectiveDuration={effDuration}
          onSetDuration={onSetDuration}
          playing={playing}
          onTogglePlay={togglePlay}
          onRestart={restart}
          onSeek={applyScrubTime}
          phrase={phrase}
          extraTexts={style?.extraTexts || []}
          background={background}
          voiceId={voiceId}
          selectedLayer={selectedLayer}
          onSelectLayer={(id) => setSelectedLayer(id)}
          onOpenBackground={() => setActiveTool?.('background')}
          onOpenVoice={() => setActiveTool?.('voice')}
          textTiming={{ start: textStart, end: textEnd }}
          onUpdateTextTiming={(patch) => {
            setStyle?.((prev) => ({
              ...prev,
              textStart: patch.start,
              textEnd: patch.end,
            }))
          }}
          onUpdateExtraTextTiming={(boxId, patch) => {
            setStyle?.((prev) => ({
              ...prev,
              extraTexts: (prev.extraTexts || []).map((b) =>
                b.id === boxId ? { ...b, ...patch } : b
              ),
            }))
          }}
          onDeleteExtraText={handleDeleteExtraBox}
        />
      )}
    </section>
  )
}

// Overlay de oscurecimiento + gancho superior + autor inferior.
// Mismas métricas que server/extraText.js (px sobre lienzo de 1080 de ancho).
function ExtraLayers({ st, cw, fontFamily, color }) {
  const k = (cw || 0) / 1080
  const outline = Math.max(1, 3 * k)
  const shadow = Math.max(1, 2 * k)
  const common = {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 3,
    textAlign: 'center',
    padding: `0 ${SAFE_ZONE.leftPct}%`,
    fontFamily,
    color,
    lineHeight: 1.2,
    WebkitTextStroke: `${outline.toFixed(2)}px #000000`,
    paintOrder: 'stroke fill',
    filter: `drop-shadow(0 ${shadow.toFixed(2)}px ${(shadow * 1.2).toFixed(2)}px rgba(0,0,0,0.85))`,
    pointerEvents: 'none',
  }
  return (
    <>
      {st.overlay > 0 && (
        <div
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, zIndex: 2, background: `rgba(0,0,0,${st.overlay / 100})`, pointerEvents: 'none' }}
        />
      )}
      {st.hook && (
        <div
          style={{
            ...common,
            top: `${SAFE_ZONE.topPct}%`,
            fontSize: `${HOOK_FONT_SIZE * k}px`,
            fontWeight: 700,
            letterSpacing: `${2 * k}px`,
            textTransform: 'uppercase',
          }}
        >
          {st.hook}
        </div>
      )}
      {st.author && (
        <div
          style={{
            ...common,
            bottom: `${SAFE_ZONE.bottomPct}%`,
            fontSize: `${AUTHOR_FONT_SIZE * k}px`,
            fontStyle: 'italic',
            fontWeight: 400,
          }}
        >
          {st.author}
        </div>
      )}
    </>
  )
}

// guías de zona segura (líneas punteadas estilo CapCut/Canva)
function SafeGuides() {
  const left = SAFE_ZONE.leftPct
  const right = 100 - SAFE_ZONE.rightPct
  const top = SAFE_ZONE.topPct
  const bottom = 100 - SAFE_ZONE.bottomPct
  return (
    <div className="safe-guides" aria-hidden="true">
      <i className="safe-guide safe-guide-v" style={{ left: `${left}%` }} />
      <i className="safe-guide safe-guide-v" style={{ left: `${right}%` }} />
      <i className="safe-guide safe-guide-h" style={{ top: `${top}%` }} />
      <i className="safe-guide safe-guide-h" style={{ top: `${bottom}%` }} />
      <div
        className="safe-guide-rect"
        style={{ left: `${left}%`, right: `${SAFE_ZONE.rightPct}%`, top: `${top}%`, bottom: `${SAFE_ZONE.bottomPct}%` }}
      />
    </div>
  )
}
