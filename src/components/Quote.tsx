import { AnimatePresence, motion } from 'motion/react'
import { Quote as QuoteIcon, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { randomQuote } from '../lib/quotes'
import { getDb, useDb } from '../lib/store'

/** A rotating motivational quote, preferring the student's own. */
export function QuoteCard({ compact = false }: { compact?: boolean }) {
  useDb()
  const [quote, setQuote] = useState(() => randomQuote(getDb()))
  const personal = getDb().motivation.custom.includes(quote) || getDb().motivation.ai.includes(quote)
  return (
    <div className={compact ? 'row nowrap' : 'card row nowrap'} style={{ gap: 14, alignItems: 'flex-start', ...(compact ? {} : { background: 'linear-gradient(135deg, var(--accent-soft), var(--surface))' }) }}>
      <QuoteIcon size={compact ? 18 : 22} color="var(--accent)" style={{ flex: 'none', marginTop: 4 }} />
      <div className="stack sm grow">
        <AnimatePresence mode="wait">
          <motion.p
            key={quote}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: compact ? 'var(--fs-base)' : 'var(--fs-lg)', lineHeight: 1.35, textWrap: 'balance' }}
          >
            {quote}
          </motion.p>
        </AnimatePresence>
        {!compact && (
          <span className="subtle xs">
            {personal ? 'Your motivation' : 'Make it personal: '}
            {!personal && <Link to="/settings#motivation">add your goal in Settings</Link>}
          </span>
        )}
      </div>
      <button className="btn btn-ghost btn-sm btn-icon" style={{ flex: 'none' }} aria-label="Another quote" onClick={() => setQuote((q) => randomQuote(getDb(), q))}>
        <RefreshCw size={14} />
      </button>
    </div>
  )
}
