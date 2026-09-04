import lockup from './YP23.jpg'
const SIZES = {
  sm: { mark: 34, sub: 'text-[10px]' },
  md: { mark: 44, sub: 'text-[11px]' },
  lg: { mark: 96, sub: 'text-xs' },
} as const

export type LogoSize = keyof typeof SIZES

export function BrandMark({
  height = 44,
  onDark = false,
  className = '',
}: {
  height?: number
  onDark?: boolean
  className?: string
}) {
  return (
    <img
      src={lockup}
      alt="RCCG Youth Province 23"
      style={{ height, width: 'auto' }}
      className={`shrink-0 object-contain ${
        onDark ? 'rounded-md bg-white p-1.5' : ''
      } ${className}`}
    />
  )
}

export default function Logo({
  size = 'md',
  inverted = false,
  showSubtitle = true,
}: {
  size?: LogoSize
  inverted?: boolean
  showSubtitle?: boolean
}) {
  const s = SIZES[size]
  return (
    <span className="flex min-w-0 items-center gap-2 sm:gap-3">
      {/* The lockup is a wide image with width:auto, so on a 320px screen it
          would push the menu button off the header. Capping its width lets it
          letterbox instead of overflowing. */}
      <BrandMark
        height={s.mark}
        onDark={inverted}
        className="max-w-[55vw] sm:max-w-none"
      />
      {showSubtitle && (
        <span
          className={`hidden font-semibold uppercase tracking-[0.14em] sm:inline-block ${s.sub} ${
            inverted ? 'text-navy-200' : 'text-navy-500'
          }`}
        >
          Attendance
          <br />
          Portal
        </span>
      )}
    </span>
  )
}
