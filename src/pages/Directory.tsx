import { useMemo, useState } from 'react'
import { Spinner, StatusBadge } from '../components/ui'
import { useParishes } from '../hooks/useParishes'

/**
 * Public directory: a plain alphabetical list of parishes and who is in charge.
 * No phone numbers — those live in the admin-only `parishContacts` collection.
 */
export default function Directory() {
  const { parishes, loading } = useParishes()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return parishes
      .filter((p) => {
        if (!needle) return true
        return `${p.name} ${p.pastorName}`.toLowerCase().includes(needle)
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [parishes, search])

  const claimed = parishes.filter((p) => p.pastorName.trim()).length

  if (loading) return <Spinner label="Loading the directory…" />

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">Parish directory</h1>
        <p className="mt-2 text-navy-600">
          {parishes.length} parishes in Youth Province 23 · {claimed} with a pastor on record.
        </p>
      </header>

      <input
        className="input sm:max-w-sm"
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search parish or pastor…"
      />

      {filtered.length === 0 ? (
        <p className="card px-6 py-12 text-center text-navy-500">
          No parish matches “{search}”.
        </p>
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-navy-100">
            {filtered.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4">
                <div className="min-w-[200px] flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-navy-900">
                    {p.name}
                    {p.status !== 'active' && <StatusBadge status={p.status} />}
                  </p>
                  <p className="mt-0.5 text-sm text-navy-600">
                    {p.pastorName || (
                      <span className="italic text-navy-400">No pastor on record yet</span>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
