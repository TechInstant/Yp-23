import { useMemo, useState } from 'react'
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import SundayPicker from './SundayPicker'
import { Alert, Field } from './ui'
import { useAuth } from '../context/AuthContext'
import { useSubmissionExceptions } from '../hooks/useSubmissionExceptions'
import { COLLECTIONS, db } from '../lib/firebase'
import { formatSundayLong, latestSelectableSunday, todayISO } from '../lib/sundays'
import type { Parish } from '../types'

/**
 * Re-opening one past Sunday for one parish.
 *
 * Parishes can normally only file on the day of the service, which is what the
 * province asked for — but a parish that lost power or had no network on the
 * day would otherwise have to phone its figure in and have an admin type it.
 * A super admin can instead hand that one Sunday back to them, so the return
 * still arrives from the parish itself with the pastor's own name against it.
 *
 * Deliberately narrow: one parish, one Sunday, per grant. There is no
 * "re-open for everyone", because that would quietly undo the rule.
 */
export default function SubmissionExceptions({ parishes }: { parishes: Parish[] }) {
  const { user, isSuperAdmin } = useAuth()
  const { exceptions } = useSubmissionExceptions()

  const [parishId, setParishId] = useState('')
  const [date, setDate] = useState(() => latestSelectableSunday() || todayISO())
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const byId = useMemo(() => new Map(parishes.map((p) => [p.id, p])), [parishes])
  const options = useMemo(
    () => [...parishes].sort((a, b) => a.name.localeCompare(b.name)),
    [parishes],
  )
  const open = useMemo(
    () => [...exceptions].sort((a, b) => b.date.localeCompare(a.date)),
    [exceptions],
  )

  if (!isSuperAdmin) return null

  async function grant(event: React.FormEvent) {
    event.preventDefault()
    const parish = byId.get(parishId)
    if (!parish) {
      setMessage({ tone: 'error', text: 'Choose the parish this applies to.' })
      return
    }

    setBusy(true)
    setMessage(null)
    try {
      // Same id as the attendance record it unlocks, so the rules can authorise
      // the late return with a single exists() and it cannot unlock anything else.
      await setDoc(doc(db, COLLECTIONS.submissionExceptions, `${parish.id}_${date}`), {
        parishId: parish.id,
        date,
        reason: reason.trim(),
        grantedBy: user?.email ?? '',
        createdAt: serverTimestamp(),
      })
      setMessage({
        tone: 'success',
        text: `${parish.name} can now file for ${formatSundayLong(date)}. Tell them to open the attendance form.`,
      })
      setReason('')
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }

  async function revoke(id: string) {
    try {
      await deleteDoc(doc(db, COLLECTIONS.submissionExceptions, id))
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : String(err) })
    }
  }

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-navy-900">Re-open a Sunday for a parish</h2>
      <p className="mt-1 text-sm text-navy-600">
        Parishes file on the day of the service. If one genuinely could not, hand that Sunday back
        to them and the return arrives in their own name instead of yours.
      </p>

      {message && (
        <div className="mt-4">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}

      <form onSubmit={grant} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Parish" required>
            <select
              className="input"
              value={parishId}
              onChange={(e) => setParishId(e.target.value)}
            >
              <option value="">Select parish…</option>
              {options.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sunday" required>
            <SundayPicker value={date} onChange={setDate} />
          </Field>
        </div>

        <Field label="Reason (optional)" hint="Kept on record so the province can see why.">
          <input
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
            placeholder="e.g. no network in Ipetumodu that Sunday"
          />
        </Field>

        <button type="submit" className="btn-gold w-full sm:w-auto" disabled={busy || !parishId}>
          {busy ? 'Granting…' : 'Re-open this Sunday'}
        </button>
      </form>

      {open.length > 0 && (
        <div className="mt-6 border-t border-navy-100 pt-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-navy-500">
            Currently open ({open.length})
          </h3>
          <ul className="mt-3 space-y-2">
            {open.map((e) => (
              <li
                key={e.id}
                className="flex flex-col gap-2 rounded-lg border border-navy-100 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium text-navy-900">
                    {byId.get(e.parishId)?.name ?? e.parishId}
                  </p>
                  <p className="mt-0.5 text-navy-500">
                    {formatSundayLong(e.date)}
                    {e.reason ? ` · ${e.reason}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-ghost btn-sm shrink-0"
                  onClick={() => void revoke(e.id)}
                >
                  Close it
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-navy-500">
            Close an exception once the parish has filed — leaving it open lets them overwrite
            nothing, but it is one fewer thing the rules have to check.
          </p>
        </div>
      )}
    </section>
  )
}
