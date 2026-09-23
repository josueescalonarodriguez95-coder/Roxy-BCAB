import { createContext, useContext } from 'react'

export type Tab =
  | 'dashboard'
  | 'clients'
  | 'hours'
  | 'companies'
  | 'supervision'
  | 'earnings'
  | 'todo'
  | 'warnings'
  | 'settings'

export const TABS: Tab[] = ['dashboard', 'clients', 'hours', 'companies', 'supervision', 'earnings', 'todo', 'warnings', 'settings']

export const NavContext = createContext<(tab: Tab) => void>(() => {})

export function useGo() {
  return useContext(NavContext)
}
