import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { GRACE_SECONDS, addAway, chime, endsAt, finishFocus, heartbeat } from '../lib/focus'
import { useDb } from '../lib/store'
import type { FocusSession } from '../lib/types'
import { clock } from '../lib/utils'
import { Plant } from './Plant'
import { Button, toast } from './ui'

const AWAY_LINES = [
  'Your plant saw you leave. It’s fine. It’s totally fine.',
  'Welcome back! Your plant held its breath the whole time.',
  'Caught you. The plant forgives you, once.',
  'That was suspiciously long. Back to it!',
]
const WITHER_LINES = [
  'Your plant waited… and waited… and wilted.',
  'RIP little plant. It believed in you.',
  'The plant has left the chat.',
]
const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)]

function Confetti() {
  const bits = Array.from({ length: 36 }, (_, i) => i)
  return (
    <>
      {bits.map((i) => {
        const angle = (i / bits.length) * Math.PI * 2
        const dist = 160 + (i % 5) * 40
        const colors = ['var(--highlight)', 'var(--accent)', 'var(--leaf)', 'var(--primary)']
        return (
          <motion.span
            key={i}
            className="confetti"
            style={{ background: colors[i % colors.length] }}
            initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
            animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist + 220, rotate: 540, opacity: 0 }}
            transition={{ duration: 1.6, ease: 'easeOut' }}
          />
        )
      })}
    </>
  )
}

/**
 * Runs app-wide during a focus session: tracks time away from the app,
 * finishes the session, and shows a small floating timer on other pages.
 */
export function FocusGuard() {
  const db = useDb()
  const location = useLocation()
  const active = db.activeFocus
  const [now, setNow] = useState(() => Date.now())
  const [notice, setNotice] = useState<{ kind: 'away' | 'withered' | 'grown'; text: string; seconds?: number; session?: FocusSession } | null>(null)
  const hiddenAt = useRef<number | null>(null)

  // Time the app was closed during a session counts as away.
  useEffect(() => {
    const a = db.activeFocus
    if (a && Date.now() - a.lastSeen > 5000) addAway(a.lastSeen, Date.now())
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!active) return
    const tick = setInterval(() => setNow(Date.now()), 500)
    const beat = setInterval(() => !document.hidden && heartbeat(), 10_000)
    const onVis = () => {
      if (document.hidden) {
        hiddenAt.current = Date.now()
      } else if (hiddenAt.current) {
        const from = hiddenAt.current
        hiddenAt.current = null
        const secs = Math.round((Date.now() - from) / 1000)
        addAway(from, Date.now())
        if (secs >= 3) setNotice({ kind: 'away', text: pick(AWAY_LINES), seconds: secs })
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(tick)
      clearInterval(beat)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [active])

  // Decide the session's fate while the app is visible.
  useEffect(() => {
    if (!active || document.hidden) return
    if (active.awayMs > GRACE_SECONDS * 1000) {
      const s = finishFocus('withered')
      chime(false)
      setNotice({ kind: 'withered', text: pick(WITHER_LINES), session: s ?? undefined })
    } else if (now >= endsAt(active)) {
      const s = finishFocus('grown')
      chime(true)
      setNotice({ kind: 'grown', text: `${active.minutes} minutes of focus. Your plant is in the garden.`, session: s ?? undefined })
      toast(`+${active.minutes * 2} XP · plant grown`)
    }
  }, [active, now])

  const left = active ? (endsAt(active) - now) / 1000 : 0
  const progress = active ? 1 - left / (active.minutes * 60) : 0
  const graceLeft = active ? Math.max(0, GRACE_SECONDS - Math.round(active.awayMs / 1000)) : 0
  const onFocusPage = location.pathname === '/focus'

  return (
    <>
      <AnimatePresence>
        {active && !onFocusPage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{
              position: 'fixed',
              right: 'calc(16px + env(safe-area-inset-right, 0px))',
              bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))',
              zIndex: 60,
            }}
          >
            <Link to="/focus" className="card tight row nowrap" style={{ gap: 8, padding: '6px 14px 6px 6px', boxShadow: 'var(--shadow-lg)', color: 'inherit', textDecoration: 'none', borderRadius: 99 }}>
              <Plant progress={progress} seed={active.seed} minutes={active.minutes} size={34} />
              <span className="mono" style={{ fontWeight: 700 }}>{clock(left)}</span>
              {active.awayMs > 0 && <span className="badge warning">{graceLeft}s grace</span>}
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {notice && (
          <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setNotice(null)}>
            {notice.kind === 'grown' && <Confetti />}
            <motion.div
              className="card modal"
              role="alertdialog"
              aria-modal="true"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{ alignItems: 'center', textAlign: 'center' }}
            >
              {notice.kind === 'away' && active ? (
                <>
                  <Plant progress={progress} seed={active.seed} minutes={active.minutes} size={110} />
                  <h3>You were gone {notice.seconds}s</h3>
                  <p className="muted">{notice.text}</p>
                  <p className="small">
                    <strong>{graceLeft}s</strong> of away time left before it withers.
                  </p>
                </>
              ) : (
                <>
                  <Plant progress={1} withered={notice.kind === 'withered'} seed={notice.session?.seed} minutes={notice.session?.minutes} size={120} />
                  <h3>{notice.kind === 'grown' ? 'Session complete!' : 'Your plant withered'}</h3>
                  <p className="muted">{notice.text}</p>
                </>
              )}
              <Button variant="primary" onClick={() => setNotice(null)} autoFocus>
                {notice.kind === 'away' ? 'Back to work' : notice.kind === 'grown' ? 'Nice' : 'I’ll do better'}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
