// voicebox.js — integración con la API local de Voicebox (voicebox.sh).
// Requiere la app desktop corriendo (por defecto en 127.0.0.1:17493).
const VB_BASE = process.env.VOICEBOX_URL || 'http://127.0.0.1:17493'

/**
 * Detecta si Voicebox está corriendo y devuelve los perfiles de voz.
 * @returns {{ available: boolean, profiles: [], error?: string }}
 */
export async function getStatus() {
  try {
    const res = await fetch(`${VB_BASE}/profiles`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return { available: false, profiles: [], error: `HTTP ${res.status}` }
    const data = await res.json()
    // la API puede devolver array directo o {profiles: [...]}
    const list = Array.isArray(data) ? data : data.profiles || []
    const profiles = list.map((p) => ({
      id: p.id,
      name: p.name || p.profile_name || 'Perfil',
      engine: p.engine || p.voice_type || null,
      language: p.language || null,
    }))
    return { available: true, profiles }
  } catch {
    return { available: false, profiles: [], error: 'no responde' }
  }
}

/**
 * Genera narración de la frase con el perfil indicado.
 * POST /generate {profile_id, text, language}
 * @returns {{ audioUrl, duration, generationId }}
 */
export async function generateSpeech({ text, profileId, language = 'es' }) {
  const res = await fetch(`${VB_BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profile_id: profileId,
      text,
      language,
    }),
    signal: AbortSignal.timeout(120000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Voicebox HTTP ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = await res.json()

  // respuesta: {id, audio_path, duration, ...} — el audio se sirve en /audio/{id}
  const generationId = data.id
  const duration = Number(data.duration) || null
  if (!generationId) throw new Error('Voicebox no devolvió generation id')

  return {
    audioUrl: `${VB_BASE}/audio/${generationId}`,
    duration,
    generationId,
  }
}

/**
 * Descarga el WAV generado a un archivo local para mezclar con ffmpeg.
 */
export async function downloadAudio(audioUrl, destPath) {
  const res = await fetch(audioUrl, { signal: AbortSignal.timeout(60000) })
  if (!res.ok) throw new Error(`descarga de audio HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const { writeFile } = await import('node:fs/promises')
  await writeFile(destPath, buf)
  return { bytes: buf.length }
}

/**
 * Duración real del archivo de audio (por si la API no la reporta).
 */
export async function probeAudioDuration(file) {
  const { spawnSync } = await import('node:child_process')
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
