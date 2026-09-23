import { useI18n } from '../i18n'
import type { Warning } from '../lib/warnings'
import { useGo } from '../nav'
import { Badge } from './ui'

export function WarningList({ warnings }: { warnings: Warning[] }) {
  const { t } = useI18n()
  const go = useGo()
  return (
    <ul className="warning-list">
      {warnings.map((w) => (
        <li key={w.id}>
          <button onClick={() => go(w.tab)}>
            <Badge tone={w.level}>{t(`level.${w.level}`)}</Badge>
            <span>{t(`w.${w.key}`, w.params)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
