import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { Alert, Field, Spinner } from '../components/ui'
import { useParishes } from '../hooks/useParishes'
import { COLLECTIONS, db } from '../lib/firebase'
import { LOCATION_LABEL, type LocationCode, type Parish } from '../types'

/**
 * Claiming a parish: a pastor puts their name and number against a parish that
 * is already in the province directory.
 *
 * Nothing else is asked for. The location, zone and area are already known from
 * the directory — making a pastor re-enter them is just an opportunity to get
 * them wrong — and the attendance form captures the same name and number on
 * every submission anyway, so this page exists only to seed the contact list
 * before the first Sunday.
 */

/** Nigerian numbers as written in the directory: 11 digits, or the +234 form. */
function normalisePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, '')
}

export default function RegisterParish() {
  const { parishes, loading } = useParishes()

  const [parishId, setParishId] = useState('')
  const [pastorName, setPastorName] = useState('')
  const [phone, setPhone] = useState('')

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const selectable = useMemo(
    () => parishes.filter((p) => p.status !== 'archived'),
    [parishes],
  )

  const grouped = useMemo(() => {
    const map = new Map<LocationCode, Parish[]>()
    for (const p of selectable) {
      const list = map.get(p.location)
      if (list) list.push(p)
      else map.set(p.location, [p])
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name))
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [selectable])

  const parish = selectable.find((p) => p.id === parishId) ?? null

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setFailure(null)

    const found: Record<string, string> = {}
    if (!parishId) found.parish = 'Select your parish.'
    if (pastorName.trim().length < 2) found.pastorName = 'Enter your full name.'
    const cleanPhone = normalisePhone(phone)
    if (cleanPhone.length < 7 || cleanPhone.length > 25)
      found.phone = 'Enter a reachable phone number.'

    setErrors(found)
    if (Object.keys(found).length > 0 || !parish) return

    setSaving(true)
    try {
      await updateDoc(doc(db, COLLECTIONS.parishes, parish.id), {
        pastorName: pastorName.trim(),
        updatedAt: serverTimestamp(),
      })

      // The phone number never touches the public parish document.
      await setDoc(
        doc(db, COLLECTIONS.parishContacts, parish.id),
        {
          phone: cleanPhone,
          pastorName: pastorName.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )

      setSaved(parish.name)
      setPastorName('')
      setPhone('')
      setParishId('')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setFailure(
        message.includes('permission')
          ? 'This parish already has a pastor on record. Ask the provincial admin to update the details.'
          : message,
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner label="Loading the province directory…" />

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">Claim your parish</h1>
        <p className="mt-2 text-navy-600">
          Put your name and number against your parish so the province can reach you. You only
          need to do this once.
        </p>
      </header>

      {saved && (
        <Alert tone="success" title={`${saved} is now yours`}>
          You can go straight to the{' '}
          <Link to="/submit" className="font-medium underline">
            attendance form
          </Link>{' '}
          each Sunday.
        </Alert>
      )}

      {failure && (
        <Alert tone="error" title="Could not save">
          {failure}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="card space-y-5 p-6">
        <Field label="Parish" required error={errors.parish}>
          <select
            className="input"
            value={parishId}
            onChange={(e) => {
              setParishId(e.target.value)
              setErrors((prev) => ({ ...prev, parish: '' }))
            }}
          >
            <option value="">Select your parish…</option>
            {grouped.map(([location, list]) => (
              <optgroup key={location} label={LOCATION_LABEL[location]}>
                {list.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>

        {parish && (
          <div className="rounded-lg bg-navy-50 px-4 py-3 text-sm">
            <p className="font-semibold text-navy-900">{parish.name}</p>
            <p className="mt-0.5 text-navy-600">
              {LOCATION_LABEL[parish.location]}
              {parish.zone && ` · ${parish.zone}`}
              {parish.area && ` · ${parish.area}`}
            </p>
          </div>
        )}

        <Field label="Your name" required error={errors.pastorName}>
          <input
            className="input"
            value={pastorName}
            onChange={(e) => setPastorName(e.target.value)}
            placeholder="e.g. PST AMAS AMAJO"
            maxLength={120}
            autoComplete="name"
          />
        </Field>

        <Field
          label="Phone number"
          required
          error={errors.phone}
          hint="Seen only by provincial admins."
        >
          <input
            className="input"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 07034936069"
            maxLength={25}
            autoComplete="tel"
          />
        </Field>

        <div className="border-t border-navy-100 pt-5">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Claim this parish'}
          </button>
        </div>
      </form>
    </div>
  )
}
