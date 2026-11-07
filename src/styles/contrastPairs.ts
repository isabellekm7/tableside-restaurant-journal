/**
 * Colour pairs that must keep their contrast when someone edits tokens.css.
 * Enforced by src/lib/tokens/tokens.test.ts and displayed in /styleguide.
 *
 * min 4.5 → WCAG AA for normal text
 * min 3   → WCAG AA for large text and UI boundaries / focus indicators
 */
export interface ContrastPair {
  label: string
  /** Token names without leading dashes. */
  fg: string
  bg: string
  min: 3 | 4.5
}

const fitLevels = ['great', 'good', 'mixed', 'poor', 'unknown'] as const

export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  { label: 'Body text on page', fg: 'color-text', bg: 'color-bg', min: 4.5 },
  { label: 'Body text on card', fg: 'color-text', bg: 'color-surface', min: 4.5 },
  { label: 'Muted text on page', fg: 'color-text-muted', bg: 'color-bg', min: 4.5 },
  { label: 'Muted text on card', fg: 'color-text-muted', bg: 'color-surface', min: 4.5 },
  { label: 'Subtle text on page', fg: 'color-text-subtle', bg: 'color-bg', min: 4.5 },
  { label: 'Subtle text on card', fg: 'color-text-subtle', bg: 'color-surface', min: 4.5 },
  { label: 'Subtle text on sunken', fg: 'color-text-subtle', bg: 'color-surface-sunken', min: 4.5 },
  { label: 'Primary button text', fg: 'color-on-primary', bg: 'color-primary', min: 4.5 },
  { label: 'Primary button text (hover)', fg: 'color-on-primary', bg: 'color-primary-hover', min: 4.5 },
  { label: 'Accent button text', fg: 'color-on-accent', bg: 'color-accent', min: 4.5 },
  { label: 'Primary as link text on page', fg: 'color-primary', bg: 'color-bg', min: 4.5 },
  { label: 'Primary on soft tint', fg: 'color-primary', bg: 'color-primary-soft', min: 4.5 },
  { label: 'Error text on error tint', fg: 'color-danger', bg: 'color-danger-bg', min: 4.5 },
  { label: 'Input border on card', fg: 'color-line-strong', bg: 'color-surface', min: 3 },
  { label: 'Focus ring on page', fg: 'color-focus', bg: 'color-bg', min: 3 },
  { label: 'Focus ring on card', fg: 'color-focus', bg: 'color-surface', min: 3 },
  ...fitLevels.flatMap((level): ContrastPair[] => [
    { label: `Fit “${level}” badge`, fg: `color-fit-${level}-fg`, bg: `color-fit-${level}-bg`, min: 4.5 },
    { label: `Fit “${level}” pin`, fg: 'color-on-solid', bg: `color-fit-${level}-solid`, min: 4.5 },
  ]),
]
