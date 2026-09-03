/**
 * The province's parish list — names only.
 *
 * Transcribed from the two RCCG "Directory of ... Family after Province
 * Creation - Youth 23" PDFs. The zone and area columns in those documents are
 * deliberately NOT carried over: the province wants a flat list of parishes,
 * with returns read per parish and province-wide.
 *
 * No pastor names and no phone numbers live here. Pastors enter their own, so
 * this file is safe in a public repository.
 *
 * The admin "Load province directory" button writes exactly this list.
 */

/** Parishes already established when the province was created. */
export const DIRECTORY_PARISHES: string[] = [
  'COMFORTER',
  'DOMINION ARENA',
  'EXCEL (YOUTH CHURCH)',
  'EXCELLENT GRACE ARENA',
  'GLORIOUS YOUTH ASSEMBLY',
  'HIS MAJESTY',
  'JESUS GRACE',
  'KING DOMINANT ARMY',
  'KINGS COURT ARENA',
  'KINGS FAMILY',
  'KINGS FAVOUR',
  'KINGS HONOUR',
  'KINGS LIGHT',
  'KINGS PALACE',
  'KINGS PAVILION',
  'KINGS PORCH',
  'KINGS POWER',
  'KINGS PRAISE',
  'KINGS THRONE',
  'KINGS WORD',
  'MAGNIFY MERCY ARENA',
  'MARANATHA',
  'OVERFLOWING PARISH',
  "POTTER'S HOUSE PARISH",
  'PREVAILERS FORT',
  'RCCG LIVING SEED CHURCH - THE MOVEMENT',
  'RCCG WORD ASSEMBLY',
  'RESURRECTION MORRO',
  'SALVATION GARDEN',
  'THE PRECIOUS PARISH',
  'TRINITY ASSEMBLY (BS)',
  'TRUTH AND LIFE',
  'UPPER ROOM ASSEMBLY',
  'WINNERS ARENA',
  'ZION',
]

/**
 * "Two more parishes newly planted yet to be fixed" in the Ife directory. They
 * load as `pending` so the province confirms them before they appear on the
 * attendance form.
 */
export const NEWLY_PLANTED: string[] = ['POWER CATHEDRAL', 'LIGHTHOUSE']

export interface DirectoryParish {
  name: string
  status: 'active' | 'pending'
}

/** The whole directory — what the admin "Load province directory" action writes. */
export function flattenDirectory(): DirectoryParish[] {
  return [
    ...DIRECTORY_PARISHES.map((name) => ({ name, status: 'active' as const })),
    ...NEWLY_PLANTED.map((name) => ({ name, status: 'pending' as const })),
  ]
}

export const DIRECTORY_COUNT = DIRECTORY_PARISHES.length + NEWLY_PLANTED.length
