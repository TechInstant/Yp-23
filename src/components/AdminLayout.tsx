import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
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
  {
    to: '/admin/compare',
    label: 'Compare Sundays',
    icon: 'M4 18V9M10 18V5M16 18v-6M3 21h18',
  },
  {
    to: '/admin/admins',
    label: 'Admin access',
    icon: 'M12 3l7 4v5c0 4.4-3 8-7 9-4-1-7-4.6-7-9V7z',
    superOnly: true,
  },
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
  const { user, logout, isSuperAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const main = useRef<HTMLElement>(null)
  const [open, setOpen] = useState(false)

  // <main> scrolls, not the window, so the browser's own scroll restoration
  // does not apply: without this, opening a parish from halfway down the list
  // lands you halfway down the parish page.
  useEffect(() => {
    main.current?.scrollTo({ top: 0 })
  }, [location.pathname])

  // Close the drawer on Escape and stop the page behind it scrolling. Without
  // the lock, dragging the drawer scrolls the dashboard underneath it, which
  // reads as the menu being broken.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open])

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
        {NAV.filter((item) => !item.superOnly || isSuperAdmin).map((item) => (
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
        <p className="min-w-0 truncate px-3 text-xs text-navy-300" title={user?.email ?? ''}>
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
    // One viewport tall, and nothing here scrolls except <main>. That is what
    // keeps the header still: it is outside the scrolling element rather than
    // sticky inside it.
    <div className="app-shell flex overflow-hidden bg-navy-50">
      <aside className="hidden w-64 shrink-0 flex-col overflow-y-auto bg-navy-900 p-4 lg:flex">
        {sidebar}
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="flex w-[17rem] max-w-[85vw] flex-col overflow-y-auto bg-navy-900 p-4">
            {sidebar}
          </div>
          <button
            type="button"
            className="flex-1 bg-navy-950/50"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* shrink-0 so it keeps its height, and outside <main> so it is not part
            of what scrolls. */}
        <header className="z-30 flex shrink-0 items-center gap-3 border-b border-navy-100 bg-white px-4 py-3 lg:hidden">
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-navy-200 text-navy-700"
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

        {/*
          The only scrolling element in the admin area.

          overflow-x is pinned to hidden on purpose. Setting only overflow-y
          makes the other axis compute to `auto`, so a single overflowing child
          — a wide table, a long phone number in a button — lets the entire page
          be dragged sideways. Tables keep their own overflow-x-auto wrapper, so
          they still scroll; it is only the page that is held still.
        */}
        <main
          ref={main}
          className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-4 sm:p-6 lg:p-8"
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
