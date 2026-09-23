import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { ISODate, Lang } from '../data/types'
import { fromISO } from '../lib/dates'
import { en, type MessageKey } from './en'
import { es } from './es'

const MESSAGES: Record<Lang, Record<MessageKey, string>> = { en, es }
const LOCALES: Record<Lang, string> = { en: 'en-US', es: 'es-US' }
const LANG_KEY = 'abadesk:lang'

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved === 'en' || saved === 'es') return saved
  } catch {
    // ignore
  }
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'
}

interface I18n {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: MessageKey, params?: Record<string, string | number>) => string
  money: (n: number) => string
  num: (n: number) => string
  date: (d: ISODate | null | undefined) => string
}

const Ctx = createContext<I18n | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    document.documentElement.lang = l
    try {
      localStorage.setItem(LANG_KEY, l)
    } catch {
      // ignore
    }
  }, [])

  const value = useMemo<I18n>(() => {
    const locale = LOCALES[lang]
    const moneyFmt = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' })
    const numFmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 })
    const dateFmt = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' })
    const money = (n: number) => moneyFmt.format(n)
    return {
      lang,
      setLang,
      money,
      num: (n) => numFmt.format(n),
      date: (d) => (d ? dateFmt.format(fromISO(d)) : '—'),
      t: (key, params) => {
        let s: string = MESSAGES[lang][key] ?? key
        if (params) {
          for (const [k, v] of Object.entries(params)) {
            // Dates and amounts in warnings arrive raw; format them for the current language.
            let shown = String(v)
            if (k === 'date' && typeof v === 'string') shown = dateFmt.format(fromISO(v))
            if (k === 'amount' && typeof v === 'number') shown = money(v)
            s = s.split(`{${k}}`).join(shown)
          }
        }
        return s
      },
    }
  }, [lang, setLang])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n(): I18n {
  const v = useContext(Ctx)
  if (!v) throw new Error('useI18n outside I18nProvider')
  return v
}
