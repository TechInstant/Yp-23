export type ParishStatus = 'active' | 'pending' | 'archived'

/**
 * A parish. Deliberately flat: just the name and who is in charge.
 *
 * There is no location / zone / area classification. The province asked for a
 * plain list of parishes, and the returns are read per parish and province-wide
 * — no grouping in between. Nothing here is personal except pastorName, which
 * the pastor supplies themselves; the phone number lives in ParishContact,
 * which only admins can read.
 */
export interface Parish {
  id: string
  name: string
  pastorName: string
  status: ParishStatus
  source: 'directory-import' | 'self-registration' | 'admin'
  createdAt?: unknown
  updatedAt?: unknown
}

/**
 * Admin-only. One doc per parish, same id. Refreshed from the details a pastor
 * types when submitting, so the province's contact list stays current instead
 * of decaying into the numbers that were true in 2026.
 */
export interface ParishContact {
  id: string
  phone: string
  pastorName: string
  /** ISO date of the return that last refreshed this contact. */
  lastSeenOn?: string
  updatedAt?: unknown
}

export interface AttendanceRecord {
  /** `${parishId}_${date}` — one return per parish per Sunday. */
  id: string
  parishId: string
  /** Denormalised so the admin tables and CSV export need no join. */
  parishName: string
  /**
   * Who filed this return. Captured on every submission because the pastor in
   * charge changes over a three-year exercise, and the province needs to know
   * who actually sent each week's figure.
   *
   * The phone number deliberately does NOT live here — attendance is publicly
   * readable. It goes to parishContacts, which only admins can read.
   */
  pastorName: string
  /** YYYY-MM-DD, always a Sunday inside the tracking window. */
  date: string
  attendance: number
  note: string
  source: 'parish-form' | 'admin'
  createdAt?: unknown
  updatedAt?: unknown
}
