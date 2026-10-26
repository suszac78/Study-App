import { motion } from 'motion/react'
import { BookOpen, PackageOpen, Plus, Search, Sparkles, Square } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useBatchOrganize } from '../components/useBatchOrganize'
import { Badge, Button, Empty, ErrorAlert, Meter, stagger, staggerItem } from '../components/ui'
import { useDb } from '../lib/store'
import { timeAgo } from '../lib/utils'
import { useExam } from './ExamLayout'

export default function NotesList() {
  const exam = useExam()
  const db = useDb()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const batch = useBatchOrganize(exam)

  const notes = useMemo(() => db.notes.filter((n) => n.examId === exam.id), [db.notes, exam.id])
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return notes
    return notes.filter((n) => [n.title, n.topic, n.raw, n.organized?.summary ?? ''].join(' ').toLowerCase().includes(s))
  }, [notes, q])

  // Group by syllabus topic, in syllabus order, then any others.
  const groups = useMemo(() => {
    const order = exam.info?.syllabus.map((s) => s.topic) ?? []
    const map = new Map<string, typeof filtered>()
    for (const n of filtered) map.set(n.topic || 'General', [...(map.get(n.topic || 'General') ?? []), n])
    return [...map.entries()].sort((a, b) => {
      const ia = order.indexOf(a[0])
      const ib = order.indexOf(b[0])
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib)
    })
  }, [filtered, exam.info])

  const raw = notes.filter((n) => !n.organized)
  const missing = (exam.info?.syllabus ?? []).filter((t) => !notes.some((n) => n.topic === t.topic))

  if (!notes.length) {
    return (
      <Empty
        icon={<BookOpen size={26} />}
        title="No notes yet"
        action={
          <div className="row" style={{ justifyContent: 'center' }}>
            <Button variant="primary" onClick={() => navigate('new')}>
              <Plus size={16} /> Add notes
            </Button>
            <Button variant="secondary" onClick={() => navigate('import')}>
              <PackageOpen size={16} /> Import course (EPUB / Canvas)
            </Button>
          </div>
        }
      >
        Paste notes, upload PDFs, Word, slides or photos of handwritten pages, or import whole course EPUBs or a Canvas export. The AI turns them into clean
        notes, flashcards and exam tips.
      </Empty>
    )
  }

  return (
    <div className="stack lg">
      <div className="row between">
        <div className="row nowrap grow" style={{ maxWidth: 420, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 14, color: 'var(--text-3)' }} />
          <input className="input" style={{ paddingLeft: 40 }} placeholder="Search notes" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search notes" />
        </div>
        <div className="row">
          <Button variant="secondary" onClick={() => navigate('import')}>
            <PackageOpen size={16} /> Import course
          </Button>
          <Button variant="primary" onClick={() => navigate('new')}>
            <Plus size={16} /> Add notes
          </Button>
        </div>
      </div>

      {(raw.length > 0 || batch.running) && (
        <div className="card tight flat stack sm">
          {batch.running ? (
            <>
              <div className="row between small">
                <span className="shimmer-text">Organising {batch.done + 1} of {batch.total}: {batch.current}</span>
                <Button size="sm" variant="ghost" onClick={batch.stop}><Square size={14} /> Stop</Button>
              </div>
              <Meter value={batch.total ? batch.done / batch.total : 0} tone="" />
            </>
          ) : (
            <div className="row between small">
              <span>{raw.length} note{raw.length === 1 ? ' is' : 's are'} not organised yet ({raw.length} AI request{raw.length === 1 ? '' : 's'}).</span>
              <Button size="sm" variant="secondary" onClick={() => batch.start(raw.map((n) => n.id))}>
                <Sparkles size={14} /> Organise all with AI
              </Button>
            </div>
          )}
          <ErrorAlert error={batch.error} />
        </div>
      )}

      {groups.map(([topic, list]) => (
        <section key={topic} className="stack">
          <div className="row" style={{ gap: 8 }}>
            <h3>{topic}</h3>
            <Badge tone="neutral">{list.length}</Badge>
          </div>
          <motion.div className="grid grid-3" variants={stagger} initial="initial" animate="animate">
            {list.map((n) => (
              <motion.div key={n.id} variants={staggerItem} whileHover={{ y: -3 }}>
                <Link to={n.id} className="card interactive stack sm" style={{ color: 'inherit', textDecoration: 'none', height: '100%' }}>
                  <h4>{n.title}</h4>
                  <p className="subtle" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {n.organized?.summary ?? n.raw.slice(0, 200)}
                  </p>
                  <div className="row xs subtle" style={{ marginTop: 'auto' }}>
                    {n.organized ? <Badge tone="success">Organised</Badge> : <Badge tone="neutral">Raw</Badge>}
                    <span>{timeAgo(n.createdAt)}</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </section>
      ))}

      {missing.length > 0 && !q && (
        <div className="alert info">
          <span>
            <strong>Topics without notes yet:</strong> {missing.map((m) => m.topic).join(' · ')}
          </span>
        </div>
      )}
    </div>
  )
}
