import { useState } from 'react'
import { Badge, Empty, Field, Modal, PageHeader } from '../components/ui'
import { useData } from '../data/DataContext'
import type { Client } from '../data/types'
import { useI18n } from '../i18n'
import { daysBetween, rangeFor, today } from '../lib/dates'
import { AUTH_WARNING_DAYS } from '../lib/warnings'

type Draft = Omit<Client, 'id'> & { id?: string }

export function ClientsScreen() {
  const { t, num } = useI18n()
  const { clients, companies, hour_entries, save, remove, clientName, companyName } = useData()
  const [draft, setDraft] = useState<Draft | null>(null)
  const month = rangeFor('month', today())

  const blank = (): Draft => ({
    first_name: '',
    last_name: '',
    company_id: companies.find((c) => c.active)?.id ?? null,
    auth_start: null,
    auth_end: null,
    active: true,
    notes: '',
  })

  const sorted = [...clients].sort((a, b) => Number(b.active) - Number(a.active) || a.first_name.localeCompare(b.first_name))

  return (
    <>
      <PageHeader
        title={t('clients.title')}
        subtitle={t('clients.subtitle')}
        action={
          <button className="btn primary" disabled={companies.length === 0} onClick={() => setDraft(blank())}>
            {t('clients.add')}
          </button>
        }
      />
      {companies.length === 0 && <p className="muted">{t('clients.needCompany')}</p>}
      {clients.length === 0 ? (
        <Empty>{t('common.empty')}</Empty>
      ) : (
        <div className="grid cards">
          {sorted.map((c) => {
            const color = companies.find((co) => co.id === c.company_id)?.color ?? '#ccc'
            const hours = hour_entries
              .filter((h) => h.client_id === c.id && h.date >= month.start && h.date <= month.end)
              .reduce((s, h) => s + h.hours, 0)
            const left = c.auth_end ? daysBetween(today(), c.auth_end) : null
            return (
              <button key={c.id} className="card person-card" style={{ borderTopColor: color }} onClick={() => setDraft(c)}>
                <strong className="card-title">{clientName(c)}</strong>
                <span className="muted">{companyName(c.company_id)}</span>
                <span className="muted small">{t('clients.hoursMonth', { h: num(hours) })}</span>
                <span className="row-gap">
                  {!c.active ? (
                    <Badge tone="muted">{t('common.inactive')}</Badge>
                  ) : left === null ? (
                    <Badge tone="notice">{t('clients.authNone')}</Badge>
                  ) : left < 0 ? (
                    <Badge tone="urgent">{t('clients.authEnded')}</Badge>
                  ) : (
                    <Badge tone={left <= AUTH_WARNING_DAYS ? 'attention' : 'ok'}>{t('clients.authLeft', { days: left })}</Badge>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {draft && (
        <ClientForm
          draft={draft}
          onClose={() => setDraft(null)}
          onSave={async (d) => {
            await save('clients', d)
            setDraft(null)
          }}
          onDelete={
            draft.id
              ? async () => {
                  if (!confirm(t('common.confirmDelete'))) return
                  await remove('clients', draft.id!)
                  setDraft(null)
                }
              : undefined
          }
        />
      )}
    </>
  )
}

function ClientForm({
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
  const { companies } = useData()
  const [d, setD] = useState(draft)
  const [busy, setBusy] = useState(false)

  return (
    <Modal title={draft.id ? `${draft.first_name} ${draft.last_name}` : t('clients.add')} onClose={onClose}>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          try {
            await onSave({ ...d, first_name: d.first_name.trim(), last_name: d.last_name.trim() })
          } finally {
            setBusy(false)
          }
        }}
      >
        <div className="form-row">
          <Field label={t('clients.firstName')}>
            <input required autoFocus value={d.first_name} onChange={(e) => setD({ ...d, first_name: e.target.value })} />
          </Field>
          <Field label={t('clients.lastName')}>
            <input value={d.last_name} onChange={(e) => setD({ ...d, last_name: e.target.value })} />
          </Field>
        </div>
        <Field label={t('common.company')}>
          <select value={d.company_id ?? ''} onChange={(e) => setD({ ...d, company_id: e.target.value || null })}>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="form-row">
          <Field label={t('clients.authStart')}>
            <input type="date" value={d.auth_start ?? ''} onChange={(e) => setD({ ...d, auth_start: e.target.value || null })} />
          </Field>
          <Field label={t('clients.authEnd')}>
            <input type="date" value={d.auth_end ?? ''} onChange={(e) => setD({ ...d, auth_end: e.target.value || null })} />
          </Field>
        </div>
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
