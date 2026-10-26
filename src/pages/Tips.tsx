import { AnimatePresence, motion } from 'motion/react'
import { AlarmClock, CheckSquare, Flame, Lightbulb, RefreshCw, Sparkles, Target, TriangleAlert } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { AiWorking, Badge, Button, Card, Empty, ErrorAlert, stagger, staggerItem, useAiTask } from '../components/ui'
import { generateTips } from '../lib/ai'
import { updateDb, useDb } from '../lib/store'
import { timeAgo } from '../lib/utils'
import { useExam } from './ExamLayout'

function Block({ icon, title, children, tone }: { icon: ReactNode; title: string; children: ReactNode; tone?: string }) {
  return (
    <Card className="stack" variants={staggerItem}>
      <div className="row" style={{ gap: 10 }}>
        <div className="feature-icon" style={{ width: 34, height: 34, borderRadius: 10, ...(tone ? { background: `var(--${tone}-soft)`, color: `var(--${tone})` } : {}) }}>{icon}</div>
        <h3>{title}</h3>
      </div>
      {children}
    </Card>
  )
}

export default function Tips() {
  const exam = useExam()
  const db = useDb()
  const task = useAiTask()
  const entry = db.tips.find((t) => t.examId === exam.id)
  const notes = useMemo(() => db.notes.filter((n) => n.examId === exam.id), [db.notes, exam.id])
  const attempts = useMemo(() => db.attempts.filter((a) => a.examId === exam.id), [db.attempts, exam.id])
  const [done, setDone] = useState<Record<string, boolean>>({})

  const make = async () => {
    const tips = await task.run((o) => generateTips(exam, notes, attempts, db.quizzes, o))
    if (!tips) return
    updateDb((d) => ({ ...d, tips: [...d.tips.filter((t) => t.examId !== exam.id), { examId: exam.id, createdAt: Date.now(), tips }] }))
  }

  if (task.running) return <AiWorking title="Building your exam strategy" progress={task.progress} onStop={task.stop} />

  if (!entry) {
    return (
      <div className="stack">
        <Empty
          icon={<Lightbulb size={26} />}
          title="Your exam strategy"
          action={
            <Button variant="primary" size="lg" onClick={make}>
              <Sparkles size={18} /> Create my plan
            </Button>
          }
        >
          Get a day-by-day study plan up to exam day, priority topics, time-management tactics for this paper, common mistakes and an exam-day
          checklist. It uses your notes and quiz results, so regenerate it as you progress.
        </Empty>
        <ErrorAlert error={task.error} />
      </div>
    )
  }
  const t = entry.tips

  return (
    <AnimatePresence mode="wait">
      <motion.div key={entry.createdAt} className="stack lg" variants={stagger} initial="initial" animate="animate">
        <Card className="stack" variants={staggerItem} style={{ background: 'linear-gradient(135deg, var(--primary-soft), var(--accent-soft))' }}>
          <div className="row between">
            <span className="eyebrow">Your strategy · {timeAgo(entry.createdAt)}</span>
            <Button size="sm" variant="ghost" onClick={make}>
              <RefreshCw size={14} /> Refresh with latest progress
            </Button>
          </div>
          <h2>{t.headline}</h2>
          <p className="muted">{t.overview}</p>
        </Card>
        <ErrorAlert error={task.error} />

        <Block icon={<Target size={17} />} title="Priority topics">
          <div className="list">
            {t.priorityTopics.map((p) => (
              <div key={p.topic} className="list-item" style={{ alignItems: 'flex-start' }}>
                <div className="stack sm grow">
                  <strong>{p.topic}</strong>
                  <span className="subtle">{p.reason}</span>
                </div>
                <Badge tone={p.weight}>{p.weight}</Badge>
              </div>
            ))}
          </div>
        </Block>

        <Block icon={<AlarmClock size={17} />} title="Study plan">
          <div className="timeline">
            {t.studyPlan.map((s) => (
              <div key={s.label} className="timeline-item">
                <div className="timeline-dot"><span /></div>
                <div className="timeline-body stack sm">
                  <div className="row" style={{ gap: 8 }}>
                    <strong>{s.label}</strong>
                    <Badge tone="neutral">{s.focus}</Badge>
                  </div>
                  <ul className="check-list small">
                    {s.tasks.map((task) => {
                      const k = s.label + task
                      return (
                        <li key={k}>
                          <input type="checkbox" id={k} checked={!!done[k]} onChange={(e) => setDone((d) => ({ ...d, [k]: e.target.checked }))} style={{ marginTop: 4, accentColor: 'var(--primary)' }} />
                          <label htmlFor={k} style={{ textDecoration: done[k] ? 'line-through' : 'none', opacity: done[k] ? 0.6 : 1 }}>{task}</label>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </Block>

        <div className="grid grid-2">
          <Block icon={<Sparkles size={17} />} title="Strategies">
            <div className="stack">
              {t.strategies.map((s) => (
                <div key={s.title} className="stack sm">
                  <strong className="small">{s.title}</strong>
                  <span className="subtle">{s.detail}</span>
                </div>
              ))}
            </div>
          </Block>
          <Block icon={<AlarmClock size={17} />} title="Time management">
            <ul className="check-list small">
              {t.timeManagement.map((x) => <li key={x}><AlarmClock size={15} /><span>{x}</span></li>)}
            </ul>
          </Block>
          <Block icon={<TriangleAlert size={17} />} title="Common mistakes" tone="danger">
            <ul className="check-list small">
              {t.commonMistakes.map((x) => <li key={x}><TriangleAlert size={15} color="var(--danger)" /><span>{x}</span></li>)}
            </ul>
          </Block>
          <Block icon={<CheckSquare size={17} />} title="Exam-day checklist" tone="success">
            <ul className="check-list small">
              {t.examDayChecklist.map((x) => <li key={x}><CheckSquare size={15} color="var(--success)" /><span>{x}</span></li>)}
            </ul>
          </Block>
        </div>

        <Card className="row flat" variants={staggerItem} style={{ gap: 12 }}>
          <Flame size={22} color="var(--accent)" />
          <p style={{ fontStyle: 'italic' }}>{t.motivation}</p>
        </Card>
      </motion.div>
    </AnimatePresence>
  )
}
