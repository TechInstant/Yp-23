import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BrandMark } from '../components/Logo'
import { Spinner } from '../components/ui'
import { useAttendance } from '../hooks/useAttendance'
import { useParishes } from '../hooks/useParishes'
import { totalsBySunday } from '../lib/analytics'
import {
  currentReportingSunday,
  formatAxis,
  formatSundayLong,
  resolveRange,
  SEASON_END,
  SEASON_START,
  allSundays,
} from '../lib/sundays'

export default function Home() {
  const { parishes, active, loading } = useParishes()
  const range = useMemo(() => resolveRange('last8'), [])
  const { records } = useAttendance(range)

  const series = useMemo(() => totalsBySunday(records, range), [records, range])
  const thisSunday = currentReportingSunday()
  const totalSundays = allSundays().length

  const families = useMemo(() => {
    const counts = { IFE: 0, EDE: 0 }
    for (const p of active) counts[p.family] += 1
    return counts
  }, [active])

  return (
    <div className="space-y-10">
      <section className="card overflow-hidden">
        <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-600">
              The Redeemed Christian Church of God
            </p>
            <h1 className="mt-2 text-3xl font-bold leading-tight text-navy-900 sm:text-4xl">
              Youth Province 23 weekly attendance returns
            </h1>
            <p className="mt-4 max-w-xl text-navy-600">
              Every parish in the Ife and Ede families submits one figure each Sunday. The
              province keeps a single running record from{' '}
              <strong>{formatSundayLong(SEASON_START)}</strong> to{' '}
              <strong>{formatSundayLong(SEASON_END)}</strong> — {totalSundays} Sundays — so
              growth can be seen for what it is, parish by parish.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/submit" className="btn-primary">
                Submit this Sunday&apos;s attendance
              </Link>
              <Link to="/register" className="btn-ghost">
                Claim your parish
              </Link>
            </div>

            <p className="mt-4 text-sm text-navy-500">
              Current reporting Sunday:{' '}
              <strong className="text-navy-800">{formatSundayLong(thisSunday)}</strong>
            </p>
          </div>

          <div className="flex flex-col items-center gap-6 rounded-xl bg-navy-900 p-8 text-center">
            <BrandMark height={120} onDark className="w-full max-w-[280px]" />
            <div className="grid w-full grid-cols-3 gap-4">
              <Figure value={loading ? '—' : String(parishes.length)} label="Parishes" />
              <Figure value={loading ? '—' : String(families.IFE)} label="Ife family" />
              <Figure value={loading ? '—' : String(families.EDE)} label="Ede family" />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <StepCard
          n="1"
          title="Claim your parish, once"
          body="Find it by family, zone and area, then put your name and phone number on record. A parish the directory has not caught up with yet can be added from the same form."
        />
        <StepCard
          n="2"
          title="Enter one figure"
          body="Total number in the Sunday service. One return per parish per Sunday, so a second submission cannot quietly double-count you."
        />
        <StepCard
          n="3"
          title="Watch the line move"
          body="The province sees every parish's trend, which zones are growing, and who has not reported yet."
        />
      </section>

      <section className="card p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-navy-900">
            Province-wide attendance, last 8 Sundays
          </h2>
          <span className="text-sm text-navy-500">Ife &amp; Ede families combined</span>
        </div>

        {loading ? (
          <Spinner />
        ) : (
          <div className="mt-6 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                <defs>
                  <linearGradient id="homeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2E3F81" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#2E3F81" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#E2E7F5" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatAxis}
                  tick={{ fontSize: 12, fill: '#4055A0' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E2E7F5' }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#4055A0' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  labelFormatter={(v) => formatSundayLong(String(v))}
                  formatter={(v: number) => [v.toLocaleString(), 'In attendance']}
                  contentStyle={{
                    borderRadius: 10,
                    border: '1px solid #E2E7F5',
                    fontSize: 13,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#16225A"
                  strokeWidth={2.5}
                  fill="url(#homeFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        <p className="mt-4 text-sm text-navy-500">
          A flat stretch usually means returns are missing, not that nobody came. Admins can see
          exactly which parishes are outstanding on the dashboard.
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
