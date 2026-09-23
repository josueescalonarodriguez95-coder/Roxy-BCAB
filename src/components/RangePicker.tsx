import { useI18n } from '../i18n'
import { rangeFor, today, type DateRange, type RangeKind } from '../lib/dates'
import { Segmented } from './ui'

export interface RangeState {
  kind: RangeKind
  offset: number
  custom: DateRange
}

export function initialRange(kind: RangeKind = 'month'): RangeState {
  return { kind, offset: 0, custom: rangeFor('month', today()) }
}

export function resolveRange(s: RangeState): DateRange {
  return s.kind === 'custom' ? s.custom : rangeFor(s.kind, today(), s.offset)
}

/** Week / Bi-weekly / Month / Year / Custom with ‹ › to move between periods. */
export function RangePicker({ value, onChange }: { value: RangeState; onChange: (s: RangeState) => void }) {
  const { t, date } = useI18n()
  const range = resolveRange(value)
  const kinds: RangeKind[] = ['week', 'biweekly', 'month', 'year', 'custom']
  return (
    <div className="range-picker">
      <Segmented
        options={kinds.map((k) => ({ value: k, label: t(`range.${k}`) }))}
        value={value.kind}
        onChange={(kind) => onChange({ ...value, kind, offset: 0, custom: kind === 'custom' ? range : value.custom })}
      />
      {value.kind === 'custom' ? (
        <div className="range-custom">
          <input
            type="date"
            aria-label={t('range.from')}
            value={value.custom.start}
            onChange={(e) => e.target.value && onChange({ ...value, custom: { ...value.custom, start: e.target.value } })}
          />
          <span>–</span>
          <input
            type="date"
            aria-label={t('range.to')}
            value={value.custom.end}
            onChange={(e) => e.target.value && onChange({ ...value, custom: { ...value.custom, end: e.target.value } })}
          />
        </div>
      ) : (
        <div className="range-nav">
          <button className="btn icon" aria-label={t('range.prev')} onClick={() => onChange({ ...value, offset: value.offset - 1 })}>
            ‹
          </button>
          <span className="range-label">
            {date(range.start)} – {date(range.end)}
          </span>
          <button className="btn icon" aria-label={t('range.next')} onClick={() => onChange({ ...value, offset: value.offset + 1 })}>
            ›
          </button>
        </div>
      )}
    </div>
  )
}
