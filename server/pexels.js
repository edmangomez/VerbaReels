// pexels.js — búsqueda de VIDEOS de paisajes verticales + FOTOS para imágenes.
import { loadSettings, hasPexels } from './settings.js'

const VIDEOS_API = 'https://api.pexels.com/videos/search'
const PHOTOS_API = 'https://api.pexels.com/v1/search'

async function headers() {
  const s = loadSettings()
  if (!hasPexels(s)) throw new Error('Pexels API key no configurada')
  return { Authorization: s.pexelsApiKey }
}

export async function searchVideos(query, perPage = 12) {
  const url = new URL(VIDEOS_API)
  url.searchParams.set('query', query)
  url.searchParams.set('orientation', 'portrait')
  url.searchParams.set('per_page', String(perPage))
  url.searchParams.set('size', 'medium')

  const res = await fetch(url, {
    headers: await headers(),
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`Pexels HTTP ${res.status}`)
  const data = await res.json()

  return (data.videos || [])
    .map(normalizeVideo)
    .filter((v) => v.videoUrl && v.previewUrl)
}

// fotos verticales/originales de alta resolución para las imágenes estáticas
export async function searchPhotos(query, perPage = 12) {
  const url = new URL(PHOTOS_API)
  url.searchParams.set('query', query)
  url.searchParams.set('per_page', String(perPage))
  url.searchParams.set('size', 'large')

  const res = await fetch(url, {
    headers: await headers(),
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`Pexels HTTP ${res.status}`)
  const data = await res.json()

  return (data.photos || [])
    .map((p) => ({
      id: p.id,
      photoUrl: p.src?.large2x || p.src?.large || p.src?.original,
      thumbUrl: p.src?.medium || p.src?.small,
      author: p.photographer || 'Pexels',
      authorUrl: p.photographer_url || 'https://www.pexels.com',
      alt: p.alt || 'foto',
    }))
    .filter((p) => p.photoUrl)
}

function normalizeVideo(video) {
  const files = video.video_files || []
  const hd =
    pickFile(files, 1080) ||
    pickFile(files, 720) ||
    files.find((f) => f.width >= f.height) ||
    files[0]
  const sd = pickFile(files, 640) || pickFile(files, 720) || hd

  return {
    id: video.id,
    videoUrl: hd?.link,
    previewUrl: sd?.link,
    image: video.image || video.video_pictures?.[0]?.picture || '',
    thumbUrl: video.image || video.video_pictures?.[0]?.picture || '',
    author: video.user?.name || 'Pexels',
    authorUrl: video.user?.url || 'https://www.pexels.com',
    alt: (video.url || '').split('/').pop() || 'video',
    duration: video.duration,
  }
}

function pickFile(files, targetWidth) {
  const vertical = files.filter((f) => f.width && f.height && f.width <= f.height)
  return vertical
    .filter((f) => f.width <= targetWidth)
    .sort((a, b) => b.width - a.width)[0]
}
