import type { AttendanceRecord, Family, Parish } from '../types'
import { allSundays, type DateRange } from './sundays'

export interface PointTotals {
  date: string
  total: number
  IFE: number
  EDE: number
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
export function totalsBySunday(
  records: AttendanceRecord[],
  range: DateRange,
): PointTotals[] {
  const buckets = new Map<string, PointTotals>()
  for (const date of allSundays()) {
    if (date >= range.from && date <= range.to) {
      buckets.set(date, { date, total: 0, IFE: 0, EDE: 0, reporting: 0 })
    }
  }
  for (const r of records) {
    const b = buckets.get(r.date)
    if (!b) continue
    b.total += r.attendance
    b[r.family] += r.attendance
    b.reporting += 1
  }
  return [...buckets.values()]
}

export interface ParishGrowth {
  parishId: string
  parishName: string
  family: Family
  zone: string
  area: string
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
      family: parish.family,
      zone: parish.zone,
      area: parish.area,
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

export interface GroupTotals {
  name: string
  total: number
  average: number
  parishes: number
  returns: number
}

export function groupBy(
  records: AttendanceRecord[],
  key: 'zone' | 'area' | 'family',
): GroupTotals[] {
  const map = new Map<string, { total: number; returns: number; parishes: Set<string> }>()
  for (const r of records) {
    const name = r[key] || 'Unassigned'
    const entry = map.get(name) ?? { total: 0, returns: 0, parishes: new Set<string>() }
    entry.total += r.attendance
    entry.returns += 1
    entry.parishes.add(r.parishId)
    map.set(name, entry)
  }
  return [...map.entries()]
    .map(([name, v]) => ({
      name,
      total: v.total,
      average: v.returns ? Math.round(v.total / v.returns) : 0,
      parishes: v.parishes.size,
      returns: v.returns,
    }))
    .sort((a, b) => b.total - a.total)
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
