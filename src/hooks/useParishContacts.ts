import { useCallback, useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { COLLECTIONS, db } from '../lib/firebase'

/**
 * Phone numbers, keyed by parish id. Admin-only by rule, so this is fetched
 * on demand rather than subscribed to from the public screens.
 */
export function useParishContacts(enabled = true) {
  const [phones, setPhones] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(enabled)

  const refresh = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, COLLECTIONS.parishContacts))
      const next: Record<string, string> = {}
      snap.forEach((d) => {
        next[d.id] = (d.data().phone as string) ?? ''
      })
      setPhones(next)
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { phones, loading, refresh }
}
