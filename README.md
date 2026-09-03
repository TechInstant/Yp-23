# RCCG Youth Province 23 — Attendance Portal

Parish directory and weekly Sunday-attendance returns for the **Ife** and **Ede**
families, covering every Sunday from **6 September 2026** to **30 December 2029**
— 174 Sundays.

- Parishes register themselves and submit one figure per Sunday. **No login.**
- Provincial admins sign in with email + password to see the charts, correct
  figures, approve new parishes and add churches by hand.

React + TypeScript + Tailwind, Firebase (Firestore + Auth) for the backend,
deployed to Render as a static site.

---

## 1. Run it locally

```bash
npm install
cp .env.example .env      # then fill in the Firebase values — see step 2
npm run dev               # http://localhost:5173
```

## 2. Create the Firebase project

1. <https://console.firebase.google.com> → **Add project**.
2. **Build → Firestore Database → Create database** → production mode, region
   `europe-west` or `us-central` (either is fine from Nigeria).
3. **Build → Authentication → Get started → Email/Password → Enable.**
   Leave "Email link" off.
4. **Project settings → General → Your apps → Web app (`</>`)**. Copy the
   `firebaseConfig` values into `.env`:

   | Config key          | `.env` variable                     |
   | ------------------- | ----------------------------------- |
   | `apiKey`            | `VITE_FIREBASE_API_KEY`             |
   | `authDomain`        | `VITE_FIREBASE_AUTH_DOMAIN`         |
   | `projectId`         | `VITE_FIREBASE_PROJECT_ID`          |
   | `storageBucket`     | `VITE_FIREBASE_STORAGE_BUCKET`      |
   | `messagingSenderId` | `VITE_FIREBASE_MESSAGING_SENDER_ID` |
   | `appId`             | `VITE_FIREBASE_APP_ID`              |

   These are **public by design** — they identify the project, they don't grant
   access. `firestore.rules` is what protects the data.

   > **Paste the values bare.** Copying them out of the `firebaseConfig` object
   > drags the quotes and the trailing comma along, and dotenv only strips
   > quotes when the value *ends* with one — so `VITE_FIREBASE_API_KEY="AIza…",`
   > reaches Firebase with the punctuation still attached and `getAuth()`
   > throws before React can mount. That is the classic blank white page.
   >
   > ```
   > VITE_FIREBASE_API_KEY=AIzaSyC…      ✅
   > VITE_FIREBASE_API_KEY="AIzaSyC…",   ❌
   > ```
   >
   > `src/lib/firebase.ts` now strips stray quotes and commas defensively and
   > shows an on-screen diagnosis instead of a blank page, but a clean `.env` is
   > still the thing to aim for.

5. Publish the rules and indexes:

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add            # pick the project you just made
   firebase deploy --only firestore:rules,firestore:indexes
   ```

   No CLI? Paste `firestore.rules` into **Firestore → Rules** and publish, then
   let Firestore prompt you to build the indexes the first time a query needs one.

## 3. Load the directory and create the first admin

Download a service-account key — **Project settings → Service accounts →
Generate new private key** — and save it as `service-account.json` in the project
root (already gitignored).

```bash
npm run make-admin -- you@example.com "AStrongPassword"   # creates the login and grants access
npm run make-admin -- --list                              # who currently has access
npm run make-admin -- --remove them@example.com           # revoke
```

Then sign in at `/admin` and press **Load province directory** on the Parishes
screen. That creates all 37 parishes with their zone and area from
`src/data/provinceStructure.ts` — **no pastor names and no phone numbers**,
because pastors enter their own (see below).

`npm run seed` is an older path that also loads pastor names and phones from a
local `seed/parishes.json`. That folder is gitignored and not part of the repo;
the directory button is the supported route.

### No service account? (org policy blocks key creation)

Many Google Workspace organisations enable
`constraints/iam.disableServiceAccountKeyCreation`, and key download then fails
with *"Key creation is not allowed on this service account."* You do **not** need
a key. Two ways round it:

**A. Application Default Credentials — keeps the scripts working.**

```bash
gcloud auth application-default login
npm run seed
npm run make-admin -- you@example.com "AStrongPassword"
```

The scripts fall back to ADC automatically and read the project id from
`VITE_FIREBASE_PROJECT_ID` in `.env`. Nothing else changes.

**B. Console + admin panel — no CLI at all.**

1. **Firestore → Rules**: paste `firestore.rules`, **Publish**. (Do this first —
   until it is published, production-mode defaults deny everything.)
2. **Authentication → Users → Add user**: your email and a password. Copy the
   **User UID** from the list.
3. **Firestore → Start collection** `admins` → **Document ID** = that UID → add
   one field, `email` (string) = your email. Save.
4. Sign in at `/admin`.
5. **Admin → Parishes → Load province directory**. All 37 parishes, with zones
   and areas, no personal data.

Console writes are authorised by your Google account through IAM, so they bypass
the security rules; that is why step 3 works before you can sign in.

---

## Who enters what

| Who              | Enters                                                    | Where                       |
| ---------------- | --------------------------------------------------------- | --------------------------- |
| Provincial admin | The parish list — names, zones, areas                      | **Load province directory** |
| Pastor in charge | Their **own** name and phone number                        | `/register` (once)          |
| Pastor in charge | Parish, their name, phone, the Sunday, the figure          | `/submit` (every week)      |

No personal data ships in this repository — no pastor names, no phone numbers.
`src/data/provinceStructure.ts` holds church structure only: Province →
Location → Zone → Area → Parish.

**Every submission refreshes the contact card.** Name and phone come in with the
weekly return, so the province's contact list reflects whoever is actually in
charge rather than decaying to whoever held the parish in 2026. `/register`
exists only to seed a number before the first Sunday.

Addresses and ordination details are not collected from pastors at all; the
admin panel can still record ordination status against a parish if the province
wants it.

A parish the directory does not have yet goes in through **"My parish is not
listed"**, and lands in the admin approval queue as `pending`.

## 4. Logo

Done — the official lockup lives at `src/components/YP23.jpg` and is imported by
`src/components/Logo.tsx`. To replace it, overwrite that file. See
[`public/brand/README.md`](public/brand/README.md).

## 5. Deploy to Render

Push to GitHub, then in Render: **New + → Blueprint**, point at the repo. It
reads [`render.yaml`](render.yaml) and creates a **Static Site**:

- Build: `npm ci && npm run build`
- Publish directory: `dist`
- SPA rewrite `/* → /index.html` so `/admin/dashboard` survives a hard refresh

Add the six `VITE_FIREBASE_*` variables under **Environment**, then **Manual
Deploy → Clear build cache & deploy**. Vite inlines env vars **at build time**,
so changing a variable requires a *new build* — restarting does nothing.

Finally, add the Render domain to **Firebase → Authentication → Settings →
Authorized domains**, or admin sign-in fails in production while working fine
locally.

---

## Sample data files

| File                             | What it is                                                                    |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `seed/parishes.json`             | All 37 parishes from the two directory PDFs, with the corrections noted inside |
| `seed/parishes.csv`              | Same data, in the exact column order the admin **Import CSV** button expects   |
| `seed/attendance-template.csv`   | Backfill sheet for **Admin → Attendance → Import CSV** (matches parish by name) |
| `seed/sundays-2026-2029.csv`     | All 174 tracked Sundays with service-year labels                               |

Regenerate the last two with `npm run gen-sundays`.

### Two things to check in the seeded data

Both are flagged in `seed/parishes.json` under `notes`:

1. **`GLORIOUS YOUTH ASSEMBLY AREA`** is printed in the Ede PDF *after*
   `PREVAILERS FORT AREA`, but it is numbered area 3 and holds serial numbers
   7–10 — i.e. it belongs before `JESUS GRACE ZONE`. It has been placed under
   `EXCEL (YOUTH CHURCH) ZONE`. Fix it in **Admin → Parishes** if that is wrong.
2. **`POWER CATHEDRAL`** and **`LIGHTHOUSE`** are the two newly planted Ife
   parishes "yet to be fixed". They are seeded as `pending` with no zone, area
   or pastor, so they sit in the approval queue until you fill them in.

---

## Data model

| Collection       | Read      | Write                                                              | Holds                                   |
| ---------------- | --------- | ------------------------------------------------------------------ | --------------------------------------- |
| `parishes`       | public    | public create (forced `pending`), public one-time claim, admin edit | name, pastor, address, family/zone/area |
| `parishContacts` | **admin** | public create once, admin edit                                      | phone number only                       |
| `attendance`     | public    | public create, admin edit/delete                                    | one figure per parish per Sunday        |
| `admins`         | admin     | scripts only                                                        | the access list                         |

**Phone numbers live in a separate collection** because parish records must be
publicly readable (the submission form needs the dropdown) and pastors' personal
numbers should not be. Firestore has no field-level security, so splitting the
document is the only way to get both.

**Attendance document ids are `{parishId}_{YYYY-MM-DD}`.** One return per parish
per Sunday, enforced by the database rather than by the form: a parish that
submits twice collides with its own first record instead of quietly
double-counting itself in the charts. Corrections go through an admin.

**Dates are UTC `YYYY-MM-DD` strings throughout.** A phone on WAT, a Render box
on UTC and a laptop anywhere else all agree which Sunday a figure belongs to.
The tracking window is defined in `src/lib/sundays.ts` and mirrored in
`firestore.rules` — **change both together** if the exercise is extended past
2029.

## How growth is measured

The mean of a parish's **last few returns** against the mean of its **first few**,
inside the selected date range (`parishGrowth` in `src/lib/analytics.ts`). A
plain first-vs-last comparison would let one freak Sunday — a convention, a
downpour, a joint service — flip a parish from growing to shrinking. The window
is 4 Sundays, automatically halved when a parish has fewer returns so the two
samples never overlap.

A flat stretch in the province chart usually means **missing returns, not empty
churches** — which is why the dashboard also charts how many parishes reported
each Sunday and lists who is outstanding.

## Chart colours

`src/lib/chartTheme.ts`. The pairs were validated, not eyeballed:
`#4055A0` / `#B0851F` for Ife/Ede (worst adjacent CVD ΔE 27.6) and `#1B57A5` /
`#C0392B` for growth/decline (deutan ΔE 19.7). The obvious brand pair — navy
`#2E3F81` with gold `#C99A2E` — was rejected: the navy fell outside the
lightness band and the gold came in at 2.51:1 against white. Green-for-growth
was rejected too; against red it collapses to ΔE 6.1 for deuteranopes.

## Project layout

```
src/
  lib/          firebase, sundays (the date window), analytics, csv, chartTheme
  hooks/        useParishes, useAttendance, useParishContacts
  components/   Logo, Layout, AdminLayout, ProtectedRoute, ui primitives
  pages/        Home, SubmitAttendance, RegisterParish, Directory
    admin/      Login, Dashboard, ParishesAdmin, ParishDetail, AttendanceAdmin
scripts/        seed.mjs, make-admin.mjs, gen-sundays.mjs   (firebase-admin)
seed/           the sample data files above
```

## Commands

| Command                | What it does                                   |
| ---------------------- | ---------------------------------------------- |
| `npm run dev`          | Dev server on :5173                            |
| `npm run build`        | Typecheck, then build to `dist/`               |
| `npm run preview`      | Serve the built `dist/` locally                |
| `npm run typecheck`    | `tsc --noEmit`                                 |
| `npm run seed`         | Load `seed/parishes.json` into Firestore       |
| `npm run make-admin`   | Grant / list / revoke admin access             |
| `npm run gen-sundays`  | Regenerate the Sunday CSVs                     |
