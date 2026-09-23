import type { Tab } from '../nav'

/** Line icons for the sidebar (24×24, drawn with currentColor). */
const PATHS: Record<Tab, string> = {
  dashboard: 'M3 11.5 12 4l9 7.5M5.5 9.5V20h5v-5.5h3V20h5V9.5',
  clients: 'M8.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .6 3.5 2.4 3.5 5.2',
  hours: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13.5V12l3 2',
  companies: 'M4 21V6.5L12 3l8 3.5V21M4 21h16M9 21v-4h6v4M8.5 9.5h1m5 0h1m-7 3.5h1m5 0h1',
  supervision: 'M12 3 4 6.5v5c0 4.6 3.4 8.5 8 9.5 4.6-1 8-4.9 8-9.5v-5L12 3Zm-3.5 9 2.5 2.5 4.5-5',
  earnings: 'M4 7.5h16v11H4zM4 11h16M16.5 15h1M7 4.5h10',
  todo: 'M9 5h11M9 12h11M9 19h11M4 4.5l1 1 2-2M4 11.5l1 1 2-2M4 18.5l1 1 2-2',
  warnings: 'M12 3.5 2.5 20h19L12 3.5ZM12 10v4.5m0 2.5v.5',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2.2-1.3L14.3 3h-4l-.4 2.5a7.5 7.5 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2.2 1.3l.4 2.5h4l.4-2.5a7.5 7.5 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3Z',
}

export function NavIcon({ tab }: { tab: Tab }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[tab]} />
    </svg>
  )
}
