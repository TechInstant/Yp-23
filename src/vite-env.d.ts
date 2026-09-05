/// <reference types="vite/client" />

/**
 * Both spellings are supported — see src/lib/firebase.ts. The FIREBASE_ form is
 * canonical; the short form exists because it is what the Firebase console's
 * own config keys look like, and getting it wrong hides every value at once.
 */
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string

  readonly VITE_API_KEY?: string
  readonly VITE_AUTH_DOMAIN?: string
  readonly VITE_PROJECT_ID?: string
  readonly VITE_STORAGE_BUCKET?: string
  readonly VITE_MESSAGING_SENDER_ID?: string
  readonly VITE_APP_ID?: string

  /** reCAPTCHA v3 site key. App Check stays off until this is set. */
  readonly VITE_RECAPTCHA_SITE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
