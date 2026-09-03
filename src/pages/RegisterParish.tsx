import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { addDoc, collection, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { Alert, Field, Spinner } from '../components/ui'
import { useParishes } from '../hooks/useParishes'
import { COLLECTIONS, db } from '../lib/firebase'

/**
 * Claiming a parish: a pastor puts their name and number against a parish that
 * is already in the province directory, or adds one the directory does not have
 * yet.
 *
 * Nothing else is asked for — no address, no ordination details, no zone or
 * area. The attendance form captures the same name and number every week, so
 * this page exists only to seed the contact list before the first Sunday.
 */

/** Nigerian numbers as written in the directory: 11 digits, or the +234 form. */
function normalisePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, '')
}

export default function RegisterParish() {
  const { parishes, loading } = useParishes()

  const [mode, setMode] = useState<'claim' | 'new'>('claim')
  const [parishId, setParishId] = useState('')
  const [newName, setNewName] = useState('')
  const [pastorName, setPastorName] = useState('')
  const [phone, setPhone] = useState('')

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const options = useMemo(
    () =>
      parishes
        .filter((p) => p.status !== 'archived')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [parishes],
  )

  const existingNames = useMemo(
    () => new Set(parishes.map((p) => p.name.trim().toUpperCase())),
    [parishes],
  )

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setFailure(null)

    const found: Record<string, string> = {}
    if (mode === 'claim') {
      if (!parishId) found.parish = 'Select your parish.'
    } else {
      if (newName.trim().length < 2) found.name = 'Enter the parish name.'
      else if (existingNames.has(newName.trim().toUpperCase()))
        found.name = 'That parish is already listed — find it under “Claim your parish”.'
    }
    if (pastorName.trim().length < 2) found.pastorName = 'Enter your full name.'
    const cleanPhone = normalisePhone(phone)
    if (cleanPhone.length < 7 || cleanPhone.length > 25)
      found.phone = 'Enter a reachable phone number.'

    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSaving(true)
    try {
      let id: string
      let label: string

      if (mode === 'claim') {
        const parish = options.find((p) => p.id === parishId)
        if (!parish) return
        await updateDoc(doc(db, COLLECTIONS.parishes, parish.id), {
          pastorName: pastorName.trim(),
          updatedAt: serverTimestamp(),
        })
        id = parish.id
        label = parish.name
      } else {
        const created = await addDoc(collection(db, COLLECTIONS.parishes), {
          name: newName.trim(),
          pastorName: pastorName.trim(),
          status: 'pending',
          source: 'self-registration',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        id = created.id
        label = newName.trim()
      }

      // The phone number never touches the public parish document.
      await setDoc(
        doc(db, COLLECTIONS.parishContacts, id),
        {
          phone: cleanPhone,
          pastorName: pastorName.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )

      setSaved(label)
      setPastorName('')
      setPhone('')
      setParishId('')
      setNewName('')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setFailure(
        message.includes('permission')
          ? 'That could not be saved. Ask the provincial admin to update the details.'
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
        <Alert tone="success" title={`${saved} saved`}>
          {mode === 'new'
            ? 'It has gone to the province for approval and will appear on the attendance form once approved.'
            : null}{' '}
          You can go to the{' '}
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
        <div className="flex rounded-lg border border-navy-200 bg-navy-50 p-1">
          {(['claim', 'new'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m)
                setErrors({})
              }}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition ${
                mode === m ? 'bg-white text-navy-900 shadow-sm' : 'text-navy-600'
              }`}
            >
              {m === 'claim' ? 'Claim your parish' : 'My parish is not listed'}
            </button>
          ))}
        </div>

        {mode === 'claim' ? (
          <Field label="Parish" required error={errors.parish}>
            <select
              className="input"
              value={parishId}
              onChange={(e) => setParishId(e.target.value)}
            >
              <option value="">Select your parish…</option>
              {options.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.pastorName ? ` — ${p.pastorName}` : ''}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field
            label="Parish name"
            required
            error={errors.name}
            hint="It goes to the province for approval."
          >
            <input
              className="input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. POWER CATHEDRAL"
              maxLength={120}
            />
          </Field>
        )}

        <Field label="Your name" required error={errors.pastorName}>
          <input
            className="input"
            value={pastorName}
            onChange={(e) => setPastorName(e.target.value)}
            placeholder="Your full name"
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
            {saving ? 'Saving…' : mode === 'claim' ? 'Claim this parish' : 'Submit for approval'}
          </button>
        </div>
      </form>
    </div>
  )
}
