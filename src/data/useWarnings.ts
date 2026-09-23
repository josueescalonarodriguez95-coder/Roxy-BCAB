import { useMemo } from 'react'
import { computeWarnings } from '../lib/warnings'
import { useData } from './DataContext'

export function useWarnings() {
  const { profile, companies, clients, hour_entries, payments, supervisees, supervision_sessions, supervisee_months, clientName, companyName } =
    useData()
  return useMemo(
    () => computeWarnings({
        profile,
        companies,
        clients,
        hours: hour_entries,
        payments,
        supervisees,
        sessions: supervision_sessions,
        months: supervisee_months,
        clientName,
        companyName,
      }),
    [profile, companies, clients, hour_entries, payments, supervisees, supervision_sessions, supervisee_months, clientName, companyName],
  )
}
