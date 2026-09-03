import { useMemo, useState } from 'react'
import { LocationBadge, Spinner, StatusBadge } from '../components/ui'
import { useParishes } from '../hooks/useParishes'
import { LOCATIONS, LOCATION_LABEL, type LocationCode } from '../types'

/**
 * Public directory. Deliberately shows no phone numbers — those live in the
 * admin-only `parishContacts` collection.
 */
export default function Directory() {
  const { parishes, loading } = useParishes()
  const [search, setSearch] = useState('')
  const [location, setLocation] = useState<LocationCode | ''>('')

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return parishes.filter((p) => {
      if (location && p.location !== location) return false
      if (!needle) return true
      return [p.name, p.pastorName, p.zone, p.area]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
  }, [parishes, search, location])

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>()
    for (const p of filtered) {
      const key = `${p.location} — ${p.zone || 'Unassigned zone'}`
      const list = map.get(key)
      if (list) list.push(p)
      else map.set(key, [p])
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered])

  if (loading) return <Spinner label="Loading the directory…" />

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">Parish directory</h1>
        <p className="mt-2 text-navy-600">
          {parishes.length} parishes across the Ife and Ede locations of Youth Province 23.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          className="input sm:max-w-sm"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search parish, pastor, zone or address…"
        />
        <select
          className="input sm:max-w-[200px]"
          value={location}
          onChange={(e) => setLocation(e.target.value as LocationCode | '')}
        >
          <option value="">Both locations</option>
          {LOCATIONS.map((f) => (
            <option key={f} value={f}>
              {LOCATION_LABEL[f]}
            </option>
          ))}
        </select>
      </div>

      {grouped.length === 0 ? (
        <p className="card px-6 py-12 text-center text-navy-500">
          No parish matches “{search}”.
        </p>
      ) : (
        grouped.map(([group, list]) => (
          <section key={group} className="card overflow-hidden">
            <h2 className="border-b border-navy-100 bg-navy-50 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-navy-700">
              {group}
              <span className="ml-2 font-normal normal-case tracking-normal text-navy-500">
                ({list.length})
              </span>
            </h2>
            <ul className="divide-y divide-navy-100">
              {list.map((p) => (
                <li key={p.id} className="flex flex-wrap gap-x-6 gap-y-1 px-5 py-4">
                  <div className="min-w-[220px] flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-navy-900">
                      {p.name}
                      <LocationBadge location={p.location} />
                      {p.status !== 'active' && <StatusBadge status={p.status} />}
                    </p>
                    <p className="mt-0.5 text-sm text-navy-600">{p.pastorName}</p>
                  </div>
                  <div className="text-sm text-navy-500 sm:text-right">
                    <p>{p.area || '—'}</p>
                    <p className="mt-0.5">
                      {p.ordinationStatus}
                      {p.yearOfOrdination ? ` · ${p.yearOfOrdination}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
