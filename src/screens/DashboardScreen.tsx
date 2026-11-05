import { useState } from 'react'
import { PageHeader } from '../components/ui'
import { WarningList } from '../components/WarningList'
import { useData } from '../data/DataContext'
import { useWarnings } from '../data/useWarnings'
import { useI18n } from '../i18n'
import { inRange, rangeFor, today } from '../lib/dates'
import { earningsByCompany, sumEarnings, sumPayments } from '../lib/earnings'
import { supervisionEarnings } from '../lib/supervision'
import { useGo } from '../nav'
import { KIND_COLORS, sortEvents } from '../lib/calendar'
import { addDays } from '../lib/dates'
import { HourForm } from './HoursScreen'

export function DashboardScreen() {
  const { t, money, num, fmt, time } = useI18n()
  const { profile, companies, clients, hour_entries, payments, todos, supervisees, supervision_sessions, events, save } = useData()
  const warnings = useWarnings()
  const go = useGo()
  const [logging, setLogging] = useState(false)

  const month = rangeFor('month', today())
  const monthHours = hour_entries.filter((h) => inRange(h.date, month.start, month.end))
  const clinical = monthHours.filter((h) => h.kind === 'clinical').reduce((s, h) => s + h.hours, 0)
  const admin = monthHours.filter((h) => h.kind === 'admin').reduce((s, h) => s + h.hours, 0)
  const supHours = monthHours.filter((h) => h.kind === 'supervision').reduce((s, h) => s + h.hours, 0)
  const expected =
    sumEarnings(earningsByCompany(companies, hour_entries, month)).total +
    supervisionEarnings(supervisees, supervision_sessions, month, today()).reduce((sum, e) => sum + e.total, 0)
  const pending = sumPayments(payments).remaining
  const openTodos = todos.filter((td) => !td.done)
  const name = profile.display_name.trim().split(' ')[0]
  const upcoming = events
    .filter((e) => e.date >= today() && e.date <= addDays(today(), 7) && !e.done)
    .sort(sortEvents)
    .slice(0, 6)

  return (
    <>
      <PageHeader
        title={name ? t('dash.hello', { name }) : t('dash.helloNoName')}
        subtitle={t('dash.subtitle')}
        action={
          companies.length > 0 && (
            <button className="btn primary" onClick={() => setLogging(true)}>
              {t('dash.quickLog')}
            </button>
          )
        }
      />

      {companies.length === 0 && (
        <div className="card callout">
          <p>{t('dash.start')}</p>
          <button className="btn primary" onClick={() => go('companies')}>
            {t('dash.startButton')}
          </button>
        </div>
      )}

      <div className="stats">
        <button className="stat tint-blue" onClick={() => go('hours')}>
          <span className="stat-label">{t('dash.hoursMonth')}</span>
          <span className="stat-value">{num(clinical + admin + supHours)}</span>
          <span className="stat-sub">{t('dash.hoursSplit', { clinical: num(clinical), admin: num(admin), sup: num(supHours) })}</span>
        </button>
        <button className="stat tint-mint" onClick={() => go('earnings')}>
          <span className="stat-label">{t('dash.expectedMonth')}</span>
          <span className="stat-value">{money(expected)}</span>
        </button>
        <button className={`stat tint-peach ${pending > 0 ? 'stat-attention' : ''}`} onClick={() => go('earnings')}>
          <span className="stat-label">{t('dash.pendingBalance')}</span>
          <span className="stat-value">{money(pending)}</span>
        </button>
        <button className="stat tint-pink" onClick={() => go('clients')}>
          <span className="stat-label">{t('dash.activeClients')}</span>
          <span className="stat-value">{clients.filter((c) => c.active).length}</span>
        </button>
      </div>

      <div className="two-col">
        <section className="card">
          <div className="row-between">
            <h2>{t('dash.warnings')}</h2>
            {warnings.length > 5 && (
              <button className="btn small link" onClick={() => go('warnings')}>
                {t('dash.seeAll')} ({warnings.length})
              </button>
            )}
          </div>
          {warnings.length === 0 ? <p className="muted">{t('dash.allGood')}</p> : <WarningList warnings={warnings.slice(0, 5)} />}
        </section>
        <section className="card">
          <div className="row-between">
            <h2>{t('dash.todos')}</h2>
            <button className="btn small link" onClick={() => go('todo')}>
              {t('dash.seeAll')}
            </button>
          </div>
          {openTodos.length === 0 ? (
            <p className="muted">{t('dash.allGood')}</p>
          ) : (
            <ul className="plain-list">
              {openTodos.slice(0, 6).map((td) => (
                <li key={td.id}>
                  <label className="check">
                    <input type="checkbox" onChange={() => save('todos', { ...td, done: true, done_at: new Date().toISOString() })} />
                    {td.text}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card">
          <div className="row-between">
            <h2>{t('cal.upcoming')}</h2>
            <button className="btn small link" onClick={() => go('calendar')}>
              {t('dash.seeAll')}
            </button>
          </div>
          {upcoming.length === 0 ? (
            <p className="muted">{t('cal.noUpcoming')}</p>
          ) : (
            <ul className="upcoming">
              {upcoming.map((e) => (
                <li key={e.id}>
                  <button
                    className="upcoming-item"
                    style={{ '--ev-bg': KIND_COLORS[e.kind].bg, '--ev-fg': KIND_COLORS[e.kind].fg } as React.CSSProperties}
                    onClick={() => go('calendar')}
                  >
                    <span className="upcoming-date">
                      <strong>{Number(e.date.slice(8))}</strong>
                      <small>{fmt(e.date, { weekday: 'short' })}</small>
                    </span>
                    <span className="upcoming-text">
                      <span className="upcoming-title">{e.title}</span>
                      <span className="muted small">{e.start_time ? `${time(e.start_time)} – ${time(e.end_time)}` : t('cal.allDay')}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {logging && (
        <HourForm
          draft={{
            date: today(),
            company_id: companies.find((c) => c.active)?.id ?? companies[0].id,
            client_id: null,
            kind: 'clinical',
            hours: 0,
            note: '',
          }}
          onClose={() => setLogging(false)}
          onSave={async (d) => {
            await save('hour_entries', d)
            setLogging(false)
          }}
        />
      )}
    </>
  )
}
