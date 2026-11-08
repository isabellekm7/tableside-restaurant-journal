import { MAX_LIST_NAME, MAX_LIST_SIZE, sanitizeListName } from '../trips/lists'

/**
 * A shareable trip summary lives entirely in the URL (no server, no account): the list's
 * name and the restaurant ids. It contains nothing personal beyond what the sender typed
 * as the list name, and works offline on the receiver's side because the sample data ships
 * with the app.
 */
export interface SharedList {
  name: string
  restaurantIds: string[]
}

export const SHARE_PATH = '/shared'
// Restaurant ids are short slugs; anything else in a link is junk or an attack.
const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/

export function buildShareUrl(origin: string, list: SharedList): string {
  const params = new URLSearchParams()
  params.set('n', sanitizeListName(list.name))
  params.set('r', list.restaurantIds.slice(0, MAX_LIST_SIZE).join(','))
  return `${origin}${SHARE_PATH}?${params.toString()}`
}

/** Read a share link's query string. Returns null for anything that isn't a usable list. */
export function parseShareParams(search: string): SharedList | null {
  const params = new URLSearchParams(search)
  const ids = [...new Set((params.get('r') ?? '').split(',').map((s) => s.trim()).filter((s) => SAFE_ID.test(s)))].slice(0, MAX_LIST_SIZE)
  if (ids.length === 0) return null
  const name = sanitizeListName((params.get('n') ?? '').slice(0, MAX_LIST_NAME * 2), 'Shared trip')
  return { name, restaurantIds: ids }
}
