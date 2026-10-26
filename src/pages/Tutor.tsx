import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { ChatPanel } from '../components/ChatPanel'
import { tutorReply } from '../lib/ai'
import { useDb } from '../lib/store'
import { useExam } from './ExamLayout'

const SUGGESTIONS = [
  'Quiz me on my weakest topic, one question at a time',
  'Explain the hardest concept in my notes simply',
  'What should I study today?',
  'Give me a 10-minute revision summary of everything',
  'Which topics are most likely to come up?',
]

export default function Tutor() {
  const exam = useExam()
  const db = useDb()
  const location = useLocation()
  const notes = useMemo(() => db.notes.filter((n) => n.examId === exam.id), [db.notes, exam.id])

  return (
    <div className="stack lg" style={{ minHeight: '60vh' }}>
      <div className="stack sm">
        <h2>AI tutor</h2>
        <p className="subtle">Knows your exam pattern, syllabus and all {notes.length} of your notes.</p>
      </div>
      <ChatPanel
        chatKey={exam.id}
        reply={(history, onText, signal) => tutorReply(exam, notes, history, onText, signal)}
        intro={
          <p>
            Hi! I'm your tutor for <strong>{exam.name}</strong>. Ask me to explain anything, quiz you, make a summary, or plan your revision.
          </p>
        }
        suggestions={SUGGESTIONS}
        placeholder="Ask anything about your exam or notes…"
        initialInput={(location.state as { prompt?: string } | null)?.prompt ?? ''}
      />
    </div>
  )
}
