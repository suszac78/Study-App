import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowRight, Clock, Flag, Play, Send } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { QuestionView } from '../components/QuestionView'
import { Badge, Button, Card, ask, fadeUp } from '../components/ui'
import { sameSet } from '../lib/ai'
import { uid, updateDb, useDb } from '../lib/store'
import type { Attempt, Quiz } from '../lib/types'
import { clock } from '../lib/utils'

function score(quiz: Quiz, answers: Record<string, number[]>) {
  let correct = 0
  let wrong = 0
  let skipped = 0
  for (const q of quiz.questions) {
    const a = answers[q.id] ?? []
    if (!a.length) skipped++
    else if (sameSet(a, q.correct)) correct++
    else wrong++
  }
  const s = correct * quiz.marksPerQuestion - wrong * quiz.negativeMark
  return { correct, wrong, skipped, score: Math.round(s * 100) / 100, maxScore: quiz.questions.length * quiz.marksPerQuestion }
}

export default function QuizPlayer() {
  const { quizId } = useParams()
  const db = useDb()
  const quiz = db.quizzes.find((q) => q.id === quizId)
  if (!quiz) {
    return (
      <Card className="empty">
        <h3>Quiz not found</h3>
        <Link to="../practice"><Button>Back</Button></Link>
      </Card>
    )
  }
  return <Player key={quiz.id} quiz={quiz} />
}

function Player({ quiz }: { quiz: Quiz }) {
  const navigate = useNavigate()
  const timed = quiz.mode === 'timed'
  const [started, setStarted] = useState(!timed)
  const [startedAt, setStartedAt] = useState(() => Date.now())
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number[]>>({})
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [flagged, setFlagged] = useState<Set<string>>(new Set())
  const [now, setNow] = useState(() => Date.now())
  const [dir, setDir] = useState(1)
  const finishedRef = useRef(false)

  const q = quiz.questions[idx]
  const total = quiz.questions.length
  const remaining = timed ? quiz.durationMinutes * 60 - (now - startedAt) / 1000 : 0
  const answeredCount = useMemo(() => Object.values(answers).filter((a) => a.length).length, [answers])

  const finish = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    const s = score(quiz, answers)
    const attempt: Attempt = {
      id: uid(),
      quizId: quiz.id,
      examId: quiz.examId,
      mode: quiz.mode,
      startedAt,
      finishedAt: Date.now(),
      answers,
      feedback: null,
      ...s,
    }
    updateDb((d) => ({ ...d, attempts: [...d.attempts, attempt] }))
    navigate(`../results/${attempt.id}`, { replace: true })
  }, [quiz, answers, startedAt, navigate])

  // Timer
  useEffect(() => {
    if (!timed || !started) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [timed, started])

  useEffect(() => {
    if (timed && started && remaining <= 0) finish()
  }, [timed, started, remaining, finish])

  // Warn before leaving a running test
  useEffect(() => {
    if (!timed || !started) return
    const h = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [timed, started])

  const go = (n: number) => {
    if (n < 0 || n >= total) return
    setDir(n > idx ? 1 : -1)
    setIdx(n)
  }

  const reveal = !timed && !!revealed[q?.id]
  const selected = answers[q?.id] ?? []

  // Keyboard: 1-5 / A-E pick, arrows navigate, Enter checks
  useEffect(() => {
    if (!started) return
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return
      const k = e.key.toLowerCase()
      const n = '12345'.indexOf(k) >= 0 ? '12345'.indexOf(k) : 'abcde'.indexOf(k)
      if (n >= 0 && n < q.options.length && !reveal) {
        const cur = answers[q.id] ?? []
        setAnswers((a) => ({ ...a, [q.id]: q.type === 'multi' ? (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n].sort()) : [n] }))
      } else if (e.key === 'ArrowRight') go(idx + 1)
      else if (e.key === 'ArrowLeft') go(idx - 1)
      else if (e.key === 'Enter' && !timed && !reveal && selected.length) setRevealed((r) => ({ ...r, [q.id]: true }))
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  if (!started) {
    return (
      <Card className="stack lg" {...fadeUp} style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>
        <div className="stack sm">
          <span className="eyebrow">Mock test</span>
          <h2>{quiz.title}</h2>
        </div>
        <div className="grid grid-3" style={{ gap: 10 }}>
          <div className="card tight flat stat"><span className="value">{total}</span><span className="label">questions</span></div>
          <div className="card tight flat stat"><span className="value">{quiz.durationMinutes}</span><span className="label">minutes</span></div>
          <div className="card tight flat stat"><span className="value">+{quiz.marksPerQuestion}/−{quiz.negativeMark}</span><span className="label">marking</span></div>
        </div>
        <ul className="check-list small muted">
          <li>• The timer starts when you press Start and the test submits itself when time runs out.</li>
          <li>• Use the question palette to jump around and flag questions to revisit.</li>
          <li>• {quiz.negativeMark ? `Wrong answers cost ${quiz.negativeMark} marks, so skip if you're guessing blindly.` : 'There is no negative marking, so answer everything.'}</li>
          <li>• Keyboard: 1–5 to answer, ← → to move.</li>
        </ul>
        <Button
          variant="primary"
          size="lg"
          onClick={() => {
            setStartedAt(Date.now())
            setNow(Date.now())
            setStarted(true)
          }}
        >
          <Play size={18} /> Start test
        </Button>
      </Card>
    )
  }

  const palette = (
    <Card className="stack quiz-side tight">
      {timed && (
        <div className={`timer ${remaining < 60 ? 'low' : ''}`} aria-live="off">
          <Clock size={18} /> {clock(remaining)}
        </div>
      )}
      <div className="row between xs subtle">
        <span>{answeredCount}/{total} answered</span>
        {flagged.size > 0 && <span>{flagged.size} flagged</span>}
      </div>
      <div className="palette">
        {quiz.questions.map((qq, i) => {
          const a = answers[qq.id] ?? []
          const r = !timed && revealed[qq.id]
          const cls = [
            i === idx ? 'current' : '',
            r ? (sameSet(a, qq.correct) ? 'correct' : 'wrong') : a.length ? 'answered' : '',
            flagged.has(qq.id) ? 'flagged' : '',
          ].join(' ')
          return (
            <button key={qq.id} className={cls} onClick={() => go(i)} aria-label={`Question ${i + 1}`}>
              {i + 1}
            </button>
          )
        })}
      </div>
      <Button
        variant="primary"
        onClick={async () => {
          const left = total - answeredCount
          if (timed && left > 0 && !(await ask(`${left} question${left > 1 ? 's are' : ' is'} unanswered. Submit anyway?`))) return
          finish()
        }}
      >
        <Send size={16} /> {timed ? 'Submit test' : 'Finish quiz'}
      </Button>
    </Card>
  )

  return (
    <div className="quiz-layout">
      <Card className="stack lg" style={{ overflow: 'hidden' }}>
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={q.id}
            custom={dir}
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <QuestionView
              q={q}
              index={idx}
              total={total}
              selected={selected}
              onSelect={(next) => setAnswers((a) => ({ ...a, [q.id]: next }))}
              reveal={reveal}
              showHint={!timed}
            />
          </motion.div>
        </AnimatePresence>

        <div className="row between">
          <div className="row">
            <Button variant="ghost" disabled={idx === 0} onClick={() => go(idx - 1)}>
              <ArrowLeft size={16} /> Prev
            </Button>
            {timed && (
              <Button
                variant={flagged.has(q.id) ? 'secondary' : 'ghost'}
                onClick={() =>
                  setFlagged((f) => {
                    const n = new Set(f)
                    if (n.has(q.id)) n.delete(q.id)
                    else n.add(q.id)
                    return n
                  })
                }
              >
                <Flag size={16} color={flagged.has(q.id) ? 'var(--accent)' : undefined} /> {flagged.has(q.id) ? 'Flagged' : 'Flag'}
              </Button>
            )}
            {timed && selected.length > 0 && (
              <Button variant="ghost" onClick={() => setAnswers((a) => ({ ...a, [q.id]: [] }))}>
                Clear
              </Button>
            )}
          </div>
          <div className="row">
            {!timed && !reveal && (
              <Button variant="primary" disabled={!selected.length} onClick={() => setRevealed((r) => ({ ...r, [q.id]: true }))}>
                Check answer
              </Button>
            )}
            {(timed || reveal) &&
              (idx < total - 1 ? (
                <Button variant={reveal ? 'primary' : 'secondary'} onClick={() => go(idx + 1)}>
                  Next <ArrowRight size={16} />
                </Button>
              ) : (
                !timed && (
                  <Button variant="primary" onClick={finish}>
                    See results <ArrowRight size={16} />
                  </Button>
                )
              ))}
          </div>
        </div>
        {!timed && (
          <div className="row xs subtle">
            <Badge tone="neutral">Practice mode</Badge>
            <span>Pick an answer, then check it to see the explanation.</span>
          </div>
        )}
      </Card>
      {palette}
    </div>
  )
}
