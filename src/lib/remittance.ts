import { allSundays, parseISO, todayISO } from './sundays'

/**
 * Remittance periods.
 *
 * A remittance month is not the calendar month. It runs from the **last Sunday
 * of the previous month** through the **second-to-last Sunday of the current
 * month** — i.e. it takes the last Sunday of the previous month plus every
 * Sunday of this month except the last one, because that last Sunday opens the
 * next remittance.
 *
 *   September 2026 has Sundays 6, 13, 20, 27.
 *   Remittance for September = 30 Aug + 6 + 13 + 20   (4 Sundays)
 *   The 27th rolls into October's remittance.
 *
 * A month with five Sundays simply contributes one more, so the period grows to
 * five. That is the rule the province stated: "the last Sunday of the month and
 * the three Sundays of the current month… if there are 5 Sundays in a month it
 * increases by the number".
 *
 * Everything is computed from the Sunday list itself rather than from calendar
 * arithmetic, so the periods can never drift out of step with the tracking
 * window in sundays.ts.
 */

export interface RemittancePeriod {
  /** `YYYY-MM` of the month the remittance belongs to. */
  key: string
  /** "September 2026" */
  label: string
  /** "Sep 2026" — for a chart axis. */
  shortLabel: string
  /** The Sundays collated into this remittance, oldest first. */
  sundays: string[]
  opensOn: string
  closesOn: string
  /**
   * True when the tracking window clips the period, so its total is not
   * comparable with a full one. Exactly two exist: September 2026 (the exercise
   * starts on the 6th, so August's last Sunday was never tracked) and the
   * trailing carry after the final Sunday of 2029. A complete period always
   * holds 4 or 5 Sundays.
   */
  partial: boolean
}

function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

function monthLabel(key: string, short = false): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', {
    month: short ? 'short' : 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

let cached: RemittancePeriod[] | null = null

/**
 * Every remittance period the tracking window covers.
 *
 * Note the first one is partial: the exercise starts on Sunday 6 September
 * 2026, so the last Sunday of August is not tracked and September's remittance
 * collates three Sundays rather than four. The period is still reported — it is
 * real money and real attendance — but `sundays.length` shows it is short.
 */
export function remittancePeriods(): RemittancePeriod[] {
  if (cached) return cached

  const sundays = allSundays()

  // Group Sundays by calendar month, then move each month's final Sunday into
  // the following month's remittance.
  const byMonth = new Map<string, string[]>()
  for (const date of sundays) {
    const key = monthKey(date)
    const list = byMonth.get(key)
    if (list) list.push(date)
    else byMonth.set(key, [date])
  }

  const periods = new Map<string, string[]>()
  for (const [key, dates] of byMonth) {
    const carried = dates[dates.length - 1]
    const kept = dates.slice(0, -1)

    for (const d of kept) {
      const list = periods.get(key)
      if (list) list.push(d)
      else periods.set(key, [d])
    }

    // The last Sunday opens the next month's remittance.
    const [y, m] = key.split('-').map(Number)
    const nextKey = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
    const nextList = periods.get(nextKey)
    if (nextList) nextList.unshift(carried)
    else periods.set(nextKey, [carried])
  }

  cached = [...periods.entries()]
    .map(([key, dates]) => {
      const ordered = dates.slice().sort()
      return {
        key,
        label: monthLabel(key),
        shortLabel: monthLabel(key, true),
        sundays: ordered,
        opensOn: ordered[0],
        closesOn: ordered[ordered.length - 1],
        partial: ordered.length < 4,
      }
    })
    // Drop the trailing carry. The last Sunday of the exercise opens a
    // remittance for the month *after* it, which can never be completed —
    // otherwise the dashboard sprouts a "January 2030" bar holding one Sunday.
    // Testing whether its Sunday falls inside the window does not work: that
    // Sunday is the final one, so it always passes.
    .filter((p) => p.key <= monthKey(sundays[sundays.length - 1]))
    .sort((a, b) => a.key.localeCompare(b.key))

  return cached
}

/** Which remittance period a given Sunday is collated into. */
export function remittanceKeyFor(date: string): string | null {
  for (const period of remittancePeriods()) {
    if (period.sundays.includes(date)) return period.key
  }
  return null
}

/**
 * Periods whose Sundays have all been and gone — the ones worth charting.
 *
 * Strictly before today, not on or before: on its closing Sunday the period is
 * still being counted, and returns for that morning have not been filed.
 * Including it would show every month as a sharp decline for one week, then
 * jump when the last returns arrive.
 */
export function closedPeriods(today = todayISO()): RemittancePeriod[] {
  return remittancePeriods().filter((p) => p.closesOn < today)
}

/** The period currently being collected, if the exercise has started. */
export function openPeriod(today = todayISO()): RemittancePeriod | null {
  return remittancePeriods().find((p) => p.opensOn <= today && p.closesOn > today) ?? null
}

export function formatPeriodRange(period: RemittancePeriod): string {
  const fmt = (iso: string) =>
    parseISO(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    })
  return `${fmt(period.opensOn)} – ${fmt(period.closesOn)}`
}
