import { motion } from 'motion/react'
import { CalendarDays, CheckCircle2, ClipboardList, Info, ListChecks } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ExamAnalysis } from '../lib/schemas'
import { formatDate } from '../lib/utils'
import { Badge, Card, stagger, staggerItem } from './ui'

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Card className="stack" variants={staggerItem}>
      <div className="row" style={{ gap: 10 }}>
        <div className="feature-icon" style={{ width: 36, height: 36, borderRadius: 11 }}>{icon}</div>
        <h3>{title}</h3>
      </div>
      {children}
    </Card>
  )
}

export function PatternStats({ info }: { info: ExamAnalysis }) {
  const p = info.pattern
  const items = [
    { label: 'questions', value: p.totalQuestions || '–' },
    { label: 'marks', value: p.totalMarks || '–' },
    { label: 'minutes', value: p.durationMinutes || '–' },
    { label: 'negative marking', value: p.negativeMarking ? `−${p.negativeMarking}` : 'None' },
  ]
  return (
    <div className="grid grid-4" style={{ gap: 10 }}>
      {items.map((i) => (
        <div key={i.label} className="card tight flat stat">
          <span className="value">{i.value}</span>
          <span className="label">{i.label}</span>
        </div>
      ))}
    </div>
  )
}

export function ExamInfoView({ info, coverage }: { info: ExamAnalysis; coverage?: (topic: string) => ReactNode }) {
  return (
    <motion.div className="stack lg" variants={stagger} initial="initial" animate="animate">
      <Section icon={<Info size={18} />} title="Overview">
        <p className="muted">{info.summary}</p>
        {info.conductingBody && <p className="small">Conducted by <strong>{info.conductingBody}</strong></p>}
        <PatternStats info={info} />
        {info.pattern.questionTypes.length > 0 && (
          <div className="chip-group">
            {info.pattern.questionTypes.map((t) => (
              <Badge key={t} tone="neutral">{t}</Badge>
            ))}
          </div>
        )}
        {info.pattern.sections.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="md" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
              <thead>
                <tr>
                  <th style={th}>Section</th>
                  <th style={th}>Questions</th>
                  <th style={th}>Marks</th>
                  <th style={th}>Time</th>
                </tr>
              </thead>
              <tbody>
                {info.pattern.sections.map((s) => (
                  <tr key={s.name}>
                    <td style={td}>{s.name}</td>
                    <td style={td}>{s.questions || '–'}</td>
                    <td style={td}>{s.marks || '–'}</td>
                    <td style={td}>{s.durationMinutes ? `${s.durationMinutes} min` : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section icon={<ListChecks size={18} />} title={`Syllabus · ${info.syllabus.length} topics`}>
        <div className="list">
          {info.syllabus.map((t) => (
            <div key={t.topic} className="list-item" style={{ alignItems: 'flex-start' }}>
              <div className="stack sm grow">
                <div className="row" style={{ gap: 8 }}>
                  <strong>{t.topic}</strong>
                  <Badge tone={t.weight}>{t.weight} weight</Badge>
                </div>
                {t.subtopics.length > 0 && <span className="subtle">{t.subtopics.join(' · ')}</span>}
              </div>
              {coverage?.(t.topic)}
            </div>
          ))}
        </div>
      </Section>

      <div className="grid grid-2">
        {info.importantDates.length > 0 && (
          <Section icon={<CalendarDays size={18} />} title="Important dates">
            <div className="list">
              {info.importantDates.map((d) => (
                <div key={d.label + d.date} className="list-item">
                  <span className="grow small">{d.label}</span>
                  <strong className="small mono">{formatDate(d.date)}</strong>
                </div>
              ))}
            </div>
          </Section>
        )}
        {(info.instructions.length > 0 || info.eligibility.length > 0) && (
          <Section icon={<ClipboardList size={18} />} title="Rules & eligibility">
            <ul className="check-list small">
              {[...info.eligibility, ...info.instructions].map((x) => (
                <li key={x}>
                  <CheckCircle2 size={15} />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}
        {info.keyFacts.length > 0 && (
          <Section icon={<Info size={18} />} title="Key facts">
            <ul className="check-list small">
              {info.keyFacts.map((x) => (
                <li key={x}>
                  <CheckCircle2 size={15} />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </motion.div>
  )
}

const th = { textAlign: 'left' as const, padding: '8px 10px', borderBottom: '1px solid var(--border-strong)', color: 'var(--text-2)', fontWeight: 600 }
const td = { padding: '8px 10px', borderBottom: '1px solid var(--border)' }
