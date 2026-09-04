import { useEffect, useState } from 'react'

/**
 * True on phone-width screens.
 *
 * Recharts sizes its axes with numbers, not CSS, so a Tailwind breakpoint
 * cannot reach them: a category axis reserving 170px for church names leaves
 * barely a hundred pixels of plot on a 360px phone, and the bars vanish. This
 * is the one place a media query has to come back into JavaScript.
 *
 * 640px matches Tailwind's `sm`, so the JS and the CSS agree on where a screen
 * stops being a phone.
 */
export function useIsNarrow(maxWidth = 640): boolean {
  const [narrow, setNarrow] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth <= maxWidth,
  )

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${maxWidth}px)`)
    const update = () => setNarrow(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [maxWidth])

  return narrow
}
