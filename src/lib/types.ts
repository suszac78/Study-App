import type { AIQuestion, AttemptFeedback, ExamAnalysis, ExamTips, OrganizedNote } from './schemas'

export type ModelId = 'claude-opus-5-5' | 'claude-sonnet-5-5' | 'claude-haiku-5-5'
export type Depth = 'quick' | 'balanced' | 'deep'

export interface Settings {
  apiKey: string
  model: ModelId
  depth: Depth
  theme: 'system' | 'light' | 'dark'
}

export interface Exam {
  id: string
  name: string
  examDate: string // YYYY-MM-DD or ''
  createdAt: number
  hue: number
  info: ExamAnalysis | null
  sourceText: string
}

export interface Note {
  id: string
  examId: string
  title: string
  topic: string
  createdAt: number
  sources: string[]
  raw: string
  organized: OrganizedNote | null
}

export interface Question extends AIQuestion {
  id: string
}

export interface Quiz {
  id: string
  examId: string
  title: string
  mode: 'practice' | 'timed'
  createdAt: number
  durationMinutes: number
  marksPerQuestion: number
  negativeMark: number
  questions: Question[]
}

export interface Attempt {
  id: string
  quizId: string
  examId: string
  mode: Quiz['mode']
  startedAt: number
  finishedAt: number
  answers: Record<string, number[]>
  score: number
  maxScore: number
  correct: number
  wrong: number
  skipped: number
  feedback: AttemptFeedback | null
}

export interface Flashcard {
  id: string
  examId: string
  front: string
  back: string
  topic: string
  box: number // 1..5 Leitner box
  due: number
  lastReviewed?: number
}

export interface FocusSession {
  id: string
  examId: string | null
  label: string
  minutes: number
  startedAt: number
  endedAt: number
  status: 'grown' | 'withered'
  awaySeconds: number
  seed: number
}

/** The focus session in progress (kept so a reload doesn't lose it). */
export interface ActiveFocus {
  id: string
  examId: string | null
  label: string
  minutes: number
  startedAt: number
  awayMs: number
  lastSeen: number
  seed: number
}

export interface TipsEntry {
  examId: string
  createdAt: number
  tips: ExamTips
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  // Raw assistant content blocks, replayed to the API unchanged.
  blocks?: unknown[]
}

export interface Db {
  exams: Exam[]
  notes: Note[]
  quizzes: Quiz[]
  attempts: Attempt[]
  flashcards: Flashcard[]
  tips: TipsEntry[]
  chats: Record<string, ChatMessage[]>
  focusSessions: FocusSession[]
  activeFocus: ActiveFocus | null
}
