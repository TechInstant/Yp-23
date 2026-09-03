import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Alert, Spinner } from './ui'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading, logout } = useAuth()
  const location = useLocation()

  if (loading) return <Spinner label="Checking your access…" />

  if (!user) return <Navigate to="/admin" replace state={{ from: location.pathname }} />

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <Alert tone="error" title="This account is not a provincial admin">
          <p>
            You are signed in as <strong>{user.email}</strong>, but that address has not been
            added to the admin list.
          </p>
          <p className="mt-2">
            Ask an existing admin to run <code>npm run make-admin -- {user.email}</code>, or to
            add a document with your user ID to the <code>admins</code> collection.
          </p>
          <button type="button" className="btn-ghost mt-4" onClick={() => void logout()}>
            Sign out
          </button>
        </Alert>
      </div>
    )
  }

  return <>{children}</>
}
