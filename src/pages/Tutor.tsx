import { AnimatePresence, motion } from 'motion/react'
import { Eraser, Send, Sparkles, Square } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Button, ErrorAlert, Markdown, ask } from '../components/ui'
import { AiError, tutorReply } from '../lib/ai'
import { uid, updateDb, useDb } from '../lib/store'
import type { ChatMessage } from '../lib/types'
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
  const history = useMemo(() => db.chats[exam.id] ?? [], [db.chats, exam.id])
  const notes = useMemo(() => db.notes.filter((n) => n.examId === exam.id), [db.notes, exam.id])
  const [input, setInput] = useState((location.state as { prompt?: string } | null)?.prompt ?? '')
  const [streaming, setStreaming] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ctl = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => () => ctl.current?.abort(), [])
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [history.length, streaming])
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [input])

  const setChat = (msgs: ChatMessage[]) => updateDb((d) => ({ ...d, chats: { ...d.chats, [exam.id]: msgs } }))

  const send = async (text: string) => {
    const t = text.trim()
    if (!t || streaming !== null) return
    const next = [...history, { id: uid(), role: 'user' as const, text: t }]
    setChat(next)
    setInput('')
    setError(null)
    setStreaming('')
    const c = new AbortController()
    ctl.current = c
    try {
      const res = await tutorReply(exam, notes, next, setStreaming, c.signal)
      setChat([...next, { id: uid(), role: 'assistant', text: res.text, blocks: res.blocks }])
    } catch (e) {
      if (!(e instanceof AiError && e.code === 'cancelled')) setError(e instanceof Error ? e.message : 'Something went wrong.')
      // Drop the unanswered question so history stays user/assistant pairs.
      setChat(history)
      setInput(t)
    } finally {
      setStreaming(null)
    }
  }

  return (
    <div className="stack lg" style={{ minHeight: '60vh' }}>
      <div className="row between">
        <div className="stack sm">
          <h2>AI tutor</h2>
          <p className="subtle">Knows your exam pattern, syllabus and all {notes.length} of your notes.</p>
        </div>
        {history.length > 0 && (
          <Button size="sm" variant="ghost" onClick={async () => (await ask('Clear this conversation?')) && setChat([])}>
            <Eraser size={14} /> Clear chat
          </Button>
        )}
      </div>

      <div className="chat" aria-live="polite">
        {history.length === 0 && streaming === null && (
          <motion.div className="stack" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="bubble assistant">
              <p>
                Hi! I'm your tutor for <strong>{exam.name}</strong>. Ask me to explain anything, quiz you, make a summary, or plan your revision.
              </p>
            </div>
            <div className="chip-group">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </motion.div>
        )}
        <AnimatePresence initial={false}>
          {history.map((m) => (
            <motion.div key={m.id} className={`bubble ${m.role}`} initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.25 }}>
              {m.role === 'assistant' ? <Markdown>{m.text}</Markdown> : m.text}
            </motion.div>
          ))}
        </AnimatePresence>
        {streaming !== null && (
          <motion.div className="bubble assistant" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {streaming ? (
              <Markdown>{streaming}</Markdown>
            ) : (
              <span className="row shimmer-text small" style={{ gap: 6 }}>
                <Sparkles size={14} /> Thinking…
              </span>
            )}
          </motion.div>
        )}
        <div ref={endRef} />
      </div>

      <ErrorAlert error={error} />

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
      >
        <textarea
          ref={boxRef}
          rows={1}
          placeholder="Ask anything about your exam or notes…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send(input)
            }
          }}
          aria-label="Message the tutor"
        />
        {streaming !== null ? (
          <Button type="button" variant="secondary" icon onClick={() => ctl.current?.abort()} aria-label="Stop">
            <Square size={16} />
          </Button>
        ) : (
          <Button type="submit" variant="primary" icon disabled={!input.trim()} aria-label="Send">
            <Send size={16} />
          </Button>
        )}
      </form>
    </div>
  )
}
