import { useEffect, useState } from 'react'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { Alert, Field } from './ui'
import { useAuth } from '../context/AuthContext'
import { useSubmissionSettings } from '../hooks/useSubmissionSettings'
import { COLLECTIONS, db } from '../lib/firebase'
import {
  labelToMinutes,
  minutesToLabel,
  NO_CUTOFF,
  utcToWatMinutes,
  watToUtcMinutes,
} from '../lib/submissionWindow'

/** Typed as HH:MM for the time input, which is what it expects. */
function toInputValue(watMinutes: number): string {
  const h = Math.floor(watMinutes / 60)
  const m = watMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * What time returns close on a Sunday.
 *
 * The province types a WAT time; it is stored converted to UTC minutes,
 * because the Firestore rules that enforce it can read the hour off
 * `request.time` but cannot convert a timezone.
 */
export default function SubmissionCutoff() {
  const { user, isSuperAdmin } = useAuth()
  const { closesAtUtcMinutes } = useSubmissionSettings()

  const [value, setValue] = useState(() => toInputValue(utcToWatMinutes(closesAtUtcMinutes)))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  // Follow the stored value once it arrives, and whenever another admin changes it.
  useEffect(() => {
    setValue(toInputValue(utcToWatMinutes(closesAtUtcMinutes)))
  }, [closesAtUtcMinutes])

  if (!isSuperAdmin) return null

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setMessage(null)

    const watMinutes = labelToMinutes(value)
    if (watMinutes === null) {
      setMessage({ tone: 'error', text: 'Enter a time like 23:30.' })
      return
    }
    // Past 23:00 WAT the cut-off crosses UTC midnight, where the rules' minute
    // comparison can no longer express "later today" and would read as closed
    // all day. Refuse it rather than ship a setting that silently blocks every
    // parish.
    if (watMinutes > 23 * 60) {
      setMessage({
        tone: 'error',
        text: 'The latest workable cut-off is 23:00. Leave it at 23:59 for no cut-off at all.',
      })
      return
    }

    setBusy(true)
    try {
      await setDoc(doc(db, COLLECTIONS.settings, 'submission'), {
        closesAtUtcMinutes: watToUtcMinutes(watMinutes),
        updatedBy: user?.email ?? '',
        updatedAt: serverTimestamp(),
      })
      setMessage({
        tone: 'success',
        text:
          watMinutes >= NO_CUTOFF
            ? 'Returns now stay open all Sunday.'
            : `Returns now close at ${minutesToLabel(watMinutes)} on Sundays.`,
      })
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }

  const currentWat = utcToWatMinutes(closesAtUtcMinutes)

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-navy-900">Submission cut-off</h2>
      <p className="mt-1 text-sm text-navy-600">
        The time on a Sunday after which parishes can no longer file. Currently{' '}
        <strong>
          {currentWat >= NO_CUTOFF ? 'open all day' : minutesToLabel(currentWat)}
        </strong>
        . Admins can still record a return afterwards.
      </p>

      {message && (
        <div className="mt-4">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}

      <form onSubmit={save} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-48">
          <Field label="Closes at (WAT)" hint="Use 23:59 for no cut-off.">
            <input
              className="input"
              type="time"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              max="23:00"
            />
          </Field>
        </div>
        <button type="submit" className="btn-primary sm:mb-0" disabled={busy}>
          {busy ? 'Saving…' : 'Save cut-off'}
        </button>
      </form>
    </section>
  )
}
