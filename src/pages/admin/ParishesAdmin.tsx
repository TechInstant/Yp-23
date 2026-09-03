import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import {
  Alert,
  EmptyState,
  LocationBadge,
  Field,
  Modal,
  Spinner,
  StatusBadge,
} from '../../components/ui'
import {
  areasFor,
  DIRECTORY_COUNT,
  flattenDirectory,
  zonesFor,
} from '../../data/provinceStructure'
import { useParishContacts } from '../../hooks/useParishContacts'
import { useParishes } from '../../hooks/useParishes'
import { downloadCsv, parseCsv, toCsv } from '../../lib/csv'
import { COLLECTIONS, db } from '../../lib/firebase'
import {
  LOCATIONS,
  LOCATION_LABEL,
  ORDINATION_STATUSES,
  type LocationCode,
  type Parish,
  type ParishStatus,
} from '../../types'

interface Draft {
  name: string
  pastorName: string
  phone: string
  location: LocationCode
  zone: string
  area: string
  ordinationStatus: string
  yearOfOrdination: string
  lengthOfService: string
  status: ParishStatus
}

const BLANK: Draft = {
  name: '',
  pastorName: '',
  phone: '',
  location: 'IFE',
  zone: '',
  area: '',
  ordinationStatus: 'UNKNOWN',
  yearOfOrdination: '',
  lengthOfService: '',
  status: 'active',
}

function toDraft(parish: Parish, phone: string): Draft {
  return {
    name: parish.name,
    pastorName: parish.pastorName,
    phone,
    location: parish.location,
    zone: parish.zone ?? '',
    area: parish.area ?? '',
    ordinationStatus: parish.ordinationStatus || 'UNKNOWN',
    yearOfOrdination: parish.yearOfOrdination ? String(parish.yearOfOrdination) : '',
    lengthOfService: parish.lengthOfService ?? '',
    status: parish.status,
  }
}

export default function ParishesAdmin() {
  const { parishes, zonesByLocation, areasByZone, loading } = useParishes()
  const { phones, refresh: refreshPhones } = useParishContacts()

  const [search, setSearch] = useState('')
  const [location, setLocation] = useState<LocationCode | ''>('')
  const [status, setStatus] = useState<ParishStatus | ''>('')

  const [editing, setEditing] = useState<Parish | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft>(BLANK)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const [importReport, setImportReport] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const pendingCount = parishes.filter((p) => p.status === 'pending').length

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return parishes.filter((p) => {
      if (location && p.location !== location) return false
      if (status && p.status !== status) return false
      if (!needle) return true
      return [p.name, p.pastorName, p.zone, p.area, phones[p.id] ?? '']
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
  }, [parishes, search, location, status, phones])

  function openCreate() {
    setDraft(BLANK)
    setCreating(true)
    setEditing(null)
    setMessage(null)
  }

  function openEdit(parish: Parish) {
    setDraft(toDraft(parish, phones[parish.id] ?? ''))
    setEditing(parish)
    setCreating(false)
    setMessage(null)
  }

  function closeModal() {
    setCreating(false)
    setEditing(null)
  }

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    if (draft.name.trim().length < 2 || draft.pastorName.trim().length < 2) {
      setMessage({ tone: 'error', text: 'Parish name and pastor name are both required.' })
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: draft.name.trim(),
        pastorName: draft.pastorName.trim(),
        location: draft.location,
        zone: draft.zone.trim(),
        area: draft.area.trim(),
        ordinationStatus: draft.ordinationStatus,
        yearOfOrdination: draft.yearOfOrdination ? Number(draft.yearOfOrdination) : null,
        lengthOfService: draft.lengthOfService.trim(),
        status: draft.status,
        updatedAt: serverTimestamp(),
      }

      let parishId: string
      if (editing) {
        await updateDoc(doc(db, COLLECTIONS.parishes, editing.id), payload)
        parishId = editing.id
      } else {
        const created = await addDoc(collection(db, COLLECTIONS.parishes), {
          ...payload,
          source: 'admin',
          createdAt: serverTimestamp(),
        })
        parishId = created.id
      }

      const phone = draft.phone.replace(/[^\d+]/g, '')
      // Skip the contact document entirely for a new parish with no number —
      // an empty one is just noise the admin would have to clean up later.
      if (phone || editing) {
        await setDoc(
          doc(db, COLLECTIONS.parishContacts, parishId),
          {
            phone,
            updatedAt: serverTimestamp(),
            ...(editing ? {} : { createdAt: serverTimestamp() }),
          },
          { merge: true },
        )
      }

      await refreshPhones()
      setMessage({
        tone: 'success',
        text: `${payload.name} ${editing ? 'updated' : 'added'}.`,
      })
      closeModal()
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setSaving(false)
    }
  }

  async function approve(parish: Parish) {
    await updateDoc(doc(db, COLLECTIONS.parishes, parish.id), {
      status: 'active',
      updatedAt: serverTimestamp(),
    })
    setMessage({ tone: 'success', text: `${parish.name} approved and now selectable.` })
  }

  async function archive(parish: Parish) {
    await updateDoc(doc(db, COLLECTIONS.parishes, parish.id), {
      status: parish.status === 'archived' ? 'active' : 'archived',
      updatedAt: serverTimestamp(),
    })
  }

  async function remove(parish: Parish) {
    // Deleting the parish leaves its attendance history orphaned, so say so
    // plainly before doing it. Archiving is almost always the right answer.
    const ok = window.confirm(
      `Delete ${parish.name} permanently?\n\nIts attendance records stay in the database but will no longer be linked to a parish. Archive it instead if you only want it off the submission form.`,
    )
    if (!ok) return
    await deleteDoc(doc(db, COLLECTIONS.parishes, parish.id))
    try {
      await deleteDoc(doc(db, COLLECTIONS.parishContacts, parish.id))
    } catch {
      /* contact may not exist */
    }
    await refreshPhones()
    setMessage({ tone: 'success', text: `${parish.name} deleted.` })
  }

  /**
   * Creates every parish in the published province directory that is not
   * already present, matched by name. Pastor and phone are left blank on
   * purpose — the pastor in charge fills those in from the public form, which
   * is the only place their personal details are ever entered.
   */
  async function loadDirectory() {
    const known = new Set(parishes.map((p) => p.name.trim().toUpperCase()))
    const missing = flattenDirectory().filter((p) => !known.has(p.name.toUpperCase()))

    if (missing.length === 0) {
      setMessage({
        tone: 'success',
        text: `All ${DIRECTORY_COUNT} parishes in the province directory are already here.`,
      })
      return
    }

    if (
      !window.confirm(
        `Add ${missing.length} parish${missing.length === 1 ? '' : 'es'} from the province directory?\n\n` +
          'They are created with their zone and area but no pastor and no phone number — ' +
          'each pastor fills those in themselves from the "Claim your parish" form.',
      )
    )
      return

    setSaving(true)
    try {
      for (let i = 0; i < missing.length; i += 400) {
        const batch = writeBatch(db)
        for (const p of missing.slice(i, i + 400)) {
          batch.set(doc(collection(db, COLLECTIONS.parishes)), {
            name: p.name,
            pastorName: '',
            location: p.location,
            zone: p.zone,
            area: p.area,
            category: p.category,
            ordinationStatus: 'UNKNOWN',
            yearOfOrdination: null,
            lengthOfService: '',
            // Unassigned parishes stay pending until the province places them.
            status: p.zone ? 'active' : 'pending',
            source: 'directory-import',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        }
        await batch.commit()
      }
      setMessage({
        tone: 'success',
        text: `Added ${missing.length} parish${missing.length === 1 ? '' : 'es'} from the province directory. Pastors can now claim them.`,
      })
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setSaving(false)
    }
  }

  function exportCsv() {
    downloadCsv(
      `yp23-parish-directory-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        parishes.map((p) => ({
          name: p.name,
          pastorName: p.pastorName,
          phone: phones[p.id] ?? '',
          location: p.location,
          zone: p.zone ?? '',
          area: p.area ?? '',
          ordinationStatus: p.ordinationStatus ?? '',
          yearOfOrdination: p.yearOfOrdination ?? '',
          lengthOfService: p.lengthOfService ?? '',
          status: p.status,
        })),
        [
          { key: 'name', header: 'name' },
          { key: 'pastorName', header: 'pastorName' },
          { key: 'phone', header: 'phone' },
          { key: 'location', header: 'location' },
          { key: 'zone', header: 'zone' },
          { key: 'area', header: 'area' },
          { key: 'ordinationStatus', header: 'ordinationStatus' },
          { key: 'yearOfOrdination', header: 'yearOfOrdination' },
          { key: 'lengthOfService', header: 'lengthOfService' },
          { key: 'status', header: 'status' },
        ],
      ),
    )
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setImportReport(null)

    try {
      const rows = parseCsv(await file.text())
      const known = new Set(parishes.map((p) => p.name.trim().toUpperCase()))
      const toAdd = rows.filter(
        (r) => r.name?.trim() && !known.has(r.name.trim().toUpperCase()),
      )
      const skipped = rows.length - toAdd.length

      if (toAdd.length === 0) {
        setImportReport(`Nothing to import — all ${rows.length} rows already exist by name.`)
        return
      }

      // Two writes per parish (record + contact) and a 500-op batch limit, so
      // chunk at 200 parishes.
      for (let i = 0; i < toAdd.length; i += 200) {
        const batch = writeBatch(db)
        for (const row of toAdd.slice(i, i + 200)) {
          const ref = doc(collection(db, COLLECTIONS.parishes))
          batch.set(ref, {
            name: row.name.trim(),
            pastorName: (row.pastorName ?? '').trim() || 'TO BE ASSIGNED',
            location: row.location?.trim().toUpperCase() === 'EDE' ? 'EDE' : 'IFE',
            zone: (row.zone ?? '').trim(),
            area: (row.area ?? '').trim(),
            ordinationStatus: (row.ordinationStatus ?? '').trim() || 'UNKNOWN',
            yearOfOrdination: row.yearOfOrdination ? Number(row.yearOfOrdination) : null,
            lengthOfService: (row.lengthOfService ?? '').trim(),
            status: row.status?.trim() === 'pending' ? 'pending' : 'active',
            source: 'admin',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
          if (row.phone?.trim()) {
            batch.set(doc(db, COLLECTIONS.parishContacts, ref.id), {
              phone: row.phone.replace(/[^\d+]/g, ''),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          }
        }
        await batch.commit()
      }

      await refreshPhones()
      setImportReport(
        `Imported ${toAdd.length} parish${toAdd.length === 1 ? '' : 'es'}.` +
          (skipped ? ` Skipped ${skipped} already in the directory.` : ''),
      )
    } catch (err) {
      setImportReport(`Import failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  if (loading) return <Spinner label="Loading parishes…" />

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Parishes</h1>
          <p className="mt-1 text-sm text-navy-600">
            {parishes.length} in the directory
            {pendingCount > 0 && (
              <>
                {' · '}
                <button
                  type="button"
                  className="font-semibold text-gold-700 underline"
                  onClick={() => setStatus('pending')}
                >
                  {pendingCount} awaiting approval
                </button>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {parishes.length < DIRECTORY_COUNT && (
            <button
              type="button"
              className="btn-gold btn-sm"
              onClick={() => void loadDirectory()}
              disabled={saving}
            >
              Load province directory
            </button>
          )}
          <button type="button" className="btn-ghost btn-sm" onClick={exportCsv}>
            Export CSV
          </button>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => fileInput.current?.click()}
          >
            Import CSV
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleImport}
          />
          <button type="button" className="btn-primary btn-sm" onClick={openCreate}>
            + Add parish
          </button>
        </div>
      </header>

      {message && (
        <Alert tone={message.tone}>{message.text}</Alert>
      )}
      {importReport && <Alert tone="info">{importReport}</Alert>}

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          className="input sm:max-w-sm"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search parish, pastor, phone, zone…"
        />
        <select
          className="input sm:max-w-[180px]"
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
        <select
          className="input sm:max-w-[180px]"
          value={status}
          onChange={(e) => setStatus(e.target.value as ParishStatus | '')}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending approval</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No parish matches those filters">
          Clear the search, or add the parish if it is genuinely missing.
        </EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="border-b border-navy-100 bg-navy-50">
              <tr>
                <th className="th">Parish</th>
                <th className="th">Pastor</th>
                <th className="th">Phone</th>
                <th className="th">Zone / Area</th>
                <th className="th">Status</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-navy-50/60">
                  <td className="td">
                    <Link
                      to={`/admin/parishes/${p.id}`}
                      className="font-medium text-navy-900 hover:underline"
                    >
                      {p.name}
                    </Link>
                    <div className="mt-1 flex items-center gap-2">
                      <LocationBadge location={p.location} />
                    </div>
                  </td>
                  <td className="td">
                    {p.pastorName}
                    <div className="text-xs text-navy-500">
                      {p.ordinationStatus}
                      {p.yearOfOrdination ? ` · ${p.yearOfOrdination}` : ''}
                    </div>
                  </td>
                  <td className="td whitespace-nowrap">
                    {phones[p.id] ? (
                      <a href={`tel:${phones[p.id]}`} className="text-navy-800 hover:underline">
                        {phones[p.id]}
                      </a>
                    ) : (
                      <span className="text-navy-300">—</span>
                    )}
                  </td>
                  <td className="td text-navy-600">
                    <div>{p.zone || '—'}</div>
                    <div className="text-xs text-navy-500">{p.area || '—'}</div>
                  </td>
                  <td className="td">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="td">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {p.status === 'pending' && (
                        <button
                          type="button"
                          className="btn-gold btn-sm"
                          onClick={() => void approve(p)}
                        >
                          Approve
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        onClick={() => openEdit(p)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        onClick={() => void archive(p)}
                      >
                        {p.status === 'archived' ? 'Restore' : 'Archive'}
                      </button>
                      <button
                        type="button"
                        className="btn-danger btn-sm"
                        onClick={() => void remove(p)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={creating || editing !== null}
        title={editing ? `Edit ${editing.name}` : 'Add a parish'}
        onClose={closeModal}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" form="parish-form" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add parish'}
            </button>
          </>
        }
      >
        <form id="parish-form" onSubmit={handleSave} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Parish name" required>
              <input
                className="input"
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
                maxLength={120}
                required
              />
            </Field>
            <Field label="Pastor's name" required>
              <input
                className="input"
                value={draft.pastorName}
                onChange={(e) => set('pastorName', e.target.value)}
                maxLength={120}
                required
              />
            </Field>
            <Field label="Phone number" hint="Visible to admins only.">
              <input
                className="input"
                type="tel"
                value={draft.phone}
                onChange={(e) => set('phone', e.target.value)}
                maxLength={25}
              />
            </Field>
            <Field label="Location" required>
              <select
                className="input"
                value={draft.location}
                onChange={(e) => set('location', e.target.value as LocationCode)}
              >
                {LOCATIONS.map((f) => (
                  <option key={f} value={f}>
                    {LOCATION_LABEL[f]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Zone">
              <input
                className="input"
                list="admin-zones"
                value={draft.zone}
                onChange={(e) => set('zone', e.target.value)}
                maxLength={120}
              />
              <datalist id="admin-zones">
                {zonesFor(draft.location, zonesByLocation[draft.location] ?? []).map((z) => (
                  <option key={z} value={z} />
                ))}
              </datalist>
            </Field>
            <Field label="Area">
              <input
                className="input"
                list="admin-areas"
                value={draft.area}
                onChange={(e) => set('area', e.target.value)}
                maxLength={120}
              />
              <datalist id="admin-areas">
                {areasFor(draft.location, draft.zone, areasByZone[draft.zone] ?? []).map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-4">
            <Field label="Ordination">
              <select
                className="input"
                value={draft.ordinationStatus}
                onChange={(e) => set('ordinationStatus', e.target.value)}
              >
                {ORDINATION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Year">
              <input
                className="input"
                type="number"
                value={draft.yearOfOrdination}
                onChange={(e) => set('yearOfOrdination', e.target.value)}
              />
            </Field>
            <Field label="Length of service">
              <input
                className="input"
                value={draft.lengthOfService}
                onChange={(e) => set('lengthOfService', e.target.value)}
                maxLength={120}
              />
            </Field>
            <Field label="Status" hint="Only active parishes appear on the form.">
              <select
                className="input"
                value={draft.status}
                onChange={(e) => set('status', e.target.value as ParishStatus)}
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
          </div>
        </form>
      </Modal>
    </div>
  )
}
