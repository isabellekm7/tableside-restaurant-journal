import { describe, expect, it } from 'vitest'
import tokensCss from '../../styles/tokens.css?raw'
import { CONTRAST_PAIRS } from '../../styles/contrastPairs'
import { contrastRatio, parseHex } from './contrast'
import { isAlias, parseTokens, resolveToken } from './parse'

const tokens = parseTokens(tokensCss)

describe('parseTokens', () => {
  it('reads declarations and ignores resets and comments', () => {
    const parsed = parseTokens(`
      /* --color-nope: #000; */
      @theme { --color-*: initial; --color-a: #fff; --color-b: var(--color-a); }
    `)
    expect(parsed).toEqual([
      { name: 'color-a', value: '#fff' },
      { name: 'color-b', value: 'var(--color-a)' },
    ])
  })

  it('resolves alias chains and returns null for unknown tokens', () => {
    const chain = parseTokens('--a: #123456; --b: var(--a); --c: var(--b);')
    expect(resolveToken(chain, 'c')).toBe('#123456')
    expect(resolveToken(chain, 'missing')).toBeNull()
  })

  it('flags aliases', () => {
    expect(isAlias({ name: 'x', value: 'var(--y)' })).toBe(true)
    expect(isAlias({ name: 'x', value: '#fff' })).toBe(false)
  })
})

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for identical colours', () => {
    const black = parseHex('#000')
    const white = parseHex('#ffffff')
    if (!black || !white) throw new Error('hex parse failed')
    expect(contrastRatio(black, white)).toBeCloseTo(21, 5)
    expect(contrastRatio(white, white)).toBeCloseTo(1, 5)
  })
})

describe('tokens.css meets WCAG AA for declared pairs', () => {
  it.each(CONTRAST_PAIRS.map((p) => [p.label, p] as const))('%s', (_label, pair) => {
    const fgValue = resolveToken(tokens, pair.fg)
    const bgValue = resolveToken(tokens, pair.bg)
    expect(fgValue, `token --${pair.fg} should exist`).not.toBeNull()
    expect(bgValue, `token --${pair.bg} should exist`).not.toBeNull()
    const fg = parseHex(fgValue ?? '')
    const bg = parseHex(bgValue ?? '')
    expect(fg, `--${pair.fg} should resolve to a hex colour`).not.toBeNull()
    expect(bg, `--${pair.bg} should resolve to a hex colour`).not.toBeNull()
    if (!fg || !bg) return
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(pair.min)
  })
})
