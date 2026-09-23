import type { Company, HourEntry, Payment } from '../data/types'
import { inRange, type DateRange } from './dates'

export interface CompanyEarnings {
  company: Company
  clinicalHours: number
  clinicalEarnings: number
  adminHours: number
  adminEarnings: number
  total: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Expected earnings per company in a range: hours × the rate stored on each company.
 * Companies with no hours in the range are left out.
 */
export function earningsByCompany(companies: Company[], hours: HourEntry[], range: DateRange): CompanyEarnings[] {
  return companies
    .map((company) => {
      const rows = hours.filter((h) => h.company_id === company.id && inRange(h.date, range.start, range.end))
      const clinicalHours = rows.filter((h) => h.kind === 'clinical').reduce((s, h) => s + h.hours, 0)
      const adminHours = rows.filter((h) => h.kind === 'admin').reduce((s, h) => s + h.hours, 0)
      const clinicalEarnings = round2(clinicalHours * company.clinical_rate)
      const adminEarnings = round2(adminHours * company.admin_rate)
      return {
        company,
        clinicalHours,
        clinicalEarnings,
        adminHours,
        adminEarnings,
        total: round2(clinicalEarnings + adminEarnings),
      }
    })
    .filter((e) => e.clinicalHours > 0 || e.adminHours > 0)
}

export function sumEarnings(rows: CompanyEarnings[]) {
  return rows.reduce(
    (acc, r) => ({
      clinicalHours: acc.clinicalHours + r.clinicalHours,
      clinicalEarnings: round2(acc.clinicalEarnings + r.clinicalEarnings),
      adminHours: acc.adminHours + r.adminHours,
      adminEarnings: round2(acc.adminEarnings + r.adminEarnings),
      total: round2(acc.total + r.total),
    }),
    { clinicalHours: 0, clinicalEarnings: 0, adminHours: 0, adminEarnings: 0, total: 0 },
  )
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
