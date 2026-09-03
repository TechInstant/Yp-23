import { Navigate, Route, Routes } from 'react-router-dom'
import AdminLayout from './components/AdminLayout'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { Alert } from './components/ui'
import { firebaseInitError, missingFirebaseConfig } from './lib/firebase'
import Directory from './pages/Directory'
import Home from './pages/Home'
import RegisterParish from './pages/RegisterParish'
import SubmitAttendance from './pages/SubmitAttendance'
import AdminsAdmin from './pages/admin/AdminsAdmin'
import AttendanceAdmin from './pages/admin/AttendanceAdmin'
import Dashboard from './pages/admin/Dashboard'
import Login from './pages/admin/Login'
import ParishDetail from './pages/admin/ParishDetail'
import ParishesAdmin from './pages/admin/ParishesAdmin'
import Pastors from './pages/admin/Pastors'

export default function App() {
  if (missingFirebaseConfig.length > 0) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <Alert tone="error" title="Firebase is not configured">
          <p>These environment variables are missing from the build:</p>
          <ul className="mt-2 list-inside list-disc font-mono text-xs">
            {missingFirebaseConfig.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
          <p className="mt-3">
            Locally: copy <code>.env.example</code> to <code>.env</code> and fill it in. On
            Render: add them under Environment, then trigger a new deploy — Vite bakes them in
            at build time, so restarting alone will not pick them up.
          </p>
          <p className="mt-3">
            Paste the values bare — no quotes and no trailing comma:{' '}
            <code>VITE_FIREBASE_API_KEY=AIzaSy…</code>
          </p>
        </Alert>
      </div>
    )
  }

  if (firebaseInitError) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <Alert tone="error" title="Firebase rejected this configuration">
          <p className="font-mono text-xs">{firebaseInitError}</p>
          <p className="mt-3">
            The values in <code>.env</code> are present but at least one is wrong. The usual
            cause is copying them out of the console&apos;s <code>firebaseConfig</code> object
            with the quotes and comma attached, or a project that was deleted or renamed.
          </p>
          <p className="mt-3">
            Recheck them under Firebase Console → Project settings → General → Your apps, then
            restart <code>npm run dev</code>.
          </p>
        </Alert>
      </div>
    )
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="submit" element={<SubmitAttendance />} />
        <Route path="register" element={<RegisterParish />} />
        <Route path="directory" element={<Directory />} />
      </Route>

      <Route path="/admin">
        <Route index element={<Login />} />
        <Route
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="pastors" element={<Pastors />} />
          <Route path="parishes" element={<ParishesAdmin />} />
          <Route path="parishes/:parishId" element={<ParishDetail />} />
          <Route path="attendance" element={<AttendanceAdmin />} />
          <Route path="admins" element={<AdminsAdmin />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
