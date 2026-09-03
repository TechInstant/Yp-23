import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, EmptyState, Spinner, StatTile } from '../../components/ui'
import { useAttendanceOnDates } from '../../hooks/useAttendanceOnDates'
import { useParishes } from '../../hooks/useParishes'
import { downloadCsv, toCsv } from '../../lib/csv'
import { allSundays, formatSundayLong, serviceYear, todayISO } from '../../lib/sundays'

type SortKey = 'change' | 'changePct' | 'name' | 'later'

interface Row {
  parishId: string
  parishName: string
  earlier: number | null
  later: number | null
  change: number | null
  changePct: number | null
  /** What can honestly be said about this church across the two Sundays. */
  status: 'both' | 'only-earlier' | 'only-later' | 'neither'
}

/**
 * Compares two Sundays side by side.
 *
 * The care here is in what counts as a comparison. A church that reported 80 on
 * one Sunday and filed nothing on the other has not collapsed to zero — it
 * simply did not report, and treating that as a 100% decline would put innocent
 * parishes at the top of a "worst decline" list and send someone chasing them.
 * Only churches that reported on *both* Sundays get a change figure; the rest
 * are counted and listed separately, which is itself worth knowing.
 */
export default function CompareSundays() {
  const { parishes, active, loading: parishesLoading } = useParishes()

  const sundays = useMemo(() => allSundays(), [])
  const today = todayISO()

  // Default to the two most recent Sundays that could have returns. Before the
  // exercise starts nothing is in the past, so fall back to the opening two —
  // otherwise the page opens empty and looks broken.
  const [defaultLater, defaultEarlier] = useMemo(() => {
    const past = sundays.filter((d) => d <= today)
    // Falling through to the tail of the whole list would open this page on
    // December 2029 — take the opening two Sundays instead.
    if (past.length < 2) return [sundays[1], sundays[0]]
    return [past[past.length - 1], past[past.length - 2]]
  }, [sundays, today])

  const [earlier, setEarlier] = useState(defaultEarlier)
  const [later, setLater] = useState(defaultLater)
  const [sortBy, setSortBy] = useState<SortKey>('change')

  const { records, loading, error } = useAttendanceOnDates([earlier, later])

  const byDate = useMemo(() => {
    const map = new Map<string, Map<string, number>>()
    for (const r of records) {
      const day = map.get(r.date) ?? new Map<string, number>()
      day.set(r.parishId, r.attendance)
      map.set(r.date, day)
    }
    return map
  }, [records])

  const rows = useMemo<Row[]>(() => {
    const a = byDate.get(earlier) ?? new Map()
    const b = byDate.get(later) ?? new Map()

    return active.map((p) => {
      const earlierValue = a.has(p.id) ? (a.get(p.id) as number) : null
      const laterValue = b.has(p.id) ? (b.get(p.id) as number) : null
      const both = earlierValue !== null && laterValue !== null

      return {
        parishId: p.id,
        parishName: p.name,
        earlier: earlierValue,
        later: laterValue,
        change: both ? laterValue - earlierValue : null,
        changePct:
          both && earlierValue > 0 ? ((laterValue - earlierValue) / earlierValue) * 100 : null,
        status: both
          ? 'both'
          : earlierValue !== null
            ? 'only-earlier'
            : laterValue !== null
              ? 'only-later'
              : 'neither',
      }
    })
  }, [active, byDate, earlier, later])

  const comparable = useMemo(() => rows.filter((r) => r.status === 'both'), [rows])

  const sorted = useMemo(() => {
    const list = [...comparable]
    switch (sortBy) {
      case 'name':
        return list.sort((a, b) => a.parishName.localeCompare(b.parishName))
      case 'later':
        return list.sort((a, b) => (b.later ?? 0) - (a.later ?? 0))
      case 'changePct':
        return list.sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))
      default:
        return list.sort((a, b) => (b.change ?? 0) - (a.change ?? 0))
    }
  }, [comparable, sortBy])

  const totals = useMemo(() => {
    const sum = (date: string) =>
      [...(byDate.get(date)?.values() ?? [])].reduce((s, v) => s + v, 0)
    const earlierTotal = sum(earlier)
    const laterTotal = sum(later)
    return {
      earlierTotal,
      laterTotal,
      change: laterTotal - earlierTotal,
      changePct: earlierTotal > 0 ? ((laterTotal - earlierTotal) / earlierTotal) * 100 : null,
      earlierCount: byDate.get(earlier)?.size ?? 0,
      laterCount: byDate.get(later)?.size ?? 0,
    }
  }, [byDate, earlier, later])

  const onlyEarlier = rows.filter((r) => r.status === 'only-earlier')
  const onlyLater = rows.filter((r) => r.status === 'only-later')
  const neither = rows.filter((r) => r.status === 'neither')

  function exportCsv() {
    downloadCsv(
      `yp23-compare-${earlier}-vs-${later}.csv`,
      toCsv(
        rows.map((r) => ({
          parish: r.parishName,
          earlier: r.earlier ?? '',
          later: r.later ?? '',
          change: r.change ?? '',
          changePct: r.changePct === null ? '' : r.changePct.toFixed(1),
          status:
            r.status === 'both'
              ? 'reported both'
              : r.status === 'only-earlier'
                ? `only ${earlier}`
                : r.status === 'only-later'
                  ? `only ${later}`
                  : 'reported neither',
        })),
        [
          { key: 'parish', header: 'Church' },
          { key: 'earlier', header: earlier },
          { key: 'later', header: later },
          { key: 'change', header: 'Change' },
          { key: 'changePct', header: 'Change %' },
          { key: 'status', header: 'Reporting' },
        ],
      ),
    )
  }

  if (parishesLoading) return <Spinner label="Loading churches…" />

  const sameDay = earlier === later

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Compare two Sundays</h1>
          <p className="mt-1 text-sm text-navy-600">
            Pick any two Sundays to see what each church did between them.
          </p>
        </div>
        <button type="button" className="btn-ghost btn-sm" onClick={exportCsv}>
          Export CSV
        </button>
      </header>

      <section className="card grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        <SundaySelect
          label="Earlier Sunday"
          value={earlier}
          onChange={setEarlier}
          sundays={sundays}
        />
        <SundaySelect label="Later Sunday" value={later} onChange={setLater} sundays={sundays} />
      </section>

      {sameDay && (
        <Alert tone="warning" title="Same Sunday chosen twice">
          Pick two different Sundays to see a comparison.
        </Alert>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      {loading ? (
        <Spinner label="Loading both Sundays…" />
      ) : totals.earlierCount === 0 && totals.laterCount === 0 ? (
        <EmptyState title="Neither Sunday has any returns">
          Nothing was filed on {formatSundayLong(earlier)} or {formatSundayLong(later)}.
        </EmptyState>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label={formatSundayLong(earlier)}
              value={totals.earlierTotal.toLocaleString()}
              hint={`${totals.earlierCount} of ${active.length} churches reported`}
            />
            <StatTile
              label={formatSundayLong(later)}
              value={totals.laterTotal.toLocaleString()}
              hint={`${totals.laterCount} of ${active.length} churches reported`}
            />
            <StatTile
              label="Difference"
              value={`${totals.change > 0 ? '+' : ''}${totals.change.toLocaleString()}`}
              trend={totals.changePct}
              hint="people, province-wide"
            />
            <StatTile
              label="Comparable churches"
              value={String(comparable.length)}
              hint="reported on both Sundays"
            />
          </section>

          {(onlyEarlier.length > 0 || onlyLater.length > 0) && (
            <Alert tone="warning" title="The province totals are not like for like">
              {onlyEarlier.length > 0 && (
                <p>
                  <strong>{onlyEarlier.length}</strong> church
                  {onlyEarlier.length === 1 ? '' : 'es'} reported on {formatSundayLong(earlier)} but
                  not on {formatSundayLong(later)}.
                </p>
              )}
              {onlyLater.length > 0 && (
                <p className={onlyEarlier.length > 0 ? 'mt-1' : ''}>
                  <strong>{onlyLater.length}</strong> church
                  {onlyLater.length === 1 ? '' : 'es'} reported on {formatSundayLong(later)} but not
                  on {formatSundayLong(earlier)}.
                </p>
              )}
              <p className="mt-2">
                A missing return is not an empty church, so those are left out of the table below
                rather than counted as a collapse to zero. The difference above will move with them.
              </p>
            </Alert>
          )}

          <section className="card p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold text-navy-900">
                Church by church ({comparable.length})
              </h2>
              <label className="text-sm text-navy-600">
                Sort by{' '}
                <select
                  className="rounded-lg border border-navy-200 bg-white px-2 py-1 text-sm"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortKey)}
                >
                  <option value="change">Biggest gain</option>
                  <option value="changePct">Biggest % gain</option>
                  <option value="later">Highest attendance</option>
                  <option value="name">Church name</option>
                </select>
              </label>
            </div>

            {comparable.length === 0 ? (
              <p className="py-10 text-center text-sm text-navy-500">
                No church reported on both Sundays, so nothing can be compared.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead className="border-b border-navy-100">
                    <tr>
                      <th className="th">Church</th>
                      <th className="th text-right">{formatSundayLong(earlier)}</th>
                      <th className="th text-right">{formatSundayLong(later)}</th>
                      <th className="th text-right">Change</th>
                      <th className="th text-right">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-50">
                    {sorted.map((r) => (
                      <tr key={r.parishId} className="hover:bg-navy-50/60">
                        <td className="td font-medium">
                          <Link
                            to={`/admin/parishes/${r.parishId}`}
                            className="hover:underline"
                          >
                            {r.parishName}
                          </Link>
                        </td>
                        <td className="td text-right tabular-nums">
                          {r.earlier?.toLocaleString()}
                        </td>
                        <td className="td text-right font-semibold tabular-nums">
                          {r.later?.toLocaleString()}
                        </td>
                        <td className={`td text-right tabular-nums ${tone(r.change)}`}>
                          {r.change === null
                            ? '—'
                            : `${r.change > 0 ? '+' : ''}${r.change.toLocaleString()}`}
                        </td>
                        <td className={`td text-right font-semibold tabular-nums ${tone(r.changePct)}`}>
                          {r.changePct === null
                            ? '—'
                            : `${r.changePct > 0 ? '+' : ''}${r.changePct.toFixed(1)}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {(onlyEarlier.length > 0 || onlyLater.length > 0 || neither.length > 0) && (
            <section className="card p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-navy-900">Not comparable</h2>
              <p className="mt-1 text-sm text-navy-500">
                These churches are missing at least one of the two Sundays.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <MissingList
                  title={`Only ${formatSundayLong(earlier)}`}
                  rows={onlyEarlier}
                  pick={(r) => r.earlier}
                />
                <MissingList
                  title={`Only ${formatSundayLong(later)}`}
                  rows={onlyLater}
                  pick={(r) => r.later}
                />
                <MissingList title="Neither Sunday" rows={neither} pick={() => null} />
              </div>
            </section>
          )}
        </>
      )}

      <p className="text-xs text-navy-500">
        Showing {active.length} active churches of {parishes.length} in the directory.
      </p>
    </div>
  )
}

function tone(value: number | null): string {
  if (value === null) return 'text-navy-400'
  if (value > 0) return 'text-[#1B57A5]'
  if (value < 0) return 'text-[#C0392B]'
  return 'text-navy-500'
}

function SundaySelect({
  label,
  value,
  onChange,
  sundays,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  sundays: string[]
}) {
  // Grouped by service year so a list of 174 Sundays stays navigable.
  const groups = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const d of sundays) {
      const y = serviceYear(d)
      const list = map.get(y)
      if (list) list.push(d)
      else map.set(y, [d])
    }
    return [...map.entries()]
  }, [sundays])

  return (
    <label className="block">
      <span className="label">{label}</span>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {groups.map(([year, dates]) => (
          <optgroup key={year} label={`Service year ${year}`}>
            {dates.map((d) => (
              <option key={d} value={d}>
                {formatSundayLong(d)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}

function MissingList({
  title,
  rows,
  pick,
}: {
  title: string
  rows: Row[]
  pick: (r: Row) => number | null
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-navy-500">
        {title} ({rows.length})
      </p>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-navy-400">None</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {rows.map((r) => (
            <li key={r.parishId} className="flex justify-between gap-2 text-sm">
              <Link
                to={`/admin/parishes/${r.parishId}`}
                className="truncate text-navy-800 hover:underline"
              >
                {r.parishName}
              </Link>
              {pick(r) !== null && (
                <span className="tabular-nums text-navy-500">{pick(r)?.toLocaleString()}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
