import { useEffect, useRef, useState } from 'react'
import type { ISODate } from '../../data/types'
import { useI18n } from '../../i18n'
import { DAY_MIN, fromMin, layoutDay, nowMinutes, snap, SNAP, toMin } from '../../lib/calendar'
import { today } from '../../lib/dates'
import { colorOf, type CalHandlers, type DisplayEvent } from './types'

/** Height of one hour in pixels. */
const HOUR = 52
const PX_PER_MIN = HOUR / 60

type Mode = 'create' | 'move' | 'resize'

interface Drag {
  mode: Mode
  e?: DisplayEvent
  el?: HTMLElement
  x: number
  y: number
  moved: boolean
  /** create: minute where the drag started; move: minutes between event start and grab point. */
  anchor: number
  date: ISODate
}

/** Where the event (or the new one being drawn) will land while dragging. */
interface Preview {
  id?: string
  date: ISODate
  start: number
  end: number
}

/** Week / day view with a 24-hour grid, like Google Calendar. */
export function TimeGrid({ days, events, h }: { days: ISODate[]; events: DisplayEvent[]; h: CalHandlers }) {
  const { t, fmt, time } = useI18n()
  const scrollRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [nowMin, setNowMin] = useState(nowMinutes)
  const now = today()

  // Start the day around 7 AM, and keep the red "now" line moving.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR - 10
    const id = window.setInterval(() => setNowMin(nowMinutes()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  /** Day column and minute under the pointer (clamped to the visible days). */
  const pointAt = (x: number, y: number) => {
    const cols = [...(gridRef.current?.querySelectorAll<HTMLElement>('.tg-col') ?? [])]
    let col = cols.find((c) => {
      const r = c.getBoundingClientRect()
      return x >= r.left && x < r.right
    })
    if (!col) col = x < (cols[0]?.getBoundingClientRect().left ?? 0) ? cols[0] : cols[cols.length - 1]
    const r = col.getBoundingClientRect()
    const min = Math.max(0, Math.min(DAY_MIN, (y - r.top) / PX_PER_MIN))
    return { date: col.dataset.date as ISODate, min }
  }

  const onDown = (ev: React.PointerEvent) => {
    if (ev.button !== 0) return
    const target = ev.target as HTMLElement
    const evEl = target.closest<HTMLElement>('[data-evid]')
    const p = pointAt(ev.clientX, ev.clientY)
    if (evEl) {
      const e = events.find((x) => x.id === evEl.dataset.evid)
      if (!e) return
      const mode: Mode = target.closest('.tg-resize') ? 'resize' : 'move'
      drag.current = { mode, e, el: evEl, x: ev.clientX, y: ev.clientY, moved: false, anchor: p.min - toMin(e.start_time), date: e.date }
      // Read-only markers only open; real events can be dragged (also on touch screens).
      if (!e.overlay) gridRef.current?.setPointerCapture(ev.pointerId)
      return
    }
    if (!target.closest('.tg-col')) return
    drag.current = { mode: 'create', x: ev.clientX, y: ev.clientY, moved: false, anchor: Math.floor(p.min / SNAP) * SNAP, date: p.date }
    // Mouse: drag to draw. Touch: let the page scroll; a tap still creates an event.
    if (ev.pointerType === 'mouse') gridRef.current?.setPointerCapture(ev.pointerId)
  }

  const onMove = (ev: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    if (!d.moved && Math.hypot(ev.clientX - d.x, ev.clientY - d.y) < 5) return
    if (d.e?.overlay) return
    d.moved = true
    const p = pointAt(ev.clientX, ev.clientY)
    if (d.mode === 'create') {
      const cur = snap(p.min)
      const start = Math.min(d.anchor, cur)
      const end = Math.max(d.anchor + SNAP, cur)
      setPreview({ date: d.date, start, end })
    } else if (d.mode === 'move' && d.e) {
      const len = Math.max(SNAP, toMin(d.e.end_time) - toMin(d.e.start_time))
      const start = Math.max(0, Math.min(DAY_MIN - len, snap(p.min - d.anchor)))
      setPreview({ id: d.e.id, date: p.date, start, end: start + len })
    } else if (d.mode === 'resize' && d.e) {
      const start = toMin(d.e.start_time)
      setPreview({ id: d.e.id, date: d.e.date, start, end: Math.max(start + SNAP, Math.min(DAY_MIN, snap(p.min))) })
    }
  }

  const onUp = (ev: React.PointerEvent) => {
    const d = drag.current
    const pv = preview
    drag.current = null
    setPreview(null)
    if (!d) return
    if (!d.moved) {
      if (d.e && d.el) return h.onOpen(d.e, d.el.getBoundingClientRect())
      const p = pointAt(ev.clientX, ev.clientY)
      const start = Math.floor(p.min / 30) * 30
      return h.onCreate(p.date, start, Math.min(DAY_MIN - 1, start + 60))
    }
    if (!pv) return
    if (d.mode === 'create') h.onCreate(pv.date, pv.start, pv.end)
    else if (d.mode === 'move' && d.e && (pv.date !== d.e.date || pv.start !== toMin(d.e.start_time))) h.onMove(d.e, pv.date, pv.start)
    else if (d.mode === 'resize' && d.e && pv.end !== toMin(d.e.end_time)) h.onResize(d.e, pv.end)
  }

  const cancel = () => {
    drag.current = null
    setPreview(null)
  }

  const allDay = (d: ISODate) => events.filter((e) => e.date === d && !e.start_time)

  return (
    <div className={`time-grid glass ${days.length === 1 ? 'single' : ''}`}>
      <div className="tg-head" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
        <span />
        {days.map((d) => (
          <button key={d} className={`tg-day ${d === now ? 'today' : ''}`} onClick={() => h.onPickDay(d)}>
            <span className="tg-dow">{fmt(d, { weekday: 'short' })}</span>
            <span className="tg-num">{Number(d.slice(8))}</span>
          </button>
        ))}
      </div>
      <div className="tg-allday" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
        <span className="tg-gutter-label">{t('cal.allDay')}</span>
        {days.map((d) => (
          <div
            key={d}
            className="tg-allday-cell"
            onClick={(ev) => {
              if (ev.target === ev.currentTarget) h.onCreate(d)
            }}
          >
            {allDay(d).map((e) => {
              const c = colorOf(e)
              return (
                <button
                  key={e.id}
                  className={`chip-event allday ${e.done ? 'done' : ''}`}
                  style={{ '--ev-bg': c.bg, '--ev-fg': c.fg } as React.CSSProperties}
                  onClick={(ev) => h.onOpen(e, ev.currentTarget.getBoundingClientRect())}
                >
                  <span className="chip-title">{e.title}</span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <div className="tg-scroll" ref={scrollRef}>
        <div
          className="tg-body"
          ref={gridRef}
          style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)`, height: 24 * HOUR }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={cancel}
        >
          <div className="tg-gutter">
            {Array.from({ length: 24 }, (_, hr) => (
              <span key={hr} style={{ top: hr * HOUR }}>
                {hr === 0 ? '' : time(fromMin(hr * 60))}
              </span>
            ))}
          </div>
          {days.map((d) => (
            <div key={d} className={`tg-col ${d === now ? 'today' : ''}`} data-date={d} style={{ backgroundSize: `100% ${HOUR}px` }}>
              {layoutDay(events.filter((e) => e.date === d)).map(({ event: e, col, cols }) => {
                const c = colorOf(e)
                const start = toMin(e.start_time)
                const end = Math.max(start + SNAP, toMin(e.end_time))
                const short = end - start < 45
                return (
                  <div
                    key={e.id}
                    data-evid={e.id}
                    className={`tg-event ${short ? 'short' : ''} ${e.done ? 'done' : ''} ${e.overlay ? 'readonly' : ''} ${preview?.id === e.id ? 'ghost' : ''}`}
                    style={
                      {
                        top: start * PX_PER_MIN,
                        height: (end - start) * PX_PER_MIN - 2,
                        left: `calc(${(col / cols) * 100}% + 2px)`,
                        width: `calc(${100 / cols}% - 4px)`,
                        '--ev-bg': c.bg,
                        '--ev-fg': c.fg,
                      } as React.CSSProperties
                    }
                  >
                    <span className="tg-ev-title">{e.done ? '✓ ' : ''}{e.title}</span>
                    <span className="tg-ev-time">
                      {time(e.start_time)} – {time(e.end_time)}
                    </span>
                    {!e.overlay && <span className="tg-resize" aria-hidden="true" />}
                  </div>
                )
              })}
              {preview && preview.date === d && (
                <div
                  className="tg-event preview"
                  style={
                    (() => {
                      const e = preview.id ? events.find((x) => x.id === preview.id) : undefined
                      const c = e ? colorOf(e) : { bg: '#ddd0ff', fg: '#5b3fc4' }
                      return {
                        top: preview.start * PX_PER_MIN,
                        height: (preview.end - preview.start) * PX_PER_MIN - 2,
                        left: 2,
                        right: 2,
                        '--ev-bg': c.bg,
                        '--ev-fg': c.fg,
                      } as React.CSSProperties
                    })()
                  }
                >
                  <span className="tg-ev-title">{preview.id ? events.find((x) => x.id === preview.id)?.title : t('cal.newEvent')}</span>
                  <span className="tg-ev-time">
                    {time(fromMin(preview.start))} – {time(fromMin(preview.end))}
                  </span>
                </div>
              )}
              {d === now && (
                <div className="now-line" style={{ top: nowMin * PX_PER_MIN }}>
                  <span />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
