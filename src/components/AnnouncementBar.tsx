import { useAnnouncements } from '../hooks/useAnnouncements'
import type { Announcement } from '../types'

/**
 * The province's notices, across the top of every public page.
 *
 * Shown to everyone, signed in or not — a pastor filing a return has no
 * account, so anything gated behind sign-in would never reach the people it is
 * written for.
 */
export default function AnnouncementBar() {
  const { live } = useAnnouncements()
  if (live.length === 0) return null

  return (
    <div className="border-b border-gold-200 bg-gold-50">
      {live.map((a) => (
        <Notice key={a.id} announcement={a} />
      ))}
    </div>
  )
}

function Notice({ announcement }: { announcement: Announcement }) {
  const { message, marquee } = announcement

  if (!marquee) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-2.5">
        <p className="text-sm font-medium text-gold-900">{message}</p>
      </div>
    )
  }

  // Roughly 9 characters a second: fast enough not to drag, slow enough to
  // read on a phone. A fixed duration would make a short notice crawl and a
  // long one race past.
  const seconds = Math.max(12, Math.round((message.length * 2) / 9) + 6)

  return (
    <div className="marquee overflow-hidden py-2.5 flex select-none" role="status" aria-live="polite">
      {/* 
        Two identical marquee items side-by-side. Each item has min-width: 100% and
        translates -100%. This provides a seamless loop across all mobile devices
        without flex percentage sizing bugs.
      */}
      <div
        className="marquee-item shrink-0 flex items-center justify-around min-w-full"
        style={{ animationDuration: `${seconds}s` }}
      >
        <span className="px-4 text-sm font-medium text-gold-900">{message}</span>
      </div>
      <div
        className="marquee-item shrink-0 flex items-center justify-around min-w-full"
        style={{ animationDuration: `${seconds}s` }}
        aria-hidden="true"
      >
        <span className="px-4 text-sm font-medium text-gold-900">{message}</span>
      </div>
    </div>
  )
}
