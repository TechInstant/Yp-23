import type { AttendanceRecord, Parish } from '../types'
import { remittancePeriods, type RemittancePeriod } from './remittance'
import { allSundays, type DateRange } from './sundays'

export interface PointTotals {
  date: string
  total: number
  /** How many parishes actually returned a figure that Sunday. */
  reporting: number
}

export function inRange(records: AttendanceRecord[], range: DateRange): AttendanceRecord[] {
  return records.filter((r) => r.date >= range.from && r.date <= range.to)
}

/**
 * One row per Sunday in the range, including Sundays nobody reported — a gap in
 * the line is itself the signal the province wants to see.
 */
export function totalsBySunday(records: AttendanceRecord[], range: DateRange): PointTotals[] {
  const buckets = new Map<string, PointTotals>()
  for (const date of allSundays()) {
    if (date >= range.from && date <= range.to) {
      buckets.set(date, { date, total: 0, reporting: 0 })
    }
  }
  for (const r of records) {
    const b = buckets.get(r.date)
    if (!b) continue
    b.total += r.attendance
    b.reporting += 1
  }
  return [...buckets.values()]
}

export interface PointWithAverage extends PointTotals {
  /** Mean attendance per reporting parish that Sunday. */
  perParish: number
  /** Trailing mean of `total` over `window` Sundays that had returns. */
  rollingAverage: number | null
}

/**
 * Adds the trailing average that the growth reading is based on.
 *
 * Raw Sunday totals bounce around too much to answer "are we growing?" — a
 * rainy Sunday or a convention swings them by a third. The trailing mean is the
 * line to actually read, and it is the same measure the per-parish growth
 * percentages use, so the chart and the table cannot tell different stories.
 *
 * Sundays with no returns are skipped rather than counted as zero: a missing
 * return is missing data, not an empty church, and averaging it in would drag
 * the line down and invent a decline.
 */
export function withRollingAverage(points: PointTotals[], window = 4): PointWithAverage[] {
  const reported: number[] = []
  return points.map((p) => {
    if (p.reporting > 0) {
      reported.push(p.total)
      if (reported.length > window) reported.shift()
    }
    return {
      ...p,
      perParish: p.reporting > 0 ? Math.round(p.total / p.reporting) : 0,
      rollingAverage:
        reported.length > 0
          ? Math.round(reported.reduce((s, v) => s + v, 0) / reported.length)
          : null,
    }
  })
}

export interface RemittanceTotals {
  key: string
  label: string
  shortLabel: string
  sundays: number
  partial: boolean
  total: number
  /** Mean attendance per Sunday across the period — comparable when a period
   *  has five Sundays instead of four. */
  perSunday: number
  returns: number
  /** Change in total against the preceding period that had returns. */
  changePct: number | null
}

/**
 * Attendance collated into remittance periods: the last Sunday of the previous
 * month plus this month's Sundays bar the last. Each period is plotted against
 * the one before it, which is what "against the previous records of the
 * remittance" means.
 *
 * `total` is the headline figure. `perSunday` exists because a five-Sunday
 * period will out-total a four-Sunday one without anybody growing — comparing
 * the raw totals alone would show phantom growth every couple of months.
 */
export function totalsByRemittance(
  records: AttendanceRecord[],
  periods: RemittancePeriod[] = remittancePeriods(),
): RemittanceTotals[] {
  const byDate = new Map<string, AttendanceRecord[]>()
  for (const r of records) {
    const list = byDate.get(r.date)
    if (list) list.push(r)
    else byDate.set(r.date, [r])
  }

  const rows: RemittanceTotals[] = periods.map((period) => {
    let total = 0
    let returns = 0
    for (const date of period.sundays) {
      for (const r of byDate.get(date) ?? []) {
        total += r.attendance
        returns += 1
      }
    }
    return {
      key: period.key,
      label: period.label,
      shortLabel: period.shortLabel,
      sundays: period.sundays.length,
      partial: period.partial,
      total,
      perSunday: period.sundays.length ? Math.round(total / period.sundays.length) : 0,
      returns,
      changePct: null,
    }
  })

  // Compare each period with the one before it, skipping periods nobody
  // reported so a gap in the data does not read as a 100% collapse.
  let previous: RemittanceTotals | null = null
  for (const row of rows) {
    if (previous && previous.total > 0) {
      row.changePct = ((row.total - previous.total) / previous.total) * 100
    }
    if (row.returns > 0) previous = row
  }
  return rows
}

export interface ParishGrowth {
  parishId: string
  parishName: string
  first: number
  latest: number
  /** Mean of the earliest window, used as the growth baseline. */
  baseline: number
  /** Mean of the most recent window. */
  recent: number
  changePct: number | null
  returns: number
  average: number
  best: number
  lastReported: string | null
}

/**
 * Growth is measured as "recent form vs opening form": the mean of a parish's
 * last few returns against the mean of its first few, inside the selected
 * range. A single freak Sunday (a convention, a rainstorm) then cannot flip a
 * parish from growing to shrinking, which a plain first-vs-last comparison
 * would happily do.
 */
export function parishGrowth(
  records: AttendanceRecord[],
  parishes: Parish[],
  window = 4,
): ParishGrowth[] {
  const byParish = new Map<string, AttendanceRecord[]>()
  for (const r of records) {
    const list = byParish.get(r.parishId)
    if (list) list.push(r)
    else byParish.set(r.parishId, [r])
  }

  const out: ParishGrowth[] = []
  for (const parish of parishes) {
    const list = (byParish.get(parish.id) ?? []).sort((a, b) => a.date.localeCompare(b.date))
    if (list.length === 0) continue

    const values = list.map((r) => r.attendance)
    // With few returns, halve the window so the two samples never overlap.
    const w = Math.max(1, Math.min(window, Math.floor(values.length / 2)))
    const canCompare = values.length >= 2
    const baseline = canCompare ? mean(values.slice(0, w)) : values[0]
    const recent = canCompare ? mean(values.slice(-w)) : values[0]

    out.push({
      parishId: parish.id,
      parishName: parish.name,
      first: values[0],
      latest: values[values.length - 1],
      baseline,
      recent,
      changePct: canCompare && baseline > 0 ? ((recent - baseline) / baseline) * 100 : null,
      returns: values.length,
      average: mean(values),
      best: Math.max(...values),
      lastReported: list[list.length - 1].date,
    })
  }
  return out
}

export interface Headline {
  latestSunday: string | null
  latestTotal: number
  previousTotal: number
  weekOnWeekPct: number | null
  reportingParishes: number
  activeParishes: number
  averageAttendance: number
  totalReturns: number
  growing: number
  declining: number
}

export function headline(
  records: AttendanceRecord[],
  parishes: Parish[],
  growth: ParishGrowth[],
): Headline {
  const active = parishes.filter((p) => p.status === 'active')
  const dates = [...new Set(records.map((r) => r.date))].sort()
  const latestSunday = dates.length ? dates[dates.length - 1] : null
  const previousSunday = dates.length > 1 ? dates[dates.length - 2] : null

  const sumOn = (date: string | null) =>
    date ? records.filter((r) => r.date === date).reduce((s, r) => s + r.attendance, 0) : 0

  const latestTotal = sumOn(latestSunday)
  const previousTotal = sumOn(previousSunday)
  const totalAttendance = records.reduce((s, r) => s + r.attendance, 0)

  return {
    latestSunday,
    latestTotal,
    previousTotal,
    weekOnWeekPct:
      previousSunday && previousTotal > 0
        ? ((latestTotal - previousTotal) / previousTotal) * 100
        : null,
    reportingParishes: latestSunday
      ? new Set(records.filter((r) => r.date === latestSunday).map((r) => r.parishId)).size
      : 0,
    activeParishes: active.length,
    averageAttendance: records.length ? Math.round(totalAttendance / records.length) : 0,
    totalReturns: records.length,
    growing: growth.filter((g) => (g.changePct ?? 0) > 0).length,
    declining: growth.filter((g) => (g.changePct ?? 0) < 0).length,
  }
}

/** Parishes that have not returned a figure for the given Sunday. */
export function missingReturns(
  records: AttendanceRecord[],
  parishes: Parish[],
  date: string,
): Parish[] {
  const reported = new Set(records.filter((r) => r.date === date).map((r) => r.parishId))
  return parishes.filter((p) => p.status === 'active' && !reported.has(p.id))
}

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}
