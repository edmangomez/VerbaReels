// renderQueue.js — cola de renders en memoria con seguimiento de progreso.
// Los jobs tienen TTL de 1 hora y se limpian automáticamente.

const jobs = new Map()
const JOB_TTL = 60 * 60 * 1000 // 1 hora

/**
 * Crea un nuevo job y devuelve su ID.
 * @returns {string} jobId
 */
export function createJob() {
  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  jobs.set(id, {
    id,
    status: 'queued',    // 'queued' | 'rendering' | 'done' | 'error'
    step: 'En cola…',
    result: null,
    error: null,
    createdAt: Date.now(),
  })
  return id
}

/**
 * Actualiza el estado de un job.
 * @param {string} id
 * @param {Partial<{status, step, result, error}>} updates
 */
export function updateJob(id, updates) {
  if (!jobs.has(id)) return
  jobs.set(id, { ...jobs.get(id), ...updates })
}

/**
 * Devuelve el estado actual de un job o null si no existe.
 * @param {string} id
 */
export function getJob(id) {
  return jobs.get(id) || null
}

// Limpieza automática de jobs antiguos cada 10 minutos
setInterval(() => {
  const now = Date.now()
  for (const [id, job] of jobs) {
    if (now - job.createdAt > JOB_TTL) jobs.delete(id)
  }
}, 10 * 60 * 1000)
