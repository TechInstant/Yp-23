/**
 * The tracking window: every Sunday from the first Sunday of September 2026
 * (Sun 6 Sep 2026) through the last Sunday of December 2029 (Sun 30 Dec 2029).
 * 174 Sundays in total.
 *
 * All arithmetic is done in UTC on `YYYY-MM-DD` strings so that a phone set to
 * WAT, a Render box on UTC and a laptop on any other zone all agree on which
 * Sunday a return belongs to. Never feed these through `new Date(iso)` +
 * `getDay()` in local time — that is the classic off-by-one-day bug.
 *
 * If the province extends the exercise past 2029, change SEASON_END here *and*
 * the matching bound in firestore.rules.
 */

export const SEASON_START = '2026-09-06'
export const SEASON_END = '2029-12-30'

const DAY_MS = 86_400_000

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function toISO(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function isSunday(iso: string): boolean {
  return parseISO(iso).getUTCDay() === 0
}

/** All tracked Sundays, oldest first. Computed once and reused. */
let cachedSundays: string[] | null = null

export function allSundays(): string[] {
  if (cachedSundays) return cachedSundays
  const out: string[] = []
  let cursor = parseISO(SEASON_START).getTime()
  const end = parseISO(SEASON_END).getTime()
  while (cursor <= end) {
    out.push(toISO(new Date(cursor)))
    cursor += 7 * DAY_MS
  }
  cachedSundays = out
  return out
}

export function isTrackedSunday(iso: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(iso) &&
    iso >= SEASON_START &&
    iso <= SEASON_END &&
    isSunday(iso)
  )
}

/** Today in UTC as YYYY-MM-DD. */
export function todayISO(): string {
  return toISO(new Date())
}

/**
 * The Sunday a parish would report on right now: the most recent tracked Sunday
 * on or before today. Before the exercise begins this is the first Sunday, so
 * the form is never empty.
 */
export function currentReportingSunday(today = todayISO()): string {
  if (today < SEASON_START) return SEASON_START
  const list = allSundays()
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i] <= today) return list[i]
  }
  return SEASON_START
}

/**
 * Whether a date may be reported on: a Sunday, inside the tracking window, and
 * already past. This is the single definition of "selectable" — the calendar,
 * the default value and the submit guard all call it, so they cannot disagree.
 */
export function isSelectableSunday(iso: string, today = todayISO()): boolean {
  return isTrackedSunday(iso) && iso <= today
}

/**
 * The Sunday a form should open on: the most recent one that may actually be
 * reported. Empty string before the exercise begins — deliberately *not*
 * SEASON_START, because until 6 September 2026 has happened, defaulting to it
 * would offer a future Sunday the calendar then refuses to re-select.
 */
export function latestSelectableSunday(today = todayISO()): string {
  if (today < SEASON_START) return ''
  const list = allSundays()
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i] <= today) return list[i]
  }
  return ''
}

/** True once the first Sunday of the exercise has arrived. */
export function hasStarted(today = todayISO()): boolean {
  return today >= SEASON_START
}

/**
 * Service year runs September -> August, matching the province's calendar.
 * Returns e.g. "2026/27".
 */
export function serviceYear(iso: string): string {
  const d = parseISO(iso)
  const y = d.getUTCFullYear()
  const startYear = d.getUTCMonth() >= 8 ? y : y - 1
  return `${startYear}/${String(startYear + 1).slice(2)}`
}

export function serviceYears(): string[] {
  return Array.from(new Set(allSundays().map(serviceYear)))
}

/** "6 Sep 2026" */
export function formatSunday(iso: string): string {
  const d = parseISO(iso)
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** "Sun 6 Sep 2026" — for the submission form, where the day matters. */
export function formatSundayLong(iso: string): string {
  const d = parseISO(iso)
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** "6 Sep" — compact enough for a chart axis. */
export function formatAxis(iso: string): string {
  const d = parseISO(iso)
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

export interface DateRange {
  from: string
  to: string
}

export const RANGE_PRESETS = [
  { key: 'last8', label: 'Last 8 Sundays' },
  { key: 'last26', label: 'Last 6 months' },
  { key: 'last52', label: 'Last 12 months' },
  { key: 'all', label: 'Whole exercise' },
] as const

export type RangePresetKey = (typeof RANGE_PRESETS)[number]['key']

export function resolveRange(preset: RangePresetKey, today = todayISO()): DateRange {
  const all = allSundays()
  const past = all.filter((d) => d <= today)

  const counts: Record<RangePresetKey, number> = {
    last8: 8,
    last26: 26,
    last52: 52,
    all: all.length,
  }

  // Before the exercise begins there is nothing behind us. Look *forward* from
  // the first Sunday instead of backward from the last: taking the tail of the
  // whole exercise would land the window in 2029, and clamping it to a single
  // Sunday — which is what this used to do — collapses every chart to one
  // point, so any data loaded early looks broken for the wrong reason.
  if (past.length === 0) {
    const n = Math.min(counts[preset], all.length)
    return { from: all[0], to: all[n - 1] }
  }

  const n = Math.min(counts[preset], past.length)
  return { from: past[past.length - n], to: past[past.length - 1] }
}
