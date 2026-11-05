import { useCallback, useEffect, useRef } from 'react'
import type { EventDraft } from '../components/calendar/EventForm'
import { durationHours } from '../lib/calendar'
import { logPlan } from '../lib/eventLog'
import { useData } from './DataContext'
import type { CalendarEvent } from './types'

/**
 * Saves a calendar event and keeps its hours in step, like Office Puzzle: every timed work event
 * (session, assessment, parent training, meeting, admin, supervision) becomes an entry in Hours,
 * and a supervision also becomes a supervision meeting. Moving, resizing or editing the event
 * updates them; changing it to a type that isn't logged removes them.
 */
export function usePersistEvent() {
  const { clients, companies, supervisees, hour_entries, supervision_sessions, save, remove } = useData()

  return useCallback(
    async (e: EventDraft): Promise<CalendarEvent> => {
      const plan = logPlan(e, { clients, companies, supervisees })
      const hours = durationHours(e)
      let hour_entry_id = e.hour_entry_id
      let supervision_session_id = e.supervision_session_id

      if (plan.hourKind && hours > 0 && plan.companyId) {
        const existing = hour_entries.find((x) => x.id === hour_entry_id)
        const he = await save('hour_entries', {
          id: existing?.id,
          date: e.date,
          company_id: plan.companyId,
          client_id: e.client_id,
          kind: plan.hourKind,
          hours,
          note: e.title,
        })
        hour_entry_id = he.id
      } else if (hour_entry_id) {
        if (hour_entries.some((x) => x.id === hour_entry_id)) await remove('hour_entries', hour_entry_id)
        hour_entry_id = null
      }

      if (plan.supervision && hours > 0 && e.supervisee_id) {
        const existing = supervision_sessions.find((x) => x.id === supervision_session_id)
        const s = await save('supervision_sessions', {
          id: existing?.id,
          supervisee_id: e.supervisee_id,
          date: e.date,
          hours,
          // Keep "group" if it was changed by hand in Supervision.
          format: existing?.format ?? 'individual',
          with_client: !!e.client_id,
          note: e.title,
        })
        supervision_session_id = s.id
      } else if (supervision_session_id) {
        if (supervision_sessions.some((x) => x.id === supervision_session_id)) await remove('supervision_sessions', supervision_session_id)
        supervision_session_id = null
      }

      // Remember the company that was used, so the event shows it too.
      return save('events', { ...e, company_id: e.company_id ?? plan.companyId, hour_entry_id, supervision_session_id })
    },
    [clients, companies, supervisees, hour_entries, supervision_sessions, save, remove],
  )
}

/**
 * Logs the hours of any event that doesn't have them yet: events saved by an older version, or
 * whose company / supervisee was added later. Runs app-wide (not only on the Calendar tab), so
 * Hours, Earnings and the dashboard are always complete.
 */
export function useEventBackfill() {
  const { events, clients, companies, supervisees } = useData()
  const persist = usePersistEvent()
  // Events already being logged, so a slow save is never started twice.
  const inFlight = useRef(new Set<string>())

  useEffect(() => {
    for (const e of events) {
      if (inFlight.current.has(e.id) || !durationHours(e)) continue
      const plan = logPlan(e, { clients, companies, supervisees })
      const needsHours = plan.hourKind && plan.companyId && !e.hour_entry_id
      const needsSupervision = plan.supervision && e.supervisee_id && !e.supervision_session_id
      if (!needsHours && !needsSupervision) continue
      inFlight.current.add(e.id)
      void persist(e).catch(() => {
        // Leave it in inFlight: retrying in a loop would hammer the database. It is retried on
        // the next app load.
      })
    }
  }, [events, clients, companies, supervisees, persist])
}
