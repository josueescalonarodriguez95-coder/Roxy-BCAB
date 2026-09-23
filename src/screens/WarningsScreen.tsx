import { PageHeader } from '../components/ui'
import { WarningList } from '../components/WarningList'
import { useWarnings } from '../data/useWarnings'
import { useI18n } from '../i18n'

export function WarningsScreen() {
  const { t } = useI18n()
  const warnings = useWarnings()
  return (
    <>
      <PageHeader title={t('warnings.title')} subtitle={t('warnings.subtitle')} />
      <section className="card">
        {warnings.length === 0 ? <p className="muted">{t('dash.allGood')}</p> : <WarningList warnings={warnings} />}
      </section>
    </>
  )
}
