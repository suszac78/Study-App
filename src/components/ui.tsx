import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react'
import { AlertTriangle, FileText, Image as ImageIcon, Paperclip, Sparkles, Square, Upload, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import 'katex/dist/katex.min.css'
import { AiError } from '../lib/ai'
import { ACCEPTED_FILES, imageType, isPdf } from '../lib/files'

// ---------- motion presets ----------

export const spring = { type: 'spring' as const, stiffness: 420, damping: 30 }
export const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const },
}
export const stagger = {
  animate: { transition: { staggerChildren: 0.05 } },
}
export const staggerItem = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } },
}

// ---------- Button ----------

type BtnProps = HTMLMotionProps<'button'> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  icon?: boolean
}

export function Button({ variant = 'secondary', size = 'md', icon, className = '', ...rest }: BtnProps) {
  return (
    <motion.button
      whileHover={rest.disabled ? undefined : { y: -1 }}
      whileTap={rest.disabled ? undefined : { scale: 0.96 }}
      transition={spring}
      className={`btn btn-${variant} ${size !== 'md' ? `btn-${size}` : ''} ${icon ? 'btn-icon' : ''} ${className}`}
      {...rest}
    />
  )
}

// ---------- Card ----------

export function Card({
  children,
  className = '',
  ...rest
}: HTMLMotionProps<'div'> & { children?: ReactNode }) {
  return (
    <motion.div className={`card ${className}`} {...rest}>
      {children}
    </motion.div>
  )
}

export function Badge({ children, tone = '' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>
}

export function Meter({ value, tone }: { value: number; tone?: 'good' | 'mid' | 'bad' | '' }) {
  const v = Math.max(0, Math.min(1, value))
  const t = tone ?? (v >= 0.75 ? 'good' : v >= 0.5 ? 'mid' : 'bad')
  return (
    <div className={`meter ${t}`} role="progressbar" aria-valuenow={Math.round(v * 100)} aria-valuemin={0} aria-valuemax={100}>
      <motion.span initial={{ width: 0 }} animate={{ width: `${v * 100}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
    </div>
  )
}

export function Ring({ value, size = 140, stroke = 12, label, sub }: { value: number; size?: number; stroke?: number; label: ReactNode; sub?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  const color = v >= 0.75 ? 'var(--success)' : v >= 0.5 ? 'var(--warning)' : 'var(--danger)'
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="ring-label">
        <div className="ring-value">{label}</div>
        {sub && <div className="subtle xs">{sub}</div>}
      </div>
    </div>
  )
}

export function PageHead({ eyebrow, title, sub, actions }: { eyebrow?: ReactNode; title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div className="stack sm grow">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  )
}

export function Empty({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <Card className="empty" {...fadeUp}>
      <div className="feature-icon">{icon}</div>
      <h3>{title}</h3>
      {children && <p className="muted" style={{ maxWidth: '46ch' }}>{children}</p>}
      {action}
    </Card>
  )
}

export function ErrorAlert({ error }: { error: string | null }) {
  return (
    <AnimatePresence>
      {error && (
        <motion.div className="alert" role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
          <AlertTriangle size={16} />
          <span>{error}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ---------- Markdown ----------

export function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
        {children}
      </ReactMarkdown>
    </div>
  )
}

// ---------- File drop ----------

export function FileDrop({ files, onChange, label = 'Drop PDFs, photos or text files' }: { files: File[]; onChange: (f: File[]) => void; label?: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const add = (list: FileList | null) => {
    if (!list) return
    onChange([...files, ...Array.from(list)])
  }
  return (
    <div className="stack sm">
      <div
        className={`dropzone ${over ? 'over' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          add(e.dataTransfer.files)
        }}
      >
        <div className="stack sm" style={{ alignItems: 'center' }}>
          <Upload size={22} color="var(--primary)" />
          <strong className="small">{label}</strong>
          <span className="hint">PDF, Word, PowerPoint, photos or text · click to browse</span>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_FILES}
          hidden
          onChange={(e) => {
            add(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
      {files.length > 0 && (
        <div className="chip-group">
          {files.map((f, i) => (
            <motion.span key={`${f.name}-${i}`} className="file-pill" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              {isPdf(f) ? <FileText size={14} /> : imageType(f) ? <ImageIcon size={14} /> : <Paperclip size={14} />}
              <span>{f.name}</span>
              <button
                className="btn btn-ghost btn-sm"
                style={{ minHeight: 24, padding: 2 }}
                aria-label={`Remove ${f.name}`}
                onClick={() => onChange(files.filter((_, j) => j !== i))}
              >
                <X size={14} />
              </button>
            </motion.span>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- AI task runner ----------

export function useAiTask() {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const ctl = useRef<AbortController | null>(null)

  useEffect(() => () => ctl.current?.abort(), [])

  const run = useCallback(async <T,>(fn: (opts: { signal: AbortSignal; onProgress: (n: number) => void }) => Promise<T>): Promise<T | null> => {
    ctl.current?.abort()
    const c = new AbortController()
    ctl.current = c
    setRunning(true)
    setProgress(0)
    setError(null)
    try {
      return await fn({ signal: c.signal, onProgress: setProgress })
    } catch (e) {
      if (e instanceof AiError && e.code === 'cancelled') return null
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      return null
    } finally {
      if (ctl.current === c) {
        setRunning(false)
        ctl.current = null
      }
    }
  }, [])

  const stop = useCallback(() => ctl.current?.abort(), [])
  return { running, progress, error, setError, run, stop }
}

const PHASES = ['Reading your material', 'Thinking it through', 'Structuring everything', 'Writing it up', 'Double-checking']

export function AiWorking({ title, progress, onStop }: { title: string; progress: number; onStop?: () => void }) {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setPhase((p) => Math.min(p + 1, PHASES.length - 2)), 6000)
    return () => clearInterval(t)
  }, [])
  const label = progress > 0 ? `${PHASES[PHASES.length - 2]} · ${(progress / 1000).toFixed(1)}k characters` : PHASES[phase]
  return (
    <Card className="ai-working" {...fadeUp}>
      <motion.div className="orb" animate={{ rotate: 360, scale: [1, 1.08, 1] }} transition={{ rotate: { duration: 4, repeat: Infinity, ease: 'linear' }, scale: { duration: 2, repeat: Infinity } }} />
      <div className="stack sm" style={{ alignItems: 'center' }}>
        <h3 className="row" style={{ gap: 8 }}>
          <Sparkles size={18} color="var(--primary)" /> {title}
        </h3>
        <span className="shimmer-text small" aria-live="polite">{label}</span>
        <span className="hint">This usually takes 20 seconds to 2 minutes.</span>
      </div>
      {onStop && (
        <Button size="sm" variant="ghost" onClick={onStop}>
          <Square size={14} /> Stop
        </Button>
      )}
    </Card>
  )
}

// ---------- Toasts ----------

let pushToast: (msg: string) => void = () => {}
export const toast = (msg: string) => pushToast(msg)

export function Toaster() {
  const [items, setItems] = useState<{ id: number; msg: string }[]>([])
  useEffect(() => {
    pushToast = (msg) => {
      const id = Date.now() + Math.random()
      setItems((x) => [...x, { id, msg }])
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3200)
    }
  }, [])
  return (
    <div className="toast-wrap" aria-live="polite">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div key={t.id} className="toast" initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }}>
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// ---------- Confirm dialog (in-page; browser confirm() is blocked on claude.ai) ----------

type AskState = { message: string; resolve: (ok: boolean) => void } | null
let openAsk: (s: AskState) => void = () => {}

export function ask(message: string): Promise<boolean> {
  return new Promise((resolve) => openAsk({ message, resolve }))
}

export function ConfirmHost() {
  const [state, setState] = useState<AskState>(null)
  const okRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    openAsk = setState
  }, [])
  useEffect(() => {
    if (state) okRef.current?.focus()
  }, [state])
  const close = (ok: boolean) => {
    state?.resolve(ok)
    setState(null)
  }
  return (
    <AnimatePresence>
      {state && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => close(false)}
          onKeyDown={(e) => e.key === 'Escape' && close(false)}
        >
          <motion.div
            className="card modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="ask-msg"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            onClick={(e) => e.stopPropagation()}
          >
            <p id="ask-msg">{state.message}</p>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={() => close(false)}>Cancel</Button>
              <Button ref={okRef} variant="primary" onClick={() => close(true)}>Continue</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
