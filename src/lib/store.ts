import { useSyncExternalStore } from 'react'
import type { Db, Settings } from './types'

// The study database lives in IndexedDB (room for whole courses); small
// settings live in localStorage. Both are local to this browser.

const LEGACY_DB_KEY = 'studypilot.db.v1'
const SETTINGS_KEY = 'studypilot.settings.v1'
const IDB_NAME = 'studypilot'
const IDB_STORE = 'kv'

const emptyDb = (): Db => ({
  exams: [],
  notes: [],
  quizzes: [],
  attempts: [],
  flashcards: [],
  tips: [],
  chats: {},
  focusSessions: [],
  activeFocus: null,
})

export const defaultSettings: Settings = {
  apiKey: '',
  model: 'claude-opus-5-5',
  depth: 'balanced',
  theme: 'system',
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings
  } catch {
    return defaultSettings
  }
}

let db: Db = emptyDb()
let settings: Settings = loadSettings()
const listeners = new Set<() => void>()
let saveError: string | null = null

function emit() {
  listeners.forEach((l) => l())
}

// ---------- IndexedDB helpers ----------

let idbPromise: Promise<IDBDatabase> | null = null
function openIdb(): Promise<IDBDatabase> {
  idbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return idbPromise
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const idb = await openIdb()
  return new Promise((resolve, reject) => {
    const req = idb.transaction(IDB_STORE).objectStore(IDB_STORE).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const idb = await openIdb()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

let useIdb = true

/** Load saved data once at startup. Never throws. */
export async function initStore() {
  try {
    const saved = await idbGet<Db>('db')
    if (saved) {
      db = { ...emptyDb(), ...saved }
      return
    }
  } catch {
    useIdb = false
  }
  // First run, or IndexedDB unavailable: use (and migrate) localStorage data.
  try {
    const raw = localStorage.getItem(LEGACY_DB_KEY)
    if (raw) db = { ...emptyDb(), ...JSON.parse(raw) }
    if (raw && useIdb) persistNow()
  } catch {
    /* start empty */
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

function persistNow() {
  saveTimer = null
  const snapshot = db
  const fallback = () => {
    try {
      localStorage.setItem(LEGACY_DB_KEY, JSON.stringify(snapshot))
      saveError = null
    } catch {
      saveError = 'Could not save. Your browser storage is full or blocked. Export a backup in Settings.'
    }
    emit()
  }
  if (!useIdb) return fallback()
  idbSet('db', snapshot)
    .then(() => {
      if (saveError) {
        saveError = null
        emit()
      }
    })
    .catch(() => {
      useIdb = false
      fallback()
    })
}

function schedulePersist() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(persistNow, 250)
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      persistNow()
    }
  })
}

export function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export const getDb = () => db
export const getSettings = () => settings

export function updateDb(fn: (d: Db) => Db) {
  db = fn(db)
  schedulePersist()
  emit()
}

export function updateSettings(patch: Partial<Settings>) {
  settings = { ...settings, ...patch }
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    /* settings still apply for this visit */
  }
  emit()
}

export function replaceDb(next: Db) {
  db = { ...emptyDb(), ...next }
  schedulePersist()
  emit()
}

export function resetDb() {
  replaceDb(emptyDb())
}

// Returns the whole database (a stable reference until something changes).
// Derive filtered views with useMemo in the component.
export function useDb(): Db {
  return useSyncExternalStore(subscribe, () => db)
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, () => settings)
}

export function useSaveError() {
  return useSyncExternalStore(subscribe, () => saveError)
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
