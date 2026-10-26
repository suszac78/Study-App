import { AnimatePresence, motion } from 'motion/react'
import { Check, Lightbulb, X } from 'lucide-react'
import { useState } from 'react'
import { sameSet } from '../lib/ai'
import type { Question } from '../lib/types'
import { Badge, Button, Markdown } from './ui'

const KEYS = 'ABCDEFGH'

/** Renders one question. `reveal` shows right/wrong styling and explanations. */
export function QuestionView({
  q,
  index,
  total,
  selected,
  onSelect,
  reveal,
  showHint = false,
}: {
  q: Question
  index: number
  total: number
  selected: number[]
  onSelect?: (next: number[]) => void
  reveal: boolean
  showHint?: boolean
}) {
  const [hint, setHint] = useState(false)
  const multi = q.type === 'multi'
  const isCorrect = sameSet(selected, q.correct)

  const pick = (i: number) => {
    if (reveal || !onSelect) return
    if (multi) onSelect(selected.includes(i) ? selected.filter((x) => x !== i) : [...selected, i].sort())
    else onSelect([i])
  }

  return (
    <div className="stack lg">
      <div className="row" style={{ gap: 8 }}>
        <Badge tone="neutral">Q{index + 1} of {total}</Badge>
        <Badge>{q.topic}</Badge>
        <Badge tone={q.difficulty}>{q.difficulty}</Badge>
        {multi && <Badge tone="accent">Select all that apply</Badge>}
      </div>
      <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 500 }}>
        <Markdown>{q.prompt}</Markdown>
      </div>

      <div className="stack" role={multi ? 'group' : 'radiogroup'} aria-label="Answer options">
        {q.options.map((opt, i) => {
          const chosen = selected.includes(i)
          const right = q.correct.includes(i)
          const state = reveal ? (right ? 'correct' : chosen ? 'wrong' : '') : chosen ? 'selected' : ''
          return (
            <motion.button
              key={i}
              className={`q-option ${state}`}
              onClick={() => pick(i)}
              disabled={reveal || !onSelect}
              role={multi ? 'checkbox' : 'radio'}
              aria-checked={chosen}
              whileTap={reveal ? undefined : { scale: 0.985 }}
              animate={reveal && chosen && !right ? { x: [0, -6, 6, -4, 4, 0] } : undefined}
              transition={{ duration: 0.4 }}
            >
              <span className="key">{reveal && right ? <Check size={14} /> : reveal && chosen ? <X size={14} /> : KEYS[i]}</span>
              <span className="grow">
                <Markdown>{opt}</Markdown>
                {reveal && q.optionExplanations[i] && <span className="opt-note">{q.optionExplanations[i]}</span>}
              </span>
            </motion.button>
          )
        })}
      </div>

      {showHint && !reveal && q.hint && (
        <div>
          {hint ? (
            <motion.div className="alert info" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <Lightbulb size={16} />
              <span>{q.hint}</span>
            </motion.div>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setHint(true)}>
              <Lightbulb size={14} /> Show hint
            </Button>
          )}
        </div>
      )}

      <AnimatePresence>
        {reveal && (
          <motion.div className="explain stack sm" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="row" style={{ gap: 8 }}>
              {selected.length === 0 ? (
                <Badge tone="neutral">Not answered</Badge>
              ) : isCorrect ? (
                <Badge tone="success"><Check size={12} /> Correct</Badge>
              ) : (
                <Badge tone="danger"><X size={12} /> Incorrect</Badge>
              )}
              <strong className="small">Explanation</strong>
            </div>
            <Markdown>{q.explanation}</Markdown>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
