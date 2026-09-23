import { useEffect, useState } from 'react'
import { LangSwitch } from './components/LangSwitch'
import { NavIcon } from './components/NavIcon'
import { APP_NAME } from './config'
import { DataProvider, useData } from './data/DataContext'
import { store, type User } from './data/store'
import { useWarnings } from './data/useWarnings'
import { useI18n } from './i18n'
import { NavContext, TABS, type Tab } from './nav'
import { ClientsScreen } from './screens/ClientsScreen'
import { CompaniesScreen } from './screens/CompaniesScreen'
import { DashboardScreen } from './screens/DashboardScreen'
import { EarningsScreen } from './screens/EarningsScreen'
import { HoursScreen } from './screens/HoursScreen'
import { LoginScreen } from './screens/LoginScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { SupervisionScreen } from './screens/SupervisionScreen'
import { TodoScreen } from './screens/TodoScreen'
import { WarningsScreen } from './screens/WarningsScreen'

export default function App() {
  const { t } = useI18n()
  // undefined = still checking the session.
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    store.currentUser().then(setUser)
    // Token refreshes fire this too; keep the same object when the account didn't change so the
    // data isn't reloaded.
    return store.onAuthChange((u) => setUser((prev) => (prev && u && prev.id === u.id ? prev : u)))
  }, [])

  if (user === undefined) return <div className="center-screen muted">{t('app.loading')}</div>
  if (!user) return <LoginScreen />
  return (
    <DataProvider key={user.id} user={user}>
      <Shell />
    </DataProvider>
  )
}

function tabFromHash(): Tab {
  const h = window.location.hash.slice(1) as Tab
  return TABS.includes(h) ? h : 'dashboard'
}

function Shell() {
  const { t } = useI18n()
  const { profile, saveProfile } = useData()
  const warnings = useWarnings()
  const [tab, setTab] = useState<Tab>(tabFromHash)

  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // On phones the menu is a horizontal strip: keep the current section in view.
  useEffect(() => {
    document.querySelector('.nav-item.active')?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [tab])

  const go = (next: Tab) => {
    window.location.hash = next
    setTab(next)
    window.scrollTo(0, 0)
  }

  const who = profile.display_name.trim().split(' ')[0]
  // RBTs receive supervision instead of giving it.
  const tabs = TABS.filter((id) => id !== 'supervision' || profile.credential !== 'RBT')

  return (
    <NavContext.Provider value={go}>
      <div className="bg-blobs" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="layout">
        <aside className="sidebar glass">
          <button className="logo" onClick={() => go('dashboard')}>
            <span className="logo-mark">◆</span> {APP_NAME}
          </button>
          <nav className="side-nav" aria-label="Main">
            {tabs.map((id) => (
              <button
                key={id}
                className={`nav-item nav-${id} ${id === tab ? 'active' : ''}`}
                aria-current={id === tab ? 'page' : undefined}
                onClick={() => go(id)}
              >
                <span className="nav-icon">
                  <NavIcon tab={id} />
                </span>
                <span className="nav-label">{t(`tab.${id}`)}</span>
                {id === 'warnings' && warnings.length > 0 && <span className="count">{warnings.length}</span>}
              </button>
            ))}
          </nav>
          <div className="side-footer">
            <button className="pill user-pill" onClick={() => go('settings')}>
              <span className="avatar">{(who || profile.credential).charAt(0).toUpperCase()}</span>
              <span>
                {who ? `${who} · ` : ''}
                {profile.credential}
              </span>
            </button>
            <div className="side-actions">
              <LangSwitch onChange={(language) => saveProfile({ language })} />
              <button className="pill" onClick={() => saveProfile({ show_full_names: !profile.show_full_names })}>
                {profile.show_full_names ? t('header.fullNames') : t('header.initials')}
              </button>
            </div>
          </div>
        </aside>
        <main className="page">
          {store.demo && <div className="demo-bar glass">{t('app.demoBanner')}</div>}
          <div className="screen" key={tab}>
            {tab === 'dashboard' && <DashboardScreen />}
            {tab === 'clients' && <ClientsScreen />}
            {tab === 'hours' && <HoursScreen />}
            {tab === 'companies' && <CompaniesScreen />}
            {tab === 'supervision' && profile.credential !== 'RBT' && <SupervisionScreen />}
            {tab === 'earnings' && <EarningsScreen />}
            {tab === 'todo' && <TodoScreen />}
            {tab === 'warnings' && <WarningsScreen />}
            {tab === 'settings' && <SettingsScreen key={profile.language} />}
          </div>
        </main>
      </div>
    </NavContext.Provider>
  )
}
