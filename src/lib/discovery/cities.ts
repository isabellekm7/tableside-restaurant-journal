import type { City } from '../../data/types'

export const cityLabel = (city: City): string => `${city.name}, ${city.region}`

/**
 * Match what someone typed to a supported city: exact "Portland, OR", or a
 * unique prefix of the name ("chi", "Portl"). Returns null if nothing or more
 * than one city matches.
 */
export function resolveCity(text: string, cities: readonly City[]): City | null {
  const typed = text.trim().toLowerCase()
  if (!typed) return null
  const exact = cities.find((c) => cityLabel(c).toLowerCase() === typed)
  if (exact) return exact
  const name = typed.split(',')[0]?.trim() ?? ''
  if (!name) return null
  const matches = cities.filter((c) => c.name.toLowerCase().startsWith(name))
  return matches.length === 1 ? (matches[0] ?? null) : null
}
