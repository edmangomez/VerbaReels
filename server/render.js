// render.js v3 — pipeline ffmpeg: fondo vertical + subtítulos ASS animados
// + pista de voz opcional (Voicebox/Edge TTS) sincronizada al timeline de palabras.
// + thumbnail automático del frame 1s del reel generado.
import { spawn } from 'node:child_process'
import { mkdtemp, writeFile, stat, unlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'
import { buildASS } from './subtitle.js'
import { VIDEO, normalizeStyle } from './lib/timing.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RENDERS_DIR = path.join(__dirname, 'renders')
mkdirSync(RENDERS_DIR, { recursive: true })

const FONT_DIR = path.join(__dirname, 'assets', 'fonts')

/**
 * Renderiza el reel.
 * voiceAudioFile: ruta local a un WAV/MP3 narrado (opcional). Si se pasa,
 * la duración del video se extiende a la del audio y se mezcla en el MP4.
 * wordTimes: [{word, offset, duration}] timestamps de TTS para sincronizar texto.
 * onProgress: callback opcional (step: string) para reportar progreso.
 * @returns {{ file, thumbFile, sizeMB, duration }}
 */
export async function renderReel({ videoUrl, phrase, fontId, textColor, duration = VIDEO.duration, style, voiceAudioFile, wordTimes, onProgress, onPercent }) {
  const jobDir = await mkdtemp(path.join(tmpdir(), 'reel-'))
  const st = normalizeStyle(style)

  let finalDuration = duration
  if (voiceAudioFile) {
    const { probeAudioDuration } = await import('./voicebox.js')
    const d = await probeAudioDuration(voiceAudioFile)
    if (d) {
      const { durationWithVoice } = await import('./lib/timing.js')
      finalDuration = durationWithVoice(d, duration)
    }
  }

  const assFile = path.join(jobDir, 'subs.ass')
  const outFile = path.join(RENDERS_DIR, `reel-${Date.now()}.mp4`)

  const ass = buildASS({ phrase, duration: finalDuration, fontId, textColor, style: st, wordTimes })
  await writeFile(assFile, ass, 'utf8')

  // Filtro base de video
  const vfParts = [
    `scale=${VIDEO.width}:${VIDEO.height}:force_original_aspect_ratio=increase`,
    `crop=${VIDEO.width}:${VIDEO.height}`,
    `fps=${VIDEO.fps}`,
  ]

  // Ken Burns: zoom lento con zoompan
  if (st.kenBurns) {
    vfParts.splice(2, 0,
      `zoompan=z='min(zoom+0.0012,1.4)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${VIDEO.width}x${VIDEO.height}:fps=${VIDEO.fps}`
    )
  }

  // Capa de oscurecimiento (mejora legibilidad); idéntica al overlay CSS del preview
  if (st.overlay > 0) {
    vfParts.push(`drawbox=x=0:y=0:w=iw:h=ih:color=black@${(st.overlay / 100).toFixed(2)}:t=fill`)
  }

  vfParts.push(`subtitles=${assArg(assFile)}:fontsdir=${assArg(FONT_DIR)}`)
  const vfFilter = vfParts.join(',')
  const isImage = /\.(jpg|jpeg|png|webp)($|\?)/i.test(videoUrl) || /photos\//i.test(videoUrl)
  const args = [
    '-y',
    '-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    ...(isImage ? ['-loop', '1'] : ['-stream_loop', '-1']),
    '-i', videoUrl,
  ]

  onProgress?.('Renderizando video…')

  if (voiceAudioFile) {
    args.push('-i', voiceAudioFile)
    args.push(
      '-vf', vfFilter,
      '-af', 'apad=whole_dur=' + String(finalDuration),
      '-t', String(finalDuration),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k',
      '-movflags', '+faststart',
      outFile,
    )
  } else {
    args.push(
      '-vf', vfFilter,
      '-t', String(finalDuration),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-an',
      outFile,
    )
  }

  await run(args, onPercent
    ? (t) => onPercent(Math.max(0, Math.min(99, Math.round((t / finalDuration) * 100))))
    : undefined)
  onPercent?.(100)

  // Limpiar archivos de voz temporales
  if (voiceAudioFile) {
    try {
      await unlink(voiceAudioFile)
      // Intentar borrar el directorio temporal de voz
      const voiceDir = path.dirname(voiceAudioFile)
      if (voiceDir.includes('voice-')) await rm(voiceDir, { recursive: true, force: true })
    } catch { /* no crítico */ }
  }

  const info = await stat(outFile)
  if (info.size < 10000) throw new Error('El render produjo un archivo demasiado pequeño')

  // Extraer thumbnail en un instante donde el texto ya esté visible tras el fade-in
  onProgress?.('Generando miniatura…')
  const thumbTime = Math.min(Math.max(0.5, finalDuration * 0.5), Math.max(0.8, (Number(st.textStart) || 0) + 0.8))
  const thumbFile = await extractThumbnail(outFile, thumbTime)

  return {
    file: outFile,
    thumbFile,
    sizeMB: Math.round((info.size / 1024 / 1024) * 10) / 10,
    duration: finalDuration,
  }
}

/**
 * Extrae un frame JPEG nítido del video como thumbnail.
 * @returns {string|null} ruta al archivo .jpg o null si falla
 */
async function extractThumbnail(videoFile, sec = 1) {
  const thumbFile = videoFile.replace('.mp4', '-thumb.jpg')
  const args = [
    '-y', '-ss', String(sec.toFixed(2)), '-i', videoFile,
    '-frames:v', '1', '-update', '1', '-q:v', '2',
    '-vf', `scale=540:960:force_original_aspect_ratio=increase,crop=540:960`,
    thumbFile,
  ]
  try {
    await run(args)
    return thumbFile
  } catch {
    return null
  }
}

function assArg(p) {
  const a = p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'")
  return `'${a}'`
}

function run(args, onTime) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { windowsHide: true })
    let stderr = ''
    proc.stderr.on('data', (d) => {
      const chunk = String(d)
      stderr += chunk
      if (stderr.length > 10000) stderr = stderr.slice(-5000)
      if (onTime) {
        // ffmpeg imprime "time=00:00:05.20" o "time= 00:00:05.20" mientras procesa
        const all = [...chunk.matchAll(/time=\s*(\d+):(\d+):(\d+(?:\.\d+)?)/g)]
        const m = all[all.length - 1]
        if (m) onTime(Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]))
      }
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
