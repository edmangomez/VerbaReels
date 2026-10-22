// library.js — biblioteca local: frases guardadas, reels e imágenes generadas.
// Persistencia JSON en server/data/library.json (suficiente para miles de items).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
const LIB_FILE = path.join(DATA_DIR, 'library.json')
mkdirSync(DATA_DIR, { recursive: true })

const MAX_ITEMS = 500 // límite de retención por tipo (FIFO: borra los más viejos)

// título legible derivado de la frase (capitaliza y acorta, sin signos finales)
export function titleFromPhrase(phrase) {
  const t = String(phrase || '').trim()
  if (!t) return 'Sin título'
  // primera palabra o primeras 4 palabras, máx 40 caracteres
  const cleaned = t
    .replace(/^[\s"']+|[\s"']+$/g, '')
    .replace(/^[«“]+/, '')
    .replace(/[.,;:!¡?¿"«»”]+$/g, '')
    .split(/\s+/)
    .slice(0, 4)
    .join(' ')
    .slice(0, 40)
    .trim()
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

function load() {
  if (!existsSync(LIB_FILE)) return { phrases: [], reels: [], images: [] }
  try {
    return JSON.parse(readFileSync(LIB_FILE, 'utf8'))
  } catch {
    return { phrases: [], reels: [], images: [] }
  }
}

function persist(lib) {
  // recorte FIFO si excede el máximo
  for (const key of ['phrases', 'reels', 'images']) {
    if (lib[key].length > MAX_ITEMS) {
      lib[key] = lib[key].slice(-MAX_ITEMS)
    }
  }
  writeFileSync(LIB_FILE, JSON.stringify(lib, null, 2))
}

export function addPhrase({ text, category }) {
  const lib = load()
  // evitar duplicados exactos consecutivos
  const exists = lib.phrases.some((p) => p.text === text)
  if (!exists) {
    lib.phrases.push({
      id: `ph_${Date.now()}`,
      text,
      title: titleFromPhrase(text),
      category: category || null,
      createdAt: new Date().toISOString(),
    })
    persist(lib)
  }
  return lib.phrases
}

export function getPhrases() {
  return load().phrases.slice().reverse()
}

export function deletePhrase(id) {
  const lib = load()
  lib.phrases = lib.phrases.filter((p) => p.id !== id)
  persist(lib)
  return lib.phrases
}

export function addReel({ file, thumbFile, phrase, fontId, textColor, duration, style, backgroundAuthor, description, hashtags, source, sizeMB }) {
  const lib = load()
  const thumbBase = thumbFile ? path.basename(thumbFile) : null
  lib.reels.push({
    id: `reel_${Date.now()}`,
    file: path.basename(file),
    url: `/renders/${path.basename(file)}`,
    thumbUrl: thumbBase ? `/renders/${thumbBase}` : null,
    title: titleFromPhrase(phrase),
    phrase,
    fontId,
    textColor,
    duration,
    style,
    backgroundAuthor,
    description,
    hashtags,
    source,
    sizeMB,
    createdAt: new Date().toISOString(),
  })
  persist(lib)
  return lib.reels
}

export function getReels() {
  return load().reels.slice().reverse()
}

export function deleteReel(id) {
  const lib = load()
  const reel = lib.reels.find((r) => r.id === id)
  lib.reels = lib.reels.filter((r) => r.id !== id)
  persist(lib)
  return { reels: lib.reels, deletedFile: reel?.file || null }
}

export function addImage({ file, phrase, size, width, height, source }) {
  const lib = load()
  lib.images.push({
    id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    file: path.basename(file),
    url: `/renders/${path.basename(file)}`,
    title: titleFromPhrase(phrase),
    phrase,
    size,
    width,
    height,
    source,
    createdAt: new Date().toISOString(),
  })
  persist(lib)
  return lib.images
}

export function getImages() {
  return load().images.slice().reverse()
}

export function deleteImage(id) {
  const lib = load()
  const img = lib.images.find((i) => i.id === id)
  lib.images = lib.images.filter((i) => i.id !== id)
  persist(lib)
  return { images: lib.images, deletedFile: img?.file || null }
}
