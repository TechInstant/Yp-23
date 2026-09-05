import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { Alert, EmptyState, Field, Spinner } from '../../components/ui'
import { useAuth, type AdminRole } from '../../context/AuthContext'
import { COLLECTIONS, db } from '../../lib/firebase'

interface AdminRow {
  uid: string
  email: string
  role: AdminRole
  grantedBy?: string
}

interface InviteRow {
  id: string
  email: string
  role: AdminRole
  invitedBy?: string
}

/**
 * Granting access without the Firebase console.
 *
 * A browser cannot create a Firebase Auth user or look one up by email — both
 * need the Admin SDK, and this project has no service-account key because the
 * organisation policy forbids creating one. So access is granted by invitation:
 * a super admin files the email here, that person signs up themselves on the
 * login screen, and their first sign-in converts the invitation into admin
 * access. firestore.rules re-checks the role, so nobody can redeem more than
 * they were offered.
 */
export default function AdminsAdmin() {
  const { user, isSuperAdmin } = useAuth()

  const [admins, setAdmins] = useState<AdminRow[]>([])
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AdminRole>('admin')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [justInvited, setJustInvited] = useState<string | null>(null)

  useEffect(() => {
    const stopAdmins = onSnapshot(
      collection(db, COLLECTIONS.admins),
      (snap) => {
        setAdmins(
          snap.docs.map((d) => ({
            uid: d.id,
            email: (d.data().email as string) ?? '',
            // No role means it was created by hand in the console — super,
            // matching isSuperAdmin() in firestore.rules.
            role: d.data().role === 'admin' ? 'admin' : 'super',
            grantedBy: d.data().grantedBy as string | undefined,
          })),
        )
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )

    const stopInvites = onSnapshot(
      collection(db, COLLECTIONS.adminInvites),
      (snap) =>
        setInvites(
          snap.docs.map((d) => ({
            id: d.id,
            email: (d.data().email as string) ?? d.id,
            role: d.data().role === 'super' ? 'super' : 'admin',
            invitedBy: d.data().invitedBy as string | undefined,
          })),
        ),
      () => undefined,
    )

    return () => {
      stopAdmins()
      stopInvites()
    }
  }, [])

  const superCount = useMemo(() => admins.filter((a) => a.role === 'super').length, [admins])

  async function invite(event: React.FormEvent) {
    event.preventDefault()
    setMessage(null)

    const clean = email.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) {
      setMessage({ tone: 'error', text: 'Enter a valid email address.' })
      return
    }
    if (admins.some((a) => a.email.toLowerCase() === clean)) {
      setMessage({ tone: 'error', text: `${clean} already has admin access.` })
      return
    }

    setBusy(true)
    try {
      await setDoc(doc(db, COLLECTIONS.adminInvites, clean), {
        email: clean,
        role,
        invitedBy: user?.email ?? '',
        createdAt: serverTimestamp(),
      })
      setMessage(null)
      setJustInvited(clean)
      setEmail('')
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }

  async function changeRole(row: AdminRow, next: AdminRole) {
    setMessage(null)
    if (row.role === 'super' && next === 'admin' && superCount <= 1) {
      setMessage({
        tone: 'error',
        text: 'This is the only super admin. Promote someone else first, or nobody will be able to manage access.',
      })
      return
    }
    try {
      await updateDoc(doc(db, COLLECTIONS.admins, row.uid), { role: next })
      setMessage({ tone: 'success', text: `${row.email} is now a ${LABEL[next].toLowerCase()}.` })
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : String(err) })
    }
  }

  async function revoke(row: AdminRow) {
    setMessage(null)
    if (row.role === 'super' && superCount <= 1) {
      setMessage({
        tone: 'error',
        text: 'This is the only super admin and cannot be removed.',
      })
      return
    }
    if (!window.confirm(`Remove admin access for ${row.email}?`)) return
    try {
      await deleteDoc(doc(db, COLLECTIONS.admins, row.uid))
      setMessage({ tone: 'success', text: `${row.email} no longer has admin access.` })
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : String(err) })
    }
  }

  async function cancelInvite(row: InviteRow) {
    try {
      await deleteDoc(doc(db, COLLECTIONS.adminInvites, row.id))
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : String(err) })
    }
  }

  if (loading) return <Spinner label="Loading the admin list…" />

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">Admin access</h1>
        <p className="mt-1 text-sm text-navy-600">
          {admins.length} {admins.length === 1 ? 'person has' : 'people have'} access
          {invites.length > 0 && ` · ${invites.length} invitation${invites.length === 1 ? '' : 's'} outstanding`}
        </p>
      </header>

      {error && (
        <Alert tone="error" title="Could not load the admin list">
          {error}
        </Alert>
      )}
      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      {!isSuperAdmin && (
        <Alert tone="info" title="View only">
          Only a super admin can invite or remove admins. You can see who has access.
        </Alert>
      )}

      {isSuperAdmin && (
        <form onSubmit={invite} className="card space-y-4 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-navy-900">Invite an admin</h2>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <Field label="Email address" required>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pastor@example.com"
                autoComplete="off"
              />
            </Field>
            <Field label="Role">
              <select
                className="input sm:w-44"
                value={role}
                onChange={(e) => setRole(e.target.value as AdminRole)}
              >
                <option value="admin">Admin</option>
                <option value="super">Super admin</option>
              </select>
            </Field>
            <button type="submit" className="btn-primary sm:mb-0" disabled={busy}>
              {busy ? 'Creating…' : 'Create invite'}
            </button>
          </div>
          <p className="text-xs text-navy-500">
            An <strong>admin</strong> sees the dashboard, parishes and returns. A{' '}
            <strong>super admin</strong> can also invite and remove admins.
          </p>
          <Alert tone="info" title="Creating an invite does not email anybody">
            It records that the address is allowed in. Once created, use{' '}
            <strong>Email the invite</strong> to have Firebase send them a sign-in link — or send
            the link yourself by copy or WhatsApp.
          </Alert>
        </form>
      )}

      {justInvited && (
        <Alert tone="success" title={`${justInvited} can now be given access`}>
          <p>
            Send them this link. They must create their account with{' '}
            <strong>that exact email address</strong> — access is granted the moment they do.
          </p>
          <p className="mt-2 break-all rounded-lg bg-white/70 px-3 py-2 font-mono text-xs">
            {inviteLink(justInvited)}
          </p>
          <div className="mt-3">
            <ShareInvite email={justInvited} />
          </div>
        </Alert>
      )}

      <section className="card overflow-hidden">
        <h2 className="border-b border-navy-100 bg-navy-50 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-navy-700">
          Has access
        </h2>
        <ul className="divide-y divide-navy-100">
          {admins.map((row) => {
            const isYou = row.uid === user?.uid
            return (
              <li
                key={row.uid}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-navy-900">
                    <span className="min-w-0 truncate">{row.email || row.uid}</span>
                    <span
                      className={`badge ${
                        row.role === 'super'
                          ? 'bg-gold-100 text-gold-800'
                          : 'bg-navy-100 text-navy-700'
                      }`}
                    >
                      {LABEL[row.role]}
                    </span>
                    {isYou && <span className="badge bg-emerald-100 text-emerald-800">You</span>}
                  </p>
                  {row.grantedBy && (
                    <p className="mt-0.5 text-xs text-navy-500">invited by {row.grantedBy}</p>
                  )}
                </div>

                {isSuperAdmin && !isYou && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() =>
                        void changeRole(row, row.role === 'super' ? 'admin' : 'super')
                      }
                    >
                      {row.role === 'super' ? 'Make admin' : 'Make super admin'}
                    </button>
                    <button
                      type="button"
                      className="btn-danger btn-sm"
                      onClick={() => void revoke(row)}
                    >
                      Remove
                    </button>
                  </div>
                )}
                {isYou && (
                  <span className="shrink-0 text-xs text-navy-400">
                    You cannot change your own access
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      {invites.length > 0 && (
        <section className="card overflow-hidden">
          <h2 className="border-b border-navy-100 bg-navy-50 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-navy-700">
            Waiting to sign up
          </h2>
          <ul className="divide-y divide-navy-100">
            {invites.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-navy-900">
                    <span className="min-w-0 truncate">{row.email}</span>
                    <span className="badge bg-navy-100 text-navy-700">{LABEL[row.role]}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-navy-500">
                    Access begins when they create an account with this address. Nothing has been
                    emailed — send them the link.
                  </p>
                  {isSuperAdmin && (
                    <div className="mt-2">
                      <ShareInvite email={row.email} />
                    </div>
                  )}
                </div>
                {isSuperAdmin && (
                  <button
                    type="button"
                    className="btn-ghost btn-sm shrink-0"
                    onClick={() => void cancelInvite(row)}
                  >
                    Cancel
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {admins.length === 0 && invites.length === 0 && (
        <EmptyState title="Nobody has admin access yet">
          Create the first super admin by hand in the Firebase console, then everyone else can be
          invited from here.
        </EmptyState>
      )}
    </div>
  )
}

const LABEL: Record<AdminRole, string> = {
  super: 'Super admin',
  admin: 'Admin',
}

function inviteLink(email: string): string {
  return `${window.location.origin}/admin?invite=${encodeURIComponent(email)}`
}

function inviteMessage(email: string): string {
  return (
    `You have been given admin access to the RCCG Youth Province 23 attendance portal.\n\n` +
    `Open this link and create your account using this exact email address (${email}):\n` +
    `${inviteLink(email)}`
  )
}

/**
 * Nothing here sends email. The province has no mail service and no
 * service-account key, so an invitation is a record saying "this address is
 * allowed in" — it still has to be delivered by hand. These buttons make that
 * one tap: copy the message, or open WhatsApp with it already written, which is
 * how the province actually reaches its pastors.
 */
function ShareInvite({ email }: { email: string }) {
  const { sendInviteEmail } = useAuth()
  const [copied, setCopied] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  async function emailIt() {
    setSending(true)
    setSendError(null)
    try {
      await sendInviteEmail(email)
      setSent(true)
    } catch (err) {
      const code =
        typeof err === 'object' && err && 'code' in err ? String((err as { code: string }).code) : ''
      setSendError(
        code === 'auth/operation-not-allowed'
          ? 'Enable Firebase Console → Authentication → Sign-in method → Email/Password → "Email link (passwordless sign-in)", then try again.'
          : code === 'auth/unauthorized-continue-uri'
            ? 'Add this site to Firebase Console → Authentication → Settings → Authorized domains, then try again.'
            : err instanceof Error
              ? err.message
              : String(err),
      )
    } finally {
      setSending(false)
    }
  }

  async function copy() {
    const text = inviteMessage(email)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Clipboard access is refused on insecure origins and in some in-app
      // browsers; falling back to a prompt still lets them copy it by hand.
      window.prompt('Copy this message and send it to them:', text)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-gold btn-sm"
          onClick={() => void emailIt()}
          disabled={sending}
        >
          {sending ? 'Sending…' : sent ? 'Email sent ✓' : 'Email the invite'}
        </button>
        <button type="button" className="btn-ghost btn-sm" onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy message'}
        </button>
        <a
          className="btn-ghost btn-sm"
          href={`https://wa.me/?text=${encodeURIComponent(inviteMessage(email))}`}
          target="_blank"
          rel="noreferrer"
        >
          WhatsApp
        </a>
      </div>
      {sent && (
        <p className="text-xs text-emerald-700">
          Sent to {email}. Tell them to check spam — it arrives from Firebase, not from you.
        </p>
      )}
      {sendError && <p className="text-xs font-medium text-red-600">{sendError}</p>}
    </div>
  )
}
