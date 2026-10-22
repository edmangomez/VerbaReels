// extraText.js — capas ASS opcionales (hook superior + autor inferior + cajas de texto extra)
// compartidas entre el render de reels (subtitle.js) y el de imágenes (images.js).
import { HOOK_FONT_SIZE, AUTHOR_FONT_SIZE, safeZonePx, wrapTextToLines } from './lib/timing.js'
import { getFontById, getFontTtfScale, getAssOutline, getAssShadow } from './lib/fontMetrics.js'

function assColor(hex) {
  const h = (hex || '#FFFFFF').replace('#', '')
  return `${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}`.toUpperCase()
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
  return '&H30000000'
}

function escapeText(t) {
  return String(t).replace(/\r?\n/g, '\\N').replace(/\{/g, '(').replace(/\}/g, ')')
}

/**
 * @param {object} o
 * @param {object} o.st        estilo normalizado (hook, author, extraTexts)
 * @param {number} o.width     PlayResX
 * @param {number} o.height    PlayResY
 * @param {number} o.scale     multiplicador de tamaño base (1080 → lienzo ASS), igual al del texto principal
 * @param {object} o.safeZone
 * @param {string} o.fontId    id de la fuente principal
 * @param {string} o.fontFamily
 * @param {string} o.textColor
 * @param {number} o.duration  segundos que permanecen visibles
 * @returns {{ styleLines: string[], events: string[] }}
 */
export function buildExtraLayers({ st, width, height, scale, safeZone, fontId, fontFamily, textColor, duration }) {
  const styleLines = []
  const events = []
  const zm = safeZonePx(width, height, safeZone)
  const posX = Math.round(width / 2)
  const end = secToAss(duration)
  const mainTtfScale = getFontTtfScale(fontId)
  const outline = getAssOutline(st.outline ?? 3, fontId, scale)
  const shadow = getAssShadow(st.shadow ?? 2, scale)
  const color = `&H00${assColor(textColor)}`

  if (st.hook) {
    const size = Math.round(HOOK_FONT_SIZE * scale * mainTtfScale)
    styleLines.push(
      `Style: Hook,${fontFamily},${size},${color},&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,2,0,1,${outline},${shadow},8,20,20,0,1`
    )
    events.push(`Dialogue: 1,0:00:00.00,${end},Hook,,0,0,0,,{\\pos(${posX},${zm.top})}${escapeText(st.hook.toUpperCase())}`)
  }

  if (st.author) {
    const size = Math.round(AUTHOR_FONT_SIZE * scale * mainTtfScale)
    styleLines.push(
      `Style: Author,${fontFamily},${size},${color},&H00FFFFFF,&H00000000,&H80000000,0,-1,0,0,100,100,0,0,1,${outline},${shadow},2,20,20,0,1`
    )
    events.push(`Dialogue: 1,0:00:00.00,${end},Author,,0,0,0,,{\\pos(${posX},${height - zm.bottom})}${escapeText(st.author)}`)
  }

  if (Array.isArray(st.extraTexts)) {
    st.extraTexts.forEach((box, idx) => {
      if (!box || !box.text?.trim()) return
      const boxStyleName = `ExtraBox_${idx + 1}`
      const boxFont = getFontById(box.fontId || fontId)
      const boxTtfScale = getFontTtfScale(boxFont.id)
      const rawFontSize = Number(box.fontSize) || 52
      const boxSize = Math.round(rawFontSize * scale * boxTtfScale)
      const boxColor = `&H00${assColor(box.textColor || textColor)}`
      const boldFlag = box.bold ? -1 : 0
      const italicFlag = box.italic ? -1 : 0
      const alignVal = box.textAlign === 'left' ? 7 : box.textAlign === 'right' ? 9 : 8
      const boxPosX = Math.round((Number(box.positionX ?? 50) / 100) * width)
      const boxPosY = Math.round((Number(box.positionY ?? 30) / 100) * height)
      const boxOutline = getAssOutline(st.outline, boxFont.id, scale)
      const boxShadow = getAssShadow(st.shadow, scale)
      const borderStyle = box.boxBg ? 3 : 1
      const backColour = box.boxBg ? assBoxColor(box.boxBg) : '&H80000000'
      const spacing = Math.round((Number(box.letterSpacing) || 0) * scale)

      const textRaw = box.uppercase ? box.text.toUpperCase() : box.text
      const wrapped = wrapTextToLines(textRaw.trim(), rawFontSize, Number(box.boxWidth) || 70)
      const escaped = escapeText(wrapped)

      styleLines.push(
        `Style: ${boxStyleName},${boxFont.family},${boxSize},${boxColor},&H00FFFFFF,&H00000000,${backColour},${boldFlag},${italicFlag},0,0,100,100,${spacing},0,${borderStyle},${boxOutline},${boxShadow},${alignVal},20,20,0,1`
      )
      const bStart = typeof box.start === 'number' && Number.isFinite(box.start) ? Math.max(0, box.start) : 0
      const bEnd = typeof box.end === 'number' && Number.isFinite(box.end) ? Math.min(duration, Math.max(bStart + 0.3, box.end)) : duration
      const assStart = secToAss(bStart)
      const assEnd = secToAss(bEnd)
      events.push(`Dialogue: 1,${assStart},${assEnd},${boxStyleName},,0,0,0,,{\\pos(${boxPosX},${boxPosY})}${escaped}`)
    })
  }

  return { styleLines, events }
}

function secToAss(sec) {
  const cs = Math.round(sec * 100)
  const h = Math.floor(cs / 360000)
  const m = Math.floor((cs % 360000) / 6000)
  const s = Math.floor((cs % 6000) / 100)
  const c = cs % 100
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`
}
