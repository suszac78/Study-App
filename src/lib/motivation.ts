import { sameSet } from './ai'
import type { Db, Exam } from './types'
import { daysUntil } from './utils'

// Streaks, XP, levels and daily quests, all derived from what the student has
// actually done, so past study counts and nothing extra needs saving.

export const dayKey = (ts: number) => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const todayKey = () => dayKey(Date.now())

function activityDays(db: Db): Set<string> {
  const days = new Set<string>()
  db.focusSessions.forEach((s) => s.status === 'grown' && days.add(dayKey(s.endedAt)))
  db.attempts.forEach((a) => days.add(dayKey(a.finishedAt)))
  db.notes.forEach((n) => days.add(dayKey(n.createdAt)))
  db.flashcards.forEach((c) => c.lastReviewed && days.add(dayKey(c.lastReviewed)))
  return days
}

export interface Streak {
  days: number
  activeToday: boolean
  best: number
}

export function streak(db: Db): Streak {
  const days = activityDays(db)
  const activeToday = days.has(todayKey())
  const cursor = new Date()
  if (!activeToday) cursor.setDate(cursor.getDate() - 1) // still alive until midnight
  let count = 0
  while (days.has(dayKey(cursor.getTime()))) {
    count++
    cursor.setDate(cursor.getDate() - 1)
  }
  // Best run ever.
  const sorted = [...days].sort()
  let best = 0
  let run = 0
  let prev: number | null = null
  for (const k of sorted) {
    const t = new Date(k + 'T00:00:00').getTime()
    run = prev !== null && Math.round((t - prev) / 86_400_000) === 1 ? run + 1 : 1
    best = Math.max(best, run)
    prev = t
  }
  return { days: count, activeToday, best: Math.max(best, count) }
}

interface DayStats {
  focusMin: number
  answered: number
  reviewed: number
  notes: number
}

function statsByDay(db: Db): Map<string, DayStats> {
  const map = new Map<string, DayStats>()
  const get = (k: string) => {
    let v = map.get(k)
    if (!v) map.set(k, (v = { focusMin: 0, answered: 0, reviewed: 0, notes: 0 }))
    return v
  }
  db.focusSessions.forEach((s) => s.status === 'grown' && (get(dayKey(s.endedAt)).focusMin += s.minutes))
  db.attempts.forEach((a) => (get(dayKey(a.finishedAt)).answered += Object.values(a.answers).filter((x) => x.length).length))
  db.flashcards.forEach((c) => c.lastReviewed && get(dayKey(c.lastReviewed)).reviewed++)
  db.notes.forEach((n) => get(dayKey(n.createdAt)).notes++)
  return map
}

const QUEST_GOALS = { focus: 25, quiz: 10, cards: 10, notes: 1 }
const QUEST_REWARDS = { focus: 50, quiz: 30, cards: 20, notes: 20 }

export function xp(db: Db): number {
  let total = 0
  // Completed daily quests, every day.
  for (const d of statsByDay(db).values()) {
    if (d.focusMin >= QUEST_GOALS.focus) total += QUEST_REWARDS.focus
    if (d.answered >= QUEST_GOALS.quiz) total += QUEST_REWARDS.quiz
    if (d.reviewed >= QUEST_GOALS.cards) total += QUEST_REWARDS.cards
    else if (d.notes >= QUEST_GOALS.notes) total += QUEST_REWARDS.notes
  }
  for (const s of db.focusSessions) if (s.status === 'grown') total += s.minutes * 2
  for (const a of db.attempts) {
    total += 10
    const quiz = db.quizzes.find((q) => q.id === a.quizId)
    quiz?.questions.forEach((q) => {
      if (sameSet(a.answers[q.id] ?? [], q.correct)) total += 3
    })
  }
  total += db.notes.filter((n) => n.organized).length * 15 + db.notes.length * 5
  total += db.flashcards.reduce((s, c) => s + (c.box - 1) * 2, 0)
  return total
}

const TITLES = [
  'Professional Procrastinator',
  'Tab-Closer in Training',
  'Desk Survivor',
  'Focused Freshman',
  'Flashcard Flinger',
  'Quiz Crusher',
  'Library Legend',
  'Study Machine',
  'Exam Slayer',
  'Grandmaster of Revision',
]

export function level(points: number) {
  // Each level needs a little more XP than the one before.
  let lvl = 1
  let floor = 0
  let step = 60
  while (points >= floor + step) {
    floor += step
    lvl++
    step = Math.round(step * 1.25)
  }
  return { level: lvl, title: TITLES[Math.min(lvl - 1, TITLES.length - 1)], into: points - floor, needed: step }
}

/** The exam to point quests at: the next upcoming one, else the newest. */
export function focusExam(db: Db): Exam | null {
  const upcoming = db.exams
    .map((e) => ({ e, d: daysUntil(e.examDate) }))
    .filter((x) => x.d !== null && x.d >= 0)
    .sort((a, b) => a.d! - b.d!)
  return upcoming[0]?.e ?? db.exams[db.exams.length - 1] ?? null
}

export interface Quest {
  id: string
  label: string
  progress: number
  goal: number
  to: string
  reward: number
}

export function dailyQuests(db: Db): Quest[] {
  const t = todayKey()
  const exam = focusExam(db)
  const base = exam ? `/exam/${exam.id}` : '/new'
  const d = statsByDay(db).get(t) ?? { focusMin: 0, answered: 0, reviewed: 0, notes: 0 }
  const quests: Quest[] = [
    { id: 'focus', label: 'Grow 25 minutes of focus', progress: Math.min(d.focusMin, 25), goal: 25, to: '/focus', reward: QUEST_REWARDS.focus },
    { id: 'quiz', label: 'Answer 10 quiz questions', progress: Math.min(d.answered, 10), goal: 10, to: exam ? `${base}/practice` : base, reward: QUEST_REWARDS.quiz },
  ]
  // Matches xp(): the cards quest counts when done, otherwise a notes day still earns its reward.
  if (db.flashcards.length) {
    quests.push({ id: 'cards', label: 'Review 10 flashcards', progress: Math.min(d.reviewed, 10), goal: 10, to: exam ? `${base}/flashcards` : base, reward: QUEST_REWARDS.cards })
  } else {
    quests.push({ id: 'notes', label: 'Add one set of notes', progress: Math.min(d.notes, 1), goal: 1, to: exam ? `${base}/notes/new` : base, reward: QUEST_REWARDS.notes })
  }
  return quests
}

const NUDGES = [
  'Your future self is watching. Make them proud.',
  'The exam doesn’t care how you feel today. Start anyway.',
  'Five minutes. That’s all. Then you can quit (you won’t).',
  'Phone face down. Plant in. Let’s go.',
  'Motivation follows action, not the other way round.',
  'Every streak started with one boring Tuesday.',
  'You don’t need to finish. You need to start.',
]

export const randomNudge = () => NUDGES[Math.floor(Math.random() * NUDGES.length)]

/** Used when no AI is connected: a quick comeback for any excuse. */
export const OFFLINE_SHREDS = [
  'Bold excuse. Counter-offer: 5 minutes of flashcards, then you can go back to doing nothing.',
  'Noted and shredded. Your task: read one page of notes out loud. Go.',
  'That excuse has a 0% pass rate. Start a 15-minute focus session and prove it wrong.',
  'Interesting. Now do 3 quiz questions. Excuses can wait, the exam can’t.',
]
