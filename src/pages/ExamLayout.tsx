import { motion } from 'motion/react'
import { BarChart3, BookOpen, Brain, ChevronRight, ClipboardCheck, Gauge, Layers, Lightbulb, MessageCircle, Timer } from 'lucide-react'
import { useMemo } from 'react'
import { Link, NavLink, useOutletContext, useOutlet, useParams } from 'react-router-dom'
import { Button } from '../components/ui'
import { folderPath } from '../lib/folders'
import { useDb } from '../lib/store'
import type { Exam } from '../lib/types'
import { daysUntil, examColor, formatDate } from '../lib/utils'

const TABS = [
  { to: '', label: 'Overview', icon: Gauge, end: true },
  { to: 'notes', label: 'Notes', icon: BookOpen },
  { to: 'practice', label: 'Quizzes', icon: Brain },
  { to: 'tests', label: 'Mock tests', icon: Timer },
  { to: 'flashcards', label: 'Flashcards', icon: Layers },
  { to: 'tips', label: 'Tips & plan', icon: Lightbulb },
  { to: 'tutor', label: 'AI tutor', icon: MessageCircle },
  { to: 'progress', label: 'Progress', icon: BarChart3 },
  { to: 'review', label: 'Results & review', icon: ClipboardCheck },
]

export function useExam() {
  return useOutletContext<{ exam: Exam }>().exam
}

export default function ExamLayout() {
  const { examId } = useParams()
  const db = useDb()
  const outlet = useOutlet(useMemo(() => ({ exam: db.exams.find((e) => e.id === examId) }), [db.exams, examId]))
  const exam = db.exams.find((e) => e.id === examId)

  if (!exam) {
    return (
      <div className="page">
        <div className="card empty">
          <h3>Exam not found</h3>
          <p className="muted">It may have been deleted.</p>
          <Link to="/"><Button variant="primary">Go home</Button></Link>
        </div>
      </div>
    )
  }

  const d = daysUntil(exam.examDate)

  return (
    <div className="page">
      <div className="row between" style={{ alignItems: 'flex-end' }}>
        <div className="stack sm grow">
          {exam.folderId && (
            <nav className="row xs subtle" style={{ gap: 4 }} aria-label="Folder path">
              {folderPath(db, exam.folderId).map((f, i) => (
                <span key={f.id} className="row" style={{ gap: 4 }}>
                  {i > 0 && <ChevronRight size={12} />}
                  <Link to={`/folder/${f.id}`}>{f.name}</Link>
                </span>
              ))}
            </nav>
          )}
          <div className="row" style={{ gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 99, background: examColor(exam.hue) }} />
            <span className="eyebrow" style={{ color: 'var(--text-3)' }}>
              {exam.examDate ? formatDate(exam.examDate) : 'Exam date not set'}
            </span>
          </div>
          <h1>{exam.name}</h1>
        </div>
        {d !== null && d >= 0 && (
          <motion.div className="countdown" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <span className="num" style={{ color: d <= 7 ? 'var(--danger)' : 'var(--primary)' }}>{d}</span>
            <span className="muted">{d === 1 ? 'day left' : 'days left'}</span>
          </motion.div>
        )}
      </div>

      <nav className="tabs" aria-label="Exam sections">
        {TABS.map((t) => (
          <NavLink key={t.label} to={t.to} end={t.end} className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="tab-bg" className="tab-bg" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                <t.icon size={16} />
                {t.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {outlet}
    </div>
  )
}
