import { useMemo } from 'react'
import { computeWarnings } from '../lib/warnings'
import { useData } from './DataContext'

export function useWarnings() {
  const { profile, companies, clients, hour_entries, payments, clientName, companyName } = useData()
  return useMemo(
    () => computeWarnings({ profile, companies, clients, hours: hour_entries, payments, clientName, companyName }),
    [profile, companies, clients, hour_entries, payments, clientName, companyName],
  )
}
