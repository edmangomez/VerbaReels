# 🎬 Reels Studio

Generador de reels de frases para Instagram con fondos de video inteligentes y texto animado palabra por palabra.

## Qué hace

1. **Escribes una frase** (hasta 200 caracteres)
2. **La IA elige el fondo perfecto** — analiza el sentimiento de tu frase y busca el paisaje ideal en Pexels (miles de videos verticales HD gratis)
3. **Eliges tipografía** entre 8 fuentes curadas + color del texto + duración (8/10/15s)
4. **Vista previa animada** — el texto aparece palabra por palabra con efecto fade+pop, idéntico al resultado final
5. **Renderiza el reel** — MP4 1080x1920 (9:16), 30fps, listo para Instagram
6. **Genera la descripción** con emojis + exactamente 5 hashtags, con botón de copiar

## Setup

**Requisitos:** Node 18+, FFmpeg en el PATH (`winget install ffmpeg` o descarga de [gyan.dev](https://www.gyan.dev/ffmpeg/builds/))

```bash
npm run setup    # instala dependencias + descarga las 8 fuentes Google
npm run dev      # levanta la API (3001) + la web (5173)
```

Abre http://localhost:5173

## Configuración (botón ⚙️ Settings en la app)

| Clave | Dónde conseguir | Obligatoria |
|---|---|---|
| **Pexels API Key** | [pexels.com/api](https://www.pexels.com/api/) — gratis, 1 minuto | ✅ Sí (para los fondos) |
| **IA: Base URL + API Key + Modelo** | Cualquier proveedor **OpenAI-compatible**: [OpenRouter](https://openrouter.ai) (ej. modelo `z-ai/glm-5.3-free`), OpenAI, Groq, Together… | ⭕ Opcional |

- **Con IA configurada**: los fondos los elige el LLM según el sentimiento de la frase y las descripciones son de mayor calidad
- **Sin IA**: todo funciona con el modo heurístico local (categoriza la frase por palabras clave: motivación, amor, tristeza, reflexión, felicidad)

Las claves se guardan en `server/settings.json` (nunca en el navegador).

## Estructura

```
reels/
├── server/               # API Node + Express
│   ├── index.js          # endpoints REST
│   ├── ai.js             # cliente OpenAI-compatible genérico
│   ├── pexels.js         # búsqueda de videos verticales
│   ├── subtitle.js       # subtítulos ASS animados (fade+pop)
│   ├── render.js         # pipeline ffmpeg → MP4 9:16
│   ├── describe.js       # heurística local de descripciones
│   ├── settings.js       # persistencia de claves
│   ├── lib/timing.js     # ⚖️ CONTRATO: mismos tiempos que el preview
│   └── assets/fonts/     # 8 fuentes TTF para ffmpeg
├── client/               # React + Vite
│   └── src/lib/timing.js # ⚖️ copia exacta del contrato
└── scripts/download-fonts.mjs
```

## Cómo funciona el render

El mismo módulo de *timing* (`lib/timing.js`) calcula los bloques de 2-3 palabras y sus tiempos **tanto en el navegador (preview) como en el servidor (render)**, así lo que ves es exactamente lo que descargas. El servidor genera un archivo de subtítulos ASS con animación `fad(300ms)` + pop de escala, lo quema sobre el video de fondo con ffmpeg/libass (con las fuentes TTF locales) y exporta H.264 1080x1920 con `+faststart`, sin audio — la música se agrega desde Instagram.

## Notas

- Los reels quedan en `server/renders/` y se sirven por HTTP
- El video de fondo se loopea automáticamente si es más corto que la duración elegida
- Créditos de autor de Pexels visibles al elegir cada fondo

## Roadmap

- [ ] Narración por voz (integración con [Voicebox](https://voicebox.sh) vía su API local `127.0.0.1:17493` — pipeline de render ya preparado para mezclar audio)
- [ ] Más estilos de animación de texto
- [ ] Efectos Ken Burns (zoom lento al fondo)
