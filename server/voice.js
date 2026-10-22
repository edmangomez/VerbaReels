// voice.js — voces neuronales gratis vía Microsoft Edge Read Aloud (msedge-tts).
// Sin API keys, sin instalación de apps. Catálogo español + síntesis a MP3.
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

// voces españolas curadas (se muestran con nombre amigable en la UI)
const SPANISH_VOICES = [
  { id: 'es-ES-ElviraNeural', name: 'Elvira', gender: '♀', locale: 'es-ES' },
  { id: 'es-ES-AlvaroNeural', name: 'Álvaro', gender: '♂', locale: 'es-ES' },
  { id: 'es-ES-ArnauNeural', name: 'Arnau', gender: '♂', locale: 'es-ES' },
  { id: 'es-MX-DaliaNeural', name: 'Dalia', gender: '♀', locale: 'es-MX' },
  { id: 'es-MX-JorgeNeural', name: 'Jorge', gender: '♂', locale: 'es-MX' },
  { id: 'es-MX-CecilioNeural', name: 'Cecilio', gender: '♂', locale: 'es-MX' },
  { id: 'es-AR-ElenaNeural', name: 'Elena', gender: '♀', locale: 'es-AR' },
  { id: 'es-AR-TomasNeural', name: 'Tomás', gender: '♂', locale: 'es-AR' },
  { id: 'es-CO-SalomeNeural', name: 'Salomé', gender: '♀', locale: 'es-CO' },
  { id: 'es-CO-GonzaloNeural', name: 'Gonzalo', gender: '♂', locale: 'es-CO' },
  { id: 'es-CL-CatalinaNeural', name: 'Catalina', gender: '♀', locale: 'es-CL' },
  { id: 'es-CL-LorenzoNeural', name: 'Lorenzo', gender: '♂', locale: 'es-CL' },
  { id: 'es-US-PalomaNeural', name: 'Paloma', gender: '♀', locale: 'es-US' },
  { id: 'es-PE-CamilaNeural', name: 'Camila', gender: '♀', locale: 'es-PE' },
  { id: 'es-PE-MiguelNeural', name: 'Miguel', gender: '♂', locale: 'es-PE' },
]

export function getVoices() {
  return SPANISH_VOICES
}

// escape de XML para el SSML (requisito de la librería)
function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Sintetiza texto a MP3 con la voz indicada + timestamps de cada palabra.
 * @returns {{file, duration, voiceId, words?: [{word, offset, duration}]}
 */
export async function synthesize({ text, voiceId }) {
  const voice = SPANISH_VOICES.find((v) => v.id === voiceId) || SPANISH_VOICES[0]

  const tts = new MsEdgeTTS()
  await tts.setMetadata(voice.id, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, {
    wordBoundaryEnabled: true,
    sentenceBoundaryEnabled: false,
  })

  const dir = await mkdtemp(path.join(tmpdir(), 'voice-'))
  const file = path.join(dir, 'narration.mp3')

  const chunks = []
  const words = []
  const { audioStream, metadataStream } = tts.toStream(escapeXml(text.slice(0, 2000)))

  // recolectar audio
  const audioPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Edge TTS: timeout de síntesis (60s)')), 60000)
    audioStream.on('data', (d) => chunks.push(Buffer.from(d)))
    audioStream.on('close', () => { clearTimeout(timer); resolve() })
    audioStream.on('error', (err) => { clearTimeout(timer); reject(err) })
  })

  // recolectar word boundaries del metadataStream
  const metaPromise = new Promise((resolve) => {
    if (!metadataStream) return resolve()
    metadataStream.on('data', (msg) => {
      try {
        const json = typeof msg === 'string' ? JSON.parse(msg) : (msg?.toString?.() ? JSON.parse(msg.toString()) : null)
        if (!json?.Metadata) return
        for (const m of json.Metadata) {
          if (m.Type === 'WordBoundary' && m.Data?.text?.Text) {
            // Offset y Duration en unidades de 100-nanosegundos → convertir a segundos
            words.push({
              word: m.Data.text.Text,
              offset: m.Data.Offset / 1e7,
              duration: m.Data.Duration / 1e7,
            })
          }
        }
      } catch { /* metadata puede ser binario o JSON parcial */ }
    })
    metadataStream.on('close', () => resolve())
    metadataStream.on('error', () => resolve())
  })

  await Promise.all([audioPromise, metaPromise])

  if (chunks.length === 0) throw new Error('Edge TTS: no se recibió audio')

  const buf = Buffer.concat(chunks)
  await writeFile(file, buf)

  const duration = await probeAudioDuration(file)
  return { file, duration, voiceId: voice.id, bytes: buf.length, words: words.length > 0 ? words : undefined }
}

/**
 * Duración real del archivo de audio con ffprobe.
 */
export async function probeAudioDuration(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', file], { encoding: 'utf8' })
  if (r.status !== 0) return null
  try {
    const d = JSON.parse(r.stdout)
    const dur = Number(d.format?.duration)
    return Number.isFinite(dur) ? dur : null
  } catch {
    return null
  }
}
