import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Alert, Spinner, StatTile } from '../../components/ui'
import { useAttendance } from '../../hooks/useAttendance'
import { useParishes } from '../../hooks/useParishes'
import {
  headline,
  missingReturns,
  parishGrowth,
  totalsByRemittance,
  totalsBySunday,
  withRollingAverage,
  type ParishGrowth,
} from '../../lib/analytics'
import { AXIS_TICK, CHART, TOOLTIP_STYLE } from '../../lib/chartTheme'
import { downloadCsv, toCsv } from '../../lib/csv'
import { closedPeriods, formatPeriodRange, remittancePeriods } from '../../lib/remittance'
import {
  formatAxis,
  formatSunday,
  formatSundayLong,
  RANGE_PRESETS,
  resolveRange,
  type RangePresetKey,
} from '../../lib/sundays'

type View = 'sundays' | 'remittance'

export default function Dashboard() {
  const [view, setView] = useState<View>('sundays')
  const [preset, setPreset] = useState<RangePresetKey>('last26')
  const range = useMemo(() => resolveRange(preset), [preset])

  const { parishes, active, loading: parishesLoading } = useParishes()
  const { records, loading: recordsLoading, error } = useAttendance(range)

  const series = useMemo(
    () => withRollingAverage(totalsBySunday(records, range)),
    [records, range],
  )
  const growth = useMemo(() => parishGrowth(records, active), [records, active])
  const stats = useMemo(() => headline(records, parishes, growth), [records, parishes, growth])

  // Remittance is collated across whole periods, so it is scoped to the
  // periods that have closed rather than the Sunday range picker.
  const { records: allRecords } = useAttendance(
    useMemo(() => {
      const periods = remittancePeriods()
      return periods.length
        ? { from: periods[0].opensOn, to: periods[periods.length - 1].closesOn }
        : null
    }, []),
  )

  const remittance = useMemo(() => {
    const closed = closedPeriods()
    if (closed.length === 0) return []
    return totalsByRemittance(allRecords, closed)
  }, [allRecords])

  const ranked = useMemo(
    () =>
      growth
        .filter((g) => g.changePct !== null && g.returns >= 2)
        .sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0)),
    [growth],
  )

  const leaderboard = useMemo(() => {
    // Both ends, not just the winners: the province needs to see who is slipping.
    if (ranked.length <= 14) return ranked
    return [...ranked.slice(0, 7), ...ranked.slice(-7)]
  }, [ranked])

  const outstanding = useMemo(
    () => (stats.latestSunday ? missingReturns(records, parishes, stats.latestSunday) : []),
    [records, parishes, stats.latestSunday],
  )

  const loading = parishesLoading || recordsLoading

  function exportGrowth() {
    downloadCsv(
      `yp23-growth-${range.from}-to-${range.to}.csv`,
      toCsv(
        ranked.map((g) => ({
          parish: g.parishName,
          returns: g.returns,
          first: g.first,
          latest: g.latest,
          baselineAverage: g.baseline.toFixed(1),
          recentAverage: g.recent.toFixed(1),
          changePct: g.changePct === null ? '' : g.changePct.toFixed(1),
          best: g.best,
          lastReported: g.lastReported ?? '',
        })),
        [
          { key: 'parish', header: 'Parish' },
          { key: 'returns', header: 'Returns' },
          { key: 'first', header: 'First figure' },
          { key: 'latest', header: 'Latest figure' },
          { key: 'baselineAverage', header: 'Opening average' },
          { key: 'recentAverage', header: 'Recent average' },
          { key: 'changePct', header: 'Change %' },
          { key: 'best', header: 'Best Sunday' },
          { key: 'lastReported', header: 'Last reported' },
        ],
      ),
    )
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Provincial dashboard</h1>
          <p className="mt-1 text-sm text-navy-600">
            {formatSunday(range.from)} – {formatSunday(range.to)} · {records.length} returns from{' '}
            {active.length} active parishes
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-navy-200 bg-white p-1">
            {(
              [
                ['sundays', 'By Sunday'],
                ['remittance', 'By remittance'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  view === key ? 'bg-navy-900 text-white' : 'text-navy-600 hover:bg-navy-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {view === 'sundays' && (
            <div className="flex rounded-lg border border-navy-200 bg-white p-1">
              {RANGE_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPreset(p.key)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    preset === p.key ? 'bg-navy-900 text-white' : 'text-navy-600 hover:bg-navy-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
          <button type="button" className="btn-ghost btn-sm" onClick={exportGrowth}>
            Export growth CSV
          </button>
        </div>
      </header>

      {error && (
        <Alert tone="error" title="Could not load attendance">
          {error}
        </Alert>
      )}

      {loading ? (
        <Spinner label="Crunching the returns…" />
      ) : records.length === 0 ? (
        <Alert tone="info" title="No returns in this range yet">
          Once parishes start submitting on{' '}
          <Link to="/submit" className="font-medium underline">
            the attendance form
          </Link>
          , the charts fill in automatically.
        </Alert>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Latest Sunday total"
              value={stats.latestTotal.toLocaleString()}
              trend={stats.weekOnWeekPct}
              hint={
                stats.latestSunday
                  ? `vs ${formatSunday(stats.latestSunday)} week before`
                  : undefined
              }
            />
            <StatTile
              label="Parishes reporting"
              value={`${stats.reportingParishes}/${stats.activeParishes}`}
              hint={
                stats.latestSunday
                  ? `on ${formatSunday(stats.latestSunday)}`
                  : 'no Sunday reported yet'
              }
            />
            <StatTile
              label="Average per return"
              value={stats.averageAttendance.toLocaleString()}
              hint={`${stats.totalReturns} returns in range`}
            />
            <StatTile
              label="Growing vs declining"
              value={`${stats.growing} / ${stats.declining}`}
              hint="parishes, recent average vs opening average"
            />
          </section>

          {view === 'sundays' ? (
            <>
              <section className="card p-5 sm:p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-semibold text-navy-900">
                    Province-wide attendance
                  </h2>
                  <p className="text-sm text-navy-500">
                    Bars are each Sunday; the line is the 4-Sunday average
                  </p>
                </div>
                <div className="mt-6 h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={series}
                      margin={{ top: 4, right: 8, bottom: 0, left: -8 }}
                    >
                      <defs>
                        <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART.single} stopOpacity={0.4} />
                          <stop offset="100%" stopColor={CHART.single} stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
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
                        width={56}
                      />
                      <Tooltip
                        cursor={{ stroke: CHART.reference, strokeWidth: 1 }}
                        labelFormatter={(v) => formatSundayLong(String(v))}
                        formatter={(value: number, name: string) => [
                          value === null ? '—' : value.toLocaleString(),
                          name === 'rollingAverage' ? '4-Sunday average' : 'In attendance',
                        ]}
                        contentStyle={TOOLTIP_STYLE}
                      />
                      <Legend
                        verticalAlign="top"
                        align="left"
                        height={32}
                        iconType="circle"
                        iconSize={9}
                        formatter={(value: string) => (
                          <span className="text-sm text-navy-700">
                            {value === 'rollingAverage' ? '4-Sunday average' : 'In attendance'}
                          </span>
                        )}
                      />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke={CHART.single}
                        strokeWidth={2}
                        fill="url(#fillTotal)"
                      />
                      <Line
                        type="monotone"
                        dataKey="rollingAverage"
                        stroke={CHART.diverging.up}
                        strokeWidth={2.5}
                        strokeDasharray="6 3"
                        dot={false}
                        activeDot={{ r: 5 }}
                        connectNulls
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-4 text-sm text-navy-500">
                  The average line is the growth reading: when it climbs the province is genuinely
                  growing, where a single Sunday&apos;s spike or dip is usually weather or a
                  convention. Sundays with no returns are skipped, not counted as zero.
                </p>
              </section>

              <section className="card p-5 sm:p-6">
                <h2 className="text-lg font-semibold text-navy-900">
                  Returns received each Sunday
                </h2>
                <p className="mt-1 text-sm text-navy-500">
                  Dashed line is the {stats.activeParishes} active parishes — bars short of it are
                  missing returns, not empty churches.
                </p>
                <div className="mt-6 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
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
                        domain={[0, stats.activeParishes]}
                        width={44}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(64, 85, 160, 0.08)' }}
                        labelFormatter={(v) => formatSundayLong(String(v))}
                        formatter={(value: number) => [
                          `${value} of ${stats.activeParishes}`,
                          'Parishes reporting',
                        ]}
                        contentStyle={TOOLTIP_STYLE}
                      />
                      <ReferenceLine
                        y={stats.activeParishes}
                        stroke={CHART.reference}
                        strokeDasharray="4 4"
                      />
                      <Bar
                        dataKey="reporting"
                        fill={CHART.single}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={26}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </>
          ) : (
            <RemittanceSection rows={remittance} />
          )}

          <section className="card p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold text-navy-900">Growth by parish</h2>
              <p className="text-sm text-navy-500">
                Recent average vs opening average, within the selected range
              </p>
            </div>

            {leaderboard.length === 0 ? (
              <p className="py-10 text-center text-sm text-navy-500">
                A parish needs at least two returns before a trend can be drawn.
              </p>
            ) : (
              <>
                <div className="mt-6" style={{ height: Math.max(220, leaderboard.length * 30) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={leaderboard}
                      layout="vertical"
                      margin={{ top: 4, right: 48, bottom: 0, left: 8 }}
                    >
                      <CartesianGrid stroke={CHART.grid} horizontal={false} />
                      <XAxis
                        type="number"
                        tick={AXIS_TICK}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v}%`}
                      />
                      <YAxis
                        type="category"
                        dataKey="parishName"
                        tick={{ ...AXIS_TICK, fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={170}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(64, 85, 160, 0.08)' }}
                        formatter={(value: number, _n, item) => [
                          `${value > 0 ? '+' : ''}${value.toFixed(1)}% — ${Math.round(
                            item?.payload?.baseline ?? 0,
                          )} → ${Math.round(item?.payload?.recent ?? 0)} average`,
                          'Change',
                        ]}
                        contentStyle={TOOLTIP_STYLE}
                      />
                      <ReferenceLine x={0} stroke={CHART.axis} strokeWidth={1} />
                      <Bar
                        dataKey="changePct"
                        radius={4}
                        maxBarSize={18}
                        label={{
                          position: 'right',
                          fill: '#233268',
                          fontSize: 11,
                          formatter: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`,
                        }}
                      >
                        {leaderboard.map((g) => (
                          <Cell
                            key={g.parishId}
                            fill={
                              (g.changePct ?? 0) >= 0 ? CHART.diverging.up : CHART.diverging.down
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {ranked.length > leaderboard.length && (
                  <p className="mt-2 text-xs text-navy-500">
                    Showing the 7 fastest-growing and 7 most-declining of {ranked.length}{' '}
                    parishes. The table below and the CSV export have them all.
                  </p>
                )}

                <GrowthTable rows={ranked} />
              </>
            )}
          </section>

          {stats.latestSunday && (
            <section className="card p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-navy-900">
                Outstanding returns — {formatSundayLong(stats.latestSunday)}
              </h2>
              {outstanding.length === 0 ? (
                <p className="mt-3 text-sm text-emerald-700">
                  Every active parish has reported. Full house.
                </p>
              ) : (
                <>
                  <p className="mt-1 text-sm text-navy-500">
                    {outstanding.length} parish{outstanding.length === 1 ? '' : 'es'} yet to
                    submit.
                  </p>
                  <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {outstanding.map((p) => (
                      <li
                        key={p.id}
                        className="truncate rounded-lg border border-navy-100 px-3 py-2 text-sm"
                      >
                        <Link
                          to={`/admin/parishes/${p.id}`}
                          className="font-medium text-navy-800 hover:underline"
                          title={p.name}
                        >
                          {p.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/admin/pastors"
                    className="btn-ghost btn-sm mt-4 inline-flex"
                  >
                    Chase them by phone →
                  </Link>
                </>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Remittance view: each period is the last Sunday of the previous month plus
 * this month's Sundays except the last, plotted against the period before it.
 */
function RemittanceSection({
  rows,
}: {
  rows: ReturnType<typeof totalsByRemittance>
}) {
  const periods = remittancePeriods()

  if (rows.length === 0) {
    return (
      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-navy-900">Remittance</h2>
        <p className="mt-3 text-sm text-navy-500">
          No remittance period has closed yet. The first one runs{' '}
          {periods.length > 0 ? formatPeriodRange(periods[0]) : '—'} and appears here once its
          last Sunday has passed.
        </p>
      </section>
    )
  }

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-navy-900">Remittance by month</h2>
        <p className="text-sm text-navy-500">
          Last Sunday of the previous month + this month&apos;s Sundays bar the last
        </p>
      </div>

      <div className="mt-6 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis
              dataKey="shortLabel"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: CHART.grid }}
              minTickGap={12}
            />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={56}
            />
            <Tooltip
              formatter={(value: number, name: string, item) =>
                name === 'perSunday'
                  ? [value.toLocaleString(), 'Average per Sunday']
                  : [
                      `${value.toLocaleString()} across ${item?.payload?.sundays ?? 0} Sundays`,
                      'Remittance total',
                    ]
              }
              labelFormatter={(_l, payload) => payload?.[0]?.payload?.label ?? ''}
              contentStyle={TOOLTIP_STYLE}
            />
            <Legend
              verticalAlign="top"
              align="left"
              height={32}
              iconType="circle"
              iconSize={9}
              formatter={(value: string) => (
                <span className="text-sm text-navy-700">
                  {value === 'perSunday' ? 'Average per Sunday' : 'Remittance total'}
                </span>
              )}
            />
            <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={40}>
              {rows.map((r) => (
                <Cell
                  key={r.key}
                  // A clipped period is not comparable with a full one, so it is
                  // drawn muted rather than silently read as a collapse.
                  fill={r.partial ? CHART.reference : CHART.single}
                />
              ))}
            </Bar>
            <Line
              type="monotone"
              dataKey="perSunday"
              stroke={CHART.diverging.up}
              strokeWidth={2.5}
              dot={{ r: 3 }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-4 text-sm text-navy-500">
        A five-Sunday period out-totals a four-Sunday one without anyone growing, so the line —
        average per Sunday — is the fair comparison. Muted bars are periods the tracking window
        clips.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[620px]">
          <thead className="border-b border-navy-100">
            <tr>
              <th className="th">Remittance</th>
              <th className="th">Period</th>
              <th className="th text-right">Sundays</th>
              <th className="th text-right">Returns</th>
              <th className="th text-right">Total</th>
              <th className="th text-right">Avg / Sunday</th>
              <th className="th text-right">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-50">
            {[...rows].reverse().map((r) => {
              const period = periods.find((p) => p.key === r.key)
              return (
                <tr key={r.key} className="hover:bg-navy-50/60">
                  <td className="td font-medium">
                    {r.label}
                    {r.partial && (
                      <span className="ml-2 text-xs italic text-navy-400">part period</span>
                    )}
                  </td>
                  <td className="td text-navy-500">{period ? formatPeriodRange(period) : '—'}</td>
                  <td className="td text-right tabular-nums">{r.sundays}</td>
                  <td className="td text-right tabular-nums">{r.returns}</td>
                  <td className="td text-right font-semibold tabular-nums">
                    {r.total.toLocaleString()}
                  </td>
                  <td className="td text-right tabular-nums">{r.perSunday.toLocaleString()}</td>
                  <td
                    className={`td text-right font-semibold tabular-nums ${
                      r.changePct === null
                        ? 'text-navy-400'
                        : r.changePct >= 0
                          ? 'text-[#1B57A5]'
                          : 'text-[#C0392B]'
                    }`}
                  >
                    {r.changePct === null
                      ? '—'
                      : `${r.changePct > 0 ? '+' : ''}${r.changePct.toFixed(1)}%`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** The table view the charts are obliged to have — same numbers, no colour needed. */
function GrowthTable({ rows }: { rows: ParishGrowth[] }) {
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[640px]">
        <thead className="border-b border-navy-100">
          <tr>
            <th className="th">Parish</th>
            <th className="th text-right">Returns</th>
            <th className="th text-right">Opening avg</th>
            <th className="th text-right">Recent avg</th>
            <th className="th text-right">Change</th>
            <th className="th text-right">Best</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-50">
          {rows.map((g) => (
            <tr key={g.parishId} className="hover:bg-navy-50/60">
              <td className="td font-medium">
                <Link to={`/admin/parishes/${g.parishId}`} className="hover:underline">
                  {g.parishName}
                </Link>
              </td>
              <td className="td text-right tabular-nums">{g.returns}</td>
              <td className="td text-right tabular-nums">{Math.round(g.baseline)}</td>
              <td className="td text-right tabular-nums">{Math.round(g.recent)}</td>
              <td
                className={`td text-right font-semibold tabular-nums ${
                  (g.changePct ?? 0) >= 0 ? 'text-[#1B57A5]' : 'text-[#C0392B]'
                }`}
              >
                {g.changePct === null
                  ? '—'
                  : `${g.changePct > 0 ? '+' : ''}${g.changePct.toFixed(1)}%`}
              </td>
              <td className="td text-right tabular-nums">{g.best}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
