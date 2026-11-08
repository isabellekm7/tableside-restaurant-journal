import { X } from 'lucide-react'
import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { IconButton } from '../../components/ui/Button'
import type { MapMarker } from '../../components/map/MapView'
import { Skeleton } from '../../components/ui/Skeleton'
import type { City, LatLng } from '../../data'
import type { RankedRestaurant } from '../../lib/discovery/rank'
import { FIT_LEVEL_LABEL } from '../../lib/fit'
import { RestaurantCard } from './RestaurantCard'

// Leaflet is the heaviest dependency and only the map view needs it: load it on demand.
const MapView = lazy(() => import('../../components/map/MapView').then((m) => ({ default: m.MapView })))

export interface MapPaneProps {
  items: readonly RankedRestaurant[]
  city: City
  selectedId: string | null
  onSelect: (id: string | null) => void
  userLocation: LatLng | null
}

function toMarker({ restaurant, fit }: RankedRestaurant): MapMarker {
  const known = fit.level !== 'unknown'
  return {
    id: restaurant.id,
    position: restaurant.location,
    level: fit.level,
    label: known ? String(fit.score) : '?',
    ariaLabel: `${restaurant.name}, ${FIT_LEVEL_LABEL[fit.level]}${known ? ` ${fit.score}` : ''}`,
    priority: known ? fit.score : -1,
  }
}

/** The map plus, on screens where the list is hidden, a card for the selected pin. */
export function MapPane({ items, city, selectedId, onSelect, userLocation }: MapPaneProps) {
  const selected = items.find((i) => i.restaurant.id === selectedId) ?? null
  const previewRef = useRef<HTMLDivElement>(null)
  const [inset, setInset] = useState(0)

  // Reserve the preview card's height so the selected pin never hides behind it.
  useEffect(() => {
    const el = previewRef.current
    if (!selected || !el) {
      setInset(0)
      return
    }
    const measure = () => setInset(el.offsetHeight + 24)
    measure()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
    observer?.observe(el)
    return () => observer?.disconnect()
  }, [selected])

  return (
    <div className="relative h-full overflow-hidden rounded-lg border border-line">
      <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
      <MapView
        center={city.center}
        zoom={city.zoom}
        markers={items.map(toMarker)}
        selectedId={selectedId}
        onSelect={onSelect}
        userLocation={userLocation}
        label={`Map of restaurants in ${city.name}`}
        bottomInset={inset}
      />
      </Suspense>
      {selected && (
        <div ref={previewRef} className="absolute inset-x-3 bottom-3 z-[1100] lg:hidden">
          <RestaurantCard item={selected} selected compact />
          <IconButton
            label="Dismiss preview"
            icon={<X size={20} aria-hidden="true" />}
            onClick={() => onSelect(null)}
            className="absolute -top-3 -right-2 bg-surface shadow-raised hover:bg-surface-sunken"
          />
        </div>
      )}
    </div>
  )
}
