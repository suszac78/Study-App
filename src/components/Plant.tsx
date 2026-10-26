import { motion } from 'motion/react'
import type { Rarity } from '../lib/types'

/**
 * A potted plant that grows with `progress` (0..1). Longer sessions grow
 * bigger plants with more leaves and blooms; a withered plant droops brown.
 */
export function Plant({ progress, withered = false, seed = 1, minutes = 25, size = 120, rarity }: { progress: number; withered?: boolean; seed?: number; minutes?: number; size?: number; rarity?: Rarity }) {
  const p = Math.max(0, Math.min(1, progress))
  const hue = Math.round((seed * 137.5) % 360)
  const petalFor = (i: number) =>
    withered ? 'var(--wither)' : rarity === 'legendary' ? `hsl(${(hue + i * 72) % 360} 90% 62%)` : rarity === 'rare' ? `hsl(${44 + i * 3} 95% ${55 + (i % 2) * 8}%)` : `hsl(${hue} 80% 65%)`
  const leaf = withered ? 'var(--wither)' : 'var(--leaf)'
  const tall = minutes >= 45 ? 72 : minutes >= 25 ? 62 : 48
  const stemH = 6 + tall * p
  const top = 104 - stemH
  const leafCount = minutes >= 45 ? 6 : minutes >= 25 ? 4 : 3
  const blooms = minutes >= 45 ? 2 : 1
  const droop = withered ? 1 : 0

  return (
    <svg viewBox="0 0 120 140" width={size} height={(size * 140) / 120} role="img" aria-label={withered ? 'Withered plant' : `Plant ${Math.round(p * 100)}% grown`}>
      {/* soil shadow */}
      <ellipse cx="60" cy="134" rx="34" ry="4" fill="var(--border-strong)" />
      {/* stem */}
      <motion.path
        d={withered ? `M60 104 Q62 ${104 - stemH * 0.6} ${75} ${104 - stemH * 0.7}` : `M60 104 Q${58 + Math.sin(seed) * 4} ${104 - stemH / 2} 60 ${top}`}
        stroke={leaf}
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
        initial={false}
        animate={{ d: withered ? `M60 104 Q62 ${104 - stemH * 0.6} ${75} ${104 - stemH * 0.7}` : `M60 104 Q${58 + Math.sin(seed) * 4} ${104 - stemH / 2} 60 ${top}` }}
        transition={{ duration: 0.8 }}
      />
      {/* leaves appear as the plant grows */}
      {Array.from({ length: leafCount }, (_, i) => {
        const at = (i + 1) / (leafCount + 1)
        if (p < at * 0.95) return null
        const y = 104 - stemH * at
        const side = i % 2 ? 1 : -1
        const rot = side * (withered ? 70 : 35) + droop * 20
        return (
          <motion.ellipse
            key={i}
            cx={60 + side * 9}
            cy={y}
            rx="10"
            ry="4.5"
            fill={leaf}
            initial={{ scale: 0 }}
            animate={{ scale: 1, rotate: rot }}
            transition={{ type: 'spring', stiffness: 260, damping: 14 }}
            style={{ transformOrigin: `${60}px ${y}px` }}
          />
        )
      })}
      {/* bloom(s) at full growth */}
      {p >= 1 &&
        Array.from({ length: blooms }, (_, b) => {
          const cx = withered ? 74 : 60 + (b ? 14 : 0)
          const cy = withered ? 104 - stemH * 0.7 + 6 : top - (b ? -14 : 0)
          return (
            <motion.g key={b} initial={{ scale: 0, rotate: -40 }} animate={{ scale: withered ? 0.7 : 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 12, delay: b * 0.15 }} style={{ transformOrigin: `${cx}px ${cy}px` }}>
              {[0, 72, 144, 216, 288].map((a) => (
                <ellipse key={a} cx={cx} cy={cy - 7} rx="4.5" ry="8" fill={petalFor(a / 72)} transform={`rotate(${a} ${cx} ${cy})`} />
              ))}
              <circle cx={cx} cy={cy} r="4" fill={withered ? 'var(--text-3)' : 'var(--highlight)'} />
            </motion.g>
          )
        })}
      {/* sparkles for rare plants */}
      {rarity && rarity !== 'common' && !withered &&
        [
          [28, 30],
          [92, 22],
          [96, 70],
          [24, 78],
        ].map(([x, y], i) => (
          <motion.path
            key={i}
            d={`M${x} ${y - 5} L${x + 1.5} ${y - 1.5} L${x + 5} ${y} L${x + 1.5} ${y + 1.5} L${x} ${y + 5} L${x - 1.5} ${y + 1.5} L${x - 5} ${y} L${x - 1.5} ${y - 1.5} Z`}
            fill={rarity === 'legendary' ? 'var(--accent)' : 'var(--highlight)'}
            animate={{ opacity: [0.2, 1, 0.2], scale: [0.7, 1.1, 0.7] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.4 }}
            style={{ transformOrigin: `${x}px ${y}px` }}
          />
        ))}
      {/* sprout tip before blooming */}
      {p < 1 && !withered && <circle cx="60" cy={top} r="3" fill={leaf} />}
      {/* pot */}
      <path d="M36 104 H84 L78 132 H42 Z" fill="var(--pot)" />
      <rect x="32" y="98" width="56" height="9" rx="3" fill="var(--pot-rim)" />
    </svg>
  )
}
