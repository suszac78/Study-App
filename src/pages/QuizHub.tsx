import { AnimatePresence, motion } from 'motion/react'
import { Brain, Play, Sparkles, Timer, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ask, AiWorking, Badge, Button, Card, ErrorAlert, fadeUp, stagger, staggerItem, toast, useAiTask } from '../components/ui'
import { generateQuiz, type QuizRequest } from '../lib/ai'
import type { AIQuestion } from '../lib/schemas'
import { uid, updateDb, useDb } from '../lib/store'
import type { Quiz } from '../lib/types'
import { pct, timeAgo } from '../lib/utils'
import { useExam } from './ExamLayout'

const TYPE_LABELS: Record<AIQuestion['type'], string> = { mcq: 'Multiple choice', truefalse: 'True / False', multi: 'Multiple correct' }

export default function QuizHub({ mode }: { mode: Quiz['mode'] }) {
  const exam = useExam()
  const db = useDb()
  const navigate = useNavigate()
  const location = useLocation()
  const task = useAiTask()
  const pattern = exam.info?.pattern
  const timed = mode === 'timed'

  const initialTopic = (location.state as { topic?: string } | null)?.topic
  const defaultCount = timed ? Math.min(pattern?.totalQuestions || 25, 30) || 25 : 10
  const [count, setCount] = useState(defaultCount)
  const [difficulty, setDifficulty] = useState<QuizRequest['difficulty']>(timed ? 'mixed' : 'mixed')
  const [topics, setTopics] = useState<string[]>(initialTopic ? [initialTopic] : [])
  const [types, setTypes] = useState<AIQuestion['type'][]>(timed ? ['mcq'] : ['mcq', 'truefalse'])
  const [focus, setFocus] = useState('')
  const perQ = pattern && pattern.totalQuestions && pattern.durationMinutes ? pattern.durationMinutes / pattern.totalQuestions : 1.2
  const [minutes, setMinutes] = useState(Math.max(5, Math.round(defaultCount * perQ)))
  const [marks, setMarks] = useState(pattern?.marksPerQuestion || 1)
  const [negative, setNegative] = useState(pattern?.negativeMarking || 0)

  const syllabus = exam.info?.syllabus.map((s) => s.topic) ?? [...new Set(db.notes.filter((n) => n.examId === exam.id).map((n) => n.topic))]
  const notes = useMemo(() => db.notes.filter((n) => n.examId === exam.id), [db.notes, exam.id])
  const quizzes = useMemo(
    () => db.quizzes.filter((q) => q.examId === exam.id && q.mode === mode).sort((a, b) => b.createdAt - a.createdAt),
    [db.quizzes, exam.id, mode],
  )

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  const create = async () => {
    const res = await task.run((o) => generateQuiz(exam, notes, { count, difficulty, topics, types, mode, focus }, o))
    if (!res) return
    const quiz: Quiz = {
      id: uid(),
      examId: exam.id,
      title: res.title,
      mode,
      createdAt: Date.now(),
      durationMinutes: timed ? minutes : 0,
      marksPerQuestion: timed ? marks : 1,
      negativeMark: timed ? negative : 0,
      questions: res.questions.map((q) => ({ ...q, id: uid() })),
    }
    updateDb((d) => ({ ...d, quizzes: [...d.quizzes, quiz] }))
    toast(`${quiz.questions.length} questions ready`)
    navigate(`../quiz/${quiz.id}`)
  }

  const remove = async (id: string) => {
    if (!(await ask('Delete this quiz and its attempts?'))) return
    updateDb((d) => ({ ...d, quizzes: d.quizzes.filter((q) => q.id !== id), attempts: d.attempts.filter((a) => a.quizId !== id) }))
  }

  return (
    <div className="stack lg">
      <AnimatePresence mode="wait">
        {task.running ? (
          <AiWorking key="w" title={timed ? `Building a ${count}-question mock test` : `Writing ${count} practice questions`} progress={task.progress} onStop={task.stop} />
        ) : (
          <motion.div key="f" {...fadeUp}>
            <Card className="stack lg">
              <div className="row" style={{ gap: 12 }}>
                <div className="feature-icon">{timed ? <Timer size={20} /> : <Brain size={20} />}</div>
                <div className="stack sm grow">
                  <h2>{timed ? 'New timed mock test' : 'New practice quiz'}</h2>
                  <p className="subtle">
                    {timed
                      ? 'Exam-style questions against the clock, scored with your exam’s marking scheme.'
                      : 'Answer one question at a time and see a full explanation straight away.'}
                    {!notes.length && ' Tip: add notes first so questions match what you studied.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-3">
                <div className="field">
                  <label htmlFor="qcount">Questions: <strong>{count}</strong></label>
                  <input
                    id="qcount"
                    type="range"
                    min={timed ? 10 : 5}
                    max={timed ? 60 : 30}
                    step={5}
                    value={count}
                    onChange={(e) => {
                      const c = Number(e.target.value)
                      setCount(c)
                      if (timed) setMinutes(Math.max(5, Math.round(c * perQ)))
                    }}
                  />
                </div>
                {timed && (
                  <>
                    <div className="field">
                      <label htmlFor="qmin">Time limit (minutes)</label>
                      <input id="qmin" className="input" type="number" min={1} max={300} value={minutes} onChange={(e) => setMinutes(Math.max(1, Number(e.target.value)))} />
                    </div>
                    <div className="field">
                      <label>Marking</label>
                      <div className="row nowrap">
                        <input aria-label="Marks per correct answer" className="input" type="number" step={0.25} min={0} value={marks} onChange={(e) => setMarks(Number(e.target.value))} />
                        <input aria-label="Negative marks per wrong answer" className="input" type="number" step={0.25} min={0} value={negative} onChange={(e) => setNegative(Number(e.target.value))} />
                      </div>
                      <span className="hint">+ per correct · − per wrong</span>
                    </div>
                  </>
                )}
              </div>

              <div className="field">
                <span className="label">Difficulty</span>
                <div className="chip-group">
                  {(['mixed', 'easy', 'medium', 'hard'] as const).map((d) => (
                    <button key={d} className="chip" aria-pressed={difficulty === d} onClick={() => setDifficulty(d)}>
                      {d[0].toUpperCase() + d.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <span className="label">Question types</span>
                <div className="chip-group">
                  {(Object.keys(TYPE_LABELS) as AIQuestion['type'][]).map((t) => (
                    <button key={t} className="chip" aria-pressed={types.includes(t)} onClick={() => setTypes((x) => (x.includes(t) && x.length === 1 ? x : toggle(x, t)))}>
                      {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              {syllabus.length > 0 && (
                <div className="field">
                  <span className="label">Topics <span className="hint">(none selected = whole syllabus)</span></span>
                  <div className="chip-group">
                    {syllabus.map((t) => (
                      <button key={t} className="chip" aria-pressed={topics.includes(t)} onClick={() => setTopics((x) => toggle(x, t))}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="field">
                <label htmlFor="qfocus">Anything specific? <span className="hint">(optional)</span></label>
                <input id="qfocus" className="input" placeholder="e.g. numerical problems only, previous-year style, focus on dates" value={focus} onChange={(e) => setFocus(e.target.value)} />
              </div>

              <ErrorAlert error={task.error} />
              <div>
                <Button variant="primary" size="lg" onClick={create}>
                  <Sparkles size={18} /> Generate {timed ? 'mock test' : 'quiz'}
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {quizzes.length > 0 && (
        <section className="stack">
          <h3>{timed ? 'Your mock tests' : 'Your quizzes'}</h3>
          <motion.div className="grid grid-2" variants={stagger} initial="initial" animate="animate">
            {quizzes.map((q) => {
              const attempts = db.attempts.filter((a) => a.quizId === q.id)
              const best = attempts.reduce((m, a) => Math.max(m, a.maxScore ? a.score / a.maxScore : 0), -1)
              return (
                <Card key={q.id} className="stack" variants={staggerItem}>
                  <div className="row between nowrap">
                    <h4 className="grow">{q.title}</h4>
                    <Button size="sm" variant="ghost" icon onClick={() => remove(q.id)} aria-label="Delete quiz">
                      <Trash2 size={14} />
                    </Button>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <Badge tone="neutral">{q.questions.length} Qs</Badge>
                    {timed && <Badge tone="neutral">{q.durationMinutes} min</Badge>}
                    {attempts.length > 0 && <Badge tone={best >= 0.75 ? 'success' : best >= 0.5 ? 'warning' : 'danger'}>Best {pct(Math.max(best, 0))}</Badge>}
                    <span className="subtle xs">{timeAgo(q.createdAt)}</span>
                  </div>
                  <div className="row">
                    <Button size="sm" variant="primary" onClick={() => navigate(`../quiz/${q.id}`)}>
                      <Play size={14} /> {attempts.length ? 'Retake' : 'Start'}
                    </Button>
                    {attempts.length > 0 && (
                      <Button size="sm" variant="ghost" onClick={() => navigate(`../results/${attempts[attempts.length - 1].id}`)}>
                        Last result
                      </Button>
                    )}
                  </div>
                </Card>
              )
            })}
          </motion.div>
        </section>
      )}
    </div>
  )
}
