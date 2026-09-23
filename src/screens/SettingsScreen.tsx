import { useState } from 'react'
import { Field, PageHeader, num } from '../components/ui'
import { useData } from '../data/DataContext'
import { store } from '../data/store'
import type { Credential, Lang } from '../data/types'
import { useI18n } from '../i18n'

export function SettingsScreen() {
  const { t } = useI18n()
  const { profile, saveProfile, user } = useData()
  const [d, setD] = useState(profile)
  const [tax, setTax] = useState(profile.tax_rate ? String(profile.tax_rate) : '')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  return (
    <>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <form
        className="card form narrow"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          try {
            await saveProfile({ ...d, display_name: d.display_name.trim(), tax_rate: Math.min(100, Math.max(0, num(tax))) })
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
          } finally {
            setBusy(false)
          }
        }}
      >
        <Field label={t('settings.name')}>
          <input value={d.display_name} onChange={(e) => setD({ ...d, display_name: e.target.value })} />
        </Field>
        <div className="form-row">
          <Field label={t('settings.credential')}>
            <select value={d.credential} onChange={(e) => setD({ ...d, credential: e.target.value as Credential })}>
              <option value="BCBA">BCBA</option>
              <option value="BCaBA">BCaBA</option>
              <option value="RBT">RBT</option>
            </select>
          </Field>
          <Field label={t('settings.certDate')}>
            <input
              type="date"
              value={d.certification_date ?? ''}
              onChange={(e) => setD({ ...d, certification_date: e.target.value || null })}
            />
          </Field>
        </div>
        <Field label={t('settings.language')}>
          <select value={d.language} onChange={(e) => setD({ ...d, language: e.target.value as Lang })}>
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </Field>
        <Field label={t('settings.taxRate')} hint={t('settings.taxRateHelp')}>
          <input inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value)} placeholder="0" />
        </Field>
        <div className="form-actions">
          {saved && <span className="muted">✓ {t('settings.saved')}</span>}
          <span className="spacer" />
          <button className="btn primary" disabled={busy}>
            {t('common.save')}
          </button>
        </div>
      </form>

      <section className="card narrow section">
        <h2>{t('settings.account')}</h2>
        <p className="muted">{user.email}</p>
        <button className="btn" onClick={() => store.signOut()}>
          {t('auth.signOut')}
        </button>
      </section>
    </>
  )
}
