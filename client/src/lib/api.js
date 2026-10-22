const BASE = '/api'

async function request(path, options = {}, timeoutMs = 30000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${BASE}${path}`, { ...options, signal: controller.signal })
    if (!res.ok) {
      let message = `Error HTTP ${res.status}`
      try {
        const data = await res.json()
        if (data && data.error) message = data.error
      } catch { /* respuesta sin JSON */ }
      throw new Error(message)
    }
    return await res.json()
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('La solicitud tardó demasiado (timeout)')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export function getFonts() {
  return request('/fonts')
}

export function getSettings() {
  return request('/settings')
}

export function saveSettings(payload) {
  return request('/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function testAI(payload) {
  return request(
    '/ai/test',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    },
    60000,
  )
}

export function suggestBackgrounds(phrase, query) {
  return request('/backgrounds/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phrase, query }),
  }, 60000)
}

export function generateDescription(phrase, network = 'instagram') {
  return request('/description/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phrase, network }),
  }, 60000)
}

export function checkPhrase(phrase) {
  return request('/phrase/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phrase }),
  }, 60000)
}

export function suggestPhotos(phrase, query) {
  return request('/photos/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phrase, query }),
  }, 60000)
}

export function generateImages(payload) {
  return request('/images/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, 300000)
}

export function getVoiceStatus() {
  return request('/voice/status')
}

export function previewVoice(text, profileId) {
  return request('/voice/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, profileId }),
  }, 120000)
}

export function getVoices() {
  return request('/voice/voices')
}

export async function previewVoiceAudio(text, voiceId) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 120000)
  try {
    const res = await fetch(`${BASE}/voice/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceId }),
      signal: controller.signal,
    })
    if (!res.ok) {
      let message = `Error HTTP ${res.status}`
      try {
        const data = await res.json()
        if (data && data.error) message = data.error
      } catch { /* respuesta sin JSON */ }
      throw new Error(message)
    }
    return await res.blob()
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('La solicitud tardó demasiado (timeout)')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export function getLibrary() {
  return request('/library')
}

export function deleteLibraryItem(type, id) {
  return request(`/library/${type}/${id}`, { method: 'DELETE' })
}

export function exportPost(payload) {
  return request('/post/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, 300000)
}

// Inicia un render en background, devuelve { jobId }
export function startRender(payload) {
  return request('/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, 30000)
}

// Consulta el estado de un job de render
export function getRenderStatus(jobId) {
  return request(`/render/status/${jobId}`, {}, 10000)
}

export function downloadVideo(url) {
  const a = document.createElement('a')
  a.href = url
  a.download = 'reel.mp4'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
