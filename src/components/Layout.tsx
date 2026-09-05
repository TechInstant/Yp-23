import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import Logo from './Logo'

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/submit', label: 'Submit attendance' },
  { to: '/register', label: 'Confirm your parish' },
  { to: '/directory', label: 'Directory' },
]

function navClass({ isActive }: { isActive: boolean }) {
  return [
    'rounded-lg px-3 py-2 text-sm font-medium transition',
    isActive ? 'bg-navy-100 text-navy-900' : 'text-navy-600 hover:bg-navy-50 hover:text-navy-900',
  ].join(' ')
}

export default function Layout() {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-navy-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" onClick={() => setOpen(false)} className="min-w-0">
            <Logo size="md" />
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
                {item.label}
              </NavLink>
            ))}
            <Link to="/admin" className="btn-primary btn-sm ml-2">
              Admin
            </Link>
          </nav>

          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-navy-200 text-navy-700 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
            aria-expanded={open}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path
                d={open ? 'M5 5l10 10M15 5L5 15' : 'M3 6h14M3 10h14M3 14h14'}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {open && (
          <nav className="flex flex-col gap-1 border-t border-navy-100 px-4 py-3 md:hidden">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={navClass}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
            <Link to="/admin" className="btn-primary mt-2" onClick={() => setOpen(false)}>
              Admin sign in
            </Link>
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-navy-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-navy-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            RCCG Youth Province 23. Weekly Sunday service returns, September 2026 – December
            2029.
          </p>
          <Link to="/admin" className="font-medium text-navy-700 hover:text-navy-900">
            Provincial admin →
          </Link>
        </div>
      </footer>
    </div>
  )
}
