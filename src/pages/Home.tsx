import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BrandMark } from '../components/Logo'
import { useAuth } from '../context/AuthContext'
import { Spinner } from '../components/ui'
import { useAttendance } from '../hooks/useAttendance'
import { useParishes } from '../hooks/useParishes'
import { totalsBySunday } from '../lib/analytics'
import { AXIS_TICK, CHART, TOOLTIP_STYLE } from '../lib/chartTheme'
import {
  currentReportingSunday,
  formatAxis,
  formatSundayLong,
  hasStarted,
  resolveRange,
  SEASON_START,
} from '../lib/sundays'

/**
 * The public page. It reports the Sunday facts and nothing else: how many came,
 * and which parishes have uploaded. No location or zone breakdown, and no
 * growth analysis — growth is read on the admin dashboard, where the people who
 * act on it can see it in context.
 */
export default function Home() {
  const { user, isAdmin, role, loading: authLoading } = useAuth()
  const { active, loading } = useParishes()
  const range = useMemo(() => resolveRange('last8'), [])
  const { records } = useAttendance(range)

  const series = useMemo(() => totalsBySunday(records, range), [records, range])
  const thisSunday = currentReportingSunday()
  const started = hasStarted()

  const uploaded = useMemo(
    () =>
      records
        .filter((r) => r.date === thisSunday)
        .sort((a, b) => a.parishName.localeCompare(b.parishName)),
    [records, thisSunday],
  )

  const uploadedIds = useMemo(() => new Set(uploaded.map((r) => r.parishId)), [uploaded])
  const outstanding = useMemo(
    () => active.filter((p) => !uploadedIds.has(p.id)).sort((a, b) => a.name.localeCompare(b.name)),
    [active, uploadedIds],
  )

  const sundayTotal = uploaded.reduce((sum, r) => sum + r.attendance, 0)

  return (
    <div className="space-y-10">
      {!authLoading && user && isAdmin && (
        <div className="card flex flex-col gap-3 border-navy-200 bg-navy-900 p-4 text-white sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0">
            <p className="font-semibold">
              Signed in as {role === 'super' ? 'super admin' : 'admin'}
            </p>
            <p className="mt-0.5 truncate text-sm text-navy-200">{user.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/dashboard" className="btn-gold btn-sm">
              Dashboard
            </Link>
            <Link to="/admin/parishes" className="btn-ghost btn-sm">
              Parishes
            </Link>
            <Link to="/admin/attendance" className="btn-ghost btn-sm">
              Attendance
            </Link>
          </div>
        </div>
      )}

      <section className="card overflow-hidden">
        <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-600">
              The Redeemed Christian Church of God
            </p>
            <h1 className="mt-2 text-3xl font-bold leading-tight text-navy-900 sm:text-4xl">
              Youth Province 23 Weekly Attendance Report
            </h1>
            <p className="mt-4 max-w-xl text-navy-600">
              Every parish in each location must submit their Sunday attendance, starting from{' '}
              <strong>{formatSundayLong(SEASON_START)}</strong>.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/submit" className="btn-primary">
                Submit this Sunday&apos;s attendance
              </Link>
              <Link to="/register" className="btn-ghost">
                Confirm your parish
              </Link>
            </div>

            <p className="mt-4 text-sm text-navy-500">
              {started ? 'Current reporting Sunday: ' : 'Returns open on '}
              <strong className="text-navy-800">{formatSundayLong(thisSunday)}</strong>
            </p>
          </div>

          <div className="flex flex-col items-center gap-6 rounded-xl bg-navy-900 p-8 text-center">
            <BrandMark height={120} onDark className="w-full max-w-[280px]" />
            <div className="grid w-full grid-cols-2 gap-4">
              <Figure
                value={loading ? '—' : `${uploaded.length}/${active.length}`}
                label="Uploaded"
              />
              <Figure
                value={loading ? '—' : sundayTotal.toLocaleString()}
                label="In attendance"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <StepCard
          n="1"
          title="Find your parish"
          body="Pick your parish from the list. If it is not there yet, confirm or register it once and it appears from then on."
        />
        <StepCard
          n="2"
          title="Enter one figure"
          body="Your name, your number, the Sunday, and the total present. One return per parish per Sunday, so you cannot be double-counted."
        />
        <StepCard
          n="3"
          title="Check you are counted"
          body="Your parish appears in the uploaded list below as soon as the return is saved."
        />
      </section>

      <section className="card p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-navy-900">
            Uploaded for {formatSundayLong(thisSunday)}
          </h2>
          <span className="text-sm text-navy-500">
            {uploaded.length} of {active.length} parishes
          </span>
        </div>

        {loading ? (
          <Spinner />
        ) : uploaded.length === 0 ? (
          <p className="mt-6 rounded-lg bg-navy-50 px-4 py-6 text-center text-sm text-navy-500">
            {started
              ? 'No parish has uploaded for this Sunday yet.'
              : `Returns open on ${formatSundayLong(SEASON_START)}.`}
          </p>
        ) : (
          <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {uploaded.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-sm"
              >
                <span className="truncate font-medium text-navy-800" title={r.parishName}>
                  {r.parishName}
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-emerald-700">
                  {r.attendance.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}

        {!loading && outstanding.length > 0 && (
          <details className="mt-5 rounded-lg border border-navy-100 px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-navy-700">
              {outstanding.length} parish{outstanding.length === 1 ? '' : 'es'} yet to upload
            </summary>
            <ul className="mt-3 flex flex-wrap gap-2">
              {outstanding.map((p) => (
                <li
                  key={p.id}
                  className="rounded-full bg-navy-50 px-3 py-1 text-xs font-medium text-navy-600"
                >
                  {p.name}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="card p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-navy-900">
            Province-wide attendance, last 8 Sundays
          </h2>
          <span className="text-sm text-navy-500">Total submitted each Sunday</span>
        </div>

        {loading ? (
          <Spinner />
        ) : (
          <div className="mt-6 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatAxis}
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={{ stroke: CHART.grid }}
                  minTickGap={20}
                />
                <YAxis
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={52}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(64, 85, 160, 0.08)' }}
                  labelFormatter={(v) => formatSundayLong(String(v))}
                  formatter={(value: number, _n, item) => [
                    `${value.toLocaleString()} from ${item?.payload?.reporting ?? 0} parishes`,
                    'In attendance',
                  ]}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Bar
                  dataKey="total"
                  fill={CHART.single}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={44}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <p className="mt-4 text-sm text-navy-500">
          A short bar means returns are still coming in, not that fewer people came.
        </p>
      </section>
    </div>
  )
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-2xl font-bold tabular-nums text-white">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-navy-300">
        {label}
      </p>
    </div>
  )
}

function StepCard({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="card p-6">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-100 text-sm font-bold text-gold-700">
        {n}
      </span>
      <h3 className="mt-4 font-semibold text-navy-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-navy-600">{body}</p>
    </div>
  )
}
