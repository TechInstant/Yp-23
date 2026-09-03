import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

/**
 * A common paste error is to copy the values straight out of the
 * `firebaseConfig` object in the Firebase console, which drags the quotes and
 * the trailing comma along:
 *
 *     VITE_FIREBASE_API_KEY="AIzaSy…",     <-- wrong
 *     VITE_FIREBASE_API_KEY=AIzaSy…        <-- right
 *
 * dotenv only strips quotes when the value *ends* with one, so the comma leaves
 * every value literally quoted. Clean them here rather than letting an
 * `auth/invalid-api-key` crash take the whole page down.
 */
function clean(value: string | undefined): string {
  if (!value) return ''
  return value.trim().replace(/,\s*$/, '').replace(/^["']|["']$/g, '').trim()
}

const config: FirebaseOptions = {
  apiKey: clean(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: clean(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: clean(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: clean(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: clean(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: clean(import.meta.env.VITE_FIREBASE_APP_ID),
}

const ENV_NAMES: Record<string, string> = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  storageBucket: 'VITE_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'VITE_FIREBASE_APP_ID',
}

export const missingFirebaseConfig = Object.entries(config)
  .filter(([, v]) => !v)
  .map(([k]) => ENV_NAMES[k] ?? k)

/**
 * Initialisation is deliberately guarded. `getAuth()` throws synchronously on a
 * malformed API key, and because this module is imported at the top of the
 * graph that throw used to kill the render before App could show a diagnosis —
 * i.e. a blank white screen. Now the failure is captured and App renders it.
 */
let appInstance: FirebaseApp | null = null
let authInstance: Auth | null = null
let dbInstance: Firestore | null = null
let initError: string | null = null

if (missingFirebaseConfig.length === 0) {
  try {
    appInstance = initializeApp(config)
    authInstance = getAuth(appInstance)
    dbInstance = getFirestore(appInstance)
  } catch (err) {
    initError = err instanceof Error ? err.message : String(err)
  }
}

export const firebaseInitError = initError

/**
 * `app` and `db` are cast to non-null because every component that touches them
 * renders inside App.tsx, which refuses to render any screen while
 * `missingFirebaseConfig` is non-empty or `firebaseInitError` is set.
 *
 * `auth` is deliberately NOT cast. AuthProvider wraps <App /> in main.tsx, so it
 * mounts *outside* that guard and would happily call onAuthStateChanged(null)
 * on a build with no config — which throws and blanks the page instead of
 * showing the diagnosis. Honest typing forces that one call site to check.
 */
export const app = appInstance as FirebaseApp
export const auth: Auth | null = authInstance
export const db = dbInstance as Firestore

export const COLLECTIONS = {
  parishes: 'parishes',
  parishContacts: 'parishContacts',
  attendance: 'attendance',
  admins: 'admins',
  adminInvites: 'adminInvites',
} as const
