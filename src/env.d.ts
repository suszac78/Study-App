/// <reference types="vite/client" />

declare module 'pdfjs-dist/build/pdf.worker.min.mjs'

// Minimal typing for the claude.ai page runtime (window.claude.use).
interface SampleUpdate { text: string; delta: string }
interface SampleOpts {
  onText?: (u: SampleUpdate) => void
  signal?: AbortSignal
  images?: Blob[]
  modelTier?: 'quick' | 'default' | 'complex'
  effort?: 'low' | 'medium' | 'high'
  cache?: boolean
}
type SampleTurn = { role: 'user' | 'assistant'; content: string }
interface SampleFn {
  (input: string | SampleTurn[], opts?: SampleOpts): Promise<{ text: string; truncated: boolean }>
  json<T = unknown>(input: string | SampleTurn[], opts?: SampleOpts): Promise<T>
  limits(): Promise<{ maxPromptBytes: number; images?: { maxCount: number; maxInputBytes: number; mediaTypes: string[] } }>
}
interface DownloadsNs {
  save(file: { filename: string; data: string | Blob }): Promise<unknown>
}
type PermissionState = 'granted' | 'prompt' | 'denied' | 'unavailable'
interface PermissionsNs {
  state(name: string): Promise<PermissionState>
  manage(): Promise<void>
}
interface Window {
  claude?: {
    use(name: 'sample'): Promise<SampleFn | null>
    use(name: 'downloads'): Promise<DownloadsNs | null>
    use(name: 'permissions'): Promise<PermissionsNs | null>
  }
}
