import { Skeleton } from '../ui/Skeleton'

/** Shown while a lazily loaded route (styleguide, debug) is fetched on a first visit. */
export function RouteFallback() {
  return (
    <div role="status" aria-label="Loading" className="mx-auto w-full max-w-content px-4 py-8">
      <Skeleton className="h-10 w-1/2" />
    </div>
  )
}
