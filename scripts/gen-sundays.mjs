/**
 * Regenerates seed/sundays-2026-2029.csv and seed/attendance-template.csv.
 *
 *   npm run gen-sundays
 *
 * Keep the constants below in step with src/lib/sundays.ts and firestore.rules.
 */
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const SEASON_START = '2026-09-06'
const SEASON_END = '2029-12-30'
const DAY_MS = 86_400_000

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const parse = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
const toISO = (ms) => new Date(ms).toISOString().slice(0, 10)

const sundays = []
for (let t = parse(SEASON_START); t <= parse(SEASON_END); t += 7 * DAY_MS) sundays.push(toISO(t))

const serviceYear = (iso) => {
  const d = new Date(parse(iso))
  const y = d.getUTCFullYear()
  const start = d.getUTCMonth() >= 8 ? y : y - 1
  return `${start}/${String(start + 1).slice(2)}`
}

const rows = sundays.map((date, i) => {
  const year = serviceYear(date)
  const weekInYear = sundays.filter((d) => serviceYear(d) === year && d <= date).length
  return `${i + 1},${date},${year},${weekInYear}`
})

await writeFile(
  path.join(root, 'seed', 'sundays-2026-2029.csv'),
  '﻿week,date,serviceYear,weekInServiceYear\r\n' + rows.join('\r\n') + '\r\n',
  'utf8',
)

await writeFile(
  path.join(root, 'seed', 'attendance-template.csv'),
  '﻿parishName,date,attendance,note\r\n' +
    `KINGS PALACE,${sundays[0]},84,\r\n` +
    `EXCEL (YOUTH CHURCH),${sundays[0]},57,First Sunday of the exercise\r\n` +
    `KINGS PALACE,${sundays[1]},91,\r\n`,
  'utf8',
)

console.log(
  `Wrote ${sundays.length} Sundays (${sundays[0]} → ${sundays[sundays.length - 1]}) to seed/sundays-2026-2029.csv`,
)
console.log('Wrote seed/attendance-template.csv')
