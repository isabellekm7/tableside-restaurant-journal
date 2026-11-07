import { Check, X } from 'lucide-react'
import { useMemo, useState, type CSSProperties } from 'react'
import { Button } from '../../components/ui/Button'
import tokensCss from '../../styles/tokens.css?raw'
import { CONTRAST_PAIRS } from '../../styles/contrastPairs'
import { contrastRatio, parseHex } from '../../lib/tokens/contrast'
import { isAlias, parseTokens, resolveToken, type Token } from '../../lib/tokens/parse'
import { StyleguideSection, Subheading } from './StyleguideSection'

const tokens = parseTokens(tokensCss)

const byPrefix = (prefix: string) => tokens.filter((t) => t.name.startsWith(prefix))

function Swatch({ token }: { token: Token }) {
  const resolved = resolveToken(tokens, token.name)
  return (
    <li className="flex flex-col gap-2">
      <div
        className="h-16 rounded-md border border-line"
        style={{ background: `var(--${token.name})` }}
        role="img"
        aria-label={`Swatch for ${token.name}`}
      />
      <div className="text-caption">
        <p className="font-semibold break-all">--{token.name}</p>
        <p className="text-text-muted">{isAlias(token) ? `→ ${resolved ?? 'unresolved'}` : token.value}</p>
      </div>
    </li>
  )
}

function SwatchGrid({ list }: { list: readonly Token[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
      {list.map((t) => (
        <Swatch key={t.name} token={t} />
      ))}
    </ul>
  )
}

function ColorSection() {
  const colors = byPrefix('color-')
  const fit = colors.filter((t) => t.name.startsWith('color-fit-'))
  const rest = colors.filter((t) => !t.name.startsWith('color-fit-'))
  const palette = rest.filter((t) => !isAlias(t))
  const semantic = rest.filter((t) => isAlias(t))

  // Group palette by hue name (color-pine-600 → "pine"); single colours go under "Other".
  const hueOf = (t: Token) => {
    const parts = t.name.split('-')
    return /^\d+$/.test(parts[parts.length - 1] ?? '') ? parts[1] : undefined
  }
  const hues = [...new Set(palette.map(hueOf).filter((h): h is string => Boolean(h)))]
  const other = palette.filter((t) => !hueOf(t))

  return (
    <StyleguideSection
      id="color"
      title="Color"
      description="Components use semantic roles; roles point at the palette. Edit src/styles/tokens.css and everything here updates."
    >
      <Subheading>Semantic roles</Subheading>
      <SwatchGrid list={semantic} />
      <Subheading>Kid-fit scale</Subheading>
      <SwatchGrid list={fit} />
      {hues.map((hue) => (
        <div key={hue} className="flex flex-col gap-6">
          <Subheading>Palette · {hue}</Subheading>
          <SwatchGrid list={palette.filter((t) => hueOf(t) === hue)} />
        </div>
      ))}
      <Subheading>Palette · other</Subheading>
      <SwatchGrid list={other} />
    </StyleguideSection>
  )
}

function ContrastSection() {
  const rows = useMemo(
    () =>
      CONTRAST_PAIRS.map((pair) => {
        const fgHex = resolveToken(tokens, pair.fg)
        const bgHex = resolveToken(tokens, pair.bg)
        const fg = fgHex ? parseHex(fgHex) : null
        const bg = bgHex ? parseHex(bgHex) : null
        const ratio = fg && bg ? contrastRatio(fg, bg) : null
        return { pair, ratio }
      }),
    [],
  )
  return (
    <StyleguideSection
      id="contrast"
      title="Contrast (WCAG AA)"
      description="Every pair the UI relies on, checked against AA. The same list is enforced by a unit test, so an edit that breaks AA fails the build."
    >
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[34rem] text-left text-small">
          <caption className="sr-only">Colour contrast ratios for token pairs</caption>
          <thead className="bg-surface-sunken text-text-muted">
            <tr>
              <th scope="col" className="px-4 py-2 font-semibold">Pair</th>
              <th scope="col" className="px-4 py-2 font-semibold">Sample</th>
              <th scope="col" className="px-4 py-2 font-semibold">Ratio</th>
              <th scope="col" className="px-4 py-2 font-semibold">Needs</th>
              <th scope="col" className="px-4 py-2 font-semibold">Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ pair, ratio }) => {
              const pass = ratio !== null && ratio >= pair.min
              return (
                <tr key={pair.label} className="border-t border-line">
                  <th scope="row" className="px-4 py-2 font-medium">{pair.label}</th>
                  <td className="px-4 py-2">
                    <span
                      className="inline-block rounded-sm px-3 py-1 font-semibold"
                      style={{ color: `var(--${pair.fg})`, background: `var(--${pair.bg})` }}
                    >
                      Aa
                    </span>
                  </td>
                  <td className="px-4 py-2 tabular-nums">{ratio ? `${ratio.toFixed(2)}:1` : 'n/a'}</td>
                  <td className="px-4 py-2 tabular-nums">{pair.min}:1</td>
                  <td className="px-4 py-2">
                    <span className={pass ? 'inline-flex items-center gap-1 text-fit-great-fg' : 'inline-flex items-center gap-1 text-danger'}>
                      {pass ? <Check size={16} aria-hidden="true" /> : <X size={16} aria-hidden="true" />}
                      {pass ? 'Pass' : 'Fail'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </StyleguideSection>
  )
}

const DISPLAY_SIZES = new Set(['text-title', 'text-heading', 'text-display'])

function TypeSection() {
  const sizes = tokens.filter((t) => t.name.startsWith('text-') && !t.name.includes('--'))
  const fonts = byPrefix('font-')
  return (
    <StyleguideSection
      id="type"
      title="Typography"
      description="Fraunces for headings, Inter for interface text. Swap the --font-* tokens (and the @fontsource imports in index.css) to change families."
    >
      <ul className="grid gap-4 sm:grid-cols-2">
        {fonts.map((f) => (
          <li key={f.name} className="rounded-lg border border-line bg-surface p-4">
            <p className="text-caption text-text-muted">--{f.name}</p>
            <p className="mt-1 text-title" style={{ fontFamily: `var(--${f.name})` }}>
              Hungry two-year-old, table for four
            </p>
          </li>
        ))}
      </ul>
      <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
        {sizes.map((t) => {
          const style: CSSProperties = {
            fontSize: `var(--${t.name})`,
            lineHeight: `var(--${t.name}--line-height)`,
            fontFamily: DISPLAY_SIZES.has(t.name) ? 'var(--font-display)' : 'var(--font-sans)',
            fontWeight: DISPLAY_SIZES.has(t.name) ? 600 : 400,
          }
          return (
            <li key={t.name} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-baseline sm:gap-6">
              <p className="w-44 shrink-0 text-caption text-text-muted">
                --{t.name} · {t.value}
              </p>
              <p style={style}>A relaxed meal, wherever you are</p>
            </li>
          )
        })}
      </ul>
    </StyleguideSection>
  )
}

function ShapeSection() {
  return (
    <StyleguideSection id="shape" title="Radius, shadow and sizing">
      <Subheading>Radius</Subheading>
      <ul className="flex flex-wrap gap-4">
        {byPrefix('radius-').map((t) => (
          <li key={t.name} className="flex flex-col items-center gap-2 text-caption">
            <div
              className="size-20 border-2 border-primary bg-primary-soft"
              style={{ borderRadius: `var(--${t.name})` }}
              role="img"
              aria-label={`Radius sample ${t.name}`}
            />
            <span className="font-semibold">--{t.name}</span>
            <span className="text-text-muted">{t.value}</span>
          </li>
        ))}
      </ul>
      <Subheading>Shadow</Subheading>
      <ul className="grid gap-6 sm:grid-cols-3">
        {byPrefix('shadow-').map((t) => (
          <li key={t.name} className="flex flex-col gap-2 text-caption">
            <div
              className="h-20 rounded-lg bg-surface"
              style={{ boxShadow: `var(--${t.name})` }}
              role="img"
              aria-label={`Shadow sample ${t.name}`}
            />
            <span className="font-semibold">--{t.name}</span>
          </li>
        ))}
      </ul>
      <Subheading>Touch targets</Subheading>
      <ul className="flex flex-wrap items-end gap-6">
        {byPrefix('size-touch').map((t) => (
          <li key={t.name} className="flex flex-col items-center gap-2 text-caption">
            <div
              className="flex items-center justify-center rounded-md border-2 border-dashed border-primary bg-primary-soft text-primary"
              style={{ width: `var(--${t.name})`, height: `var(--${t.name})` }}
              role="img"
              aria-label={`Touch target sample ${t.name}`}
            />
            <span className="font-semibold">--{t.name}</span>
            <span className="text-text-muted">{t.value}</span>
          </li>
        ))}
      </ul>
    </StyleguideSection>
  )
}

function MotionSection() {
  const [moved, setMoved] = useState(false)
  const durations = byPrefix('duration-')
  return (
    <StyleguideSection
      id="motion"
      title="Motion"
      description="Short, purposeful transitions. With “reduce motion” enabled in the OS, durations collapse to ~0ms and animations stop."
    >
      <ul className="grid gap-4 sm:grid-cols-3">
        {durations.map((t) => (
          <li key={t.name} className="rounded-lg border border-line bg-surface p-4">
            <p className="text-small font-semibold">--{t.name}</p>
            <p className="text-small text-text-muted">{t.value}</p>
            <div className="mt-3 h-3 rounded-pill bg-surface-sunken">
              <div
                className="size-3 rounded-pill bg-primary transition-transform ease-out"
                style={{
                  transitionDuration: `var(--${t.name})`,
                  transform: moved ? 'translateX(calc(100% * 10))' : 'translateX(0)',
                }}
              />
            </div>
          </li>
        ))}
      </ul>
      <div>
        <Button variant="secondary" onClick={() => setMoved((m) => !m)}>
          Replay motion
        </Button>
      </div>
    </StyleguideSection>
  )
}

export function TokenSections() {
  return (
    <>
      <ColorSection />
      <ContrastSection />
      <TypeSection />
      <ShapeSection />
      <MotionSection />
    </>
  )
}
