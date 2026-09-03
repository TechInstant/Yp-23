/**
 * Chart palette, derived from the RCCG seal and the Youth Province 23 mark, then
 * checked rather than eyeballed.
 *
 * Categorical (Ife / Ede) — #4055A0, #B0851F:
 *   lightness band PASS · chroma floor PASS · CVD separation PASS
 *   (worst adjacent ΔE 27.6 protan, 24.9 tritan) · normal-vision ΔE 29.9 PASS ·
 *   contrast vs surface PASS.
 *   The obvious brand pair (navy #2E3F81 + gold #C99A2E) failed: the navy sat
 *   below the lightness band and the gold came in at 2.51:1 against white.
 *
 * Diverging (growth / decline) — #1B57A5, #C0392B:
 *   all checks PASS, deutan ΔE 19.7. Green-vs-red is the intuitive choice for
 *   growth but collapses to ΔE 6.1 for deuteranopes, so blue carries growth and
 *   the bar's direction plus its printed percentage carry the meaning anyway.
 */

export const CHART = {
  /** Fixed order. Never cycled, never reassigned by rank. */
  categorical: {
    IFE: '#4055A0',
    EDE: '#B0851F',
  },
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
