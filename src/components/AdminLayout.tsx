import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Logo from './Logo'

const NAV = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: 'M3 12h4l3 7 4-14 3 7h4' },
  {
    to: '/admin/pastors',
    label: 'Pastors',
    icon: 'M16 20v-1a4 4 0 00-4-4H8a4 4 0 00-4 4v1M10 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7M17 4.5a3 3 0 010 6M20 20v-1a3.5 3.5 0 00-2.5-3.4',
  },
  { to: '/admin/parishes', label: 'Parishes', icon: 'M4 20V9l6-4 6 4v11M9 20v-5h4v5' },
  { to: '/admin/attendance', label: 'Attendance', icon: 'M4 5h14M4 10h14M4 15h9' },
]

function navClass({ isActive }: { isActive: boolean }) {
  return [
    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
    isActive
      ? 'bg-navy-800 text-white'
      : 'text-navy-200 hover:bg-navy-800/60 hover:text-white',
  ].join(' ')
}

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/admin', { replace: true })
  }

  const sidebar = (
    <>
      <div className="px-2 pb-6 pt-1">
        <Link to="/" className="block rounded-lg bg-white/5 p-3">
          <Logo size="sm" inverted />
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={navClass}
            onClick={() => setOpen(false)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d={item.icon}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 pt-4">
        <p className="truncate px-3 text-xs text-navy-300" title={user?.email ?? ''}>
          {user?.email}
        </p>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-navy-200 hover:bg-navy-800/60 hover:text-white"
        >
          Sign out
        </button>
      </div>
    </>
  )

  return (
    <div className="flex min-h-screen bg-navy-50">
      <aside className="hidden w-64 shrink-0 flex-col bg-navy-900 p-4 lg:flex">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="flex w-64 flex-col bg-navy-900 p-4">{sidebar}</div>
          <button
            type="button"
            className="flex-1 bg-navy-950/50"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-navy-100 bg-white px-4 py-3 lg:hidden">
          <button
            type="button"
            className="rounded-lg border border-navy-200 p-2 text-navy-700"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path
                d="M3 6h14M3 10h14M3 14h14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <span className="font-semibold text-navy-900">Provincial admin</span>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
