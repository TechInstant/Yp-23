import { useEffect, useMemo, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
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
import { Spinner } from './ui'
import { useIsNarrow } from '../hooks/useIsNarrow'
import { parishSeries } from '../lib/analytics'
import { AXIS_TICK, CHART, TOOLTIP_STYLE } from '../lib/chartTheme'
import { COLLECTIONS, db } from '../lib/firebase'
import { formatAxis, formatSundayLong } from '../lib/sundays'
import type { AttendanceRecord, Parish } from '../types'

/** Remembered so a pastor does not re-pick their parish every Sunday. */
const STORAGE_KEY = 'yp23:myParish'

/**
 * A parish's own trend, on the public page.
 *
 * The province-wide growth ranking stays on the admin dashboard — who is
 * bottom of the league is not something to publish. This is the other half of
 * that: a pastor seeing their own line, which is the part that actually helps
 * them. Attendance is already public, so this exposes nothing new; it just
 * saves them working it out from the numbers themselves.
 *
 * Scoped to the last 26 returns, which keeps reads small on the free plan and
 * is more history than anyone reads off a phone.
 */
export default function ParishTrend({ parishes }: { parishes: Parish[] }) {
  const narrow = useIsNarrow()
  const [parishId, setParishId] = useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(false)

  const options = useMemo(
    () => [...parishes].sort((a, b) => a.name.localeCompare(b.name)),
    [parishes],
  )

  // A remembered parish that has since been archived would sit there loading
  // nothing, so drop the selection if it is no longer in the list.
  useEffect(() => {
    if (parishId && parishes.length > 0 && !parishes.some((p) => p.id === parishId)) {
      setParishId('')
    }
  }, [parishId, parishes])

  useEffect(() => {
    if (!parishId) {
      setRecords([])
      return
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, parishId)
    } catch {
      /* private browsing can refuse storage; the picker still works */
    }

    setLoading(true)
    const q = query(
      collection(db, COLLECTIONS.attendance),
      where('parishId', '==', parishId),
      orderBy('date', 'desc'),
      limit(26),
    )
    return onSnapshot(
      q,
      (snap) => {
        setRecords(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AttendanceRecord))
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [parishId])

  const series = useMemo(() => parishSeries(records), [records])

  const summary = useMemo(() => {
    if (series.length === 0) return null
    const values = series.map((s) => s.attendance)
    const window = Math.max(1, Math.min(4, Math.floor(values.length / 2)))
    const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length
    const opening = mean(values.slice(0, window))
    const recent = mean(values.slice(-window))
    return {
      returns: values.length,
      latest: values[values.length - 1],
      average: Math.round(mean(values)),
      best: Math.max(...values),
      opening: Math.round(opening),
      recent: Math.round(recent),
      changePct: values.length >= 2 && opening > 0 ? ((recent - opening) / opening) * 100 : null,
    }
  }, [series])

  const parish = parishes.find((p) => p.id === parishId)

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-navy-900">How is your parish doing?</h2>
      <p className="mt-1 text-sm text-navy-600">
        Pick your parish to see your own Sundays. Nobody else&apos;s figures are shown here.
      </p>

      <label className="mt-4 block max-w-md">
        <span className="label">Your parish</span>
        <select
          className="input"
          value={parishId}
          onChange={(e) => setParishId(e.target.value)}
        >
          <option value="">Select your parish…</option>
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      {!parishId ? null : loading ? (
        <Spinner label="Loading your Sundays…" />
      ) : !summary ? (
        <p className="mt-5 rounded-lg bg-navy-50 px-4 py-6 text-center text-sm text-navy-500">
          {parish?.name} has not submitted any attendance yet. Your trend appears here once you
          have filed a couple of Sundays.
        </p>
      ) : (
        <>
          <div className="mt-5">
            <Verdict changePct={summary.changePct} opening={summary.opening} recent={summary.recent} />
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Latest Sunday" value={summary.latest.toLocaleString()} />
            <Stat label="Your average" value={summary.average.toLocaleString()} />
            <Stat label="Your best" value={summary.best.toLocaleString()} />
            <Stat label="Returns filed" value={String(summary.returns)} />
          </dl>

          <div className="mt-5 h-60 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={series}
                margin={{ top: 4, right: 8, bottom: 0, left: narrow ? 0 : -10 }}
              >
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
                  width={narrow ? 36 : 52}
                />
                <Tooltip
                  cursor={{ stroke: CHART.reference, strokeWidth: 1 }}
                  labelFormatter={(v) => formatSundayLong(String(v))}
                  formatter={(value: number) => [value.toLocaleString(), 'In attendance']}
                  contentStyle={TOOLTIP_STYLE}
                />
                <ReferenceLine y={summary.average} stroke={CHART.reference} strokeDasharray="4 4" />
                <Line
                  type="monotone"
                  dataKey="attendance"
                  stroke={CHART.single}
                  strokeWidth={2}
                  dot={{ r: 3, fill: CHART.single, stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
                {/* The smoothed line is the one to judge direction by — single
                    Sundays bounce too much to read a trend from. */}
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

          <p className="mt-3 text-xs text-navy-500">
            Solid line is each Sunday; the dashed blue line is your 4-week average, which is what
            to read for direction. The flat grey line is your overall average.
          </p>
        </>
      )}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-navy-100 px-3 py-2.5">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-navy-500">{label}</dt>
      <dd className="mt-0.5 text-xl font-bold tabular-nums text-navy-900">{value}</dd>
    </div>
  )
}

/**
 * Judged on recent average against opening average, not latest against first:
 * one convention or one rainy Sunday should not decide it. Anything inside ±3%
 * is called steady, because two percent of eighty people is noise.
 */
function Verdict({
  changePct,
  opening,
  recent,
}: {
  changePct: number | null
  opening: number
  recent: number
}) {
  if (changePct === null) {
    return (
      <p className="rounded-lg border border-navy-100 bg-navy-50 px-4 py-3 text-sm text-navy-700">
        File one more Sunday and your trend will show here.
      </p>
    )
  }

  const growing = changePct > 3
  const declining = changePct < -3
  const tone = growing
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
    : declining
      ? 'border-red-200 bg-red-50 text-red-900'
      : 'border-gold-200 bg-gold-50 text-gold-900'

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${tone}`}>
      <p className="font-semibold">
        {growing ? 'Growing' : declining ? 'Declining' : 'Holding steady'} —{' '}
        {changePct > 0 ? '+' : ''}
        {changePct.toFixed(1)}%
      </p>
      <p className="mt-1">
        Averaging <strong>{recent.toLocaleString()}</strong> over your recent Sundays, against{' '}
        <strong>{opening.toLocaleString()}</strong> when you started reporting.
      </p>
    </div>
  )
}
