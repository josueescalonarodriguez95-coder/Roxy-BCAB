import type { CalendarEvent, ISODate } from '../../data/types'
import type { Tab } from '../../nav'
import { KIND_COLORS } from '../../lib/calendar'

/**
 * What the calendar draws: a real event, or a read-only marker taken from other parts of the
 * app (supervision meetings, authorization end dates, pay days) that opens its own tab.
 */
export type DisplayEvent = CalendarEvent & {
  overlay?: Tab
  color?: { bg: string; fg: string }
}

export function colorOf(e: DisplayEvent) {
  return e.color ?? KIND_COLORS[e.kind]
}

export interface CalHandlers {
  /** Opens the details card for an event, anchored to the element that was clicked. */
  onOpen: (e: DisplayEvent, anchor: DOMRect) => void
  /** Opens the new-event form. `start`/`end` are minutes; omitted = all-day. */
  onCreate: (date: ISODate, start?: number, end?: number) => void
  /** Moves an event to another day (and time, when given), keeping its length. */
  onMove: (e: DisplayEvent, date: ISODate, start?: number) => void
  /** Changes where a timed event ends. */
  onResize: (e: DisplayEvent, end: number) => void
  /** Jumps to the day view of a date. */
  onPickDay: (date: ISODate) => void
}
