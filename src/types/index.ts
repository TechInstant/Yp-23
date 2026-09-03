export type Family = 'IFE' | 'EDE'

export const FAMILIES: Family[] = ['IFE', 'EDE']

export const FAMILY_LABEL: Record<Family, string> = {
  IFE: 'Ife Family',
  EDE: 'Ede Family',
}

export type ParishStatus = 'active' | 'pending' | 'archived'

/** Publicly readable. Deliberately holds no phone number — see ParishContact. */
export interface Parish {
  id: string
  name: string
  pastorName: string
  address: string
  family: Family
  zone: string
  area: string
  ordinationStatus: string
  /** null when the directory says "UNKNOWN". */
  yearOfOrdination: number | null
  lengthOfService: string
  status: ParishStatus
  source: 'directory-import' | 'self-registration' | 'admin'
  createdAt?: unknown
  updatedAt?: unknown
}

/** Admin-only. One doc per parish, same id. */
export interface ParishContact {
  id: string
  phone: string
}

export interface AttendanceRecord {
  /** `${parishId}_${date}` — one return per parish per Sunday. */
  id: string
  parishId: string
  /** Denormalised so the admin tables and CSV export need no join. */
  parishName: string
  family: Family
  zone: string
  area: string
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
