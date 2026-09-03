import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { Alert, Field, Spinner } from '../components/ui'
import { useParishes } from '../hooks/useParishes'
import { COLLECTIONS, db } from '../lib/firebase'
import {
  currentReportingSunday,
  formatSundayLong,
  selectableSundays,
} from '../lib/sundays'
import { FAMILIES, FAMILY_LABEL, type Family, type Parish } from '../types'

type Status =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; parish: string; date: string; attendance: number }
  | { kind: 'error'; message: string }

export default function SubmitAttendance() {
  const { active, zonesByFamily, areasByZone, loading, error } = useParishes()

  const [family, setFamily] = useState<Family | ''>('')
  const [zone, setZone] = useState('')
  const [area, setArea] = useState('')
  const [parishId, setParishId] = useState('')
  const [date, setDate] = useState(() => currentReportingSunday())
  const [attendance, setAttendance] = useState('')
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [existing, setExisting] = useState<{ attendance: number } | null>(null)
  const [checking, setChecking] = useState(false)

  const sundays = useMemo(() => selectableSundays().slice().reverse(), [])

  const zones = family ? (zonesByFamily[family] ?? []) : []
  const areas = zone ? (areasByZone[zone] ?? []) : []

  const candidates = useMemo(() => {
    return active.filter(
      (p) =>
        (!family || p.family === family) &&
        (!zone || p.zone === zone) &&
        (!area || p.area === area),
    )
  }, [active, family, zone, area])

  const parish = active.find((p) => p.id === parishId) ?? null

  // Show what is already on file for this parish/Sunday before the pastor
  // types a figure — the write itself is create-only, so a silent duplicate is
  // impossible, but finding that out *after* filling the form is annoying.
  useEffect(() => {
    if (!parishId || !date) {
      setExisting(null)
      return
    }
    let cancelled = false
    setChecking(true)
    getDoc(doc(db, COLLECTIONS.attendance, `${parishId}_${date}`))
      .then((snap) => {
        if (cancelled) return
        setExisting(snap.exists() ? { attendance: snap.data().attendance as number } : null)
      })
      .catch(() => {
        if (!cancelled) setExisting(null)
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })
    return () => {
      cancelled = true
    }
  }, [parishId, date])

  function resetSelection(next: Partial<{ family: Family | ''; zone: string; area: string }>) {
    if ('family' in next) {
      setFamily(next.family as Family | '')
      setZone('')
      setArea('')
      setParishId('')
    } else if ('zone' in next) {
      setZone(next.zone as string)
      setArea('')
      setParishId('')
    } else if ('area' in next) {
      setArea(next.area as string)
      setParishId('')
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!parish) return

    const count = Number(attendance)
    if (!Number.isInteger(count) || count < 0) {
      setStatus({ kind: 'error', message: 'Attendance must be a whole number, 0 or more.' })
      return
    }

    setStatus({ kind: 'saving' })
    try {
      await setDoc(doc(db, COLLECTIONS.attendance, `${parish.id}_${date}`), {
        parishId: parish.id,
        parishName: parish.name,
        family: parish.family,
        zone: parish.zone,
        area: parish.area,
        date,
        attendance: count,
        note: note.trim(),
        source: 'parish-form',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setStatus({ kind: 'saved', parish: parish.name, date, attendance: count })
      setAttendance('')
      setNote('')
      setExisting({ attendance: count })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setStatus({
        kind: 'error',
        message: message.includes('permission')
          ? `A return for ${parish.name} on ${formatSundayLong(date)} is already on file. Ask the provincial admin to correct it.`
          : message,
      })
    }
  }

  if (loading) return <Spinner label="Loading parishes…" />
  if (error) {
    return (
      <Alert tone="error" title="Could not load the parish list">
        {error}
      </Alert>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">Submit Sunday attendance</h1>
        <p className="mt-2 text-navy-600">
          One figure per parish per Sunday: the total number present at the Sunday service.
        </p>
      </header>

      {status.kind === 'saved' && (
        <Alert tone="success" title="Return recorded">
          <p>
            <strong>{status.parish}</strong> — {formatSundayLong(status.date)} —{' '}
            <strong>{status.attendance.toLocaleString()}</strong> in attendance.
          </p>
          <p className="mt-1">
            Need to submit for another parish? Change the selection below and enter the next
            figure.
          </p>
        </Alert>
      )}

      {status.kind === 'error' && (
        <Alert tone="error" title="Not saved">
          {status.message}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="card space-y-5 p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Family" required>
            <select
              className="input"
              value={family}
              onChange={(e) => resetSelection({ family: e.target.value as Family | '' })}
              required
            >
              <option value="">Select family…</option>
              {FAMILIES.map((f) => (
                <option key={f} value={f}>
                  {FAMILY_LABEL[f]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Zone" hint={family ? undefined : 'Choose a family first'}>
            <select
              className="input"
              value={zone}
              onChange={(e) => resetSelection({ zone: e.target.value })}
              disabled={!family}
            >
              <option value="">All zones</option>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Area" hint={zone ? undefined : 'Choose a zone first'}>
            <select
              className="input"
              value={area}
              onChange={(e) => resetSelection({ area: e.target.value })}
              disabled={!zone}
            >
              <option value="">All areas</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Parish"
            required
            hint={
              candidates.length === 0 && family
                ? 'No parish matches that selection.'
                : `${candidates.length} parish${candidates.length === 1 ? '' : 'es'} to choose from`
            }
          >
            <select
              className="input"
              value={parishId}
              onChange={(e) => setParishId(e.target.value)}
              required
            >
              <option value="">Select parish…</option>
              {candidates.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {parish && <ParishSummary parish={parish} />}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Sunday" required hint="Only Sundays inside the tracking window appear.">
            <select
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            >
              {sundays.map((d) => (
                <option key={d} value={d}>
                  {formatSundayLong(d)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Number in attendance" required>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={0}
              max={100000}
              step={1}
              value={attendance}
              onChange={(e) => setAttendance(e.target.value)}
              placeholder="e.g. 84"
              required
            />
          </Field>
        </div>

        {checking && <p className="text-xs text-navy-500">Checking for an existing return…</p>}

        {existing && status.kind !== 'saved' && (
          <Alert tone="warning" title="Already submitted">
            A return of <strong>{existing.attendance.toLocaleString()}</strong> is on file for
            this parish on {formatSundayLong(date)}. Submitting again will be rejected — contact
            the provincial admin if the figure needs correcting.
          </Alert>
        )}

        <Field label="Note (optional)" hint="Convention, joint service, harvest — anything that explains an unusual figure.">
          <textarea
            className="input min-h-[80px] resize-y"
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Leave blank for a normal Sunday"
          />
        </Field>

        <div className="flex flex-wrap items-center gap-3 border-t border-navy-100 pt-5">
          <button
            type="submit"
            className="btn-primary"
            disabled={status.kind === 'saving' || !parish || Boolean(existing)}
          >
            {status.kind === 'saving' ? 'Saving…' : 'Submit attendance'}
          </button>
          <span className="text-sm text-navy-500">
            Parish not listed?{' '}
            <Link to="/register" className="font-medium text-navy-800 underline">
              Register it first
            </Link>
          </span>
        </div>
      </form>
    </div>
  )
}

function ParishSummary({ parish }: { parish: Parish }) {
  return (
    <div className="rounded-lg bg-navy-50 px-4 py-3 text-sm">
      <p className="font-semibold text-navy-900">{parish.name}</p>
      <p className="mt-0.5 text-navy-600">
        {parish.pastorName}
        {parish.zone && ` · ${parish.zone}`}
        {parish.area && ` · ${parish.area}`}
      </p>
      {parish.address && <p className="mt-0.5 text-navy-500">{parish.address}</p>}
    </div>
  )
}
