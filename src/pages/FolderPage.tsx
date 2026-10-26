import { motion } from 'motion/react'
import { ChevronRight, ClipboardCheck, Folder as FolderIcon, FolderPlus, GraduationCap, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Card, Empty, askText, ask, stagger, staggerItem, toast } from '../components/ui'
import { childFolders, countExams, createFolder, deleteFolder, descendantIds, examsIn, folderPath, renameFolder } from '../lib/folders'
import { useDb } from '../lib/store'
import { daysUntil, examColor, formatDate } from '../lib/utils'

export default function FolderPage() {
  const { folderId } = useParams()
  const db = useDb()
  const navigate = useNavigate()
  const folder = db.folders.find((f) => f.id === folderId)
  const path = folderPath(db, folderId)
  const subfolders = folder ? childFolders(db, folder.id) : []
  const exams = folder ? examsIn(db, folder.id) : []

  // Every result in this folder and below, newest first.
  const results = useMemo(() => {
    if (!folder) return []
    const ids = descendantIds(db, folder.id)
    return db.exams
      .filter((e) => e.folderId && ids.has(e.folderId) && e.result)
      .sort((a, b) => (b.result!.updatedAt ?? 0) - (a.result!.updatedAt ?? 0))
  }, [db, folder])
  const nextTime = [...new Set(results.flatMap((e) => e.result?.analysis?.nextTime ?? []))].slice(0, 8)

  if (!folder) {
    return (
      <div className="page">
        <Card className="empty">
          <h3>Folder not found</h3>
          <Link to="/"><Button variant="primary">Go home</Button></Link>
        </Card>
      </div>
    )
  }

  const addSub = async () => {
    const name = await askText(`New folder inside ${folder.name} (e.g. Science, Maths)`, '', 'Folder name')
    if (name) createFolder(name, folder.id)
  }
  const rename = async () => {
    const name = await askText('Rename folder', folder.name)
    if (name) renameFolder(folder.id, name)
  }
  const remove = async () => {
    if (!(await ask(`Delete the folder "${folder.name}"? Anything inside moves up a level; no exams are deleted.`))) return
    deleteFolder(folder.id)
    toast('Folder deleted')
    navigate(path.length > 1 ? `/folder/${path[path.length - 2].id}` : '/')
  }

  return (
    <div className="page">
      <div className="stack sm">
        <nav className="row xs subtle" style={{ gap: 4 }} aria-label="Folder path">
          <Link to="/">Home</Link>
          {path.map((f) => (
            <span key={f.id} className="row" style={{ gap: 4 }}>
              <ChevronRight size={12} />
              {f.id === folder.id ? <span>{f.name}</span> : <Link to={`/folder/${f.id}`}>{f.name}</Link>}
            </span>
          ))}
        </nav>
        <div className="row between" style={{ alignItems: 'flex-end' }}>
          <h1 className="row" style={{ gap: 12 }}>
            <FolderIcon size={30} color="var(--primary)" /> {folder.name}
          </h1>
          <div className="row">
            <Button size="sm" variant="ghost" onClick={rename}><Pencil size={14} /> Rename</Button>
            <Button size="sm" variant="ghost" onClick={remove}><Trash2 size={14} /> Delete</Button>
          </div>
        </div>
      </div>

      <div className="row">
        <Button variant="primary" onClick={() => navigate('/new', { state: { folderId: folder.id } })}>
          <Plus size={16} /> New exam / assessment here
        </Button>
        <Button variant="secondary" onClick={addSub}>
          <FolderPlus size={16} /> New folder inside
        </Button>
      </div>

      {subfolders.length > 0 && (
        <section className="stack">
          <h3>Folders</h3>
          <motion.div className="grid grid-4" variants={stagger} initial="initial" animate="animate">
            {subfolders.map((f) => (
              <motion.div key={f.id} variants={staggerItem} whileHover={{ y: -3 }}>
                <Link to={`/folder/${f.id}`} className="card interactive row nowrap" style={{ gap: 10, color: 'inherit', textDecoration: 'none' }}>
                  <FolderIcon size={22} color="var(--primary)" />
                  <div className="stack sm grow">
                    <strong>{f.name}</strong>
                    <span className="subtle xs">{countExams(db, f.id)} exam{countExams(db, f.id) === 1 ? '' : 's'}</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </section>
      )}

      <section className="stack">
        <h3>Exams & assessments</h3>
        {exams.length === 0 ? (
          <Empty
            icon={<GraduationCap size={26} />}
            title={subfolders.length ? 'No exams directly in this folder' : 'Empty folder'}
            action={<Button variant="primary" onClick={() => navigate('/new', { state: { folderId: folder.id } })}><Plus size={16} /> Add one</Button>}
          >
            Add assessments here, e.g. AT1 and AT2. When you get results back, add them in each exam's Results tab and the AI uses them to
            prepare you for the next one.
          </Empty>
        ) : (
          <motion.div className="grid grid-3" variants={stagger} initial="initial" animate="animate">
            {exams.map((e) => {
              const d = daysUntil(e.examDate)
              return (
                <motion.div key={e.id} variants={staggerItem} whileHover={{ y: -3 }}>
                  <Link to={`/exam/${e.id}`} className="card interactive exam-card" style={{ height: '100%' }}>
                    <span className="stripe" style={{ background: examColor(e.hue) }} />
                    <h4>{e.name}</h4>
                    <span className="subtle xs">{e.examDate ? formatDate(e.examDate) : 'No date'}</span>
                    <div className="row" style={{ gap: 6 }}>
                      {e.result ? (
                        <>
                          <Badge tone="success"><ClipboardCheck size={12} /> {e.result.score || 'Result in'}</Badge>
                          {e.result.grade && <Badge>{e.result.grade}</Badge>}
                        </>
                      ) : d !== null && d >= 0 ? (
                        <Badge tone={d <= 7 ? 'danger' : 'neutral'}>{d} days left</Badge>
                      ) : (
                        <Badge tone="warning">Add your result</Badge>
                      )}
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </section>

      {results.length > 0 && (
        <Card className="stack">
          <h3>Results so far</h3>
          <div className="list">
            {results.map((e) => (
              <Link key={e.id} to={`/exam/${e.id}/review`} className="list-item" style={{ alignItems: 'flex-start' }}>
                <div className="stack sm grow">
                  <strong className="small">{e.name}</strong>
                  {e.result?.analysis && <span className="subtle xs">{e.result.analysis.headline}</span>}
                </div>
                <span className="mono small">{e.result?.score}</span>
                {e.result?.grade && <Badge>{e.result.grade}</Badge>}
              </Link>
            ))}
          </div>
          {nextTime.length > 0 && (
            <div className="explain stack sm">
              <strong className="small">Carried into your next {folder.name} assessment</strong>
              <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
                {nextTime.map((n) => <li key={n}>{n}</li>)}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
