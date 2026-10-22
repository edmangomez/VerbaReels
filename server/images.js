// images.js — genera imágenes estáticas con la frase quemada sobre una foto,
// en los tamaños estándar para Instagram, Facebook y WhatsApp.
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { mkdtemp, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeStyle, SAFE_ZONE, safeZonePx, clampSafePositionY, wrapTextToLines } from './lib/timing.js'
import { buildExtraLayers } from './extraText.js'
import { FONTS_DIR as FONT_DIR, getFontById, getFontTtfScale, getAssOutline, getAssShadow } from './lib/fontMetrics.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RENDERS_DIR = path.join(__dirname, 'renders')
mkdirSync(RENDERS_DIR, { recursive: true })

// tamaños estándar de redes sociales
export const IMAGE_SIZES = {
  square: { label: 'Post cuadrado IG/FB', width: 1080, height: 1080 },
  portrait: { label: 'Retrato IG feed', width: 1080, height: 1356 },
  story: { label: 'Historia IG/FB/WhatsApp', width: 1080, height: 1920 },
  link: { label: 'Enlace FB', width: 1200, height: 630 },
}

/**
 * Genera 1 imagen PNG: foto de fondo + frase completa quemada con el estilo.
 * La frase completa se muestra de una vez (sin animación), centrada.
 */
export async function renderImage({ photoUrl, phrase, fontId, textColor, style, sizeKey }) {
  const size = IMAGE_SIZES[sizeKey]
  if (!size) throw new Error(`Tamaño desconocido: ${sizeKey}`)

  const jobDir = await mkdtemp(path.join(tmpdir(), 'img-'))
  const assFile = path.join(jobDir, 'img.ass')
  const outFile = path.join(RENDERS_DIR, `img-${sizeKey}-${Date.now()}.png`)

  // ASS adaptado al lienzo de la imagen: un solo Dialogue con la frase completa,
  // escala de fuente relativa al lienzo (1080 de ancho → igual que el reel)
  const st = normalizeStyle({ ...style, animation: 'static' })
  const ass = buildImageASS({ phrase, fontId, textColor, style: st, size })
  await writeFile(assFile, ass, 'utf8')

  const isVideo = /\.(mp4|webm|mov|mkv)($|\?)/i.test(photoUrl) || /video|video-files/i.test(photoUrl)
  const args = [
    '-y',
    '-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    ...(isVideo ? ['-ss', '1'] : []),
    '-i', photoUrl,
    '-vf', [
      `scale=${size.width}:${size.height}:force_original_aspect_ratio=increase`,
      `crop=${size.width}:${size.height}`,
      ...(st.overlay > 0 ? [`drawbox=x=0:y=0:w=iw:h=ih:color=black@${(st.overlay / 100).toFixed(2)}:t=fill`] : []),
      `subtitles=${assArg(assFile)}:fontsdir=${assArg(FONT_DIR)}`,
    ].join(','),
    '-frames:v', '1',
    '-update', '1',
    outFile,
  ]

  await runFF(args)
  const info = await stat(outFile)
  return { file: outFile, sizeKey, width: size.width, height: size.height, sizeMB: Math.round((info.size / 1024 / 1024) * 100) / 100 }
}

// ASS para imagen estática: un solo evento que cubre todo el lienzo
function buildImageASS({ phrase, fontId, textColor, style, size, safeZone = SAFE_ZONE }) {
  const font = getFontById(fontId)

  // Escala relativa al ancho base de 1080 px + escala métrica TrueType de la fuente
  const scale = size.width / 1080
  const ttfScale = getFontTtfScale(font.id)
  const fontSize = Math.round(style.fontSize * scale * ttfScale)
  const outlineReal = getAssOutline(style.outline, font.id, scale)
  const shadowReal = getAssShadow(style.shadow, scale)

  const zm = safeZonePx(size.width, size.height, safeZone)

  const boldFlag = style.bold === true ? -1 : style.bold === false ? 0 : ((font.weight || 400) >= 600 ? -1 : 0)
  const italicFlag = style.italic ? -1 : 0
  const spacing = Math.round((style.letterSpacing || 0) * scale)
  const alignment = style.textAlign === 'left' ? 7 : style.textAlign === 'right' ? 9 : 8
  const borderStyle = style.boxBg ? 3 : 1
  const backColour = style.boxBg ? assBoxColor(style.boxBg) : '&H80000000'

  const posX = style.textAlign === 'left'
    ? Math.round(style.positionX <= 50 ? zm.left : (style.positionX / 100) * size.width)
    : style.textAlign === 'right'
      ? Math.round(style.positionX >= 50 ? size.width - zm.right : (style.positionX / 100) * size.width)
      : Math.round((style.positionX / 100) * size.width)
  const posY = Math.round((clampSafePositionY(style.positionY, safeZone) / 100) * size.height)

  let text = phrase
  if (style.uppercase) text = text.toUpperCase()
  const formattedPhrase = wrapTextToLines(text, style.fontSize * scale, style.boxWidth)

  const extra = buildExtraLayers({
    st: style, width: size.width, height: size.height, scale, safeZone,
    fontId: font.id, fontFamily: font.family, textColor, duration: 5,
  })
  const header = [
    `[Script Info]`,
    `ScriptType: v4.00+`,
    `PlayResX: ${size.width}`,
    `PlayResY: ${size.height}`,
    `WrapStyle: 2`,
    `ScaledBorderAndShadow: yes`,
    ``,
    `[V4+ Styles]`,
    `Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding`,
    `Style: Quote,${font.family},${fontSize},&H00${assColor(textColor)},&H00FFFFFF,&H00000000,${backColour},${boldFlag},${italicFlag},0,0,100,100,${spacing},0,${borderStyle},${outlineReal},${shadowReal},${alignment},20,20,${posY},1`,
    ...extra.styleLines,
    ``,
    `[Events]`,
    `Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`,
    `Dialogue: 0,0:00:00.00,0:00:05.00,Quote,,0,0,${posY},,{\\pos(${posX},${posY})}${escapeText(formattedPhrase)}`,
    ...extra.events,
    ``,
  ].join('\n')
  return header
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

function assColor(hex) {
  const h = (hex || '#FFFFFF').replace('#', '')
  const r = h.slice(0, 2)
  const g = h.slice(2, 4)
  const b = h.slice(4, 6)
  return `${b}${g}${r}`.toUpperCase()
}

function escapeText(t) {
  return t.replace(/\r?\n/g, '\\N').replace(/\{/g, '(').replace(/\}/g, ')')
}

function assArg(p) {
  const a = p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'")
  return `'${a}'`
}

function runFF(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { windowsHide: true })
    let stderr = ''
    proc.stderr.on('data', (d) => {
      stderr += d
      if (stderr.length > 10000) stderr = stderr.slice(-5000)
    })
    proc.on('error', (err) => reject(new Error(`ffmpeg no disponible: ${err.message}`)))
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else {
        const tail = stderr.split('\n').filter(Boolean).slice(-6).join('\n')
        reject(new Error(`ffmpeg falló (código ${code}):\n${tail}`))
      }
    })
  })
}
