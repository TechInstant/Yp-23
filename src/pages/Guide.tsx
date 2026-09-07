import { Link } from 'react-router-dom'
import { useSubmissionSettings } from '../hooks/useSubmissionSettings'
import { minutesToLabel, NO_CUTOFF, utcToWatMinutes } from '../lib/submissionWindow'
import { formatSundayLong, SEASON_END, SEASON_START } from '../lib/sundays'

/**
 * The pastors' guide.
 *
 * A page rather than a PDF, so it can be sent as a link in the same WhatsApp
 * message as the portal itself, opens on any phone, and never goes stale in
 * someone's downloads folder while the app moves on.
 */
export default function Guide() {
  const { closesAtUtcMinutes } = useSubmissionSettings()
  const cutoffWat = utcToWatMinutes(closesAtUtcMinutes)
  const deadline =
    cutoffWat < NO_CUTOFF ? minutesToLabel(cutoffWat) : 'the end of the day'

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">
          How to submit your attendance
        </h1>
        <p className="mt-2 text-navy-600">
          A short guide for pastors in Youth Province 23. Nothing here needs a password, and it
          takes about a minute each Sunday.
        </p>
      </header>

      <Step n="1" title="Confirm your parish before the first Sunday">
        <p>
          Open{' '}
          <Link to="/register" className="font-medium text-navy-800 underline">
            Confirm your parish
          </Link>
          , find your parish in the list, and put in your name and phone number. That is all it
          asks for.
        </p>
        <p>
          This is done <strong>once</strong>. It tells the province who is in charge of your
          parish and how to reach you. If your parish is not in the list, switch to "My parish is not listed" and register it. The province will approve it.
        </p>
        <Callout>
          A parish can only be confirmed once. If someone has already confirmed yours by mistake,
          ask the province to correct it.
        </Callout>
      </Step>

      <Step n="2" title="Submit your figure on the Sunday">
        <p>
          After your service, open{' '}
          <Link to="/submit" className="font-medium text-navy-800 underline">
            Submit attendance
          </Link>{' '}
          and fill in four things: your parish, your name, your phone number, and the total number
          of people present.
        </p>
        <p>
          The Sunday is filled in for you, so you cannot pick the wrong date. Add a note if
          something unusual happened, like a convention or a joint service, so the province reads
          the figure correctly.
        </p>
        <Callout tone="warning">
          <strong>The form only opens on Sundays.</strong> It is not available on Monday or during
          the week. If you miss a Sunday, send your figure to the province. They can record it for you, or re-open that Sunday so you can file it yourself.
        </Callout>
      </Step>

      <Step n="3" title="Check that you have been counted">
        <p>
          Go back to the{' '}
          <Link to="/" className="font-medium text-navy-800 underline">
            home page
          </Link>
          . Your parish appears in the "Uploaded" list for that Sunday as soon as your
          return is saved, with your figure beside it.
        </p>
        <p>
          If it is not there, your return did not save. Fill the form in again and watch for the green confirmation.
        </p>
      </Step>

      <Step n="4" title="Watch how your parish is doing">
        <p>
          On the home page, pick your parish under "How is your parish doing?" You will see
          your own Sundays, your average, your best Sunday, and whether you are growing, holding
          steady or declining.
        </p>
        <p>
          The dashed blue line is your four-week average. That is the one to judge by. A single Sunday moves up and down with the weather.
        </p>
        <Callout>Only your own parish is shown. No other parish&apos;s figures appear here.</Callout>
      </Step>

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-navy-900">Common questions</h2>
        <dl className="mt-4 space-y-4 text-sm">
          <Faq q="I submitted the wrong number. Can I fix it?">
            Not yourself. One return per parish per Sunday, so the form will not take a second one. Send the correct figure to the province and they will change it.
          </Faq>
          <Faq q="Somebody else already submitted for my parish.">
            Tell the province. They can remove that return so the right figure can be filed.
          </Faq>
          <Faq q="Do I need a password?">
            No. Only province executives sign in. Pastors submit without an account.
          </Faq>
          <Faq q="I forgot to submit last Sunday.">
            Send your reasons to the province. Note that submission closes {deadline} on Sundays unless the province says otherwise.
          </Faq>
          <Faq q="What number do I count?">
            The total number of people present at the Sunday service: everyone, including children and visitors, unless the province tells you otherwise.
          </Faq>
          <Faq q="My phone number has changed.">
            Just type the new one next time you submit. The province&apos;s contact list updates
            from your return.
          </Faq>
        </dl>
      </section>

      <section className="card bg-navy-900 p-5 text-white sm:p-6">
        <h2 className="text-lg font-semibold">The short version</h2>
        <ol className="mt-3 space-y-2 text-sm text-navy-100">
          <li>1. Confirm your parish once, before the exercise starts.</li>
          <li>2. Every Sunday after service, submit your total.</li>
          <li>3. Check your parish shows in the uploaded list.</li>
        </ol>
        <p className="mt-4 text-sm text-navy-200">
          Returns run every Sunday from {formatSundayLong(SEASON_START)} to{' '}
          {formatSundayLong(SEASON_END)}.
        </p>
        <Link to="/submit" className="btn-gold mt-5 w-full sm:w-auto">
          Go to the attendance form
        </Link>
      </section>
    </div>
  )
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-100 text-sm font-bold text-gold-700">
          {n}
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-navy-900">{title}</h2>
          <div className="mt-2 space-y-3 text-sm leading-relaxed text-navy-600">{children}</div>
        </div>
      </div>
    </section>
  )
}

function Callout({
  children,
  tone = 'info',
}: {
  children: React.ReactNode
  tone?: 'info' | 'warning'
}) {
  return (
    <p
      className={`rounded-lg border px-3.5 py-2.5 text-sm ${
        tone === 'warning'
          ? 'border-gold-200 bg-gold-50 text-gold-900'
          : 'border-navy-100 bg-navy-50 text-navy-700'
      }`}
    >
      {children}
    </p>
  )
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-semibold text-navy-900">{q}</dt>
      <dd className="mt-1 text-navy-600">{children}</dd>
    </div>
  )
}
