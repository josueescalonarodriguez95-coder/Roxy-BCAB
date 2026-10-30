import { useRef, useState } from 'react'
import type { ISODate } from '../../data/types'
import { useI18n } from '../../i18n'
import { monthMatrix, sameMonth, sortEvents } from '../../lib/calendar'
import { today } from '../../lib/dates'
import { colorOf, type CalHandlers, type DisplayEvent } from './types'

const MAX_CHIPS = 3

/** Month grid. Drag an event chip onto another day to move it; click an empty spot to create. */
export function MonthView({ date, events, h }: { date: ISODate; events: DisplayEvent[]; h: CalHandlers }) {
  const { t, fmt, time } = useI18n()
  const weeks = monthMatrix(date)
  const now = today()
  const byDay = new Map<ISODate, DisplayEvent[]>()
  for (const e of [...events].sort(sortEvents)) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e])

  // Drag state: which event, where the pointer started, and the day under the pointer.
  const drag = useRef<{ e: DisplayEvent; x: number; y: number; moved: boolean; el: HTMLElement } | null>(null)
  const [dragging, setDragging] = useState<{ id: string; over: ISODate | null } | null>(null)

  const dayAt = (x: number, y: number): ISODate | null =>
    (document.elementFromPoint(x, y)?.closest('[data-date]') as HTMLElement | null)?.dataset.date ?? null

  return (
    <div className="month-view glass">
      <div className="month-head">
        {weeks[0].map((d) => (
          <span key={d}>{fmt(d, { weekday: 'short' })}</span>
        ))}
      </div>
      <div
        className="month-grid"
        onPointerMove={(ev) => {
          const d = drag.current
          if (!d) return
          if (!d.moved && Math.hypot(ev.clientX - d.x, ev.clientY - d.y) < 5) return
          d.moved = true
          setDragging({ id: d.e.id, over: dayAt(ev.clientX, ev.clientY) })
        }}
        onPointerUp={(ev) => {
          const d = drag.current
          drag.current = null
          setDragging(null)
          if (!d) return
          if (!d.moved) return h.onOpen(d.e, d.el.getBoundingClientRect())
          const target = dayAt(ev.clientX, ev.clientY)
          if (target && target !== d.e.date) h.onMove(d.e, target)
        }}
        onPointerCancel={() => {
          drag.current = null
          setDragging(null)
        }}
      >
        {weeks.flat().map((d) => {
          const list = byDay.get(d) ?? []
          const extra = list.length - MAX_CHIPS
          return (
            <div
              key={d}
              data-date={d}
              className={['month-cell', sameMonth(d, date) ? '' : 'out', d === now ? 'today' : '', dragging?.over === d ? 'drop' : ''].join(' ')}
              onClick={(ev) => {
                if (ev.target === ev.currentTarget) h.onCreate(d, 9 * 60, 10 * 60)
              }}
            >
              <button className="month-num" onClick={() => h.onPickDay(d)}>
                {Number(d.slice(8)) === 1 ? fmt(d, { month: 'short', day: 'numeric' }) : Number(d.slice(8))}
              </button>
              {list.slice(0, extra > 0 ? MAX_CHIPS - 1 : MAX_CHIPS).map((e) => {
                const c = colorOf(e)
                return (
                  <div
                    key={e.id}
                    className={`chip-event ${e.start_time ? 'timed' : 'allday'} ${e.done ? 'done' : ''} ${dragging?.id === e.id ? 'ghost' : ''}`}
                    style={{ '--ev-bg': c.bg, '--ev-fg': c.fg } as React.CSSProperties}
                    onPointerDown={(ev) => {
                      if (ev.button !== 0) return
                      ev.stopPropagation()
                      // Read-only markers can be opened but not dragged.
                      drag.current = { e, x: ev.clientX, y: ev.clientY, moved: false, el: ev.currentTarget }
                      if (!e.overlay) ev.currentTarget.parentElement?.parentElement?.setPointerCapture(ev.pointerId)
                    }}
                    title={e.title}
                  >
                    {e.start_time && <span className="chip-dot" />}
                    {e.start_time && <span className="chip-time">{time(e.start_time)}</span>}
                    <span className="chip-title">{e.title}</span>
                  </div>
                )
              })}
              {extra > 0 && (
                <button className="month-more" onClick={() => h.onPickDay(d)}>
                  {t('cal.more', { n: extra + 1 })}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
