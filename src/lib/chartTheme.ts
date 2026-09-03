/**
 * Chart palette, derived from the RCCG seal and the Youth Province 23 mark, then
 * checked rather than eyeballed.
 *
 * Every chart here plots one series, so there is no categorical palette to
 * validate — nothing needs to be told apart by hue. Magnitude uses `single`;
 * only growth-vs-decline encodes meaning in colour.
 *
 * Diverging (growth / decline) — #1B57A5, #C0392B:
 *   all checks PASS, deutan ΔE 19.7. Green-vs-red is the intuitive choice for
 *   growth but collapses to ΔE 6.1 for deuteranopes, so blue carries growth and
 *   the bar's direction plus its printed percentage carry the meaning anyway.
 */

export const CHART = {
  /** Single-series marks — magnitude only, no identity to encode. */
  single: '#2E3F81',
  diverging: {
    up: '#1B57A5',
    down: '#C0392B',
    neutral: '#96A5D6',
  },
  grid: '#E2E7F5',
  axis: '#4055A0',
  surface: '#FFFFFF',
  reference: '#96A5D6',
} as const

export const AXIS_TICK = { fontSize: 12, fill: CHART.axis } as const

export const TOOLTIP_STYLE = {
  borderRadius: 10,
  border: `1px solid ${CHART.grid}`,
  boxShadow: '0 8px 24px -12px rgba(13, 20, 54, 0.35)',
  fontSize: 13,
  padding: '8px 12px',
} as const
