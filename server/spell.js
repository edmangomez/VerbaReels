// spell.js — corrección ortográfica híbrida.
// Prefiere IA contextual (atrapa tildes, homófonos, gramática) y cae a nspell
// + diccionario español offline cuando no hay IA configurada.
import nspell from 'nspell'
import dictEs from 'dictionary-es'

let enginePromise = null
async function getSpell() {
  if (!enginePromise) {
    enginePromise = (async () => {
      const d = await dictEs
      const spell = nspell(d)
      // palabras frecuentes de este dominio (reels, post, hashtag…)
      for (const w of ['reels', 'post', 'posts', 'hashtag', 'hashtags', 'story', 'stories', 'instagram']) spell.add(w.toLowerCase())
      return spell
    })()
  }
  return enginePromise
}

// vocal base → variantes acentuadas (para recuperar tildes faltantes: dia → día)
const ACCENT_MAP = { a: ['á'], e: ['é'], i: ['í'], o: ['ó'], u: ['ú', 'ü'] }

// tokens de palabras (conserva puntuación y espacios para reconstruir)
const WORD_RE = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:['’][A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?/g

// reemplaza una posición de vocal por su variante acentuada
function* accentVariants(word) {
  for (let i = 0; i < word.length; i++) {
    const ch = word[i].toLowerCase()
    const accents = ACCENT_MAP[ch]
    if (!accents) continue
    for (const a of accents) {
      if (word[i] === a) continue
      const applied = word[i] === ch ? a : a.toUpperCase()
      yield word.slice(0, i) + applied + word.slice(i + 1)
    }
  }
}

/**
 * Corrige ortografía con IA contextual.
 * @returns {{corrected: string, issues: [{original, corrected, type}]}}
 */
async function correctWithAI(text) {
  const { chat, extractJSON } = await import('./ai.js')
  const raw = await chat([
    {
      role: 'system',
      content:
        'Eres un corrector ortográfico de español para frases motivacionales de Instagram. Corrige SOLO errores reales de ortografía, tildes y gramática básica (homófonos: hay/ay, a ver/haber, vaya/valla, porque/por qué en contexto). NO cambies el estilo, tono ni palabras válidas. Devuelve SOLO JSON: {"corrected": "frase corregida", "changes": [{"original": "...", "corrected": "..."}]}. Si no hay errores, changes vacío y corrected igual al original.',
    },
    { role: 'user', content: text.slice(0, 400) },
  ])
  const { corrected, changes } = extractJSON(raw)
  if (typeof corrected !== 'string' || !corrected) throw new Error('IA no devolvió texto corregido')
  const issues = (Array.isArray(changes) ? changes : [])
    .filter((c) => c && typeof c.original === 'string' && typeof c.corrected === 'string' && c.original !== c.corrected)
    .map((c) => ({ original: c.original, corrected: c.corrected, type: 'ai' }))
  return { corrected: corrected.trim(), issues, source: 'ai' }
}

/**
 * Corrección offline con nspell: por palabra, con especial cuidado de tildes
 * (el diccionario correto de la RAE marca "días" válido, "dias" no).
 * @returns {{corrected, issues, source}}
 */
export async function correctOffline(text) {
  const spell = await getSpell()
  const tokens = []
  let m
  WORD_RE.lastIndex = 0
  while ((m = WORD_RE.exec(text))) tokens.push({ word: m[0], index: m.index })
  if (tokens.length === 0) return { corrected: text, issues: [], source: 'local' }

  const issues = []
  const corrections = new Map() // index → reemplazo

  for (const { word, index } of tokens) {
    if (spell.correct(word.toLowerCase())) continue

    // 1) variantes acentuadas: "dias" → "días"
    let fixed = null
    for (const variant of accentVariants(word)) {
      if (spell.correct(variant.toLowerCase())) { fixed = variant; break }
    }
    if (fixed) {
      corrections.set(index, fixed)
      issues.push({ original: word, corrected: fixed, type: 'accent' })
      continue
    }

    // 2) sugerencias de Hunspell
    const sugg = spell.suggest(word.toLowerCase())
    if (sugg.length > 0) {
      const best = sugg[0]
      // preservar capitalización inicial si la original la tiene
      const applied = /^[A-ZÁÉÍÓÚÜÑ]/.test(word) ? best[0].toUpperCase() + best.slice(1) : best
      corrections.set(index, applied)
      issues.push({ original: word, corrected: applied, type: 'spelling' })
    } else {
      issues.push({ original: word, corrected: word, type: 'unknown' })
    }
  }

  // reconstruir el texto con los reemplazos (por índice, sin tocar tokens no corregidos)
  let out = ''
  let last = 0
  const sorted = [...corrections.entries()].sort((a, b) => a[0] - b[0])
  for (const [idx, repl] of sorted) {
    out += text.slice(last, idx) + repl
    last = idx + tokens.find((t) => t.index === idx).word.length
  }
  out += text.slice(last)
  return { corrected: out, issues, source: 'local' }
}

/**
 * Punto de entrada público: IA contextual si hay, nspell si no.
 */
export async function checkSpelling(text) {
  if (!text || !text.trim()) return { corrected: '', issues: [], source: 'none' }
  try {
    const { hasAI } = await import('./settings.js')
    if (hasAI()) return await correctWithAI(text)
  } catch (err) {
    console.error('[spell] IA falló, offline:', err.message)
  }
  try {
    return await correctOffline(text)
  } catch (err) {
    console.error('[spell] offline falló:', err.message)
    return { corrected: text, issues: [], source: 'none' }
  }
}