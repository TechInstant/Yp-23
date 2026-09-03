/**
 * Grants provincial-admin access to an email address.
 *
 *   npm run make-admin -- pastor@example.com
 *   npm run make-admin -- pastor@example.com "Temp#Pass123"   (creates the user too)
 *   npm run make-admin -- --list
 *   npm run make-admin -- --remove pastor@example.com
 *
 * Admin access is simply a document in the `admins` collection keyed by the
 * user's Firebase Auth uid — that is exactly what firestore.rules checks.
 */
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { initAdmin } from './_admin-app.mjs'

await initAdmin()
const auth = getAuth()
const db = getFirestore()

const args = process.argv.slice(2)

if (args.includes('--list')) {
  const snap = await db.collection('admins').get()
  if (snap.empty) {
    console.log('\nNo admins yet. Add one with:  npm run make-admin -- you@example.com\n')
  } else {
    console.log(`\n${snap.size} admin(s):`)
    snap.forEach((d) => console.log(`  • ${d.data().email ?? '(no email on record)'}  [${d.id}]`))
    console.log()
  }
  process.exit(0)
}

const removing = args.includes('--remove')
const [email, password] = args.filter((a) => !a.startsWith('--'))

if (!email) {
  console.error('\nUsage: npm run make-admin -- <email> [password]\n')
  process.exit(1)
}

let user
try {
  user = await auth.getUserByEmail(email)
} catch {
  if (removing) {
    console.error(`\nNo Firebase user with the email ${email}.\n`)
    process.exit(1)
  }
  if (!password) {
    console.error(
      `\nNo Firebase user with the email ${email}.\n` +
        `Pass a password to create one:\n  npm run make-admin -- ${email} "SomeStrongPassword"\n`,
    )
    process.exit(1)
  }
  user = await auth.createUser({ email, password, emailVerified: false })
  console.log(`Created Firebase user ${email}`)
}

if (removing) {
  await db.collection('admins').doc(user.uid).delete()
  console.log(`\n${email} is no longer a provincial admin.\n`)
  process.exit(0)
}

await db.collection('admins').doc(user.uid).set(
  {
    email,
    grantedAt: FieldValue.serverTimestamp(),
  },
  { merge: true },
)

console.log(`\n${email} can now sign in at /admin.  (uid ${user.uid})\n`)
process.exit(0)
