/**
 * Loads seed/parishes.json into Firestore.
 *
 *   1. Download a service-account key:
 *      Firebase Console -> Project settings -> Service accounts -> Generate new private key
 *      Save it as service-account.json in the project root (it is gitignored).
 *   2. npm run seed
 *
 * Safe to re-run: documents are keyed by the stable `id` in the JSON, so a
 * second run updates rather than duplicates. Existing attendance is untouched.
 * Pass --dry to print what would happen without writing.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { initAdmin, root } from './_admin-app.mjs'

const dryRun = process.argv.includes('--dry')

const { projectId, via } = await initAdmin()
const db = getFirestore()

const { parishes, notes } = JSON.parse(
  await readFile(path.join(root, 'seed', 'parishes.json'), 'utf8'),
)

console.log(`\nSeeding ${parishes.length} parishes into project "${projectId}" (via ${via})`)
if (dryRun) console.log('(dry run — nothing will be written)\n')

let written = 0
let contacts = 0

// 500 writes per batch is the Firestore limit; each parish costs up to two.
for (let i = 0; i < parishes.length; i += 200) {
  const chunk = parishes.slice(i, i + 200)
  const batch = db.batch()

  for (const p of chunk) {
    const { id, phone, ...rest } = p
    batch.set(
      db.collection('parishes').doc(id),
      {
        ...rest,
        source: 'directory-import',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    written += 1

    if (phone) {
      batch.set(
        db.collection('parishContacts').doc(id),
        {
          phone,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
      contacts += 1
    }
  }

  if (!dryRun) await batch.commit()
  console.log(`  …${Math.min(i + chunk.length, parishes.length)}/${parishes.length}`)
}

console.log(`\nDone. ${written} parishes, ${contacts} phone numbers.`)
if (notes?.length) {
  console.log('\nCheck these before going live:')
  for (const note of notes) console.log(`  • ${note}`)
}
console.log()
process.exit(0)
