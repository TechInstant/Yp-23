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

  const zonesByLocation = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const p of parishes) {
      if (!p.zone) continue
      const list = (map[p.location] ??= [])
      if (!list.includes(p.zone)) list.push(p.zone)
    }
    Object.values(map).forEach((l) => l.sort())
    return map
  }, [parishes])

  const areasByZone = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const p of parishes) {
      if (!p.zone || !p.area) continue
      const list = (map[p.zone] ??= [])
      if (!list.includes(p.area)) list.push(p.area)
    }
    Object.values(map).forEach((l) => l.sort())
    return map
  }, [parishes])

  return { parishes, active, zonesByLocation, areasByZone, loading, error }
}
