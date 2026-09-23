import type { Client, Company, HourEntry, Payment, Profile, Supervisee, SuperviseeMonth, SupervisionSession } from '../data/types'
import { addDays, daysBetween, rangeFor, today } from './dates'
import { paymentRemaining } from './earnings'
import { monthKey, monthReport, nextSession, shiftMonth } from './supervision'

export type Level = 'urgent' | 'attention' | 'notice'

/** A warning is data (key + params); the screen translates it, so it works in both languages. */
export interface Warning {
  id: string
  level: Level
  key:
    | 'noHoursThisMonth'
    | 'certDateMissing'
    | 'firstYear'
    | 'authExpired'
    | 'authExpiring'
    | 'authMissing'
    | 'paymentOverdue'
    | 'companyNoRates'
    | 'supContractMissing'
    | 'supHoursMissing'
    | 'supNotMet'
    | 'supNoUpcoming'
  params?: Record<string, string | number>
  /** Tab to open when the warning is clicked. */
  tab: 'hours' | 'settings' | 'clients' | 'earnings' | 'companies' | 'supervision'
}

/** Days before an authorization ends when the reassessment reminder starts. */
export const AUTH_WARNING_DAYS = 30

const LEVEL_ORDER: Record<Level, number> = { urgent: 0, attention: 1, notice: 2 }

export function computeWarnings(input: {
  profile: Profile
  companies: Company[]
  clients: Client[]
  hours: HourEntry[]
  payments: Payment[]
  supervisees: Supervisee[]
  sessions: SupervisionSession[]
  months: SuperviseeMonth[]
  clientName: (c: Client) => string
  companyName: (id: string) => string
}): Warning[] {
  const { profile, companies, clients, hours, payments, clientName, companyName } = input
  const activeSupervisees = input.supervisees.filter((s) => s.active)
  const now = today()
  const out: Warning[] = []

  const month = rangeFor('month', now)
  if (companies.length > 0 && !hours.some((h) => h.date >= month.start && h.date <= month.end)) {
    out.push({ id: 'no-hours', level: 'attention', key: 'noHoursThisMonth', tab: 'hours' })
  }

  if (profile.credential !== 'RBT') {
    if (!profile.certification_date) {
      out.push({ id: 'cert-missing', level: 'notice', key: 'certDateMissing', tab: 'settings' })
    } else if (now < addDays(profile.certification_date, 365) && profile.credential === 'BCBA') {
      // BACB: a BCBA supervising in the first year after certification needs a consulting supervisor.
      out.push({
        id: 'first-year',
        level: activeSupervisees.length > 0 ? 'attention' : 'notice',
        key: 'firstYear',
        params: { date: addDays(profile.certification_date, 365) },
        tab: 'settings',
      })
    }
  }

  for (const c of clients.filter((c) => c.active)) {
    const name = clientName(c)
    if (!c.auth_end) {
      out.push({ id: `auth-missing-${c.id}`, level: 'notice', key: 'authMissing', params: { name }, tab: 'clients' })
      continue
    }
    const left = daysBetween(now, c.auth_end)
    if (left < 0) {
      out.push({ id: `auth-exp-${c.id}`, level: 'urgent', key: 'authExpired', params: { name, date: c.auth_end }, tab: 'clients' })
    } else if (left <= AUTH_WARNING_DAYS) {
      out.push({ id: `auth-soon-${c.id}`, level: 'attention', key: 'authExpiring', params: { name, days: left }, tab: 'clients' })
    }
  }

  for (const p of payments) {
    if (p.pay_date < now && paymentRemaining(p) > 0) {
      out.push({
        id: `pay-${p.id}`,
        level: 'attention',
        key: 'paymentOverdue',
        params: { company: companyName(p.company_id), date: p.pay_date, amount: paymentRemaining(p) },
        tab: 'earnings',
      })
    }
  }

  for (const co of companies.filter((c) => c.active && c.clinical_rate <= 0)) {
    out.push({ id: `rates-${co.id}`, level: 'notice', key: 'companyNoRates', params: { company: co.name }, tab: 'companies' })
  }

  const thisMonth = monthKey(now)
  const lastMonth = shiftMonth(thisMonth, -1)
  for (const s of activeSupervisees) {
    const name = s.name
    if (!s.contract_date) {
      out.push({ id: `sup-contract-${s.id}`, level: 'attention', key: 'supContractMissing', params: { name }, tab: 'supervision' })
    }
    // Last month is closed: its hours are needed to know whether the requirement was met.
    // Without a start date we can't tell whether they were supervised last month, so skip it.
    const startedBefore = !!s.start_date && monthKey(s.start_date) <= lastMonth
    if (startedBefore) {
      const last = monthReport(s, lastMonth, input.sessions, input.months, now)
      if (last.status === 'noHours') {
        out.push({ id: `sup-hours-${s.id}`, level: 'attention', key: 'supHoursMissing', params: { name, month: lastMonth }, tab: 'supervision' })
      } else if (last.status === 'notMet') {
        out.push({ id: `sup-notmet-${s.id}`, level: 'urgent', key: 'supNotMet', params: { name, month: lastMonth }, tab: 'supervision' })
      }
    }
    const current = monthReport(s, thisMonth, input.sessions, input.months, now)
    if (current.status !== 'met' && !nextSession(s, input.sessions, now)) {
      out.push({ id: `sup-next-${s.id}`, level: 'notice', key: 'supNoUpcoming', params: { name }, tab: 'supervision' })
    }
  }

  return out.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level])
}
