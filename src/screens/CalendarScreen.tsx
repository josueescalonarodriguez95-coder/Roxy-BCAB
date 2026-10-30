import { useCallback, useEffect, useMemo, useState } from 'react'
import { AgendaView } from '../components/calendar/AgendaView'
import { doneTarget, EventDetails, type DeleteScope } from '../components/calendar/EventDetails'
import { EventForm, type EventDraft } from '../components/calendar/EventForm'
import { MiniMonth } from '../components/calendar/MiniMonth'
import { MonthView } from '../components/calendar/MonthView'
import { TimeGrid } from '../components/calendar/TimeGrid'
import type { CalHandlers, DisplayEvent } from '../components/calendar/types'
import { Segmented } from '../components/ui'
import { useData } from '../data/DataContext'
import { EVENT_KINDS, type CalendarEvent, type EventKind, type ISODate } from '../data/types'
import { useI18n } from '../i18n'
import { durationHours, fromMin, KIND_COLORS, shiftDate, toMin, weekDays, type CalView } from '../lib/calendar'
import { addDays, today } from '../lib/dates'

type Overlay = 'supervision' | 'auth' | 'pay'
const OVERLAYS: Overlay[] = ['supervision', 'auth', 'pay']
const OVERLAY_COLORS: Record<Overlay, { bg: string; fg: string }> = {
  supervision: KIND_COLORS.supervision,
  auth: { bg: '#ffd6db', fg: '#a82235' },
  pay: { bg: '#d9f5c8', fg: '#3d7a1f' },
}
const AGENDA_DAYS = 30
const PREFS_KEY = 'abadesk:calendar'

interface Prefs {
  view: CalView
  hiddenKinds: EventKind[]
  overlays: Overlay[]
}

function loadPrefs(): Prefs {
  const fallback: Prefs = { view: window.innerWidth < 700 ? 'agenda' : 'week', hiddenKinds: [], overlays: ['auth', 'pay'] }
  try {
    return { ...fallback, ...(JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<Prefs>) }
  } catch {
    return fallback
  }
}

/** Ids for a repeating series must be real UUIDs (the database column is uuid). */
function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

const BLANK: Omit<CalendarEvent, 'id' | 'date' | 'start_time' | 'end_time'> = {
  title: '',
  kind: 'session',
  client_id: null,
  company_id: null,
  supervisee_id: null,
  location: '',
  notes: '',
  series_id: null,
  done: false,
  hour_entry_id: null,
  supervision_session_id: null,
}

export function CalendarScreen() {
  const { t, fmt } = useI18n()
  const data = useData()
  const { events, clients, payments, supervisees, supervision_sessions, hour_entries, save, remove, clientName, companyName } = data
  const [prefs, setPrefs] = useState(loadPrefs)
  const [date, setDate] = useState(today)
  const [open, setOpen] = useState<{ id: string; anchor: DOMRect } | null>(null)
  const [draft, setDraft] = useState<EventDraft | null>(null)
  const view = prefs.view

  const updatePrefs = (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next))
    } catch {
      // ignore
    }
  }

  // Everything the calendar draws: the user's events plus read-only markers from other tabs.
  const display = useMemo<DisplayEvent[]>(() => {
    const base = { ...BLANK, start_time: null, end_time: null }
    const out: DisplayEvent[] = events.filter((e) => !prefs.hiddenKinds.includes(e.kind))
    if (prefs.overlays.includes('supervision')) {
      const linked = new Set(events.map((e) => e.supervision_session_id).filter(Boolean))
      for (const s of supervision_sessions) {
        if (linked.has(s.id)) continue
        const who = supervisees.find((x) => x.id === s.supervisee_id)?.name ?? ''
        out.push({ ...base, id: `ov-s-${s.id}`, date: s.date, kind: 'supervision', title: `${t('cal.supMeeting', { name: who })} · ${s.hours} h`, overlay: 'supervision', color: OVERLAY_COLORS.supervision })
      }
    }
    if (prefs.overlays.includes('auth')) {
      for (const c of clients.filter((x) => x.active && x.auth_end)) {
        out.push({ ...base, id: `ov-a-${c.id}`, date: c.auth_end!, kind: 'other', title: t('cal.authEnds', { name: clientName(c) }), overlay: 'clients', color: OVERLAY_COLORS.auth })
      }
    }
    if (prefs.overlays.includes('pay')) {
      for (const p of payments) {
        out.push({ ...base, id: `ov-p-${p.id}`, date: p.pay_date, kind: 'other', title: t('cal.payday', { company: companyName(p.company_id) }), overlay: 'earnings', color: OVERLAY_COLORS.pay })
      }
    }
    return out
  }, [events, prefs, supervision_sessions, supervisees, clients, payments, t, clientName, companyName])

  const busy = useMemo(() => new Set(display.map((e) => e.date)), [display])
  const openEvent = open ? display.find((e) => e.id === open.id) : undefined

  const newDraft = useCallback(
    (d: ISODate, start?: number, end?: number): EventDraft => ({
      ...BLANK,
      date: d,
      start_time: start === undefined ? null : fromMin(start),
      end_time: start === undefined ? null : fromMin(end ?? start + 60),
    }),
    [],
  )

  const h: CalHandlers = {
    onOpen: (e, anchor) => setOpen({ id: e.id, anchor }),
    onCreate: (d, start, end) => setDraft(newDraft(d, start, end)),
    onMove: (e, d, start) => {
      if (e.overlay) return
      const patch: Partial<CalendarEvent> = { date: d }
      if (start !== undefined && e.start_time) {
        const len = toMin(e.end_time) - toMin(e.start_time)
        patch.start_time = fromMin(start)
        patch.end_time = fromMin(start + len)
      }
      void save('events', { ...e, ...patch })
    },
    onResize: (e, end) => {
      if (!e.overlay) void save('events', { ...e, end_time: fromMin(end) })
    },
    onPickDay: (d) => {
      setDate(d)
      updatePrefs({ view: 'day' })
    },
  }

  const toggleDone = async (e: CalendarEvent) => {
    if (e.done) {
      // Undo: take back whatever was logged when it was marked done.
      if (e.hour_entry_id && hour_entries.some((x) => x.id === e.hour_entry_id)) await remove('hour_entries', e.hour_entry_id)
      if (e.supervision_session_id && supervision_sessions.some((x) => x.id === e.supervision_session_id))
        await remove('supervision_sessions', e.supervision_session_id)
      await save('events', { ...e, done: false, hour_entry_id: null, supervision_session_id: null })
      return
    }
    const target = doneTarget(e).what
    const hours = durationHours(e)
    if (target === 'supervision' && e.supervisee_id) {
      const s = await save('supervision_sessions', {
        supervisee_id: e.supervisee_id,
        date: e.date,
        hours: hours || 1,
        format: 'individual',
        with_client: !!e.client_id,
        note: e.title,
      })
      await save('events', { ...e, done: true, supervision_session_id: s.id })
    } else if ((target === 'clinical' || target === 'admin') && e.company_id && hours > 0) {
      const he = await save('hour_entries', { date: e.date, company_id: e.company_id, client_id: e.client_id, kind: target, hours, note: e.title })
      await save('events', { ...e, done: true, hour_entry_id: he.id })
    } else {
      await save('events', { ...e, done: true })
    }
  }

  const deleteEvent = async (e: CalendarEvent, scope: DeleteScope) => {
    const targets =
      scope === 'one' || !e.series_id
        ? [e]
        : events.filter((x) => x.series_id === e.series_id && (scope === 'series' || x.date >= e.date))
    setOpen(null)
    await Promise.all(targets.map((x) => remove('events', x.id)))
  }

  const saveDraft = async (d: EventDraft, dates: string[]) => {
    if (d.id) {
      await save('events', d)
    } else if (dates.length > 1) {
      const series_id = uuid()
      await Promise.all(dates.map((date) => save('events', { ...d, date, series_id })))
    } else {
      await save('events', d)
    }
    setDraft(null)
  }

  // Keyboard shortcuts, like Google Calendar.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (draft || open || ev.metaKey || ev.ctrlKey || ev.altKey) return
      const tag = (ev.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const k = ev.key.toLowerCase()
      if (k === 't') setDate(today())
      else if (k === 'm') updatePrefs({ view: 'month' })
      else if (k === 'w' || k === 's') updatePrefs({ view: 'week' })
      else if (k === 'd') updatePrefs({ view: 'day' })
      else if (k === 'a') updatePrefs({ view: 'agenda' })
      else if (ev.key === 'ArrowLeft') setDate((x) => shiftDate(x, view, -1))
      else if (ev.key === 'ArrowRight') setDate((x) => shiftDate(x, view, 1))
      else if (k === 'n' || k === 'c') setDraft(newDraft(date, 9 * 60, 10 * 60))
      else return
      ev.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const week = weekDays(date)
  const title =
    view === 'month'
      ? fmt(date, { month: 'long', year: 'numeric' })
      : view === 'day'
        ? fmt(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
        : view === 'week'
          ? `${fmt(week[0], { month: 'short', day: 'numeric' })} – ${fmt(week[6], { month: 'short', day: 'numeric', year: 'numeric' })}`
          : `${fmt(date, { month: 'short', day: 'numeric' })} – ${fmt(addDays(date, AGENDA_DAYS - 1), { month: 'short', day: 'numeric', year: 'numeric' })}`

  const toggleKind = (k: EventKind) =>
    updatePrefs({ hiddenKinds: prefs.hiddenKinds.includes(k) ? prefs.hiddenKinds.filter((x) => x !== k) : [...prefs.hiddenKinds, k] })
  const toggleOverlay = (o: Overlay) =>
    updatePrefs({ overlays: prefs.overlays.includes(o) ? prefs.overlays.filter((x) => x !== o) : [...prefs.overlays, o] })

  return (
    <div className="calendar">
      <aside className="cal-side">
        <button className="btn primary create-btn" onClick={() => setDraft(newDraft(date, 9 * 60, 10 * 60))}>
          <span className="plus">＋</span> {t('cal.create')}
        </button>
        <div className="card cal-panel">
          <MiniMonth value={date} busy={busy} onPick={setDate} />
        </div>
        <div className="card cal-panel">
          <h3 className="cal-panel-title">{t('cal.myCalendars')}</h3>
          {EVENT_KINDS.filter((k) => k !== 'supervision' || data.profile.credential !== 'RBT').map((k) => (
            <label key={k} className="cal-filter" style={{ '--ev-bg': KIND_COLORS[k].bg, '--ev-fg': KIND_COLORS[k].fg } as React.CSSProperties}>
              <input type="checkbox" checked={!prefs.hiddenKinds.includes(k)} onChange={() => toggleKind(k)} />
              <span className="cal-box" />
              {t(`cal.kind.${k}`)}
            </label>
          ))}
          <h3 className="cal-panel-title">{t('cal.alsoShow')}</h3>
          {OVERLAYS.filter((o) => o !== 'supervision' || data.profile.credential !== 'RBT').map((o) => (
            <label key={o} className="cal-filter" style={{ '--ev-bg': OVERLAY_COLORS[o].bg, '--ev-fg': OVERLAY_COLORS[o].fg } as React.CSSProperties}>
              <input type="checkbox" checked={prefs.overlays.includes(o)} onChange={() => toggleOverlay(o)} />
              <span className="cal-box" />
              {t(`cal.overlay.${o}`)}
            </label>
          ))}
        </div>
        <p className="muted small cal-shortcuts">{t('cal.shortcuts')}</p>
      </aside>

      <section className="cal-main">
        <div className="cal-toolbar">
          <button className="btn" onClick={() => setDate(today())}>
            {t('cal.today')}
          </button>
          <div className="range-nav">
            <button className="btn icon" aria-label={t('range.prev')} onClick={() => setDate(shiftDate(date, view, -1))}>
              ‹
            </button>
            <button className="btn icon" aria-label={t('range.next')} onClick={() => setDate(shiftDate(date, view, 1))}>
              ›
            </button>
          </div>
          <h2 className="cal-title">{title}</h2>
          <span className="spacer" />
          <Segmented<CalView>
            options={(['month', 'week', 'day', 'agenda'] as CalView[]).map((v) => ({ value: v, label: t(`cal.view.${v}`) }))}
            value={view}
            onChange={(v) => updatePrefs({ view: v })}
          />
        </div>

        <div className="cal-view" key={`${view}-${view === 'month' ? date.slice(0, 7) : view === 'day' ? date : week[0]}`}>
          {view === 'month' && <MonthView date={date} events={display} h={h} />}
          {view === 'week' && <TimeGrid days={week} events={display} h={h} />}
          {view === 'day' && <TimeGrid days={[date]} events={display} h={h} />}
          {view === 'agenda' && <AgendaView from={date} days={AGENDA_DAYS} events={display} h={h} />}
        </div>
      </section>

      {open && openEvent && (
        <EventDetails
          event={openEvent}
          anchor={open.anchor}
          onClose={() => setOpen(null)}
          onEdit={() => {
            setDraft(openEvent)
            setOpen(null)
          }}
          onDuplicate={() => {
            const { id: _id, ...copy } = openEvent
            void _id
            setDraft({ ...copy, series_id: null, done: false, hour_entry_id: null, supervision_session_id: null })
            setOpen(null)
          }}
          onDelete={(scope) => void deleteEvent(openEvent, scope)}
          onToggleDone={() => void toggleDone(openEvent)}
        />
      )}
      {draft && <EventForm draft={draft} onClose={() => setDraft(null)} onSave={saveDraft} />}
    </div>
  )
}
