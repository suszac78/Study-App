import { AnimatePresence, motion } from 'motion/react'
import { Check, PackageOpen, PencilLine, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExamInfoView } from '../components/ExamInfoView'
import { AiWorking, Button, Card, ErrorAlert, FileDrop, PageHead, fadeUp, toast, useAiTask } from '../components/ui'
import { analyzeExam } from '../lib/ai'
import type { ExamAnalysis } from '../lib/schemas'
import { uid, updateDb } from '../lib/store'
import { PLACEHOLDER_EXAM_NAME } from './CourseImport'

export default function NewExam() {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [info, setInfo] = useState<ExamAnalysis | null>(null)
  const task = useAiTask()

  const analyse = async () => {
    const result = await task.run((o) => analyzeExam({ text, files }, o))
    if (result) {
      setInfo(result)
      if (!name) setName(result.examName)
      if (!date && /^\d{4}-\d{2}-\d{2}$/.test(result.examDate)) setDate(result.examDate)
    }
  }

  const save = () => {
    const id = uid()
    updateDb((d) => ({
      ...d,
      exams: [
        ...d.exams,
        {
          id,
          name: name.trim() || info?.examName || 'My exam',
          examDate: date,
          createdAt: Date.now(),
          hue: Math.floor(Math.random() * 360),
          info,
          sourceText: text,
        },
      ],
    }))
    toast('Exam added')
    navigate(`/exam/${id}`)
  }

  const importCourse = () => {
    const id = uid()
    updateDb((d) => ({
      ...d,
      exams: [...d.exams, { id, name: name.trim() || PLACEHOLDER_EXAM_NAME, examDate: date, createdAt: Date.now(), hue: Math.floor(Math.random() * 360), info: null, sourceText: '' }],
    }))
    navigate(`/exam/${id}/notes/import`)
  }

  const canAnalyse = text.trim().length > 20 || files.length > 0

  return (
    <div className="page">
      <PageHead
        eyebrow="New exam"
        title="Add your exam"
        sub="Paste or upload the official exam notification. The AI reads it and sets everything up: dates, pattern, marking and syllabus."
      />

      <AnimatePresence mode="wait">
        {task.running ? (
          <AiWorking key="working" title="Reading your exam notification" progress={task.progress} onStop={task.stop} />
        ) : info ? (
          <motion.div key="review" className="stack lg" {...fadeUp}>
            <Card className="stack">
              <div className="row" style={{ gap: 8 }}>
                <Check size={18} color="var(--success)" />
                <h3>Check the details, then save</h3>
              </div>
              <div className="grid grid-2">
                <div className="field">
                  <label htmlFor="exam-name">Exam name</label>
                  <input id="exam-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="exam-date">Exam date</label>
                  <input id="exam-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
                  {info.examDate && !/^\d{4}-\d{2}-\d{2}$/.test(info.examDate) && <span className="hint">Notification says: {info.examDate}</span>}
                </div>
              </div>
              <div className="row">
                <Button variant="primary" onClick={save}>
                  <Check size={16} /> Save exam
                </Button>
                <Button variant="ghost" onClick={() => setInfo(null)}>
                  Back
                </Button>
              </div>
            </Card>
            <ExamInfoView info={info} />
          </motion.div>
        ) : (
          <motion.div key="form" className="stack lg" {...fadeUp}>
            <Card className="row between flat" style={{ gap: 16 }}>
              <div className="row nowrap" style={{ gap: 12 }}>
                <div className="feature-icon"><PackageOpen size={20} /></div>
                <div className="stack sm">
                  <strong>Have the whole course as EPUBs or a Canvas export?</strong>
                  <span className="subtle">Import every book chapter or course module at once.</span>
                </div>
              </div>
              <Button variant="secondary" onClick={importCourse}>Import a course</Button>
            </Card>
            <Card className="stack lg">
              <div className="grid grid-2">
                <div className="field">
                  <label htmlFor="exam-name">Exam name <span className="hint">(optional, the AI can fill it)</span></label>
                  <input id="exam-name" className="input" placeholder="e.g. NEET 2027, CA Foundation, Physics Final" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="exam-date">Exam date <span className="hint">(optional)</span></label>
                  <input id="exam-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
              </div>
              <FileDrop files={files} onChange={setFiles} label="Upload the exam notification / brochure / syllabus" />
              <div className="field">
                <label htmlFor="exam-text">…or paste its text</label>
                <textarea
                  id="exam-text"
                  className="textarea"
                  placeholder="Paste the notification, syllabus, exam pattern, marking scheme… anything you have."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </div>
              <ErrorAlert error={task.error} />
              <div className="row">
                <Button variant="primary" size="lg" disabled={!canAnalyse} onClick={analyse}>
                  <Sparkles size={18} /> Analyse with AI
                </Button>
                <Button variant="ghost" disabled={!name.trim()} onClick={save} title={name.trim() ? '' : 'Enter an exam name first'}>
                  <PencilLine size={16} /> Skip, just save the name
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
