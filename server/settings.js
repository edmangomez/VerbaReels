// settings.js — persistencia de claves (server/settings.json), estilo opencode:
// el usuario configura base URL + API key + modelo de cualquier proveedor OpenAI-compatible.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SETTINGS_FILE = path.join(__dirname, 'settings.json')

const DEFAULTS = {
  aiBaseUrl: '',
  aiApiKey: '',
  aiModel: '',
  pexelsApiKey: '',
}

export function loadSettings() {
  let stored = {}
  if (existsSync(SETTINGS_FILE)) {
    try {
      stored = JSON.parse(readFileSync(SETTINGS_FILE, 'utf8'))
    } catch {
      stored = {}
    }
  }
  // .env puede proveer valores iniciales (solo si settings.json no los define)
  return {
    aiBaseUrl: stored.aiBaseUrl ?? process.env.AI_BASE_URL ?? '',
    aiApiKey: stored.aiApiKey ?? process.env.AI_API_KEY ?? '',
    aiModel: stored.aiModel ?? process.env.AI_MODEL ?? '',
    pexelsApiKey: stored.pexelsApiKey ?? process.env.PEXELS_API_KEY ?? '',
  }
}

export function saveSettings(patch) {
  const current = loadSettings()
  const next = { ...current }
  if (typeof patch.baseUrl === 'string') next.aiBaseUrl = patch.baseUrl.trim()
  if (typeof patch.model === 'string') next.aiModel = patch.model.trim()
  if (typeof patch.apiKey === 'string' && patch.apiKey.trim()) next.aiApiKey = patch.apiKey.trim()
  if (typeof patch.pexelsKey === 'string' && patch.pexelsKey.trim()) next.pexelsApiKey = patch.pexelsKey.trim()
  writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2))
  return next
}

export function hasAI(s = loadSettings()) {
  return Boolean(s.aiBaseUrl && s.aiApiKey && s.aiModel)
}

export function hasPexels(s = loadSettings()) {
  return Boolean(s.pexelsApiKey)
}

export function maskKey(key) {
  if (!key) return ''
  if (key.length <= 8) return '••••'
  return `${key.slice(0, 3)}••••${key.slice(-4)}`
}
