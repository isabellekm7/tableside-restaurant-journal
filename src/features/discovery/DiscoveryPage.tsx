import { List, Map as MapIcon, Users, Zap } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Chip } from '../../components/ui/Chip'
import { Notice } from '../../components/ui/Notice'
import { StateMessage } from '../../components/ui/StateMessage'
import type { CityId } from '../../data'
import { track } from '../../lib/analytics/logger'
import { SORT_LABELS, activeFilterCount, maxDistanceKm, type Filters, type SortMode } from '../../lib/discovery/filters'
import { closestCompromises, hasGoodFit, rankRestaurants } from '../../lib/discovery/rank'
import { useMediaQuery, useNow, useReducedMotion } from '../../lib/hooks'
import { usePageTitle } from '../../lib/usePageTitle'
import { useDiscoveryStore } from '../../store/discoveryStore'
import { useProfileStore } from '../../store/profileStore'
import { useUiStore } from '../../store/uiStore'
import { FiltersSheet } from './FiltersSheet'
import { MapPane } from './MapPane'
import { RestaurantCard } from './RestaurantCard'
import { RestaurantCardSkeletons } from './RestaurantCardSkeleton'
import { SearchBar } from './SearchBar'
import { useDiscoveryData } from './useDiscoveryData'
import { useUserLocation } from './useUserLocation'

/** The Explore screen: ranked list + synced map, filters, city search and "near me". */
export function DiscoveryPage() {
  usePageTitle('Explore')

  const children = useProfileStore((s) => s.children)
  const onboarding = useProfileStore((s) => s.onboarding)
  const openProfile = useUiStore((s) => s.openProfileSheet)

  const store = useDiscoveryStore()
  const { cityId, origin, filters, sort, search, selectedId, view } = store

  const now = useNow()
  const isWide = useMediaQuery('(min-width: 1024px)')
  const reducedMotion = useReducedMotion()
  const [filtersOpen, setFiltersOpen] = useState(false)

  const { data, retry } = useDiscoveryData({ cityId, search, filters, now })
  const cities = useMemo(() => (data.status === 'ready' ? data.cities : []), [data])
  const city = cities.find((c) => c.id === cityId)
  const location = useUserLocation(cities)

  const originPoint = origin.kind === 'geo' ? origin.point : city?.center
  const rankBase = useMemo(
    () => ({ children, cities, now, origin: originPoint, sort }),
    [children, cities, now, originPoint, sort],
  )

  const ranked = useMemo(() => {
    if (data.status !== 'ready' || !rankBase.origin) return []
    return rankRestaurants({ ...rankBase, origin: rankBase.origin, restaurants: data.filtered, maxDistanceKm: maxDistanceKm(filters) })
  }, [data, rankBase, filters])

  // When nothing matches, still help: the best options in the city, ignoring filters.
  const compromises = useMemo(() => {
    if (data.status !== 'ready' || !rankBase.origin || ranked.length > 0) return []
    return closestCompromises(rankRestaurants({ ...rankBase, origin: rankBase.origin, restaurants: data.all, maxDistanceKm: null }))
  }, [data, rankBase, ranked.length])

  // ── Tracking ──
  const trackFilter = (filter: string, value: string | number | boolean) => track({ type: 'filter_used', filter, value })

  const patchFilters = (patch: Partial<Filters>, meta: { filter: string; value: string | number | boolean }) => {
    store.patchFilters(patch)
    trackFilter(meta.filter, meta.value)
  }
  const changeSort = (next: SortMode) => {
    store.setSort(next)
    trackFilter('sort', next)
  }
  const changeSearch = (value: string) => {
    if (search === '' && value !== '') trackFilter('search', true) // never log what was typed
    store.setSearch(value)
  }
  const changeCity = (id: CityId) => {
    store.setCity(id)
    location.reset()
    trackFilter('city', id)
  }
  const clearFilters = () => {
    store.clearFilters()
    trackFilter('clear_filters', true)
  }

  // ── List ↔ map sync ──
  const listVisible = isWide || view === 'list'
  const mapVisible = isWide || view === 'map'
  const selectionFromMap = useRef(false)

  const selectOnMap = (id: string | null) => {
    selectionFromMap.current = true
    store.select(id)
  }
  const showOnMap = (id: string) => {
    selectionFromMap.current = false
    store.select(id)
    if (!isWide) store.setView('map')
  }

  // A pin tap should reveal its card in the list (when the list is on screen).
  useEffect(() => {
    if (!selectedId || !listVisible || !selectionFromMap.current) return
    selectionFromMap.current = false
    const card = Array.from(document.querySelectorAll('[data-restaurant-id]')).find(
      (el) => el.getAttribute('data-restaurant-id') === selectedId,
    )
    card?.scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' })
  }, [selectedId, listVisible, reducedMotion])

  // Nothing selected that isn't in the results (e.g. after filtering).
  useEffect(() => {
    if (selectedId && data.status === 'ready' && !ranked.some((r) => r.restaurant.id === selectedId)) store.select(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ranked, selectedId, data.status])

  // ── States ──
  if (data.status === 'error') {
    return (
      <div className="mx-auto w-full max-w-wide px-4 py-8">
        <StateMessage kind="error" level={1} title="We couldn’t load restaurants" action={<Button onClick={retry}>Try again</Button>}>
          Something went wrong on our side. Your saved lists are still on this device.
        </StateMessage>
      </div>
    )
  }

  if (data.status === 'loading' || !city) {
    return (
      <div className="mx-auto w-full max-w-wide px-4 py-4">
        <h1 className="sr-only">Find a restaurant that works for your kids</h1>
        <RestaurantCardSkeletons />
      </div>
    )
  }

  const filterCount = activeFilterCount(filters)
  const usingLocation = origin.kind === 'geo'
  const noKids = children.length === 0 && onboarding !== 'pending'
  const originLabel = usingLocation ? 'your location' : `the centre of ${city.name}`
  const userLocation = origin.kind === 'geo' ? origin.point : null
  const dietaryTags = filters.dietary

  const list = (
    <section aria-labelledby="results-heading" className="flex min-w-0 flex-col gap-4">
      <h2 id="results-heading" className="sr-only">
        Restaurants
      </h2>
      <p role="status" aria-live="polite" className="text-small text-text-muted">
        <span className="font-semibold text-text">
          {ranked.length} {ranked.length === 1 ? 'place' : 'places'}
        </span>{' '}
        in {city.name} · {SORT_LABELS[sort].toLowerCase()} · distances from {originLabel}
      </p>

      {noKids && (
        <Notice
          action={
            <Button variant="secondary" leadingIcon={<Users size={16} aria-hidden="true" />} onClick={openProfile}>
              Add your kids
            </Button>
          }
        >
          Showing a general family fit. Add your kids’ ages for a score that’s specific to them.
        </Notice>
      )}

      {ranked.length > 0 && !hasGoodFit(ranked) && (
        <Notice
          tone="warning"
          action={
            filterCount > 0 ? (
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        >
          No great fit nearby. The closest compromises are listed first.
        </Notice>
      )}

      {ranked.length === 0 ? (
        <div className="flex flex-col gap-4">
          <StateMessage
            kind="empty"
            title="Nothing matches those filters"
            action={
              filterCount > 0 || search ? (
                <Button
                  onClick={() => {
                    clearFilters()
                    changeSearch('')
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          >
            No great fit nearby. Here’s the closest compromise instead, ignoring your filters.
          </StateMessage>
          <ul className="flex flex-col gap-4" aria-label="Closest compromises">
            {compromises.map((item) => (
              <li key={item.restaurant.id}>
                <RestaurantCard item={item} selected={item.restaurant.id === selectedId} onShowOnMap={() => showOnMap(item.restaurant.id)} />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className="flex flex-col gap-4" aria-label="Restaurants">
          {ranked.map((item) => (
            <li key={item.restaurant.id}>
              <RestaurantCard
                item={item}
                selected={item.restaurant.id === selectedId}
                dietaryTags={dietaryTags}
                onShowOnMap={() => showOnMap(item.restaurant.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )

  return (
    <div className="mx-auto w-full max-w-wide px-4 py-4">
      <h1 className="sr-only">Find a restaurant that works for your kids</h1>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-6">
        <div className="flex min-w-0 flex-col gap-4">
          {/* The fastest path to an answer: one prominent button, above everything else. */}
          <ButtonLink to="/right-now" variant="accent" size="lg" fullWidth leadingIcon={<Zap size={22} aria-hidden="true" />} className="h-auto flex-col gap-0 py-3 md:max-w-md">
            <span>We need to eat soon</span>
            <span className="text-small font-medium opacity-95">Open now · close by · short wait</span>
          </ButtonLink>
        <div className="flex flex-col gap-3">
          <SearchBar
            cities={cities}
            city={city}
            onCityChange={(c) => changeCity(c.id)}
            search={search}
            onSearchChange={changeSearch}
            locationStatus={location.status}
            usingLocation={usingLocation}
            onUseLocation={location.request}
            onUseCityCentre={() => {
              store.setOrigin({ kind: 'city' })
              location.reset()
            }}
            filterCount={filterCount}
            onOpenFilters={() => setFiltersOpen(true)}
          />

          <div className="flex items-center justify-between gap-3">
            <Chip selected={filters.openNow} onClick={() => patchFilters({ openNow: !filters.openNow }, { filter: 'open_now', value: !filters.openNow })}>
              Open now
            </Chip>

            {/* Phones show one at a time; wide screens show both. */}
            <div role="group" aria-label="Results view" className="flex rounded-pill border-2 border-line-strong p-0.5 lg:hidden">
              {(
                [
                  ['list', 'List', List],
                  ['map', 'Map', MapIcon],
                ] as const
              ).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={view === value}
                  onClick={() => store.setView(value)}
                  className={
                    'inline-flex min-h-(--size-touch) items-center gap-1.5 rounded-pill px-4 text-small font-semibold transition-colors duration-(--duration-fast) ' +
                    (view === value ? 'bg-primary text-on-primary' : 'text-text-muted hover:text-text')
                  }
                >
                  <Icon size={16} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
          {listVisible && list}
        </div>
        {mapVisible && (
          <div className="h-[calc(100dvh-22rem)] min-h-80 lg:sticky lg:top-24 lg:h-[calc(100dvh-7.5rem)]">
            <MapPane items={ranked} city={city} selectedId={selectedId} onSelect={selectOnMap} userLocation={userLocation} />
          </div>
        )}
      </div>

      <FiltersSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        sort={sort}
        onSortChange={changeSort}
        cuisines={data.cuisines}
        resultCount={ranked.length}
        onChange={patchFilters}
        onClear={clearFilters}
      />
    </div>
  )
}
