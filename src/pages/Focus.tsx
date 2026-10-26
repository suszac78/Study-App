import { AnimatePresence, motion } from 'motion/react'
import { Flower2, Play, Scissors, Sprout, Timer, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Quests, StreakLevel } from '../components/Motivation'
import { Plant } from '../components/Plant'
import { Badge, Button, Card, Markdown, PageHead, ask, fadeUp, stagger, staggerItem } from '../components/ui'
import { AiError, currentProvider, shredExcuse } from '../lib/ai'
import { GRACE_SECONDS, endsAt, finishFocus, startFocus } from '../lib/focus'
import { OFFLINE_SHREDS, dayKey, focusExam, randomNudge } from '../lib/motivation'
import { useDb } from '../lib/store'
import { clock, formatDate } from '../lib/utils'

const LENGTHS = [
  { min: 15, label: '15 min', plant: 'Sprout' },
  { min: 25, label: '25 min', plant: 'Flower' },
  { min: 45, label: '45 min', plant: 'Double bloom' },
  { min: 60, label: '60 min', plant: 'Double bloom' },
]

function Timer_() {
  const db = useDb()
  const active = db.activeFocus
  const [now, setNow] = useState(() => Date.now())
  const [minutes, setMinutes] = useState(25)
  const [label, setLabel] = useState('')
  const [examId, setExamId] = useState(() => focusExam(db)?.id ?? '')
  const nudge = useMemo(randomNudge, [active?.id])

  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [active])

  if (!active) {
    return (
      <Card className="stack lg">
        <div className="focus-stage">
          <div className="plant-stage">
            <Plant progress={0.02} minutes={minutes} size={150} />
          </div>
          <div className="stack">
            <h2>Plant a focus session</h2>
            <p className="muted small">
              Your plant grows while you study. You can use any page in StudyPilot, but leave the app for more than {GRACE_SECONDS} seconds
              in total and it withers.
            </p>
            <div className="chip-group" role="group" aria-label="Session length">
              {LENGTHS.map((l) => (
                <button key={l.min} className="chip" aria-pressed={minutes === l.min} onClick={() => setMinutes(l.min)}>
                  {l.label}
                </button>
              ))}
            </div>
            <div className="field">
              <label htmlFor="focus-label">What are you working on?</label>
              <input id="focus-label" className="input" placeholder="e.g. Chapter 3 flashcards" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            {db.exams.length > 0 && (
              <div className="field">
                <label htmlFor="focus-exam">For exam</label>
                <select id="focus-exam" className="select" value={examId} onChange={(e) => setExamId(e.target.value)}>
                  <option value="">None</option>
                  {db.exams.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <Button variant="primary" size="lg" onClick={() => startFocus(minutes, label, examId || null)}>
                <Play size={18} /> Start {minutes}-minute session
              </Button>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  const total = active.minutes * 60
  const left = Math.max(0, (endsAt(active) - now) / 1000)
  const progress = 1 - left / total
  const awaySec = Math.round(active.awayMs / 1000)

  return (
    <Card className="stack lg" {...fadeUp}>
      <div className="focus-stage">
        <div className="plant-stage">
          <Plant progress={progress} seed={active.seed} minutes={active.minutes} size={190} />
        </div>
        <div className="stack">
          <span className="eyebrow">Focusing{active.label ? ` · ${active.label}` : ''}</span>
          <div className="focus-clock" aria-live="off">{clock(left)}</div>
          <p className="muted">{nudge}</p>
          <div className="stack sm">
            <div className="row between xs subtle">
              <span>Away from the app</span>
              <span className="mono">{awaySec}s / {GRACE_SECONDS}s</span>
            </div>
            <div className={`meter ${awaySec > GRACE_SECONDS * 0.6 ? 'bad' : awaySec > 0 ? 'mid' : 'good'}`}>
              <motion.span animate={{ width: `${Math.min(100, (awaySec / GRACE_SECONDS) * 100)}%` }} />
            </div>
          </div>
          <p className="hint">Tip: open your notes, flashcards or a quiz from the sidebar. The timer keeps running inside StudyPilot.</p>
          <div>
            <Button
              variant="ghost"
              onClick={async () => {
                if (await ask('Give up? Your plant will wither and land in the garden as a sad little twig.')) finishFocus('withered')
              }}
            >
              <X size={16} /> Give up
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

function ExcuseShredder({ autoFocus }: { autoFocus: boolean }) {
  const db = useDb()
  const [excuse, setExcuse] = useState('')
  const [shredding, setShredding] = useState<string | null>(null)
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const ctl = useRef<AbortController | null>(null)
  const boxRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) boxRef.current?.focus()
    return () => ctl.current?.abort()
  }, [autoFocus])

  const shred = async () => {
    const text = excuse.trim()
    if (!text || busy) return
    setShredding(text)
    setExcuse('')
    setAnswer('')
    setBusy(true)
    const c = new AbortController()
    ctl.current = c
    try {
      if (currentProvider() === 'none') throw new AiError('no-ai', '')
      await shredExcuse(text, focusExam(db), setAnswer, c.signal)
    } catch (e) {
      if (!(e instanceof AiError && e.code === 'cancelled')) setAnswer(OFFLINE_SHREDS[Math.floor(Math.random() * OFFLINE_SHREDS.length)])
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="stack" id="buster">
      <div className="row nowrap" style={{ gap: 10 }}>
        <div className="feature-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
          <Scissors size={20} />
        </div>
        <div className="stack sm">
          <h3>Excuse shredder</h3>
          <span className="subtle">Procrastinating? Type your excuse. It gets shredded and you get one tiny task to start now.</span>
        </div>
      </div>
      <form
        className="row nowrap"
        onSubmit={(e) => {
          e.preventDefault()
          shred()
        }}
      >
        <input
          ref={boxRef}
          id="excuse"
          className="input"
          placeholder="e.g. I'll start after one more episode"
          value={excuse}
          onChange={(e) => setExcuse(e.target.value)}
          aria-label="Your excuse"
        />
        <Button type="submit" variant="primary" disabled={!excuse.trim() || busy}>
          <Scissors size={16} /> Shred it
        </Button>
      </form>
      <AnimatePresence mode="wait">
        {shredding && (
          <motion.div key={shredding} className="stack" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* the excuse, cut into falling strips */}
            <div style={{ display: 'flex', gap: 3, height: 34, overflow: 'hidden' }} aria-hidden>
              {Array.from({ length: 14 }, (_, i) => (
                <motion.div
                  key={i}
                  className="shred-strip"
                  style={{ flex: 1 }}
                  initial={{ y: 0, rotate: 0, opacity: 1 }}
                  animate={{ y: 40, rotate: (i % 2 ? 1 : -1) * (8 + i), opacity: 0 }}
                  transition={{ duration: 0.9, delay: i * 0.03, ease: 'easeIn' }}
                />
              ))}
            </div>
            <p className="subtle xs" style={{ textDecoration: 'line-through' }}>“{shredding}”</p>
            <div className="bubble assistant" style={{ maxWidth: '100%' }}>
              {answer ? <Markdown>{answer}</Markdown> : <span className="shimmer-text small">Shredding…</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

export default function Focus() {
  const db = useDb()
  const location = useLocation()
  const buster = !!(location.state as { buster?: boolean } | null)?.buster
  const garden = useMemo(() => [...db.focusSessions].reverse(), [db.focusSessions])
  const today = dayKey(Date.now())
  const todayMin = db.focusSessions.filter((s) => s.status === 'grown' && dayKey(s.endedAt) === today).reduce((s, x) => s + x.minutes, 0)
  const totalMin = db.focusSessions.filter((s) => s.status === 'grown').reduce((s, x) => s + x.minutes, 0)
  const grown = db.focusSessions.filter((s) => s.status === 'grown').length

  useEffect(() => {
    if (buster) document.getElementById('buster')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [buster])

  return (
    <div className="page">
      <PageHead eyebrow="Beat procrastination" title="Focus garden" sub="Grow plants by staying focused, keep your streak alive and clear today's quests." />

      <Card className="stack lg">
        <StreakLevel />
        <hr className="divider" />
        <Quests />
      </Card>

      <Timer_ />

      <ExcuseShredder autoFocus={buster} />

      <section className="stack">
        <div className="row between">
          <h2 className="row" style={{ gap: 8 }}>
            <Flower2 size={22} color="var(--leaf)" /> Your garden
          </h2>
          <div className="row" style={{ gap: 6 }}>
            <Badge tone="neutral">{todayMin} min today</Badge>
            <Badge tone="neutral">{Math.round((totalMin / 60) * 10) / 10} h total</Badge>
            <Badge tone="success">{grown} grown</Badge>
          </div>
        </div>
        {garden.length === 0 ? (
          <Card className="empty flat">
            <div className="feature-icon"><Sprout size={26} /></div>
            <h3>Nothing planted yet</h3>
            <p className="muted">Finish your first focus session and your first plant appears here.</p>
          </Card>
        ) : (
          <motion.div className="garden" variants={stagger} initial="initial" animate="animate">
            {garden.slice(0, 60).map((s) => (
              <motion.div key={s.id} className="garden-plot" variants={staggerItem} title={`${s.label || 'Focus'} · ${s.minutes} min${s.status === 'withered' ? ' · withered' : ''}`}>
                <Plant progress={1} withered={s.status === 'withered'} seed={s.seed} minutes={s.minutes} size={64} />
                <span className="xs" style={{ fontWeight: 600 }}>
                  <Timer size={11} style={{ verticalAlign: -1 }} /> {s.minutes}m
                </span>
                <span className="subtle" style={{ fontSize: '0.68rem' }}>{formatDate(dayKey(s.endedAt))}</span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>
    </div>
  )
}
