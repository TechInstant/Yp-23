import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
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

/**
 * Both spellings are accepted: the canonical `VITE_FIREBASE_API_KEY` and the
 * shorter `VITE_API_KEY`. Firebase's own console labels these keys `apiKey`,
 * `authDomain` and so on, so dropping the FIREBASE_ segment is the natural
 * thing to type — and the failure it caused was miserable to diagnose, because
 * a name mismatch makes *every* value vanish at once and looks identical to
 * "the variables were never saved".
 *
 * Each pair is referenced statically. Vite substitutes `import.meta.env.VITE_X`
 * textually at build time, so a computed lookup like `import.meta.env[name]`
 * would silently yield undefined in the production bundle.
 */
const config: FirebaseOptions = {
  apiKey: clean(import.meta.env.VITE_FIREBASE_API_KEY) || clean(import.meta.env.VITE_API_KEY),
  authDomain:
    clean(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN) || clean(import.meta.env.VITE_AUTH_DOMAIN),
  projectId:
    clean(import.meta.env.VITE_FIREBASE_PROJECT_ID) || clean(import.meta.env.VITE_PROJECT_ID),
  storageBucket:
    clean(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET) ||
    clean(import.meta.env.VITE_STORAGE_BUCKET),
  messagingSenderId:
    clean(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID) ||
    clean(import.meta.env.VITE_MESSAGING_SENDER_ID),
  appId: clean(import.meta.env.VITE_FIREBASE_APP_ID) || clean(import.meta.env.VITE_APP_ID),
}

const ENV_NAMES: Record<string, string> = {
  apiKey: 'VITE_FIREBASE_API_KEY (or VITE_API_KEY)',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN (or VITE_AUTH_DOMAIN)',
  projectId: 'VITE_FIREBASE_PROJECT_ID (or VITE_PROJECT_ID)',
  storageBucket: 'VITE_FIREBASE_STORAGE_BUCKET (or VITE_STORAGE_BUCKET)',
  messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID (or VITE_MESSAGING_SENDER_ID)',
  appId: 'VITE_FIREBASE_APP_ID (or VITE_APP_ID)',
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

    /*
     * App Check — the only defence against scripted abuse of the open write
     * paths, and free on the Spark plan with reCAPTCHA v3.
     *
     * The parish form takes no login, so without this anyone can post returns
     * or overwrite contact numbers with a script. reCAPTCHA v3 is invisible:
     * no puzzle, no checkbox, nothing for a pastor to do.
     *
     * Started only when a site key is present, so a build without one keeps
     * working. That matters for the rollout order: ship the key, confirm
     * requests are being verified in the console, and only then turn on
     * enforcement — enforcing first would lock every visitor out.
     */
    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY?.trim()
    if (siteKey) {
      // A debug token lets localhost through without a real reCAPTCHA
      // assessment; the console has to be told to trust the printed token.
      if (import.meta.env.DEV) {
        ;(self as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN = true
      }
      initializeAppCheck(appInstance, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true,
      })
    }

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
  /** Doc id is `{parishId}_{date}` — the same id as the return it unlocks. */
  submissionExceptions: 'submissionExceptions',
} as const
