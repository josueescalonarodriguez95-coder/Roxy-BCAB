import type { Company, HourEntry, HourKind, Payment } from '../data/types'
import { inRange, type DateRange } from './dates'

export interface CompanyEarnings {
  company: Company
  /** Hours per service type (session, assessment, parent_training, supervision, …). */
  byKind: Partial<Record<HourKind, number>>
  hours: number
  rate: number
  total: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Expected earnings per company in a range: every hour she logged (any service) × the company's
 * hourly rate. Companies with no hours in the range are left out.
 */
export function earningsByCompany(companies: Company[], hours: HourEntry[], range: DateRange): CompanyEarnings[] {
  return companies
    .map((company) => {
      const rows = hours.filter((h) => h.company_id === company.id && inRange(h.date, range.start, range.end))
      const byKind: Partial<Record<HourKind, number>> = {}
      for (const h of rows) byKind[h.kind] = round2((byKind[h.kind] ?? 0) + h.hours)
      const total_hours = round2(rows.reduce((s, h) => s + h.hours, 0))
      return { company, byKind, hours: total_hours, rate: company.clinical_rate, total: round2(total_hours * company.clinical_rate) }
    })
    .filter((e) => e.hours > 0)
}

export function sumEarnings(rows: CompanyEarnings[]) {
  const byKind: Partial<Record<HourKind, number>> = {}
  for (const r of rows) for (const [k, v] of Object.entries(r.byKind)) byKind[k as HourKind] = round2((byKind[k as HourKind] ?? 0) + (v ?? 0))
  return {
    byKind,
    hours: round2(rows.reduce((s, r) => s + r.hours, 0)),
    total: round2(rows.reduce((s, r) => s + r.total, 0)),
  }
}

export type PaymentStatus = 'confirmed' | 'partial' | 'pending'

export function paymentStatus(p: Payment): PaymentStatus {
  if (p.received >= p.expected && p.received > 0) return 'confirmed'
  if (p.received > 0) return 'partial'
  return 'pending'
}

export function paymentRemaining(p: Payment): number {
  return Math.max(0, round2(p.expected - p.received))
}

export function sumPayments(payments: Payment[]) {
  const expected = round2(payments.reduce((s, p) => s + p.expected, 0))
  const received = round2(payments.reduce((s, p) => s + p.received, 0))
  const remaining = round2(payments.reduce((s, p) => s + paymentRemaining(p), 0))
  return { count: payments.length, expected, received, remaining }
}
