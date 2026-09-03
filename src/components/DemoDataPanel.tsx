import { useState } from 'react'
import { collection, doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore'
import { Alert } from './ui'
import { generateDemoAttendance } from '../lib/demoData'
import { COLLECTIONS, db } from '../lib/firebase'
import type { Parish } from '../types'

const WEEK_CHOICES = [8, 16, 26, 52]

/**
 * Loads sample attendance so the dashboard can be judged before real returns
 * exist, and clears it again afterwards.
 *
 * Everything it writes carries `source: 'demo'`, which is what makes the clear
 * safe: it deletes only rows it created, so a preview loaded after parishes
 * have started reporting cannot take genuine returns with it.
 */
export default function DemoDataPanel({ parishes }: { parishes: Parish[] }) {
  const [weeks, setWeeks] = useState(26)
  const [busy, setBusy] = useState<'load' | 'clear' | null>(null)
  const [message, setMessage] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(
    null,
  )

  const active = parishes.filter((p) => p.status === 'active')

  async function commitInChunks(
    items: unknown[],
    apply: (batch: ReturnType<typeof writeBatch>, item: never) => void,
  ) {
    for (let i = 0; i < items.length; i += 400) {
      const batch = writeBatch(db)
      for (const item of items.slice(i, i + 400)) apply(batch, item as never)
      await batch.commit()
    }
  }

  async function load() {
    if (active.length === 0) {
      setMessage({ tone: 'error', text: 'Load the province directory first — there are no active parishes.' })
      return
    }
    if (
      !window.confirm(
        `Write sample attendance for ${active.length} parishes across ${weeks} Sundays?\n\n` +
          'This is preview data only. It is tagged so you can remove it again with one click.',
      )
    )
      return

    setBusy('load')
    setMessage(null)
    try {
      const rows = generateDemoAttendance(active, { weeks })
      await commitInChunks(rows, (batch, row: (typeof rows)[number]) => {
        batch.set(doc(db, COLLECTIONS.attendance, `${row.parishId}_${row.date}`), {
          parishId: row.parishId,
          parishName: row.parishName,
          pastorName: 'Demo data',
          date: row.date,
          attendance: row.attendance,
          note: row.note,
          source: 'demo',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      })
      setMessage({
        tone: 'success',
        text: `Loaded ${rows.length} sample returns across ${weeks} Sundays. Open the dashboard to see the charts.`,
      })
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(null)
    }
  }

  async function clear() {
    setBusy('clear')
    setMessage(null)
    try {
      // Read the whole collection and delete only the demo rows. Filtering here
      // rather than with a where() query means no composite index is needed,
      // and the collection is small enough that it costs nothing.
      const snap = await getDocs(collection(db, COLLECTIONS.attendance))
      const ids = snap.docs.filter((d) => d.data().source === 'demo').map((d) => d.id)

      if (ids.length === 0) {
        setMessage({ tone: 'info', text: 'There is no sample data to remove.' })
        return
      }
      if (!window.confirm(`Delete ${ids.length} sample returns? Real returns are left untouched.`))
        return

      await commitInChunks(ids, (batch, id: string) => {
        batch.delete(doc(db, COLLECTIONS.attendance, id))
      })
      setMessage({ tone: 'success', text: `Removed ${ids.length} sample returns.` })
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="card border-dashed p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-navy-900">Sample data</h2>
      <p className="mt-1 text-sm text-navy-600">
        Fills the charts with believable figures so you can see how the dashboard behaves before
        the parishes start reporting. Every row is tagged, so removing it cannot touch a real
        return.
      </p>

      {message && (
        <div className="mt-4">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block">
          <span className="label">Sundays to fill</span>
          <select
            className="input sm:w-48"
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
          >
            {WEEK_CHOICES.map((w) => (
              <option key={w} value={w}>
                {w} Sundays
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn-primary"
          onClick={() => void load()}
          disabled={busy !== null}
        >
          {busy === 'load' ? 'Loading…' : 'Load sample data'}
        </button>
        <button
          type="button"
          className="btn-danger"
          onClick={() => void clear()}
          disabled={busy !== null}
        >
          {busy === 'clear' ? 'Clearing…' : 'Clear sample data'}
        </button>
      </div>

      <p className="mt-3 text-xs text-navy-500">
        Sundays are filled from {' '}
        <strong>6 September 2026</strong> forward, because the exercise has not started yet and
        there are no past Sundays to fill.
      </p>
    </section>
  )
}
