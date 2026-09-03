import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { COLLECTIONS, db } from '../lib/firebase'
import type { Parish } from '../types'

/**
 * Live list of every parish. It is a small collection (tens of documents) and
 * every screen needs it, so one real-time subscription is cheaper and simpler
 * than page-by-page fetching.
 */
export function useParishes() {
  const [parishes, setParishes] = useState<Parish[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, COLLECTIONS.parishes), orderBy('name'))
    return onSnapshot(
      q,
      (snap) => {
        setParishes(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Parish))
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )
  }, [])

  const active = useMemo(() => parishes.filter((p) => p.status === 'active'), [parishes])

  return { parishes, active, loading, error }
}
