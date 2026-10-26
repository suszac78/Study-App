import { AnimatePresence, motion } from 'motion/react'
import { Check, Folder as FolderIcon, FolderPlus, Home } from 'lucide-react'
import { useEffect, useState } from 'react'
import { childFolders, createFolder, descendantIds } from '../lib/folders'
import { useDb } from '../lib/store'
import type { Db } from '../lib/types'
import { Button, askText } from './ui'

/**
 * Pick a destination folder. `current` is preselected; `excludeFolderId`
 * (and everything inside it) can't be chosen, so a folder can't be moved into itself.
 * Calls onPick(folderId | null for top level).
 */
export function FolderPicker({
  open,
  title,
  current,
  excludeFolderId,
  onPick,
  onClose,
}: {
  open: boolean
  title: string
  current: string | null
  excludeFolderId?: string
  onPick: (folderId: string | null) => void
  onClose: () => void
}) {
  const db = useDb()
  const [selected, setSelected] = useState<string | null>(current)
  useEffect(() => {
    if (open) setSelected(current)
  }, [open, current])

  const blocked = excludeFolderId ? descendantIds(db, excludeFolderId) : new Set<string>()

  const newFolder = async () => {
    const parentName = selected ? db.folders.find((f) => f.id === selected)?.name : null
    const name = await askText(parentName ? `New folder inside ${parentName}` : 'New top-level folder (e.g. Y9)', '', 'Folder name')
    if (name) setSelected(createFolder(name, selected))
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
          <motion.div
            className="card modal"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            style={{ width: 'min(480px, 100%)' }}
            initial={{ y: 16, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 8, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{title}</h3>
            <div className="stack sm" style={{ maxHeight: '50vh', overflowY: 'auto', margin: '0 -6px', padding: '0 6px' }} role="listbox" aria-label="Folders">
              <Row label="Top level (no folder)" icon={<Home size={16} />} depth={0} active={selected === null} onClick={() => setSelected(null)} />
              <Tree db={db} parentId={null} depth={0} selected={selected} blocked={blocked} onSelect={setSelected} />
            </div>
            <div className="row between">
              <Button variant="ghost" size="sm" onClick={newFolder}>
                <FolderPlus size={14} /> New folder {selected ? 'inside selected' : ''}
              </Button>
              <div className="row">
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button variant="primary" onClick={() => onPick(selected)}>
                  <Check size={16} /> Move here
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Row({ label, icon, depth, active, disabled, onClick }: { label: string; icon: React.ReactNode; depth: number; active: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      disabled={disabled}
      className={`nav-item ${active ? 'active' : ''}`}
      style={{ paddingLeft: 10 + depth * 18, border: 0, width: '100%', textAlign: 'left', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1, background: active ? undefined : 'transparent' }}
      onClick={onClick}
    >
      {icon}
      <span className="grow">{label}</span>
      {active && <Check size={15} />}
    </button>
  )
}

function Tree({ db, parentId, depth, selected, blocked, onSelect }: { db: Db; parentId: string | null; depth: number; selected: string | null; blocked: Set<string>; onSelect: (id: string) => void }) {
  return (
    <>
      {childFolders(db, parentId).map((f) => (
        <div key={f.id}>
          <Row label={f.name} icon={<FolderIcon size={16} />} depth={depth + 1} active={selected === f.id} disabled={blocked.has(f.id)} onClick={() => onSelect(f.id)} />
          <Tree db={db} parentId={f.id} depth={depth + 1} selected={selected} blocked={blocked} onSelect={onSelect} />
        </div>
      ))}
    </>
  )
}
