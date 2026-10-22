// ai.js — cliente genérico OpenAI-compatible. Sirve para OpenRouter, OpenAI,
// Groq, Together, o cualquier endpoint /chat/completions.
import { loadSettings, hasAI } from './settings.js'

const TIMEOUT_MS = 45000

export async function chat(messages, { temperature = 0.7, overrideSettings } = {}) {
  const current = loadSettings()
  const s = {
    aiBaseUrl: (overrideSettings?.baseUrl || current.aiBaseUrl || '').trim(),
    aiApiKey: (overrideSettings?.apiKey || current.aiApiKey || '').trim(),
    aiModel: (overrideSettings?.model || current.aiModel || '').trim(),
  }
  if (!s.aiBaseUrl || !s.aiApiKey || !s.aiModel) throw new Error('IA no configurada (falta Base URL, API Key o Modelo)')
  const url = `${s.aiBaseUrl.replace(/\/+$/, '')}/chat/completions`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${s.aiApiKey}`,
  }
  const isOR = url.includes('openrouter.ai')
  if (isOR) {
    headers['HTTP-Referer'] = 'http://localhost:5173'
    headers['X-Title'] = 'Reels Studio'
  }
  try {
    const payload = {
      model: s.aiModel,
      messages,
      temperature,
      max_tokens: 2048,
    }
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      let msg = body.slice(0, 300)
      try {
        const parsed = JSON.parse(body)
        if (parsed.error?.message) msg = parsed.error.message
      } catch {}
      throw new Error(`IA HTTP ${res.status}: ${msg}`)
    }
    const data = await res.json()
    const choice = data?.choices?.[0]
    let content = (choice?.message?.content || '').trim()
    if (!content && choice?.message?.reasoning) {
      content = (choice.message.reasoning || '').trim()
    }
    if (!content) throw new Error('IA: respuesta sin contenido')
    return content
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('IA: timeout de conexión')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

// Extrae el primer objeto JSON del texto (tolera markdown fences, texto explicativo y comas sobrantes)
export function extractJSON(text) {
  if (!text || typeof text !== 'string') throw new Error('IA: respuesta vacía')

  // Quitar bloques markdown ```json ... ``` o ``` ... ```
  const cleaned = text.replace(/```(?:json)?\s*([\s\S]*?)```/gi, '$1').trim()

  // 1. Intentar parsear directamente
  try {
    return JSON.parse(cleaned)
  } catch {}

  // 2. Buscar el bloque { ... } más amplio
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start !== -1 && end > start) {
    const candidate = cleaned.slice(start, end + 1)
    try {
      return JSON.parse(candidate)
    } catch {
      // 3. Limpiar trailing commas (ej: {"query": "algo",})
      try {
        const withoutTrailingCommas = candidate.replace(/,\s*([}\]])/g, '$1')
        return JSON.parse(withoutTrailingCommas)
      } catch {}
    }
  }

  // 4. Extracción heurística por regex si el JSON no cerró o vino con texto libre
  const queryMatch = text.match(/"query"\s*:\s*"([^"]+)"/i)
  const descMatch = text.match(/"description"\s*:\s*"([^"]+)"/i)
  if (queryMatch || descMatch) {
    const fallbackObj = {}
    if (queryMatch) fallbackObj.query = queryMatch[1]
    const moodMatch = text.match(/"mood"\s*:\s*"([^"]+)"/i)
    if (moodMatch) fallbackObj.mood = moodMatch[1]
    if (descMatch) fallbackObj.description = descMatch[1]
    const tagsMatches = [...text.matchAll(/#[\p{L}\p{N}_]+/gu)].map((m) => m[0])
    if (tagsMatches.length > 0) fallbackObj.hashtags = tagsMatches.slice(0, 5)
    return fallbackObj
  }

  throw new Error('IA: no devolvió JSON válido')
}

export async function testConnection(customSettings = {}) {
  const current = loadSettings()
  const effective = {
    baseUrl: (customSettings.baseUrl || current.aiBaseUrl || '').trim(),
    apiKey: (customSettings.apiKey || current.aiApiKey || '').trim(),
    model: (customSettings.model || current.aiModel || '').trim(),
  }
  if (!effective.baseUrl || !effective.apiKey || !effective.model) {
    return { ok: false, message: 'IA no configurada (completa Base URL, API Key y Modelo)' }
  }
  const reply = await chat(
    [
      { role: 'user', content: 'Responde únicamente la palabra "pong".' },
    ],
    { temperature: 0, overrideSettings: effective },
  )
  return { ok: true, message: `Conexión exitosa con ${effective.model}: "${reply.slice(0, 50)}"` }
}
