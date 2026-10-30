/** Dates are stored as 'YYYY-MM-DD' strings (no time zone surprises). */
export type ISODate = string

export type Credential = 'BCBA' | 'BCaBA' | 'RBT'
export type Lang = 'en' | 'es'
export type PaySchedule = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly'
export type HourKind = 'clinical' | 'admin'

export interface Profile {
  id: string
  display_name: string
  credential: Credential
  certification_date: ISODate | null
  language: Lang
  show_full_names: boolean
  /** Percent (0–100) to set aside for taxes. 0 hides the tax estimate. */
  tax_rate: number
}

export interface Company {
  id: string
  name: string
  clinical_rate: number
  admin_rate: number
  pay_schedule: PaySchedule
  color: string
  active: boolean
  notes: string
}

export interface Client {
  id: string
  first_name: string
  last_name: string
  company_id: string | null
  auth_start: ISODate | null
  auth_end: ISODate | null
  active: boolean
  notes: string
}

export interface HourEntry {
  id: string
  date: ISODate
  company_id: string
  client_id: string | null
  kind: HourKind
  hours: number
  note: string
}

export interface Payment {
  id: string
  company_id: string
  period_start: ISODate
  period_end: ISODate
  pay_date: ISODate
  expected: number
  received: number
  received_date: ISODate | null
  note: string
}

export interface Todo {
  id: string
  text: string
  done: boolean
  done_at: string | null
  created_at: string
}

export type SuperviseeKind = 'rbt' | 'fieldwork'
export type FieldworkType = 'supervised' | 'concentrated'
export type SessionFormat = 'individual' | 'group'

export interface Supervisee {
  id: string
  name: string
  kind: SuperviseeKind
  /** Only used when kind = 'fieldwork'. */
  fieldwork_type: FieldworkType
  company_id: string | null
  client_ids: string[]
  /** What the user earns per hour of supervision (0 if it's part of the company job). */
  rate: number
  start_date: ISODate | null
  contract_date: ISODate | null
  color: string
  active: boolean
  notes: string
}

export interface SupervisionSession {
  id: string
  supervisee_id: string
  date: ISODate
  hours: number
  format: SessionFormat
  /** The supervisor observed the supervisee working with a client. */
  with_client: boolean
  note: string
}

export interface SuperviseeMonth {
  id: string
  supervisee_id: string
  /** 'YYYY-MM' */
  month: string
  hours: number
}

export type EventKind = 'session' | 'supervision' | 'assessment' | 'meeting' | 'admin' | 'personal' | 'other'
export const EVENT_KINDS: EventKind[] = ['session', 'supervision', 'assessment', 'meeting', 'admin', 'personal', 'other']

export interface CalendarEvent {
  id: string
  title: string
  date: ISODate
  /** 'HH:MM' local time; null for all-day events. */
  start_time: string | null
  end_time: string | null
  kind: EventKind
  client_id: string | null
  company_id: string | null
  supervisee_id: string | null
  location: string
  notes: string
  /** Shared by every occurrence of a repeating event. */
  series_id: string | null
  done: boolean
  /** Hours / supervision logged from this event when it was marked done. */
  hour_entry_id: string | null
  supervision_session_id: string | null
}

/** Tables that hold a list of rows owned by the user (profiles is handled separately). */
export interface Tables {
  companies: Company
  clients: Client
  hour_entries: HourEntry
  payments: Payment
  todos: Todo
  supervisees: Supervisee
  supervision_sessions: SupervisionSession
  supervisee_months: SuperviseeMonth
  events: CalendarEvent
}
export type TableName = keyof Tables
export const TABLES: TableName[] = [
  'companies',
  'clients',
  'hour_entries',
  'payments',
  'todos',
  'supervisees',
  'supervision_sessions',
  'supervisee_months',
  'events',
]
