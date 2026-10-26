import { AnimatePresence, motion } from 'motion/react'
import { ChevronRight, Folder as FolderIcon, FolderOpen, FolderPlus, Plus } from 'lucide-react'
import { useEffect, useState, type DragEvent } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { childFolders, countExams, createFolder, examsIn, folderPath, moveExam, moveFolder } from '../lib/folders'
import { getDb, useDb } from '../lib/store'
import type { Db } from '../lib/types'
import { daysUntil, examColor } from '../lib/utils'
import { askText, toast } from './ui'

const OPEN_KEY = 'studypilot.openFolders'
const DRAG_TYPE = 'application/x-studypilot'

function loadOpen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(OPEN_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

function saveOpen(s: Set<string>) {
  try {
    localStorage.setItem(OPEN_KEY, JSON.stringify([...s]))
  } catch {
    /* only a convenience */
  }
}

type Dragged = { type: 'exam' | 'folder'; id: string }

function startDrag(e: DragEvent, item: Dragged) {
  e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(item))
  e.dataTransfer.effectAllowed = 'move'
}

function readDrag(e: DragEvent): Dragged | null {
  try {
    return JSON.parse(e.dataTransfer.getData(DRAG_TYPE))
  } catch {
    return null
  }
}

/** Drop an exam or folder into `folderId` (null = top level). */
function dropInto(e: DragEvent, folderId: string | null) {
  e.preventDefault()
  const item = readDrag(e)
  if (!item) return
  if (item.type === 'exam') {
    moveExam(item.id, folderId)
    toast('Exam moved')
  } else if (item.id !== folderId) {
    if (moveFolder(item.id, folderId, getDb())) toast('Folder moved')
    else toast("A folder can't go inside itself")
  }
}

/** Folders (as many levels deep as you like) with exams as leaves. Drag to reorganise. */
export function FolderTree() {
  const db = useDb()
  const location = useLocation()
  const [open, setOpen] = useState(loadOpen)
  const [over, setOver] = useState<string | null>(null)

  // Keep the folders around the current page open.
  useEffect(() => {
    const examId = location.pathname.match(/^\/exam\/([^/]+)/)?.[1]
    const folderId = location.pathname.match(/^\/folder\/([^/]+)/)?.[1]
    const start = examId ? db.exams.find((e) => e.id === examId)?.folderId : folderId
    const path = folderPath(db, start)
    if (path.some((f) => !open.has(f.id))) {
      const next = new Set(open)
      path.forEach((f) => next.add(f.id))
      setOpen(next)
      saveOpen(next)
    }
  }, [location.pathname, db, open])

  const setOpenId = (id: string, value: boolean) => {
    const next = new Set(open)
    if (value) next.add(id)
    else next.delete(id)
    setOpen(next)
    saveOpen(next)
  }

  const newFolder = async (parentId: string | null) => {
    const parent = parentId ? db.folders.find((f) => f.id === parentId)?.name : null
    const name = await askText(parent ? `New folder inside ${parent}` : 'New folder (e.g. Y9, Year 10, Semester 1)', '', 'Folder name')
    if (!name) return
    createFolder(name, parentId)
    if (parentId) setOpenId(parentId, true)
  }

  return (
    <div>
      <div
        className={`row between ${over === 'root' ? 'drop-target' : ''}`}
        style={{ paddingRight: 4, borderRadius: 10 }}
        onDragOver={(e) => {
          e.preventDefault()
          setOver('root')
        }}
        onDragLeave={() => setOver(null)}
        onDrop={(e) => {
          setOver(null)
          dropInto(e, null)
        }}
        title="Drop here to move to the top level"
      >
        <div className="nav-label">Your exams</div>
        <button className="btn btn-ghost btn-sm btn-icon" style={{ minHeight: 28, width: 28 }} onClick={() => newFolder(null)} aria-label="New folder" title="New folder">
          <FolderPlus size={15} />
        </button>
      </div>
      <nav className="nav-list" aria-label="Exams and folders">
        <Level db={db} parentId={null} depth={0} open={open} setOpenId={setOpenId} over={over} setOver={setOver} newFolder={newFolder} />
        {!db.exams.length && !db.folders.length && <span className="subtle xs" style={{ padding: '4px 10px' }}>No exams yet</span>}
      </nav>
      {db.folders.length > 0 && <p className="hint" style={{ padding: '6px 10px 0' }}>Tip: drag exams and folders to move them.</p>}
    </div>
  )
}

function Level({
  db,
  parentId,
  depth,
  open,
  setOpenId,
  over,
  setOver,
  newFolder,
}: {
  db: Db
  parentId: string | null
  depth: number
  open: Set<string>
  setOpenId: (id: string, value: boolean) => void
  over: string | null
  setOver: (id: string | null) => void
  newFolder: (parentId: string | null) => void
}) {
  const pad = 10 + depth * 14
  return (
    <>
      {childFolders(db, parentId).map((f) => {
        const isOpen = open.has(f.id)
        return (
          <div key={f.id}>
            <div
              className={`row nowrap folder-row ${over === f.id ? 'drop-target' : ''}`}
              style={{ gap: 0, borderRadius: 12 }}
              draggable
              onDragStart={(e) => startDrag(e, { type: 'folder', id: f.id })}
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setOver(f.id)
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.stopPropagation()
                setOver(null)
                dropInto(e, f.id)
                setOpenId(f.id, true)
              }}
            >
              <button
                className="btn btn-ghost btn-sm btn-icon"
                style={{ minHeight: 30, width: 24, marginLeft: pad - 8, flex: 'none' }}
                onClick={() => setOpenId(f.id, !isOpen)}
                aria-label={isOpen ? `Collapse ${f.name}` : `Expand ${f.name}`}
                aria-expanded={isOpen}
              >
                <motion.span animate={{ rotate: isOpen ? 90 : 0 }} style={{ display: 'inline-flex' }}>
                  <ChevronRight size={14} />
                </motion.span>
              </button>
              <NavLink
                to={`/folder/${f.id}`}
                draggable={false}
                className={({ isActive }) => `nav-item grow ${isActive ? 'active' : ''}`}
                style={{ paddingLeft: 4, minWidth: 0 }}
                onClick={() => !isOpen && setOpenId(f.id, true)}
              >
                {isOpen ? <FolderOpen size={16} /> : <FolderIcon size={16} />}
                <span className="grow">{f.name}</span>
                <span className="subtle xs mono">{countExams(db, f.id) || ''}</span>
              </NavLink>
              <button
                className="btn btn-ghost btn-sm btn-icon folder-add"
                style={{ minHeight: 28, width: 26, flex: 'none' }}
                onClick={() => newFolder(f.id)}
                aria-label={`New folder inside ${f.name}`}
                title={`New folder inside ${f.name}`}
              >
                <Plus size={14} />
              </button>
            </div>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                  <Level db={db} parentId={f.id} depth={depth + 1} open={open} setOpenId={setOpenId} over={over} setOver={setOver} newFolder={newFolder} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
      {examsIn(db, parentId).map((e) => {
        const d = daysUntil(e.examDate)
        return (
          <NavLink
            key={e.id}
            to={`/exam/${e.id}`}
            draggable
            onDragStart={(ev) => startDrag(ev, { type: 'exam', id: e.id })}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            style={{ paddingLeft: pad + (depth ? 16 : 0) }}
          >
            <span className="dot" style={{ background: examColor(e.hue) }} />
            <span className="grow">{e.name}</span>
            {e.result?.grade ? (
              <span className="subtle xs mono">{e.result.grade}</span>
            ) : (
              d !== null && d >= 0 && <span className="subtle xs mono">{d}d</span>
            )}
          </NavLink>
        )
      })}
    </>
  )
}
