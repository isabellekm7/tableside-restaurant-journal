import { describe, expect, it } from 'vitest'
import baseCss from '../styles/base.css?raw'
import tokensCss from '../styles/tokens.css?raw'
import { parseTokens, resolveToken } from '../lib/tokens/parse'

/*
 * Guarantees from the brief that are easy to break by accident and hard to notice:
 * reduced motion, minimum touch targets, and that no source file animates without a way to stop it.
 */

const tokens = parseTokens(tokensCss)

/** Press-scale and looping-animation utilities that are NOT behind motion-safe (the sheet's one-shot entrance is exempt). */
function unsafeMotion(text: string): string[] {
  const found: string[] = []
  for (const match of text.matchAll(/(?<!motion-safe:)(?<![\w-])(active:scale-[\w.[\]-]+|animate-[\w-]+)/g)) {
    const utility = match[1] ?? ''
    if (utility !== 'animate-sheet-in') found.push(utility)
  }
  return found
}

describe('reduced motion', () => {
  it('collapses every animation and transition when the user asks for reduced motion', () => {
    const block = baseCss.slice(baseCss.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(block).toContain('animation-duration: 0.01ms !important')
    expect(block).toContain('transition-duration: 0.01ms !important')
    expect(block).toContain('animation-iteration-count: 1 !important')
    expect(block).toContain('scroll-behavior: auto !important')
  })

  it('zeroes the motion duration tokens too, for anything that reads them directly', () => {
    for (const name of ['duration-fast', 'duration-base', 'duration-slow']) {
      expect(baseCss).toMatch(new RegExp(`--${name}:\\s*0\\.01ms`))
      expect(resolveToken(tokens, name)).toMatch(/ms$/)
    }
  })

  // Source files are read as text so a new animation can't silently skip the rule.
  const sources = import.meta.glob(['../**/*.tsx', '!../**/*.test.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>

  it('only uses press-scale and looping animations behind motion-safe (or the globally disabled sheet animation)', () => {
    const offenders = Object.entries(sources).flatMap(([file, text]) => unsafeMotion(text).map((u) => `${file}: ${u}`))
    expect(offenders).toEqual([])
  })

  it('the scan itself works: it flags unsafe motion and accepts safe motion', () => {
    expect(unsafeMotion('class="active:scale-95"')).toEqual(['active:scale-95'])
    expect(unsafeMotion('class="animate-spin"')).toEqual(['animate-spin'])
    expect(unsafeMotion('class="motion-safe:active:scale-[0.98] motion-safe:animate-shimmer open:animate-sheet-in"')).toEqual([])
  })
})

describe('touch targets', () => {
  const rem = (value: string | null) => (value ? Number.parseFloat(value) * 16 : 0)

  it('keeps the minimum target at 44px or more, and the primary-action target larger', () => {
    expect(rem(resolveToken(tokens, 'size-touch'))).toBeGreaterThanOrEqual(44)
    expect(rem(resolveToken(tokens, 'size-touch-lg'))).toBeGreaterThan(rem(resolveToken(tokens, 'size-touch')))
  })
})

describe('focus', () => {
  it('draws a clear, thick focus ring on every keyboard-focused element', () => {
    expect(baseCss).toMatch(/:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--color-focus\)/)
  })
})
