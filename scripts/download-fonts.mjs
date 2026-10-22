// Descarga las 8 fuentes Google (licencia OFL) a server/assets/fonts
// y genera fonts.json con los nombres de archivo exactos para ffmpeg/ASS.
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const FONTS = [
  { id: 'montserrat', family: 'Montserrat', css: "'Montserrat', sans-serif", weight: 900 },
  { id: 'playfair', family: 'Playfair Display', css: "'Playfair Display', serif", weight: 700 },
  { id: 'bebas', family: 'Bebas Neue', css: "'Bebas Neue', sans-serif", weight: 400 },
  { id: 'pacifico', family: 'Pacifico', css: "'Pacifico', cursive", weight: 400 },
  { id: 'anton', family: 'Anton', css: "'Anton', sans-serif", weight: 400 },
  { id: 'lobster', family: 'Lobster', css: "'Lobster', cursive", weight: 400 },
  { id: 'greatvibes', family: 'Great Vibes', css: "'Great Vibes', cursive", weight: 400 },
  { id: 'oswald', family: 'Oswald', css: "'Oswald', sans-serif", weight: 600 },
]

// endpoints directos de github (repo google/fonts, rama main) — estables
const URLS = {
  montserrat: 'https://github.com/google/fonts/raw/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf',
  playfair: 'https://github.com/google/fonts/raw/main/ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf',
  bebas: 'https://github.com/google/fonts/raw/main/ofl/bebasneue/BebasNeue-Regular.ttf',
  pacifico: 'https://github.com/google/fonts/raw/main/ofl/pacifico/Pacifico-Regular.ttf',
  anton: 'https://github.com/google/fonts/raw/main/ofl/anton/Anton-Regular.ttf',
  lobster: 'https://github.com/google/fonts/raw/main/ofl/lobster/Lobster-Regular.ttf',
  greatvibes: 'https://github.com/google/fonts/raw/main/ofl/greatvibes/GreatVibes-Regular.ttf',
  oswald: 'https://github.com/google/fonts/raw/main/ofl/oswald/Oswald%5Bwght%5D.ttf',
}

const dir = path.resolve('server', 'assets', 'fonts')
await mkdir(dir, { recursive: true })

const manifest = []
for (const f of FONTS) {
  const file = `${f.id}.ttf`
  const dest = path.join(dir, file)
  if (!existsSync(dest)) {
    const url = URLS[f.id]
    process.stdout.write(`descargando ${f.family}... `)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status} para ${url}`)
    const buf = Buffer.from(await res.arrayBuffer())
    await writeFile(dest, buf)
    console.log(`ok (${(buf.length / 1024).toFixed(0)} KB)`)
  } else {
    console.log(`${f.family} ya existe`)
  }
  manifest.push({ id: f.id, family: f.family, css: f.css, weight: f.weight, file })
}

await writeFile(path.join(dir, 'fonts.json'), JSON.stringify(manifest, null, 2))
console.log(`\nfonts.json generado con ${manifest.length} fuentes`)
