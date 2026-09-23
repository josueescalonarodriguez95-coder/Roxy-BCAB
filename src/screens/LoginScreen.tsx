import { useState } from 'react'
import { LangSwitch } from '../components/LangSwitch'
import { Field } from '../components/ui'
import { APP_NAME, DEDICATION } from '../config'
import { store } from '../data/store'
import { useI18n } from '../i18n'

export function LoginScreen() {
  const { t } = useI18n()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  return (
    <div className="center-screen login">
      <div className="card narrow login-card">
        <div className="row-between">
          <div className="logo">
            <span className="logo-mark">◆</span> {APP_NAME}
          </div>
          <LangSwitch />
        </div>
        {DEDICATION && <p className="dedication">{DEDICATION}</p>}
        <p className="muted">{t('auth.tagline')}</p>

        {store.demo ? (
          <>
            <p className="banner">{t('app.demoBanner')}</p>
            <button className="btn primary block" onClick={() => store.signIn('', '')}>
              {t('auth.demoEnter')}
            </button>
          </>
        ) : (
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault()
              setBusy(true)
              setMessage(null)
              try {
                if (mode === 'in') {
                  await store.signIn(email.trim(), password)
                } else {
                  const { needsConfirmation } = await store.signUp(email.trim(), password)
                  if (needsConfirmation) {
                    setMessage({ kind: 'info', text: t('auth.checkEmail') })
                    setMode('in')
                  }
                }
              } catch (err) {
                setMessage({ kind: 'error', text: err instanceof Error ? err.message : String(err) })
              } finally {
                setBusy(false)
              }
            }}
          >
            <Field label={t('auth.email')}>
              <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label={t('auth.password')}>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {message && <p className={message.kind === 'error' ? 'error' : 'banner'}>{message.text}</p>}
            <button className="btn primary block" disabled={busy}>
              {mode === 'in' ? t('auth.signIn') : t('auth.signUp')}
            </button>
            <button type="button" className="btn link" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
              {mode === 'in' ? t('auth.toSignUp') : t('auth.toSignIn')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
