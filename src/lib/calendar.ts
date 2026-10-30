import type { CalendarEvent, EventKind, ISODate } from '../data/types'
import { addDays, fromISO, toISO } from './dates'

/** Minutes snap to this grid when creating, moving or resizing events. */
export const SNAP = 15
export const DAY_MIN = 24 * 60

export type CalView = 'month' | 'week' | 'day' | 'agenda'

/** Pastel color per event type (background, accent). Matches the sidebar palette. */
export const KIND_COLORS: Record<EventKind, { bg: string; fg: string }> = {
  session: { bg: '#ffd3e5', fg: '#b03a6e' },
  supervision: { bg: '#c8f2df', fg: '#1f7a55' },
  assessment: { bg: '#ddd0ff', fg: '#5b3fc4' },
  meeting: { bg: '#cfe5ff', fg: '#2a5ea8' },
  admin: { bg: '#ffe2c6', fg: '#a2561a' },
  personal: { bg: '#fff3b8', fg: '#8a6d00' },
  other: { bg: '#e6e2ee', fg: '#5b5575' },
}

export function toMin(t: string | null): number {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function fromMin(min: number): string {
  const m = Math.max(0, Math.min(DAY_MIN - 1, Math.round(min)))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export function snap(min: number): number {
  return Math.round(min / SNAP) * SNAP
}

/** Event length in hours (all-day events count as 0). */
export function durationHours(e: Pick<CalendarEvent, 'start_time' | 'end_time'>): number {
  if (!e.start_time || !e.end_time) return 0
  return Math.max(0, toMin(e.end_time) - toMin(e.start_time)) / 60
}

/** Sunday of the week containing `d` (US-style weeks, like Google Calendar). */
export function startOfWeek(d: ISODate): ISODate {
  return addDays(d, -fromISO(d).getDay())
}

export function weekDays(d: ISODate): ISODate[] {
  const start = startOfWeek(d)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

/** 6 rows × 7 days covering the month of `d`, starting on a Sunday. */
export function monthMatrix(d: ISODate): ISODate[][] {
  const first = toISO(new Date(fromISO(d).getFullYear(), fromISO(d).getMonth(), 1))
  const start = startOfWeek(first)
  return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i)))
}

export function sameMonth(a: ISODate, b: ISODate): boolean {
  return a.slice(0, 7) === b.slice(0, 7)
}

/** Moves the reference date one period in the given view. */
export function shiftDate(d: ISODate, view: CalView, n: number): ISODate {
  if (view === 'day') return addDays(d, n)
  if (view === 'week' || view === 'agenda') return addDays(d, 7 * n)
  const x = fromISO(d)
  return toISO(new Date(x.getFullYear(), x.getMonth() + n, Math.min(x.getDate(), 28)))
}

export function sortEvents(a: CalendarEvent, b: CalendarEvent): number {
  // By day; within a day all-day first, then by start time, then longest first.
  const byDate = a.date.localeCompare(b.date)
  if (byDate) return byDate
  if (!a.start_time !== !b.start_time) return a.start_time ? 1 : -1
  return (
    (a.start_time ?? '').localeCompare(b.start_time ?? '') ||
    durationHours(b) - durationHours(a) ||
    a.title.localeCompare(b.title)
  )
}

export interface Placed<E extends CalendarEvent = CalendarEvent> {
  event: E
  /** Column index and number of columns in its overlap group (side-by-side layout). */
  col: number
  cols: number
}

/**
 * Lays out the timed events of one day like Google Calendar: events that overlap share the
 * width, each in its own column.
 */
export function layoutDay<E extends CalendarEvent>(events: E[]): Placed<E>[] {
  const timed = events.filter((e) => e.start_time).sort(sortEvents)
  const out: Placed<E>[] = []
  let group: Placed<E>[] = []
  let groupEnd = -1
  let colEnds: number[] = []

  const flush = () => {
    const cols = colEnds.length
    group.forEach((p) => (p.cols = cols))
    out.push(...group)
    group = []
    colEnds = []
  }

  for (const e of timed) {
    const start = toMin(e.start_time)
    // Very short events still take up 15 minutes of room.
    const end = Math.max(toMin(e.end_time) || start + SNAP, start + SNAP)
    if (start >= groupEnd && group.length) flush()
    let col = colEnds.findIndex((end2) => end2 <= start)
    if (col < 0) {
      col = colEnds.length
      colEnds.push(end)
    } else colEnds[col] = end
    group.push({ event: e, col, cols: 1 })
    groupEnd = Math.max(groupEnd, end)
  }
  if (group.length) flush()
  return out
}

export type Repeat = 'none' | 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'monthly'

/** Dates of every occurrence from `start` through `until` (inclusive), capped for safety. */
export function repeatDates(start: ISODate, repeat: Repeat, until: ISODate, max = 200): ISODate[] {
  if (repeat === 'none' || until < start) return [start]
  const out: ISODate[] = []
  const first = fromISO(start)
  for (let i = 0; out.length < max; i++) {
    let d: ISODate
    if (repeat === 'monthly') {
      const x = new Date(first.getFullYear(), first.getMonth() + i, first.getDate())
      // Skip months that don't have this day (e.g. the 31st).
      if (x.getDate() !== first.getDate()) continue
      d = toISO(x)
    } else {
      const step = repeat === 'weekly' ? 7 : repeat === 'biweekly' ? 14 : 1
      d = addDays(start, i * step)
      if (repeat === 'weekdays') {
        const wd = fromISO(d).getDay()
        if (wd === 0 || wd === 6) {
          if (d > until) break
          continue
        }
      }
    }
    if (d > until) break
    out.push(d)
  }
  return out
}

/** Minutes since midnight right now (for the red "now" line). */
export function nowMinutes(): number {
  const n = new Date()
  return n.getHours() * 60 + n.getMinutes()
}
