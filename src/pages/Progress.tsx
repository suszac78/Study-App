import { motion } from 'motion/react'
import { BarChart3, ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge, Button, Card, Empty, Meter, Ring, stagger, staggerItem } from '../components/ui'
import { topicStats } from '../lib/ai'
import { useDb } from '../lib/store'
import { pct, timeAgo } from '../lib/utils'
import { useExam } from './ExamLayout'

export default function Progress() {
  const exam = useExam()
  const db = useDb()
  const navigate = useNavigate()
  const attempts = useMemo(() => db.attempts.filter((a) => a.examId === exam.id).sort((a, b) => a.finishedAt - b.finishedAt), [db.attempts, exam.id])
  const stats = useMemo(() => topicStats(attempts, db.quizzes), [attempts, db.quizzes])
  const notes = db.notes.filter((n) => n.examId === exam.id)
  const cards = db.flashcards.filter((c) => c.examId === exam.id)

  if (!attempts.length) {
    return (
      <Empty icon={<BarChart3 size={26} />} title="No results yet" action={<Button variant="primary" onClick={() => navigate('../practice')}>Take a quiz</Button>}>
        Take a quiz or mock test and your accuracy by topic will show up here.
      </Empty>
    )
  }

  const totalQ = stats.reduce((s, t) => s + t.total, 0)
  const totalC = stats.reduce((s, t) => s + t.correct, 0)
  const overall = totalQ ? totalC / totalQ : 0
  const recent = attempts.slice(-12)
  const syllabus = exam.info?.syllabus.map((s) => s.topic) ?? []
  const untested = syllabus.filter((t) => !stats.some((s) => s.topic === t))

  // Score trend as simple bars (latest 12 attempts).
  const trend = recent.map((a) => ({ id: a.id, v: a.maxScore ? Math.max(0, a.score) / a.maxScore : 0, mode: a.mode }))

  return (
    <motion.div className="stack lg" variants={stagger} initial="initial" animate="animate">
      <div className="grid grid-2">
        <Card className="row" variants={staggerItem} style={{ gap: 24 }}>
          <Ring value={overall} label={pct(overall)} sub="overall accuracy" />
          <div className="grid grid-2 grow" style={{ gap: 12 }}>
            <div className="stat"><span className="value">{attempts.length}</span><span className="label">attempts</span></div>
            <div className="stat"><span className="value">{totalQ}</span><span className="label">questions answered</span></div>
            <div className="stat"><span className="value">{notes.length}</span><span className="label">notes</span></div>
            <div className="stat"><span className="value">{cards.filter((c) => c.box >= 5).length}/{cards.length}</span><span className="label">cards mastered</span></div>
          </div>
        </Card>
        <Card className="stack" variants={staggerItem}>
          <h3>Score trend</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140 }} role="img" aria-label={`Scores of the last ${trend.length} attempts`}>
            {trend.map((t, i) => (
              <Link key={t.id} to={`../results/${t.id}`} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end' }} title={`${pct(t.v)} · ${t.mode === 'timed' ? 'mock test' : 'quiz'}`}>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(4, t.v * 100)}%` }}
                  transition={{ delay: i * 0.04, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    width: '100%',
                    borderRadius: '6px 6px 3px 3px',
                    background: t.v >= 0.75 ? 'var(--success)' : t.v >= 0.5 ? 'var(--warning)' : 'var(--danger)',
                    opacity: t.mode === 'timed' ? 1 : 0.7,
                  }}
                />
              </Link>
            ))}
          </div>
          <span className="hint">Oldest → newest. Solid bars are mock tests.</span>
        </Card>
      </div>

      <Card className="stack" variants={staggerItem}>
        <div className="row between">
          <h3>Topic mastery</h3>
          <span className="subtle xs">weakest first</span>
        </div>
        <div className="stack">
          {stats.map((t) => (
            <div key={t.topic} className="row nowrap" style={{ gap: 12 }}>
              <div className="stack sm grow">
                <div className="row between small">
                  <span>{t.topic}</span>
                  <span className="mono subtle">{pct(t.accuracy)} · {t.total} Qs</span>
                </div>
                <Meter value={t.accuracy} />
              </div>
              <Button size="sm" variant="ghost" onClick={() => navigate('../practice', { state: { topic: t.topic } })}>
                Practise
              </Button>
            </div>
          ))}
        </div>
        {untested.length > 0 && (
          <div className="alert info">
            <span><strong>Not tested yet:</strong> {untested.join(' · ')}</span>
          </div>
        )}
      </Card>

      <Card className="stack" variants={staggerItem}>
        <h3>History</h3>
        <div className="list">
          {[...attempts].reverse().map((a) => {
            const q = db.quizzes.find((x) => x.id === a.quizId)
            const v = a.maxScore ? Math.max(0, a.score) / a.maxScore : 0
            return (
              <Link key={a.id} to={`../results/${a.id}`} className="list-item">
                <div className="stack sm grow">
                  <strong className="small">{q?.title ?? 'Deleted quiz'}</strong>
                  <span className="subtle xs">{timeAgo(a.finishedAt)} · {a.mode === 'timed' ? 'Mock test' : 'Practice'}</span>
                </div>
                <Badge tone={v >= 0.75 ? 'success' : v >= 0.5 ? 'warning' : 'danger'}>{pct(v)}</Badge>
                <ChevronRight size={16} color="var(--text-3)" />
              </Link>
            )
          })}
        </div>
      </Card>
    </motion.div>
  )
}
