import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
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
import { useParishContacts } from '../../hooks/useParishContacts'
import { useParishes } from '../../hooks/useParishes'
import { AXIS_TICK, CHART, TOOLTIP_STYLE } from '../../lib/chartTheme'
import { downloadCsv, toCsv } from '../../lib/csv'
import { COLLECTIONS, db } from '../../lib/firebase'
import { formatAxis, formatSundayLong } from '../../lib/sundays'
import type { AttendanceRecord } from '../../types'

export default function ParishDetail() {
  const { parishId = '' } = useParams()
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

  const stats = useMemo(() => {
    if (records.length === 0) return null
    const values = records.map((r) => r.attendance)
    const total = values.reduce((s, v) => s + v, 0)
    const window = Math.max(1, Math.min(4, Math.floor(values.length / 2)))
    const opening = values.slice(0, window).reduce((s, v) => s + v, 0) / window
    const recent = values.slice(-window).reduce((s, v) => s + v, 0) / window
    return {
      returns: values.length,
      average: Math.round(total / values.length),
      best: Math.max(...values),
      lowest: Math.min(...values),
      latest: values[values.length - 1],
      changePct: values.length >= 2 && opening > 0 ? ((recent - opening) / opening) * 100 : null,
    }
  }, [records])

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
          <p className="mt-1 text-sm">
            <a
              href={`tel:${phones[parish.id]}`}
              className="font-medium text-navy-800 hover:underline"
            >
              {phones[parish.id]}
            </a>
          </p>
        )}
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {!stats ? (
        <Alert tone="info" title="No returns yet">
          This parish has not submitted any Sunday attendance.
        </Alert>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Latest figure"
              value={stats.latest.toLocaleString()}
              trend={stats.changePct}
              hint="recent average vs opening average"
            />
            <StatTile
              label="Average"
              value={stats.average.toLocaleString()}
              hint={`${stats.returns} returns`}
            />
            <StatTile label="Best Sunday" value={stats.best.toLocaleString()} />
            <StatTile label="Lowest Sunday" value={stats.lowest.toLocaleString()} />
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-navy-900">Attendance over time</h2>
            <p className="mt-1 text-sm text-navy-500">
              Dashed line is this parish&apos;s own average across every return.
            </p>
            <div className="mt-6 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={records} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
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
                    toCsv(records, [
                      { key: 'date', header: 'Sunday' },
                      { key: 'attendance', header: 'Attendance' },
                      { key: 'pastorName', header: 'Filed by' },
                      { key: 'note', header: 'Note' },
                    ]),
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
                    <th className="th">Filed by</th>
                    <th className="th">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-50">
                  {[...records].reverse().map((r) => (
                    <tr key={r.id}>
                      <td className="td whitespace-nowrap">{formatSundayLong(r.date)}</td>
                      <td className="td text-right font-semibold tabular-nums">
                        {r.attendance.toLocaleString()}
                      </td>
                      <td className="td text-navy-600">{r.pastorName || '—'}</td>
                      <td className="td text-navy-500">{r.note || '—'}</td>
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
