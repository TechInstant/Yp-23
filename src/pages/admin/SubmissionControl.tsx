import { Alert, SkeletonForm } from '../../components/ui'
import SubmissionCutoff from '../../components/SubmissionCutoff'
import SubmissionExceptions from '../../components/SubmissionExceptions'
import { useAuth } from '../../context/AuthContext'
import { useParishes } from '../../hooks/useParishes'
import { useSubmissionSettings } from '../../hooks/useSubmissionSettings'
import { minutesToLabel, NO_CUTOFF, utcToWatMinutes } from '../../lib/submissionWindow'
import { formatSundayLong, SEASON_START } from '../../lib/sundays'

/**
 * The two controls over when a parish may file, on one screen.
 *
 * They belong together: the cut-off sets the rule for everybody, and an
 * exception bends it for one parish on one Sunday. Buried at the bottom of the
 * attendance list they were easy to miss, and the exception in particular is
 * needed in a hurry, on the day, when a pastor rings to say they could not file.
 */
export default function SubmissionControl() {
  const { isSuperAdmin } = useAuth()
  const { active, loading } = useParishes()
  const { closesAtUtcMinutes } = useSubmissionSettings()

  if (!isSuperAdmin) {
    return (
      <Alert tone="info" title="Super admins only">
        Only a super admin can change the submission cut-off or re-open a Sunday for a parish.
      </Alert>
    )
  }

  if (loading) return <SkeletonForm fields={3} />

  const cutoffWat = utcToWatMinutes(closesAtUtcMinutes)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">Submission control</h1>
        <p className="mt-1 text-sm text-navy-600">
          When parishes may file their returns, and who gets a second chance.
        </p>
      </header>

      <Alert tone="info" title="How submission works">
        <p>
          A parish can only file on the Sunday of the service, before{' '}
          <strong>
            {cutoffWat >= NO_CUTOFF ? 'the end of the day' : minutesToLabel(cutoffWat)}
          </strong>
          , and only once. Returns run every Sunday from {formatSundayLong(SEASON_START)}.
        </p>
        <p className="mt-2">
          Admins are not bound by either rule and can record a return at any time, so a figure
          phoned in during the week never has to be lost.
        </p>
      </Alert>

      <SubmissionCutoff />

      <SubmissionExceptions parishes={active} />
    </div>
  )
}
