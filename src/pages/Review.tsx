import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle2, ClipboardCheck, Pencil, Repeat, Save, Sparkles, Target, TrendingUp, TriangleAlert } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AiWorking, Badge, Button, Card, ErrorAlert, FileDrop, fadeUp, stagger, staggerItem, toast, useAiTask } from '../components/ui'
import { analyzeResult } from '../lib/ai'
import { pathLabel, relatedExams } from '../lib/folders'
import { updateDb, useDb } from '../lib/store'
import type { ExamResult } from '../lib/types'
import { timeAgo } from '../lib/utils'
import { useExam } from './ExamLayout'

function Block({ icon, title, tone, children }: { icon: ReactNode; title: string; tone?: string; children: ReactNode }) {
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

export default function Review() {
  const exam = useExam()
  const db = useDb()
  const navigate = useNavigate()
  const task = useAiTask()
  const r = exam.result
  const [editing, setEditing] = useState(!r)
  const [score, setScore] = useState(r?.score ?? '')
  const [grade, setGrade] = useState(r?.grade ?? '')
  const [feedback, setFeedback] = useState(r?.feedback ?? '')
  const [notes, setNotes] = useState(r?.notes ?? '')
  const [files, setFiles] = useState<File[]>([])

  const earlier = relatedExams(db, exam).filter((e) => e.result?.analysis)

  const save = (analysis: ExamResult['analysis'] | undefined) => {
    const result: ExamResult = {
      score: score.trim(),
      grade: grade.trim(),
      feedback: feedback.trim(),
      notes: notes.trim(),
      sources: files.length ? files.map((f) => f.name) : (r?.sources ?? []),
      analysis: analysis === undefined ? (r?.analysis ?? null) : analysis,
      updatedAt: Date.now(),
    }
    updateDb((d) => ({ ...d, exams: d.exams.map((e) => (e.id === exam.id ? { ...e, result } : e)) }))
  }

  const analyse = async () => {
    const analysis = await task.run((o) => analyzeResult(exam, { score, grade, feedback, notes }, files, o))
    if (!analysis) return
    save(analysis)
    setFiles([])
    setEditing(false)
    toast('Result analysed. Lessons saved for next time.')
  }

  const hasInput = score.trim() || grade.trim() || feedback.trim() || notes.trim() || files.length

  if (task.running) return <AiWorking title="Reviewing your paper and result" progress={task.progress} onStop={task.stop} />

  const a = r?.analysis

  return (
    <div className="stack lg">
      {earlier.length > 0 && (
        <div className="alert info">
          <Repeat size={16} />
          <span>
            Lessons from {earlier.length} earlier assessment{earlier.length > 1 ? 's' : ''} in this subject (
            {earlier.map((e) => `${pathLabel(db, e.folderId)} › ${e.name}`).join(', ')}) are already being used in your quizzes, tips, coach and
            tutor for this exam.
          </span>
        </div>
      )}

      <AnimatePresence mode="wait">
        {editing ? (
          <motion.div key="form" {...fadeUp}>
            <Card className="stack lg">
              <div className="row" style={{ gap: 12 }}>
                <div className="feature-icon"><ClipboardCheck size={20} /></div>
                <div className="stack sm grow">
                  <h2>Your result</h2>
                  <p className="subtle">
                    Got your mark back? Add it with the marked paper. The AI works out where the marks went and what to do differently next time,
                    and remembers it for your next assessment in this subject.
                  </p>
                </div>
              </div>
              <div className="grid grid-2">
                <div className="field">
                  <label htmlFor="res-score">Mark / score</label>
                  <input id="res-score" className="input" placeholder="e.g. 34/50 or 72%" value={score} onChange={(e) => setScore(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="res-grade">Grade <span className="hint">(optional)</span></label>
                  <input id="res-grade" className="input" placeholder="e.g. B+, 6, Merit" value={grade} onChange={(e) => setGrade(e.target.value)} />
                </div>
              </div>
              <FileDrop files={files} onChange={setFiles} label="Upload your marked paper: photos of each page or a PDF" />
              <div className="field">
                <label htmlFor="res-feedback">Teacher feedback <span className="hint">(optional)</span></label>
                <textarea id="res-feedback" className="textarea" style={{ minHeight: 90 }} placeholder="Comments from your teacher or the marking rubric" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="res-notes">Your own thoughts <span className="hint">(optional)</span></label>
                <textarea id="res-notes" className="textarea" style={{ minHeight: 80 }} placeholder="e.g. Ran out of time on the last section, didn't revise genetics enough" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <ErrorAlert error={task.error} />
              <div className="row">
                <Button variant="primary" size="lg" disabled={!hasInput} onClick={analyse}>
                  <Sparkles size={18} /> Save and analyse with AI
                </Button>
                <Button
                  variant="ghost"
                  disabled={!hasInput}
                  onClick={() => {
                    save(undefined)
                    setEditing(false)
                    toast('Result saved')
                  }}
                >
                  <Save size={16} /> Save without AI
                </Button>
                {r && <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>}
              </div>
              {r?.sources.length ? <span className="hint">Previously analysed with: {r.sources.join(', ')}. Upload again to include the paper in a new analysis.</span> : null}
            </Card>
          </motion.div>
        ) : (
          r && (
            <motion.div key="view" className="stack lg" variants={stagger} initial="initial" animate="animate">
              <Card className="row between" variants={staggerItem} style={{ background: 'linear-gradient(135deg, var(--primary-soft), var(--surface))' }}>
                <div className="stack sm grow">
                  <span className="eyebrow">Result · {timeAgo(r.updatedAt)}</span>
                  <div className="row" style={{ gap: 12, alignItems: 'baseline' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--fs-2xl)' }}>{r.score || '—'}</span>
                    {r.grade && <Badge>{r.grade}</Badge>}
                  </div>
                  {a && <p style={{ fontSize: 'var(--fs-lg)' }}>{a.headline}</p>}
                  {a && <span className="subtle">{a.scoreRead}</span>}
                </div>
                <div className="row">
                  <Button size="sm" variant="secondary" onClick={() => setEditing(true)}><Pencil size={14} /> Edit</Button>
                  {!a && (
                    <Button size="sm" variant="primary" onClick={analyse}><Sparkles size={14} /> Analyse with AI</Button>
                  )}
                </div>
              </Card>
              <ErrorAlert error={task.error} />

              {a && (
                <>
                  <div className="grid grid-2">
                    <Block icon={<TrendingUp size={17} />} title="What went well" tone="success">
                      <ul className="check-list small">
                        {a.strengths.map((s) => <li key={s}><CheckCircle2 size={15} color="var(--success)" /><span>{s}</span></li>)}
                      </ul>
                    </Block>
                    <Block icon={<Target size={17} />} title="Next time" tone="accent">
                      <ul className="check-list small">
                        {a.nextTime.map((s) => <li key={s}><Target size={15} color="var(--accent)" /><span>{s}</span></li>)}
                      </ul>
                    </Block>
                  </div>

                  {a.lostMarks.length > 0 && (
                    <Block icon={<TriangleAlert size={17} />} title="Where the marks went" tone="danger">
                      <div className="stack">
                        {a.lostMarks.map((l) => (
                          <div key={l.area + l.why} className="explain stack sm">
                            <div className="row between">
                              <strong className="small">{l.area}</strong>
                              <Badge tone="danger">−{l.marksLost.replace(/^-/, '')}</Badge>
                            </div>
                            <span className="small">{l.why}</span>
                            <span className="small muted">→ {l.fix}</span>
                          </div>
                        ))}
                      </div>
                    </Block>
                  )}

                  <div className="grid grid-2">
                    {a.patterns.length > 0 && (
                      <Block icon={<Repeat size={17} />} title="Habits to watch">
                        <ul className="check-list small">
                          {a.patterns.map((s) => <li key={s}><Repeat size={15} /><span>{s}</span></li>)}
                        </ul>
                      </Block>
                    )}
                    {a.examTechnique.length > 0 && (
                      <Block icon={<Sparkles size={17} />} title="Exam technique">
                        <ul className="check-list small">
                          {a.examTechnique.map((s) => <li key={s}><Sparkles size={15} /><span>{s}</span></li>)}
                        </ul>
                      </Block>
                    )}
                  </div>

                  {a.topicsToRevise.length > 0 && (
                    <Card className="stack" variants={staggerItem}>
                      <h3>Topics to revise</h3>
                      <div className="chip-group">
                        {a.topicsToRevise.map((t) => (
                          <button key={t} className="chip" onClick={() => navigate('../practice', { state: { topic: t } })}>{t}</button>
                        ))}
                      </div>
                      <span className="hint">Tap a topic to make a practice quiz on it.</span>
                    </Card>
                  )}

                  <div className="alert info">
                    <span>
                      Saved for next time. These lessons are used automatically for other assessments in{' '}
                      {exam.folderId ? <strong>{pathLabel(db, exam.folderId)}</strong> : 'the same folder'}
                      {exam.folderId ? ' and folders with the same subject name in other years.' : '. Put this exam in a subject folder (Overview → Exam settings) so they carry over.'}{' '}
                      <Link to="../tips">Update your study plan</Link>
                    </span>
                  </div>
                </>
              )}
            </motion.div>
          )
        )}
      </AnimatePresence>
    </div>
  )
}
