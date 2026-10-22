// fontMetrics.js — Métricas reales de las fuentes TrueType (.ttf) para lograr
// paridad visual 1:1 entre el DOM/CSS (Preview.jsx) y libass/FFmpeg (subtitle.js, extraText.js, images.js).
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const FONTS_DIR = path.join(__dirname, '..', 'assets', 'fonts')

let manifestCache = null
let outlineMapCache = null
const ttfScaleCache = new Map()

export function getFontsManifest() {
  if (!manifestCache) {
    manifestCache = JSON.parse(readFileSync(path.join(FONTS_DIR, 'fonts.json'), 'utf8'))
  }
  return manifestCache
}

export function getFontById(fontId) {
  const manifest = getFontsManifest()
  return manifest.find((f) => f.id === fontId) || manifest[0]
}

export function getOutlineMultiplier(fontId) {
  if (!outlineMapCache) {
    try {
      outlineMapCache = JSON.parse(readFileSync(path.join(FONTS_DIR, 'fonts-outline.json'), 'utf8'))
    } catch {
      outlineMapCache = {}
    }
  }
  return outlineMapCache[fontId] ?? 1.0
}

/**
 * En CSS, `font-size` escala el cuadro EM (`unitsPerEm` de la tabla `head`).
 * En libass (FFmpeg), `Fontsize` escala la altura de celda (`usWinAscent + usWinDescent` de la tabla `OS/2`).
 * Por eso libass reduce todas las fuentes por un factor `(usWinAscent + usWinDescent) / unitsPerEm` (entre 1.30x y 1.93x).
 * Multiplicar el `fontSize` por este factor exacto del archivo .ttf hace que el glifo en FFmpeg mida
 * exactamente los mismos píxeles que en la vista previa CSS.
 */
export function getFontTtfScale(fontId) {
  const font = getFontById(fontId)
  if (!font?.file) return 1.35
  if (ttfScaleCache.has(font.file)) return ttfScaleCache.get(font.file)

  try {
    const buf = readFileSync(path.join(FONTS_DIR, font.file))
    const numTables = buf.readUInt16BE(4)
    const tables = {}
    for (let i = 0; i < numTables; i++) {
      const tag = buf.toString('ascii', 12 + i * 16, 16 + i * 16)
      tables[tag] = buf.readUInt32BE(20 + i * 16)
    }
    const upm = buf.readUInt16BE(tables['head'] + 18)
    const winAsc = buf.readUInt16BE(tables['OS/2'] + 74)
    const winDesc = buf.readUInt16BE(tables['OS/2'] + 76)
    const ratio = upm > 0 && winAsc + winDesc > 0 ? (winAsc + winDesc) / upm : 1.35
    ttfScaleCache.set(font.file, ratio)
    return ratio
  } catch {
    return 1.35
  }
}

/**
 * Convierte el grosor de contorno CSS (`-webkit-text-stroke` con `paint-order: stroke fill`,
 * donde solo la mitad del trazo sale hacia afuera del glifo) al radio externo `Outline` de libass.
 */
export function getAssOutline(outline, fontId, scale = 1) {
  const mult = getOutlineMultiplier(fontId)
  const raw = (Number(outline) || 0) * 0.42 * mult * scale
  return Math.round(raw * 10) / 10
}

/**
 * Convierte la sombra CSS (`drop-shadow`) al desplazamiento `Shadow` de libass.
 */
export function getAssShadow(shadow, scale = 1) {
  const raw = (Number(shadow) || 0) * 0.65 * scale
  return Math.round(raw * 10) / 10
}
