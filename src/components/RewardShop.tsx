import { AnimatePresence, motion } from 'motion/react'
import { Check, Gift, Lock, Sparkles, Ticket, Trophy, X, Zap } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CARDS_PER_TOKEN, FOCUS_MIN_PER_TOKEN, nextToken, openMysterySeed, recordSpeedScore, spend, tokenBalance } from '../lib/rewards'
import { randomQuote } from '../lib/quotes'
import { getDb, useDb } from '../lib/store'
import type { Db, RareSeed } from '../lib/types'
import { shuffle } from '../lib/utils'
import { Plant } from './Plant'
import { Badge, Button, Card, Markdown, Meter } from './ui'

interface Round {
  q: string
  a: string
  isTrue: boolean
}

/** True/false rounds from the student's own flashcards (or quiz questions). */
function buildRounds(db: Db): Round[] {
  const pairs = db.flashcards.map((c) => ({ q: c.front, a: c.back }))
  if (pairs.length < 4) {
    for (const quiz of db.quizzes)
      for (const q of quiz.questions) if (q.correct.length === 1) pairs.push({ q: q.prompt, a: q.options[q.correct[0]] })
  }
  if (pairs.length < 4) return []
  return shuffle(pairs).map((p) => {
    const isTrue = Math.random() < 0.5
    let a = p.a
    if (!isTrue) {
      const others = pairs.filter((o) => o.a !== p.a)
      a = others[Math.floor(Math.random() * others.length)]?.a ?? p.a
    }
    return { q: p.q, a, isTrue: isTrue || a === p.a }
  })
}

const GAME_SECONDS = 60

function SpeedRound({ onClose }: { onClose: () => void }) {
  const rounds = useMemo(() => buildRounds(getDb()), [])
  const [i, setI] = useState(0)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [left, setLeft] = useState(GAME_SECONDS)
  const [flash, setFlash] = useState<'good' | 'bad' | null>(null)
  const [over, setOver] = useState(false)
  const best = useRef(getDb().rewards.bestSpeed)

  useEffect(() => {
    if (over) return
    const t = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000)
    return () => clearInterval(t)
  }, [over])

  useEffect(() => {
    if (left === 0) setOver(true)
  }, [left])

  useEffect(() => {
    if (over) recordSpeedScore(score)
  }, [over, score])

  const answer = useCallback(
    (saidTrue: boolean) => {
      if (over) return
      const r = rounds[i % rounds.length]
      const right = saidTrue === r.isTrue
      const mult = combo >= 6 ? 3 : combo >= 3 ? 2 : 1
      setScore((s) => (right ? s + 10 * mult : Math.max(0, s - 5)))
      setCombo((c) => (right ? c + 1 : 0))
      setFlash(right ? 'good' : 'bad')
      setTimeout(() => setFlash(null), 250)
      setI((n) => n + 1)
    },
    [over, rounds, i, combo],
  )

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 't') answer(true)
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'f') answer(false)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [answer])

  const r = rounds[i % rounds.length]
  const mult = combo >= 6 ? 3 : combo >= 3 ? 2 : 1

  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="card modal"
        style={{ width: 'min(560px, 100%)', borderColor: flash === 'good' ? 'var(--success)' : flash === 'bad' ? 'var(--danger)' : undefined }}
        initial={{ scale: 0.92 }}
        animate={{ scale: 1, x: flash === 'bad' ? [0, -8, 8, 0] : 0 }}
        role="dialog"
        aria-modal="true"
        aria-label="Speed round"
      >
        {!over ? (
          <>
            <div className="row between">
              <Badge tone={left <= 10 ? 'danger' : 'neutral'}>{left}s</Badge>
              <strong className="mono" style={{ fontSize: 'var(--fs-lg)' }}>{score}</strong>
              <Badge tone={mult > 1 ? 'accent' : 'neutral'}>
                <Zap size={12} /> x{mult}
              </Badge>
            </div>
            <Meter value={left / GAME_SECONDS} tone="" />
            <AnimatePresence mode="wait">
              <motion.div key={i} className="stack" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.15 }}>
                <div className="subtle xs">True or false?</div>
                <div style={{ fontWeight: 600, fontSize: 'var(--fs-lg)' }}><Markdown>{r.q}</Markdown></div>
                <div className="explain"><Markdown>{r.a}</Markdown></div>
              </motion.div>
            </AnimatePresence>
            <div className="grid grid-2" style={{ gap: 10 }}>
              <Button variant="primary" size="lg" onClick={() => answer(true)}>
                <Check size={18} /> True
              </Button>
              <Button variant="danger" size="lg" onClick={() => answer(false)}>
                <X size={18} /> False
              </Button>
            </div>
            <span className="hint center">Keyboard: ← or T for true, → or F for false. 3 in a row doubles points.</span>
            <Button size="sm" variant="ghost" onClick={() => setOver(true)}>End game</Button>
          </>
        ) : (
          <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
            <Trophy size={40} color="var(--highlight)" />
            <h2>{score} points</h2>
            <p className="muted">{score > best.current ? 'New personal best!' : `Best: ${Math.max(best.current, score)}`}</p>
            <p className="small" style={{ fontStyle: 'italic' }}>{randomQuote(getDb())}</p>
            <Button variant="primary" onClick={onClose}>Back to studying</Button>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

function SeedReveal({ seed, onClose }: { seed: RareSeed; onClose: () => void }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 1300)
    return () => clearTimeout(t)
  }, [])
  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => open && onClose()}>
      <motion.div className="card modal" style={{ alignItems: 'center', textAlign: 'center' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Mystery seed">
        <motion.div animate={open ? { rotate: 0, scale: 1 } : { rotate: [0, -8, 8, -8, 8, 0], scale: [1, 1.05, 1] }} transition={open ? { type: 'spring' } : { duration: 0.6, repeat: 2 }}>
          <Plant progress={open ? 1 : 0.05} seed={seed.seed} minutes={seed.rarity === 'common' ? 25 : 60} rarity={seed.rarity} size={150} />
        </motion.div>
        {open ? (
          <>
            <Badge tone={seed.rarity === 'legendary' ? 'accent' : seed.rarity === 'rare' ? 'warning' : 'neutral'}>{seed.rarity.toUpperCase()}</Badge>
            <h3>{seed.name}</h3>
            <p className="muted small">Planted in your garden.</p>
            <Button variant="primary" onClick={onClose} autoFocus>Back to studying</Button>
          </>
        ) : (
          <p className="shimmer-text">Something is sprouting…</p>
        )}
      </motion.div>
    </motion.div>
  )
}

/** Fun stuff you pay for with tokens earned by studying. */
export function RewardShop() {
  const db = useDb()
  const balance = tokenBalance(db)
  const next = nextToken(db)
  const [playing, setPlaying] = useState(false)
  const [reveal, setReveal] = useState<RareSeed | null>(null)
  const canPlay = db.flashcards.length + db.quizzes.reduce((s, q) => s + q.questions.length, 0) >= 4

  const items = [
    {
      key: 'speed',
      icon: <Zap size={20} />,
      title: 'Speed round',
      text: canPlay ? `60 seconds of true/false from your flashcards. Best: ${db.rewards.bestSpeed}` : 'Needs at least 4 flashcards or quiz questions.',
      disabled: !canPlay,
      action: () => spend('speed', 1) && setPlaying(true),
    },
    {
      key: 'seed',
      icon: <Gift size={20} />,
      title: 'Mystery seed',
      text: 'Grow a surprise plant. 30% rare, 10% legendary.',
      disabled: false,
      action: () => {
        const s = openMysterySeed()
        if (s) setReveal(s)
      },
    },
  ]

  return (
    <Card className="stack">
      <div className="row between">
        <div className="row nowrap" style={{ gap: 10 }}>
          <div className="feature-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <Ticket size={20} />
          </div>
          <div className="stack sm">
            <h3>Reward shop</h3>
            <span className="subtle">Fun costs tokens. Tokens only come from studying.</span>
          </div>
        </div>
        <motion.span key={balance} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="badge accent" style={{ fontSize: 'var(--fs-sm)', padding: '6px 12px' }}>
          <Ticket size={14} /> {balance} token{balance === 1 ? '' : 's'}
        </motion.span>
      </div>

      <div className="stack sm">
        <div className="row between xs subtle">
          <span>Next token: {next.focusLeft} more focus minutes, or finish a quiz, or review {CARDS_PER_TOKEN} flashcards</span>
          <span>1 token = {FOCUS_MIN_PER_TOKEN} min</span>
        </div>
        <Meter value={next.progress} tone="" />
      </div>

      <div className="grid grid-2" style={{ gap: 12 }}>
        {items.map((it) => {
          const locked = balance < 1
          return (
            <div key={it.key} className="card tight flat stack sm">
              <div className="row nowrap" style={{ gap: 10 }}>
                <div className="feature-icon" style={{ width: 36, height: 36, borderRadius: 11 }}>{it.icon}</div>
                <div className="stack sm grow">
                  <strong className="small">{it.title}</strong>
                  <span className="subtle xs">{it.text}</span>
                </div>
              </div>
              <Button size="sm" variant={locked ? 'ghost' : 'primary'} disabled={locked || it.disabled} onClick={it.action}>
                {locked ? (
                  <>
                    <Lock size={14} /> Study to unlock
                  </>
                ) : (
                  <>
                    <Sparkles size={14} /> Use 1 token
                  </>
                )}
              </Button>
            </div>
          )
        })}
      </div>

      <AnimatePresence>
        {playing && <SpeedRound onClose={() => setPlaying(false)} />}
        {reveal && <SeedReveal seed={reveal} onClose={() => setReveal(null)} />}
      </AnimatePresence>
    </Card>
  )
}
