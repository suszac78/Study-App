import { Download, Eye, EyeOff, KeyRound, Monitor, Moon, Sparkles, Sun, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useAiStatus } from '../components/Layout'
import { Button, Card, PageHead, ask, toast } from '../components/ui'
import { getDownloads } from '../lib/runtime'
import { getDb, replaceDb, resetDb, updateSettings, useSettings } from '../lib/store'
import type { Db, Depth, ModelId, Settings as S } from '../lib/types'

const DEPTHS: { id: Depth; label: string; text: string }[] = [
  { id: 'quick', label: 'Quick', text: 'Fastest answers, lighter reasoning' },
  { id: 'balanced', label: 'Balanced', text: 'Best for most study tasks' },
  { id: 'deep', label: 'Deep', text: 'Most careful, takes longer' },
]

const MODELS: { id: ModelId; label: string }[] = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (best quality)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (faster, cheaper)' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (fastest, cheapest)' },
]

export default function Settings() {
  const settings = useSettings()
  const { provider, label } = useAiStatus()
  const [show, setShow] = useState(false)
  const [key, setKey] = useState(settings.apiKey)
  const fileRef = useRef<HTMLInputElement>(null)

  const exportData = async () => {
    const data = JSON.stringify({ app: 'StudyPilot', version: 1, exportedAt: new Date().toISOString(), db: getDb() }, null, 2)
    const filename = `studypilot-backup-${new Date().toISOString().slice(0, 10)}.json`
    const downloads = getDownloads()
    try {
      if (downloads) {
        await downloads.save({ filename, data })
      } else {
        const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    } catch {
      toast('Download was cancelled')
    }
  }

  const importData = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as { db?: Db }
      if (!parsed.db || !Array.isArray(parsed.db.exams)) throw new Error('bad')
      if (!(await ask('Replace all current data with this backup?'))) return
      replaceDb(parsed.db)
      toast('Backup restored')
    } catch {
      toast('That file is not a StudyPilot backup')
    }
  }

  return (
    <div className="page">
      <PageHead eyebrow="Settings" title="Settings" />

      <Card className="stack lg">
        <div className="row" style={{ gap: 10 }}>
          <div className="feature-icon"><Sparkles size={20} /></div>
          <div className="stack sm grow">
            <h3>AI connection</h3>
            <span className={`small ${provider === 'none' ? '' : 'muted'}`} style={{ color: provider === 'none' ? 'var(--warning)' : undefined }}>
              {label}
            </span>
          </div>
        </div>

        {provider === 'claude' ? (
          <div className="alert info">
            <span>
              You're using StudyPilot inside claude.ai, so the AI runs on your own Claude plan. No API key needed. The first time you use an AI
              feature, Claude asks you to allow it.
            </span>
          </div>
        ) : (
          <div className="alert warn">
            <span>
              <strong>No API key? No problem.</strong> Open StudyPilot from its claude.ai link and the built-in Claude works with your Claude
              account. An API key is only needed when you run StudyPilot somewhere else (for example on your own website).
            </span>
          </div>
        )}

        {provider === 'claude' && (
          <div className="stack sm small">
            <strong>Will heavy use cost extra?</strong>
            <p className="muted">
              No separate bill. Each AI action counts toward your Claude plan's usage limits, like sending a long message in a chat. If you reach
              the limit, StudyPilot tells you and you can continue when it resets. Only if you've turned on paid extra usage in your Claude
              billing settings could going past the limit cost more. <strong>Quick</strong> depth uses the least.
            </p>
          </div>
        )}

        <div className="field">
          <span className="label">Answer depth</span>
          <div className="grid grid-3" style={{ gap: 10 }}>
            {DEPTHS.map((d) => (
              <button
                key={d.id}
                className="card tight interactive flat"
                style={{ textAlign: 'left', borderColor: settings.depth === d.id ? 'var(--primary)' : undefined, background: settings.depth === d.id ? 'var(--primary-soft)' : undefined }}
                onClick={() => updateSettings({ depth: d.id })}
                aria-pressed={settings.depth === d.id}
              >
                <strong className="small">{d.label}</strong>
                <div className="subtle xs">{d.text}</div>
              </button>
            ))}
          </div>
        </div>

        <details open={!!settings.apiKey}>
          <summary className="small" style={{ cursor: 'pointer', fontWeight: 600 }}>
            <KeyRound size={14} style={{ verticalAlign: -2 }} /> Optional: use your own Anthropic API key
          </summary>
          <div className="stack" style={{ marginTop: 12 }}>
            <p className="subtle">
              Only used when the built-in Claude isn't available. Get a key at console.anthropic.com (paid, pay-as-you-go). The key is stored
              only in this browser and sent only to Anthropic.
            </p>
            <div className="field">
              <label htmlFor="api-key">API key</label>
              <div className="row nowrap">
                <input
                  id="api-key"
                  className="input"
                  type={show ? 'text' : 'password'}
                  placeholder="sk-ant-..."
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                <Button icon variant="ghost" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide key' : 'Show key'}>
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
            </div>
            <div className="field">
              <label htmlFor="model">Model</label>
              <select id="model" className="select" value={settings.model} onChange={(e) => updateSettings({ model: e.target.value as ModelId })}>
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="row">
              <Button
                variant="primary"
                onClick={() => {
                  updateSettings({ apiKey: key.trim() })
                  toast(key.trim() ? 'API key saved' : 'API key removed')
                }}
              >
                Save key
              </Button>
              {settings.apiKey && (
                <Button variant="ghost" onClick={() => { setKey(''); updateSettings({ apiKey: '' }); toast('API key removed') }}>
                  Remove key
                </Button>
              )}
            </div>
          </div>
        </details>
      </Card>

      <Card className="stack">
        <h3>Appearance</h3>
        <div className="chip-group">
          {([
            ['system', 'System', <Monitor size={14} key="m" />],
            ['light', 'Light', <Sun size={14} key="s" />],
            ['dark', 'Dark', <Moon size={14} key="d" />],
          ] as [S['theme'], string, React.ReactNode][]).map(([id, l, icon]) => (
            <button key={id} className="chip row" style={{ gap: 6 }} aria-pressed={settings.theme === id} onClick={() => updateSettings({ theme: id })}>
              {icon} {l}
            </button>
          ))}
        </div>
      </Card>

      <Card className="stack">
        <h3>Your data</h3>
        <p className="subtle">
          Everything is saved in this browser. Export a backup now and then, especially before clearing your browser or switching devices.
        </p>
        <div className="row">
          <Button variant="secondary" onClick={exportData}>
            <Download size={16} /> Export backup
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> Import backup
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importData(f); e.target.value = '' }} />
          <Button
            variant="danger"
            onClick={async () => {
              if (await ask('Delete ALL exams, notes, quizzes and progress? This cannot be undone.')) {
                resetDb()
                toast('All data deleted')
              }
            }}
          >
            <Trash2 size={16} /> Delete everything
          </Button>
        </div>
      </Card>
    </div>
  )
}
