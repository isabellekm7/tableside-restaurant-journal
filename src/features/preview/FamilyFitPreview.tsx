import { useEffect, useMemo, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { FitBadge } from '../../components/ui/FitBadge'
import { SampleDataTag } from '../../components/ui/SampleDataTag'
import { Skeleton } from '../../components/ui/Skeleton'
import { repository, type Restaurant } from '../../data'
import { FIT_LEVEL_LABEL } from '../../lib/fit'
import { scoreRestaurant } from '../../lib/scoring'
import { useProfileStore } from '../../store/profileStore'

/** A spread of sample archetypes so changing the kids' ages visibly changes the result. */
const PREVIEW_IDS = [
  'pdx-little-fern-kitchen',
  'chi-quiet-spoon-tea-room',
  'pdx-tinderbox-pizza-yard',
  'chi-fiddlehead-family-table',
  'pdx-marlow-finch-bistro',
  'chi-kettle-crumb-cafe',
]

/**
 * TEMPORARY (Phase 3): proves the child profile drives kid-fit. Discovery
 * replaces it in Phase 4.
 */
export function FamilyFitPreview() {
  const children = useProfileStore((s) => s.children)
  const [restaurants, setRestaurants] = useState<Restaurant[] | null>(null)

  useEffect(() => {
    let cancelled = false
    void Promise.all(PREVIEW_IDS.map((id) => repository.getRestaurant(id))).then((list) => {
      if (!cancelled) setRestaurants(list.filter((r): r is Restaurant => r !== null))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const results = useMemo(
    () => (restaurants ?? []).map((restaurant) => ({ restaurant, fit: scoreRestaurant(restaurant, children) })),
    [restaurants, children],
  )

  if (!restaurants) {
    return (
      <div role="status" aria-label="Loading sample restaurants" className="grid gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    )
  }

  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {results.map(({ restaurant, fit }) => (
        <li key={restaurant.id}>
          <Card as="article" aria-labelledby={`preview-${restaurant.id}`} className="h-full">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id={`preview-${restaurant.id}`} className="text-title">
                  {restaurant.name}
                </h3>
                <p className="text-small text-text-muted">
                  {restaurant.cuisine} · {restaurant.neighborhood}
                </p>
              </div>
              <FitBadge size="sm" level={fit.level} score={fit.level === 'unknown' ? undefined : fit.score} />
            </div>
            <p className="mt-3 text-small">{fit.summary}</p>
            {fit.perChild.length > 1 && (
              <ul className="mt-3 flex flex-wrap gap-2" aria-label="Fit for each child">
                {fit.perChild.map((c) => (
                  <li key={c.childId}>
                    <FitBadge size="sm" level={c.level} label={`${c.description} · ${FIT_LEVEL_LABEL[c.level]}`} />
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3">
              <SampleDataTag />
            </p>
          </Card>
        </li>
      ))}
    </ul>
  )
}
