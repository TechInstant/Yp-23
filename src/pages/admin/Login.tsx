import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import Logo from '../../components/Logo'
import { Alert, Field, PasswordInput, Spinner } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'

/** Firebase auth error codes, translated into something a human can act on. */
function describe(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'That email and password do not match an admin account.'
    case 'auth/invalid-email':
      return 'That does not look like a valid email address.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes, or reset the password in Firebase.'
    case 'auth/network-request-failed':
      return 'No connection to Firebase. Check your internet and try again.'
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is disabled. Enable it in Firebase Console → Authentication → Sign-in method.'
    case 'auth/email-already-in-use':
      return 'An account already exists for that address — sign in instead.'
    case 'auth/weak-password':
      return 'Choose a password of at least 6 characters.'
    case 'auth/unauthorized-domain':
      return 'This web address is not authorised in Firebase. Add it under Authentication → Settings → Authorized domains.'
    default:
      return 'Could not sign in. Please try again.'
  }
}

export default function Login() {
  const { user, isAdmin, loading, signIn, signUp, resetPassword } = useAuth()
  const navigate = useNavigate()
  // An invite link carries the address it was issued for: ?invite=someone@x.com
  // Signing up with a different address silently grants nothing, since the
  // invitation is filed under the email — so prefill it and open on sign-up.
  const invited = new URLSearchParams(window.location.search).get('invite')?.trim().toLowerCase()

  const [mode, setMode] = useState<'signin' | 'signup'>(invited ? 'signup' : 'signin')
  const [email, setEmail] = useState(invited ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!loading && user && isAdmin) navigate('/admin/dashboard', { replace: true })
  }, [loading, user, isAdmin, navigate])

  if (loading) return <Spinner label="Checking your session…" />
  if (user && isAdmin) return <Navigate to="/admin/dashboard" replace />

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      // Signing up only creates a Firebase Auth account. It grants nothing on
      // its own — access appears only if a super admin has already filed an
      // invitation for this exact address, which AuthContext redeems on the
      // first sign-in.
      if (mode === 'signup') await signUp(email, password)
      else await signIn(email, password)
      // Deliberately no navigate() here. Firebase resolves this promise before
      // the role lookup has run, so redirecting now lands on the dashboard
      // while access is still unknown. The effect above navigates once the role
      // is settled; until then the spinner holds.
    } catch (err) {
      const code =
        typeof err === 'object' && err && 'code' in err ? String((err as { code: string }).code) : ''
      setError(describe(code))
    } finally {
      setBusy(false)
    }
  }

  async function handleReset() {
    setError(null)
    setNotice(null)
    if (!email.trim()) {
      setError('Type your email address first, then choose "Forgot password".')
      return
    }
    try {
      await resetPassword(email)
      setNotice(`If ${email.trim()} has an account, a reset link is on its way.`)
    } catch (err) {
      const code =
        typeof err === 'object' && err && 'code' in err ? String((err as { code: string }).code) : ''
      setError(describe(code))
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-navy-900">
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center">
            <Logo size="lg" inverted />
          </div>

          <div className="card p-6 sm:p-7">
            <h1 className="text-xl font-bold text-navy-900">
              {mode === 'signup' ? 'Create your admin account' : 'Provincial admin sign in'}
            </h1>
            <p className="mt-1.5 text-sm text-navy-600">
              {mode === 'signup'
                ? 'Use the exact email address your invitation was sent to. Access is granted automatically once you sign up.'
                : 'For province executives only. Parishes submit attendance without an account.'}
            </p>

            {invited && !user && (
              <div className="mt-5">
                <Alert tone="info" title="You have been invited">
                  Create your account with <strong>{invited}</strong>. Using any other address
                  will not grant access.
                </Alert>
              </div>
            )}

            {user && !isAdmin && (
              <div className="mt-5">
                <Alert tone="warning" title="Signed in, but not an admin">
                  {user.email} has no invitation on file. Ask a super admin to invite that exact
                  address, then reload this page.
                </Alert>
              </div>
            )}

            {error && (
              <div className="mt-5">
                <Alert tone="error">{error}</Alert>
              </div>
            )}
            {notice && (
              <div className="mt-5">
                <Alert tone="success">{notice}</Alert>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <Field label="Email address" required>
                <input
                  className="input"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </Field>

              <Field
                label="Password"
                required
                hint={mode === 'signup' ? 'At least 6 characters.' : undefined}
              >
                <PasswordInput
                  value={password}
                  onChange={setPassword}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  minLength={mode === 'signup' ? 6 : undefined}
                  required
                />
              </Field>

              <button type="submit" className="btn-primary w-full" disabled={busy}>
                {busy
                  ? mode === 'signup'
                    ? 'Creating account…'
                    : 'Signing in…'
                  : mode === 'signup'
                    ? 'Create account'
                    : 'Sign in'}
              </button>
            </form>

            <div className="mt-5 flex flex-col gap-2 border-t border-navy-100 pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                className="text-left font-medium text-navy-700 hover:text-navy-900"
                onClick={() => {
                  setMode(mode === 'signup' ? 'signin' : 'signup')
                  setError(null)
                  setNotice(null)
                }}
              >
                {mode === 'signup'
                  ? 'Already have an account? Sign in'
                  : 'Been invited? Create an account'}
              </button>
              {mode === 'signin' && (
                <button
                  type="button"
                  className="text-left text-navy-500 hover:text-navy-800"
                  onClick={() => void handleReset()}
                >
                  Forgot password
                </button>
              )}
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-navy-300">
            <Link to="/" className="hover:text-white">
              ← Back to the attendance portal
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
