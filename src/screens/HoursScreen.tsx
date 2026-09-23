import { useState } from 'react'
import { initialRange, RangePicker, resolveRange } from '../components/RangePicker'
import { Badge, Empty, Field, Modal, PageHeader, Segmented, num as parseNum } from '../components/ui'
import { useData } from '../data/DataContext'
import type { HourEntry, HourKind } from '../data/types'
import { useI18n } from '../i18n'
import { inRange, today } from '../lib/dates'

type Draft = Omit<HourEntry, 'id'> & { id?: string }

export function HoursScreen() {
  const { t, num, date } = useI18n()
  const { hour_entries, companies, clients, save, remove, clientName, companyName } = useData()
  const [range, setRange] = useState(() => initialRange('week'))
  const [draft, setDraft] = useState<Draft | null>(null)
  const r = resolveRange(range)

  const rows = hour_entries
    .filter((h) => inRange(h.date, r.start, r.end))
    .sort((a, b) => b.date.localeCompare(a.date))
  const total = rows.reduce((s, h) => s + h.hours, 0)

  const blank = (): Draft => ({
    date: today(),
    company_id: companies.find((c) => c.active)?.id ?? '',
    client_id: null,
    kind: 'clinical',
    hours: 0,
    note: '',
  })

  return (
    <>
      <PageHeader
        title={t('hours.title')}
        subtitle={t('hours.subtitle')}
        action={
          <button className="btn primary" disabled={companies.length === 0} onClick={() => setDraft(blank())}>
            {t('hours.add')}
          </button>
        }
      />
      <RangePicker value={range} onChange={setRange} />
      <p className="muted">{t('hours.monthTotal', { h: num(total) })}</p>
      {rows.length === 0 ? (
        <Empty>{t('common.empty')}</Empty>
      ) : (
        <div className="card table-card">
          <table className="table">
            <thead>
              <tr>
                <th>{t('common.date')}</th>
                <th>{t('common.company')}</th>
                <th>{t('common.client')}</th>
                <th>{t('hours.kind')}</th>
                <th className="num">{t('hours.hours')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((h) => (
                <tr key={h.id} className="clickable" onClick={() => setDraft(h)}>
                  <td>{date(h.date)}</td>
                  <td>{companyName(h.company_id)}</td>
                  <td>{h.client_id ? clientName(clients.find((c) => c.id === h.client_id)) : '—'}</td>
                  <td>
                    <Badge tone={h.kind === 'clinical' ? 'ok' : 'muted'}>{t(h.kind === 'clinical' ? 'hours.clinical' : 'hours.admin')}</Badge>
                  </td>
                  <td className="num">{num(h.hours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {draft && (
        <HourForm
          draft={draft}
          onClose={() => setDraft(null)}
          onSave={async (d) => {
            await save('hour_entries', d)
            setDraft(null)
          }}
          onDelete={
            draft.id
              ? async () => {
                  if (!confirm(t('common.confirmDelete'))) return
                  await remove('hour_entries', draft.id!)
                  setDraft(null)
                }
              : undefined
          }
        />
      )}
    </>
  )
}

export function HourForm({
  draft,
  onClose,
  onSave,
  onDelete,
}: {
  draft: Draft
  onClose: () => void
  onSave: (d: Draft) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const { t } = useI18n()
  const { companies, clients, clientName } = useData()
  const [d, setD] = useState(draft)
  const [hours, setHours] = useState(draft.hours ? String(draft.hours) : '')
  const [busy, setBusy] = useState(false)
  const companyClients = clients.filter((c) => c.company_id === d.company_id && (c.active || c.id === d.client_id))

  return (
    <Modal title={t('hours.add')} onClose={onClose}>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault()
          const h = parseNum(hours)
          if (h <= 0 || !d.company_id) return
          setBusy(true)
          try {
            await onSave({ ...d, hours: h })
          } finally {
            setBusy(false)
          }
        }}
      >
        <Segmented<HourKind>
          options={[
            { value: 'clinical', label: t('hours.clinical') },
            { value: 'admin', label: t('hours.admin') },
          ]}
          value={d.kind}
          onChange={(kind) => setD({ ...d, kind })}
        />
        <div className="form-row">
          <Field label={t('common.date')}>
            <input type="date" required value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} />
          </Field>
          <Field label={t('hours.hours')}>
            <input required autoFocus inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="0.0" />
          </Field>
        </div>
        <Field label={t('common.company')}>
          <select value={d.company_id} onChange={(e) => setD({ ...d, company_id: e.target.value, client_id: null })}>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('common.client')}>
          <select value={d.client_id ?? ''} onChange={(e) => setD({ ...d, client_id: e.target.value || null })}>
            <option value="">{t('hours.noClient')}</option>
            {companyClients.map((c) => (
              <option key={c.id} value={c.id}>
                {clientName(c)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('common.notes')}>
          <input value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} />
        </Field>
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
      </form>
    </Modal>
  )
}
