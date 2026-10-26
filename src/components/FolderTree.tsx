import { AnimatePresence, motion } from 'motion/react'
import { ChevronRight, Folder as FolderIcon, FolderOpen, FolderPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { childFolders, countExams, createFolder, examsIn, folderPath } from '../lib/folders'
import { useDb } from '../lib/store'
import type { Db } from '../lib/types'
import { daysUntil, examColor } from '../lib/utils'
import { askText } from './ui'

const OPEN_KEY = 'studypilot.openFolders'

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

/** Year › Subject › Assessment tree with exams as leaves. */
export function FolderTree() {
  const db = useDb()
  const location = useLocation()
  const [open, setOpen] = useState(loadOpen)

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

  const toggle = (id: string) => {
    const next = new Set(open)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setOpen(next)
    saveOpen(next)
  }

  const newTopFolder = async () => {
    const name = await askText('New folder (e.g. Y9, Year 10, Semester 1)', '', 'Folder name')
    if (name) createFolder(name, null)
  }

  return (
    <div>
      <div className="row between" style={{ paddingRight: 4 }}>
        <div className="nav-label">Your exams</div>
        <button className="btn btn-ghost btn-sm btn-icon" style={{ minHeight: 28, width: 28 }} onClick={newTopFolder} aria-label="New folder" title="New folder">
          <FolderPlus size={15} />
        </button>
      </div>
      <nav className="nav-list" aria-label="Exams and folders">
        <Level db={db} parentId={null} depth={0} open={open} toggle={toggle} />
        {!db.exams.length && !db.folders.length && <span className="subtle xs" style={{ padding: '4px 10px' }}>No exams yet</span>}
      </nav>
    </div>
  )
}

function Level({ db, parentId, depth, open, toggle }: { db: Db; parentId: string | null; depth: number; open: Set<string>; toggle: (id: string) => void }) {
  const pad = 10 + depth * 14
  return (
    <>
      {childFolders(db, parentId).map((f) => {
        const isOpen = open.has(f.id)
        return (
          <div key={f.id}>
            <div className="row nowrap" style={{ gap: 0 }}>
              <button
                className="btn btn-ghost btn-sm btn-icon"
                style={{ minHeight: 30, width: 24, marginLeft: pad - 8, flex: 'none' }}
                onClick={() => toggle(f.id)}
                aria-label={isOpen ? `Collapse ${f.name}` : `Expand ${f.name}`}
                aria-expanded={isOpen}
              >
                <motion.span animate={{ rotate: isOpen ? 90 : 0 }} style={{ display: 'inline-flex' }}>
                  <ChevronRight size={14} />
                </motion.span>
              </button>
              <NavLink
                to={`/folder/${f.id}`}
                className={({ isActive }) => `nav-item grow ${isActive ? 'active' : ''}`}
                style={{ paddingLeft: 4 }}
                onClick={() => !isOpen && toggle(f.id)}
              >
                {isOpen ? <FolderOpen size={16} /> : <FolderIcon size={16} />}
                <span className="grow">{f.name}</span>
                <span className="subtle xs mono">{countExams(db, f.id) || ''}</span>
              </NavLink>
            </div>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                  <Level db={db} parentId={f.id} depth={depth + 1} open={open} toggle={toggle} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
      {examsIn(db, parentId).map((e) => {
        const d = daysUntil(e.examDate)
        return (
          <NavLink key={e.id} to={`/exam/${e.id}`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ paddingLeft: pad + (depth ? 16 : 0) }}>
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
