import { motion } from 'motion/react'
import { CheckCircle2, Circle, Flame, Trophy } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { dailyQuests, level, streak, xp } from '../lib/motivation'
import { useDb } from '../lib/store'
import { Meter } from './ui'

export function useMotivation() {
  const db = useDb()
  return useMemo(() => {
    const points = xp(db)
    return { streak: streak(db), points, lvl: level(points), quests: dailyQuests(db) }
  }, [db])
}

export function StreakBadge({ days, activeToday }: { days: number; activeToday: boolean }) {
  return (
    <span className="flame" title={activeToday ? 'Streak secured for today' : 'Study today to keep your streak'} style={{ color: activeToday ? 'var(--accent)' : 'var(--text-3)' }}>
      <motion.span animate={activeToday ? { scale: [1, 1.15, 1] } : undefined} transition={{ duration: 1.6, repeat: Infinity }} style={{ display: 'inline-flex' }}>
        <Flame size={18} fill={activeToday ? 'currentColor' : 'none'} />
      </motion.span>
      {days}
    </span>
  )
}

export function StreakLevel() {
  const { streak: s, points, lvl } = useMotivation()
  return (
    <div className="grid grid-2" style={{ gap: 14 }}>
      <div className="stack sm">
        <span className="subtle xs">Daily streak</span>
        <div className="row" style={{ gap: 10 }}>
          <span style={{ fontSize: 'var(--fs-xl)' }}><StreakBadge days={s.days} activeToday={s.activeToday} /></span>
          <span className="subtle xs">
            {s.activeToday ? 'Secured for today' : s.days ? 'Study today or it resets at midnight' : 'Study today to start one'}
            {s.best > s.days ? ` · best ${s.best}` : ''}
          </span>
        </div>
      </div>
      <div className="stack sm">
        <div className="row between xs">
          <span className="subtle">Level {lvl.level}</span>
          <span className="subtle mono">{points} XP</span>
        </div>
        <strong className="row" style={{ gap: 6 }}>
          <Trophy size={16} color="var(--highlight)" /> {lvl.title}
        </strong>
        <Meter value={lvl.into / lvl.needed} tone="" />
        <span className="hint">{lvl.needed - lvl.into} XP to level {lvl.level + 1}</span>
      </div>
    </div>
  )
}

export function Quests() {
  const { quests } = useMotivation()
  const done = quests.filter((q) => q.progress >= q.goal).length
  return (
    <div className="stack sm">
      <div className="row between">
        <strong className="small">Today's quests</strong>
        <span className="subtle xs">{done}/{quests.length} done{done === quests.length ? ' · legendary' : ''}</span>
      </div>
      <div>
        {quests.map((q) => {
          const complete = q.progress >= q.goal
          return (
            <Link key={q.id} to={q.to} className={`quest ${complete ? 'done' : ''}`}>
              {complete ? <CheckCircle2 size={20} color="var(--success)" /> : <Circle size={20} color="var(--text-3)" />}
              <div className="stack sm">
                <span className="q-label small">{q.label}</span>
                {!complete && <Meter value={q.progress / q.goal} tone="" />}
              </div>
              <span className="badge accent">+{q.reward} XP</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
