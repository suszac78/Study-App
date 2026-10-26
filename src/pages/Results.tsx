import { AnimatePresence, motion } from 'motion/react'
import { MessageCircle, RotateCcw, Sparkles, Target, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { QuestionView } from '../components/QuestionView'
import { AiWorking, Button, Card, ErrorAlert, Meter, Ring, stagger, staggerItem, useAiTask } from '../components/ui'
import { generateFeedback, sameSet, topicStats } from '../lib/ai'
import { updateDb, useDb } from '../lib/store'
import { clock, pct } from '../lib/utils'
import { useExam } from './ExamLayout'

type Filter = 'all' | 'wrong' | 'skipped' | 'correct'

export default function Results() {
  const exam = useExam()
  const { attemptId } = useParams()
  const db = useDb()
  const navigate = useNavigate()
  const task = useAiTask()
  const [filter, setFilter] = useState<Filter>('all')
  const attempt = db.attempts.find((a) => a.id === attemptId)
  const quiz = db.quizzes.find((q) => q.id === attempt?.quizId)
  const topics = useMemo(() => (attempt && quiz ? topicStats([attempt], [quiz]) : []), [attempt, quiz])

  if (!attempt || !quiz) {
    return (
      <Card className="empty">
        <h3>Result not found</h3>
        <Link to="../practice"><Button>Back</Button></Link>
      </Card>
    )
  }

  const ratio = attempt.maxScore ? Math.max(0, attempt.score) / attempt.maxScore : 0
  const accuracy = attempt.correct / quiz.questions.length
  const seconds = (attempt.finishedAt - attempt.startedAt) / 1000
  const verdict = ratio >= 0.85 ? 'Outstanding!' : ratio >= 0.7 ? 'Great work' : ratio >= 0.5 ? 'Getting there' : 'Keep practising'

  const list = quiz.questions
    .map((q, i) => ({ q, i, a: attempt.answers[q.id] ?? [] }))
    .filter(({ q, a }) =>
      filter === 'all' ? true : filter === 'skipped' ? !a.length : filter === 'correct' ? sameSet(a, q.correct) : a.length > 0 && !sameSet(a, q.correct),
    )

  const getFeedback = async () => {
    const fb = await task.run((o) => generateFeedback(exam, quiz, attempt, o))
    if (fb) updateDb((d) => ({ ...d, attempts: d.attempts.map((a) => (a.id === attempt.id ? { ...a, feedback: fb } : a)) }))
  }

  return (
    <div className="stack lg">
      <motion.div className="grid grid-2" variants={stagger} initial="initial" animate="animate">
        <Card className="row" variants={staggerItem} style={{ gap: 24 }}>
          <Ring value={ratio} label={pct(ratio)} sub="score" />
          <div className="stack sm grow">
            <span className="eyebrow">{quiz.mode === 'timed' ? 'Mock test result' : 'Quiz result'}</span>
            <h2>{verdict}</h2>
            <p className="muted mono">
              {attempt.score} / {attempt.maxScore} marks
            </p>
            <div className="row">
              <Button size="sm" variant="primary" onClick={() => navigate(`../quiz/${quiz.id}`)}>
                <RotateCcw size={14} /> Retake
              </Button>
              <Button size="sm" variant="secondary" onClick={() => navigate(quiz.mode === 'timed' ? '../tests' : '../practice')}>
                New {quiz.mode === 'timed' ? 'test' : 'quiz'}
              </Button>
            </div>
          </div>
        </Card>
        <Card className="grid grid-4" variants={staggerItem} style={{ gap: 12, alignContent: 'center' }}>
          <div className="stat"><span className="value" style={{ color: 'var(--success)' }}>{attempt.correct}</span><span className="label">correct</span></div>
          <div className="stat"><span className="value" style={{ color: 'var(--danger)' }}>{attempt.wrong}</span><span className="label">wrong</span></div>
          <div className="stat"><span className="value">{attempt.skipped}</span><span className="label">skipped</span></div>
          <div className="stat"><span className="value mono">{clock(seconds)}</span><span className="label">time taken</span></div>
          <div className="stat"><span className="value">{pct(accuracy)}</span><span className="label">accuracy</span></div>
          {quiz.negativeMark > 0 && (
            <div className="stat"><span className="value" style={{ color: 'var(--danger)' }}>−{Math.round(attempt.wrong * quiz.negativeMark * 100) / 100}</span><span className="label">lost to negatives</span></div>
          )}
        </Card>
      </motion.div>

      {topics.length > 0 && (
        <Card className="stack">
          <div className="row" style={{ gap: 8 }}>
            <Target size={18} color="var(--primary)" />
            <h3>By topic</h3>
          </div>
          <div className="stack">
            {topics.map((t) => (
              <div key={t.topic} className="stack sm">
                <div className="row between small">
                  <span>{t.topic}</span>
                  <span className="mono subtle">{t.correct}/{t.total}</span>
                </div>
                <Meter value={t.accuracy} />
              </div>
            ))}
          </div>
        </Card>
      )}

      <AnimatePresence mode="wait">
        {task.running ? (
          <AiWorking key="w" title="Analysing your attempt" progress={task.progress} onStop={task.stop} />
        ) : attempt.feedback ? (
          <Card key="fb" className="stack" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="row" style={{ gap: 8 }}>
              <Sparkles size={18} color="var(--primary)" />
              <h3>AI coach feedback</h3>
            </div>
            <p style={{ fontSize: 'var(--fs-lg)' }}>{attempt.feedback.verdict}</p>
            <div className="grid grid-2">
              <div className="stack sm">
                <strong className="small" style={{ color: 'var(--success)' }}>Strengths</strong>
                <ul className="check-list small">
                  {attempt.feedback.strengths.map((s) => <li key={s}><TrendingUp size={15} /><span>{s}</span></li>)}
                </ul>
              </div>
              <div className="stack sm">
                <strong className="small">Next steps</strong>
                <ol className="small" style={{ margin: 0, paddingLeft: 18 }}>
                  {attempt.feedback.nextSteps.map((s) => <li key={s} style={{ marginBottom: 6 }}>{s}</li>)}
                </ol>
              </div>
            </div>
            {attempt.feedback.weaknesses.length > 0 && (
              <div className="stack sm">
                <strong className="small" style={{ color: 'var(--danger)' }}>Fix these</strong>
                {attempt.feedback.weaknesses.map((w) => (
                  <div key={w.topic + w.issue} className="explain stack sm">
                    <strong className="small">{w.topic}</strong>
                    <span className="small">{w.issue}</span>
                    <span className="small muted">→ {w.fix}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ) : (
          <Card key="ask" className="row between flat">
            <span className="muted">Want a coach's take on what went wrong and what to do next?</span>
            <Button variant="primary" onClick={getFeedback}>
              <Sparkles size={16} /> Get AI feedback
            </Button>
          </Card>
        )}
      </AnimatePresence>
      <ErrorAlert error={task.error} />

      <section className="stack">
        <div className="row between">
          <h3>Review answers</h3>
          <div className="chip-group">
            {(['all', 'wrong', 'skipped', 'correct'] as Filter[]).map((f) => (
              <button key={f} className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {list.length === 0 && <p className="subtle">Nothing here.</p>}
        {list.map(({ q, i, a }) => (
          <Card key={q.id} className="stack">
            <QuestionView q={q} index={i} total={quiz.questions.length} selected={a} reveal />
            <div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  navigate('../tutor', {
                    state: {
                      prompt: `I got this question ${a.length ? (sameSet(a, q.correct) ? 'right but want to understand it better' : 'wrong') : 'skipped'}. Explain it step by step and give me a similar question to try.\n\nQuestion: ${q.prompt}\nOptions: ${q.options.map((o, j) => `${'ABCDE'[j]}) ${o}`).join('  ')}\nCorrect: ${q.correct.map((c) => q.options[c]).join(', ')}${a.length ? `\nMy answer: ${a.map((c) => q.options[c]).join(', ')}` : ''}`,
                    },
                  })
                }
              >
                <MessageCircle size={14} /> Explain more with the tutor
              </Button>
            </div>
          </Card>
        ))}
      </section>
    </div>
  )
}
