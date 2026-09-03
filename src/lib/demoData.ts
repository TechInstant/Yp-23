import { allSundays } from './sundays'

/**
 * Believable attendance figures for previewing the dashboard before any real
 * returns exist.
 *
 * The point is to judge the charts, so the numbers have to behave like a real
 * congregation rather than random noise: each parish has its own size and its
 * own slow trend, most weeks wobble a little, a few Sundays spike for a
 * convention or harvest, and some parishes simply fail to report. Uniform
 * random numbers would make every chart look identical and flat, which would
 * tell you nothing about whether the growth reading works.
 *
 * Seeded so the same parish list always produces the same preview — comparing
 * two runs of the dashboard is meaningless if the data moves underneath you.
 */

/** Deterministic PRNG (mulberry32) — no dependency, stable across runs. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export interface DemoRow {
  parishId: string
  parishName: string
  date: string
  attendance: number
  note: string
}

export interface DemoOptions {
  /** How many Sundays from the start of the exercise to fill. */
  weeks: number
  /** Chance a parish misses a given Sunday, 0-1. */
  missRate?: number
}

export function generateDemoAttendance(
  parishes: { id: string; name: string }[],
  { weeks, missRate = 0.08 }: DemoOptions,
): DemoRow[] {
  const sundays = allSundays().slice(0, Math.max(1, weeks))
  const rows: DemoRow[] = []

  for (const parish of parishes) {
    const random = rng(hash(parish.id))

    // Congregation sizes are heavily skewed: many small parishes, a few large
    // ones. Squaring a uniform draw gives that shape, where a flat range would
    // make every parish suspiciously similar.
    const base = Math.round(18 + random() ** 2 * 210)

    // Per-week drift, roughly -0.6% to +1.4%. Most parishes grow slowly, some
    // shrink — otherwise the growth chart has nothing to distinguish.
    const trend = -0.006 + random() * 0.02

    for (let week = 0; week < sundays.length; week++) {
      if (random() < missRate) continue // no return filed that Sunday

      const drift = Math.pow(1 + trend, week)
      const wobble = 0.88 + random() * 0.24
      let value = base * drift * wobble
      let note = ''

      // The occasional big Sunday, the kind that would wrongly flip a parish
      // from growing to shrinking under a naive first-vs-last comparison.
      if (random() < 0.04) {
        value *= 1.35 + random() * 0.5
        note = 'Special service'
      }

      rows.push({
        parishId: parish.id,
        parishName: parish.name,
        date: sundays[week],
        attendance: Math.max(1, Math.round(value)),
        note,
      })
    }
  }

  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.parishName.localeCompare(b.parishName))
}
