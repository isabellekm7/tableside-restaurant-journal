import { ATTRIBUTE_LABELS, ATTR_KEYS } from '../../data/attributes'
import type { AttrKey, Child, KidAttributes } from '../../data/types'
import { attributeFit } from './attributeFit'
import { DEFAULT_SCORING_CONFIG, type ScoringBand, type ScoringConfig } from './config'

export type BreakdownStatus = 'good' | 'okay' | 'poor' | 'unknown'
export type Importance = 'high' | 'medium' | 'low'

export interface BreakdownRow {
  key: AttrKey
  label: string
  /** What parents reported, e.g. "4", "Yes", "Loud". Null when nobody has reported it. */
  value: string | null
  status: BreakdownStatus
  /** How much this matters for the band. */
  importance: Importance
  /** Plain-language note for good/poor rows, e.g. "4 high chairs" / "no changing table". */
  phrase: string | null
  confirmationCount: number | null
  lastConfirmedAt: string | null
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function formatAttributeValue(value: number | boolean | string): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return String(value)
  return capitalize(value)
}

function importanceFor(weight: number): Importance {
  return weight >= 8 ? 'high' : weight >= 5 ? 'medium' : 'low'
}

/**
 * The per-attribute story behind a score for one age band: only attributes that
 * matter for that band, most important first. Facts nobody has reported show as
 * "unknown" rather than being hidden, so gaps are visible.
 */
export function breakdownForBand(
  attributes: Partial<KidAttributes>,
  band: ScoringBand,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): BreakdownRow[] {
  const weights = config.bands[band].weights
  const { strong, weak } = config.explain
  const rows: Array<BreakdownRow & { weight: number }> = []

  for (const key of ATTR_KEYS) {
    const weight = weights[key] ?? 0
    if (weight <= 0) continue
    const fit = attributeFit(key, attributes, band, config)
    const attribute = attributes[key]
    rows.push({
      key,
      weight,
      label: ATTRIBUTE_LABELS[key],
      value: attribute ? formatAttributeValue(attribute.value) : null,
      status: !fit ? 'unknown' : fit.fit >= strong ? 'good' : fit.fit <= weak ? 'poor' : 'okay',
      importance: importanceFor(weight),
      phrase: !fit ? null : fit.fit >= strong ? fit.positive : fit.fit <= weak ? fit.negative : null,
      confirmationCount: attribute?.confirmationCount ?? null,
      lastConfirmedAt: attribute?.lastConfirmedAt ?? null,
    })
  }

  return rows
    .sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label))
    .map(({ weight: _weight, ...row }) => row)
}

export const breakdownForChild = (attributes: Partial<KidAttributes>, child: Child, config?: ScoringConfig): BreakdownRow[] =>
  breakdownForBand(attributes, child.band, config)
