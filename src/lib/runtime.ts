import { useSyncExternalStore } from 'react'

// Detects the built-in Claude runtime that exists when the app is opened as a
// claude.ai page. There, AI calls use the viewer's own Claude plan (no key).

export type RuntimeState = 'checking' | 'ready' | 'absent'

/** True when the page is running inside a claude.ai viewer at all. */
export const inViewer = typeof window !== 'undefined' && !!window.claude?.use
let state: RuntimeState = inViewer ? 'checking' : 'absent'
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

/** Whether this viewer allowed the page to use Claude ('denied' = they chose not to). */
export async function samplePermission(): Promise<PermissionState | 'unknown'> {
  try {
    const p = await window.claude?.use('permissions')
    return p ? await p.state('sample') : 'unknown'
  } catch {
    return 'unknown'
  }
}

/** Opens claude.ai's Permissions panel for this page. Returns false if it couldn't. */
export async function openPermissions(): Promise<boolean> {
  try {
    const p = await window.claude?.use('permissions')
    if (!p) return false
    await p.manage()
    return true
  } catch {
    return false
  }
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
