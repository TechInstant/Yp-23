import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { COLLECTIONS, db } from '../lib/firebase'
import type { SubmissionException } from '../types'

/**
 * Sundays a super admin has re-opened for a parish.
 *
 * Read by the public submission form as well as the admin screen, so it is
 * world-readable — the document says only "this parish may file for this
 * Sunday", which is not worth protecting. The collection stays small because
 * granting one is an exception by definition, so it is fetched whole rather
 * than queried per parish.
 */
export function useSubmissionExceptions() {
  const [exceptions, setExceptions] = useState<SubmissionException[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onSnapshot(
      collection(db, COLLECTIONS.submissionExceptions),
      (snap) => {
        setExceptions(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SubmissionException),
        )
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [])

  return { exceptions, loading }
}
