import { unzipSync } from 'fflate'
import { pdfToText } from './files'

// Reads a Canvas course export (.imscc / .zip Common Cartridge), any zip of
// course files, or a picked folder, and extracts readable text grouped by module.

export type ItemKind = 'page' | 'pdf' | 'doc' | 'slides' | 'quiz' | 'text' | 'discussion'

export interface CourseItem {
  title: string
  path: string
  kind: ItemKind
  text: string
}

export interface CourseModule {
  title: string
  items: CourseItem[]
}

export interface ParsedCourse {
  title: string
  syllabus: string
  modules: CourseModule[]
  skipped: number
}

type Loader = () => Promise<Uint8Array>

const MAX_FILE_BYTES = 60 * 1024 * 1024
const EXTRACTABLE = /\.(html?|pdf|docx|pptx|txt|md|markdown|csv|qti|xml)$/i
const decoder = new TextDecoder()

const ext = (p: string) => (p.match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase()
const base = (p: string) =>
  decodeURIComponent(p.split('/').pop() ?? p)
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim()

function kindOf(path: string): ItemKind | null {
  const e = ext(path)
  if (e === 'html' || e === 'htm') return 'page'
  if (e === 'pdf') return 'pdf'
  if (e === 'docx') return 'doc'
  if (e === 'pptx') return 'slides'
  if (e === 'txt' || e === 'md' || e === 'markdown' || e === 'csv') return 'text'
  if (e === 'qti' || (e === 'xml' && /assessment|quiz|qti/i.test(path))) return 'quiz'
  return null
}

// ---------- text extractors ----------

export function htmlToText(html: string): string {
  const marked = html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, '')
    .replace(/<h[1-3][^>]*>/gi, '\n\n## ')
    .replace(/<h[4-6][^>]*>/gi, '\n\n### ')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|h[1-6]|tr|table|ul|ol|blockquote|section|article)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' | ')
  const doc = new DOMParser().parseFromString(marked, 'text/html')
  return (doc.body.textContent ?? '')
    .replace(/\$IMS-CC-FILEBASE\$\/?/g, '')
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function xmlDoc(bytes: Uint8Array) {
  return new DOMParser().parseFromString(decoder.decode(bytes), 'application/xml')
}

const byLocal = (root: Document | Element, name: string) => Array.from(root.getElementsByTagNameNS('*', name))

export function docxToText(bytes: Uint8Array): string {
  const files = unzipSync(bytes, { filter: (f) => f.name === 'word/document.xml' })
  const xml = files['word/document.xml']
  if (!xml) return ''
  return byLocal(xmlDoc(xml), 'p')
    .map((p) => byLocal(p, 't').map((t) => t.textContent).join(''))
    .filter((l) => l.trim())
    .join('\n')
}

export function pptxToText(bytes: Uint8Array): string {
  const files = unzipSync(bytes, { filter: (f) => /^ppt\/slides\/slide\d+\.xml$/.test(f.name) })
  return Object.keys(files)
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)![1]) - Number(b.match(/(\d+)\.xml$/)![1]))
    .map((name, i) => {
      const lines = byLocal(xmlDoc(files[name]), 'p')
        .map((p) => byLocal(p, 't').map((t) => t.textContent).join(''))
        .filter((l) => l.trim())
      return lines.length ? `### Slide ${i + 1}\n${lines.join('\n')}` : ''
    })
    .filter(Boolean)
    .join('\n\n')
}

function qtiToText(bytes: Uint8Array): string {
  const doc = xmlDoc(bytes)
  const items = byLocal(doc, 'item')
  if (!items.length) return byLocal(doc, 'mattext').map((m) => htmlToText(m.textContent ?? '')).join('\n')
  return items
    .map((item, i) => {
      const texts = byLocal(item, 'mattext').map((m) => htmlToText(m.textContent ?? '')).filter(Boolean)
      if (!texts.length) return ''
      const [q, ...opts] = texts
      return `Q${i + 1}. ${q}${opts.length ? '\n' + opts.map((o) => `- ${o}`).join('\n') : ''}`
    })
    .filter(Boolean)
    .join('\n\n')
}

function discussionToText(bytes: Uint8Array): string {
  const doc = xmlDoc(bytes)
  const title = byLocal(doc, 'title')[0]?.textContent ?? ''
  const body = byLocal(doc, 'text')[0]?.textContent ?? ''
  return [title && `## ${title}`, htmlToText(body)].filter(Boolean).join('\n')
}

/** Extract readable text from one file's bytes, by type. */
export async function extractText(path: string, bytes: Uint8Array, kind = kindOf(path)): Promise<string> {
  switch (kind) {
    case 'page':
      return htmlToText(decoder.decode(bytes))
    case 'pdf':
      return pdfToText(new File([bytes as BlobPart], base(path) + '.pdf', { type: 'application/pdf' }))
    case 'doc':
      return docxToText(bytes)
    case 'slides':
      return pptxToText(bytes)
    case 'quiz':
      return qtiToText(bytes)
    case 'discussion':
      return discussionToText(bytes)
    case 'text':
      return decoder.decode(bytes)
    default:
      return ''
  }
}

// ---------- reading inputs ----------

function readArchive(bytes: Uint8Array): Map<string, Loader> {
  const files = unzipSync(bytes, {
    filter: (f) =>
      f.originalSize <= MAX_FILE_BYTES &&
      (f.name === 'imsmanifest.xml' || f.name.startsWith('course_settings/') || EXTRACTABLE.test(f.name)),
  })
  const map = new Map<string, Loader>()
  for (const [name, data] of Object.entries(files)) if (!name.endsWith('/')) map.set(name, async () => data)
  return map
}

async function readInputs(inputs: File[]): Promise<{ files: Map<string, Loader>; name: string }> {
  const archive = inputs.find((f) => /\.(imscc|zip)$/i.test(f.name))
  if (archive && inputs.length === 1) {
    return { files: readArchive(new Uint8Array(await archive.arrayBuffer())), name: base(archive.name) }
  }
  const files = new Map<string, Loader>()
  for (const f of inputs) {
    const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name
    if (/\.(imscc|zip)$/i.test(f.name)) {
      const inner = readArchive(new Uint8Array(await f.arrayBuffer()))
      for (const [k, v] of inner) files.set(`${base(f.name)}/${k}`, v)
    } else if (f.size <= MAX_FILE_BYTES && (EXTRACTABLE.test(rel) || rel.endsWith('imsmanifest.xml'))) {
      files.set(rel, async () => new Uint8Array(await f.arrayBuffer()))
    }
  }
  // A picked folder: strip the shared top folder so manifest paths line up.
  const tops = new Set([...files.keys()].map((k) => k.split('/')[0]))
  let name = inputs.length === 1 ? base(inputs[0].name) : 'Course files'
  if (tops.size === 1 && [...files.keys()].every((k) => k.includes('/'))) {
    const top = [...tops][0]
    name = top
    const stripped = new Map<string, Loader>()
    for (const [k, v] of files) stripped.set(k.slice(top.length + 1), v)
    return { files: stripped, name }
  }
  return { files, name }
}

// ---------- Common Cartridge manifest ----------

interface Resource {
  type: string
  href: string
  files: string[]
}

function pickFile(res: Resource, files: Map<string, Loader>): { path: string; kind: ItemKind } | null {
  const candidates = [res.href, ...res.files].filter((p) => p && files.has(p))
  if (/imsdt/i.test(res.type)) {
    const p = candidates.find((c) => ext(c) === 'xml')
    return p ? { path: p, kind: 'discussion' } : null
  }
  if (/qti|assessment/i.test(res.type)) {
    const p = candidates.find((c) => /qti|assessment/i.test(c))
    if (p) return { path: p, kind: 'quiz' }
  }
  for (const want of ['page', 'pdf', 'doc', 'slides', 'text', 'quiz'] as ItemKind[]) {
    const p = candidates.find((c) => kindOf(c) === want)
    if (p) return { path: p, kind: want }
  }
  return null
}

function parseManifest(xml: Uint8Array) {
  const doc = xmlDoc(xml)
  const resources = new Map<string, Resource>()
  for (const r of byLocal(doc, 'resource')) {
    resources.set(r.getAttribute('identifier') ?? '', {
      type: r.getAttribute('type') ?? '',
      href: r.getAttribute('href') ?? '',
      files: byLocal(r, 'file').map((f) => f.getAttribute('href') ?? ''),
    })
  }
  const org = byLocal(doc, 'organization')[0]
  const childItems = (el: Element) => Array.from(el.children).filter((c) => c.localName === 'item')
  const titleOf = (el: Element) => Array.from(el.children).find((c) => c.localName === 'title')?.textContent?.trim() ?? ''
  let tops = org ? childItems(org) : []
  // Canvas wraps modules in one untitled root item.
  while (tops.length === 1 && !tops[0].getAttribute('identifierref') && !titleOf(tops[0])) tops = childItems(tops[0])
  const modules = tops.map((m) => {
    const leaves: { title: string; ref: string }[] = []
    const walk = (el: Element) => {
      const ref = el.getAttribute('identifierref')
      if (ref) leaves.push({ title: titleOf(el), ref })
      childItems(el).forEach(walk)
    }
    walk(m)
    return { title: titleOf(m) || 'Untitled module', leaves }
  })
  const lomTitle = byLocal(doc, 'string')[0]?.textContent?.trim() ?? ''
  return { resources, modules, lomTitle }
}

// ---------- main ----------

export async function parseCourse(inputs: File[], onStatus: (s: string) => void): Promise<ParsedCourse> {
  onStatus('Unpacking files…')
  const { files, name } = await readInputs(inputs)
  if (!files.size) throw new Error('No readable files found. Use the Canvas course export (.imscc), a .zip, or a folder of PDFs, Word, PowerPoint or HTML files.')

  let title = name
  const settings = files.get('course_settings/course_settings.xml')
  if (settings) title = byLocal(xmlDoc(await settings()), 'title')[0]?.textContent?.trim() || title
  const syllabusFile = files.get('course_settings/syllabus.html')
  const syllabus = syllabusFile ? htmlToText(decoder.decode(await syllabusFile())) : ''

  const used = new Set<string>(['course_settings/syllabus.html'])
  const modules: CourseModule[] = []
  let skipped = 0
  let done = 0
  const total = files.size

  const readItem = async (path: string, kind: ItemKind, itemTitle: string): Promise<CourseItem | null> => {
    used.add(path)
    onStatus(`Reading ${++done} of ${total}: ${itemTitle}`)
    try {
      const text = (await extractText(path, await files.get(path)!(), kind)).trim()
      if (text.length < 15) {
        skipped++
        return null
      }
      return { title: itemTitle, path, kind, text }
    } catch {
      skipped++
      return null
    }
  }

  const manifest = files.get('imsmanifest.xml')
  if (manifest) {
    const m = parseManifest(await manifest())
    if (title === name && m.lomTitle) title = m.lomTitle
    for (const mod of m.modules) {
      const items: CourseItem[] = []
      for (const leaf of mod.leaves) {
        const res = m.resources.get(leaf.ref)
        const pick = res && pickFile(res, files)
        if (!pick || used.has(pick.path)) continue
        const item = await readItem(pick.path, pick.kind, leaf.title || base(pick.path))
        if (item) items.push(item)
      }
      if (items.length) modules.push({ title: mod.title, items })
    }
  }

  // Everything readable that no module referenced, grouped by folder.
  const leftovers = new Map<string, CourseItem[]>()
  for (const path of [...files.keys()].sort()) {
    if (used.has(path) || path === 'imsmanifest.xml' || path.startsWith('course_settings/')) continue
    const kind = kindOf(path)
    if (!kind) continue
    if (kind === 'quiz' && !/qti|assessment/i.test(path)) continue
    const item = await readItem(path, kind, base(path))
    if (!item) continue
    const parts = path.split('/')
    const folder = manifest ? 'Other course files' : parts.length > 1 ? decodeURIComponent(parts[parts.length - 2]).replace(/[_-]+/g, ' ') : 'Course files'
    leftovers.set(folder, [...(leftovers.get(folder) ?? []), item])
  }
  for (const [folder, items] of leftovers) modules.push({ title: folder, items })

  if (!modules.length && !syllabus) throw new Error('Could not find any readable content in that export.')
  return { title, syllabus, modules, skipped }
}

/** Join a module into note text, split into parts small enough for one AI request. */
export function moduleToParts(mod: CourseModule, maxChars = 100_000): string[] {
  const parts: string[] = []
  let cur = ''
  for (const it of mod.items) {
    const block = `## ${it.title}\n\n${it.text}\n\n`
    if (cur && cur.length + block.length > maxChars) {
      parts.push(cur)
      cur = ''
    }
    if (block.length > maxChars) {
      for (let i = 0; i < block.length; i += maxChars) parts.push(block.slice(i, i + maxChars))
    } else cur += block
  }
  if (cur.trim()) parts.push(cur)
  return parts
}

export const KIND_LABEL: Record<ItemKind, string> = {
  page: 'page',
  pdf: 'PDF',
  doc: 'Word',
  slides: 'slides',
  quiz: 'quiz',
  text: 'text',
  discussion: 'discussion',
}
