import { unzipSync } from 'fflate'
import { htmlToText, type CourseItem, type CourseModule } from './course'

// Reads an EPUB (2 or 3) book in the browser and returns its text, one module
// per top-level chapter from the book's table of contents.

const decoder = new TextDecoder()

function xml(bytes: Uint8Array) {
  return new DOMParser().parseFromString(decoder.decode(bytes), 'application/xml')
}

const byLocal = (root: Document | Element, name: string) => Array.from(root.getElementsByTagNameNS('*', name))

/** Resolve `href` relative to the folder of `fromFile`, dropping any #fragment. */
function resolve(fromFile: string, href: string) {
  const clean = decodeURIComponent(href.split('#')[0])
  const parts = fromFile.split('/').slice(0, -1)
  for (const seg of clean.split('/')) {
    if (seg === '..') parts.pop()
    else if (seg && seg !== '.') parts.push(seg)
  }
  return parts.join('/')
}

interface TocEntry {
  title: string
  path: string
}

/**
 * Chapter starts from the table of contents (EPUB 3 nav or EPUB 2 NCX). Uses the
 * top level, or the top two levels when the top level is only a few "Parts".
 */
function readToc(files: Record<string, Uint8Array>, navPath: string | null, ncxPath: string | null): TocEntry[] {
  const entries: (TocEntry & { depth: number })[] = []
  if (navPath && files[navPath]) {
    const doc = new DOMParser().parseFromString(decoder.decode(files[navPath]), 'text/html')
    const nav =
      Array.from(doc.querySelectorAll('nav')).find((n) => (n.getAttribute('epub:type') ?? n.getAttribute('type') ?? '').includes('toc')) ??
      doc.querySelector('nav')
    const walk = (list: Element | null | undefined, depth: number) => {
      if (!list || depth > 1) return
      for (const li of Array.from(list.children).filter((c) => c.tagName === 'LI')) {
        const a = Array.from(li.children).find((c) => c.tagName === 'A' || c.tagName === 'SPAN')
        const href = a?.getAttribute('href')
        const t = (a?.textContent ?? '').trim()
        if (href && t) entries.push({ title: t, path: resolve(navPath, href), depth })
        walk(Array.from(li.children).find((c) => c.tagName === 'OL' || c.tagName === 'UL'), depth + 1)
      }
    }
    walk(nav?.querySelector('ol, ul'), 0)
  }
  if (!entries.length && ncxPath && files[ncxPath]) {
    const walk = (el: Element | undefined, depth: number) => {
      if (!el || depth > 1) return
      for (const p of Array.from(el.children).filter((c) => c.localName === 'navPoint')) {
        const label = Array.from(p.children).find((c) => c.localName === 'navLabel')?.textContent?.trim() ?? ''
        const src = Array.from(p.children).find((c) => c.localName === 'content')?.getAttribute('src') ?? ''
        if (label && src) entries.push({ title: label, path: resolve(ncxPath, src), depth })
        walk(p, depth + 1)
      }
    }
    walk(byLocal(xml(files[ncxPath]), 'navMap')[0], 0)
  }
  const top = entries.filter((e) => e.depth === 0)
  return top.length >= 4 || entries.length === top.length ? top : entries
}

export interface ParsedEpub {
  title: string
  modules: CourseModule[]
  skipped: number
}

export function parseEpub(bytes: Uint8Array, fileName: string, onStatus: (s: string) => void): ParsedEpub {
  const files = unzipSync(bytes, { filter: (f) => /\.(xhtml|html?|xml|opf|ncx)$/i.test(f.name) || f.name === 'mimetype' })
  const fallbackTitle = fileName.replace(/\.epub$/i, '').replace(/[_-]+/g, ' ')

  // DRM-protected books have encrypted chapter files we cannot read.
  const enc = files['META-INF/encryption.xml']
  if (enc) {
    const encrypted = byLocal(xml(enc), 'CipherReference')
      .map((c) => c.getAttribute('URI') ?? '')
      .filter((u) => /\.(x?html?)$/i.test(u))
    if (encrypted.length) {
      throw new Error(
        `"${fallbackTitle}" is DRM-protected (locked to an e-reader app), so its text can't be read. Use a DRM-free EPUB, or export the chapters as PDF.`,
      )
    }
  }

  const container = files['META-INF/container.xml']
  const opfPath =
    (container && byLocal(xml(container), 'rootfile')[0]?.getAttribute('full-path')) || Object.keys(files).find((f) => f.endsWith('.opf'))
  if (!opfPath || !files[opfPath]) throw new Error(`"${fallbackTitle}" doesn't look like a valid EPUB file.`)

  const opf = xml(files[opfPath])
  const title = byLocal(opf, 'title')[0]?.textContent?.trim() || fallbackTitle

  const manifest = new Map<string, { path: string; type: string; props: string }>()
  for (const it of byLocal(opf, 'item')) {
    manifest.set(it.getAttribute('id') ?? '', {
      path: resolve(opfPath, it.getAttribute('href') ?? ''),
      type: it.getAttribute('media-type') ?? '',
      props: it.getAttribute('properties') ?? '',
    })
  }
  const spine = byLocal(opf, 'itemref')
    .map((r) => manifest.get(r.getAttribute('idref') ?? ''))
    .filter((m): m is { path: string; type: string; props: string } => !!m && /html/.test(m.type))
    .map((m) => m.path)

  const navPath = [...manifest.values()].find((m) => m.props.split(/\s+/).includes('nav'))?.path ?? null
  const ncxPath = [...manifest.values()].find((m) => m.type === 'application/x-dtbncx+xml')?.path ?? null
  const toc = readToc(files, navPath, ncxPath)

  // Read every spine document once.
  let skipped = 0
  const docs: { path: string; text: string; heading: string; empty: boolean }[] = []
  spine.forEach((path, i) => {
    onStatus(`Reading ${title}: section ${i + 1} of ${spine.length}`)
    const raw = files[path]
    const html = raw ? decoder.decode(raw) : ''
    const text = html ? htmlToText(html) : ''
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const heading = (doc.querySelector('h1, h2, h3')?.textContent ?? doc.title ?? '').replace(/\s+/g, ' ').trim()
    // Covers, copyright and image-only pages have little or no text.
    const empty = text.length < 40
    if (empty) skipped++
    docs.push({ path, text, heading, empty })
  })
  if (docs.every((d) => d.empty)) throw new Error(`No readable text found in "${title}". It may contain only scanned page images.`)

  // Group spine documents under TOC chapters, in reading order. A chapter whose
  // first page is just a title page starts at its next page with text.
  const starts = new Map<string, string>()
  for (const t of toc) if (!starts.has(t.path)) starts.set(t.path, t.title)
  const modules: CourseModule[] = []
  let current: CourseModule | null = null
  let pending: string | null = null
  for (const d of docs) {
    const chapter = starts.get(d.path)
    if (chapter) pending = chapter
    if (d.empty) continue
    if (pending || !current) {
      current = { title: pending ?? (d.heading || 'Front matter'), items: [] }
      modules.push(current)
      pending = null
    }
    const item: CourseItem = { title: d.heading || current.title, path: d.path, kind: 'page', text: d.text }
    current.items.push(item)
  }
  return { title, modules, skipped }
}

/** Plain text of a whole EPUB, for single-file note uploads. */
export function epubToText(bytes: Uint8Array, fileName: string): string {
  const book = parseEpub(bytes, fileName, () => {})
  return book.modules.map((m) => `# ${m.title}\n\n${m.items.map((i) => i.text).join('\n\n')}`).join('\n\n')
}
