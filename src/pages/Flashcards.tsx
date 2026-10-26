import { AnimatePresence, motion } from 'motion/react'
import { Check, Layers, Plus, RotateCcw, Shuffle, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, Empty, Markdown, toast } from '../components/ui'
import { uid, updateDb, useDb } from '../lib/store'
import type { Flashcard } from '../lib/types'
import { shuffle } from '../lib/utils'
import { useExam } from './ExamLayout'

// Leitner boxes: how long until a card comes back after "Got it".
const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30]

export default function Flashcards() {
  const exam = useExam()
  const db = useDb()
  const navigate = useNavigate()
  const all = useMemo(() => db.flashcards.filter((c) => c.examId === exam.id), [db.flashcards, exam.id])
  const [topic, setTopic] = useState('')
  const [queue, setQueue] = useState<string[] | null>(null)
  const [flipped, setFlipped] = useState(false)
  const [done, setDone] = useState(0)
  const [adding, setAdding] = useState(false)
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')

  const topics = [...new Set(all.map((c) => c.topic))]
  const pool = all.filter((c) => !topic || c.topic === topic)
  const due = pool.filter((c) => c.due <= Date.now())
  const mastered = pool.filter((c) => c.box >= 5).length

  const start = (cards: Flashcard[]) => {
    setQueue(shuffle(cards).map((c) => c.id))
    setFlipped(false)
    setDone(0)
  }

  const current = queue?.length ? all.find((c) => c.id === queue[0]) : null

  const grade = (good: boolean) => {
    if (!current || !queue) return
    const box = good ? Math.min(current.box + 1, 5) : 1
    const due = good ? Date.now() + INTERVAL_DAYS[box] * 86_400_000 : Date.now()
    updateDb((d) => ({ ...d, flashcards: d.flashcards.map((c) => (c.id === current.id ? { ...c, box, due } : c)) }))
    setFlipped(false)
    setDone((n) => n + 1)
    // "Again" puts the card back near the end of this session.
    setQueue(good ? queue.slice(1) : [...queue.slice(1), current.id])
  }

  const addCard = () => {
    if (!front.trim() || !back.trim()) return
    updateDb((d) => ({
      ...d,
      flashcards: [...d.flashcards, { id: uid(), examId: exam.id, front: front.trim(), back: back.trim(), topic: topic || 'General', box: 1, due: Date.now() }],
    }))
    setFront('')
    setBack('')
    toast('Card added')
  }

  if (!all.length && !adding) {
    return (
      <Empty
        icon={<Layers size={26} />}
        title="No flashcards yet"
        action={
          <div className="row" style={{ justifyContent: 'center' }}>
            <Button variant="primary" onClick={() => navigate('../notes/new')}>Add notes</Button>
            <Button variant="ghost" onClick={() => setAdding(true)}><Plus size={14} /> Write a card</Button>
          </div>
        }
      >
        Cards are created automatically every time the AI organises your notes.
      </Empty>
    )
  }

  if (queue) {
    return (
      <div className="stack lg" style={{ maxWidth: 680, margin: '0 auto', width: '100%' }}>
        <div className="row between">
          <span className="subtle">{done} reviewed · {queue.length} left</span>
          <Button size="sm" variant="ghost" onClick={() => setQueue(null)}>End session</Button>
        </div>
        <AnimatePresence mode="wait">
          {current ? (
            <motion.div key={current.id + done} initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: -60, rotate: -4 }} transition={{ duration: 0.3 }} className="flash-wrap">
              <motion.div
                className="flash"
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                onClick={() => setFlipped((f) => !f)}
                role="button"
                tabIndex={0}
                aria-label={flipped ? 'Answer side. Press to flip back' : 'Question side. Press to reveal the answer'}
                onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && (e.preventDefault(), setFlipped((f) => !f))}
              >
                <div className="flash-face">
                  <Badge>{current.topic}</Badge>
                  <div className="big"><Markdown>{current.front}</Markdown></div>
                  <span className="hint">Tap to reveal</span>
                </div>
                <div className="flash-face back">
                  <div style={{ fontSize: 'var(--fs-lg)' }}><Markdown>{current.back}</Markdown></div>
                </div>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className="empty">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1, rotate: [0, 10, -10, 0] }} transition={{ type: 'spring' }} className="feature-icon" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
                  <Check size={28} />
                </motion.div>
                <h3>Session complete</h3>
                <p className="muted">You reviewed {done} cards. Come back tomorrow for the next batch.</p>
                <Button variant="primary" onClick={() => setQueue(null)}>Done</Button>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
        {current && (
          <div className="row" style={{ justifyContent: 'center' }}>
            <Button size="lg" variant="danger" onClick={() => grade(false)} disabled={!flipped}>
              <X size={18} /> Again
            </Button>
            <Button size="lg" variant="primary" onClick={() => grade(true)} disabled={!flipped}>
              <Check size={18} /> Got it
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="stack lg">
      <div className="grid grid-3">
        <Card className="stat"><span className="value">{pool.length}</span><span className="label">cards</span></Card>
        <Card className="stat"><span className="value" style={{ color: 'var(--accent)' }}>{due.length}</span><span className="label">due now</span></Card>
        <Card className="stat"><span className="value" style={{ color: 'var(--success)' }}>{mastered}</span><span className="label">mastered</span></Card>
      </div>

      {topics.length > 1 && (
        <div className="chip-group">
          <button className="chip" aria-pressed={!topic} onClick={() => setTopic('')}>All topics</button>
          {topics.map((t) => (
            <button key={t} className="chip" aria-pressed={topic === t} onClick={() => setTopic(t)}>{t}</button>
          ))}
        </div>
      )}

      <div className="row">
        <Button variant="primary" size="lg" disabled={!due.length} onClick={() => start(due)}>
          <Layers size={18} /> Review {due.length} due
        </Button>
        <Button variant="secondary" disabled={!pool.length} onClick={() => start(pool)}>
          <Shuffle size={16} /> Study all
        </Button>
        <Button variant="ghost" onClick={() => setAdding((a) => !a)}>
          <Plus size={16} /> Write a card
        </Button>
      </div>

      {adding && (
        <Card className="stack">
          <div className="grid grid-2">
            <div className="field">
              <label htmlFor="fc-front">Front</label>
              <textarea id="fc-front" className="textarea" style={{ minHeight: 90 }} value={front} onChange={(e) => setFront(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="fc-back">Back</label>
              <textarea id="fc-back" className="textarea" style={{ minHeight: 90 }} value={back} onChange={(e) => setBack(e.target.value)} />
            </div>
          </div>
          <div><Button variant="primary" onClick={addCard} disabled={!front.trim() || !back.trim()}>Add card</Button></div>
        </Card>
      )}

      <Card className="stack">
        <h3>All cards</h3>
        <div className="list">
          {pool.map((c) => (
            <div key={c.id} className="list-item" style={{ alignItems: 'flex-start' }}>
              <div className="stack sm grow">
                <strong className="small">{c.front}</strong>
                <span className="subtle">{c.back}</span>
              </div>
              <Badge tone={c.box >= 5 ? 'success' : c.box >= 3 ? 'warning' : 'neutral'}>Box {c.box}</Badge>
              <Button size="sm" variant="ghost" icon aria-label="Reset card" onClick={() => updateDb((d) => ({ ...d, flashcards: d.flashcards.map((x) => (x.id === c.id ? { ...x, box: 1, due: Date.now() } : x)) }))}>
                <RotateCcw size={14} />
              </Button>
              <Button size="sm" variant="ghost" icon aria-label="Delete card" onClick={() => updateDb((d) => ({ ...d, flashcards: d.flashcards.filter((x) => x.id !== c.id) }))}>
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
