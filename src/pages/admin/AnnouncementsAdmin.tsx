import { useState } from 'react'
import { addDoc, collection, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { Alert, Field, Spinner } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useAnnouncements } from '../../hooks/useAnnouncements'
import { COLLECTIONS, db } from '../../lib/firebase'
import {
  currentReportingSunday,
  formatSundayLong,
  isTrackedSunday,
  todayISO,
} from '../../lib/sundays'

/**
 * Posting notices to the parishes.
 *
 * Every announcement carries a date window rather than an on/off switch, so a
 * "file your return today" reminder disappears by itself on Monday. Nobody has
 * to remember to take it down, and nothing stale is left scrolling across the
 * page in the weeks afterwards.
 */
export default function AnnouncementsAdmin() {
  const { user } = useAuth()
  const { announcements, live, loading } = useAnnouncements()

  const [message, setMessage] = useState('')
  const [showFrom, setShowFrom] = useState(() => todayISO())
  const [showUntil, setShowUntil] = useState(() => todayISO())
  const [marquee, setMarquee] = useState(true)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const today = todayISO()
  const thisSunday = currentReportingSunday()

  /** One tap for the commonest notice: a reminder that runs on Sunday only. */
  function useSundayOnly() {
    setShowFrom(thisSunday)
    setShowUntil(thisSunday)
    if (!message.trim()) {
      setMessage(
        `Today is ${formatSundayLong(thisSunday)} — please submit your parish attendance before the day ends.`,
      )
    }
  }

  async function post(event: React.FormEvent) {
    event.preventDefault()
    setFeedback(null)

    if (message.trim().length < 2) {
      setFeedback({ tone: 'error', text: 'Write the announcement first.' })
      return
    }
    if (showUntil < showFrom) {
      setFeedback({ tone: 'error', text: 'The end date cannot be before the start date.' })
      return
    }

    setBusy(true)
    try {
      await addDoc(collection(db, COLLECTIONS.announcements), {
        message: message.trim(),
        showFrom,
        showUntil,
        marquee,
        createdBy: user?.email ?? '',
        createdAt: serverTimestamp(),
      })
      setFeedback({
        tone: 'success',
        text:
          showFrom <= today && showUntil >= today
            ? 'Posted — it is on the site now.'
            : `Scheduled for ${formatSundayLong(showFrom)}.`,
      })
      setMessage('')
    } catch (err) {
      setFeedback({ tone: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Remove this announcement?')) return
    try {
      await deleteDoc(doc(db, COLLECTIONS.announcements, id))
    } catch (err) {
      setFeedback({ tone: 'error', text: err instanceof Error ? err.message : String(err) })
    }
  }

  if (loading) return <Spinner label="Loading announcements…" />

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">Announcements</h1>
        <p className="mt-1 text-sm text-navy-600">
          Shown across the top of every page pastors see. {live.length} showing now.
        </p>
      </header>

      {feedback && <Alert tone={feedback.tone}>{feedback.text}</Alert>}

      <form onSubmit={post} className="card space-y-5 p-5 sm:p-6">
        <Field label="Announcement" required hint="Kept short — it has to read on a phone.">
          <textarea
            className="input min-h-[90px] resize-y"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={300}
            placeholder="e.g. Remember to submit your attendance before 8pm today."
          />
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-ghost btn-sm" onClick={useSundayOnly}>
            Set for {formatSundayLong(thisSunday)} only
          </button>
          <span className="text-xs text-navy-500">
            {isTrackedSunday(today) ? 'Today is a reporting Sunday.' : 'Today is not a Sunday.'}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Show from" required>
            <input
              className="input"
              type="date"
              value={showFrom}
              onChange={(e) => setShowFrom(e.target.value)}
            />
          </Field>
          <Field label="Show until" required hint="It stops on its own after this date.">
            <input
              className="input"
              type="date"
              value={showUntil}
              onChange={(e) => setShowUntil(e.target.value)}
            />
          </Field>
        </div>

        <label className="flex items-center gap-2.5 text-sm font-medium text-navy-700">
          <input
            type="checkbox"
            className="h-4 w-4 shrink-0 rounded border-navy-300"
            checked={marquee}
            onChange={(e) => setMarquee(e.target.checked)}
          />
          Scroll it across the page
        </label>

        <button type="submit" className="btn-primary w-full sm:w-auto" disabled={busy}>
          {busy ? 'Posting…' : 'Post announcement'}
        </button>
      </form>

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-navy-900">
          Posted ({announcements.length})
        </h2>
        {announcements.length === 0 ? (
          <p className="mt-3 text-sm text-navy-500">Nothing posted yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {announcements.map((a) => {
              const showing = a.showFrom <= today && a.showUntil >= today
              const finished = a.showUntil < today
              return (
                <li
                  key={a.id}
                  className="flex flex-col gap-3 rounded-lg border border-navy-100 p-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`badge ${
                          showing
                            ? 'bg-emerald-100 text-emerald-800'
                            : finished
                              ? 'bg-navy-100 text-navy-500'
                              : 'bg-gold-100 text-gold-800'
                        }`}
                      >
                        {showing ? 'Showing now' : finished ? 'Finished' : 'Scheduled'}
                      </span>
                      {a.marquee && (
                        <span className="badge bg-navy-100 text-navy-600">Scrolling</span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-navy-800">{a.message}</p>
                    <p className="mt-1 text-xs text-navy-500">
                      {a.showFrom === a.showUntil
                        ? formatSundayLong(a.showFrom)
                        : `${formatSundayLong(a.showFrom)} → ${formatSundayLong(a.showUntil)}`}
                      {a.createdBy ? ` · ${a.createdBy}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-danger btn-sm shrink-0"
                    onClick={() => void remove(a.id)}
                  >
                    Remove
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
