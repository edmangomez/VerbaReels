// describe.js — heurística local: categoriza la frase y genera descripción
// con emojis + exactamente 5 hashtags. Funciona sin ninguna API de IA.
const CATEGORIES = [
  {
    id: 'motivacion',
    words: ['puedes', 'poder', 'fuerza', 'sueño', 'sueños', 'meta', 'metas', 'éxito', 'exito', 'trabajar', 'esfuerzo', 'nunca te rindas', 'lucha', 'ganar', 'lograr', 'empezar', 'cambiar', 'futuro', 'hoy', 'mañana', 'amanecer', 'camino', 'adelante', 'constancia', 'disciplina'],
    query: 'sunrise mountains golden hour',
    emojis: ['🔥', '💪', '✨', '🚀', '🌅'],
    templates: [
      'Cada día es una nueva oportunidad para brillar ✨ Recuerda: {phrase} 💪',
      'Nada detiene a quien se lo propone 🔥 {phrase} 🚀',
      'Guarda esta frase para los días difíciles 💪 {phrase} ✨',
    ],
    hashtags: ['#motivacion', '#frasesmotivacionales', '#exito', '#mentalidad', '#inspiracion'],
  },
  {
    id: 'amor',
    words: ['amor', 'amar', 'corazón', 'corazon', 'te amo', 'beso', 'besos', 'abrazo', 'caricia', 'enamorad', 'pareja', 'novio', 'novia', 'querer', 'querido', 'querida', 'te quiero', 'alma', 'romance'],
    query: 'sunset ocean romantic couple sky',
    emojis: ['❤️', '💕', '🥰', '🌹', '💖'],
    templates: [
      'El amor se demuestra, no se declara ❤️ {phrase} 💕',
      'Cuando el amor es real, no hace falta explicarlo 🥰 {phrase} ❤️',
      'Para esa persona especial 💕 {phrase} 🌹',
    ],
    hashtags: ['#amor', '#frasesdeamor', '#romanticismo', '#parejas', '#enamorado'],
  },
  {
    id: 'tristeza',
    words: ['triste', 'tristeza', 'llorar', 'lágrima', 'lagrima', 'dolor', 'duele', 'perder', 'perdí', 'perdi', 'adiós', 'adios', 'soledad', 'solo', 'sola', 'nostalgia', 'recuerdo', 'olvidar', 'romper', 'despedida'],
    query: 'rain window melancholic moody',
    emojis: ['💔', '😢', '🌧️', '🥀', '😔'],
    templates: [
      'A veces el corazón necesita llorar 🌧️ {phrase} 💔',
      'Las heridas también enseñan 🥀 {phrase} 😢',
      'Para quien está pasando por un momento difícil 💔 {phrase} 🖤',
    ],
    hashtags: ['#tristeza', '#frases', '#corazon', '#sentimientos', '#desamor'],
  },
  {
    id: 'reflexion',
    words: ['vida', 'vivir', 'tiempo', 'mundo', 'personas', 'verdad', 'piensas', 'reflexion', 'aprender', 'lección', 'leccion', 'mente', 'pensar', 'silencio', 'sabiduría', 'sabiduria', 'realidad', 'destino'],
    query: 'starry night sky mountains milky way',
    emojis: ['🌙', '✨', '🌌', '💭', '🍃'],
    templates: [
      'Una reflexión para hoy 🌙 {phrase} ✨',
      'A veces una frase lo cambia todo 💭 {phrase} 🌌',
      'Piénsalo un momento… 🍃 {phrase} 🌙',
    ],
    hashtags: ['#reflexion', '#frasesdevida', '#pensar', '#sabiduria', '#frasesprofundas'],
  },
  {
    id: 'felicidad',
    words: ['feliz', 'felicidad', 'alegría', 'alegria', 'reír', 'reir', 'risa', 'sonreír', 'sonreir', 'sonrisa', 'disfrutar', 'bailar', 'fiesta', 'vacaciones', 'verano', 'playa', 'libertad'],
    query: 'beach waves happy sunny day',
    emojis: ['😊', '🌞', '🎉', '😍', '🌈'],
    templates: [
      'La felicidad está en lo simple 😊 {phrase} 🌞',
      'Sonríe, la vida es ahora 🌈 {phrase} 🎉',
      'Buenas vibras solamente ✨ {phrase} 😍',
    ],
    hashtags: ['#felicidad', '#buenasvibas', '#alegria', '#frases', '#smile'],
  },
]

const GENERIC = {
  query: 'beautiful landscape nature 4k',
  emojis: ['✨', '🌍', '🌿', '💫', '🎬'],
  templates: [
    '{phrase} ✨ ¿Qué te parece esta frase? 👇',
    'Guarda este reel para no olvidarla 💫 {phrase} 🌿',
    '{phrase} 🌍 Cuéntame en comentarios qué piensas 💬',
  ],
  hashtags: ['#frases', '#reels', '#viral', '#reflexion', '#instafrases'],
}

function detect(phrase) {
  const lower = phrase.toLowerCase()
  let best = null
  let bestScore = 0
  for (const cat of CATEGORIES) {
    let score = 0
    for (const w of cat.words) {
      if (lower.includes(w)) score++
    }
    if (score > bestScore) {
      bestScore = score
      best = cat
    }
  }
  return best || GENERIC
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function heuristicQuery(phrase) {
  return detect(phrase).query
}

export function heuristicDescription(phrase) {
  const cat = detect(phrase)
  const template = pick(cat.templates)
  const description = template.replace('{phrase}', `“${phrase.trim()}”`)
  const hashtags = cat.hashtags.slice(0, 5)
  return { description, hashtags }
}

/**
 * Adapta la descripción base al formato de cada red social.
 * - instagram: tal cual (con hashtags al final)
 * - facebook: más texto conversacional, hashtags al final
 * - shorts: título corto + descripción breve
 */
export function formatForNetwork(baseDescription, hashtags, network) {
  const tags = (hashtags || []).join(' ')
  switch (network) {
    case 'facebook':
      return {
        description: `${baseDescription}\n\n¿Te resuena esta frase? 💬 Cuéntame qué piensas en los comentarios y compártela con quien la necesite hoy.`,
        hashtags,
      }
    case 'shorts':
      return {
        description: `${baseDescription.split(/[.!?]/)[0].trim()} 🔥`,
        hashtags: tags ? [hashtags[0], hashtags[1], hashtags[2], '#shorts', '#frasescortas'].filter(Boolean).slice(0, 5) : ['#shorts', '#frases', '#viral', '#reflexion', '#motivacion'],
      }
    case 'instagram':
    default:
      return { description: baseDescription, hashtags }
  }
}
