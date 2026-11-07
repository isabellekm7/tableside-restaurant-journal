import { repository, type Restaurant, type WaitEstimate } from '../../data'

/** Wait estimates for many restaurants at once. A failed lookup is just "no estimate", never an error. */
export async function loadWaits(restaurants: readonly Restaurant[], at: Date): Promise<Map<string, WaitEstimate | null>> {
  const entries = await Promise.all(
    restaurants.map(async (r): Promise<[string, WaitEstimate | null]> => [r.id, await repository.getWait(r.id, at).catch(() => null)]),
  )
  return new Map(entries)
}
