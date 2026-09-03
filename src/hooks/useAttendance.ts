import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { COLLECTIONS, db } from '../lib/firebase'
import type { AttendanceRecord } from '../types'
import { isTrackedSunday, type DateRange } from '../lib/sundays'

/**
 * Attendance for a date range. Over the full 174-Sunday exercise this
 * collection grows to a few thousand documents, so the dashboard always scopes
 * the read to the range being charted rather than pulling the lot.
 */
export function useAttendance(range: DateRange | null) {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const from = range?.from
  const to = range?.to

  useEffect(() => {
    if (!from || !to) {
      setRecords([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(
      collection(db, COLLECTIONS.attendance),
      where('date', '>=', from),
      where('date', '<=', to),
      orderBy('date'),
    )
    return onSnapshot(
      q,
      (snap) => {
        // Firestore rules cannot check that a date is a Sunday, so a crafted
        // write could sit in the collection on a Tuesday. The charts only
        // bucket real tracked Sundays; dropping the rest here keeps the totals
        // and the charts telling the same story instead of quietly disagreeing.
        setRecords(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as AttendanceRecord)
            .filter((r) => isTrackedSunday(r.date)),
        )
        // Clear any earlier failure, or one transient error pins a red banner
        // to the dashboard for the rest of the session even once data loads.
        setError(null)
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )
  }, [from, to])

  return { records, loading, error }
}
