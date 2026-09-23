import { useState } from 'react'
import { Badge, Empty, Field, Modal, PageHeader, num } from '../components/ui'
import { useData } from '../data/DataContext'
import type { Company, PaySchedule } from '../data/types'
import { useI18n } from '../i18n'

const COLORS = ['#7C83D6', '#5BB5A2', '#E58FA6', '#E0A458', '#6FA8DC', '#A58BD6', '#D4776B', '#8FB85B']
const SCHEDULES: PaySchedule[] = ['weekly', 'biweekly', 'semimonthly', 'monthly']

type Draft = Omit<Company, 'id'> & { id?: string }

function blank(): Draft {
  return { name: '', clinical_rate: 0, admin_rate: 0, pay_schedule: 'biweekly', color: COLORS[0], active: true, notes: '' }
}

export function CompaniesScreen() {
  const { t, money } = useI18n()
  const { companies, clients, hour_entries, payments, save, remove } = useData()
  const [draft, setDraft] = useState<Draft | null>(null)

  return (
    <>
      <PageHeader
        title={t('companies.title')}
        subtitle={t('companies.subtitle')}
        action={
          <button className="btn primary" onClick={() => setDraft({ ...blank(), color: COLORS[companies.length % COLORS.length] })}>
            {t('companies.add')}
          </button>
        }
      />
      {companies.length === 0 ? (
        <Empty>{t('common.empty')}</Empty>
      ) : (
        <div className="grid cards">
          {companies.map((c) => (
            <button key={c.id} className="card person-card" style={{ borderTopColor: c.color }} onClick={() => setDraft(c)}>
              <strong className="card-title">{c.name}</strong>
              <span className="muted">
                {t('companies.clinicalRate')}: {money(c.clinical_rate)}
              </span>
              <span className="muted">
                {t('companies.adminRate')}: {money(c.admin_rate)}
              </span>
              <span className="muted">{t(`schedule.${c.pay_schedule}`)}</span>
              <span className="row-gap">
                <Badge tone={c.active ? 'ok' : 'muted'}>{t(c.active ? 'common.active' : 'common.inactive')}</Badge>
                <span className="muted small">
                  {t('companies.clients', { n: clients.filter((cl) => cl.company_id === c.id && cl.active).length })}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {draft && (
        <CompanyForm
          draft={draft}
          onClose={() => setDraft(null)}
          onSave={async (d) => {
            await save('companies', d)
            setDraft(null)
          }}
          onDelete={
            draft.id
              ? async () => {
                  // Deleting would also wipe its hours and payments; mark it inactive instead.
                  if (hour_entries.some((h) => h.company_id === draft.id) || payments.some((p) => p.company_id === draft.id)) {
                    alert(t('companies.cantDelete'))
                    return
                  }
                  if (!confirm(t('common.confirmDelete'))) return
                  await remove('companies', draft.id!)
                  setDraft(null)
                }
              : undefined
          }
        />
      )}
    </>
  )
}

function CompanyForm({
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
  const [d, setD] = useState(draft)
  const [clinical, setClinical] = useState(draft.clinical_rate ? String(draft.clinical_rate) : '')
  const [admin, setAdmin] = useState(draft.admin_rate ? String(draft.admin_rate) : '')
  const [busy, setBusy] = useState(false)

  return (
    <Modal title={draft.id ? draft.name : t('companies.add')} onClose={onClose}>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          try {
            await onSave({ ...d, name: d.name.trim(), clinical_rate: num(clinical), admin_rate: num(admin) })
          } finally {
            setBusy(false)
          }
        }}
      >
        <Field label={t('companies.name')}>
          <input required autoFocus value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
        </Field>
        <div className="form-row">
          <Field label={t('companies.clinicalRate')}>
            <input inputMode="decimal" value={clinical} onChange={(e) => setClinical(e.target.value)} placeholder="0.00" />
          </Field>
          <Field label={t('companies.adminRate')}>
            <input inputMode="decimal" value={admin} onChange={(e) => setAdmin(e.target.value)} placeholder="0.00" />
          </Field>
        </div>
        <Field label={t('companies.paySchedule')}>
          <select value={d.pay_schedule} onChange={(e) => setD({ ...d, pay_schedule: e.target.value as PaySchedule })}>
            {SCHEDULES.map((s) => (
              <option key={s} value={s}>
                {t(`schedule.${s}`)}
              </option>
            ))}
          </select>
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
