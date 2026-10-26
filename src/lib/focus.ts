import { getDb, uid, updateDb } from './store'
import type { ActiveFocus, FocusSession } from './types'

/** Seconds you may spend outside the app before your plant withers. */
export const GRACE_SECONDS = 60

export function startFocus(minutes: number, label: string, examId: string | null) {
  const now = Date.now()
  const active: ActiveFocus = {
    id: uid(),
    examId,
    label: label.trim(),
    minutes,
    startedAt: now,
    awayMs: 0,
    lastSeen: now,
    seed: Math.floor(Math.random() * 1000) + 1,
  }
  updateDb((d) => ({ ...d, activeFocus: active }))
}

export function endsAt(a: ActiveFocus) {
  return a.startedAt + a.minutes * 60_000
}

export function finishFocus(status: FocusSession['status']): FocusSession | null {
  const a = getDb().activeFocus
  if (!a) return null
  const session: FocusSession = {
    id: a.id,
    examId: a.examId,
    label: a.label,
    minutes: a.minutes,
    startedAt: a.startedAt,
    endedAt: Math.min(Date.now(), endsAt(a)),
    status,
    awaySeconds: Math.round(a.awayMs / 1000),
    seed: a.seed,
  }
  updateDb((d) => ({ ...d, activeFocus: null, focusSessions: [...d.focusSessions, session] }))
  return session
}

/** Count time spent away from the app (only time before the session ended). */
export function addAway(fromTs: number, toTs: number) {
  const a = getDb().activeFocus
  if (!a) return
  const ms = Math.max(0, Math.min(toTs, endsAt(a)) - Math.max(fromTs, a.startedAt))
  if (ms < 1500) return
  updateDb((d) => (d.activeFocus ? { ...d, activeFocus: { ...d.activeFocus, awayMs: d.activeFocus.awayMs + ms, lastSeen: toTs } } : d))
}

export function heartbeat() {
  updateDb((d) => (d.activeFocus ? { ...d, activeFocus: { ...d.activeFocus, lastSeen: Date.now() } } : d))
}

/** A short two-note chime (allowed because the session was started by a click). */
export function chime(happy = true) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const notes = happy ? [523.25, 783.99] : [392, 261.63]
    notes.forEach((f, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = f
      const t = ctx.currentTime + i * 0.18
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.2, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
      o.connect(g).connect(ctx.destination)
      o.start(t)
      o.stop(t + 0.55)
    })
    setTimeout(() => ctx.close(), 1200)
  } catch {
    /* sound is optional */
  }
}
