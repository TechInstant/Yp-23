import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { Alert, Field, Spinner } from '../components/ui'
import { useParishes } from '../hooks/useParishes'
import { COLLECTIONS, db } from '../lib/firebase'
import {
  formatSundayLong,
  hasStarted,
  isSubmissionDay,
  nextSubmissionSunday,
  SEASON_START,
  todayISO,
} from '../lib/sundays'

type Status =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; parish: string; date: string; attendance: number }
  | { kind: 'error'; message: string }

/** Nigerian numbers as written in the directory: 11 digits, or the +234 form. */
function normalisePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, '')
}

export default function SubmitAttendance() {
  const { active, loading, error } = useParishes()

  const [parishId, setParishId] = useState('')
  const [pastorName, setPastorName] = useState('')
  const [phone, setPhone] = useState('')
  // Fixed, not chosen: a return may only be filed on the Sunday it is for.
  const date = todayISO()
  const [attendance, setAttendance] = useState('')
  const [note, setNote] = useState('')

  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [existing, setExisting] = useState<{ attendance: number } | null>(null)
  const [checking, setChecking] = useState(false)

  const started = hasStarted()
  const canSubmit = isSubmissionDay()
  const nextSunday = nextSubmissionSunday()
  const parish = active.find((p) => p.id === parishId) ?? null

  const options = useMemo(
    () => [...active].sort((a, b) => a.name.localeCompare(b.name)),
    [active],
  )

  // Show what is already on file for this parish/Sunday before the pastor fills
  // anything in — the write is create-only, so a duplicate is impossible, but
  // discovering that after typing is needlessly annoying.
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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!parish) return

    if (pastorName.trim().length < 2) {
      setStatus({ kind: 'error', message: 'Enter the name of the pastor filing this return.' })
      return
    }

    const cleanPhone = normalisePhone(phone)
    if (cleanPhone.length < 7 || cleanPhone.length > 25) {
      setStatus({ kind: 'error', message: 'Enter a reachable phone number.' })
      return
    }

    // The date is today's, but the page could have sat open past midnight —
    // in which case it is no longer Sunday and the write would be rejected.
    if (!isSubmissionDay()) {
      setStatus({
        kind: 'error',
        message:
          'Returns can only be filed on the Sunday itself. Reload the page, or send your figure to the provincial admin.',
      })
      return
    }

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
        pastorName: pastorName.trim(),
        date,
        attendance: count,
        note: note.trim(),
        source: 'parish-form',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      // Refresh the province's contact card. Best-effort: the return is already
      // saved and is the thing that matters.
      try {
        await setDoc(
          doc(db, COLLECTIONS.parishContacts, parish.id),
          {
            phone: cleanPhone,
            pastorName: pastorName.trim(),
            lastSeenOn: date,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        )
      } catch {
        /* contact refresh is not worth failing the submission over */
      }

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
          One return per parish per Sunday — the total number present at the service.
        </p>
      </header>

      {!started ? (
        <Alert tone="warning" title="Returns are not open yet">
          The exercise begins on <strong>{formatSundayLong(SEASON_START)}</strong>. You can fill
          this form in on that Sunday.
        </Alert>
      ) : (
        !canSubmit && (
          <Alert tone="warning" title="Returns are only filed on Sundays">
            <p>
              This form opens on the day of the service. Come back on{' '}
              <strong>{nextSunday ? formatSundayLong(nextSunday) : 'the next Sunday'}</strong> and
              submit your figure then.
            </p>
            <p className="mt-2">
              If your parish missed a Sunday, the provincial admin can still record the figure for
              you — send it to them.
            </p>
          </Alert>
        )
      )}

      {status.kind === 'saved' && (
        <Alert tone="success" title="Return recorded">
          <p>
            <strong>{status.parish}</strong> — {formatSundayLong(status.date)} —{' '}
            <strong>{status.attendance.toLocaleString()}</strong> in attendance.
          </p>
          <p className="mt-1">
            Submitting for another parish? Change the parish below and enter the next figure.
          </p>
        </Alert>
      )}

      {status.kind === 'error' && (
        <Alert tone="error" title="Not saved">
          {status.message}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="card space-y-5 p-6">
        <Field label="Parish" required hint="Can't find yours? Register it — link below.">
          <select
            className="input"
            value={parishId}
            onChange={(e) => setParishId(e.target.value)}
            required
          >
            <option value="">Select your parish…</option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name of the pastor" required>
            <input
              className="input"
              value={pastorName}
              onChange={(e) => setPastorName(e.target.value)}
              placeholder="Your full name"
              maxLength={120}
              autoComplete="name"
              required
            />
          </Field>

          <Field label="Phone number" required hint="Seen only by provincial admins.">
            <input
              className="input"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 07024444000"
              maxLength={25}
              autoComplete="tel"
              required
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Sunday" hint="Returns are filed on the day of the service.">
            <p className="input bg-navy-50 font-medium text-navy-800">
              {canSubmit ? formatSundayLong(date) : 'Not open today'}
            </p>
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
            A return of <strong>{existing.attendance.toLocaleString()}</strong> is on file for this
            parish on {formatSundayLong(date)}. Submitting again will be rejected — contact the
            provincial admin if the figure needs correcting.
          </Alert>
        )}

        <Field
          label="Note (optional)"
          hint="Convention, joint service, harvest — anything that explains an unusual figure."
        >
          <textarea
            className="input min-h-[80px] resize-y"
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Leave blank for a normal Sunday"
          />
        </Field>

        <div className="flex flex-col gap-3 border-t border-navy-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="submit"
            className="btn-primary w-full sm:w-auto"
            disabled={
              status.kind === 'saving' || !parish || Boolean(existing) || !started || !canSubmit
            }
          >
            {status.kind === 'saving' ? 'Saving…' : 'Submit attendance'}
          </button>
          <span className="text-center text-sm text-navy-500 sm:text-left">
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
