import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, COLLECTIONS, db } from '../lib/firebase'

interface AuthState {
  user: User | null
  /** True only when the signed-in uid has a doc in `admins`. */
  isAdmin: boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // This provider sits ABOVE <App /> in main.tsx, so it mounts before App can
    // render the "Firebase is not configured" screen. When the build has no
    // config baked in, `auth` is null — calling onAuthStateChanged on it throws
    // and takes the whole page down with a blank screen, hiding the very
    // diagnosis the user needs. Bail out quietly and let App do the explaining.
    if (!auth) {
      setLoading(false)
      return
    }
    return onAuthStateChanged(auth, async (next) => {
      setUser(next)
      if (!next) {
        setIsAdmin(false)
        setLoading(false)
        return
      }
      try {
        // Firestore rules enforce this too; the check here is only so the UI can
        // say "not an admin" instead of showing an empty dashboard.
        const snap = await getDoc(doc(db, COLLECTIONS.admins, next.uid))
        setIsAdmin(snap.exists())
      } catch {
        setIsAdmin(false)
      } finally {
        setLoading(false)
      }
    })
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      isAdmin,
      loading,
      signIn: async (email, password) => {
        if (!auth) throw new Error('Firebase is not configured in this build.')
        await signInWithEmailAndPassword(auth, email.trim(), password)
      },
      logout: async () => {
        if (!auth) return
        await signOut(auth)
      },
    }),
    [user, isAdmin, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
