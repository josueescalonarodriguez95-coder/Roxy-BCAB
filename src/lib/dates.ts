import type { ISODate } from '../data/types'

/** Local date as 'YYYY-MM-DD' (never toISOString, which shifts to UTC). */
export function toISO(d: Date): ISODate {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function fromISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function today(): ISODate {
  return toISO(new Date())
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = fromISO(s)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86_400_000)
}

export function inRange(d: ISODate, start: ISODate, end: ISODate): boolean {
  return d >= start && d <= end
}

export type RangeKind = 'week' | 'biweekly' | 'month' | 'year' | 'custom'

export interface DateRange {
  start: ISODate
  end: ISODate
}

/** Mondays two weeks apart counted from this date, so bi-weekly blocks are stable. */
const BIWEEKLY_ANCHOR = '2024-01-01'

/**
 * The range of the given kind that contains `ref`, shifted `offset` periods (−1 = previous).
 * Weeks start on Monday.
 */
export function rangeFor(kind: Exclude<RangeKind, 'custom'>, ref: ISODate, offset = 0): DateRange {
  const d = fromISO(ref)
  if (kind === 'month') {
    const start = new Date(d.getFullYear(), d.getMonth() + offset, 1)
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0)
    return { start: toISO(start), end: toISO(end) }
  }
  if (kind === 'year') {
    const y = d.getFullYear() + offset
    return { start: `${y}-01-01`, end: `${y}-12-31` }
  }
  const monday = addDays(ref, -((d.getDay() + 6) % 7))
  if (kind === 'week') {
    const start = addDays(monday, offset * 7)
    return { start, end: addDays(start, 6) }
  }
  const blocks = Math.floor(daysBetween(BIWEEKLY_ANCHOR, monday) / 14)
  const start = addDays(BIWEEKLY_ANCHOR, (blocks + offset) * 14)
  return { start, end: addDays(start, 13) }
}
