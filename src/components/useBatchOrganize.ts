import { useCallback, useEffect, useRef, useState } from 'react'
import { AiError, organizeNotes } from '../lib/ai'
import { getDb, uid, updateDb } from '../lib/store'
import type { Exam } from '../lib/types'

const STOP_ALL: AiError['code'][] = ['no-ai', 'auth', 'rate', 'denied', 'cancelled']

/** Organises many raw notes with AI, one request at a time, with a Stop button. */
export function useBatchOrganize(exam: Exam) {
  const [state, setState] = useState<{ running: boolean; done: number; total: number; current: string; failed: string[]; error: string | null }>({
    running: false,
    done: 0,
    total: 0,
    current: '',
    failed: [],
    error: null,
  })
  const ctl = useRef<AbortController | null>(null)
  useEffect(() => () => ctl.current?.abort(), [])

  const start = useCallback(
    async (noteIds: string[]) => {
      const c = new AbortController()
      ctl.current = c
      const failed: string[] = []
      setState({ running: true, done: 0, total: noteIds.length, current: '', failed, error: null })
      for (let i = 0; i < noteIds.length; i++) {
        const note = getDb().notes.find((n) => n.id === noteIds[i])
        if (!note || note.organized) continue
        setState((s) => ({ ...s, done: i, current: note.title }))
        try {
          const freshExam = getDb().exams.find((e) => e.id === exam.id) ?? exam
          const organized = await organizeNotes(freshExam, { text: note.raw, files: [] }, note.title, { signal: c.signal })
          updateDb((d) => ({
            ...d,
            // Keep the course's own module title; the AI picks the syllabus topic.
            notes: d.notes.map((n) => (n.id === note.id ? { ...n, organized, topic: organized.topic } : n)),
            flashcards: [
              ...d.flashcards,
              ...organized.flashcards.map((f) => ({ id: uid(), examId: exam.id, front: f.front, back: f.back, topic: organized.topic, box: 1, due: Date.now() })),
            ],
          }))
        } catch (e) {
          const err = e instanceof AiError ? e : new AiError('other', String(e))
          if (STOP_ALL.includes(err.code)) {
            setState((s) => ({ ...s, running: false, done: i, current: '', error: err.code === 'cancelled' ? null : err.message }))
            ctl.current = null
            return
          }
          failed.push(note.title)
        }
      }
      setState((s) => ({ ...s, running: false, done: noteIds.length, current: '', failed: [...failed] }))
      ctl.current = null
    },
    [exam],
  )

  const stop = useCallback(() => ctl.current?.abort(), [])
  return { ...state, start, stop }
}
