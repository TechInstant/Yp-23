/**
 * "Location" is the top-level split of the province — Ife and Ede. The two
 * source directories call these "families"; the province uses "location" on
 * the forms, so that is the word the interface uses everywhere. The stored
 * codes stay IFE / EDE.
 */
export type LocationCode = 'IFE' | 'EDE'

export const LOCATIONS: LocationCode[] = ['IFE', 'EDE']

export const LOCATION_LABEL: Record<LocationCode, string> = {
  IFE: 'Ife',
  EDE: 'Ede',
}

/**
 * What a church is within the province structure. One church can hold all
 * three roles at once — the zone headquarters is also an area headquarters and
 * a parish — so this records the *highest* role it holds, and a zonal pastor
 * submitting for his own church picks ZONE.
 */
export type ChurchCategory = 'ZONE' | 'AREA' | 'PARISH'

export const CATEGORIES: ChurchCategory[] = ['ZONE', 'AREA', 'PARISH']

export const CATEGORY_LABEL: Record<ChurchCategory, string> = {
  ZONE: 'Zonal church',
  AREA: 'Area church',
  PARISH: 'Parish',
}

export const CATEGORY_SHORT: Record<ChurchCategory, string> = {
  ZONE: 'Zone',
  AREA: 'Area',
  PARISH: 'Parish',
}

export type ParishStatus = 'active' | 'pending' | 'archived'

/** Publicly readable. Deliberately holds no phone number — see ParishContact. */
export interface Parish {
  id: string
  name: string
  pastorName: string
  location: LocationCode
  zone: string
  area: string
  category: ChurchCategory
  ordinationStatus: string
  /** null when the directory says "UNKNOWN". */
  yearOfOrdination: number | null
  lengthOfService: string
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
  /** `${parishId}_${date}` — one return per church per Sunday. */
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
  location: LocationCode
  zone: string
  area: string
  category: ChurchCategory
  /** YYYY-MM-DD, always a Sunday inside the tracking window. */
  date: string
  attendance: number
  note: string
  source: 'parish-form' | 'admin'
  createdAt?: unknown
  updatedAt?: unknown
}

export const ORDINATION_STATUSES = [
  'PASTOR',
  'ASSISTANT PASTOR',
  'DEACON',
  'DEACONESS',
  'BROTHER',
  'SISTER',
  'UNKNOWN',
] as const
