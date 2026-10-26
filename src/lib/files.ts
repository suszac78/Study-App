import type { BetaContentBlockParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'

export const ACCEPTED_FILES = '.pdf,.epub,.docx,.pptx,.html,.htm,.txt,.md,.markdown,.csv,.png,.jpg,.jpeg,.webp,.gif'
export const MAX_FILE_MB = 30

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const
type ImageType = (typeof IMAGE_TYPES)[number]

export function isPdf(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

export function imageType(file: File): ImageType | null {
  const t = file.type === 'image/jpg' ? 'image/jpeg' : file.type
  return (IMAGE_TYPES as readonly string[]).includes(t) ? (t as ImageType) : null
}

/** Word, PowerPoint and HTML files are turned into text in the browser. */
async function officeOrHtmlText(file: File): Promise<string | null> {
  const n = file.name.toLowerCase()
  if (n.endsWith('.epub')) {
    const { epubToText } = await import('./epub')
    return epubToText(new Uint8Array(await file.arrayBuffer()), file.name)
  }
  if (!/\.(docx|pptx|html?)$/.test(n)) return null
  const { extractText } = await import('./course')
  return extractText(n, new Uint8Array(await file.arrayBuffer()))
}

function checkSize(file: File) {
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    throw new Error(`${file.name} is larger than ${MAX_FILE_MB} MB. Split it into smaller files.`)
  }
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result)
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** Extract the text layer of a PDF in the browser (no network, no worker). */
export async function pdfToText(file: File): Promise<string> {
  // Loading the worker module on the main thread makes pdf.js run in-process,
  // which works inside sandboxed pages that block extra workers.
  await import('pdfjs-dist/build/pdf.worker.min.mjs')
  const pdfjs = await import('pdfjs-dist')
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  const doc = await task.promise
  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    let line = ''
    const lines: string[] = []
    for (const item of content.items) {
      if (!('str' in item)) continue
      line += item.str
      if (item.hasEOL) {
        lines.push(line)
        line = ''
      } else if (item.str && !item.str.endsWith(' ')) {
        line += ' '
      }
    }
    if (line.trim()) lines.push(line)
    pages.push(`--- Page ${i} ---\n${lines.join('\n')}`)
  }
  await task.destroy()
  return pages.join('\n\n')
}

/** For the API-key backend: PDFs and images go to Claude as native blocks. */
export async function filesToBlocks(files: File[]): Promise<BetaContentBlockParam[]> {
  const blocks: BetaContentBlockParam[] = []
  for (const file of files) {
    checkSize(file)
    const img = imageType(file)
    if (isPdf(file)) {
      blocks.push({
        type: 'document',
        title: file.name,
        source: { type: 'base64', media_type: 'application/pdf', data: await toBase64(file) },
      })
    } else if (img) {
      blocks.push({ type: 'text', text: `Image file: ${file.name}` })
      blocks.push({ type: 'image', source: { type: 'base64', media_type: img, data: await toBase64(file) } })
    } else {
      const text = (await officeOrHtmlText(file)) ?? (await file.text())
      blocks.push({ type: 'text', text: `File: ${file.name}\n\n${text}` })
    }
  }
  return blocks
}

/** For the built-in Claude backend: text is extracted here, images passed as blobs. */
export async function filesToTextAndImages(files: File[]): Promise<{ text: string; images: File[] }> {
  const parts: string[] = []
  const images: File[] = []
  for (const file of files) {
    checkSize(file)
    if (isPdf(file)) {
      const text = await pdfToText(file)
      if (text.replace(/--- Page \d+ ---/g, '').trim().length < 20) {
        throw new Error(
          `${file.name} looks like a scanned PDF with no text layer. Upload photos/screenshots of the pages instead, or paste the text.`,
        )
      }
      parts.push(`File: ${file.name}\n\n${text}`)
    } else if (imageType(file)) {
      images.push(file)
      parts.push(`(Attached image: ${file.name})`)
    } else {
      const text = (await officeOrHtmlText(file)) ?? (await file.text())
      parts.push(`File: ${file.name}\n\n${text}`)
    }
  }
  return { text: parts.join('\n\n'), images }
}
