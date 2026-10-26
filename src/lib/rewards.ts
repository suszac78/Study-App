import { dayKey } from './motivation'
import { getDb, uid, updateDb } from './store'
import type { Db, RareSeed, Rarity, Spend } from './types'

// Fun features cost tokens, and tokens only come from studying.

export const STARTER_TOKENS = 2
export const FOCUS_MIN_PER_TOKEN = 15
export const CARDS_PER_TOKEN = 15
export const FREE_SHREDS_PER_DAY = 2

const focusMinutes = (db: Db) => db.focusSessions.filter((s) => s.status === 'grown').reduce((s, x) => s + x.minutes, 0)
const cardsReviewed = (db: Db) => db.flashcards.filter((c) => c.lastReviewed).length

export function tokensEarned(db: Db) {
  return STARTER_TOKENS + Math.floor(focusMinutes(db) / FOCUS_MIN_PER_TOKEN) + db.attempts.length + Math.floor(cardsReviewed(db) / CARDS_PER_TOKEN)
}

export function tokenBalance(db: Db) {
  return tokensEarned(db) - db.rewards.spends.reduce((s, x) => s + x.cost, 0)
}

/** How close the student is to their next token, for the progress hint. */
export function nextToken(db: Db) {
  const min = focusMinutes(db) % FOCUS_MIN_PER_TOKEN
  return { focusLeft: FOCUS_MIN_PER_TOKEN - min, progress: min / FOCUS_MIN_PER_TOKEN }
}

export function freeShredsLeft(db: Db) {
  const today = dayKey(Date.now())
  const used = db.rewards.spends.filter((s) => s.item === 'shred' && dayKey(s.ts) === today).length
  return Math.max(0, FREE_SHREDS_PER_DAY - used)
}

/** Records a use. Returns false (and records nothing) if it can't be afforded. */
export function spend(item: Spend['item'], cost: number): boolean {
  const db = getDb()
  if (cost > 0 && tokenBalance(db) < cost) return false
  updateDb((d) => ({ ...d, rewards: { ...d.rewards, spends: [...d.rewards.spends, { ts: Date.now(), item, cost }] } }))
  return true
}

const NAMES: Record<Rarity, string[]> = {
  common: ['Desk Daisy', 'Highlighter Tulip', 'Pencil Fern', 'Margin Moss', 'Library Lily'],
  rare: ['Golden Sunflower', 'Midnight Orchid', 'Silver Cram Rose', 'Firefly Bloom'],
  legendary: ['Rainbow Scholar Tree', 'Crystal A+ Lotus', 'Phoenix Flower of Finals'],
}

export function openMysterySeed(): RareSeed | null {
  if (!spend('seed', 1)) return null
  const roll = Math.random()
  const rarity: Rarity = roll < 0.1 ? 'legendary' : roll < 0.4 ? 'rare' : 'common'
  const names = NAMES[rarity]
  const seed: RareSeed = { id: uid(), ts: Date.now(), rarity, name: names[Math.floor(Math.random() * names.length)], seed: Math.floor(Math.random() * 1000) + 1 }
  updateDb((d) => ({ ...d, rewards: { ...d.rewards, seeds: [...d.rewards.seeds, seed] } }))
  return seed
}

export function recordSpeedScore(score: number) {
  updateDb((d) => ({ ...d, rewards: { ...d.rewards, bestSpeed: Math.max(d.rewards.bestSpeed, score) } }))
}
