import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useData } from '../../data/DataContext'
import { useI18n } from '../../i18n'
import { durationHours } from '../../lib/calendar'
import { useGo } from '../../nav'
import { colorOf, type DisplayEvent } from './types'

export type DeleteScope = 'one' | 'following' | 'series'

/** What this event logs automatically (Hours or Supervision), or what it still needs. */
export function logTarget(e: Pick<DisplayEvent, 'kind' | 'company_id' | 'supervisee_id'>): { what: 'clinical' | 'admin' | 'supervision' | null; missing?: 'company' | 'supervisee' } {
  if (e.kind === 'supervision') return e.supervisee_id ? { what: 'supervision' } : { what: null, missing: 'supervisee' }
  const what = e.kind === 'session' || e.kind === 'assessment' ? 'clinical' : e.kind === 'meeting' || e.kind === 'admin' ? 'admin' : null
  if (!what) return { what: null }
  return e.company_id ? { what } : { what: null, missing: 'company' }
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
  const { t, fmt, time, num } = useI18n()
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
  const target = logTarget(e)
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
            {target.missing ? (
              <p className="pop-log warn">{t(target.missing === 'company' ? 'cal.needCompany' : 'cal.needSupervisee')}</p>
            ) : target.what && logged ? (
              <p className="pop-log ok">
                {t('cal.loggedAuto', {
                  h: num(hours),
                  what: t(target.what === 'clinical' ? 'cal.logClinical' : target.what === 'admin' ? 'cal.logAdmin' : 'cal.logSupervision'),
                })}
              </p>
            ) : target.what && !hours ? (
              <p className="pop-log warn">{t('cal.needTime')}</p>
            ) : null}
            <button className={`btn block ${e.done ? '' : 'primary'}`} onClick={onToggleDone}>
              {e.done ? `↺ ${t('cal.undoDone')}` : `✓ ${t('cal.markDoneSimple')}`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
