import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, EmptyState, Spinner, StatTile } from '../../components/ui'
import { useAttendance } from '../../hooks/useAttendance'
import { useParishContacts } from '../../hooks/useParishContacts'
import { useParishes } from '../../hooks/useParishes'
import { downloadCsv, toCsv } from '../../lib/csv'
import { currentReportingSunday, formatSunday, formatSundayLong, resolveRange } from '../../lib/sundays'

/**
 * The contact sheet: who to ring, and who needs ringing.
 *
 * Sorted so the parishes that have not reported for the current Sunday come
 * first — the point of the page is chasing missing returns, not admiring a
 * complete list.
 */

/** 07024444000 -> 2347024444000, which is what wa.me expects. */
function whatsappNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('234') && digits.length >= 13) return digits
  if (digits.startsWith('0') && digits.length === 11) return '234' + digits.slice(1)
  if (digits.length === 10) return '234' + digits
  return null
}

export default function Pastors() {
  const { parishes, active, loading } = useParishes()
  const { phones, contacts, loading: contactsLoading } = useParishContacts()

  const sunday = currentReportingSunday()
  const range = useMemo(() => resolveRange('last8'), [])
  const { records } = useAttendance(range)

  const [search, setSearch] = useState('')
  const [onlyMissing, setOnlyMissing] = useState(false)

  const reportedThisSunday = useMemo(
    () => new Set(records.filter((r) => r.date === sunday).map((r) => r.parishId)),
    [records, sunday],
  )

  const rows = useMemo(() => {
    const lastSeen = new Map<string, string>()
    for (const r of records) {
      const prev = lastSeen.get(r.parishId)
      if (!prev || r.date > prev) lastSeen.set(r.parishId, r.date)
    }

    return active
      .map((p) => ({
        parish: p,
        phone: phones[p.id] ?? '',
        // The name a pastor typed most recently beats whatever the directory
        // holds — people move on, and the contact card is refreshed weekly.
        pastorName: contacts[p.id]?.pastorName || p.pastorName || '',
        reported: reportedThisSunday.has(p.id),
        lastSeen: lastSeen.get(p.id) ?? null,
      }))
      .filter((row) => {
        if (onlyMissing && row.reported) return false
        const needle = search.trim().toLowerCase()
        if (!needle) return true
        return `${row.parish.name} ${row.pastorName} ${row.phone}`.toLowerCase().includes(needle)
      })
      .sort((a, b) => {
        // Missing returns first, then parishes with no number at all, then A–Z.
        if (a.reported !== b.reported) return a.reported ? 1 : -1
        if (Boolean(a.phone) !== Boolean(b.phone)) return a.phone ? 1 : -1
        return a.parish.name.localeCompare(b.parish.name)
      })
  }, [active, phones, contacts, reportedThisSunday, records, onlyMissing, search])

  const withPhone = active.filter((p) => (phones[p.id] ?? '').length > 0).length
  const missing = active.filter((p) => !reportedThisSunday.has(p.id)).length

  function exportContacts() {
    downloadCsv(
      `yp23-pastor-contacts-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        rows.map((r) => ({
          parish: r.parish.name,
          pastor: r.pastorName,
          phone: r.phone,
          reportedThisSunday: r.reported ? 'yes' : 'no',
          lastReported: r.lastSeen ?? '',
        })),
        [
          { key: 'parish', header: 'Parish' },
          { key: 'pastor', header: 'Pastor' },
          { key: 'phone', header: 'Phone' },
          { key: 'reportedThisSunday', header: 'Reported this Sunday' },
          { key: 'lastReported', header: 'Last reported' },
        ],
      ),
    )
  }

  if (loading || contactsLoading) return <Spinner label="Loading contacts…" />

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Pastors &amp; contacts</h1>
          <p className="mt-1 text-sm text-navy-600">Reach out about {formatSundayLong(sunday)}</p>
        </div>
        <button type="button" className="btn-ghost btn-sm" onClick={exportContacts}>
          Export contacts CSV
        </button>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Yet to report"
          value={String(missing)}
          hint={`of ${active.length} active parishes`}
        />
        <StatTile
          label="Numbers on file"
          value={`${withPhone}/${active.length}`}
          hint="collected from returns and confirmations"
        />
        <StatTile label="Parishes" value={String(parishes.length)} hint="including pending" />
      </section>

      {withPhone === 0 && (
        <Alert tone="info" title="No phone numbers yet">
          Numbers arrive as pastors confirm their parish or submit a return. You can also type them
          in under{' '}
          <Link to="/admin/parishes" className="font-medium underline">
            Parishes
          </Link>
          .
        </Alert>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          className="input sm:max-w-sm"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search parish, pastor or number…"
        />
        <label className="flex items-center gap-2 text-sm font-medium text-navy-700">
          <input
            type="checkbox"
            className="h-4 w-4 shrink-0 rounded border-navy-300"
            checked={onlyMissing}
            onChange={(e) => setOnlyMissing(e.target.checked)}
          />
          Only those yet to report
        </label>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Nobody matches those filters">
          {onlyMissing ? 'Every parish has reported for this Sunday.' : 'Try clearing the search.'}
        </EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => {
            const wa = row.phone ? whatsappNumber(row.phone) : null
            return (
              <li key={row.parish.id} className="card flex flex-col gap-3 p-4">
                <div className="min-w-0">
                  <Link
                    to={`/admin/parishes/${row.parish.id}`}
                    className="block truncate font-semibold text-navy-900 hover:underline"
                    title={row.parish.name}
                  >
                    {row.parish.name}
                  </Link>
                  <p className="mt-0.5 truncate text-sm text-navy-600">
                    {row.pastorName || (
                      <span className="italic text-navy-400">No pastor on record</span>
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`badge ${
                      row.reported ? 'bg-emerald-100 text-emerald-800' : 'bg-gold-100 text-gold-800'
                    }`}
                  >
                    {row.reported ? 'Reported' : 'Not yet'}
                  </span>
                  <span className="text-xs text-navy-500">
                    {row.lastSeen ? `last ${formatSunday(row.lastSeen)}` : 'never reported'}
                  </span>
                </div>

                {row.phone ? (
                  <div className="flex flex-wrap gap-2 border-t border-navy-100 pt-3">
                    <a href={`tel:${row.phone}`} className="btn-ghost btn-sm">
                      Call {row.phone}
                    </a>
                    {wa && (
                      <a
                        href={`https://wa.me/${wa}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-ghost btn-sm"
                      >
                        WhatsApp
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="border-t border-navy-100 pt-3 text-xs italic text-navy-400">
                    No number on file
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
