/**
 * Reads tokens.css as text so the styleguide and the contrast tests use the
 * exact same values the app ships. tokens.css stays the only source of truth.
 */

export interface Token {
  /** Without the leading dashes, e.g. "color-teal-700". */
  name: string
  /** Declared value, e.g. "#0f766e" or "var(--color-teal-700)". */
  value: string
}

export function parseTokens(css: string): Token[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const tokens: Token[] = []
  // Matches `--name: value;` declarations (values never contain ';').
  const declaration = /--([a-z0-9-]+)\s*:\s*([^;{}]+);/gi
  for (const match of withoutComments.matchAll(declaration)) {
    const name = match[1]
    const value = match[2]
    if (!name || !value) continue
    if (value.trim() === 'initial') continue
    tokens.push({ name, value: value.trim() })
  }
  return tokens
}

/** Follow `var(--other)` aliases until a literal value is reached. */
export function resolveToken(tokens: readonly Token[], name: string, depth = 0): string | null {
  if (depth > 10) return null
  const token = tokens.find((t) => t.name === name)
  if (!token) return null
  const alias = /^var\(--([a-z0-9-]+)\)$/i.exec(token.value)
  return alias?.[1] ? resolveToken(tokens, alias[1], depth + 1) : token.value
}

export function isAlias(token: Token): boolean {
  return token.value.startsWith('var(')
}
