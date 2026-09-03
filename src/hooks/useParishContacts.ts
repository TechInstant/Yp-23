import { useCallback, useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { COLLECTIONS, db } from '../lib/firebase'
import type { ParishContact } from '../types'

/**
 * Contact cards keyed by parish id: phone number and the name of whoever last
 * filed a return. Admin-only by rule, so this is fetched on demand rather than
 * subscribed to from the public screens.
 */
export function useParishContacts(enabled = true) {
  const [contacts, setContacts] = useState<Record<string, ParishContact>>({})
  const [phones, setPhones] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, COLLECTIONS.parishContacts))
      const nextContacts: Record<string, ParishContact> = {}
      const nextPhones: Record<string, string> = {}
      snap.forEach((d) => {
        const data = d.data()
        nextContacts[d.id] = {
          id: d.id,
          phone: (data.phone as string) ?? '',
          pastorName: (data.pastorName as string) ?? '',
          lastSeenOn: data.lastSeenOn as string | undefined,
          updatedAt: data.updatedAt,
        }
        nextPhones[d.id] = (data.phone as string) ?? ''
      })
      setContacts(nextContacts)
      setPhones(nextPhones)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { contacts, phones, loading, error, refresh }
}
