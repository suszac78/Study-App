import { uid, updateDb } from './store'
import type { Db, Exam, Folder } from './types'

const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })

export function childFolders(db: Db, parentId: string | null): Folder[] {
  return db.folders.filter((f) => (f.parentId ?? null) === parentId).sort((a, b) => natural(a.name, b.name))
}

export function examsIn(db: Db, folderId: string | null): Exam[] {
  return db.exams.filter((e) => (e.folderId ?? null) === folderId).sort((a, b) => natural(a.name, b.name))
}

/** Folders from the top down to `folderId`, e.g. [Y9, Science]. */
export function folderPath(db: Db, folderId: string | null | undefined): Folder[] {
  const path: Folder[] = []
  let cur = folderId ? db.folders.find((f) => f.id === folderId) : undefined
  const seen = new Set<string>()
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    path.unshift(cur)
    cur = cur.parentId ? db.folders.find((f) => f.id === cur!.parentId) : undefined
  }
  return path
}

export const pathLabel = (db: Db, folderId: string | null | undefined) =>
  folderPath(db, folderId)
    .map((f) => f.name)
    .join(' › ')

/** Every folder id inside `folderId` (including itself). */
export function descendantIds(db: Db, folderId: string): Set<string> {
  const ids = new Set([folderId])
  let grew = true
  while (grew) {
    grew = false
    for (const f of db.folders) if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) (ids.add(f.id), (grew = true))
  }
  return ids
}

export function countExams(db: Db, folderId: string) {
  const ids = descendantIds(db, folderId)
  return db.exams.filter((e) => e.folderId && ids.has(e.folderId)).length
}

export function createFolder(name: string, parentId: string | null): string {
  const id = uid()
  updateDb((d) => ({ ...d, folders: [...d.folders, { id, name: name.trim(), parentId, createdAt: Date.now() }] }))
  return id
}

export function renameFolder(id: string, name: string) {
  updateDb((d) => ({ ...d, folders: d.folders.map((f) => (f.id === id ? { ...f, name: name.trim() } : f)) }))
}

/** Deletes a folder; anything inside moves up to its parent (nothing is lost). */
export function deleteFolder(id: string) {
  updateDb((d) => {
    const folder = d.folders.find((f) => f.id === id)
    const parent = folder?.parentId ?? null
    return {
      ...d,
      folders: d.folders.filter((f) => f.id !== id).map((f) => (f.parentId === id ? { ...f, parentId: parent } : f)),
      exams: d.exams.map((e) => (e.folderId === id ? { ...e, folderId: parent } : e)),
    }
  })
}

export function moveExam(examId: string, folderId: string | null) {
  updateDb((d) => ({ ...d, exams: d.exams.map((e) => (e.id === examId ? { ...e, folderId } : e)) }))
}

/** All folders as indented options for a <select>. */
export function folderOptions(db: Db): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = []
  const walk = (parent: string | null, depth: number) => {
    for (const f of childFolders(db, parent)) {
      out.push({ id: f.id, label: `${'   '.repeat(depth)}${f.name}` })
      walk(f.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}

/**
 * Other assessments whose lessons should carry over to this one: same folder,
 * or a folder with the same subject name elsewhere (Y9 › Science → Y10 › Science).
 */
export function relatedExams(db: Db, exam: Exam): Exam[] {
  const folder = db.folders.find((f) => f.id === exam.folderId)
  if (!folder) return []
  const subject = folder.name.trim().toLowerCase()
  const sameSubject = new Set(db.folders.filter((f) => f.name.trim().toLowerCase() === subject).map((f) => f.id))
  return db.exams.filter((e) => e.id !== exam.id && e.folderId && sameSubject.has(e.folderId))
}
