import { useState } from 'react'
import { PageHeader } from '../components/ui'
import { WarningList } from '../components/WarningList'
import { useData } from '../data/DataContext'
import { useWarnings } from '../data/useWarnings'
import { useI18n } from '../i18n'
import { inRange, rangeFor, today } from '../lib/dates'
import { earningsByCompany, sumEarnings, sumPayments } from '../lib/earnings'
import { useGo } from '../nav'
import { HourForm } from './HoursScreen'

export function DashboardScreen() {
  const { t, money, num } = useI18n()
  const { profile, companies, clients, hour_entries, payments, todos, save } = useData()
  const warnings = useWarnings()
  const go = useGo()
  const [logging, setLogging] = useState(false)

  const month = rangeFor('month', today())
  const monthHours = hour_entries.filter((h) => inRange(h.date, month.start, month.end))
  const clinical = monthHours.filter((h) => h.kind === 'clinical').reduce((s, h) => s + h.hours, 0)
  const admin = monthHours.filter((h) => h.kind === 'admin').reduce((s, h) => s + h.hours, 0)
  const expected = sumEarnings(earningsByCompany(companies, hour_entries, month)).total
  const pending = sumPayments(payments).remaining
  const openTodos = todos.filter((td) => !td.done)
  const name = profile.display_name.trim().split(' ')[0]

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
        <button className="stat" onClick={() => go('hours')}>
          <span className="stat-label">{t('dash.hoursMonth')}</span>
          <span className="stat-value">{num(clinical + admin)}</span>
          <span className="stat-sub">{t('dash.hoursSplit', { clinical: num(clinical), admin: num(admin) })}</span>
        </button>
        <button className="stat" onClick={() => go('earnings')}>
          <span className="stat-label">{t('dash.expectedMonth')}</span>
          <span className="stat-value">{money(expected)}</span>
        </button>
        <button className={`stat ${pending > 0 ? 'stat-attention' : ''}`} onClick={() => go('earnings')}>
          <span className="stat-label">{t('dash.pendingBalance')}</span>
          <span className="stat-value">{money(pending)}</span>
        </button>
        <button className="stat" onClick={() => go('clients')}>
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
