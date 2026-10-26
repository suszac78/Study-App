import { AnimatePresence, motion } from 'motion/react'
import { Save, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AiWorking, Button, Card, ErrorAlert, FileDrop, fadeUp, toast, useAiTask } from '../components/ui'
import { organizeNotes } from '../lib/ai'
import { uid, updateDb } from '../lib/store'
import type { Flashcard } from '../lib/types'
import { useExam } from './ExamLayout'

export default function NoteNew() {
  const exam = useExam()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [hint, setHint] = useState('')
  const [topic, setTopic] = useState('')
  const task = useAiTask()

  const topics = exam.info?.syllabus.map((s) => s.topic) ?? []

  const organise = async () => {
    const hintText = [topic && `Topic: ${topic}`, hint].filter(Boolean).join('. ')
    const organized = await task.run((o) => organizeNotes(exam, { text, files }, hintText, o))
    if (!organized) return
    const id = uid()
    const cards: Flashcard[] = organized.flashcards.map((c) => ({
      id: uid(),
      examId: exam.id,
      front: c.front,
      back: c.back,
      topic: organized.topic,
      box: 1,
      due: Date.now(),
    }))
    updateDb((d) => ({
      ...d,
      notes: [
        ...d.notes,
        {
          id,
          examId: exam.id,
          title: organized.title,
          topic: topic || organized.topic,
          createdAt: Date.now(),
          sources: files.map((f) => f.name),
          raw: text,
          organized,
        },
      ],
      flashcards: [...d.flashcards, ...cards],
    }))
    toast(`Notes organised · ${cards.length} flashcards added`)
    navigate(`../notes/${id}`)
  }

  const saveRaw = () => {
    const id = uid()
    updateDb((d) => ({
      ...d,
      notes: [
        ...d.notes,
        {
          id,
          examId: exam.id,
          title: hint.trim() || text.trim().split('\n')[0].slice(0, 60) || 'Untitled note',
          topic: topic || 'General',
          createdAt: Date.now(),
          sources: [],
          raw: text,
          organized: null,
        },
      ],
    }))
    toast('Note saved')
    navigate(`../notes/${id}`)
  }

  return (
    <AnimatePresence mode="wait">
      {task.running ? (
        <AiWorking key="w" title="Organising your notes" progress={task.progress} onStop={task.stop} />
      ) : (
        <motion.div key="f" {...fadeUp}>
          <Card className="stack lg">
            <div className="stack sm">
              <h2>Add notes</h2>
              <p className="muted small">
                Paste typed notes, or upload PDFs, slides exported as PDF, or photos of handwritten pages. Add one chapter or topic at a time
                for the best results.
              </p>
            </div>
            <div className="grid grid-2">
              <div className="field">
                <label htmlFor="n-topic">Syllabus topic</label>
                <select id="n-topic" className="select" value={topic} onChange={(e) => setTopic(e.target.value)}>
                  <option value="">Let the AI decide</option>
                  {topics.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="n-hint">What are these notes? <span className="hint">(optional)</span></label>
                <input id="n-hint" className="input" placeholder="e.g. Chapter 4 – Thermodynamics lecture notes" value={hint} onChange={(e) => setHint(e.target.value)} />
              </div>
            </div>
            <FileDrop files={files} onChange={setFiles} label="Upload notes: PDFs, photos, text files" />
            <div className="field">
              <label htmlFor="n-text">…or paste notes</label>
              <textarea id="n-text" className="textarea" style={{ minHeight: 220 }} placeholder="Paste your notes here" value={text} onChange={(e) => setText(e.target.value)} />
            </div>
            <ErrorAlert error={task.error} />
            <div className="row">
              <Button variant="primary" size="lg" disabled={!files.length && text.trim().length < 10} onClick={organise}>
                <Sparkles size={18} /> Organise with AI
              </Button>
              <Button variant="ghost" disabled={text.trim().length < 2} onClick={saveRaw}>
                <Save size={16} /> Save as-is
              </Button>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
