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
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
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
  /** Sends a real sign-in link to the invitee, straight from Firebase. */
  sendInviteEmail: (email: string) => Promise<void>
  /** True when the current URL is a sign-in link Firebase issued. */
  isEmailLink: () => boolean
  /** Completes sign-in from that link. Returns the address signed in. */
  completeEmailLinkSignIn: (fallbackEmail?: string) => Promise<string>
  logout: () => Promise<void>
}

/**
 * Where the invitee's address is stashed between requesting the link and
 * clicking it. Firebase requires the email to complete the sign-in, and on the
 * same device this saves asking for it twice. On a different device the address
 * comes from the `invite` parameter carried in the link instead.
 */
const EMAIL_LINK_KEY = 'yp23:emailForSignIn'

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
      // Signing in leaves `loading` false from the signed-out state, while the
      // role lookup below is still in flight. Without flipping it back on, that
      // gap renders as user-present-but-not-admin — so "This account is not a
      // provincial admin" flashes up before the dashboard appears. Stay loading
      // until the role is actually known.
      setLoading(true)
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

      sendInviteEmail: async (email) => {
        if (!auth) throw new Error('Firebase is not configured in this build.')
        const clean = email.trim().toLowerCase()
        // The address rides along in the link so it still works when the
        // invitee opens it on a different device from the one it was requested
        // on — localStorage would be empty there, and Firebase cannot complete
        // the sign-in without knowing the email.
        await sendSignInLinkToEmail(auth, clean, {
          url: `${window.location.origin}/admin?invite=${encodeURIComponent(clean)}`,
          handleCodeInApp: true,
        })
        try {
          window.localStorage.setItem(EMAIL_LINK_KEY, clean)
        } catch {
          // Private browsing can refuse storage; the link carries the address.
        }
      },

      isEmailLink: () => Boolean(auth) && isSignInWithEmailLink(auth!, window.location.href),

      completeEmailLinkSignIn: async (fallbackEmail) => {
        if (!auth) throw new Error('Firebase is not configured in this build.')
        let stored: string | null = null
        try {
          stored = window.localStorage.getItem(EMAIL_LINK_KEY)
        } catch {
          stored = null
        }
        const target = (fallbackEmail ?? stored ?? '').trim().toLowerCase()
        if (!target) throw new Error('missing-email')

        const result = await signInWithEmailLink(auth, target, window.location.href)
        try {
          window.localStorage.removeItem(EMAIL_LINK_KEY)
        } catch {
          /* nothing to clean up */
        }
        return result.user.email ?? target
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
