import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Profile, TableName, Tables } from './types'

export interface User {
  id: string
  email: string
}

/**
 * Everything the app needs from a backend. Two implementations: Supabase (real accounts,
 * data in the cloud) and a local one (demo mode, data only in this browser) that kicks in when
 * the Supabase env vars are missing — handy for trying the app without setting anything up.
 */
export interface Store {
  readonly demo: boolean
  currentUser(): Promise<User | null>
  onAuthChange(cb: (user: User | null) => void): () => void
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }>
  signOut(): Promise<void>
  getProfile(user: User): Promise<Profile | null>
  saveProfile(profile: Profile): Promise<Profile>
  list<T extends TableName>(table: T): Promise<Tables[T][]>
  insert<T extends TableName>(table: T, row: Omit<Tables[T], 'id'>): Promise<Tables[T]>
  update<T extends TableName>(table: T, id: string, patch: Partial<Tables[T]>): Promise<Tables[T]>
  remove(table: TableName, id: string): Promise<void>
}

/** Same cleanup as the storage app: strips invisible characters pasted into Vercel env vars. */
function clean(v: string | undefined): string {
  return (v ?? '').replace(/[^\x20-\x7E]/g, '').trim()
}

/** Postgres `numeric` comes back as a string; the app wants numbers. */
const NUMERIC_FIELDS = ['clinical_rate', 'admin_rate', 'hours', 'expected', 'received', 'tax_rate', 'rate']
function normalize<R>(row: Record<string, unknown>): R {
  const out: Record<string, unknown> = { ...row }
  for (const f of NUMERIC_FIELDS) if (typeof out[f] === 'string') out[f] = Number(out[f])
  delete out.owner_id
  return out as R
}

class SupabaseStore implements Store {
  readonly demo = false
  private sb: SupabaseClient

  constructor(url: string, key: string) {
    this.sb = createClient(url, key)
  }

  async currentUser() {
    const { data } = await this.sb.auth.getSession()
    const u = data.session?.user
    return u ? { id: u.id, email: u.email ?? '' } : null
  }

  onAuthChange(cb: (user: User | null) => void) {
    const { data } = this.sb.auth.onAuthStateChange((_event, session) => {
      const u = session?.user
      cb(u ? { id: u.id, email: u.email ?? '' } : null)
    })
    return () => data.subscription.unsubscribe()
  }

  async signIn(email: string, password: string) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async signUp(email: string, password: string) {
    const { data, error } = await this.sb.auth.signUp({ email, password })
    if (error) throw error
    return { needsConfirmation: !data.session }
  }

  async signOut() {
    await this.sb.auth.signOut()
  }

  async getProfile(user: User) {
    const { data, error } = await this.sb.from('profiles').select('*').eq('id', user.id).maybeSingle()
    if (error) throw error
    return data ? normalize<Profile>(data) : null
  }

  async saveProfile(profile: Profile) {
    const { data, error } = await this.sb.from('profiles').upsert(profile).select().single()
    if (error) throw error
    return normalize<Profile>(data)
  }

  async list<T extends TableName>(table: T) {
    const { data, error } = await this.sb.from(table).select('*').order('created_at')
    if (error) throw error
    return (data ?? []).map((r) => normalize<Tables[T]>(r))
  }

  async insert<T extends TableName>(table: T, row: Omit<Tables[T], 'id'>) {
    const { data, error } = await this.sb.from(table).insert(row as never).select().single()
    if (error) throw error
    return normalize<Tables[T]>(data)
  }

  async update<T extends TableName>(table: T, id: string, patch: Partial<Tables[T]>) {
    const { data, error } = await this.sb.from(table).update(patch as never).eq('id', id).select().single()
    if (error) throw error
    return normalize<Tables[T]>(data)
  }

  async remove(table: TableName, id: string) {
    const { error } = await this.sb.from(table).delete().eq('id', id)
    if (error) throw error
  }
}

/** crypto.randomUUID is missing on old Safari; demo ids only need to be unique locally. */
function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2)
}

const DEMO_USER: User = { id: 'demo-user', email: 'demo@local' }
const KEY = 'abadesk:'

/** Demo mode: one local "account", rows kept in localStorage. */
class LocalStore implements Store {
  readonly demo = true
  private listeners = new Set<(u: User | null) => void>()

  private read<R>(name: string): R[] {
    try {
      return JSON.parse(localStorage.getItem(KEY + name) ?? '[]') as R[]
    } catch {
      return []
    }
  }

  private write(name: string, rows: unknown[]) {
    try {
      localStorage.setItem(KEY + name, JSON.stringify(rows))
    } catch {
      // Private mode or full storage: keep working in memory for this session.
    }
  }

  private signedIn(): boolean {
    try {
      return localStorage.getItem(KEY + 'session') === '1'
    } catch {
      return false
    }
  }

  private setSignedIn(on: boolean) {
    try {
      if (on) localStorage.setItem(KEY + 'session', '1')
      else localStorage.removeItem(KEY + 'session')
    } catch {
      // ignore
    }
    this.listeners.forEach((cb) => cb(on ? DEMO_USER : null))
  }

  async currentUser() {
    return this.signedIn() ? DEMO_USER : null
  }

  onAuthChange(cb: (user: User | null) => void) {
    this.listeners.add(cb)
    return () => {
      this.listeners.delete(cb)
    }
  }

  async signIn() {
    this.setSignedIn(true)
  }

  async signUp() {
    this.setSignedIn(true)
    return { needsConfirmation: false }
  }

  async signOut() {
    this.setSignedIn(false)
  }

  async getProfile() {
    return this.read<Profile>('profiles')[0] ?? null
  }

  async saveProfile(profile: Profile) {
    this.write('profiles', [profile])
    return profile
  }

  async list<T extends TableName>(table: T) {
    return this.read<Tables[T]>(table)
  }

  async insert<T extends TableName>(table: T, row: Omit<Tables[T], 'id'>) {
    const created = { ...row, id: newId(), created_at: new Date().toISOString() } as unknown as Tables[T]
    this.write(table, [...this.read(table), created])
    return created
  }

  async update<T extends TableName>(table: T, id: string, patch: Partial<Tables[T]>) {
    const rows = this.read<Tables[T]>(table)
    const i = rows.findIndex((r) => r.id === id)
    if (i < 0) throw new Error('Not found')
    rows[i] = { ...rows[i], ...patch }
    this.write(table, rows)
    return rows[i]
  }

  async remove(table: TableName, id: string) {
    this.write(
      table,
      this.read<{ id: string }>(table).filter((r) => r.id !== id),
    )
  }
}

const url = clean(import.meta.env.VITE_SUPABASE_URL)
const anonKey = clean(import.meta.env.VITE_SUPABASE_ANON_KEY)

export const store: Store = url && anonKey ? new SupabaseStore(url, anonKey) : new LocalStore()
