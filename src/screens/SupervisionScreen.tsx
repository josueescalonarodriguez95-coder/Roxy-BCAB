import { useState } from 'react'
import { Badge, Empty, Field, Modal, PageHeader, Segmented, num as parseNum } from '../components/ui'
import { useData } from '../data/DataContext'
import type { FieldworkType, SessionFormat, Supervisee, SuperviseeKind, SuperviseeMonth, SupervisionSession } from '../data/types'
import { useI18n } from '../i18n'
import { today } from '../lib/dates'
import { fieldworkProgress, monthKey, monthRange, monthReport, nextSession, shiftMonth, type MonthStatus } from '../lib/supervision'

const COLORS = ['#7C83D6', '#5BB5A2', '#E58FA6', '#E0A458', '#6FA8DC', '#A58BD6', '#D4776B', '#8FB85B']
const STATUS_TONE: Record<MonthStatus, 'ok' | 'attention' | 'urgent' | 'notice'> = {
  met: 'ok',
  inProgress: 'attention',
  notMet: 'urgent',
  noHours: 'notice',
}

type SupDraft = Omit<Supervisee, 'id'> & { id?: string }
type SessionDraft = Omit<SupervisionSession, 'id'> & { id?: string }
type HoursDraft = { supervisee: Supervisee; month: string; row?: SuperviseeMonth }

export function SupervisionScreen() {
  const { t, num, date, month: fmtMonth } = useI18n()
  const { profile, supervisees, supervision_sessions, supervisee_months, clients, companies, save, remove, clientName, companyName } = useData()
  const [kind, setKind] = useState<SuperviseeKind>('rbt')
  const [month, setMonth] = useState(() => monthKey(today()))
  const [supDraft, setSupDraft] = useState<SupDraft | null>(null)
  const [sessionDraft, setSessionDraft] = useState<SessionDraft | null>(null)
  const [hoursDraft, setHoursDraft] = useState<HoursDraft | null>(null)
  const now = today()

  // BCaBAs supervise RBTs but not BCBA fieldwork.
  const canFieldwork = profile.credential === 'BCBA'
  const shownKind: SuperviseeKind = canFieldwork ? kind : 'rbt'
  const list = supervisees
    .filter((s) => s.kind === shownKind)
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
  const { start, end } = monthRange(month)
  const monthSessions = supervision_sessions
    .filter((x) => x.date >= start && x.date <= end && list.some((s) => s.id === x.supervisee_id))
    .sort((a, b) => a.date.localeCompare(b.date))

  const blankSup = (): SupDraft => ({
    name: '',
    kind: shownKind,
    fieldwork_type: 'supervised',
    company_id: companies.find((c) => c.active)?.id ?? null,
    client_ids: [],
    rate: 0,
    start_date: now,
    contract_date: null,
    color: COLORS[supervisees.length % COLORS.length],
    active: true,
    notes: '',
  })

  const blankSession = (s: Supervisee): SessionDraft => ({
    supervisee_id: s.id,
    date: month === monthKey(now) ? now : start,
    hours: 1,
    format: 'individual',
    with_client: false,
    note: '',
  })

  return (
    <>
      <PageHeader
        title={t('sup.title')}
        subtitle={t('sup.subtitle')}
        action={
          <button className="btn primary" onClick={() => setSupDraft(blankSup())}>
            {t('sup.add')}
          </button>
        }
      />
      <div className="toolbar">
        {canFieldwork ? (
          <Segmented<SuperviseeKind>
            options={[
              { value: 'rbt', label: t('sup.rbts') },
              { value: 'fieldwork', label: t('sup.fieldwork') },
            ]}
            value={kind}
            onChange={setKind}
          />
        ) : (
          <span />
        )}
        <div className="range-nav">
          <button className="btn icon" aria-label={t('range.prev')} onClick={() => setMonth(shiftMonth(month, -1))}>
            ‹
          </button>
          <span className="range-label">{fmtMonth(month)}</span>
          <button className="btn icon" aria-label={t('range.next')} onClick={() => setMonth(shiftMonth(month, 1))}>
            ›
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <Empty>{t('sup.none')}</Empty>
      ) : (
        <div className="grid cards wide">
          {list.map((s) => {
            const r = monthReport(s, month, supervision_sessions, supervisee_months, now)
            const next = nextSession(s, supervision_sessions, now)
            const assigned = clients.filter((c) => s.client_ids.includes(c.id))
            const progress = s.kind === 'fieldwork' ? fieldworkProgress(s, supervisee_months) : null
            return (
              <div key={s.id} className={`card sup-card ${s.active ? '' : 'inactive'}`} style={{ borderTopColor: s.color }}>
                <div className="row-between">
                  <button className="link-title" onClick={() => setSupDraft(s)}>
                    {s.name}
                  </button>
                  <Badge tone={STATUS_TONE[r.status]}>{t(`sup.status.${r.status}`)}</Badge>
                </div>
                <span className="muted small">
                  {s.company_id ? companyName(s.company_id) : ''}
                  {assigned.length > 0 &&
                    ` · ${t('sup.clientsCount', { names: assigned.map((c) => clientName(c)).join(', ') })}`}
                </span>
                {!s.contract_date && s.active && (
                  <span>
                    <Badge tone="attention">{t('sup.contractMissing')}</Badge>
                  </span>
                )}
                <dl className="kv-list">
                  <dt>{s.kind === 'rbt' ? t('sup.workHours') : t('sup.fieldworkHours')}</dt>
                  <dd>
                    <button className="btn small link" onClick={() => setHoursDraft({ supervisee: s, month, row: supervisee_months.find((m) => m.supervisee_id === s.id && m.month === month) })}>
                      {r.hasWorkHours ? `${num(r.workHours)} h` : t('sup.enterHours')}
                    </button>
                  </dd>
                  <dt>{t('sup.delivered')}</dt>
                  <dd>{num(r.supervisionHours)} h</dd>
                  <dt>{t('sup.required', { pct: r.percent })}</dt>
                  <dd>{num(r.required)} h</dd>
                  <dt>{t('sup.remaining')}</dt>
                  <dd>{num(r.remaining)} h</dd>
                  <dt>{t('sup.complete')}</dt>
                  <dd>{r.complete}%</dd>
                  <dt>{t('sup.next')}</dt>
                  <dd>{next ? date(next.date) : <span className="muted">{t('sup.noNext')}</span>}</dd>
                </dl>
                <div className="meter" aria-hidden="true">
                  <span style={{ width: `${r.complete}%`, background: s.color }} />
                </div>
                <ul className="checks">
                  {r.checks.map((c) => (
                    <li key={c.key} className={c.ok ? 'ok' : 'no'}>
                      <span aria-hidden="true">{c.ok ? '✓' : '○'}</span> {t(`check.${c.key}`, c.params)}
                    </li>
                  ))}
                </ul>
                {progress && (
                  <div className="small">
                    <div className="row-between">
                      <span className="muted">{t('sup.progress')}</span>
                      <span>{t('sup.progressValue', { h: num(progress.accrued), total: num(progress.total) })}</span>
                    </div>
                    <div className="meter" aria-hidden="true">
                      <span style={{ width: `${progress.pct}%`, background: s.color }} />
                    </div>
                  </div>
                )}
                {s.active && (
                  <button className="btn small" onClick={() => setSessionDraft(blankSession(s))}>
                    {t('sup.logSession')}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {monthSessions.length > 0 && (
        <section className="section">
          <h2>{t('sup.sessionsMonth')}</h2>
          <div className="card table-card">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('common.date')}</th>
                  <th>{t('sup.name')}</th>
                  <th>{t('sup.format')}</th>
                  <th>{t('sup.withClient')}</th>
                  <th className="num">{t('sup.hours')}</th>
                </tr>
              </thead>
              <tbody>
                {monthSessions.map((x) => (
                  <tr key={x.id} className="clickable" onClick={() => setSessionDraft(x)}>
                    <td>
                      {date(x.date)} {x.date > now && <Badge tone="notice">{t('sup.scheduled')}</Badge>}
                    </td>
                    <td>{supervisees.find((s) => s.id === x.supervisee_id)?.name}</td>
                    <td>{t(x.format === 'individual' ? 'sup.individual' : 'sup.group')}</td>
                    <td>{x.with_client ? '✓' : '—'}</td>
                    <td className="num">{num(x.hours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="muted small section">{t('sup.verify')}</p>

      {supDraft && (
        <SuperviseeForm
          draft={supDraft}
          canFieldwork={canFieldwork}
          onClose={() => setSupDraft(null)}
          onSave={async (d) => {
            await save('supervisees', d)
            setSupDraft(null)
          }}
          onDelete={
            supDraft.id
              ? async () => {
                  if (!confirm(t('common.confirmDelete'))) return
                  await remove('supervisees', supDraft.id!)
                  setSupDraft(null)
                }
              : undefined
          }
        />
      )}
      {sessionDraft && (
        <SessionForm
          draft={sessionDraft}
          onClose={() => setSessionDraft(null)}
          onSave={async (d) => {
            await save('supervision_sessions', d)
            setSessionDraft(null)
          }}
          onDelete={
            sessionDraft.id
              ? async () => {
                  await remove('supervision_sessions', sessionDraft.id!)
                  setSessionDraft(null)
                }
              : undefined
          }
        />
      )}
      {hoursDraft && (
        <MonthHoursForm
          draft={hoursDraft}
          onClose={() => setHoursDraft(null)}
          onSave={async (hours) => {
            const { supervisee, month: m, row } = hoursDraft
            await save('supervisee_months', { id: row?.id, supervisee_id: supervisee.id, month: m, hours })
            setHoursDraft(null)
          }}
        />
      )}
    </>
  )
}

function FormActions({ onClose, onDelete, busy }: { onClose: () => void; onDelete?: () => void; busy: boolean }) {
  const { t } = useI18n()
  return (
    <div className="form-actions">
      {onDelete && (
        <button type="button" className="btn danger" onClick={onDelete}>
          {t('common.delete')}
        </button>
      )}
      <span className="spacer" />
      <button type="button" className="btn" onClick={onClose}>
        {t('common.cancel')}
      </button>
      <button className="btn primary" disabled={busy}>
        {t('common.save')}
      </button>
    </div>
  )
}

function SuperviseeForm({
  draft,
  canFieldwork,
  onClose,
  onSave,
  onDelete,
}: {
  draft: SupDraft
  canFieldwork: boolean
  onClose: () => void
  onSave: (d: SupDraft) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const { t } = useI18n()
  const { companies, clients, clientName } = useData()
  const [d, setD] = useState(draft)
  const [rate, setRate] = useState(draft.rate ? String(draft.rate) : '')
  const [busy, setBusy] = useState(false)
  const pickable = clients.filter((c) => c.active || d.client_ids.includes(c.id))

  return (
    <Modal title={draft.id ? draft.name : t('sup.add')} onClose={onClose}>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          try {
            // Drop ids of clients that were deleted since they were assigned.
            const client_ids = d.client_ids.filter((id) => clients.some((c) => c.id === id))
            await onSave({ ...d, name: d.name.trim(), rate: parseNum(rate), client_ids })
          } finally {
            setBusy(false)
          }
        }}
      >
        <Field label={t('sup.name')}>
          <input required autoFocus value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
        </Field>
        {canFieldwork && (
          <Field label={t('sup.kind')}>
            <select value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value as SuperviseeKind })}>
              <option value="rbt">{t('sup.kindRbt')}</option>
              <option value="fieldwork">{t('sup.kindFieldwork')}</option>
            </select>
          </Field>
        )}
        {d.kind === 'fieldwork' && (
          <Field label={t('sup.fieldworkType')}>
            <select value={d.fieldwork_type} onChange={(e) => setD({ ...d, fieldwork_type: e.target.value as FieldworkType })}>
              <option value="supervised">{t('sup.fwSupervised')}</option>
              <option value="concentrated">{t('sup.fwConcentrated')}</option>
            </select>
          </Field>
        )}
        <Field label={t('common.company')}>
          <select value={d.company_id ?? ''} onChange={(e) => setD({ ...d, company_id: e.target.value || null })}>
            <option value="">—</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        {pickable.length > 0 && (
          <Field label={t('sup.clients')}>
            <div className="chips">
              {pickable.map((c) => {
                const on = d.client_ids.includes(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`chip ${on ? 'on' : ''}`}
                    aria-pressed={on}
                    onClick={() =>
                      setD({ ...d, client_ids: on ? d.client_ids.filter((id) => id !== c.id) : [...d.client_ids, c.id] })
                    }
                  >
                    {clientName(c)}
                  </button>
                )
              })}
            </div>
          </Field>
        )}
        <div className="form-row">
          <Field label={t('sup.startDate')}>
            <input type="date" value={d.start_date ?? ''} onChange={(e) => setD({ ...d, start_date: e.target.value || null })} />
          </Field>
          <Field label={t('sup.contractDate')}>
            <input type="date" value={d.contract_date ?? ''} onChange={(e) => setD({ ...d, contract_date: e.target.value || null })} />
          </Field>
        </div>
        <Field label={t('sup.rate')} hint={t('sup.rateHelp')}>
          <input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0.00" />
        </Field>
        <Field label={t('companies.color')}>
          <div className="swatches">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`swatch ${d.color === c ? 'selected' : ''}`}
                style={{ background: c }}
                aria-label={c}
                onClick={() => setD({ ...d, color: c })}
              />
            ))}
          </div>
        </Field>
        <Field label={t('common.notes')}>
          <textarea rows={2} value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} />
        </Field>
        <label className="check">
          <input type="checkbox" checked={d.active} onChange={(e) => setD({ ...d, active: e.target.checked })} />
          {t('common.active')}
        </label>
        <FormActions onClose={onClose} onDelete={onDelete} busy={busy} />
      </form>
    </Modal>
  )
}

function SessionForm({
  draft,
  onClose,
  onSave,
  onDelete,
}: {
  draft: SessionDraft
  onClose: () => void
  onSave: (d: SessionDraft) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const { t } = useI18n()
  const { supervisees } = useData()
  const [d, setD] = useState(draft)
  const [hours, setHours] = useState(String(draft.hours))
  const [busy, setBusy] = useState(false)
  const who = supervisees.find((s) => s.id === d.supervisee_id)

  return (
    <Modal title={`${t('sup.logSession')} · ${who?.name ?? ''}`} onClose={onClose}>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault()
          const h = parseNum(hours)
          if (h <= 0) return
          setBusy(true)
          try {
            await onSave({ ...d, hours: h })
          } finally {
            setBusy(false)
          }
        }}
      >
        <Segmented<SessionFormat>
          options={[
            { value: 'individual', label: t('sup.individual') },
            { value: 'group', label: t('sup.group') },
          ]}
          value={d.format}
          onChange={(format) => setD({ ...d, format })}
        />
        <div className="form-row">
          <Field label={t('common.date')} hint={t('sup.futureHelp')}>
            <input type="date" required value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} />
          </Field>
          <Field label={t('sup.hours')}>
            <input required inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} />
          </Field>
        </div>
        <label className="check">
          <input type="checkbox" checked={d.with_client} onChange={(e) => setD({ ...d, with_client: e.target.checked })} />
          {t('sup.withClient')}
        </label>
        <Field label={t('common.notes')}>
          <input value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} />
        </Field>
        <FormActions onClose={onClose} onDelete={onDelete} busy={busy} />
      </form>
    </Modal>
  )
}

function MonthHoursForm({ draft, onClose, onSave }: { draft: HoursDraft; onClose: () => void; onSave: (h: number) => Promise<void> }) {
  const { t } = useI18n()
  const [hours, setHours] = useState(draft.row ? String(draft.row.hours) : '')
  const [busy, setBusy] = useState(false)
  const rbt = draft.supervisee.kind === 'rbt'

  return (
    <Modal title={`${draft.supervisee.name} · ${t('sup.enterHoursFor', { month: draft.month })}`} onClose={onClose}>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          try {
            await onSave(parseNum(hours))
          } finally {
            setBusy(false)
          }
        }}
      >
        <Field
          label={rbt ? t('sup.workHours') : t('sup.fieldworkHours')}
          hint={rbt ? t('sup.enterHoursHelpRbt') : t('sup.enterHoursHelpFw')}
        >
          <input required autoFocus inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="0" />
        </Field>
        <FormActions onClose={onClose} busy={busy} />
      </form>
    </Modal>
  )
}
