import { useState } from 'react'
import type { ISODate } from '../../data/types'
import { useI18n } from '../../i18n'
import { monthMatrix, sameMonth, shiftDate } from '../../lib/calendar'
import { today } from '../../lib/dates'

/** Small month in the calendar sidebar: click a day to jump to it. Dots mark busy days. */
export function MiniMonth({ value, busy, onPick }: { value: ISODate; busy: Set<ISODate>; onPick: (d: ISODate) => void }) {
  const { fmt, t } = useI18n()
  // The mini month can be browsed on its own without moving the main calendar.
  const [shown, setShown] = useState(value)
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setShown(value)
  }
  const now = today()
  const weeks = monthMatrix(shown)

  return (
    <div className="mini-month">
      <div className="row-between">
        <strong className="mini-title">{fmt(shown, { month: 'long', year: 'numeric' })}</strong>
        <span>
          <button className="btn icon subtle" aria-label={t('range.prev')} onClick={() => setShown(shiftDate(shown, 'month', -1))}>
            ‹
          </button>
          <button className="btn icon subtle" aria-label={t('range.next')} onClick={() => setShown(shiftDate(shown, 'month', 1))}>
            ›
          </button>
        </span>
      </div>
      <div className="mini-grid">
        {weeks[0].map((d) => (
          <span key={d} className="mini-dow">
            {fmt(d, { weekday: 'narrow' })}
          </span>
        ))}
        {weeks.flat().map((d) => (
          <button
            key={d}
            className={[
              'mini-day',
              sameMonth(d, shown) ? '' : 'out',
              d === now ? 'today' : '',
              d === value ? 'selected' : '',
              busy.has(d) ? 'busy' : '',
            ].join(' ')}
            onClick={() => onPick(d)}
          >
            {Number(d.slice(8))}
          </button>
        ))}
      </div>
    </div>
  )
}
