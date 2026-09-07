import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { COLLECTIONS, db } from '../lib/firebase'
import { NO_CUTOFF, watToUtcMinutes } from '../lib/submissionWindow'

/**
 * The province's submission cut-off.
 *
 * Publicly readable so the form can show pastors the deadline. Falls back to
 * "no cut-off" whenever the document is missing or unreadable, so a settings
 * problem can never quietly lock every parish out of reporting.
 */
export function useSubmissionSettings() {
  const [closesAtUtcMinutes, setClosesAt] = useState<number>(() => watToUtcMinutes(NO_CUTOFF))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onSnapshot(
      doc(db, COLLECTIONS.settings, 'submission'),
      (snap) => {
        const value = snap.exists() ? snap.data().closesAtUtcMinutes : undefined
        setClosesAt(
          typeof value === 'number' && value >= 0 && value <= 1439
            ? value
            : watToUtcMinutes(NO_CUTOFF),
        )
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [])

  return { closesAtUtcMinutes, loading }
}
