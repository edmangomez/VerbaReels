// index.js — API del Generador de Reels v2.
import dns from 'node:dns'
dns.setDefaultResultOrder('ipv4first')

import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync, existsSync, unlinkSync } from 'node:fs'
import 'dotenv/config'

import { loadSettings, saveSettings, maskKey, hasAI, hasPexels } from './settings.js'
import { chat, extractJSON, testConnection } from './ai.js'
import { searchVideos, searchPhotos } from './pexels.js'
import { heuristicQuery, heuristicDescription, formatForNetwork } from './describe.js'
import { renderReel } from './render.js'
import { IMAGE_SIZES, renderImage } from './images.js'
import * as voicebox from './voicebox.js'
import * as edgeVoice from './voice.js'
import * as library from './library.js'
import { VIDEO, normalizeStyle, autoDuration } from './lib/timing.js'
import * as renderQueue from './renderQueue.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// safety net: ningún error async no capturado debe tumbar el servidor
process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err)
})
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err)
})

const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

const PORT = process.env.PORT || 3001

// ---------- helpers ----------
const FONTS = JSON.parse(readFileSync(path.join(__dirname, 'assets', 'fonts', 'fonts.json'), 'utf8'))
let OUTLINE_MAP = {}
try {
  OUTLINE_MAP = JSON.parse(readFileSync(path.join(__dirname, 'assets', 'fonts', 'fonts-outline.json'), 'utf8'))
} catch { /* sin mapa → multiplicador 1 */ }

function fontForClient() {
  return FONTS.map((f) => ({
    id: f.id,
    name: f.family,
    family: f.family,
    weight: f.weight || 400,
    outlineMult: OUTLINE_MAP[f.id] ?? 1.0,
  }))
}

async function aiOr(fn, fallback) {
  if (hasAI()) {
    try {
      return { ...(await fn()), source: 'ai' }
    } catch (err) {
      console.error('[ai] fallback a heurística:', err.message)
    }
  }
  return { ...fallback(), source: 'heuristic' }
}

// ---------- rutas base ----------

app.get('/api/fonts', (_req, res) => {
  res.json({ fonts: fontForClient(), sizes: IMAGE_SIZES })
})

app.get('/api/settings', (_req, res) => {
  const s = loadSettings()
  res.json({
    baseUrl: s.aiBaseUrl,
    model: s.aiModel,
    hasApiKey: Boolean(s.aiApiKey),
    apiKeyMasked: maskKey(s.aiApiKey),
    hasPexelsKey: hasPexels(s),
    pexelsKeyMasked: maskKey(s.pexelsApiKey),
  })
})

app.put('/api/settings', (req, res) => {
  const { baseUrl, model, apiKey, pexelsKey } = req.body || {}
  saveSettings({ baseUrl, model, apiKey, pexelsKey })
  res.json({ ok: true })
})

app.post('/api/ai/test', async (req, res) => {
  try {
    const { baseUrl, apiKey, model } = req.body || {}
    const r = await testConnection({ baseUrl, apiKey, model })
    res.json(r)
  } catch (err) {
    res.json({ ok: false, message: err.message })
  }
})

// ---------- fondos (videos) ----------

app.post('/api/backgrounds/suggest', async (req, res) => {
  const { phrase, query: manualQuery } = req.body || {}
  if (manualQuery && String(manualQuery).trim()) {
    try {
      const results = await searchVideos(String(manualQuery).trim().slice(0, 100), 12)
      return res.json({ source: 'manual', results: results.slice(0, 8) })
    } catch (err) {
      return res.status(500).json({ error: `No se pudieron buscar fondos: ${err.message}` })
    }
  }
  if (!phrase || !phrase.trim()) return res.status(400).json({ error: 'Frase vacía' })

  const fallback = () => searchVideos(heuristicQuery(phrase), 12)

  let source = 'heuristic'
  let results = []

  try {
    if (hasAI() && hasPexels()) {
      try {
        const raw = await chat([
          {
            role: 'system',
            content:
              'Eres un director de arte para reels de Instagram. Analizas frases en español y generas la búsqueda de video PERFECTA para el fondo. Responde SOLO JSON: {"query": "...", "mood": "..."}. La query debe estar en inglés, 2-5 palabras, descriptiva de paisajes/ambientes (ej: "misty forest sunrise", "ocean waves sunset", "starry night mountains"). Sin comillas extra.',
          },
          { role: 'user', content: phrase.slice(0, 400) },
        ])
        const { query } = extractJSON(raw)
        results = await searchVideos(String(query || 'nature landscape').slice(0, 100), 12)
        source = 'ai'
      } catch (err) {
        console.error('[backgrounds] IA falló, usando heurística:', err.message)
        results = await fallback()
      }
    } else {
      results = await fallback()
    }
  } catch (err) {
    return res.status(500).json({ error: `No se pudieron buscar fondos: ${err.message}` })
  }

  // guardar frase en la biblioteca SOLO al exportar (no aquí)
  const shuffled = results.sort(() => Math.random() - 0.5).slice(0, 6)
  res.json({ source, results: shuffled })
})

// ---------- fondos (fotos para imágenes estáticas) ----------

app.post('/api/photos/suggest', async (req, res) => {
  const { phrase, query: manualQuery } = req.body || {}
  if (manualQuery && String(manualQuery).trim()) {
    try {
      const results = await searchPhotos(String(manualQuery).trim().slice(0, 100), 12)
      return res.json({ source: 'manual', results: results.slice(0, 8) })
    } catch (err) {
      return res.status(500).json({ error: `No se pudieron buscar fotos: ${err.message}` })
    }
  }
  if (!phrase || !phrase.trim()) return res.status(400).json({ error: 'Frase vacía' })

  const fallback = () => searchPhotos(heuristicQuery(phrase), 12)

  let source = 'heuristic'
  let results = []

  try {
    if (hasAI() && hasPexels()) {
      try {
        const raw = await chat([
          {
            role: 'system',
            content:
              'Eres un director de arte. Para la frase dada genera la búsqueda de FOTO de fondo perfecta. Responde SOLO JSON: {"query": "..."}. Query en inglés, 2-5 palabras, paisajes/ambientes (ej: "golden hour mountain", "calm ocean horizon"). Sin comillas extra.',
          },
          { role: 'user', content: phrase.slice(0, 400) },
        ])
        const { query } = extractJSON(raw)
        results = await searchPhotos(String(query || 'nature landscape').slice(0, 100), 12)
        source = 'ai'
      } catch (err) {
        console.error('[photos] IA falló, usando heurística:', err.message)
        results = await fallback()
      }
    } else {
      results = await fallback()
    }
  } catch (err) {
    return res.status(500).json({ error: `No se pudieron buscar fotos: ${err.message}` })
  }

  const shuffled = results.sort(() => Math.random() - 0.5).slice(0, 6)
  res.json({ source, results: shuffled })
})

// ---------- corrección ortográfica ----------

app.post('/api/phrase/check', async (req, res) => {
  const { phrase } = req.body || {}
  if (!phrase || !phrase.trim()) return res.status(400).json({ error: 'Frase vacía' })
  try {
    const { checkSpelling } = await import('./spell.js')
    const result = await checkSpelling(phrase.trim())
    res.json(result)
  } catch (err) {
    console.error('[spell] error:', err)
    res.status(500).json({ error: `Error al revisar ortografía: ${err.message}` })
  }
})

// ---------- descripción (independiente del render, con plantillas por red) ----------

app.post('/api/description/generate', async (req, res) => {
  const { phrase, network = 'instagram' } = req.body || {}
  if (!phrase || !phrase.trim()) return res.status(400).json({ error: 'Frase vacía' })


  const base = await aiOr(
    async () => {
      const raw = await chat([
        {
          role: 'system',
          content:
            'Eres un community manager experto en Instagram. Para la frase dada, escribes una descripción corta de reel (1-2 líneas, español, con 1-3 emojis contextuales bien colocados) y EXACTAMENTE 5 hashtags en español relevantes para frases/reels (sin espacios, empezando con #, minúsculas). Responde SOLO JSON: {"description": "...", "hashtags": ["#...", "#...", "#...", "#...", "#..."]}. La descripción debe citar o parafrasear la frase. Sin markdown.',
        },
        { role: 'user', content: phrase.slice(0, 400) },
      ])
      const { description, hashtags } = extractJSON(raw)
      if (!description) throw new Error('IA no devolvió descripción')
      const tags = Array.isArray(hashtags) ? hashtags.filter((t) => typeof t === 'string' && t.startsWith('#')).slice(0, 5) : []
      if (tags.length !== 5) throw new Error('IA no devolvió 5 hashtags')
      return { description: String(description), hashtags: tags }
    },
    () => heuristicDescription(phrase),
  )

  const formatted = formatForNetwork(base.description, base.hashtags, network)
  res.json({
    source: base.source,
    network,
    description: formatted.description,
    hashtags: formatted.hashtags,
  })
})

// ---------- imágenes estáticas ----------

app.post('/api/images/generate', async (req, res) => {
  const { phrase, fontId, textColor, style, photoUrl, sizes } = req.body || {}
  if (!phrase?.trim()) return res.status(400).json({ error: 'Frase vacía' })
  if (!photoUrl) return res.status(400).json({ error: 'Foto de fondo no seleccionada' })

  const wanted = Array.isArray(sizes) && sizes.length > 0
    ? sizes.filter((s) => IMAGE_SIZES[s])
    : Object.keys(IMAGE_SIZES)

  const results = []
  const errors = []
  for (const sizeKey of wanted) {
    try {
      const out = await renderImage({ photoUrl, phrase, fontId, textColor, style, sizeKey })
      const saved = library.addImage({
        file: out.file,
        phrase,
        size: sizeKey,
        width: out.width,
        height: out.height,
        source: 'pexels',
      })
      results.push({
        sizeKey,
        url: `/renders/${path.basename(out.file)}`,
        width: out.width,
        height: out.height,
      })
    } catch (err) {
      console.error('[images] tamaño', sizeKey, 'falló:', err.message)
      errors.push({ sizeKey, error: err.message })
    }
  }

  if (results.length === 0) {
    return res.status(500).json({ error: `No se pudo generar ninguna imagen: ${errors[0]?.error || 'desconocido'}` })
  }
  res.json({ results, errors: errors.length ? errors : undefined })
})

// ---------- voces (Edge TTS gratis + Voicebox opcional) ----------

app.get('/api/voice/voices', (_req, res) => {
  res.json({
    engine: 'edge',
    voices: edgeVoice.getVoices(),
  })
})

app.post('/api/voice/preview', async (req, res) => {
  const { text, voiceId } = req.body || {}
  if (!text?.trim()) return res.status(400).json({ error: 'Texto vacío' })
  try {
    const speech = await edgeVoice.synthesize({ text, voiceId })
    // servir el MP3 directamente
    const { readFile } = await import('node:fs/promises')
    const buf = await readFile(speech.file)
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Content-Disposition', 'inline')
    res.send(buf)
  } catch (err) {
    res.status(502).json({ error: `Edge TTS: ${err.message}` })
  }
})

// Voicebox (si el usuario lo instala): detección + perfiles
app.get('/api/voice/status', async (_req, res) => {
  const status = await voicebox.getStatus()
  res.json({
    available: status.available,
    profiles: status.profiles,
    downloadUrl: 'https://voicebox.sh',
    error: status.error || null,
  })
})

// ---------- exportar POST (imagen PNG) ----------

app.post('/api/post/export', async (req, res) => {
  const { phrase, fontId, textColor, style, description, hashtags, source } = req.body || {}
  const photoUrl = req.body.photoUrl || req.body.videoUrl || req.body.bgUrl
  if (!phrase?.trim()) return res.status(400).json({ error: 'Frase vacía' })
  if (!photoUrl) return res.status(400).json({ error: 'Foto de fondo no seleccionada' })

  try {
    const out = await renderImage({
      photoUrl,
      phrase,
      fontId,
      textColor,
      style,
      sizeKey: 'portrait', // 1080x1356 — feed de Instagram
    })

    // descripción: la trae el cliente o se genera
    let desc = ''
    let tags = []
    let src = null
    if (typeof description === 'string' && description) {
      desc = description
      tags = Array.isArray(hashtags) ? hashtags : []
      src = source || 'client'
    } else {
      try {
        const d = await aiOr(
          async () => {
            const raw = await chat([
              {
                role: 'system',
                content:
                  'Eres un community manager experto en Instagram. Para la frase dada, escribes una descripción corta (1-2 líneas, español, 1-3 emojis) y EXACTAMENTE 5 hashtags. SOLO JSON: {"description": "...", "hashtags": ["#...","#...","#...","#...","#..."]}',
              },
              { role: 'user', content: phrase.slice(0, 400) },
            ])
            const { description: dd, hashtags: hh } = extractJSON(raw)
            return { description: dd, hashtags: hh }
          },
          () => heuristicDescription(phrase),
        )
        desc = d.description
        tags = d.hashtags
        src = d.source
      } catch { /* opcional */ }
    }

    // biblioteca: solo al exportar
    let url = null
    try {
      library.addPhrase({ text: phrase.trim() })
      library.addImage({
        file: out.file,
        phrase,
        size: 'portrait',
        width: 1080,
        height: 1356,
        source: 'post',
      })
      url = `/renders/${path.basename(out.file)}`
    } catch { /* no crítico */ }

    res.json({
      imageUrl: url || `/renders/${path.basename(out.file)}`,
      width: 1080,
      height: 1356,
      description: desc,
      hashtags: tags,
      source: src,
    })
  } catch (err) {
    console.error('[post] error:', err)
    res.status(500).json({ error: `Error al exportar el post: ${err.message}` })
  }
})

// ---------- biblioteca ----------

app.post('/api/render', async (req, res) => {
  const { phrase, fontId, textColor, duration, style, voiceId, description, hashtags, source } = req.body || {}
  const videoUrl = req.body.videoUrl || req.body.photoUrl || req.body.bgUrl
  if (!phrase?.trim()) return res.status(400).json({ error: 'Frase vacía' })
  if (!videoUrl) return res.status(400).json({ error: 'Fondo no seleccionado' })

  let dur
  if (duration === 'auto' || duration === null || duration === undefined) {
    dur = autoDuration(phrase)
  } else {
    const parsed = Number(duration)
    dur = Number.isFinite(parsed) && parsed > 0 ? Math.min(180, Math.max(1, Math.round(parsed * 10) / 10)) : VIDEO.duration
  }

  // Crear job y responder inmediatamente con el jobId
  const jobId = renderQueue.createJob()
  res.json({ jobId })

  // Ejecutar el render en background (sin await en el handler)
  ;(async () => {
    try {
      renderQueue.updateJob(jobId, { status: 'rendering', step: 'Iniciando render…' })

      // Voz opcional
      let voiceAudioFile = null
      let voiceInfo = null
      let wordTimes = null
      if (voiceId) {
        try {
          renderQueue.updateJob(jobId, { step: 'Sintetizando voz…' })
          if (voiceId.startsWith('es-')) {
            const speech = await edgeVoice.synthesize({ text: phrase, voiceId })
            voiceAudioFile = speech.file
            voiceInfo = { engine: 'edge', duration: speech.duration, voiceId, words: speech.words?.length || 0 }
            wordTimes = speech.words?.length > 0 ? speech.words : null
          } else {
            const speech = await voicebox.generateSpeech({ text: phrase, profileId: voiceId, language: 'es' })
            const fsp = await import('node:fs/promises')
            const os = await import('node:os')
            const vDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'voice-'))
            voiceAudioFile = path.join(vDir, 'narration.wav')
            await voicebox.downloadAudio(speech.audioUrl, voiceAudioFile)
            voiceInfo = { engine: 'voicebox', duration: speech.duration }
          }
        } catch (err) {
          console.error('[render] voz falló, continúa sin audio:', err.message)
        }
      }

      const out = await renderReel({
        videoUrl, phrase, fontId, textColor, duration: dur, style, voiceAudioFile, wordTimes,
        onProgress: (step) => renderQueue.updateJob(jobId, { step }),
        onPercent: (progress) => renderQueue.updateJob(jobId, { progress }),
      })

      // Descripción
      renderQueue.updateJob(jobId, { step: 'Generando descripción…' })
      let desc = ''
      let tags = []
      let src = null
      if (typeof description === 'string' && description) {
        desc = description
        tags = Array.isArray(hashtags) ? hashtags : []
        src = source || 'client'
      } else {
        try {
          const d = await aiOr(
            async () => {
              const raw = await chat([
                { role: 'system', content: 'Eres un community manager experto en Instagram. Para la frase dada, escribes una descripción corta (1-2 líneas, español, 1-3 emojis) y EXACTAMENTE 5 hashtags. SOLO JSON: {"description": "...", "hashtags": ["#...","#...","#...","#...","#..."]}' },
                { role: 'user', content: phrase.slice(0, 400) },
              ])
              const { description: dd, hashtags: hh } = extractJSON(raw)
              return { description: dd, hashtags: hh }
            },
            () => heuristicDescription(phrase),
          )
          desc = d.description
          tags = d.hashtags
          src = d.source
        } catch { /* opcional */ }
      }

      // Biblioteca
      let reelUrl = null
      let thumbUrl = null
      try {
        library.addPhrase({ text: phrase.trim() })
        library.addReel({
          file: out.file,
          thumbFile: out.thumbFile,
          phrase,
          fontId,
          textColor,
          duration: out.duration,
          style: normalizeStyle(style),
          backgroundAuthor: null,
          description: desc,
          hashtags: tags,
          source: src,
          sizeMB: out.sizeMB,
        })
        reelUrl = `/renders/${path.basename(out.file)}`
        thumbUrl = out.thumbFile ? `/renders/${path.basename(out.thumbFile)}` : null
      } catch { /* no crítico */ }

      renderQueue.updateJob(jobId, {
        status: 'done',
        step: '¡Listo!',
        result: {
          videoUrl: reelUrl || `/renders/${path.basename(out.file)}`,
          thumbUrl,
          description: desc,
          hashtags: tags,
          source: src,
          sizeMB: out.sizeMB,
          duration: out.duration,
          voice: voiceInfo,
        },
      })
    } catch (err) {
      console.error('[render] error:', err)
      renderQueue.updateJob(jobId, { status: 'error', step: 'Error', error: err.message })
    }
  })()
})

// Estado de un job de render (polling desde el cliente)
app.get('/api/render/status/:jobId', (req, res) => {
  const job = renderQueue.getJob(req.params.jobId)
  if (!job) return res.status(404).json({ error: 'Job no encontrado' })
  res.json({
    jobId: job.id,
    status: job.status,
    step: job.step,
    progress: job.progress ?? null,
    result: job.result || null,
    error: job.error || null,
  })
})


// ---------- biblioteca ----------

app.get('/api/library', (_req, res) => {
  res.json({
    reels: library.getReels(),
    phrases: library.getPhrases(),
    images: library.getImages(),
  })
})

app.delete('/api/library/reels/:id', (req, res) => {
  const { deletedFile } = library.deleteReel(req.params.id)
  if (deletedFile) {
    const f = path.join(__dirname, 'renders', deletedFile)
    if (existsSync(f)) { try { unlinkSync(f) } catch { /* no crítico */ } }
    // borrar thumbnail si existe
    const thumb = f.replace('.mp4', '-thumb.jpg')
    if (existsSync(thumb)) { try { unlinkSync(thumb) } catch { /* no crítico */ } }
  }
  res.json({ ok: true, reels: library.getReels() })
})

app.delete('/api/library/phrases/:id', (req, res) => {
  library.deletePhrase(req.params.id)
  res.json({ ok: true, phrases: library.getPhrases() })
})

app.delete('/api/library/images/:id', (req, res) => {
  const { deletedFile } = library.deleteImage(req.params.id)
  if (deletedFile) {
    const f = path.join(__dirname, 'renders', deletedFile)
    if (existsSync(f)) { try { unlinkSync(f) } catch { /* no crítico */ } }
  }
  res.json({ ok: true, images: library.getImages() })
})



// ---------- estáticos ----------

app.use('/renders', express.static(path.join(__dirname, 'renders')))

app.listen(PORT, () => {
  console.log(`🎥 Reels Studio API v2 en http://localhost:${PORT}`)
  console.log(`   Pexels: ${hasPexels() ? '✓' : '✗'} | IA: ${hasAI() ? '✓' : '✗ (heurística)'} | Tamaños imagen: ${Object.keys(IMAGE_SIZES).join(', ')}`)
})
