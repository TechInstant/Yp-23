import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import Logo from '../../components/Logo'
import { Alert, Field, Spinner } from '../../components/ui'
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
    default:
      return 'Could not sign in. Please try again.'
  }
}

export default function Login() {
  const { user, isAdmin, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!loading && user && isAdmin) navigate('/admin/dashboard', { replace: true })
  }, [loading, user, isAdmin, navigate])

  if (loading) return <Spinner label="Checking your session…" />
  if (user && isAdmin) return <Navigate to="/admin/dashboard" replace />

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signIn(email, password)
      navigate('/admin/dashboard', { replace: true })
    } catch (err) {
      const code =
        typeof err === 'object' && err && 'code' in err ? String((err as { code: string }).code) : ''
      setError(describe(code))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-navy-900">
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center">
            <Logo size="lg" inverted />
          </div>

          <div className="card p-7">
            <h1 className="text-xl font-bold text-navy-900">Provincial admin sign in</h1>
            <p className="mt-1.5 text-sm text-navy-600">
              For province and family executives only. Parishes submit attendance without an
              account.
            </p>

            {user && !isAdmin && (
              <div className="mt-5">
                <Alert tone="warning" title="Signed in, but not an admin">
                  {user.email} is not on the admin list.
                </Alert>
              </div>
            )}

            {error && (
              <div className="mt-5">
                <Alert tone="error">{error}</Alert>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <Field label="Email address" required>
                <input
                  className="input"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </Field>

              <Field label="Password" required>
                <input
                  className="input"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </Field>

              <button type="submit" className="btn-primary w-full" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
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
