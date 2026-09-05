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
import { Alert, EmptyState, Field, Modal, Spinner, StatusBadge } from '../../components/ui'
import { DIRECTORY_COUNT, flattenDirectory } from '../../data/provinceStructure'
import { useParishContacts } from '../../hooks/useParishContacts'
import { useParishes } from '../../hooks/useParishes'
import { downloadCsv, parseCsv, toCsv } from '../../lib/csv'
import { COLLECTIONS, db } from '../../lib/firebase'
import { whatsappNumber } from '../../lib/phone'
import type { Parish, ParishStatus } from '../../types'

interface Draft {
  name: string
  pastorName: string
  phone: string
  status: ParishStatus
}

const BLANK: Draft = { name: '', pastorName: '', phone: '', status: 'active' }

export default function ParishesAdmin() {
  const { parishes, loading } = useParishes()
  const { phones, contacts, refresh: refreshContacts } = useParishContacts()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ParishStatus | ''>('')

  const [editing, setEditing] = useState<Parish | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft>(BLANK)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const pendingCount = parishes.filter((p) => p.status === 'pending').length

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return parishes
      .filter((p) => {
        if (status && p.status !== status) return false
        if (!needle) return true
        return `${p.name} ${p.pastorName} ${phones[p.id] ?? ''}`.toLowerCase().includes(needle)
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [parishes, search, status, phones])

  function openCreate() {
    setDraft(BLANK)
    setCreating(true)
    setEditing(null)
    setMessage(null)
  }

  function openEdit(parish: Parish) {
    setDraft({
      name: parish.name,
      pastorName: contacts[parish.id]?.pastorName || parish.pastorName || '',
      phone: phones[parish.id] ?? '',
      status: parish.status,
    })
    setEditing(parish)
    setCreating(false)
    setMessage(null)
  }

  function closeModal() {
    setCreating(false)
    setEditing(null)
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    if (draft.name.trim().length < 2) {
      setMessage({ tone: 'error', text: 'The parish name is required.' })
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: draft.name.trim(),
        pastorName: draft.pastorName.trim(),
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
            pastorName: draft.pastorName.trim(),
            updatedAt: serverTimestamp(),
            ...(editing ? {} : { createdAt: serverTimestamp() }),
          },
          { merge: true },
        )
      }

      await refreshContacts()
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

  /**
   * Writes the province's parish list from src/data/provinceStructure.ts using
   * the signed-in admin session — no service-account key needed, which matters
   * because org policy can block key creation entirely.
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
          'Names only — no pastor and no phone number. Each pastor fills those in themselves.',
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
            status: p.status,
            source: 'directory-import',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        }
        await batch.commit()
      }
      setMessage({
        tone: 'success',
        text: `Added ${missing.length} parish${missing.length === 1 ? '' : 'es'}. Pastors can now confirm them.`,
      })
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
    // Deleting leaves the attendance history orphaned, so say so plainly.
    // Archiving is almost always the right answer.
    if (
      !window.confirm(
        `Delete ${parish.name} permanently?\n\nIts attendance records stay in the database but will no longer be linked to a parish. Archive it instead if you only want it off the submission form.`,
      )
    )
      return
    await deleteDoc(doc(db, COLLECTIONS.parishes, parish.id))
    try {
      await deleteDoc(doc(db, COLLECTIONS.parishContacts, parish.id))
    } catch {
      /* contact may not exist */
    }
    await refreshContacts()
    setMessage({ tone: 'success', text: `${parish.name} deleted.` })
  }

  function exportCsv() {
    downloadCsv(
      `yp23-parishes-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        filtered.map((p) => ({
          name: p.name,
          pastorName: contacts[p.id]?.pastorName || p.pastorName || '',
          phone: phones[p.id] ?? '',
          status: p.status,
        })),
        [
          { key: 'name', header: 'name' },
          { key: 'pastorName', header: 'pastorName' },
          { key: 'phone', header: 'phone' },
          { key: 'status', header: 'status' },
        ],
      ),
    )
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setMessage(null)

    try {
      const rows = parseCsv(await file.text())
      const known = new Set(parishes.map((p) => p.name.trim().toUpperCase()))
      const toAdd = rows.filter((r) => r.name?.trim() && !known.has(r.name.trim().toUpperCase()))
      const skipped = rows.length - toAdd.length

      if (toAdd.length === 0) {
        setMessage({
          tone: 'error',
          text: `Nothing to import — all ${rows.length} rows already exist by name.`,
        })
        return
      }

      for (let i = 0; i < toAdd.length; i += 200) {
        const batch = writeBatch(db)
        for (const row of toAdd.slice(i, i + 200)) {
          const ref = doc(collection(db, COLLECTIONS.parishes))
          batch.set(ref, {
            name: row.name.trim(),
            pastorName: (row.pastorName ?? '').trim(),
            status: row.status?.trim() === 'pending' ? 'pending' : 'active',
            source: 'admin',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
          if (row.phone?.trim()) {
            batch.set(doc(db, COLLECTIONS.parishContacts, ref.id), {
              phone: row.phone.replace(/[^\d+]/g, ''),
              pastorName: (row.pastorName ?? '').trim(),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          }
        }
        await batch.commit()
      }

      await refreshContacts()
      setMessage({
        tone: 'success',
        text:
          `Imported ${toAdd.length} parish${toAdd.length === 1 ? '' : 'es'}.` +
          (skipped ? ` Skipped ${skipped} already in the directory.` : ''),
      })
    } catch (err) {
      setMessage({
        tone: 'error',
        text: `Import failed: ${err instanceof Error ? err.message : String(err)}`,
      })
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  if (loading) return <Spinner label="Loading parishes…" />

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
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
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          {parishes.length < DIRECTORY_COUNT && (
            <button
              type="button"
              className="btn-gold btn-sm col-span-2 sm:col-span-1"
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
          <button type="button" className="btn-primary btn-sm col-span-2 sm:col-span-1" onClick={openCreate}>
            + Add parish
          </button>
        </div>
      </header>

      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      <div className="grid gap-3 sm:flex sm:items-center">
        <input
          className="input sm:max-w-sm"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search parish, pastor or phone…"
        />
        <select
          className="input sm:max-w-[200px]"
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
        <EmptyState
          title="No parish matches those filters"
          action={
            <button type="button" className="btn-primary btn-sm" onClick={openCreate}>
              + Add new parish
            </button>
          }
        >
          Clear the search, or add the parish if it is genuinely missing.
        </EmptyState>
      ) : (
        <>
        {/* Same reasoning as the attendance list: four action buttons at the
            right edge of a 700px table are off-screen on a phone. */}
        <ul className="grid gap-3 sm:hidden">
          {filtered.map((p) => (
            <li key={p.id} className="card flex flex-col justify-between gap-3 p-4">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <Link
                    to={`/admin/parishes/${p.id}`}
                    className="min-w-0 font-semibold text-navy-900 hover:underline"
                  >
                    {p.name}
                  </Link>
                  <span className="shrink-0">
                    <StatusBadge status={p.status} />
                  </span>
                </div>

                <div className="mt-2 text-sm">
                  <p className="text-navy-600">
                    {contacts[p.id]?.pastorName || p.pastorName || (
                      <span className="italic text-navy-400">Not confirmed</span>
                    )}
                  </p>
                  {phones[p.id] ? (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <a
                        href={`tel:${phones[p.id]}`}
                        className="inline-flex items-center gap-1 font-medium text-navy-800 hover:underline"
                      >
                        📞 {phones[p.id]}
                      </a>
                      {whatsappNumber(phones[p.id]) && (
                        <a
                          href={`https://wa.me/${whatsappNumber(phones[p.id])}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                        >
                          WhatsApp
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-navy-400">No phone on file</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-navy-100 pt-3">
                {p.status === 'pending' && (
                  <button type="button" className="btn-gold btn-sm col-span-2" onClick={() => void approve(p)}>
                    Approve parish
                  </button>
                )}
                <button type="button" className="btn-ghost btn-sm" onClick={() => openEdit(p)}>
                  Edit
                </button>
                <button type="button" className="btn-ghost btn-sm" onClick={() => void archive(p)}>
                  {p.status === 'archived' ? 'Restore' : 'Archive'}
                </button>
                <button type="button" className="btn-danger btn-sm col-span-2" onClick={() => void remove(p)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="card hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[700px]">
            <thead className="border-b border-navy-100 bg-navy-50">
              <tr>
                <th className="th">Parish</th>
                <th className="th">Pastor</th>
                <th className="th">Phone</th>
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
                  </td>
                  <td className="td">
                    {contacts[p.id]?.pastorName || p.pastorName || (
                      <span className="italic text-navy-300">Not confirmed</span>
                    )}
                  </td>
                  <td className="td whitespace-nowrap">
                    {phones[p.id] ? (
                      <div className="flex items-center gap-2">
                        <a href={`tel:${phones[p.id]}`} className="text-navy-800 hover:underline">
                          {phones[p.id]}
                        </a>
                        {whatsappNumber(phones[p.id]) && (
                          <a
                            href={`https://wa.me/${whatsappNumber(phones[p.id])}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                          >
                            WhatsApp
                          </a>
                        )}
                      </div>
                    ) : (
                      <span className="text-navy-300">—</span>
                    )}
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
                      <button type="button" className="btn-ghost btn-sm" onClick={() => openEdit(p)}>
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
        </>
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
          <Field label="Parish name" required>
            <input
              className="input"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              maxLength={120}
              required
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Pastor's name" hint="Pastors normally fill this in themselves.">
              <input
                className="input"
                value={draft.pastorName}
                onChange={(e) => setDraft((d) => ({ ...d, pastorName: e.target.value }))}
                maxLength={120}
              />
            </Field>
            <Field label="Phone number" hint="Visible to admins only.">
              <input
                className="input"
                type="tel"
                value={draft.phone}
                onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                maxLength={25}
              />
            </Field>
          </div>

          <Field label="Status" hint="Only active parishes appear on the attendance form.">
            <select
              className="input"
              value={draft.status}
              onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as ParishStatus }))}
            >
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="archived">Archived</option>
            </select>
          </Field>
        </form>
      </Modal>
    </div>
  )
}
