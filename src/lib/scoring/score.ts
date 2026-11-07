import { ATTR_KEYS } from '../../data/attributes'
import { AGE_BANDS, type AgeBand, type AttrKey, type Child, type Restaurant } from '../../data/types'
import { FIT_LEVEL_LABEL, type FitLevel } from '../fit'
import { describeChild } from './ageBands'
import { attributeFit } from './attributeFit'
import { DEFAULT_SCORING_CONFIG, type ScoringBand, type ScoringConfig } from './config'

/**
 * The scorer reads ONLY these fields. Commercial metadata (`listing`) is
 * excluded by the type, so paid placement cannot influence a score.
 */
export type ScorableRestaurant = Pick<Restaurant, 'attributes' | 'parentSignals'>

export interface ChildFit {
  childId: string
  band: AgeBand
  ageYears?: number
  /** "2-year-old", "toddler", … */
  description: string
  /** 0-100 after caps. */
  score: number
  level: FitLevel
  /** Share (0-1) of this band's attribute weight the restaurant has reported. */
  coverage: number
  reasons: string[]
  warnings: string[]
  /** One sentence explaining the result. */
  summary: string
  /** True when a hard requirement lowered the score. */
  capped: boolean
}

export interface KidFitResult {
  /**
   * 0-100. The lowest child score: the strictest need wins.
   * NOT meaningful when `level` is "unknown" (too few parent reports): the UI
   * should hide the number and sort such places last.
   */
  score: number
  level: FitLevel
  /** Plain-language name for the level, e.g. "Good fit". */
  label: string
  /** One sentence that always explains the result, including which child drove it. */
  summary: string
  reasons: string[]
  warnings: string[]
  perChild: ChildFit[]
  /** The child whose needs set the score; null when no children were given. */
  drivingChildId: string | null
  confidence: 'high' | 'medium' | 'low'
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function levelFor(score: number, coverage: number, config: ScoringConfig): FitLevel {
  if (coverage < config.minCoverage) return 'unknown'
  if (score >= config.levels.great) return 'great'
  if (score >= config.levels.good) return 'good'
  if (score >= config.levels.mixed) return 'mixed'
  return 'poor'
}

/** Build the explanatory sentence for one audience ("your 2-year-old", "families", …). */
function sentence(level: FitLevel, who: string, reasons: readonly string[], warnings: readonly string[]): string {
  if (level === 'unknown') return `Not enough parent reports yet for ${who}.`
  if (level === 'great' || level === 'good') {
    const lead = level === 'great' ? 'Great for' : 'Good for'
    const because = reasons.length ? `: ${reasons.join(', ')}` : ''
    const less = warnings.length ? ` Less ideal: ${warnings.join(', ')}.` : ''
    return `${lead} ${who}${because}.${less}`
  }
  const lead = level === 'mixed' ? 'Mixed for' : 'Not a good fit for'
  const because = warnings.length ? warnings.join(', ') : 'few things line up'
  const plus = reasons.length ? ` On the plus side: ${reasons.join(', ')}.` : ''
  return `${lead} ${who}: ${because}.${plus}`
}

interface BandScore {
  score: number
  coverage: number
  level: FitLevel
  reasons: string[]
  warnings: string[]
  capped: boolean
}

function scoreForBand(
  restaurant: ScorableRestaurant,
  band: ScoringBand,
  audience: string,
  config: ScoringConfig,
): BandScore {
  const bandConfig = config.bands[band]
  let totalWeight = 0
  let knownWeight = 0
  let weighted = 0
  const components: Array<{ key: AttrKey; weight: number; fit: number; positive: string; negative: string }> = []

  for (const key of ATTR_KEYS) {
    const weight = bandConfig.weights[key] ?? 0
    if (weight <= 0) continue
    totalWeight += weight
    const result = attributeFit(key, restaurant.attributes, band, config)
    if (!result) continue
    knownWeight += weight
    weighted += weight * result.fit
    components.push({ key, weight, ...result })
  }

  const raw = knownWeight > 0 ? (100 * weighted) / knownWeight : 50
  const coverage = totalWeight > 0 ? knownWeight / totalWeight : 0

  // Hard requirements and "Not for us" reports.
  let ceiling = 100
  const capWarnings: string[] = []
  const capAttrs = new Set<AttrKey>()
  for (const cap of bandConfig.caps) {
    const fit = attributeFit(cap.attr, restaurant.attributes, band, config)?.fit
    if (fit === undefined || fit > cap.atMost) continue
    ceiling = Math.min(ceiling, cap.cap)
    capWarnings.push(cap.warning)
    capAttrs.add(cap.attr)
  }
  const { reportCount, notForUsCount } = restaurant.parentSignals
  const nfu = config.notForUs
  if (reportCount >= nfu.minReports && notForUsCount / reportCount >= nfu.minShare) {
    ceiling = Math.min(ceiling, nfu.cap)
    capWarnings.push(nfu.warning)
  }

  const score = Math.round(Math.min(raw, ceiling))
  const level = levelFor(score, coverage, config)
  const { strong, weak, maxReasons, maxWarnings } = config.explain

  const reasons = components
    .filter((c) => c.fit >= strong)
    .sort((a, b) => b.weight * b.fit - a.weight * a.fit)
    .slice(0, maxReasons)
    .map((c) => c.positive)

  const softWarnings = components
    .filter((c) => c.fit <= weak && !capAttrs.has(c.key))
    .sort((a, b) => b.weight * (1 - b.fit) - a.weight * (1 - a.fit))
    .map((c) => c.negative)

  const warnings = [...capWarnings, ...softWarnings].slice(0, maxWarnings)
  if (level === 'unknown') warnings.unshift(`not enough parent reports yet to judge this for ${audience}`)

  return { score, coverage, level, reasons, warnings, capped: Math.min(raw, ceiling) < raw }
}

export function scoreChild(
  restaurant: ScorableRestaurant,
  child: Child,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): ChildFit {
  const description = describeChild(child)
  const result = scoreForBand(restaurant, child.band, `your ${description}`, config)
  return {
    childId: child.id,
    band: child.band,
    ...(child.ageYears !== undefined && { ageYears: child.ageYears }),
    description,
    ...result,
    summary: sentence(result.level, `your ${description}`, result.reasons, result.warnings),
  }
}

/** Order for tie-breaks: younger children first (their needs are usually stricter). */
function youngerFirst(a: ChildFit, b: ChildFit): number {
  const byBand = AGE_BANDS.indexOf(a.band) - AGE_BANDS.indexOf(b.band)
  if (byBand !== 0) return byBand
  return (a.ageYears ?? 0) - (b.ageYears ?? 0)
}

/**
 * Kid-fit for a whole family. Pure: same inputs always give the same output,
 * and nothing is mutated.
 *
 * - No children → a generic "welcomes families" read, flagged in the summary.
 * - One or more children → each is scored for their own age band; the family
 *   score is the lowest one, and the summary names the child who drove it.
 */
export function scoreRestaurant(
  restaurant: ScorableRestaurant,
  children: readonly Child[],
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): KidFitResult {
  if (children.length === 0) {
    const generic = scoreForBand(restaurant, 'generic', 'families', config)
    const base = sentence(generic.level, 'families', generic.reasons, generic.warnings)
    return {
      score: generic.score,
      level: generic.level,
      label: FIT_LEVEL_LABEL[generic.level],
      summary: `${base} Add your kids’ ages for a fit that’s specific to them.`,
      reasons: generic.reasons,
      warnings: generic.warnings,
      perChild: [],
      drivingChildId: null,
      confidence: confidenceFor(generic.coverage, config),
    }
  }

  const perChild = children.map((child) => scoreChild(restaurant, child, config))
  const known = perChild.filter((c) => c.level !== 'unknown')
  const pool = known.length > 0 ? known : perChild
  const sortedLowFirst = [...pool].sort((a, b) => a.score - b.score || youngerFirst(a, b))
  const driving = sortedLowFirst[0]
  const best = sortedLowFirst[sortedLowFirst.length - 1]
  if (!driving || !best) throw new Error('unreachable: children is non-empty')

  const level = known.length > 0 ? driving.level : 'unknown'
  const multiple = perChild.length > 1
  const prefix = (c: ChildFit, text: string) => (multiple ? `${capitalize(`your ${c.description}`)}: ${text}` : text)

  // Driving child's notes first, so the most important ones lead.
  const ordered = [driving, ...perChild.filter((c) => c !== driving)]
  const reasons = ordered.flatMap((c) => c.reasons.map((r) => prefix(c, r)))
  const warnings = ordered.flatMap((c) => c.warnings.map((w) => prefix(c, w)))

  const summary = groupSummary({ perChild, known, driving, best, level, multiple })

  return {
    score: driving.score,
    level,
    label: FIT_LEVEL_LABEL[level],
    summary,
    reasons,
    warnings,
    perChild,
    drivingChildId: driving.childId,
    confidence: confidenceFor(Math.min(...perChild.map((c) => c.coverage)), config),
  }
}

function groupSummary(input: {
  perChild: readonly ChildFit[]
  known: readonly ChildFit[]
  driving: ChildFit
  best: ChildFit
  level: FitLevel
  multiple: boolean
}): string {
  const { perChild, known, driving, best, level, multiple } = input
  if (!multiple) return driving.summary

  const unknownNote = perChild
    .filter((c) => c.level === 'unknown')
    .map((c) => ` Not enough parent reports yet for your ${c.description}.`)
    .join('')

  if (known.length === 0) {
    return `Not enough parent reports yet for any of your kids.`
  }

  // "Held back" only when the strictest child lands in a worse band than the best-off child.
  // Two "great" fits with different scores are still great for everyone.
  if (best !== driving && best.level !== driving.level) {
    const why = driving.warnings.length ? driving.warnings.slice(0, 2).join(', ') : 'a weaker overall fit'
    const goodNews =
      best.level === 'great' || best.level === 'good' ? ` Works well for your ${best.description}.` : ''
    return `Held back by your ${driving.description}: ${why}.${goodNews}${unknownNote}`
  }

  // "Great for all of your kids" reads well; "Not a good fit for all of your kids" does not.
  const who = level === 'great' || level === 'good' ? 'all of your kids' : 'your kids'
  return `${sentence(level, who, driving.reasons, driving.warnings)}${unknownNote}`
}

function confidenceFor(coverage: number, config: ScoringConfig): 'high' | 'medium' | 'low' {
  if (coverage >= config.confidenceHigh) return 'high'
  if (coverage >= config.minCoverage) return 'medium'
  return 'low'
}
