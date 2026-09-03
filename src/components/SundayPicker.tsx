import { useEffect, useMemo, useRef, useState } from 'react'
import {
  SEASON_START,
  formatSundayLong,
  hasStarted,
  isSelectableSunday,
  parseISO,
  todayISO,
  toISO,
} from '../lib/sundays'

/**
 * A calendar that will only give you a Sunday.
 *
 * A native `<input type="date">` can cap the range with min/max but has no way
 * to disable the other six days of the week, so a pastor could still pick a
 * Wednesday and only find out it was rejected after pressing submit. This draws
 * the month grid itself: every non-Sunday is rendered as plain inert text, and
 * the only clickable cells are Sundays that fall inside the tracking window and
 * are not in the future.
 *
 * The whole calendar is UTC — same as the rest of the app — so a phone on WAT
 * cannot shift a Sunday onto the Saturday before it.
 */

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function monthTitle(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** Every cell of the month grid, padded so the 1st lands on its weekday. */
function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month, 1))
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const cells: (string | null)[] = Array.from({ length: first.getUTCDay() }, () => null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(toISO(new Date(Date.UTC(year, month, d))))
  }
  return cells
}

export default function SundayPicker({
  value,
  onChange,
  id,
  disabled = false,
}: {
  /** The selected Sunday as YYYY-MM-DD, or '' for none. */
  value: string
  onChange: (date: string) => void
  id?: string
  disabled?: boolean
}) {
  const today = todayISO()
  const [open, setOpen] = useState(false)

  // The month on show. Follows the selection, else the current reporting month.
  const anchor = value || today
  const [cursor, setCursor] = useState(() => {
    const d = parseISO(anchor < SEASON_START ? SEASON_START : anchor)
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() }
  })

  const wrapper = useRef<HTMLDivElement>(null)

  // Close on an outside click or Escape — a popover that traps you is worse
  // than no popover.
  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (wrapper.current && !wrapper.current.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const cells = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor])

  const firstMonth = useMemo(() => {
    const d = parseISO(SEASON_START)
    return d.getUTCFullYear() * 12 + d.getUTCMonth()
  }, [])
  const lastMonth = useMemo(() => {
    // Never page past the month containing today — there is nothing selectable
    // beyond it.
    const d = parseISO(today < SEASON_START ? SEASON_START : today)
    return d.getUTCFullYear() * 12 + d.getUTCMonth()
  }, [today])

  const cursorMonth = cursor.year * 12 + cursor.month
  const canGoBack = cursorMonth > firstMonth
  const canGoForward = cursorMonth < lastMonth

  function step(delta: number) {
    setCursor((c) => {
      const next = new Date(Date.UTC(c.year, c.month + delta, 1))
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() }
    })
  }

  const started = hasStarted(today)

  function selectable(iso: string): boolean {
    return isSelectableSunday(iso, today)
  }

  return (
    <div className="relative" ref={wrapper}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="input flex items-center justify-between gap-2 text-left"
      >
        <span className={value ? '' : 'text-navy-300'}>
          {value
            ? formatSundayLong(value)
            : started
              ? 'Choose a Sunday…'
              : `Opens ${formatSundayLong(SEASON_START)}`}
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-navy-400">
          <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
          <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose a Sunday"
          className="absolute z-30 mt-2 w-[19rem] rounded-xl border border-navy-100 bg-white p-3 shadow-card"
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="rounded-lg p-1.5 text-navy-600 hover:bg-navy-50 disabled:opacity-30 disabled:hover:bg-transparent"
              onClick={() => step(-1)}
              disabled={!canGoBack}
              aria-label="Previous month"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-navy-900">
              {monthTitle(cursor.year, cursor.month)}
            </span>
            <button
              type="button"
              className="rounded-lg p-1.5 text-navy-600 hover:bg-navy-50 disabled:opacity-30 disabled:hover:bg-transparent"
              onClick={() => step(1)}
              disabled={!canGoForward}
              aria-label="Next month"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1">
            {WEEKDAY_INITIALS.map((d, i) => (
              <span
                key={i}
                className={`py-1 text-center text-[11px] font-semibold uppercase ${
                  i === 0 ? 'text-navy-700' : 'text-navy-300'
                }`}
              >
                {d}
              </span>
            ))}

            {cells.map((iso, i) => {
              if (!iso) return <span key={`pad-${i}`} />
              const day = parseISO(iso).getUTCDate()

              if (!selectable(iso)) {
                // Non-Sundays, Sundays before the exercise began, and future
                // Sundays all render as inert text rather than dead buttons.
                return (
                  <span
                    key={iso}
                    className="flex h-9 items-center justify-center text-sm text-navy-200"
                    aria-disabled
                  >
                    {day}
                  </span>
                )
              }

              const isSelected = iso === value
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => {
                    onChange(iso)
                    setOpen(false)
                  }}
                  aria-pressed={isSelected}
                  aria-label={formatSundayLong(iso)}
                  className={`flex h-9 items-center justify-center rounded-lg text-sm font-semibold transition ${
                    isSelected
                      ? 'bg-navy-900 text-white'
                      : 'bg-navy-50 text-navy-900 hover:bg-gold-100'
                  }`}
                >
                  {day}
                </button>
              )
            })}
          </div>

          <p className="mt-3 border-t border-navy-100 pt-2 text-[11px] leading-relaxed text-navy-500">
            {started ? (
              <>Only Sundays from {formatSundayLong(SEASON_START)} up to today can be selected.</>
            ) : (
              <>
                Returns open on <strong>{formatSundayLong(SEASON_START)}</strong>, the first Sunday
                of the exercise. Nothing can be submitted before then.
              </>
            )}
          </p>
        </div>
      )}
    </div>
  )
}
