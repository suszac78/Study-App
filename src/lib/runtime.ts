import { useSyncExternalStore } from 'react'

// Detects the built-in Claude runtime that exists when the app is opened as a
// claude.ai page. There, AI calls use the viewer's own Claude plan (no key).

export type RuntimeState = 'checking' | 'ready' | 'absent'

let state: RuntimeState = typeof window !== 'undefined' && window.claude?.use ? 'checking' : 'absent'
let sampleFn: SampleFn | null = null
let downloads: DownloadsNs | null = null
let imageLimits: { maxCount: number; mediaTypes: string[] } | null = null
const listeners = new Set<() => void>()

if (state === 'checking') {
  window.claude!.use('sample')
    .then(async (s) => {
      sampleFn = s
      state = s ? 'ready' : 'absent'
      if (s) {
        const l = await s.limits().catch(() => null)
        imageLimits = l?.images ?? null
      }
    })
    .catch(() => {
      state = 'absent'
    })
    .finally(() => listeners.forEach((l) => l()))
  window.claude!.use('downloads').then((d) => (downloads = d)).catch(() => {})
}

export const getSample = () => sampleFn
export const getDownloads = () => downloads
export const getImageLimits = () => imageLimits
export const getRuntimeState = () => state

export function useRuntime() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => state,
  )
}
