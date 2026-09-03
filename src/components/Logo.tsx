import lockup from './YP23.jpg'

/**
 * The official Youth Province 23 lockup. The artwork already carries the RCCG
 * seal, the Young Adults & Youths crest and the words "YOUTH PROVINCE 23", so
 * the component never repeats the province name in text beside it — only the
 * "Attendance Portal" subtitle, which the artwork does not contain.
 *
 * The file has a white background, so on the navy surfaces (admin sidebar,
 * login screen) it sits on a white chip rather than floating as a pale block.
 */

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
    <span className="flex items-center gap-3">
      <BrandMark height={s.mark} onDark={inverted} />
      {showSubtitle && (
        <span
          className={`font-semibold uppercase tracking-[0.14em] ${s.sub} ${
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
