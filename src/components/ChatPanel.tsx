import { AnimatePresence, motion } from 'motion/react'
import { Eraser, Send, Sparkles, Square } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AiError } from '../lib/ai'
import { uid, updateDb, useDb } from '../lib/store'
import type { ChatMessage } from '../lib/types'
import { Button, ErrorAlert, Markdown, ask } from './ui'

type Reply = (history: ChatMessage[], onText: (t: string) => void, signal: AbortSignal) => Promise<{ text: string; blocks?: unknown[] }>

/** A saved, streaming chat. `chatKey` picks which conversation is stored. */
export function ChatPanel({
  chatKey,
  reply,
  intro,
  suggestions,
  placeholder,
  initialInput = '',
  messageActions,
  stickyComposer = true,
}: {
  chatKey: string
  reply: Reply
  intro: ReactNode
  suggestions: string[]
  placeholder: string
  initialInput?: string
  messageActions?: (m: ChatMessage, history: ChatMessage[]) => ReactNode
  stickyComposer?: boolean
}) {
  const db = useDb()
  const history = useMemo(() => db.chats[chatKey] ?? [], [db.chats, chatKey])
  const [input, setInput] = useState(initialInput)
  const [streaming, setStreaming] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ctl = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLTextAreaElement>(null)
  const mounted = useRef(false)

  useEffect(() => () => ctl.current?.abort(), [])
  useEffect(() => {
    // Don't jump the page on first render; follow the conversation after that.
    if (mounted.current) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    mounted.current = true
  }, [history.length, streaming])
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [input])

  const setChat = (msgs: ChatMessage[]) => updateDb((d) => ({ ...d, chats: { ...d.chats, [chatKey]: msgs } }))

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
      const res = await reply(next, setStreaming, c.signal)
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
    <div className="stack lg">
      {history.length > 0 && (
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button size="sm" variant="ghost" onClick={async () => (await ask('Clear this conversation?')) && setChat([])}>
            <Eraser size={14} /> Clear chat
          </Button>
        </div>
      )}

      <div className="chat" aria-live="polite">
        {history.length === 0 && streaming === null && (
          <motion.div className="stack" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="bubble assistant">{intro}</div>
            <div className="chip-group">
              {suggestions.map((s) => (
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
              {m.role === 'assistant' ? (
                <>
                  <Markdown>{m.text}</Markdown>
                  {messageActions && <div style={{ marginTop: 10 }}>{messageActions(m, history)}</div>}
                </>
              ) : (
                m.text
              )}
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
        style={stickyComposer ? undefined : { position: 'static' }}
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
      >
        <textarea
          ref={boxRef}
          rows={1}
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send(input)
            }
          }}
          aria-label={placeholder}
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
