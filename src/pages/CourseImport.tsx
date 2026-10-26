import { AnimatePresence, motion } from 'motion/react'
import { BookOpenCheck, Check, FolderOpen, PackageOpen, Save, Sparkles, Square } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBatchOrganize } from '../components/useBatchOrganize'
import { AiWorking, Badge, Button, Card, ErrorAlert, Meter, fadeUp, toast, useAiTask } from '../components/ui'
import { analyzeExam } from '../lib/ai'
import { KIND_LABEL, moduleToParts, parseCourse, type ParsedCourse } from '../lib/course'
import { uid, updateDb } from '../lib/store'
import type { Note } from '../lib/types'
import { useExam } from './ExamLayout'

export const PLACEHOLDER_EXAM_NAME = 'New course'

const kb = (chars: number) => (chars > 1000 ? `${Math.round(chars / 1000)}k chars` : `${chars} chars`)

export default function CourseImport() {
  const exam = useExam()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [course, setCourse] = useState<ParsedCourse | null>(null)
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [useSyllabus, setUseSyllabus] = useState(true)
  const [savedIds, setSavedIds] = useState<string[] | null>(null)
  const [over, setOver] = useState(false)
  const batch = useBatchOrganize(exam)
  const syllabusTask = useAiTask()

  const read = async (files: File[]) => {
    if (!files.length) return
    setError(null)
    setCourse(null)
    setSavedIds(null)
    try {
      const parsed = await parseCourse(files, setStatus)
      setCourse(parsed)
      setPicked(new Set(parsed.modules.map((_, i) => i)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file.')
    } finally {
      setStatus(null)
    }
  }

  const sizes = useMemo(() => course?.modules.map((m) => m.items.reduce((s, it) => s + it.text.length, 0)) ?? [], [course])
  const selectedChars = [...picked].reduce((s, i) => s + (sizes[i] ?? 0), 0)

  const save = async (organise: boolean) => {
    if (!course) return
    const notes: Note[] = []
    for (const i of [...picked].sort((a, b) => a - b)) {
      const mod = course.modules[i]
      const parts = moduleToParts(mod)
      parts.forEach((raw, p) => {
        notes.push({
          id: uid(),
          examId: exam.id,
          title: parts.length > 1 ? `${mod.title} (part ${p + 1} of ${parts.length})` : mod.title,
          topic: mod.title,
          createdAt: Date.now() + notes.length,
          sources: [...new Set(mod.items.map((it) => it.path.split('/').pop() ?? it.path))].slice(0, 12),
          raw,
          organized: null,
        })
      })
    }
    updateDb((d) => ({
      ...d,
      exams: d.exams.map((e) => (e.id === exam.id && e.name === PLACEHOLDER_EXAM_NAME ? { ...e, name: course.title } : e)),
      notes: [...d.notes, ...notes],
    }))
    const ids = notes.map((n) => n.id)
    setSavedIds(ids)
    toast(`${notes.length} notes saved from ${course.title}`)

    if (useSyllabus && course.syllabus && !exam.info) {
      const info = await syllabusTask.run((o) => analyzeExam({ text: `Course: ${course.title}\n\nCourse syllabus:\n${course.syllabus}`, files: [] }, o))
      if (info) {
        updateDb((d) => ({
          ...d,
          exams: d.exams.map((e) =>
            e.id === exam.id ? { ...e, info, examDate: e.examDate || (/^\d{4}-\d{2}-\d{2}$/.test(info.examDate) ? info.examDate : '') } : e,
          ),
        }))
      }
    }
    if (organise) batch.start(ids)
  }

  // ----- views -----

  if (syllabusTask.running) return <AiWorking title="Reading the course syllabus" progress={syllabusTask.progress} onStop={syllabusTask.stop} />

  if (savedIds) {
    const pctDone = batch.total ? batch.done / batch.total : 1
    return (
      <motion.div className="stack lg" {...fadeUp}>
        <Card className="stack">
          <div className="row" style={{ gap: 10 }}>
            <div className="feature-icon" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
              <Check size={20} />
            </div>
            <div className="stack sm grow">
              <h2>{course?.title} imported</h2>
              <p className="subtle">{savedIds.length} notes saved. You can quiz yourself and chat with the tutor about them right away.</p>
            </div>
          </div>
          <ErrorAlert error={syllabusTask.error} />
          {batch.running && (
            <div className="stack sm">
              <div className="row between small">
                <span className="shimmer-text">Organising {batch.done + 1} of {batch.total}: {batch.current}</span>
                <Button size="sm" variant="ghost" onClick={batch.stop}>
                  <Square size={14} /> Stop
                </Button>
              </div>
              <Meter value={pctDone} tone="" />
              <span className="hint">Each module is one AI request. Keep this page open until it finishes. If you leave, finished modules are kept and you can organise the rest from Notes.</span>
            </div>
          )}
          {!batch.running && batch.total > 0 && (
            <p className="small">
              Organised {batch.done - batch.failed.length} of {batch.total} notes with AI.
              {batch.failed.length > 0 && ` Couldn't organise: ${batch.failed.join(', ')}.`}
            </p>
          )}
          <ErrorAlert error={batch.error} />
          <div className="row">
            <Button variant="primary" onClick={() => navigate('../notes')}>
              <BookOpenCheck size={16} /> Go to notes
            </Button>
            {!batch.running && batch.done < savedIds.length && (
              <Button variant="secondary" onClick={() => batch.start(savedIds)}>
                <Sparkles size={16} /> Organise {batch.total ? 'the rest' : 'all'} with AI
              </Button>
            )}
            <Button variant="ghost" onClick={() => navigate('../practice')}>Make a quiz</Button>
          </div>
        </Card>
      </motion.div>
    )
  }

  return (
    <div className="stack lg">
      <Card className="stack lg">
        <div className="row" style={{ gap: 12 }}>
          <div className="feature-icon"><PackageOpen size={20} /></div>
          <div className="stack sm grow">
            <h2>Import a whole course</h2>
            <p className="subtle">
              Add your course EPUB books (one or several at once), a Canvas course export (.imscc), a .zip, or a folder. Each book chapter or
              course module becomes its own set of notes. PDFs, Word, PowerPoint and quiz questions are read too.
            </p>
          </div>
        </div>

        <details className="small">
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Where do I get these files?</summary>
          <ol className="muted" style={{ marginTop: 8, paddingLeft: 20 }}>
            <li><strong>EPUB course books:</strong> download each .epub from Canvas (or your course's book link) and drop them all here together. Books locked to an e-reader app (DRM) can't be read; StudyPilot will tell you if one is.</li>
            <li>Open the course in Canvas and go to <strong>Settings → Export Course Content</strong>, choose <strong>Course</strong>, then <strong>Create Export</strong>. Download the .imscc file when it's ready.</li>
            <li>If you're a student and don't see Settings: open <strong>Files</strong>, select everything and choose <strong>Download</strong> (a .zip), or use <strong>Download Course Content</strong> in the course menu if your school has it turned on.</li>
            <li>You can also add a .zip from any other learning platform, or a folder of slides and PDFs.</li>
          </ol>
        </details>

        <div
          className={`dropzone ${over ? 'over' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOver(false)
            read(Array.from(e.dataTransfer.files))
          }}
        >
          <div className="stack sm" style={{ alignItems: 'center' }}>
            <PackageOpen size={26} color="var(--primary)" />
            <strong>Drop your course EPUBs or export here</strong>
            <span className="hint">.epub, .imscc or .zip · several files at once is fine</span>
          </div>
          <input ref={fileRef} type="file" multiple hidden accept=".epub,.imscc,.zip,.pdf,.docx,.pptx,.html,.htm,.txt,.md" onChange={(e) => { read(Array.from(e.target.files ?? [])); e.target.value = '' }} />
        </div>
        <div className="row">
          <Button variant="ghost" size="sm" onClick={() => folderRef.current?.click()}>
            <FolderOpen size={14} /> Choose a folder instead
          </Button>
          <input
            ref={folderRef}
            type="file"
            hidden
            multiple
            {...({ webkitdirectory: '' } as Record<string, string>)}
            onChange={(e) => { read(Array.from(e.target.files ?? [])); e.target.value = '' }}
          />
        </div>
        {status && <p className="shimmer-text small" aria-live="polite">{status}</p>}
        <ErrorAlert error={error} />
      </Card>

      <AnimatePresence>
        {course && (
          <motion.div className="stack lg" {...fadeUp}>
            <Card className="stack">
              <div className="row between">
                <div className="stack sm">
                  <span className="eyebrow">Found</span>
                  <h2>{course.title}</h2>
                  {course.warnings.length > 0 && (
                    <div className="alert warn" role="alert"><span>{course.warnings.join(' ')}</span></div>
                  )}
                  <span className="subtle">
                    {course.modules.length} sections · {course.modules.reduce((s, m) => s + m.items.length, 0)} items
                    {course.skipped > 0 && ` · ${course.skipped} files had no readable text (scans, images or media)`}
                  </span>
                </div>
                <div className="row">
                  <Button size="sm" variant="ghost" onClick={() => setPicked(new Set(course.modules.map((_, i) => i)))}>Select all</Button>
                  <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>Clear</Button>
                </div>
              </div>

              <div className="list">
                {course.modules.map((m, i) => {
                  const kinds = [...new Set(m.items.map((it) => KIND_LABEL[it.kind]))]
                  return (
                    <label key={m.title + i} className="list-item" style={{ cursor: 'pointer', alignItems: 'flex-start' }}>
                      <input
                        type="checkbox"
                        id={`mod-${i}`}
                        checked={picked.has(i)}
                        onChange={(e) =>
                          setPicked((p) => {
                            const n = new Set(p)
                            if (e.target.checked) n.add(i)
                            else n.delete(i)
                            return n
                          })
                        }
                        style={{ marginTop: 5, accentColor: 'var(--primary)' }}
                      />
                      <div className="stack sm grow">
                        <strong className="small">{m.title}</strong>
                        <span className="subtle xs">{m.items.map((it) => it.title).slice(0, 6).join(' · ')}{m.items.length > 6 ? ` · +${m.items.length - 6} more` : ''}</span>
                      </div>
                      <div className="stack sm" style={{ alignItems: 'flex-end', flex: 'none' }}>
                        <Badge tone="neutral">{m.items.length} items</Badge>
                        <span className="subtle xs">{kinds.join(', ')} · {kb(sizes[i])}</span>
                      </div>
                    </label>
                  )
                })}
              </div>
            </Card>

            <Card className="stack">
              {course.syllabus && !exam.info && (
                <label className="row small" style={{ gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" id="use-syllabus" checked={useSyllabus} onChange={(e) => setUseSyllabus(e.target.checked)} style={{ accentColor: 'var(--primary)' }} />
                  Use the course syllabus to fill in the exam topics and dates (1 AI request)
                </label>
              )}
              <div className="alert info">
                <span>
                  <strong>Save notes</strong> uses no AI: you can start quizzes and the tutor straight away. <strong>Save and organise</strong> also
                  rewrites each module into clean notes with flashcards, using one AI request per module ({[...picked].reduce((s, i) => s + moduleToParts(course.modules[i]).length, 0)} requests, ~{kb(selectedChars)} of text).
                </span>
              </div>
              <div className="row">
                <Button variant="primary" size="lg" disabled={!picked.size} onClick={() => save(true)}>
                  <Sparkles size={18} /> Save and organise with AI
                </Button>
                <Button variant="secondary" size="lg" disabled={!picked.size} onClick={() => save(false)}>
                  <Save size={18} /> Save notes only
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
