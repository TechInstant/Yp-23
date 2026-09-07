/**
 * The daily cut-off for parish returns.
 *
 * Nigeria is UTC+1 and the whole app works in UTC, so the province sets a WAT
 * time and it is stored as minutes past UTC midnight — the shape the Firestore
 * rules can actually do arithmetic on, since rules can read `request.time`
 * hours and minutes but cannot convert a timezone.
 *
 * 23:30 WAT is 22:30 UTC on the same UTC Sunday, so a cut-off anywhere in the
 * evening stays inside the same reporting day. Only a cut-off after 23:00 WAT
 * would spill past UTC midnight, which is why the picker stops before it.
 */

/** West Africa Time is a fixed +1; Nigeria has no daylight saving. */
export const WAT_OFFSET_MINUTES = 60

/** Midnight WAT — i.e. no cut-off, the whole Sunday is open. */
export const NO_CUTOFF = 23 * 60 + 59

export function watToUtcMinutes(watMinutes: number): number {
  return (watMinutes - WAT_OFFSET_MINUTES + 1440) % 1440
}

export function utcToWatMinutes(utcMinutes: number): number {
  return (utcMinutes + WAT_OFFSET_MINUTES) % 1440
}

export function minutesToLabel(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const suffix = h < 12 ? 'am' : 'pm'
  const display = h % 12 === 0 ? 12 : h % 12
  return `${display}:${String(m).padStart(2, '0')} ${suffix}`
}

export function labelToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return h * 60 + m
}

/** Current minutes past UTC midnight, matching what the rules compute. */
export function nowUtcMinutes(now = new Date()): number {
  return now.getUTCHours() * 60 + now.getUTCMinutes()
}

/**
 * Whether returns are still open, given a cut-off in UTC minutes.
 *
 * A cut-off that has wrapped past UTC midnight (only possible after 23:00 WAT,
 * which the picker prevents) would make a naive comparison reject the entire
 * day, so that case is treated as always open rather than never.
 */
export function isWithinCutoff(closesAtUtcMinutes: number, now = new Date()): boolean {
  const cutoffWat = utcToWatMinutes(closesAtUtcMinutes)
  if (cutoffWat < WAT_OFFSET_MINUTES) return true
  return nowUtcMinutes(now) <= closesAtUtcMinutes
}
