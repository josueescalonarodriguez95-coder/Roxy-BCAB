import type { ISODate, Supervisee, SuperviseeMonth, SupervisionSession } from '../data/types'
import { fromISO, toISO } from './dates'

/**
 * BACB monthly supervision rules, in one place so they are easy to update.
 * Sources: RBT Handbook (ongoing supervision) and BCBA Handbook, 2022 fieldwork requirements.
 * The app shows a reminder to verify them in the BACB portal: requirements change over time.
 */
export const RULES = {
  rbt: {
    /** Supervision must be at least this % of the hours the RBT provided services. */
    percent: 5,
    minContacts: 2,
    /** At least one contact must be individual (not group). */
    minIndividualContacts: 1,
    /** At least one contact must observe the RBT with a client. */
    minObservations: 1,
    /** Group supervision can be at most this % of the supervision hours. */
    maxGroupPercent: 50,
  },
  fieldwork: {
    supervised: { percent: 5, minContacts: 4, totalHours: 2000 },
    concentrated: { percent: 10, minContacts: 6, totalHours: 1500 },
    minObservations: 1,
    maxGroupPercent: 50,
    minMonthlyHours: 20,
    maxMonthlyHours: 130,
  },
} as const

export type CheckKey = 'percent' | 'contacts' | 'individual' | 'observation' | 'group' | 'monthlyMin' | 'monthlyMax'

export interface Check {
  key: CheckKey
  ok: boolean
  /** Values for the translated label, e.g. { n: 2, of: 4 }. */
  params: Record<string, string | number>
}

export type MonthStatus = 'met' | 'inProgress' | 'notMet' | 'noHours'

export interface MonthReport {
  month: string
  /** Hours the RBT worked / the trainee accrued this month. */
  workHours: number
  hasWorkHours: boolean
  supervisionHours: number
  groupHours: number
  percent: number
  required: number
  remaining: number
  /** 0–100, how much of the required supervision is done. */
  complete: number
  contacts: number
  checks: Check[]
  status: MonthStatus
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function monthKey(d: ISODate): string {
  return d.slice(0, 7)
}

export function monthRange(month: string): { start: ISODate; end: ISODate } {
  const start = `${month}-01`
  const d = fromISO(start)
  return { start, end: toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)) }
}

export function shiftMonth(month: string, n: number): string {
  const d = fromISO(`${month}-01`)
  return monthKey(toISO(new Date(d.getFullYear(), d.getMonth() + n, 1)))
}

/**
 * How a supervisee's month looks against the BACB rules. Only sessions up to `asOf` count as
 * delivered; later ones are scheduled, not done yet.
 */
export function monthReport(
  s: Supervisee,
  month: string,
  sessions: SupervisionSession[],
  months: SuperviseeMonth[],
  asOf: ISODate,
): MonthReport {
  const { start, end } = monthRange(month)
  const done = sessions.filter((x) => x.supervisee_id === s.id && x.date >= start && x.date <= end && x.date <= asOf)
  const row = months.find((m) => m.supervisee_id === s.id && m.month === month)
  const workHours = row?.hours ?? 0

  const fw = s.kind === 'fieldwork' ? RULES.fieldwork[s.fieldwork_type] : null
  const percent = fw ? fw.percent : RULES.rbt.percent
  const minContacts = fw ? fw.minContacts : RULES.rbt.minContacts
  const maxGroup = fw ? RULES.fieldwork.maxGroupPercent : RULES.rbt.maxGroupPercent

  const supervisionHours = round2(done.reduce((sum, x) => sum + x.hours, 0))
  const groupHours = round2(done.filter((x) => x.format === 'group').reduce((sum, x) => sum + x.hours, 0))
  const required = round2((workHours * percent) / 100)
  const remaining = Math.max(0, round2(required - supervisionHours))
  const complete = required > 0 ? Math.min(100, Math.round((supervisionHours / required) * 100)) : 0
  const individual = done.filter((x) => x.format === 'individual').length
  const observations = done.filter((x) => x.with_client).length
  const groupPct = supervisionHours > 0 ? Math.round((groupHours / supervisionHours) * 100) : 0

  const checks: Check[] = [
    { key: 'percent', ok: workHours > 0 && supervisionHours >= required, params: { pct: percent } },
    { key: 'contacts', ok: done.length >= minContacts, params: { n: done.length, of: minContacts } },
  ]
  if (!fw) {
    checks.push({ key: 'individual', ok: individual >= RULES.rbt.minIndividualContacts, params: { n: individual } })
  }
  checks.push(
    { key: 'observation', ok: observations >= (fw ? RULES.fieldwork.minObservations : RULES.rbt.minObservations), params: { n: observations } },
    { key: 'group', ok: groupPct <= maxGroup, params: { pct: groupPct, max: maxGroup } },
  )
  if (fw) {
    checks.push(
      { key: 'monthlyMin', ok: workHours >= RULES.fieldwork.minMonthlyHours, params: { h: RULES.fieldwork.minMonthlyHours } },
      { key: 'monthlyMax', ok: workHours <= RULES.fieldwork.maxMonthlyHours, params: { h: RULES.fieldwork.maxMonthlyHours } },
    )
  }

  const allOk = checks.every((c) => c.ok)
  const monthOver = asOf > end
  const status: MonthStatus = !row ? 'noHours' : allOk ? 'met' : monthOver ? 'notMet' : 'inProgress'

  return {
    month,
    workHours,
    hasWorkHours: !!row,
    supervisionHours,
    groupHours,
    percent,
    required,
    remaining,
    complete,
    contacts: done.length,
    checks,
    status,
  }
}

/** Fieldwork hours accrued so far (all months) and the total the trainee needs. */
export function fieldworkProgress(s: Supervisee, months: SuperviseeMonth[]) {
  const total = RULES.fieldwork[s.fieldwork_type].totalHours
  const accrued = round2(months.filter((m) => m.supervisee_id === s.id).reduce((sum, m) => sum + m.hours, 0))
  return { accrued, total, pct: Math.min(100, Math.round((accrued / total) * 100)) }
}

/** Next scheduled meeting after today, if any (today's already counts as delivered). */
export function nextSession(s: Supervisee, sessions: SupervisionSession[], asOf: ISODate): SupervisionSession | undefined {
  return sessions
    .filter((x) => x.supervisee_id === s.id && x.date > asOf)
    .sort((a, b) => a.date.localeCompare(b.date))[0]
}

/** Supervision earnings in a range: hours delivered (up to `asOf`) × the supervisee's rate. */
export function supervisionEarnings(
  supervisees: Supervisee[],
  sessions: SupervisionSession[],
  range: { start: ISODate; end: ISODate },
  asOf: ISODate,
) {
  return supervisees
    .map((s) => {
      const hours = round2(
        sessions
          .filter((x) => x.supervisee_id === s.id && x.date >= range.start && x.date <= range.end && x.date <= asOf)
          .reduce((sum, x) => sum + x.hours, 0),
      )
      return { supervisee: s, hours, total: round2(hours * s.rate) }
    })
    .filter((r) => r.hours > 0 && r.supervisee.rate > 0)
}
