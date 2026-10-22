// subtitle.js v3 — genera ASS con 5 animaciones + estilo personalizable
// (incluye contorno adaptado al grosor de cada tipografía y escala métrica TrueType),
// usando el MISMO timeline compartido (lib/timing.js) que el preview.
import { buildTimeline, VIDEO, normalizeStyle, SAFE_ZONE, safeZonePx, clampSafePositionY, wrapTextToLines } from './lib/timing.js'
import { buildExtraLayers } from './extraText.js'
import { getFontById, getFontTtfScale, getAssOutline, getAssShadow } from './lib/fontMetrics.js'

const FADE = 0.3 // segundos, igual que Preview (FADE_MS=300)
const POP_MS = 300

export function buildASS({ phrase, duration = VIDEO.duration, fontId, textColor, style, wordTimes, safeZone = SAFE_ZONE }) {
  const st = normalizeStyle(style)
  const font = getFontById(fontId)

  // Escalar tamaño de fuente, contorno y sombra al ancho base (1080 px).
  // Multiplicamos por getFontTtfScale(font.id) = (usWinAscent + usWinDescent) / unitsPerEm
  // para compensar el escalado por celda de libass y lograr paridad 1:1 con CSS font-size.
  const assScale = VIDEO.width / 1080
  const ttfScale = getFontTtfScale(font.id)
  const assFontSize = Math.round(st.fontSize * assScale * ttfScale)
  const outlineReal = getAssOutline(st.outline, font.id, assScale)
  const assShadow = getAssShadow(st.shadow, assScale)

  // Formato Canva: negrita, cursiva, espaciado y caja de fondo
  const boldFlag = st.bold === true ? -1 : st.bold === false ? 0 : ((font.weight || 400) >= 600 ? -1 : 0)
  const italicFlag = st.italic ? -1 : 0
  const spacing = Math.round((st.letterSpacing || 0) * assScale)
  const borderStyle = st.boxBg ? 3 : 1
  const backColour = st.boxBg ? assBoxColor(st.boxBg) : '&H80000000'

  const timeline = buildTimeline(phrase, duration, st, { wordTimes })

  const zm = safeZonePx(VIDEO.width, VIDEO.height, safeZone)
  const alignment = st.textAlign === 'left' ? 7 : st.textAlign === 'right' ? 9 : 8
  const posX = getCalculatedPosX(st, VIDEO.width, zm)
  // posiciónY dentro de la zona segura (evita la UI de la plataforma)
  const posY = Math.round((clampSafePositionY(st.positionY, safeZone) / 100) * VIDEO.height)

  const extra = buildExtraLayers({
    st, width: VIDEO.width, height: VIDEO.height, scale: assScale, safeZone,
    fontId: font.id, fontFamily: font.family, textColor, duration,
  })

  const styleLine = [
    `[V4+ Styles]`,
    `Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding`,
    `Style: Quote,${font.family},${assFontSize},&H00${assColor(textColor)},&H00FFFFFF,&H00000000,${backColour},${boldFlag},${italicFlag},0,0,100,100,${spacing},0,${borderStyle},${outlineReal},${assShadow},${alignment},20,20,${posY},1`,
    ...extra.styleLines,
  ].join('\n')

  const events = timeline.map((b, i) => {
    const isLast = i === timeline.length - 1
    const isFirst = i === 0
    return `Dialogue: 0,${assTime(b.start)},${assTime(b.end)},Quote,,0,0,${posY},,${blockTags(b, isLast, isFirst, st, safeZone)}${eventText(b, st)}`
  })
  events.push(...extra.events)

  const header = [
    `[Script Info]`,
    `ScriptType: v4.00+`,
    `PlayResX: ${VIDEO.width}`,
    `PlayResY: ${VIDEO.height}`,
    `WrapStyle: 2`,
    `ScaledBorderAndShadow: yes`,
    ``,
    styleLine,
    ``,
    `[Events]`,
    `Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`,
  ].join('\n')

  return `${header}\n${events.join('\n')}\n`
}

function getCalculatedPosX(st, width, zm) {
  if (st.textAlign === 'left') {
    return Math.round(st.positionX <= 50 ? zm.left : (st.positionX / 100) * width)
  }
  if (st.textAlign === 'right') {
    return Math.round(st.positionX >= 50 ? width - zm.right : (st.positionX / 100) * width)
  }
  return Math.round((st.positionX / 100) * width)
}

function assBoxColor(boxBg) {
  if (!boxBg) return '&H80000000'
  if (boxBg.includes('#')) {
    const hex = boxBg.replace('#', '').padEnd(6, '0')
    const r = hex.slice(0, 2)
    const g = hex.slice(2, 4)
    const b = hex.slice(4, 6)
    return `&H30${b}${g}${r}`.toUpperCase()
  }
  return '&H30000000' // caja semitransparente oscura
}

// texto del evento: typewriter revela palabra a palabra con tags \alpha+\t
function eventText(b, st) {
  let text = b.text
  if (st.uppercase) text = text.toUpperCase()
  const formatted = wrapTextToLines(text, st.fontSize, st.boxWidth)
  if (st.animation === 'typewriter' && Array.isArray(b.words)) {
    const parts = b.words.map((w, i) => {
      const wText = st.uppercase ? w.word.toUpperCase() : w.word
      if (i === 0) return escapeText(wText)
      const delayMs = Math.round((w.start - b.start) * 1000)
      return `{\\alpha&HFF&\\t(${delayMs},${delayMs + 100},\\alpha&H00&)}${escapeText(wText)}`
    })
    return parts.join(' ')
  }
  return escapeText(formatted)
}

// tags ASS por estilo de animación.
// El fade global SOLO ocurre en los extremos (primer bloque entra, último
// sale). Los bloques intermedios transicionan con el pop/slide (que no
// genera huecos) — así nunca hay frames sin texto entre bloques.
function blockTags(b, isLast, isFirst, st, safeZone = SAFE_ZONE) {
  const zm = safeZonePx(VIDEO.width, VIDEO.height, safeZone)
  const posX = getCalculatedPosX(st, VIDEO.width, zm)
  const posY = Math.round((clampSafePositionY(st.positionY, safeZone) / 100) * VIDEO.height)
  const pos = `\\pos(${posX},${posY})`
  const fadeInMs = isFirst ? 300 : 0
  const fadeOutMs = isLast ? 400 : 0

  switch (st.animation) {
    case 'static':
    case 'full-phrase':
      // sin animación: aparece y permanece (fade suave de entrada)
      return `{${pos}\\fad(400,0)}`
    case 'slide-up': {
      const startY = isFirst ? posY + 60 : posY + 30
      const moveMs = isFirst ? 300 : 150
      return `{\\move(${posX},${startY},${posX},${posY},0,${moveMs})\\fad(${fadeInMs},${fadeOutMs})}`
    }
    case 'typewriter':
      return `{${pos}\\fad(${fadeInMs},0)}`
    case 'fade-pop':
    default: {
      const popMs = isFirst ? 280 : 180
      return `{${pos}\\fad(${fadeInMs},${fadeOutMs})\\fscx86\\fscy86\\t(0,${popMs},\\fscx100\\fscy100)}`
    }
  }
}

// convierte #RRGGBB → BGR&H en formato ASS
function assColor(hex) {
  const h = (hex || '#FFFFFF').replace('#', '')
  const r = h.slice(0, 2)
  const g = h.slice(2, 4)
  const b = h.slice(4, 6)
  return `${b}${g}${r}`.toUpperCase()
}

// 12.345 → 0:00:12.35
function assTime(sec) {
  const cs = Math.round(sec * 100)
  const h = Math.floor(cs / 360000)
  const m = Math.floor((cs % 360000) / 6000)
  const s = Math.floor((cs % 6000) / 100)
  const c = cs % 100
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`
}

function escapeText(t) {
  return t.replace(/\r?\n/g, '\\N').replace(/\{/g, '(').replace(/\}/g, ')')
}
