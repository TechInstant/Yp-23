/**
 * Credential resolution for the admin scripts, in order of preference:
 *
 *   1. service-account.json in the project root (or GOOGLE_APPLICATION_CREDENTIALS).
 *   2. Application Default Credentials — `gcloud auth application-default login`.
 *      Use this when the organisation policy
 *      `constraints/iam.disableServiceAccountKeyCreation` blocks key downloads,
 *      which is the default on many Google Workspace orgs.
 *
 * If neither is available the scripts are simply unusable, and everything they
 * do can be done from the Firebase console plus the admin panel instead — see
 * "No service account?" in the README.
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { applicationDefault, cert, initializeApp } from 'firebase-admin/app'

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Reads VITE_FIREBASE_PROJECT_ID out of .env without pulling in a dotenv dep. */
async function projectIdFromEnvFile() {
  try {
    const text = await readFile(path.join(root, '.env'), 'utf8')
    const line = text.split(/\r?\n/).find((l) => l.startsWith('VITE_FIREBASE_PROJECT_ID='))
    if (!line) return null
    return line.slice('VITE_FIREBASE_PROJECT_ID='.length).trim().replace(/,\s*$/, '').replace(/^["']|["']$/g, '')
  } catch {
    return null
  }
}

export async function initAdmin() {
  const keyPath = path.resolve(
    root,
    process.env.GOOGLE_APPLICATION_CREDENTIALS ?? './service-account.json',
  )

  try {
    const serviceAccount = JSON.parse(await readFile(keyPath, 'utf8'))
    initializeApp({ cert: cert(serviceAccount) })
    return { projectId: serviceAccount.project_id, via: 'service-account.json' }
  } catch {
    // fall through to ADC
  }

  const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? (await projectIdFromEnvFile())
  if (!projectId) {
    console.error(
      '\nNo credentials found.\n\n' +
        `  Looked for a key at: ${keyPath}\n` +
        '  and could not determine a project id for Application Default Credentials.\n\n' +
        'Either:\n' +
        '  • download a key (Project settings -> Service accounts -> Generate new private key), or\n' +
        '  • run:  gcloud auth application-default login\n' +
        '    and make sure VITE_FIREBASE_PROJECT_ID is set in .env, or\n' +
        '  • skip these scripts entirely — see "No service account?" in the README.\n',
    )
    process.exit(1)
  }

  try {
    initializeApp({ credential: applicationDefault(), projectId })
    return { projectId, via: 'application default credentials' }
  } catch (err) {
    console.error(
      '\nCould not authenticate with Application Default Credentials.\n' +
        `  ${err instanceof Error ? err.message : String(err)}\n\n` +
        'Run:  gcloud auth application-default login\n' +
        'Or skip these scripts — see "No service account?" in the README.\n',
    )
    process.exit(1)
  }
}
