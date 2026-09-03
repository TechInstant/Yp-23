import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { Alert, Field, Spinner } from '../components/ui'
import { areasFor, OTHER, zonesFor } from '../data/provinceStructure'
import { useParishes } from '../hooks/useParishes'
import { COLLECTIONS, db } from '../lib/firebase'
import { FAMILIES, FAMILY_LABEL, ORDINATION_STATUSES, type Family } from '../types'

/**
 * Where a pastor puts their own details on record.
 *
 * The province directory is loaded by an admin with parish names, zones and
 * areas but deliberately no pastor and no phone number, so the normal path here
 * is *claiming* an existing parish rather than creating one. Creating is the
 * fallback for a parish the directory does not have yet.
 *
 * A claim is a one-time write, enforced in firestore.rules: once a parish has a
 * pastor on record only an admin can change it.
 */

interface Details {
  pastorName: string
  phone: string
  address: string
  ordinationStatus: string
  yearOfOrdination: string
  lengthOfService: string
}

const BLANK_DETAILS: Details = {
  pastorName: '',
  phone: '',
  address: '',
  ordinationStatus: 'UNKNOWN',
  yearOfOrdination: '',
  lengthOfService: '',
}

/** Nigerian numbers as written in the directory: 11 digits, or the +234 form. */
function normalisePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, '')
}

type Errors = Partial<Record<keyof Details | 'family' | 'zone' | 'area' | 'parish' | 'name', string>>

export default function RegisterParish() {
  const { parishes, zonesByFamily, areasByZone, loading } = useParishes()

  const [mode, setMode] = useState<'claim' | 'new'>('claim')
  const [family, setFamily] = useState<Family | ''>('')
  const [zone, setZone] = useState('')
  const [area, setArea] = useState('')
  const [parishId, setParishId] = useState('')
  const [newName, setNewName] = useState('')
  const [details, setDetails] = useState<Details>(BLANK_DETAILS)

  const [zoneOther, setZoneOther] = useState(false)
  const [areaOther, setAreaOther] = useState(false)

  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [contactWarning, setContactWarning] = useState(false)

  const zones = zonesFor(family, family ? (zonesByFamily[family] ?? []) : [])
  const areas = areasFor(family, zone, areasByZone[zone] ?? [])

  const candidates = useMemo(
    () =>
      parishes.filter(
        (p) =>
          p.status !== 'archived' &&
          (!family || p.family === family) &&
          (!zone || p.zone === zone) &&
          (!area || p.area === area),
      ),
    [parishes, family, zone, area],
  )

  const parish = parishes.find((p) => p.id === parishId) ?? null
  const alreadyClaimed = Boolean(parish && parish.pastorName.trim())

  const existingNames = useMemo(
    () => new Set(parishes.map((p) => p.name.trim().toUpperCase())),
    [parishes],
  )

  function setDetail<K extends keyof Details>(key: K, value: Details[K]) {
    setDetails((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function changeFamily(value: Family | '') {
    setFamily(value)
    setZone('')
    setArea('')
    setParishId('')
    setZoneOther(false)
    setAreaOther(false)
    setErrors((prev) => ({ ...prev, family: undefined }))
  }

  function changeZone(value: string) {
    setZone(value)
    setArea('')
    setParishId('')
    setAreaOther(false)
    setErrors((prev) => ({ ...prev, zone: undefined }))
  }

  function changeArea(value: string) {
    setArea(value)
    setParishId('')
    setErrors((prev) => ({ ...prev, area: undefined }))
  }

  function validate(): Errors {
    const found: Errors = {}
    if (!family) found.family = 'Select the family.'

    if (mode === 'claim') {
      if (!parishId) found.parish = 'Select your parish.'
    } else {
      if (newName.trim().length < 2) found.name = 'Enter the parish name.'
      else if (existingNames.has(newName.trim().toUpperCase()))
        found.name = 'That parish is already listed — find it under “Claim your parish”.'
      if (!zone.trim()) found.zone = 'Select the zone.'
      if (!area.trim()) found.area = 'Select the area.'
    }

    if (details.pastorName.trim().length < 2) found.pastorName = "Enter your full name."

    const phone = normalisePhone(details.phone)
    if (phone.length < 7 || phone.length > 25) found.phone = 'Enter a reachable phone number.'

    if (details.yearOfOrdination) {
      const year = Number(details.yearOfOrdination)
      if (!Number.isInteger(year) || year < 1950 || year > 2100)
        found.yearOfOrdination = 'Enter a year such as 2024, or leave it blank.'
    }
    return found
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setFailure(null)
    setContactWarning(false)

    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSaving(true)
    try {
      const shared = {
        pastorName: details.pastorName.trim(),
        address: details.address.trim(),
        ordinationStatus: details.ordinationStatus,
        yearOfOrdination: details.yearOfOrdination ? Number(details.yearOfOrdination) : null,
        lengthOfService: details.lengthOfService.trim(),
        updatedAt: serverTimestamp(),
      }

      let id: string
      let label: string

      if (mode === 'claim' && parish) {
        await updateDoc(doc(db, COLLECTIONS.parishes, parish.id), shared)
        id = parish.id
        label = parish.name
      } else {
        const created = await addDoc(collection(db, COLLECTIONS.parishes), {
          ...shared,
          name: newName.trim(),
          family,
          zone: zone.trim(),
          area: area.trim(),
          status: 'pending',
          source: 'self-registration',
          createdAt: serverTimestamp(),
        })
        id = created.id
        label = newName.trim()
      }

      try {
        // Phone numbers never touch the public parish document.
        await setDoc(doc(db, COLLECTIONS.parishContacts, id), {
          phone: normalisePhone(details.phone),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      } catch {
        setContactWarning(true)
      }

      setSaved(label)
      setDetails(BLANK_DETAILS)
      setParishId('')
      setNewName('')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setFailure(
        message.includes('permission')
          ? 'This parish already has a pastor on record, so it cannot be claimed again. Ask the provincial admin to update the details.'
          : message,
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner label="Loading the province directory…" />

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">Your parish details</h1>
        <p className="mt-2 text-navy-600">
          Find your parish and put your name and phone number on record. Do this once — after
          that you only submit the Sunday figure each week.
        </p>
      </header>

      {saved && (
        <Alert tone="success" title={`${saved} — details recorded`}>
          <p>
            You can now{' '}
            <Link to="/submit" className="font-medium underline">
              submit Sunday attendance
            </Link>{' '}
            for this parish.
          </p>
          {mode === 'new' && (
            <p className="mt-1">
              As a new parish it is queued for provincial approval, and becomes selectable on
              the attendance form once approved.
            </p>
          )}
          {contactWarning && (
            <p className="mt-2">
              Your phone number could not be saved — please pass it to the provincial admin
              separately.
            </p>
          )}
        </Alert>
      )}

      {failure && (
        <Alert tone="error" title="Not saved">
          {failure}
        </Alert>
      )}

      <div className="flex rounded-lg border border-navy-200 bg-white p-1">
        {(
          [
            ['claim', 'Claim your parish'],
            ['new', 'My parish is not listed'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setMode(key)
              setErrors({})
            }}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition ${
              mode === key ? 'bg-navy-900 text-white' : 'text-navy-600 hover:bg-navy-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6 p-6">
        <fieldset className="space-y-5" disabled={saving}>
          <legend className="text-sm font-semibold uppercase tracking-wide text-navy-500">
            {mode === 'claim' ? 'Find your parish' : 'The new parish'}
          </legend>

          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Family" required error={errors.family}>
              <select
                className="input"
                value={family}
                onChange={(e) => changeFamily(e.target.value as Family | '')}
              >
                <option value="">Select…</option>
                {FAMILIES.map((f) => (
                  <option key={f} value={f}>
                    {FAMILY_LABEL[f]}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Zone"
              required={mode === 'new'}
              error={errors.zone}
              hint={family ? undefined : 'Choose a family first'}
            >
              {zoneOther ? (
                <input
                  className="input"
                  value={zone}
                  onChange={(e) => changeZone(e.target.value)}
                  maxLength={120}
                  placeholder="Type the zone name"
                  autoFocus
                />
              ) : (
                <select
                  className="input"
                  value={zone}
                  onChange={(e) => {
                    if (e.target.value === OTHER) {
                      setZoneOther(true)
                      changeZone('')
                    } else {
                      changeZone(e.target.value)
                    }
                  }}
                  disabled={!family}
                >
                  <option value="">{mode === 'claim' ? 'All zones' : 'Select zone…'}</option>
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                  <option value={OTHER}>Other (type it in)…</option>
                </select>
              )}
            </Field>

            <Field
              label="Area"
              required={mode === 'new'}
              error={errors.area}
              hint={zone ? undefined : 'Choose a zone first'}
            >
              {areaOther ? (
                <input
                  className="input"
                  value={area}
                  onChange={(e) => changeArea(e.target.value)}
                  maxLength={120}
                  placeholder="Type the area name"
                  autoFocus
                />
              ) : (
                <select
                  className="input"
                  value={area}
                  onChange={(e) => {
                    if (e.target.value === OTHER) {
                      setAreaOther(true)
                      changeArea('')
                    } else {
                      changeArea(e.target.value)
                    }
                  }}
                  disabled={!zone}
                >
                  <option value="">{mode === 'claim' ? 'All areas' : 'Select area…'}</option>
                  {areas.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                  <option value={OTHER}>Other (type it in)…</option>
                </select>
              )}
            </Field>
          </div>

          {mode === 'claim' ? (
            <Field
              label="Parish"
              required
              error={errors.parish}
              hint={
                candidates.length === 0 && family
                  ? 'No parish matches that selection. If yours is genuinely missing, use “My parish is not listed”.'
                  : `${candidates.length} parish${candidates.length === 1 ? '' : 'es'} to choose from`
              }
            >
              <select
                className="input"
                value={parishId}
                onChange={(e) => {
                  setParishId(e.target.value)
                  setErrors((prev) => ({ ...prev, parish: undefined }))
                }}
              >
                <option value="">Select parish…</option>
                {candidates.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.pastorName.trim() ? ' — already registered' : ''}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="Parish name" required error={errors.name}>
              <input
                className="input"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value)
                  setErrors((prev) => ({ ...prev, name: undefined }))
                }}
                maxLength={120}
                placeholder="e.g. KINGS PALACE"
              />
            </Field>
          )}

          {alreadyClaimed && (
            <Alert tone="warning" title="This parish is already registered">
              <strong>{parish?.pastorName}</strong> is on record as the pastor in charge. If
              that has changed, ask the provincial admin to update it — details can only be
              entered once from this form.
            </Alert>
          )}
        </fieldset>

        <fieldset className="space-y-5 border-t border-navy-100 pt-6" disabled={saving}>
          <legend className="text-sm font-semibold uppercase tracking-wide text-navy-500">
            Your details
          </legend>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Your full name" required error={errors.pastorName}>
              <input
                className="input"
                value={details.pastorName}
                onChange={(e) => setDetail('pastorName', e.target.value)}
                placeholder="e.g. PST AMAS AMAJO"
                maxLength={120}
              />
            </Field>

            <Field
              label="Phone number"
              required
              error={errors.phone}
              hint="Only provincial admins can see this — it is never shown on the public site."
            >
              <input
                className="input"
                type="tel"
                inputMode="tel"
                value={details.phone}
                onChange={(e) => setDetail('phone', e.target.value)}
                placeholder="e.g. 07034936069"
                maxLength={25}
              />
            </Field>
          </div>

          <Field
            label="Church address"
            hint="Landmark, street, town — as you would give it to a first-time visitor."
          >
            <textarea
              className="input min-h-[76px] resize-y"
              value={details.address}
              onChange={(e) => setDetail('address', e.target.value)}
              maxLength={300}
              placeholder="e.g. Behind Tentacle Filling Station, Lagere, Ile-Ife"
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Ordination status">
              <select
                className="input"
                value={details.ordinationStatus}
                onChange={(e) => setDetail('ordinationStatus', e.target.value)}
              >
                {ORDINATION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Year of ordination" error={errors.yearOfOrdination}>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                value={details.yearOfOrdination}
                onChange={(e) => setDetail('yearOfOrdination', e.target.value)}
                placeholder="e.g. 2024"
              />
            </Field>

            <Field label="Length of service">
              <input
                className="input"
                value={details.lengthOfService}
                onChange={(e) => setDetail('lengthOfService', e.target.value)}
                placeholder="e.g. PIC AREA - 5 YEARS"
                maxLength={120}
              />
            </Field>
          </div>
        </fieldset>

        <div className="border-t border-navy-100 pt-6">
          <button type="submit" className="btn-primary" disabled={saving || alreadyClaimed}>
            {saving ? 'Saving…' : mode === 'claim' ? 'Save my details' : 'Submit for approval'}
          </button>
        </div>
      </form>
    </div>
  )
}
