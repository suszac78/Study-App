import { AnimatePresence, motion } from 'motion/react'
import { BookOpen, Brain, MessageCircle, Sparkles, Timer, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExamInfoView } from '../components/ExamInfoView'
import { ask, AiWorking, Badge, Button, Card, ErrorAlert, FileDrop, fadeUp, stagger, staggerItem, toast, useAiTask } from '../components/ui'
import { analyzeExam, topicStats } from '../lib/ai'
import { updateDb, useDb } from '../lib/store'
import { pct } from '../lib/utils'
import { useExam } from './ExamLayout'

export default function Overview() {
  const exam = useExam()
  const db = useDb()
  const navigate = useNavigate()
  const task = useAiTask()
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(exam.name)
  const [date, setDate] = useState(exam.examDate)

  const notes = useMemo(() => db.notes.filter((n) => n.examId === exam.id), [db.notes, exam.id])
  const attempts = useMemo(() => db.attempts.filter((a) => a.examId === exam.id), [db.attempts, exam.id])
  const stats = useMemo(() => topicStats(attempts, db.quizzes), [attempts, db.quizzes])
  const dueCards = db.flashcards.filter((c) => c.examId === exam.id && c.due <= Date.now()).length

  const analyse = async () => {
    const info = await task.run((o) => analyzeExam({ text, files }, o))
    if (!info) return
    updateDb((d) => ({
      ...d,
      exams: d.exams.map((e) =>
        e.id === exam.id
          ? { ...e, info, sourceText: text, examDate: e.examDate || (/^\d{4}-\d{2}-\d{2}$/.test(info.examDate) ? info.examDate : '') }
          : e,
      ),
    }))
    setText('')
    setFiles([])
    toast('Exam details updated')
  }

  const saveEdit = () => {
    updateDb((d) => ({ ...d, exams: d.exams.map((e) => (e.id === exam.id ? { ...e, name: name.trim() || e.name, examDate: date } : e)) }))
    setEditing(false)
    toast('Saved')
  }

  const remove = async () => {
    if (!(await ask(`Delete "${exam.name}" and all its notes, quizzes and progress? This cannot be undone.`))) return
    updateDb((d) => ({
      ...d,
      exams: d.exams.filter((e) => e.id !== exam.id),
      notes: d.notes.filter((n) => n.examId !== exam.id),
      quizzes: d.quizzes.filter((q) => q.examId !== exam.id),
      attempts: d.attempts.filter((a) => a.examId !== exam.id),
      flashcards: d.flashcards.filter((c) => c.examId !== exam.id),
      tips: d.tips.filter((t) => t.examId !== exam.id),
      chats: Object.fromEntries(Object.entries(d.chats).filter(([k]) => k !== exam.id && !k.startsWith(`${exam.id}:`))),
    }))
    navigate('/')
  }

  const actions = [
    { icon: <BookOpen size={20} />, title: notes.length ? 'Add notes' : 'Add notes or a course', text: notes.length ? `${notes.length} note${notes.length === 1 ? '' : 's'} so far` : 'Paste, upload, or import from Canvas', to: notes.length ? 'notes/new' : 'notes' },
    { icon: <Brain size={20} />, title: 'Practice quiz', text: 'Learn with instant explanations', to: 'practice' },
    { icon: <Timer size={20} />, title: 'Timed mock test', text: 'Real pattern, real pressure', to: 'tests' },
    { icon: <MessageCircle size={20} />, title: 'Ask the AI tutor', text: dueCards ? `${dueCards} flashcard${dueCards === 1 ? '' : 's'} due too` : 'Explain anything', to: 'tutor' },
  ]

  return (
    <div className="stack lg">
      <motion.div className="grid grid-4" variants={stagger} initial="initial" animate="animate">
        {actions.map((a) => (
          <Card key={a.title} className="interactive feature-tile" variants={staggerItem} whileHover={{ y: -4 }} onClick={() => navigate(a.to)} role="link" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate(a.to)}>
            <div className="feature-icon">{a.icon}</div>
            <h4>{a.title}</h4>
            <p className="subtle">{a.text}</p>
          </Card>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">
        {task.running ? (
          <AiWorking key="w" title="Reading your exam notification" progress={task.progress} onStop={task.stop} />
        ) : !exam.info ? (
          <Card key="add" className="stack" {...fadeUp}>
            <h3>Add the exam notification</h3>
            <p className="muted small">
              Upload or paste the official notification so the AI can map the syllabus, pattern and marking. Quizzes and tips get much
              better with it.
            </p>
            <FileDrop files={files} onChange={setFiles} />
            <textarea className="textarea" placeholder="…or paste the text here" value={text} onChange={(e) => setText(e.target.value)} aria-label="Exam notification text" />
            <ErrorAlert error={task.error} />
            <div className="row">
              <Button variant="primary" disabled={!files.length && text.trim().length < 20} onClick={analyse}>
                <Sparkles size={16} /> Analyse with AI
              </Button>
            </div>
          </Card>
        ) : (
          <motion.div key="info" {...fadeUp}>
            <ExamInfoView
              info={exam.info}
              coverage={(topic) => {
                const n = notes.filter((x) => x.topic === topic).length
                const s = stats.find((x) => x.topic === topic)
                return (
                  <div className="stack sm" style={{ alignItems: 'flex-end', flex: 'none' }}>
                    <Badge tone={n ? 'success' : 'neutral'}>{n ? `${n} note${n > 1 ? 's' : ''}` : 'No notes'}</Badge>
                    {s && <Badge tone={s.accuracy >= 0.75 ? 'success' : s.accuracy >= 0.5 ? 'warning' : 'danger'}>{pct(s.accuracy)} correct</Badge>}
                  </div>
                )
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="stack flat">
        <div className="row between">
          <h3>Exam settings</h3>
          {!editing && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Edit name / date
            </Button>
          )}
        </div>
        {editing && (
          <div className="grid grid-2">
            <div className="field">
              <label htmlFor="ed-name">Name</label>
              <input id="ed-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ed-date">Date</label>
              <input id="ed-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="row">
              <Button variant="primary" size="sm" onClick={saveEdit}>Save</Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        )}
        {exam.info && (
          <details>
            <summary className="small" style={{ cursor: 'pointer' }}>Replace the exam notification</summary>
            <div className="stack" style={{ marginTop: 12 }}>
              <FileDrop files={files} onChange={setFiles} />
              <textarea className="textarea" placeholder="…or paste the text" value={text} onChange={(e) => setText(e.target.value)} aria-label="Exam notification text" />
              <ErrorAlert error={task.error} />
              <Button variant="secondary" disabled={!files.length && text.trim().length < 20} onClick={analyse}>
                <Sparkles size={16} /> Re-analyse
              </Button>
            </div>
          </details>
        )}
        <div>
          <Button variant="danger" size="sm" onClick={remove}>
            <Trash2 size={14} /> Delete exam
          </Button>
        </div>
      </Card>
    </div>
  )
}
