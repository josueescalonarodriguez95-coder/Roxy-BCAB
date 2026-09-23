import type { Lang } from '../data/types'
import { useI18n } from '../i18n'

/** EN / ES toggle. `onChange` lets the signed-in shell also save the choice to the profile. */
export function LangSwitch({ onChange }: { onChange?: (l: Lang) => void }) {
  const { lang, setLang } = useI18n()
  const next: Lang = lang === 'en' ? 'es' : 'en'
  return (
    <button
      className="pill"
      aria-label={next === 'es' ? 'Cambiar a español' : 'Switch to English'}
      onClick={() => (onChange ? onChange(next) : setLang(next))}
    >
      {lang.toUpperCase()}
    </button>
  )
}
