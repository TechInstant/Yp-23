import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { COLLECTIONS, db } from '../lib/firebase'
import type { AttendanceRecord } from '../types'

/**
 * Returns for a handful of specific Sundays.
 *
 * Uses an `in` filter rather than a date range, because the two Sundays being
 * compared are often months apart — a range query would read every return
 * between them just to show two columns. Firestore caps `in` at 30 values,
 * which is far more than a comparison needs.
 */
export function useAttendanceOnDates(dates: string[]) {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Join the dates so the effect re-runs on content, not on array identity.
  const key = dates.filter(Boolean).sort().join(',')

  useEffect(() => {
    const wanted = key ? key.split(',') : []
    if (wanted.length === 0) {
      setRecords([])
      setLoading(false)
      return
    }

    setLoading(true)
    const q = query(
      collection(db, COLLECTIONS.attendance),
      where('date', 'in', wanted.slice(0, 30)),
    )
    return onSnapshot(
      q,
      (snap) => {
        setRecords(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AttendanceRecord))
        setError(null)
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )
  }, [key])

  return { records, loading, error }
}
