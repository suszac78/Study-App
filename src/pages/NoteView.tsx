import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, Brain, Calculator, CheckCircle2, Layers, Lightbulb, MessageCircle, Sparkles, Trash2, TriangleAlert, Wand2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ask, AiWorking, Badge, Button, Card, ErrorAlert, Markdown, stagger, staggerItem, toast, useAiTask } from '../components/ui'
import { generateFlashcards, organizeNotes } from '../lib/ai'
import { uid, updateDb, useDb } from '../lib/store'
import { timeAgo } from '../lib/utils'
import { useExam } from './ExamLayout'

function Block({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Card className="stack" variants={staggerItem}>
      <div className="row" style={{ gap: 10 }}>
        <div className="feature-icon" style={{ width: 34, height: 34, borderRadius: 10 }}>{icon}</div>
        <h3>{title}</h3>
      </div>
      {children}
    </Card>
  )
}

export default function NoteView() {
  const exam = useExam()
  const { noteId } = useParams()
  const db = useDb()
  const navigate = useNavigate()
  const task = useAiTask()
  const [showRaw, setShowRaw] = useState(false)
  const note = db.notes.find((n) => n.id === noteId)

  if (!note) {
    return (
      <Card className="empty">
        <h3>Note not found</h3>
        <Link to="../notes"><Button>Back to notes</Button></Link>
      </Card>
    )
  }
  const o = note.organized

  const organise = async () => {
    const organized = await task.run((opts) => organizeNotes(exam, { text: note.raw, files: [] }, note.title, opts))
    if (!organized) return
    updateDb((d) => ({
      ...d,
      notes: d.notes.map((n) => (n.id === note.id ? { ...n, organized, title: organized.title, topic: organized.topic } : n)),
      flashcards: [
        ...d.flashcards,
        ...organized.flashcards.map((c) => ({ id: uid(), examId: exam.id, front: c.front, back: c.back, topic: organized.topic, box: 1, due: Date.now() })),
      ],
    }))
    toast('Note organised')
  }

  const moreCards = async () => {
    const res = await task.run((opts) => generateFlashcards(exam, note, opts))
    if (!res) return
    updateDb((d) => ({
      ...d,
      flashcards: [...d.flashcards, ...res.cards.map((c) => ({ id: uid(), examId: exam.id, front: c.front, back: c.back, topic: c.topic || note.topic, box: 1, due: Date.now() }))],
    }))
    toast(`${res.cards.length} flashcards added`)
  }

  const remove = async () => {
    if (!(await ask('Delete this note?'))) return
    updateDb((d) => ({ ...d, notes: d.notes.filter((n) => n.id !== note.id) }))
    navigate('../notes')
  }

  return (
    <div className="stack lg">
      <div className="row between">
        <Link to="../notes" className="row small" style={{ gap: 6 }}>
          <ArrowLeft size={16} /> All notes
        </Link>
        <div className="row">
          <Button size="sm" variant="secondary" onClick={() => navigate('../practice', { state: { topic: note.topic } })}>
            <Brain size={14} /> Quiz me on this
          </Button>
          <Button size="sm" variant="secondary" onClick={() => navigate('../tutor', { state: { prompt: `Help me understand my note "${note.title}". Start with the hardest idea in it.` } })}>
            <MessageCircle size={14} /> Ask tutor
          </Button>
          <Button size="sm" variant="ghost" onClick={remove} aria-label="Delete note">
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      <div className="stack sm">
        <div className="row" style={{ gap: 8 }}>
          <Badge>{note.topic}</Badge>
          <span className="subtle xs">{timeAgo(note.createdAt)}</span>
          {note.sources.length > 0 && <span className="subtle xs">· from {note.sources.join(', ')}</span>}
        </div>
        <h2>{note.title}</h2>
      </div>

      <ErrorAlert error={task.error} />

      <AnimatePresence mode="wait">
        {task.running ? (
          <AiWorking key="w" title="Working on your note" progress={task.progress} onStop={task.stop} />
        ) : !o ? (
          <motion.div key="raw" className="stack">
            <Card className="stack">
              <div className="row between">
                <h3>Your note</h3>
                <Button variant="primary" size="sm" onClick={organise}>
                  <Wand2 size={14} /> Organise with AI
                </Button>
              </div>
              <Markdown>{note.raw}</Markdown>
            </Card>
          </motion.div>
        ) : (
          <motion.div key="org" className="stack lg" variants={stagger} initial="initial" animate="animate">
            <Card className="stack" variants={staggerItem} style={{ background: 'linear-gradient(135deg, var(--primary-soft), var(--surface))' }}>
              <span className="eyebrow">Summary</span>
              <p style={{ fontSize: 'var(--fs-lg)' }}>{o.summary}</p>
            </Card>

            {o.keyPoints.length > 0 && (
              <Block icon={<CheckCircle2 size={17} />} title="Key points">
                <ul className="check-list">
                  {o.keyPoints.map((k) => (
                    <li key={k}>
                      <CheckCircle2 size={15} />
                      <div className="md"><Markdown>{k}</Markdown></div>
                    </li>
                  ))}
                </ul>
              </Block>
            )}

            {o.sections.map((s) => (
              <Card key={s.heading} className="stack" variants={staggerItem}>
                <h3>{s.heading}</h3>
                <Markdown>{s.content}</Markdown>
              </Card>
            ))}

            <div className="grid grid-2">
              {o.definitions.length > 0 && (
                <Block icon={<Sparkles size={17} />} title="Definitions">
                  <dl className="stack sm" style={{ margin: 0 }}>
                    {o.definitions.map((d) => (
                      <div key={d.term}>
                        <dt><strong>{d.term}</strong></dt>
                        <dd style={{ margin: 0 }} className="muted small"><Markdown>{d.meaning}</Markdown></dd>
                      </div>
                    ))}
                  </dl>
                </Block>
              )}
              {o.formulas.length > 0 && (
                <Block icon={<Calculator size={17} />} title="Formulas">
                  <div className="stack">
                    {o.formulas.map((f) => (
                      <div key={f.name} className="explain stack sm">
                        <strong className="small">{f.name}</strong>
                        <Markdown>{f.expression.includes('$') ? f.expression : `$$${f.expression}$$`}</Markdown>
                        {f.note && <span className="subtle">{f.note}</span>}
                      </div>
                    ))}
                  </div>
                </Block>
              )}
              {o.mnemonics.length > 0 && (
                <Block icon={<Lightbulb size={17} />} title="Memory tricks">
                  <ul className="check-list small">
                    {o.mnemonics.map((m) => (
                      <li key={m}><Lightbulb size={15} /><span>{m}</span></li>
                    ))}
                  </ul>
                </Block>
              )}
              {o.examTips.length > 0 && (
                <Block icon={<Sparkles size={17} />} title="Exam tips">
                  <ul className="check-list small">
                    {o.examTips.map((m) => (
                      <li key={m}><Sparkles size={15} /><span>{m}</span></li>
                    ))}
                  </ul>
                </Block>
              )}
            </div>

            {o.gaps.length > 0 && (
              <Card className="stack" variants={staggerItem} style={{ borderColor: 'color-mix(in srgb, var(--warning) 40%, transparent)' }}>
                <div className="row" style={{ gap: 8 }}>
                  <TriangleAlert size={18} color="var(--warning)" />
                  <h3>Gaps to fill</h3>
                </div>
                <p className="subtle">Syllabus areas these notes don't cover yet:</p>
                <div className="chip-group">
                  {o.gaps.map((g) => (
                    <Badge key={g} tone="warning">{g}</Badge>
                  ))}
                </div>
              </Card>
            )}

            <Card className="row between flat" variants={staggerItem}>
              <div className="row" style={{ gap: 10 }}>
                <Layers size={18} color="var(--primary)" />
                <span>{o.flashcards.length} flashcards were added to your deck.</span>
              </div>
              <div className="row">
                <Button size="sm" variant="secondary" onClick={moreCards}>More flashcards</Button>
                <Button size="sm" variant="primary" onClick={() => navigate('../flashcards')}>Study them</Button>
              </div>
            </Card>

            {note.raw && (
              <div>
                <Button size="sm" variant="ghost" onClick={() => setShowRaw((s) => !s)}>
                  {showRaw ? 'Hide' : 'Show'} original text
                </Button>
                {showRaw && (
                  <Card className="flat" style={{ marginTop: 8 }}>
                    <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }} className="small muted">{note.raw}</pre>
                  </Card>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
