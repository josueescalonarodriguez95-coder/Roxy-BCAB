import { useState } from 'react'
import { Field, Modal } from '../ui'
import { useData } from '../../data/DataContext'
import { EVENT_KINDS, type CalendarEvent, type EventKind } from '../../data/types'
import { useI18n } from '../../i18n'
import { DAY_MIN, fromMin, KIND_COLORS, repeatDates, toMin, type Repeat } from '../../lib/calendar'
import { addDays } from '../../lib/dates'

export type EventDraft = Omit<CalendarEvent, 'id'> & { id?: string }

const REPEATS: Repeat[] = ['none', 'daily', 'weekdays', 'weekly', 'biweekly', 'monthly']

/** Create / edit form. New events can repeat; the series is saved as separate events. */
export function EventForm({
  draft,
  onClose,
  onSave,
}: {
  draft: EventDraft
  onClose: () => void
  onSave: (d: EventDraft, dates: string[]) => Promise<void>
}) {
  const { t } = useI18n()
  const { clients, companies, supervisees, clientName, profile } = useData()
  const [d, setD] = useState(draft)
  const [allDay, setAllDay] = useState(!draft.start_time)
  const [repeat, setRepeat] = useState<Repeat>('none')
  const [until, setUntil] = useState(addDays(draft.date, 7 * 12))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const isNew = !draft.id
  const dates = isNew ? repeatDates(d.date, repeat, until) : [d.date]
  const activeClients = clients.filter((c) => c.active || c.id === d.client_id)

  const setStart = (v: string) => {
    // Moving the start keeps the length, like Google Calendar.
    const len = Math.max(15, toMin(d.end_time) - toMin(d.start_time))
    setD({ ...d, start_time: v, end_time: fromMin(Math.min(DAY_MIN - 1, toMin(v) + len)) })
  }

  return (
    <Modal title={isNew ? t('cal.newEvent') : t('cal.editEvent')} onClose={onClose}>
      <form
        className="form"
        onSubmit={async (ev) => {
          ev.preventDefault()
          const out: EventDraft = allDay ? { ...d, start_time: null, end_time: null } : d
          if (!allDay && toMin(out.end_time) <= toMin(out.start_time)) return setError(t('cal.endBeforeStart'))
          // An empty title gets a sensible one: "Session · MC".
          const client = clients.find((c) => c.id === out.client_id)
          const title = out.title.trim() || [t(`cal.kind.${out.kind}`), client ? clientName(client) : ''].filter(Boolean).join(' · ')
          setBusy(true)
          try {
            await onSave({ ...out, title }, dates)
          } finally {
            setBusy(false)
          }
        }}
      >
        <input
          className="title-input"
          autoFocus
          placeholder={t('cal.titlePlaceholder')}
          aria-label={t('cal.eventTitle')}
          value={d.title}
          onChange={(e) => setD({ ...d, title: e.target.value })}
        />
        <div className="kind-picker" role="radiogroup" aria-label={t('cal.kind')}>
          {EVENT_KINDS.filter((k) => k !== 'supervision' || profile.credential !== 'RBT').map((k: EventKind) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={d.kind === k}
              className={`kind-chip ${d.kind === k ? 'on' : ''}`}
              style={{ '--ev-bg': KIND_COLORS[k].bg, '--ev-fg': KIND_COLORS[k].fg } as React.CSSProperties}
              onClick={() => setD({ ...d, kind: k })}
            >
              {t(`cal.kind.${k}`)}
            </button>
          ))}
        </div>
        <div className="form-row">
          <Field label={t('common.date')}>
            <input type="date" required value={d.date} onChange={(e) => e.target.value && setD({ ...d, date: e.target.value })} />
          </Field>
          <label className="check allday-check">
            <input type="checkbox" checked={allDay} onChange={(e) => {
              setAllDay(e.target.checked)
              if (!e.target.checked && !d.start_time) setD({ ...d, start_time: '09:00', end_time: '10:00' })
            }} />
            {t('cal.allDay')}
          </label>
        </div>
        {!allDay && (
          <div className="form-row">
            <Field label={t('cal.start')}>
              <input type="time" step={900} required value={d.start_time ?? ''} onChange={(e) => e.target.value && setStart(e.target.value)} />
            </Field>
            <Field label={t('cal.end')}>
              <input type="time" step={900} required value={d.end_time ?? ''} onChange={(e) => e.target.value && setD({ ...d, end_time: e.target.value })} />
            </Field>
          </div>
        )}
        {isNew && (
          <div className="form-row">
            <Field label={t('cal.repeat')}>
              <select value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat)}>
                {REPEATS.map((r) => (
                  <option key={r} value={r}>
                    {t(`cal.repeat.${r}`)}
                  </option>
                ))}
              </select>
            </Field>
            {repeat !== 'none' && (
              <Field label={t('cal.repeatUntil')} hint={t('cal.repeatCount', { n: dates.length })}>
                <input type="date" value={until} min={d.date} onChange={(e) => e.target.value && setUntil(e.target.value)} />
              </Field>
            )}
          </div>
        )}
        <div className="form-row">
          <Field label={t('common.client')}>
            <select
              value={d.client_id ?? ''}
              onChange={(e) => {
                const c = clients.find((x) => x.id === e.target.value)
                // Picking a client also fills in their company.
                setD({ ...d, client_id: c?.id ?? null, company_id: c?.company_id ?? d.company_id })
              }}
            >
              <option value="">{t('cal.none')}</option>
              {activeClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {clientName(c)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('common.company')}>
            <select value={d.company_id ?? ''} onChange={(e) => setD({ ...d, company_id: e.target.value || null })}>
              <option value="">{t('cal.none')}</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {d.kind === 'supervision' && (
          <Field label={t('cal.supervisee')}>
            <select value={d.supervisee_id ?? ''} onChange={(e) => setD({ ...d, supervisee_id: e.target.value || null })}>
              <option value="">{t('cal.none')}</option>
              {supervisees
                .filter((s) => s.active || s.id === d.supervisee_id)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </Field>
        )}
        <Field label={t('cal.location')}>
          <input placeholder={t('cal.locationPlaceholder')} value={d.location} onChange={(e) => setD({ ...d, location: e.target.value })} />
        </Field>
        <Field label={t('common.notes')}>
          <textarea rows={2} value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} />
        </Field>
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
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
