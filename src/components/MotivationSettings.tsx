import { AnimatePresence, motion } from 'motion/react'
import { Plus, Quote as QuoteIcon, Sparkles, Target, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { generateQuotes } from '../lib/ai'
import { focusExam } from '../lib/motivation'
import { BUILT_IN_QUOTES } from '../lib/quotes'
import { getDb, updateDb, useDb } from '../lib/store'
import type { Motivation } from '../lib/types'
import { Button, Card, ErrorAlert, toast, useAiTask } from './ui'

const setMotivation = (patch: Partial<Motivation>) => updateDb((d) => ({ ...d, motivation: { ...d.motivation, ...patch } }))

function QuoteList({ quotes, onRemove, tone }: { quotes: string[]; onRemove: (q: string) => void; tone: 'ai' | 'mine' }) {
  return (
    <div className="stack sm">
      <AnimatePresence initial={false}>
        {quotes.map((q) => (
          <motion.div
            key={q}
            className="row nowrap"
            style={{ gap: 10, padding: '10px 12px', borderRadius: 12, background: tone === 'ai' ? 'var(--primary-soft)' : 'var(--accent-soft)' }}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <QuoteIcon size={14} style={{ flex: 'none' }} color={tone === 'ai' ? 'var(--primary)' : 'var(--accent)'} />
            <span className="small grow">{q}</span>
            <button className="btn btn-ghost btn-sm btn-icon" style={{ flex: 'none', minHeight: 28, width: 28 }} aria-label="Remove quote" onClick={() => onRemove(q)}>
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

/** Settings section: your goal, AI-made quotes, your own quotes. */
export function MotivationSettings() {
  const db = useDb()
  const m = db.motivation
  const location = useLocation()
  const ref = useRef<HTMLDivElement>(null)
  const [goal, setGoal] = useState(m.goal)
  const [mine, setMine] = useState('')
  const task = useAiTask()

  useEffect(() => {
    if (location.hash === '#motivation') ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [location.hash])

  const makeQuotes = async () => {
    const g = goal.trim()
    if (!g) return
    setMotivation({ goal: g })
    const res = await task.run((o) => generateQuotes(g, focusExam(getDb()), o))
    if (!res) return
    const fresh = res.quotes.map((q) => q.trim().replace(/^["“]|["”]$/g, '')).filter(Boolean)
    setMotivation({ ai: [...fresh, ...getDb().motivation.ai.filter((q) => !fresh.includes(q))].slice(0, 40) })
    toast(`${fresh.length} quotes made from your goal`)
  }

  const addMine = () => {
    const q = mine.trim()
    if (!q || m.custom.includes(q)) return
    setMotivation({ custom: [q, ...m.custom] })
    setMine('')
  }

  return (
    <Card className="stack lg" ref={ref} id="motivation" style={{ scrollMarginTop: 24 }}>
      <div className="row nowrap" style={{ gap: 10 }}>
        <div className="feature-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
          <Target size={20} />
        </div>
        <div className="stack sm">
          <h3>Motivation & quotes</h3>
          <span className="subtle">These show up on your home screen, during focus sessions and after quizzes.</span>
        </div>
      </div>

      <div className="field">
        <label htmlFor="goal">What are you working towards?</label>
        <textarea
          id="goal"
          className="textarea"
          style={{ minHeight: 80 }}
          placeholder="e.g. If I get good grades I'm getting a new gaming PC. I want an A in Physics and to prove I can do it."
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        />
        <span className="hint">The AI turns this into quotes made just for you. Rewards, dream uni, proving someone wrong: anything works.</span>
      </div>
      <ErrorAlert error={task.error} />
      <div className="row">
        <Button variant="primary" disabled={!goal.trim() || task.running} onClick={makeQuotes}>
          <Sparkles size={16} /> {task.running ? 'Writing your quotes…' : m.ai.length ? 'Make more quotes' : 'Make my quotes with AI'}
        </Button>
        {goal.trim() !== m.goal && goal.trim() && !task.running && (
          <Button variant="ghost" onClick={() => setMotivation({ goal: goal.trim() })}>Save goal only</Button>
        )}
      </div>

      {m.ai.length > 0 && (
        <div className="stack sm">
          <div className="row between">
            <strong className="small">AI quotes from your goal</strong>
            <Button size="sm" variant="ghost" onClick={() => setMotivation({ ai: [] })}>Clear all</Button>
          </div>
          <QuoteList quotes={m.ai} tone="ai" onRemove={(q) => setMotivation({ ai: m.ai.filter((x) => x !== q) })} />
        </div>
      )}

      <div className="stack sm">
        <strong className="small">Your own quotes</strong>
        <form
          className="row nowrap"
          onSubmit={(e) => {
            e.preventDefault()
            addMine()
          }}
        >
          <input id="my-quote" className="input" placeholder="e.g. That PC isn't going to buy itself. Lock in." value={mine} onChange={(e) => setMine(e.target.value)} aria-label="Add your own quote" />
          <Button type="submit" variant="secondary" disabled={!mine.trim()}>
            <Plus size={16} /> Add
          </Button>
        </form>
        <QuoteList quotes={m.custom} tone="mine" onRemove={(q) => setMotivation({ custom: m.custom.filter((x) => x !== q) })} />
      </div>

      <label className="row small" style={{ gap: 8, cursor: 'pointer' }}>
        <input type="checkbox" id="builtin-quotes" checked={m.builtIn} onChange={(e) => setMotivation({ builtIn: e.target.checked })} style={{ accentColor: 'var(--primary)' }} />
        Also show StudyPilot's {BUILT_IN_QUOTES.length} built-in quotes
      </label>
    </Card>
  )
}
