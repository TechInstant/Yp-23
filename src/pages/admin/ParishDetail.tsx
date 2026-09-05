import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Alert, Spinner, StatTile, StatusBadge } from '../../components/ui'
import { parishSeries } from '../../lib/analytics'
import { useParishContacts } from '../../hooks/useParishContacts'
import { useParishes } from '../../hooks/useParishes'
import { AXIS_TICK, CHART, TOOLTIP_STYLE } from '../../lib/chartTheme'
import { downloadCsv, toCsv } from '../../lib/csv'
import { COLLECTIONS, db } from '../../lib/firebase'
import { whatsappNumber } from '../../lib/phone'
import { formatAxis, formatSundayLong } from '../../lib/sundays'
import type { AttendanceRecord } from '../../types'

export default function ParishDetail() {
  const { parishId = '' } = useParams()
  const navigate = useNavigate()
  const { parishes, loading: parishesLoading } = useParishes()
  const { phones, contacts } = useParishContacts()

  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const parish = parishes.find((p) => p.id === parishId) ?? null

  useEffect(() => {
    if (!parishId) return
    const q = query(
      collection(db, COLLECTIONS.attendance),
      where('parishId', '==', parishId),
      orderBy('date'),
    )
    return onSnapshot(
      q,
      (snap) => {
        setRecords(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AttendanceRecord))
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )
  }, [parishId])

  const series = useMemo(() => parishSeries(records), [records])

  const stats = useMemo(() => {
    if (records.length === 0) return null
    const values = records.map((r) => r.attendance)
    const total = values.reduce((s, v) => s + v, 0)
    const window = Math.max(1, Math.min(4, Math.floor(values.length / 2)))
    const opening = values.slice(0, window).reduce((s, v) => s + v, 0) / window
    const recent = values.slice(-window).reduce((s, v) => s + v, 0) / window
    const last = series[series.length - 1]
    return {
      returns: values.length,
      average: Math.round(total / values.length),
      best: Math.max(...values),
      lowest: Math.min(...values),
      latest: values[values.length - 1],
      openingAverage: Math.round(opening),
      recentAverage: Math.round(recent),
      lastChange: last?.change ?? null,
      lastChangePct: last?.changePct ?? null,
      changePct: values.length >= 2 && opening > 0 ? ((recent - opening) / opening) * 100 : null,
    }
  }, [records, series])

  if (parishesLoading || loading) return <Spinner label="Loading parish record…" />

  if (!parish) {
    return (
      <Alert tone="error" title="Parish not found">
        <Link to="/admin/parishes" className="font-medium underline">
          Back to the parish list
        </Link>
      </Alert>
    )
  }

  const pastorName = contacts[parish.id]?.pastorName || parish.pastorName

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/parishes" className="text-sm font-medium text-navy-600 hover:underline">
          ← All parishes
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-navy-900">{parish.name}</h1>
          <StatusBadge status={parish.status} />
        </div>
        <p className="mt-1 text-sm text-navy-600">
          {pastorName || <span className="italic text-navy-400">No pastor on record</span>}
        </p>
        {phones[parish.id] && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
            <a
              href={`tel:${phones[parish.id]}`}
              className="font-medium text-navy-800 hover:underline"
            >
              📞 {phones[parish.id]}
            </a>
            {whatsappNumber(phones[parish.id]) && (
              <a
                href={`https://wa.me/${whatsappNumber(phones[parish.id])}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                WhatsApp
              </a>
            )}
          </div>
        )}

        {/* Jump straight to another church rather than going back through the
            list — checking several in a row is the normal way this is used. */}
        <label className="mt-4 block max-w-md">
          <span className="label">Look at another church</span>
          <select
            className="input"
            value={parish.id}
            onChange={(e) => navigate(`/admin/parishes/${e.target.value}`)}
          >
            {[...parishes]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {!stats ? (
        <Alert tone="info" title="No returns yet">
          This parish has not submitted any Sunday attendance.
        </Alert>
      ) : (
        <>
          <Verdict
            changePct={stats.changePct}
            openingAverage={stats.openingAverage}
            recentAverage={stats.recentAverage}
            returns={stats.returns}
          />

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Latest Sunday"
              value={stats.latest.toLocaleString()}
              trend={stats.lastChangePct}
              hint={
                stats.lastChange === null
                  ? 'first return'
                  : `${stats.lastChange >= 0 ? '+' : ''}${stats.lastChange} vs the Sunday before`
              }
            />
            <StatTile
              label="Overall trend"
              value={
                stats.changePct === null
                  ? '—'
                  : `${stats.changePct > 0 ? '+' : ''}${stats.changePct.toFixed(1)}%`
              }
              trend={stats.changePct}
              hint={`${stats.openingAverage} → ${stats.recentAverage} average`}
            />
            <StatTile
              label="Average"
              value={stats.average.toLocaleString()}
              hint={`${stats.returns} returns`}
            />
            <StatTile
              label="Best / lowest"
              value={`${stats.best} / ${stats.lowest}`}
              hint="highest and lowest Sunday"
            />
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-navy-900">Attendance over time</h2>
            <p className="mt-1 text-sm text-navy-500">
              Solid line is each Sunday. The{' '}
              <span className="font-medium text-[#1B57A5]">blue dashed line</span> is the 4-week
              average — read that one for direction, since single Sundays bounce too much to
              judge by eye. The flat grey line is this church&apos;s overall average.
            </p>
            <div className="mt-6 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                  <CartesianGrid stroke={CHART.grid} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatAxis}
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={{ stroke: CHART.grid }}
                    minTickGap={24}
                  />
                  <YAxis
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    width={52}
                  />
                  <Tooltip
                    cursor={{ stroke: CHART.reference, strokeWidth: 1 }}
                    labelFormatter={(v) => formatSundayLong(String(v))}
                    formatter={(value: number, _n, item) => [
                      value.toLocaleString() +
                        (item?.payload?.note ? ` — ${item.payload.note}` : ''),
                      'In attendance',
                    ]}
                    contentStyle={TOOLTIP_STYLE}
                  />
                  <ReferenceLine y={stats.average} stroke={CHART.reference} strokeDasharray="4 4" />
                  <Line
                    type="monotone"
                    dataKey="attendance"
                    stroke={CHART.single}
                    strokeWidth={2}
                    dot={{ r: 4, fill: CHART.single, stroke: CHART.surface, strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                  {/* The smoothed line is the one to read for direction — week
                      to week bounces too much to judge growth by eye. */}
                  <Line
                    type="monotone"
                    dataKey="rollingAverage"
                    stroke={CHART.diverging.up}
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                    activeDot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-navy-100 px-5 py-4">
              <h2 className="text-lg font-semibold text-navy-900">Every return</h2>
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() =>
                  downloadCsv(
                    `${parish.name.toLowerCase().replace(/\W+/g, '-')}-attendance.csv`,
                    toCsv(
                      series.map((row) => ({
                        date: row.date,
                        attendance: row.attendance,
                        change: row.change ?? '',
                        changePct: row.changePct === null ? '' : row.changePct.toFixed(1),
                        rollingAverage: row.rollingAverage,
                        note: row.note,
                      })),
                      [
                        { key: 'date', header: 'Sunday' },
                        { key: 'attendance', header: 'Attendance' },
                        { key: 'change', header: 'Change' },
                        { key: 'changePct', header: 'Change %' },
                        { key: 'rollingAverage', header: '4-week average' },
                        { key: 'note', header: 'Note' },
                      ],
                    ),
                  )
                }
              >
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead className="bg-navy-50">
                  <tr>
                    <th className="th">Sunday</th>
                    <th className="th text-right">Attendance</th>
                    <th className="th text-right">Change</th>
                    <th className="th text-right">%</th>
                    <th className="th text-right">4-week avg</th>
                    <th className="th">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-50">
                  {[...series].reverse().map((row) => (
                    <tr key={row.date} className="hover:bg-navy-50/60">
                      <td className="td whitespace-nowrap">{formatSundayLong(row.date)}</td>
                      <td className="td text-right font-semibold tabular-nums">
                        {row.attendance.toLocaleString()}
                      </td>
                      <td
                        className={`td text-right tabular-nums ${
                          row.change === null
                            ? 'text-navy-400'
                            : row.change > 0
                              ? 'text-[#1B57A5]'
                              : row.change < 0
                                ? 'text-[#C0392B]'
                                : 'text-navy-500'
                        }`}
                      >
                        {row.change === null
                          ? '—'
                          : `${row.change > 0 ? '+' : ''}${row.change.toLocaleString()}`}
                      </td>
                      <td
                        className={`td text-right font-semibold tabular-nums ${
                          row.changePct === null
                            ? 'text-navy-400'
                            : row.changePct > 0
                              ? 'text-[#1B57A5]'
                              : row.changePct < 0
                                ? 'text-[#C0392B]'
                                : 'text-navy-500'
                        }`}
                      >
                        {row.changePct === null
                          ? '—'
                          : `${row.changePct > 0 ? '+' : ''}${row.changePct.toFixed(1)}%`}
                      </td>
                      <td className="td text-right tabular-nums text-navy-500">
                        {row.rollingAverage.toLocaleString()}
                      </td>
                      <td className="td text-navy-500">{row.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

/**
 * The plain-English answer to "is this church growing?".
 *
 * Judged on recent average against opening average, not latest Sunday against
 * first Sunday: one convention or one rainy week should not decide the verdict.
 * Anything inside ±3% is called steady, because a couple of percent on a
 * congregation of eighty is two people — noise, not a trend worth acting on.
 */
function Verdict({
  changePct,
  openingAverage,
  recentAverage,
  returns,
}: {
  changePct: number | null
  openingAverage: number
  recentAverage: number
  returns: number
}) {
  if (changePct === null || returns < 2) {
    return (
      <Alert tone="info" title="Not enough returns yet">
        A church needs at least two Sundays on record before a trend can be read.
      </Alert>
    )
  }

  const people = recentAverage - openingAverage
  const tone = changePct > 3 ? 'success' : changePct < -3 ? 'error' : 'warning'
  const headline =
    changePct > 3 ? 'Growing' : changePct < -3 ? 'Declining' : 'Holding steady'

  return (
    <Alert
      tone={tone}
      title={`${headline} — ${changePct > 0 ? '+' : ''}${changePct.toFixed(1)}%`}
    >
      Averaging <strong>{recentAverage.toLocaleString()}</strong> over its recent Sundays against{' '}
      <strong>{openingAverage.toLocaleString()}</strong> when it started reporting:{' '}
      {people === 0 ? (
        'no change in numbers'
      ) : (
        <>
          <strong>
            {people > 0 ? '+' : ''}
            {people.toLocaleString()}
          </strong>{' '}
          {Math.abs(people) === 1 ? 'person' : 'people'}
        </>
      )}{' '}
      across {returns} returns.
    </Alert>
  )
}
