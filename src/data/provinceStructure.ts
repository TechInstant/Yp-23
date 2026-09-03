import type { ChurchCategory, LocationCode } from '../types'

/**
 * Youth Province 23 in full: Province → Family → Zone → Area → Parish, exactly
 * as published in the two "Directory after Province Creation" documents.
 *
 * This is church structure only — parish names and where they sit. It carries
 * **no pastor names, no phone numbers and no addresses**: pastors supply those
 * themselves when they claim their parish, and the phone number goes straight
 * into the admin-only `parishContacts` collection. That is why this file is
 * safe to commit to a public repository.
 *
 * Keep it in step with the province as zones, areas and parishes are created.
 */

export interface AreaNode {
  area: string
  parishes: string[]
}

export interface ZoneNode {
  zone: string
  areas: AreaNode[]
}

export const PROVINCE_NAME = 'RCCG Youth Province 23'

export const PROVINCE_STRUCTURE: Record<LocationCode, ZoneNode[]> = {
  IFE: [
    {
      zone: 'KINGS PALACE ZONE',
      areas: [
        {
          area: 'KINGS PALACE AREA',
          parishes: ['KINGS PALACE', 'RCCG LIVING SEED CHURCH - THE MOVEMENT'],
        },
      ],
    },
    {
      zone: 'KING DOMINANT ARMY ZONE',
      areas: [
        {
          area: 'KING DOMINANT ARMY AREA',
          parishes: ['KING DOMINANT ARMY', 'KINGS PORCH', 'KINGS POWER'],
        },
        {
          area: 'SALVATION GARDEN AREA',
          parishes: ['SALVATION GARDEN', 'MARANATHA', 'UPPER ROOM ASSEMBLY'],
        },
      ],
    },
    {
      zone: 'KINGS LIGHT ZONE',
      areas: [
        { area: 'KINGS LIGHT AREA', parishes: ['KINGS LIGHT', 'KINGS HONOUR'] },
        { area: 'ZION AREA', parishes: ['ZION', 'KINGS FAMILY', 'TRUTH AND LIFE'] },
        {
          area: 'KINGS PRAISE AREA',
          parishes: ['KINGS PRAISE', 'KINGS PAVILION', 'RESURRECTION MORRO'],
        },
      ],
    },
    {
      zone: 'KINGS WORD ZONE',
      areas: [
        { area: 'KINGS WORD AREA', parishes: ['KINGS WORD', 'KINGS COURT ARENA'] },
        { area: 'KINGS THRONE AREA', parishes: ['KINGS THRONE', 'KINGS FAVOUR'] },
      ],
    },
  ],
  EDE: [
    {
      zone: 'EXCEL (YOUTH CHURCH) ZONE',
      areas: [
        {
          area: 'EXCEL (YOUTH CHURCH) AREA',
          parishes: [
            'EXCEL (YOUTH CHURCH)',
            'EXCELLENT GRACE ARENA',
            'HIS MAJESTY',
            'OVERFLOWING PARISH',
          ],
        },
        {
          area: 'MAGNIFY MERCY ARENA AREA',
          parishes: ['MAGNIFY MERCY ARENA', 'WINNERS ARENA'],
        },
        {
          // Printed after PREVAILERS FORT AREA in the Ede PDF, but numbered
          // area 3 and carrying serials 7-10, i.e. before JESUS GRACE ZONE —
          // so it belongs to this zone. Move it in Admin → Parishes if the
          // province says otherwise.
          area: 'GLORIOUS YOUTH ASSEMBLY AREA',
          parishes: [
            'GLORIOUS YOUTH ASSEMBLY',
            'COMFORTER',
            'RCCG WORD ASSEMBLY',
            "POTTER'S HOUSE PARISH",
          ],
        },
      ],
    },
    {
      zone: 'JESUS GRACE ZONE',
      areas: [
        { area: 'JESUS GRACE AREA', parishes: ['JESUS GRACE', 'DOMINION ARENA'] },
        {
          area: 'PREVAILERS FORT AREA',
          parishes: ['PREVAILERS FORT', 'THE PRECIOUS PARISH', 'TRINITY ASSEMBLY (BS)'],
        },
      ],
    },
  ],
}

/**
 * Listed in the Ife directory as "two more parishes newly planted yet to be
 * fixed" — no zone or area assigned yet.
 */
export const UNASSIGNED_PARISHES: { location: LocationCode; name: string }[] = [
  { location: 'IFE', name: 'POWER CATHEDRAL' },
  { location: 'IFE', name: 'LIGHTHOUSE' },
]

export const OTHER = '__other__'

/** Official zones for a location, plus any extra zones already in the database. */
export function zonesFor(location: LocationCode | '', fromDb: string[] = []): string[] {
  if (!location) return []
  const official = PROVINCE_STRUCTURE[location].map((z) => z.zone)
  const extra = fromDb.filter((z) => z && !official.includes(z))
  return [...official, ...extra.sort()]
}

/** Official areas for a zone, plus any extra areas already in the database. */
export function areasFor(
  location: LocationCode | '',
  zone: string,
  fromDb: string[] = [],
): string[] {
  if (!location || !zone) return []
  const official =
    PROVINCE_STRUCTURE[location].find((z) => z.zone === zone)?.areas.map((a) => a.area) ?? []
  const extra = fromDb.filter((a) => a && !official.includes(a))
  return [...official, ...extra.sort()]
}

/**
 * A church's role, worked out from the directory itself: the zone headquarters
 * is the church whose name is the zone name without the word "ZONE", and the
 * area headquarters likewise. So KINGS PALACE — in KINGS PALACE ZONE, KINGS
 * PALACE AREA — is all three at once, and is recorded at its highest role.
 */
export function categoryFor(name: string, zone: string, area: string): ChurchCategory {
  const n = name.trim().toUpperCase()
  if (zone && n === zone.trim().toUpperCase().replace(/\s+ZONE$/, '')) return 'ZONE'
  if (area && n === area.trim().toUpperCase().replace(/\s+AREA$/, '')) return 'AREA'
  return 'PARISH'
}

export interface DirectoryParish {
  name: string
  location: LocationCode
  zone: string
  area: string
  category: ChurchCategory
}

/** The whole directory flattened — what the admin "Load directory" action writes. */
export function flattenDirectory(): DirectoryParish[] {
  const out: DirectoryParish[] = []
  for (const location of Object.keys(PROVINCE_STRUCTURE) as LocationCode[]) {
    for (const zone of PROVINCE_STRUCTURE[location]) {
      for (const area of zone.areas) {
        for (const name of area.parishes) {
          out.push({
            name,
            location,
            zone: zone.zone,
            area: area.area,
            category: categoryFor(name, zone.zone, area.area),
          })
        }
      }
    }
  }
  for (const p of UNASSIGNED_PARISHES) {
    out.push({ name: p.name, location: p.location, zone: '', area: '', category: 'PARISH' })
  }
  return out
}

export const DIRECTORY_COUNT = flattenDirectory().length
