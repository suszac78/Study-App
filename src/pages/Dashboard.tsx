import { motion } from 'motion/react'
import {
  ArrowRight,
  BookOpen,
  Brain,
  CalendarClock,
  FileUp,
  Layers,
  Lightbulb,
  MessageCircle,
  Plus,
  Scissors,
  Sprout,
  Timer,
} from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAiStatus } from '../components/Layout'
import { Quests, StreakLevel } from '../components/Motivation'
import { QuoteCard } from '../components/Quote'
import { FolderTree } from '../components/FolderTree'
import { pathLabel } from '../lib/folders'
import { Badge, Button, Card, Meter, stagger, staggerItem } from '../components/ui'
import { sameSet } from '../lib/ai'
import { useDb } from '../lib/store'
import { daysUntil, examColor, formatDate } from '../lib/utils'

const FEATURES = [
  { icon: <FileUp size={20} />, title: 'Drop in your exam notification', text: 'The AI pulls out the date, pattern, marking scheme and full syllabus.' },
  { icon: <BookOpen size={20} />, title: 'Organised notes', text: 'Messy notes, PDFs or photos become clean notes with key points, formulas and mnemonics.' },
  { icon: <Brain size={20} />, title: 'Quizzes with explanations', text: 'Practice questions from your notes, with a full explanation for every option.' },
  { icon: <Timer size={20} />, title: 'Timed mock tests', text: 'Real exam pattern, a countdown timer, negative marking and a detailed score report.' },
  { icon: <Layers size={20} />, title: 'Flashcards', text: 'Spaced-repetition cards made automatically from your notes.' },
  { icon: <Lightbulb size={20} />, title: 'Exam tips & study plan', text: 'A day-by-day plan to exam day, built around your weak topics.' },
  { icon: <MessageCircle size={20} />, title: 'AI tutor', text: 'Ask anything. It knows your exam and your notes.' },
  { icon: <CalendarClock size={20} />, title: 'Progress tracking', text: 'See accuracy by topic and what to revise next.' },
]

export default function Dashboard() {
  const db = useDb()
  const navigate = useNavigate()
  const { provider } = useAiStatus()

  const exams = useMemo(
    () =>
      [...db.exams].sort((a, b) => {
        const da = daysUntil(a.examDate) ?? 9999
        const dbb = daysUntil(b.examDate) ?? 9999
        return da - dbb
      }),
    [db.exams],
  )

  const statsFor = (examId: string) => {
    const attempts = db.attempts.filter((a) => a.examId === examId)
    let correct = 0
    let total = 0
    for (const a of attempts) {
      const quiz = db.quizzes.find((q) => q.id === a.quizId)
      quiz?.questions.forEach((q) => {
        total++
        if (sameSet(a.answers[q.id] ?? [], q.correct)) correct++
      })
    }
    const topics = db.exams.find((e) => e.id === examId)?.info?.syllabus.map((s) => s.topic) ?? []
    const covered = new Set(db.notes.filter((n) => n.examId === examId).map((n) => n.topic))
    return {
      notes: db.notes.filter((n) => n.examId === examId).length,
      attempts: attempts.length,
      accuracy: total ? correct / total : null,
      coverage: topics.length ? topics.filter((t) => covered.has(t)).length / topics.length : 0,
    }
  }

  return (
    <div className="page">
      <motion.section className="hero" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
        <div className="hero-orb" aria-hidden>A+</div>
        <div className="stack lg" style={{ position: 'relative' }}>
          <span className="badge" style={{ background: 'rgba(255,255,255,.16)', color: '#fff', alignSelf: 'flex-start' }}>
            AI study companion
          </span>
          <h1>{exams.length ? <>Keep going. <mark>You’ve got this.</mark></> : <>Study smarter for <mark>any exam.</mark></>}</h1>
          <p>
            Add your exam notification and notes. StudyPilot organises everything, then builds quizzes, timed mock tests,
            flashcards and a study plan for you.
          </p>
          <div className="row">
            <Button variant="primary" size="lg" onClick={() => navigate('/new')}>
              <Plus size={18} /> Add an exam
            </Button>
            {exams[0] && (
              <Button variant="secondary" size="lg" onClick={() => navigate(`/exam/${exams[0].id}`)}>
                Continue {exams[0].name} <ArrowRight size={18} />
              </Button>
            )}
          </div>
        </div>
      </motion.section>

      <QuoteCard />

      <div className="card mobile-only">
        <FolderTree />
      </div>

      <Card className="stack lg" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <StreakLevel />
        <hr className="divider" />
        <Quests />
        <div className="row">
          <Button variant="primary" onClick={() => navigate('/focus')}>
            <Sprout size={16} /> Start a focus session
          </Button>
          <Button variant="secondary" onClick={() => navigate('/focus', { state: { buster: true } })}>
            <Scissors size={16} /> I'm procrastinating
          </Button>
        </div>
      </Card>

      {provider === 'none' && (
        <div className="alert warn">
          <span>
            AI isn't connected. Make sure you're signed in to claude.ai with your own account, then reload. Still stuck? Press{' '}
            <Link to="/settings">Settings → Check AI</Link> to see exactly why.
          </span>
        </div>
      )}

      {exams.length > 0 && (
        <section className="stack">
          <div className="row between">
            <h2>Your exams</h2>
            <Button size="sm" variant="ghost" onClick={() => navigate('/new')}>
              <Plus size={16} /> New
            </Button>
          </div>
          <motion.div className="grid grid-2" variants={stagger} initial="initial" animate="animate">
            {exams.map((e) => {
              const d = daysUntil(e.examDate)
              const s = statsFor(e.id)
              return (
                <motion.div key={e.id} variants={staggerItem} whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300, damping: 24 }}>
                  <Link to={`/exam/${e.id}`} className="card interactive exam-card">
                    <span className="stripe" style={{ background: `linear-gradient(90deg, ${examColor(e.hue)}, ${examColor(e.hue + 40)})` }} />
                    <div className="row between nowrap">
                      <div className="stack sm grow">
                        {e.folderId && <span className="subtle xs">{pathLabel(db, e.folderId)}</span>}
                        <h3 style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</h3>
                        <span className="subtle">{e.examDate ? formatDate(e.examDate) : 'Date not set'}</span>
                      </div>
                      {d !== null && (
                        <div className="countdown" aria-label={`${d} days left`}>
                          <span className="num" style={{ color: d <= 7 ? 'var(--danger)' : 'var(--text)' }}>{Math.max(d, 0)}</span>
                          <span className="subtle">{d === 1 ? 'day' : 'days'}</span>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-3" style={{ gap: 10 }}>
                      <div className="stat">
                        <span className="value">{s.notes}</span>
                        <span className="label">notes</span>
                      </div>
                      <div className="stat">
                        <span className="value">{s.attempts}</span>
                        <span className="label">quizzes taken</span>
                      </div>
                      <div className="stat">
                        <span className="value">{s.accuracy === null ? '–' : `${Math.round(s.accuracy * 100)}%`}</span>
                        <span className="label">accuracy</span>
                      </div>
                    </div>
                    {e.info && (
                      <div className="stack sm">
                        <div className="row between xs subtle">
                          <span>Syllabus covered by notes</span>
                          <span>{Math.round(s.coverage * 100)}%</span>
                        </div>
                        <Meter value={s.coverage} tone="" />
                      </div>
                    )}
                    {d !== null && d < 0 && <Badge tone="neutral">Exam date passed</Badge>}
                  </Link>
                </motion.div>
              )
            })}
          </motion.div>
        </section>
      )}

      <section className="stack">
        <h2>{exams.length ? 'Everything in one place' : 'How it works'}</h2>
        <motion.div className="grid grid-4" variants={stagger} initial="initial" animate="animate">
          {FEATURES.map((f) => (
            <Card key={f.title} className="feature-tile flat" variants={staggerItem}>
              <div className="feature-icon">{f.icon}</div>
              <h4>{f.title}</h4>
              <p className="subtle">{f.text}</p>
            </Card>
          ))}
        </motion.div>
      </section>
    </div>
  )
}
