import { useData } from '../../data/DataContext'
import type { ISODate } from '../../data/types'
import { useI18n } from '../../i18n'
import { sortEvents } from '../../lib/calendar'
import { addDays, today } from '../../lib/dates'
import { colorOf, type CalHandlers, type DisplayEvent } from './types'

/** List of the next `days` days that have events, grouped by day (handy on phones). */
export function AgendaView({ from, days, events, h }: { from: ISODate; days: number; events: DisplayEvent[]; h: CalHandlers }) {
  const { t, fmt, time } = useI18n()
  const { clientName } = useClientName()
  const until = addDays(from, days - 1)
  const list = events.filter((e) => e.date >= from && e.date <= until).sort(sortEvents)
  const groups = new Map<ISODate, DisplayEvent[]>()
  for (const e of list) groups.set(e.date, [...(groups.get(e.date) ?? []), e])
  const now = today()

  if (groups.size === 0) return <div className="empty muted">{t('cal.noEvents')}</div>

  return (
    <div className="agenda glass">
      {[...groups].map(([d, evs]) => (
        <div key={d} className={`agenda-day ${d === now ? 'today' : ''}`}>
          <button className="agenda-date" onClick={() => h.onPickDay(d)}>
            <span className="agenda-num">{Number(d.slice(8))}</span>
            <span className="agenda-dow">{fmt(d, { weekday: 'short', month: 'short' })}</span>
          </button>
          <div className="agenda-list">
            {evs.map((e) => {
              const c = colorOf(e)
              return (
                <button
                  key={e.id}
                  className={`agenda-item ${e.done ? 'done' : ''}`}
                  style={{ '--ev-bg': c.bg, '--ev-fg': c.fg } as React.CSSProperties}
                  onClick={(ev) => h.onOpen(e, ev.currentTarget.getBoundingClientRect())}
                >
                  <span className="agenda-dot" />
                  <span className="agenda-time">{e.start_time ? `${time(e.start_time)} – ${time(e.end_time)}` : t('cal.allDay')}</span>
                  <span className="agenda-title">
                    {e.done ? '✓ ' : ''}
                    {e.title}
                    {e.client_id && !e.overlay && <span className="muted"> · {clientName(e.client_id)}</span>}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function useClientName() {
  const { clients, clientName } = useData()
  return { clientName: (id: string) => clientName(clients.find((c) => c.id === id)) }
}
