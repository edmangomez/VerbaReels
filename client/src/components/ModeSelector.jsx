const MODES = [
  {
    key: 'reel',
    icon: '🎬',
    title: 'Reel de video',
    sub: 'Video vertical 9:16 · texto animado · voz narrada',
  },
  {
    key: 'post',
    icon: '📷',
    title: 'Post de imagen',
    sub: 'Foto 1080×1356 para tu feed · frase fija',
  },
]

export default function ModeSelector({ mode, setMode }) {
  return (
    <section className="mode-selector">
      {MODES.map((m) => (
        <button
          key={m.key}
          type="button"
          className={`mode-card ${mode === m.key ? 'active' : ''}`}
          onClick={() => setMode(m.key)}
        >
          <span className="mode-card-icon">{m.icon}</span>
          <span className="mode-card-title">{m.title}</span>
          <span className="mode-card-sub">{m.sub}</span>
        </button>
      ))}
    </section>
  )
}
