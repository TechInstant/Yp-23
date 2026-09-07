import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { COLLECTIONS, db } from '../lib/firebase'
import { todayISO } from '../lib/sundays'
import type { Announcement } from '../types'

/**
 * Announcements, and the subset showing right now.
 *
 * The whole collection is read rather than queried by date: it is a handful of
 * documents, and filtering client-side avoids a composite index plus the
 * awkwardness of a range query on two different fields. Expiry is by date
 * window, so an announcement stops on its own without anyone deleting it.
 */
export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onSnapshot(
      collection(db, COLLECTIONS.announcements),
      (snap) => {
        setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Announcement))
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [])

  const live = useMemo(() => {
    const today = todayISO()
    return announcements
      .filter((a) => a.showFrom <= today && a.showUntil >= today)
      .sort((a, b) => a.showFrom.localeCompare(b.showFrom))
  }, [announcements])

  const scheduled = useMemo(
    () => [...announcements].sort((a, b) => b.showFrom.localeCompare(a.showFrom)),
    [announcements],
  )

  return { announcements: scheduled, live, loading }
}
