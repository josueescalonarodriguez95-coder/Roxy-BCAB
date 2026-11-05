import type { CalendarEvent, Client, Company, HourKind, Supervisee } from '../data/types'

/**
 * What a calendar event logs automatically.
 *
 * Every work event lands in Hours. Supervision also lands in the Supervision tab (for the BACB
 * 5% count); its Hours entry uses the "supervision" kind, which is paid through the supervisee's
 * rate, so it isn't counted twice in Earnings.
 */
export interface LogPlan {
  hourKind: HourKind | null
  /** Company the hours go to: the one picked, else the client's, the supervisee's, or the only one. */
  companyId: string | null
  supervision: boolean
  missing: ('company' | 'supervisee')[]
}

const HOUR_KIND: Partial<Record<CalendarEvent['kind'], HourKind>> = {
  session: 'clinical',
  assessment: 'clinical',
  parent_training: 'clinical',
  meeting: 'admin',
  admin: 'admin',
  supervision: 'supervision',
}

export function logPlan(
  e: Pick<CalendarEvent, 'kind' | 'company_id' | 'client_id' | 'supervisee_id'>,
  ctx: { clients: Client[]; companies: Company[]; supervisees: Supervisee[] },
): LogPlan {
  const hourKind = HOUR_KIND[e.kind] ?? null
  const supervision = e.kind === 'supervision'
  const active = ctx.companies.filter((c) => c.active)
  const companyId =
    e.company_id ??
    ctx.clients.find((c) => c.id === e.client_id)?.company_id ??
    ctx.supervisees.find((s) => s.id === e.supervisee_id)?.company_id ??
    (active.length === 1 ? active[0].id : null)
  const missing: LogPlan['missing'] = []
  if (hourKind && !companyId) missing.push('company')
  if (supervision && !e.supervisee_id) missing.push('supervisee')
  return { hourKind, companyId, supervision, missing }
}
