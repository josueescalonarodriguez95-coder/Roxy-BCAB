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

/** Tables that hold a list of rows owned by the user (profiles is handled separately). */
export interface Tables {
  companies: Company
  clients: Client
  hour_entries: HourEntry
  payments: Payment
  todos: Todo
}
export type TableName = keyof Tables
export const TABLES: TableName[] = ['companies', 'clients', 'hour_entries', 'payments', 'todos']
