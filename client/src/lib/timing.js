// timing.js — CONTRATO COMPARTIDO v3 entre cliente (preview) y servidor (render ASS).
// Animaciones (fade-pop, slide-up, typewriter, static, full-phrase) + estilo
// personalizable + palabras por bloque + duración automática por frase.
// Debe permanecer IDÉNTICO en server/lib/timing.js

export const VIDEO = {
  width: 1080,
  height: 1920,
  fps: 30,
  duration: 10,
}

// Zona segura (safe area) para publicaciones en redes sociales.
// Porcentajes sobre el lienzo 1080x1920 (y 1080x1356 para post).
// Mantiene el texto alejado de la UI de la plataforma (íconos, nombre de
// usuario, caption) — basado en las guías estándar de Instagram/CapCut.
export const SAFE_ZONE = {
  leftPct: 8,
  rightPct: 8,
  topPct: 15,
  bottomPct: 15,
}

// Estándar de Instagram para reels (1080x1920): zona segura central.
export const INSTAGRAM_REELS_SAFE = { ...SAFE_ZONE }

export function safeZonePx(width = VIDEO.width, height = VIDEO.height, zone = SAFE_ZONE) {
  return {
    left: Math.round((zone.leftPct / 100) * width),
    right: Math.round((zone.rightPct / 100) * width),
    top: Math.round((zone.topPct / 100) * height),
    bottom: Math.round((zone.bottomPct / 100) * height),
  }
}

// posiciónY permitida dentro de la zona segura (clamp)
export function clampSafePositionY(positionY, zone = SAFE_ZONE, fallback = DEFAULT_STYLE.positionY) {
  const top = zone.topPct
  const bottom = 100 - zone.bottomPct
  const v = Number(positionY) || fallback
  return Math.min(bottom, Math.max(top, v))
}

// estilos de animación soportados
export const ANIMATIONS = ['fade-pop', 'slide-up', 'typewriter', 'static', 'full-phrase']

// estilo por defecto = comportamiento actual de la app (retrocompatible con Canva tools)
export const DEFAULT_STYLE = {
  animation: 'fade-pop',   // 'fade-pop' | 'slide-up' | 'typewriter' | 'static' | 'full-phrase'
  fontSize: 92,           // px en lienzo 1080x1920 (20-140)
  positionY: 42,           // % de altura donde centrar el bloque de texto (15-80)
  positionX: 50,           // % horizontal (10-90, 50 = centrado)
  textAlign: 'center',     // 'left' | 'center' | 'right'
  bold: null,              // null = auto según fuente | true | false
  italic: false,           // true | false
  uppercase: false,        // true | false
  letterSpacing: 0,        // px de espaciado entre caracteres (-2 a 12)
  lineHeight: 1.25,        // factor de interlineado (1.0 a 2.0)
  boxBg: '',               // color fondo caja/sticker ('', 'rgba(0,0,0,0.7)', etc.)
  boxWidth: 80,            // % ancho de la caja de texto (30-95)
  shadow: 3,              // intensidad sombra ASS 0-8
  outline: 5,             // grosor contorno base ASS 0-8 (se multiplica por la fuente)
  wordsPerBlock: 2,        // palabras agrupadas por bloque animado (1-4)
  kenBurns: false,         // zoom lento al fondo (efecto Ken Burns via zoompan de ffmpeg)
  overlay: 0,              // % de oscurecimiento del fondo (0-80) para mejorar legibilidad
  hook: '',                // texto superior opcional (gancho)
  author: '',              // texto inferior opcional (autor / firma)
  extraTexts: [],          // cajas de texto adicionales [{ id, text, fontSize, positionX, positionY, boxWidth, textAlign, bold, italic, uppercase, letterSpacing, lineHeight, boxBg, textColor, fontId }]
}

// tamaños base (px sobre lienzo 1080 de ancho) de las capas extra de texto
export const HOOK_FONT_SIZE = 46
export const AUTHOR_FONT_SIZE = 42

const SAFE_MARGIN = 0.35

export function normalizeStyle(style = {}) {
  const s = { ...DEFAULT_STYLE, ...style }
  if (!ANIMATIONS.includes(s.animation)) s.animation = DEFAULT_STYLE.animation
  s.fontSize = clamp(round5(Number(s.fontSize) || DEFAULT_STYLE.fontSize), 20, 140)
  s.positionY = clamp(round5(Number(s.positionY) || DEFAULT_STYLE.positionY), 15, 80)
  s.positionX = clamp(round5(Number(s.positionX) ?? DEFAULT_STYLE.positionX), 10, 90)
  s.boxWidth = clamp(round5(Number(s.boxWidth) || DEFAULT_STYLE.boxWidth), 30, 95)
  s.textAlign = ['left', 'center', 'right'].includes(s.textAlign) ? s.textAlign : DEFAULT_STYLE.textAlign
  s.bold = typeof s.bold === 'boolean' ? s.bold : null
  s.italic = Boolean(s.italic)
  s.uppercase = Boolean(s.uppercase)
  s.letterSpacing = clamp(round5(Number(s.letterSpacing) || 0), -2, 16)
  s.lineHeight = clamp(round5(Number(s.lineHeight) || DEFAULT_STYLE.lineHeight), 0.9, 2.2)
  s.boxBg = typeof s.boxBg === 'string' ? s.boxBg.trim() : ''
  s.shadow = clamp(round5(Number(s.shadow) ?? DEFAULT_STYLE.shadow), 0, 8)
  s.outline = clamp(round5(Number(s.outline) ?? DEFAULT_STYLE.outline), 0, 8)
  s.wordsPerBlock = clamp(Math.round(Number(s.wordsPerBlock) || DEFAULT_STYLE.wordsPerBlock), 1, 4)
  s.overlay = clamp(Math.round(Number(s.overlay) || 0), 0, 80)
  s.hook = String(s.hook || '').replace(/\s+/g, ' ').trim().slice(0, 60)
  s.author = String(s.author || '').replace(/\s+/g, ' ').trim().slice(0, 60)
  s.extraTexts = Array.isArray(s.extraTexts)
    ? s.extraTexts.map((b) => ({
        id: b.id || `box_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        text: String(b.text ?? '').slice(0, 200),
        fontSize: clamp(round5(Number(b.fontSize) || 52), 20, 140),
        positionX: Number.isFinite(Number(b.positionX)) ? clamp(round5(Number(b.positionX)), 5, 95) : 50,
        positionY: Number.isFinite(Number(b.positionY)) ? clamp(round5(Number(b.positionY)), 5, 95) : 30,
        boxWidth: clamp(round5(Number(b.boxWidth) || 75), 20, 98),
        textAlign: ['left', 'center', 'right'].includes(b.textAlign) ? b.textAlign : 'center',
        bold: typeof b.bold === 'boolean' ? b.bold : false,
        italic: Boolean(b.italic),
        uppercase: Boolean(b.uppercase),
        letterSpacing: clamp(round5(Number(b.letterSpacing) || 0), -2, 16),
        lineHeight: clamp(round5(Number(b.lineHeight) || 1.25), 0.9, 2.2),
        boxBg: typeof b.boxBg === 'string' ? b.boxBg.trim() : '',
        textColor: typeof b.textColor === 'string' ? b.textColor : '#FFFFFF',
        fontId: typeof b.fontId === 'string' ? b.fontId : 'montserrat',
        start: typeof b.start === 'number' && Number.isFinite(b.start) ? Math.max(0, round5(b.start)) : 0,
        end: typeof b.end === 'number' && Number.isFinite(b.end) ? Math.max(0.3, round5(b.end)) : null,
      }))
    : []
  return s
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

function round5(n) {
  return Math.round(n * 10) / 10
}

/**
 * Duración automática según el número de palabras de la frase.
 * ≈1.1s por palabra, con límites 8-15s.
 */
export function autoDuration(text, min = 8, max = 15) {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  const est = words * 1.1
  return Math.min(max, Math.max(min, Math.round(est * 10) / 10))
}

/**
 * Divide la frase en bloques de `wordsPerBlock` palabras.
 * El último bloque puede ser más corto.
 */
export function chunkPhrase(text, wordsPerBlock = 2) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const per = Math.max(1, Math.min(4, Math.round(wordsPerBlock)))
  const chunks = []
  for (let i = 0; i < words.length; i += per) {
    chunks.push(words.slice(i, i + per).join(' '))
  }
  return chunks
}

/**
 * Formatea un bloque de texto en líneas balanceadas según el tamaño de fuente y el ancho de la caja,
 * garantizando que el quiebre de líneas sea idéntico entre la vista previa DOM
 * y los subtítulos ASS de FFmpeg.
 */
export function wrapTextToLines(text, fontSize = 92, boxWidth = 80, maxCharsPerLine = null) {
  if (!text) return ''
  const paragraphs = text.split(/\r?\n/)
  const widthPx = (1080 * (Number(boxWidth) || 80)) / 100
  const maxChars = maxCharsPerLine || Math.max(8, Math.floor(widthPx / (fontSize * 0.51)))

  const wrapped = paragraphs.map((para) => {
    const words = para.trim().split(/\s+/).filter(Boolean)
    if (words.length <= 1) return words.join(' ')
    if (para.length <= maxChars) return words.join(' ')

    const lines = []
    let currentLine = []
    let currentLength = 0

    for (const word of words) {
      const space = currentLine.length > 0 ? 1 : 0
      if (currentLength + space + word.length <= maxChars) {
        currentLine.push(word)
        currentLength += space + word.length
      } else {
        if (currentLine.length > 0) lines.push(currentLine.join(' '))
        currentLine = [word]
        currentLength = word.length
      }
    }
    if (currentLine.length > 0) lines.push(currentLine.join(' '))
    return lines.join('\n')
  })

  return wrapped.join('\n')
}

/**
 * Timeline de bloques para la animación.
 * - fade-pop / slide-up / static / typewriter: un bloque visible a la vez
 * - full-phrase: UN SOLO bloque con la frase completa, visible de inicio a fin
 * - typewriter: además revela palabra a palabra dentro de cada bloque
 *
 * @param {string} text
 * @param {number} duration segundos
 * @param {object} style (ver DEFAULT_STYLE)
 * @param {object} opts { wordTimes?: [{word, offset, duration}] } tiempos reales del audio (Edge TTS)
 * @returns {{text, start, end, words?: [{word, start, end}]}[]}
 */
export function buildTimeline(text, duration = VIDEO.duration, style, opts) {
  const st = normalizeStyle(style)
  const chunks = chunkPhrase(text, st.wordsPerBlock)
  if (chunks.length === 0) return []

  const windowStart = typeof st.textStart === 'number' && Number.isFinite(st.textStart)
    ? Math.max(0, st.textStart)
    : 0
  const windowEnd = typeof st.textEnd === 'number' && Number.isFinite(st.textEnd)
    ? Math.min(duration, Math.max(windowStart + 0.3, st.textEnd))
    : round3(duration - 0.15)
  const windowDuration = Math.max(0.3, windowEnd - windowStart)

  // full-phrase: la frase entera como único bloque permanente dentro de la ventana de tiempo
  if (st.animation === 'full-phrase') {
    const block = {
      text: chunks.join(' '),
      start: round3(windowStart),
      end: round3(windowEnd),
    }
    return [block]
  }

  // tiempos reales de audio → mapear bloques con offsets de palabras si disponibles
  if (opts?.wordTimes?.length > 0) {
    return buildTimelineFromAudio(text, chunks, st, duration, opts.wordTimes)
  }

  const per = windowDuration / chunks.length

  return chunks.map((c, idx) => {
    const start = windowStart + idx * per
    const end = start + per
    const isLast = idx === chunks.length - 1
    const block = { text: c, start: round3(start), end: isLast ? round3(windowEnd) : round3(end) }

    if (st.animation === 'typewriter') {
      const words = c.split(' ')
      const wDur = (block.end - block.start) / words.length
      block.words = words.map((w, i) => ({
        word: w,
        start: round3(block.start + i * wDur),
        end: round3(block.start + (i + 1) * wDur),
      }))
    }
    return block
  })
}

/**
 * Timeline sincronizada con el audio real: agrupa las palabras de cada bloque
 * según sus offsets de TTS. Se usa cuando hay narración. Si el audio es más corto
 * que la duración seleccionada, los bloques se distribuyen en la parte hablada
 * y el resto queda en el último bloque (o vacío).
 */
function buildTimelineFromAudio(text, chunks, st, duration, wordTimes) {
  // normalizar palabras: quitar puntuación para comparar con texto TTS
  const norm = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}']+/gu, '')

  const wordsFromText = Array.from(text.matchAll(/\p{L}[\p{L}\p{N}']*|\d+/gu)).map((m) => m[0])
  const groupIntoChunks = (arr, per) => {
    const out = []
    for (let i = 0; i < arr.length; i += per) out.push(arr.slice(i, i + per))
    return out
  }
  const wordGroups = groupIntoChunks(wordsFromText, st.wordsPerBlock)

  // índice por palabra TTS (normalizada) → offset
  const ttsIdx = new Map()
  for (let i = 0; i < wordTimes.length; i++) {
    const key = norm(wordTimes[i].word)
    if (!key) continue
    if (!ttsIdx.has(key)) ttsIdx.set(key, [])
    ttsIdx.get(key).push(wordTimes[i].offset)
  }

  const blocks = wordGroups.map((group, gi) => {
    const offsets = []
    for (const w of group) {
      const key = norm(w)
      const list = ttsIdx.get(key)
      if (list?.length) {
        offsets.push(list.shift())
      }
    }
    return { group, offsets }
  })

  // start de cada bloque = offset de la primera palabra encontrada
  // end = inicio del siguiente bloque (o duración finalizada)
  const timeline = blocks.map((b, i) => {
    const start = b.offsets.length > 0
      ? Math.min(...b.offsets)
      : i === 0 ? 0 : blocks[i - 1].offsets.length > 0 ? Math.max(...blocks[i - 1].offsets) : null
    return { ...b, start: start ?? 0 }
  })

  const result = timeline.map((b, i) => {
    const isLast = i === timeline.length - 1
    const next = timeline[i + 1]
    let end
    if (isLast) {
      end = round3(Math.max(duration - 0.15, (b.start ?? 0) + 0.4))
    } else if (next.start != null && next.start > (b.start ?? 0)) {
      // este bloque termina justo cuando empieza el siguiente (sin huecos)
      end = round3(next.start)
    } else {
      end = round3((b.start ?? 0) + 0.6)
    }

    // en typewriter, desglosar las palabras con sus offsets
    let words
    if (st.animation === 'typewriter' && b.group.length > 0) {
      const wOff = b.offsets
      const group = b.group
      words = group.map((w, wi) => {
        const s = wOff[wi] ?? (wi === 0 ? (b.start ?? 0) : words?.[wi - 1]?.end ?? (b.start ?? 0))
        const e = wOff[wi + 1] ?? (wi === group.length - 1 ? end : s + 0.15)
        return { word: w, start: round3(s), end: round3(e) }
      })
    }

    return {
      text: b.group.join(' '),
      start: round3(b.start ?? 0),
      end,
      ...(words ? { words } : {}),
    }
  })

  // garantizar bloques contiguos sin huecos: si un bloque quedó con start==end
  // o invertido, dilatarlo con una fracción mínima
  return result.map((b, i) => {
    const nb = { ...b }
    if (nb.end <= nb.start) nb.end = round3(Math.min(duration, nb.start + 0.35))
    if (i === 0) nb.start = round3(Math.max(0, nb.start - 0.05))
    return nb
  })
}

/**
 * Duración total a usar cuando hay narración de voz:
 * duración del audio + margen, respetando el mínimo seleccionado.
 */
export function durationWithVoice(audioDuration, minDuration = VIDEO.duration) {
  const margin = 0.8
  return round3(Math.max(minDuration, audioDuration + margin))
}

function round3(n) {
  return Math.round(n * 1000) / 1000
}
