import { useEffect, useState, type ReactNode } from 'react'

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-sm text-navy-500">
      <span
        className="h-5 w-5 animate-spin rounded-full border-2 border-navy-200 border-t-navy-700"
        aria-hidden
      />
      {label}
    </div>
  )
}

type AlertTone = 'info' | 'success' | 'warning' | 'error'

const ALERT_STYLES: Record<AlertTone, string> = {
  info: 'border-navy-200 bg-navy-50 text-navy-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-gold-200 bg-gold-50 text-gold-800',
  error: 'border-red-200 bg-red-50 text-red-800',
}

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: AlertTone
  title?: string
  children?: ReactNode
}) {
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${ALERT_STYLES[tone]}`} role="status">
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? 'mt-1' : ''}>{children}</div>}
    </div>
  )
}

export function StatTile({
  label,
  value,
  hint,
  trend,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  /** Percentage change; drives the colour and the arrow. */
  trend?: number | null
}) {
  const tone =
    trend === null || trend === undefined
      ? 'text-navy-400'
      : trend > 0
        ? 'text-emerald-600'
        : trend < 0
          ? 'text-red-600'
          : 'text-navy-400'

  return (
    <div className="card p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-navy-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-navy-900">{value}</p>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {trend !== null && trend !== undefined && (
          <span className={`font-semibold tabular-nums ${tone}`}>
            {trend > 0 ? '▲' : trend < 0 ? '▼' : '■'} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
        {hint && <span className="text-navy-500">{hint}</span>}
      </div>
    </div>
  )
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <p className="text-base font-semibold text-navy-900">{title}</p>
      {children && <p className="max-w-md text-sm text-navy-500">{children}</p>}
      {action}
    </div>
  )
}

export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div>
      <span className="label">
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </span>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-navy-500">{hint}</p>
      ) : null}
    </div>
  )
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  // Close on Escape, and stop the page behind from scrolling while the sheet is
  // open — on a phone, background scroll under a modal feels broken.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/50 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/*
        The card owns the scrolling, not the backdrop. Letting the backdrop
        scroll pushes the header and the Save button off-screen on a long form,
        which on a phone reads as a modal you cannot submit. Here the header and
        footer stay pinned and only the body moves.

        The height cap lives in `.modal-sheet` (index.css) because it needs a vh
        fallback underneath the dvh line, which Tailwind classes cannot express
        — and without any cap the footer would sit below the fold with nothing
        able to scroll to it.
      */}
      <div className="card modal-sheet flex w-full max-w-2xl flex-col rounded-b-none sm:rounded-xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-navy-100 px-4 py-3.5 sm:px-5 sm:py-4">
          <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-navy-900 sm:text-lg">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 shrink-0 rounded-lg p-2 text-navy-400 hover:bg-navy-50 hover:text-navy-700"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5">{children}</div>

        {footer && (
          <div className="modal-footer flex shrink-0 flex-col-reverse gap-2 border-t border-navy-100 bg-white px-4 pt-3.5 sm:flex-row sm:justify-end sm:px-5 sm:pt-4 [&>button]:w-full sm:[&>button]:w-auto">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Password box with a show/hide toggle.
 *
 * Typing a password blind on a phone keyboard is where most failed sign-ins
 * come from, so the reveal is worth having. The toggle is a real button with a
 * 40px target and an aria-label, and it is excluded from the tab order so it
 * never sits between the password field and the submit button.
 */
export function PasswordInput({
  value,
  onChange,
  autoComplete,
  minLength,
  placeholder = '••••••••',
  required,
  id,
}: {
  value: string
  onChange: (value: string) => void
  autoComplete?: string
  minLength?: number
  placeholder?: string
  required?: boolean
  id?: string
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        id={id}
        className="input pr-12"
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        minLength={minLength}
        required={required}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-navy-400 hover:text-navy-700 focus:outline-none focus-visible:text-navy-800"
      >
        {visible ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.4 5.2A9.5 9.5 0 0112 5c5 0 9 4.5 9 7 0 1-.9 2.5-2.4 3.9M6.5 6.9C4.4 8.4 3 10.4 3 12c0 2.5 4 7 9 7 1.4 0 2.7-.3 3.8-.9"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M3 12s3.6-7 9-7 9 7 9 7-3.6 7-9 7-9-7-9-7z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        )}
      </button>
    </div>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-800',
    pending: 'bg-gold-100 text-gold-800',
    archived: 'bg-navy-100 text-navy-500',
  }
  return <span className={`badge ${styles[status] ?? styles.archived}`}>{status}</span>
}
