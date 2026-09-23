import { useState } from 'react'
import { initialRange, RangePicker, resolveRange } from '../components/RangePicker'
import { Badge, Empty, Field, Modal, PageHeader, num as parseNum } from '../components/ui'
import { useData } from '../data/DataContext'
import type { Payment } from '../data/types'
import { useI18n } from '../i18n'
import { addDays, inRange, today, type DateRange } from '../lib/dates'
import { earningsByCompany, paymentRemaining, paymentStatus, sumEarnings, sumPayments } from '../lib/earnings'

type Draft = Omit<Payment, 'id'> & { id?: string }

const STATUS_TONE = { confirmed: 'ok', partial: 'attention', pending: 'notice' } as const

export function EarningsScreen() {
  const { t, money, num, date } = useI18n()
  const { companies, hour_entries, payments, profile, save, remove, companyName } = useData()
  const [range, setRange] = useState(() => initialRange('month'))
  const [companyFilter, setCompanyFilter] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const r = resolveRange(range)

  const visibleCompanies = companyFilter ? companies.filter((c) => c.id === companyFilter) : companies
  const earnings = earningsByCompany(visibleCompanies, hour_entries, r)
  const totals = sumEarnings(earnings)

  // A payment belongs to the range where its pay period ends.
  const pays = payments
    .filter((p) => inRange(p.period_end, r.start, r.end) && (!companyFilter || p.company_id === companyFilter))
    .sort((a, b) => b.pay_date.localeCompare(a.pay_date))
  const payTotals = sumPayments(pays)
  const setAside = Math.round(payTotals.received * profile.tax_rate) / 100

  const newPayment = (companyId: string, period: DateRange = r): Draft => ({
    company_id: companyId,
    period_start: period.start,
    period_end: period.end,
    pay_date: addDays(period.end, 7),
    expected: 0,
    received: 0,
    received_date: null,
    note: '',
  })

  return (
    <>
      <PageHeader
        title={t('earnings.title')}
        subtitle={t('earnings.subtitle')}
        action={
          <button
            className="btn primary"
            disabled={companies.length === 0}
            onClick={() => setDraft(newPayment(companyFilter || companies[0]?.id || ''))}
          >
            {t('earnings.recordPayment')}
          </button>
        }
      />
      <div className="toolbar">
        <RangePicker value={range} onChange={setRange} />
        <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} aria-label={t('common.company')}>
          <option value="">{t('common.allCompanies')}</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <section className="section">
        <h2>{t('earnings.byCompany')}</h2>
        {earnings.length === 0 ? (
          <Empty>{t('earnings.noHours')}</Empty>
        ) : (
          <div className="card table-card">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('common.company')}</th>
                  <th className="num">{t('earnings.clinicalHrs')}</th>
                  <th className="num">{t('earnings.clinicalEarn')}</th>
                  <th className="num">{t('earnings.adminHrs')}</th>
                  <th className="num">{t('earnings.adminEarn')}</th>
                  <th className="num">{t('earnings.totalExpected')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {earnings.map((e) => (
                  <tr key={e.company.id}>
                    <td>
                      <span className="dot" style={{ background: e.company.color }} />
                      {e.company.name}
                    </td>
                    <td className="num">{num(e.clinicalHours)}</td>
                    <td className="num">{money(e.clinicalEarnings)}</td>
                    <td className="num">{num(e.adminHours)}</td>
                    <td className="num">{money(e.adminEarnings)}</td>
                    <td className="num strong">{money(e.total)}</td>
                    <td className="num">
                      <button className="btn small" onClick={() => setDraft({ ...newPayment(e.company.id), expected: e.total })}>
                        {t('earnings.recordPayment')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>{t('common.total')}</td>
                  <td className="num">{num(totals.clinicalHours)}</td>
                  <td className="num">{money(totals.clinicalEarnings)}</td>
                  <td className="num">{num(totals.adminHours)}</td>
                  <td className="num">{money(totals.adminEarnings)}</td>
                  <td className="num">{money(totals.total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="muted small">{t('earnings.formula')}</p>
      </section>

      <section className="section">
        <h2>{t('earnings.payments')}</h2>
        <div className="stats">
          <Stat label={t('earnings.confirmations')} value={String(payTotals.count)} />
          <Stat label={t('earnings.totalExpectedPay')} value={money(payTotals.expected)} />
          <Stat label={t('earnings.totalReceived')} value={money(payTotals.received)} />
          <Stat label={t('earnings.remaining')} value={money(payTotals.remaining)} tone={payTotals.remaining > 0 ? 'attention' : undefined} />
        </div>
        {pays.length === 0 ? (
          <Empty>{t('earnings.noPayments')}</Empty>
        ) : (
          <div className="grid cards">
            {pays.map((p) => {
              const status = paymentStatus(p)
              const color = companies.find((c) => c.id === p.company_id)?.color ?? '#ccc'
              return (
                <button key={p.id} className="card person-card" style={{ borderTopColor: color }} onClick={() => setDraft(p)}>
                  <span className="row-between">
                    <strong className="card-title">{companyName(p.company_id)}</strong>
                    <Badge tone={STATUS_TONE[status]}>{t(`status.${status}`)}</Badge>
                  </span>
                  <KV k={t('earnings.period')} v={`${date(p.period_start)} – ${date(p.period_end)}`} />
                  <KV k={t('earnings.payDate')} v={date(p.pay_date)} />
                  <KV k={t('earnings.expected')} v={money(p.expected)} />
                  <KV k={t('earnings.received')} v={money(p.received)} />
                  <KV k={t('earnings.remaining')} v={money(paymentRemaining(p))} />
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section className="section">
        <h2>{t('earnings.taxes')}</h2>
        {profile.tax_rate > 0 ? (
          <div className="card">
            <p className="muted">{t('earnings.taxesHelp', { rate: num(profile.tax_rate) })}</p>
            <div className="stats">
              <Stat label={t('earnings.totalReceived')} value={money(payTotals.received)} />
              <Stat label={t('earnings.setAside')} value={money(setAside)} tone="attention" />
              <Stat label={t('earnings.afterSavings')} value={money(payTotals.received - setAside)} />
            </div>
          </div>
        ) : (
          <p className="muted">{t('earnings.taxesOff')}</p>
        )}
      </section>

      {draft && (
        <PaymentForm
          draft={draft}
          onClose={() => setDraft(null)}
          onSave={async (d) => {
            await save('payments', d)
            setDraft(null)
          }}
          onDelete={
            draft.id
              ? async () => {
                  if (!confirm(t('common.confirmDelete'))) return
                  await remove('payments', draft.id!)
                  setDraft(null)
                }
              : undefined
          }
        />
      )}
    </>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'attention' }) {
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  )
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <span className="kv">
      <span className="muted">{k}</span>
      <span>{v}</span>
    </span>
  )
}

function PaymentForm({
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
  const { t, money } = useI18n()
  const { companies, hour_entries } = useData()
  const [d, setD] = useState(draft)
  const [expected, setExpected] = useState(draft.expected ? String(draft.expected) : '')
  const [received, setReceived] = useState(draft.received ? String(draft.received) : '')
  const [busy, setBusy] = useState(false)

  const company = companies.find((c) => c.id === d.company_id)
  const calculated = company
    ? earningsByCompany([company], hour_entries, { start: d.period_start, end: d.period_end })[0]?.total ?? 0
    : 0

  return (
    <Modal title={t('earnings.recordFor')} onClose={onClose}>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!d.company_id) return
          const rec = parseNum(received)
          setBusy(true)
          try {
            await onSave({
              ...d,
              expected: parseNum(expected),
              received: rec,
              received_date: rec > 0 ? d.received_date ?? today() : null,
            })
          } finally {
            setBusy(false)
          }
        }}
      >
        <Field label={t('common.company')}>
          <select value={d.company_id} onChange={(e) => setD({ ...d, company_id: e.target.value })}>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="form-row">
          <Field label={t('earnings.periodStart')}>
            <input type="date" required value={d.period_start} onChange={(e) => setD({ ...d, period_start: e.target.value })} />
          </Field>
          <Field label={t('earnings.periodEnd')}>
            <input type="date" required value={d.period_end} onChange={(e) => setD({ ...d, period_end: e.target.value })} />
          </Field>
        </div>
        <Field label={t('earnings.payDate')}>
          <input type="date" required value={d.pay_date} onChange={(e) => setD({ ...d, pay_date: e.target.value })} />
        </Field>
        <div className="form-row">
          <Field label={t('earnings.expected')}>
            <input inputMode="decimal" value={expected} onChange={(e) => setExpected(e.target.value)} placeholder="0.00" />
          </Field>
          <Field label={t('earnings.received')}>
            <input inputMode="decimal" value={received} onChange={(e) => setReceived(e.target.value)} placeholder="0.00" />
          </Field>
        </div>
        {calculated > 0 && parseNum(expected) !== calculated && (
          <button type="button" className="btn small link" onClick={() => setExpected(String(calculated))}>
            {t('earnings.useCalculated', { amount: money(calculated) })}
          </button>
        )}
        <Field label={t('earnings.receivedDate')}>
          <input type="date" value={d.received_date ?? ''} onChange={(e) => setD({ ...d, received_date: e.target.value || null })} />
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
