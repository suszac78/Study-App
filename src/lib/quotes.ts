import type { Db } from './types'

// Original lines (no made-up celebrity attributions).
export const BUILT_IN_QUOTES = [
  'Future you is sitting in the exam hall right now. Give them something to work with.',
  'The grade you want is built in the boring hours nobody sees.',
  'Discipline is choosing what you want most over what you want now.',
  'You don’t have to feel ready. You just have to start.',
  'One focused hour beats five distracted ones.',
  'Every flashcard you flip is a question you won’t panic over later.',
  'Small study sessions add up to big results.',
  'The exam is coming either way. Show up prepared.',
  'Hard now, easy later. Easy now, hard later.',
  'Your phone will still be there in 25 minutes. Your exam won’t wait.',
  'Confidence isn’t magic. It’s preparation you can remember.',
  'Nobody gets top marks by accident.',
  'Today’s revision is tomorrow’s free time.',
  'Mistakes in practice are free. Mistakes in the exam aren’t.',
  'Be the student your report card brags about.',
]

/** The quotes to show: the student's own and AI ones first, then built-ins. */
export function quotePool(db: Db): { personal: string[]; all: string[] } {
  const m = db.motivation
  const personal = [...m.custom, ...m.ai].filter((q) => q.trim())
  const builtIn = m.builtIn || !personal.length ? BUILT_IN_QUOTES : []
  return { personal, all: [...personal, ...builtIn] }
}

/** Personal quotes come up most of the time when there are some. */
export function randomQuote(db: Db, avoid?: string): string {
  const { personal, all } = quotePool(db)
  const from = personal.length && Math.random() < 0.7 ? personal : all
  const options = from.length > 1 ? from.filter((q) => q !== avoid) : from
  return options[Math.floor(Math.random() * options.length)] ?? BUILT_IN_QUOTES[0]
}
