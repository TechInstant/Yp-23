import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteDoc, doc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import SundayPicker from '../../components/SundayPicker'
import { Alert, EmptyState, Field, Modal, Spinner } from '../../components/ui'
import { useAttendance } from '../../hooks/useAttendance'
import { useParishes } from '../../hooks/useParishes'
import { downloadCsv, parseCsv, toCsv } from '../../lib/csv'
import { COLLECTIONS, db } from '../../lib/firebase'
import {
  formatSundayLong,
  isSelectableSunday,
  isTrackedSunday,
  latestSelectableSunday,
  RANGE_PRESETS,
  resolveRange,
  type RangePresetKey,
} from '../../lib/sundays'
import type { AttendanceRecord, Parish } from '../../types'

export default function AttendanceAdmin() {
  const [preset, setPreset] = useState<RangePresetKey>('last8')
  const range = useMemo(() => resolveRange(preset), [preset])

  const { active, loading: parishesLoading } = useParishes()
  const { records, loading, error } = useAttendance(range)

  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<AttendanceRecord | null>(null)
  const [adding, setAdding] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return [...records]
      .filter((r) => {
        if (!needle) return true
        return `${r.parishName} ${r.pastorName} ${r.note}`.toLowerCase().includes(needle)
      })
      .sort((a, b) => b.date.localeCompare(a.date) || a.parishName.localeCompare(b.parishName))
  }, [records, search])

  const total = filtered.reduce((s, r) => s + r.attendance, 0)

  async function saveEdit(value: number, note: string) {
    if (!editing) return
    try {
      await updateDoc(doc(db, COLLECTIONS.attendance, editing.id), {
        attendance: value,
        note,
        updatedAt: serverTimestamp(),
      })
      setMessage({
        tone: 'success',
        text: `${editing.parishName} — ${formatSundayLong(editing.date)} updated to ${value}.`,
      })
      setEditing(null)
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : String(err) })
    }
  }

  async function removeRecord(record: AttendanceRecord) {
    if (
      !window.confirm(
        `Delete the ${record.parishName} return for ${formatSundayLong(record.date)}?\n\nThe parish will then be able to submit that Sunday again.`,
      )
    )
      return
    await deleteDoc(doc(db, COLLECTIONS.attendance, record.id))
    setMessage({ tone: 'success', text: 'Return deleted.' })
  }

  /**
   * Bulk backfill from a `parishName,date,attendance,note` sheet. Parishes are
   * matched by name so the sheet can be typed from the paper returns; anything
   * that does not match a live parish or a tracked Sunday is reported back
   * rather than silently dropped.
   */
  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setMessage(null)

    try {
      const rows = parseCsv(await file.text())
      const byName = new Map(active.map((p) => [p.name.trim().toUpperCase(), p]))
      const valid: { parish: Parish; date: string; count: number; note: string }[] = []
      const rejected: string[] = []

      for (const row of rows) {
        const parish = byName.get((row.parishName ?? '').trim().toUpperCase())
        const date = (row.date ?? '').trim()
        const count = Number(row.attendance)

        if (!parish) rejected.push(`${row.parishName || '(blank)'} — no such active parish`)
        else if (!isTrackedSunday(date))
          rejected.push(`${parish.name} — "${date}" is not a Sunday in the tracking window`)
        else if (!Number.isInteger(count) || count < 0)
          rejected.push(`${parish.name} ${date} — "${row.attendance}" is not a whole number`)
        else valid.push({ parish, date, count, note: (row.note ?? '').trim() })
      }

      for (let i = 0; i < valid.length; i += 400) {
        const batch = writeBatch(db)
        for (const v of valid.slice(i, i + 400)) {
          batch.set(
            doc(db, COLLECTIONS.attendance, `${v.parish.id}_${v.date}`),
            {
              parishId: v.parish.id,
              parishName: v.parish.name,
              pastorName: v.parish.pastorName || 'Recorded by admin',
              date: v.date,
              attendance: v.count,
              note: v.note,
              source: 'admin',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          )
        }
        await batch.commit()
      }

      setMessage({
        tone: rejected.length > 0 ? 'error' : 'success',
        text:
          `Imported ${valid.length} return${valid.length === 1 ? '' : 's'}.` +
          (rejected.length
            ? ` Rejected ${rejected.length}: ${rejected.slice(0, 5).join('; ')}${
                rejected.length > 5 ? '…' : ''
              }`
            : ''),
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

  function exportCsv() {
    downloadCsv(
      `yp23-attendance-${range.from}-to-${range.to}.csv`,
      toCsv(filtered, [
        { key: 'date', header: 'Sunday' },
        { key: 'parishName', header: 'Parish' },
        { key: 'pastorName', header: 'Filed by' },
        { key: 'attendance', header: 'Attendance' },
        { key: 'note', header: 'Note' },
        { key: 'source', header: 'Source' },
      ]),
    )
  }

  if (parishesLoading) return <Spinner label="Loading…" />

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Attendance returns</h1>
          <p className="mt-1 text-sm text-navy-600">
            {filtered.length} records · {total.toLocaleString()} people counted
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <button type="button" className="btn-primary btn-sm" onClick={() => setAdding(true)}>
            + Record a return
          </button>
        </div>
      </header>

      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      <input
        className="input sm:max-w-sm"
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search parish, pastor or note…"
      />

      {loading ? (
        <Spinner label="Loading returns…" />
      ) : filtered.length === 0 ? (
        <EmptyState title="No returns in this range">
          Widen the date range, or record one on behalf of a parish that reported by phone.
        </EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="border-b border-navy-100 bg-navy-50">
              <tr>
                <th className="th">Sunday</th>
                <th className="th">Parish</th>
                <th className="th">Filed by</th>
                <th className="th text-right">Attendance</th>
                <th className="th">Note</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-navy-50/60">
                  <td className="td whitespace-nowrap">{formatSundayLong(r.date)}</td>
                  <td className="td">
                    <Link
                      to={`/admin/parishes/${r.parishId}`}
                      className="font-medium text-navy-900 hover:underline"
                    >
                      {r.parishName}
                    </Link>
                  </td>
                  <td className="td text-navy-600">{r.pastorName || '—'}</td>
                  <td className="td text-right font-semibold tabular-nums">
                    {r.attendance.toLocaleString()}
                  </td>
                  <td className="td max-w-[220px] truncate text-navy-500" title={r.note}>
                    {r.note || '—'}
                  </td>
                  <td className="td">
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        onClick={() => setEditing(r)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-danger btn-sm"
                        onClick={() => void removeRecord(r)}
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

      <EditModal record={editing} onClose={() => setEditing(null)} onSave={saveEdit} />

      <AddModal
        open={adding}
        parishes={active}
        onClose={() => setAdding(false)}
        onSaved={(text) => {
          setMessage({ tone: 'success', text })
          setAdding(false)
        }}
        onError={(text) => setMessage({ tone: 'error', text })}
      />
    </div>
  )
}

function EditModal({
  record,
  onClose,
  onSave,
}: {
  record: AttendanceRecord | null
  onClose: () => void
  onSave: (value: number, note: string) => Promise<void>
}) {
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  // Reset the fields whenever a different record is opened.
  const key = record?.id ?? ''
  const [lastKey, setLastKey] = useState('')
  if (key !== lastKey) {
    setLastKey(key)
    setValue(record ? String(record.attendance) : '')
    setNote(record?.note ?? '')
  }

  if (!record) return null

  return (
    <Modal
      open
      title={`${record.parishName} — ${formatSundayLong(record.date)}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await onSave(Number(value), note.trim())
              setBusy(false)
            }}
          >
            {busy ? 'Saving…' : 'Save correction'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Number in attendance" required>
          <input
            className="input"
            type="number"
            min={0}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>
        <Field label="Note">
          <textarea
            className="input min-h-[70px] resize-y"
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  )
}

function AddModal({
  open,
  parishes,
  onClose,
  onSaved,
  onError,
}: {
  open: boolean
  parishes: Parish[]
  onClose: () => void
  onSaved: (text: string) => void
  onError: (text: string) => void
}) {
  const [parishId, setParishId] = useState('')
  const [date, setDate] = useState(() => latestSelectableSunday())
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const options = useMemo(
    () => [...parishes].sort((a, b) => a.name.localeCompare(b.name)),
    [parishes],
  )

  async function save() {
    const parish = parishes.find((p) => p.id === parishId)
    if (!parish) return
    if (!isSelectableSunday(date)) {
      onError(
        date
          ? `${formatSundayLong(date)} has not happened yet.`
          : 'Choose the Sunday this attendance is for.',
      )
      return
    }
    const count = Number(value)
    if (!Number.isInteger(count) || count < 0) {
      onError('Attendance must be a whole number, 0 or more.')
      return
    }
    setBusy(true)
    try {
      // Admin writes overwrite deliberately: this is the correction path for a
      // parish that phoned its figure in, or got it wrong the first time.
      await setDoc(
        doc(db, COLLECTIONS.attendance, `${parish.id}_${date}`),
        {
          parishId: parish.id,
          parishName: parish.name,
          pastorName: parish.pastorName || 'Recorded by admin',
          date,
          attendance: count,
          note: note.trim(),
          source: 'admin',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
      onSaved(`${parish.name} — ${formatSundayLong(date)} recorded as ${count}.`)
      setValue('')
      setNote('')
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Record a return on behalf of a parish"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !parishId || value === ''}
            onClick={() => void save()}
          >
            {busy ? 'Saving…' : 'Save return'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Parish" required>
          <select className="input" value={parishId} onChange={(e) => setParishId(e.target.value)}>
            <option value="">Select parish…</option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Sunday" required>
            <SundayPicker value={date} onChange={setDate} />
          </Field>
          <Field label="Number in attendance" required>
            <input
              className="input"
              type="number"
              min={0}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Note" hint="Why this was entered by an admin, if it matters.">
          <textarea
            className="input min-h-[70px] resize-y"
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  )
}
