import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useI18n } from '../i18n'
import { store, type User } from './store'
import { TABLES, type Client, type Profile, type TableName, type Tables } from './types'

type Rows = { [T in TableName]: Tables[T][] }
const EMPTY: Rows = { companies: [], clients: [], hour_entries: [], payments: [], todos: [] }

interface Data extends Rows {
  user: User
  profile: Profile
  saveProfile: (p: Partial<Profile>) => Promise<void>
  /** Inserts when `id` is missing, updates otherwise. */
  save: <T extends TableName>(table: T, row: Omit<Tables[T], 'id'> & { id?: string }) => Promise<Tables[T]>
  remove: (table: TableName, id: string) => Promise<void>
  clientName: (c: Client | undefined | null) => string
  companyName: (id: string | null | undefined) => string
}

const Ctx = createContext<Data | null>(null)

function defaultProfile(user: User, lang: Profile['language']): Profile {
  return {
    id: user.id,
    display_name: '',
    credential: 'BCBA',
    certification_date: null,
    language: lang,
    show_full_names: false,
    tax_rate: 0,
  }
}

/** Loads everything the signed-in user owns once, then keeps it in memory. */
export function DataProvider({ user, children }: { user: User; children: ReactNode }) {
  const { lang, setLang, t } = useI18n()
  const [rows, setRows] = useState<Rows | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    setError(null)
    Promise.all([store.getProfile(user), ...TABLES.map((tbl) => store.list(tbl))])
      .then(([p, ...lists]) => {
        if (!alive) return
        const next = { ...EMPTY }
        TABLES.forEach((tbl, i) => ((next as Record<TableName, unknown[]>)[tbl] = lists[i] as unknown[]))
        setRows(next)
        const prof = (p as Profile | null) ?? defaultProfile(user, lang)
        setProfile(prof)
        if (p) setLang(prof.language)
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      alive = false
    }
    // Language is only read on first load; changing it later must not reload the data.
  }, [user, attempt])

  const saveProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!profile) return
      const saved = await store.saveProfile({ ...profile, ...patch })
      setProfile(saved)
      if (patch.language) setLang(patch.language)
    },
    [profile, setLang],
  )

  const save = useCallback(async <T extends TableName>(table: T, row: Omit<Tables[T], 'id'> & { id?: string }) => {
    const { id, ...rest } = row
    const saved = id
      ? await store.update(table, id, rest as unknown as Partial<Tables[T]>)
      : await store.insert(table, rest as unknown as Omit<Tables[T], 'id'>)
    setRows((prev) => {
      if (!prev) return prev
      const list = prev[table] as Tables[T][]
      const next = id ? list.map((r) => (r.id === id ? saved : r)) : [...list, saved]
      return { ...prev, [table]: next }
    })
    return saved
  }, [])

  const remove = useCallback(async (table: TableName, id: string) => {
    await store.remove(table, id)
    setRows((prev) => (prev ? { ...prev, [table]: (prev[table] as { id: string }[]).filter((r) => r.id !== id) } : prev))
  }, [])

  const value = useMemo<Data | null>(() => {
    if (!rows || !profile) return null
    const clientName = (c: Client | undefined | null) => {
      if (!c) return '—'
      if (profile.show_full_names) return `${c.first_name} ${c.last_name}`.trim()
      return (c.first_name.charAt(0) + c.last_name.charAt(0)).toUpperCase() || '?'
    }
    const companyName = (id: string | null | undefined) => rows.companies.find((c) => c.id === id)?.name ?? '—'
    return { ...rows, user, profile, saveProfile, save, remove, clientName, companyName }
  }, [rows, profile, user, saveProfile, save, remove])

  if (error) {
    return (
      <div className="center-screen">
        <div className="card narrow">
          <h2>{t('app.error')}</h2>
          <p className="muted">{error}</p>
          <button className="btn primary" onClick={() => setAttempt((a) => a + 1)}>
            {t('app.retry')}
          </button>
        </div>
      </div>
    )
  }
  if (!value) return <div className="center-screen muted">{t('app.loading')}</div>
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useData(): Data {
  const v = useContext(Ctx)
  if (!v) throw new Error('useData outside DataProvider')
  return v
}
