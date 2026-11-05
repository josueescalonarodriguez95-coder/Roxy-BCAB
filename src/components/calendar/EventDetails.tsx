import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useData } from '../../data/DataContext'
import { useI18n } from '../../i18n'
import { durationHours } from '../../lib/calendar'
import { logPlan } from '../../lib/eventLog'
import type { CalendarEvent } from '../../data/types'
import { useGo } from '../../nav'
import { colorOf, type DisplayEvent } from './types'

export type DeleteScope = 'one' | 'following' | 'series'

/**
 * Line under an event (in its card and in the form) saying whether its hours go to Hours /
 * Supervision automatically, or what is still missing for that.
 */
export function LogNotice({ e, hours, logged }: { e: Pick<CalendarEvent, 'kind' | 'company_id' | 'client_id' | 'supervisee_id'>; hours: number; logged: boolean }) {
  const { t, num } = useI18n()
  const { clients, companies, supervisees } = useData()
  const plan = logPlan(e, { clients, companies, supervisees })
  if (!plan.hourKind) return null
  if (plan.missing.length)
    return (
      <p className="pop-log warn">
        {plan.missing.map((m) => t(m === 'company' ? 'cal.needCompany' : 'cal.needSupervisee')).join(' ')}
      </p>
    )
  if (!hours) return <p className="pop-log warn">{t('cal.needTime')}</p>
  const what = t(`cal.kind.${e.kind}`).toLowerCase()
  return (
    <p className="pop-log ok">
      {t(logged ? 'cal.loggedAuto' : 'cal.autoHint', { h: num(hours), what })}
      {plan.supervision && t('cal.alsoSupervision')}
    </p>
  )
}

/** Card that pops up next to an event with its details and actions (bottom sheet on phones). */
export function EventDetails({
  event: e,
  anchor,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleDone,
}: {
  event: DisplayEvent
  anchor: DOMRect
  onClose: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: (scope: DeleteScope) => void
  onToggleDone: () => void
}) {
  const { t, fmt, time } = useI18n()
  const { clients, companies, supervisees, clientName } = useData()
  const go = useGo()
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const [askDelete, setAskDelete] = useState(false)
  const c = colorOf(e)

  // Place the card beside the event, keeping it inside the window.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || window.innerWidth < 640) return
    const w = el.offsetWidth
    const hgt = el.offsetHeight
    let left = anchor.right + 10
    if (left + w > window.innerWidth - 12) left = anchor.left - w - 10
    if (left < 12) left = Math.max(12, Math.min(window.innerWidth - w - 12, anchor.left))
    const top = Math.max(12, Math.min(window.innerHeight - hgt - 12, anchor.top))
    setPos({ left, top })
  }, [anchor, askDelete])

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const client = clients.find((x) => x.id === e.client_id)
  const hours = durationHours(e)
  const logged = !!(e.hour_entry_id || e.supervision_session_id)
  const kindLabel = t(`cal.kind.${e.kind}`)

  return (
    <div className="pop-backdrop" onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}>
      <div
        ref={ref}
        className={`event-pop ${pos ? 'placed' : ''}`}
        style={pos ? { left: pos.left, top: pos.top } : undefined}
        role="dialog"
        aria-label={e.title}
      >
        <div className="pop-bar" style={{ background: c.bg }} />
        <div className="pop-actions">
          {!e.overlay && (
            <>
              <button className="btn icon subtle" title={t('common.edit')} aria-label={t('common.edit')} onClick={onEdit}>
                ✎
              </button>
              <button className="btn icon subtle" title={t('cal.duplicate')} aria-label={t('cal.duplicate')} onClick={onDuplicate}>
                ⧉
              </button>
              <button className="btn icon subtle" title={t('common.delete')} aria-label={t('common.delete')} onClick={() => (e.series_id ? setAskDelete(true) : onDelete('one'))}>
                🗑
              </button>
            </>
          )}
          <button className="btn icon subtle" aria-label={t('common.cancel')} onClick={onClose}>
            ×
          </button>
        </div>
        <div className="pop-head">
          <span className="pop-swatch" style={{ background: c.fg }} />
          <div>
            <h3 className={e.done ? 'done' : ''}>{e.title}</h3>
            <p className="muted">
              {fmt(e.date, { weekday: 'long', month: 'long', day: 'numeric' })}
              {e.start_time && ` · ${time(e.start_time)} – ${time(e.end_time)}`}
            </p>
          </div>
        </div>
        <ul className="pop-info">
          <li>
            <span className="badge" style={{ background: c.bg, color: c.fg }}>
              {kindLabel}
            </span>
            {e.done && <span className="badge badge-ok">{t('cal.done')}</span>}
            {e.series_id && <span className="badge badge-muted">↻ {t('cal.repeating')}</span>}
          </li>
          {client && <li>👤 {clientName(client)}</li>}
          {e.company_id && <li>🏢 {companies.find((x) => x.id === e.company_id)?.name}</li>}
          {e.supervisee_id && <li>🛡 {supervisees.find((x) => x.id === e.supervisee_id)?.name}</li>}
          {e.location && <li>📍 {e.location}</li>}
          {e.notes && <li className="pop-notes">📝 {e.notes}</li>}
        </ul>

        {e.overlay ? (
          <button className="btn primary block" onClick={() => go(e.overlay!)}>
            {t('cal.openTab')}
          </button>
        ) : askDelete ? (
          <div className="pop-delete">
            <button className="btn danger block" onClick={() => onDelete('one')}>
              {t('cal.deleteOne')}
            </button>
            <button className="btn danger block" onClick={() => onDelete('following')}>
              {t('cal.deleteFollowing')}
            </button>
            <button className="btn danger block" onClick={() => onDelete('series')}>
              {t('cal.deleteSeries')}
            </button>
          </div>
        ) : (
          <>
            <LogNotice e={e} hours={hours} logged={logged} />
            <button className={`btn block ${e.done ? '' : 'primary'}`} onClick={onToggleDone}>
              {e.done ? `↺ ${t('cal.undoDone')}` : `✓ ${t('cal.markDoneSimple')}`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
