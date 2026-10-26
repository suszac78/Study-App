import { AnimatePresence, motion } from 'motion/react'
import { Flower2, GraduationCap, Home, Plus, Settings as SettingsIcon } from 'lucide-react'
import { Link, NavLink, useLocation, useOutlet } from 'react-router-dom'
import { currentProvider } from '../lib/ai'
import { FocusGuard } from './FocusGuard'
import { StreakBadge, useMotivation } from './Motivation'
import { useRuntime } from '../lib/runtime'
import { useDb, useSaveError, useSettings } from '../lib/store'
import { daysUntil, examColor } from '../lib/utils'

export function useAiStatus() {
  const runtime = useRuntime()
  useSettings() // re-render when the API key changes
  const provider = runtime === 'checking' ? 'checking' : currentProvider()
  const label =
    provider === 'claude'
      ? 'AI: built-in Claude'
      : provider === 'api'
        ? 'AI: your API key'
        : provider === 'checking'
          ? 'Connecting AI…'
          : 'AI not connected'
  return { provider, label }
}

function AiChip() {
  const { provider, label } = useAiStatus()
  return (
    <Link to="/settings" className={`ai-chip ${provider === 'claude' || provider === 'api' ? '' : 'off'}`} style={{ textDecoration: 'none' }}>
      <span className="pulse" />
      <span>{label}</span>
    </Link>
  )
}

function Brand() {
  return (
    <Link to="/" className="brand">
      <span className="brand-mark">
        <GraduationCap size={20} />
      </span>
      StudyPilot
    </Link>
  )
}

export function Layout() {
  const db = useDb()
  const saveError = useSaveError()
  const location = useLocation()
  const outlet = useOutlet()
  const { streak } = useMotivation()
  const topKey = location.pathname.split('/').slice(0, 3).join('/')

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Main navigation">
        <Brand />
        <nav className="nav-list">
          <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Home size={18} /> Home
          </NavLink>
          <NavLink to="/new" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Plus size={18} /> New exam
          </NavLink>
          <NavLink to="/focus" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Flower2 size={18} /> <span className="grow">Focus garden</span>
            <StreakBadge days={streak.days} activeToday={streak.activeToday} />
          </NavLink>
        </nav>
        {db.exams.length > 0 && (
          <div>
            <div className="nav-label">Your exams</div>
            <nav className="nav-list">
              {db.exams.map((e) => {
                const d = daysUntil(e.examDate)
                return (
                  <NavLink key={e.id} to={`/exam/${e.id}`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <span className="dot" style={{ background: examColor(e.hue) }} />
                    <span className="grow">{e.name}</span>
                    {d !== null && d >= 0 && <span className="subtle xs mono">{d}d</span>}
                  </NavLink>
                )
              })}
            </nav>
          </div>
        )}
        <div className="sidebar-foot">
          <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <SettingsIcon size={18} /> Settings
          </NavLink>
          <AiChip />
        </div>
      </aside>

      <div style={{ minWidth: 0 }}>
        <header className="mobile-bar">
          <Brand />
          <AiChip />
        </header>
        <main className="main">
          {saveError && (
            <div className="page" style={{ marginBottom: 16 }}>
              <div className="alert warn" role="alert">{saveError}</div>
            </div>
          )}
          <AnimatePresence mode="wait">
            <motion.div
              key={topKey}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              {outlet}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Quick navigation">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
          <Home size={20} /> Home
        </NavLink>
        <NavLink to="/new" className={({ isActive }) => (isActive ? 'active' : '')}>
          <Plus size={20} /> New exam
        </NavLink>
        <NavLink to="/focus" className={({ isActive }) => (isActive ? 'active' : '')}>
          <Flower2 size={20} /> Focus
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
          <SettingsIcon size={20} /> Settings
        </NavLink>
      </nav>
      <FocusGuard />
    </div>
  )
}
