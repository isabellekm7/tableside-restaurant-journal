import { Card } from '../../components/ui/Card'
import { Skeleton } from '../../components/ui/Skeleton'

export function RestaurantCardSkeletons({ count = 3 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading restaurants" className="flex flex-col gap-4">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-7 w-24 rounded-pill" />
          </div>
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-5/6" />
          <Skeleton className="mt-4 h-4 w-2/3" />
        </Card>
      ))}
      <span className="sr-only">Loading restaurants…</span>
    </div>
  )
}
