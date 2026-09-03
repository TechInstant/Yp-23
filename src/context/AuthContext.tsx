import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, COLLECTIONS, db } from '../lib/firebase'

export type AdminRole = 'super' | 'admin'

interface AuthState {
  user: User | null
  /** True when the signed-in uid has a doc in `admins`. */
  isAdmin: boolean
  /** Super admins can grant and revoke access; plain admins cannot. */
  isSuperAdmin: boolean
  role: AdminRole | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

/**
 * Turns a pending invitation into real admin access.
 *
 * A browser cannot look a user up by email, so access cannot be granted *to*
 * someone directly — instead a super admin files an invitation under their
 * email and the invitee redeems it here, on their first sign-in. The role comes
 * from the invitation and is re-checked by firestore.rules, so redeeming an
 * invitation cannot award more than was offered.
 */
async function redeemInvite(user: User): Promise<AdminRole | null> {
  const email = user.email?.trim().toLowerCase()
  if (!email) return null

  const inviteRef = doc(db, COLLECTIONS.adminInvites, email)
  const invite = await getDoc(inviteRef)
  if (!invite.exists()) return null

  const role: AdminRole = invite.data().role === 'super' ? 'super' : 'admin'
  await setDoc(doc(db, COLLECTIONS.admins, user.uid), {
    email,
    role,
    grantedAt: serverTimestamp(),
    grantedBy: invite.data().invitedBy ?? '',
  })

  // Spent invitations are cleared so the list only ever shows what is still
  // outstanding. Failure here is harmless — the admin record already exists.
  await deleteDoc(inviteRef).catch(() => undefined)
  return role
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<AdminRole | null>(null)
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
        setRole(null)
        setLoading(false)
        return
      }
      try {
        // Firestore rules enforce this too; the check here is only so the UI can
        // say "not an admin" instead of showing an empty dashboard.
        const snap = await getDoc(doc(db, COLLECTIONS.admins, next.uid))
        if (snap.exists()) {
          // An admin record written by hand in the Firebase console has no
          // role. Treat it as super, matching isSuperAdmin() in the rules —
          // otherwise the very first admin could never manage anyone else.
          setRole(snap.data().role === 'admin' ? 'admin' : 'super')
        } else {
          setRole(await redeemInvite(next))
        }
      } catch {
        setRole(null)
      } finally {
        setLoading(false)
      }
    })
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      isAdmin: role !== null,
      isSuperAdmin: role === 'super',
      role,
      loading,
      signIn: async (email, password) => {
        if (!auth) throw new Error('Firebase is not configured in this build.')
        await signInWithEmailAndPassword(auth, email.trim(), password)
      },
      signUp: async (email, password) => {
        if (!auth) throw new Error('Firebase is not configured in this build.')
        await createUserWithEmailAndPassword(auth, email.trim(), password)
      },
      resetPassword: async (email) => {
        if (!auth) throw new Error('Firebase is not configured in this build.')
        await sendPasswordResetEmail(auth, email.trim())
      },
      logout: async () => {
        if (!auth) return
        await signOut(auth)
      },
    }),
    [user, role, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
