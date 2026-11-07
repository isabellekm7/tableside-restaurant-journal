import { LocateFixed, MapPin, Search, SlidersHorizontal } from 'lucide-react'
import { useId, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react'
import { Button } from '../../components/ui/Button'
import type { City } from '../../data'
import { cityLabel, resolveCity } from '../../lib/discovery/cities'
import type { LocationStatus } from './useUserLocation'

function IconInput({ label, icon, ...rest }: { label: string; icon: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <div className="relative min-w-0 flex-1">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-text-muted">{icon}</span>
      <input
        id={id}
        className="min-h-(--size-touch) w-full rounded-pill border border-line-strong bg-surface pr-4 pl-10 text-body placeholder:text-text-subtle"
        {...rest}
      />
    </div>
  )
}

export interface SearchBarProps {
  cities: readonly City[]
  city: City
  onCityChange: (city: City) => void
  search: string
  onSearchChange: (value: string) => void
  locationStatus: LocationStatus
  usingLocation: boolean
  onUseLocation: () => void
  onUseCityCentre: () => void
  filterCount: number
  onOpenFilters: () => void
}

function locationMessage(status: LocationStatus, city: City): string | null {
  switch (status.kind) {
    case 'locating':
      return 'Finding you…'
    case 'ok':
      return `Showing places near you in ${status.city.name}.`
    case 'outside':
      return `You’re outside our sample cities, so we’re showing ${city.name} from its centre.`
    case 'denied':
      return `Location is off for this site, so distances are from the centre of ${city.name}. You can pick a city above.`
    case 'unavailable':
      return `We couldn’t find your location, so distances are from the centre of ${city.name}.`
    default:
      return null
  }
}

interface CityFormProps {
  cities: readonly City[]
  city: City
  onCityChange: (city: City) => void
  locating: boolean
  onUseLocation: () => void
}

/**
 * City box with suggestions plus "Near me". What the user is typing lives in `draft`,
 * tagged with the city it was typed for: when the city changes from elsewhere (e.g.
 * "Near me") the stale draft is simply ignored, so the box shows the new city with no
 * effect and no remount (which would drop keyboard focus).
 */
function CityForm({ cities, city, onCityChange, locating, onUseLocation }: CityFormProps) {
  const listId = useId()
  const [draft, setDraft] = useState<{ forCity: string; text: string; error: boolean } | null>(null)
  const current = draft && draft.forCity === city.id ? draft : null
  const cityText = current?.text ?? cityLabel(city)
  const cityError = current?.error ?? false
  const setText = (text: string, error = false) => setDraft({ forCity: city.id, text, error })

  const commit = (text: string): boolean => {
    const match = resolveCity(text, cities)
    if (!match) return false
    if (match.id !== city.id) onCityChange(match)
    else setText(cityLabel(match))
    return true
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!commit(cityText)) setText(cityText, true)
  }

  return (
    <>
      <form onSubmit={submit} className="flex gap-2" role="search" aria-label="City search">
        <IconInput
          label="City"
          icon={<MapPin size={18} aria-hidden="true" />}
          value={cityText}
          list={listId}
          autoComplete="off"
          enterKeyHint="go"
          aria-invalid={cityError || undefined}
          aria-describedby={cityError ? `${listId}-error` : undefined}
          onChange={(e) => {
            setText(e.target.value)
            // Picking a suggestion (or typing a full name) switches immediately.
            const exact = cities.find((c) => cityLabel(c).toLowerCase() === e.target.value.trim().toLowerCase())
            if (exact) commit(cityLabel(exact))
          }}
          onBlur={() => {
            if (!commit(cityText)) setText(cityLabel(city))
          }}
        />
        <datalist id={listId}>
          {cities.map((c) => (
            <option key={c.id} value={cityLabel(c)} />
          ))}
        </datalist>
        <Button
          type="button"
          variant="secondary"
          disabled={locating}
          leadingIcon={<LocateFixed size={18} aria-hidden="true" />}
          onClick={onUseLocation}
          aria-label={locating ? 'Finding your location' : 'Use my location'}
          className="shrink-0 px-4"
        >
          <span className="max-[380px]:sr-only">{locating ? 'Locating…' : 'Near me'}</span>
        </Button>
      </form>
      {cityError && (
        <p id={`${listId}-error`} role="alert" className="px-2 text-small font-medium text-danger">
          We only have sample restaurants in {cities.map((c) => c.name).join(' and ')}.
        </p>
      )}
    </>
  )
}

/** City search, "near me", restaurant search and the filters button. */
export function SearchBar({
  cities,
  city,
  onCityChange,
  search,
  onSearchChange,
  locationStatus,
  usingLocation,
  onUseLocation,
  onUseCityCentre,
  filterCount,
  onOpenFilters,
}: SearchBarProps) {
  const message = locationMessage(locationStatus, city)

  return (
    <div className="flex flex-col gap-2">
      <CityForm
        cities={cities}
        city={city}
        onCityChange={onCityChange}
        locating={locationStatus.kind === 'locating'}
        onUseLocation={onUseLocation}
      />
      {message && (
        <p role="status" className="px-2 text-small text-text-muted">
          {message}{' '}
          {usingLocation && (
            <button type="button" onClick={onUseCityCentre} className="font-semibold text-primary underline underline-offset-2">
              Use city centre
            </button>
          )}
        </p>
      )}

      <div className="flex gap-2">
        <IconInput
          label="Search restaurants"
          icon={<Search size={18} aria-hidden="true" />}
          type="search"
          placeholder="Name or cuisine"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          enterKeyHint="search"
        />
        <Button
          variant="secondary"
          onClick={onOpenFilters}
          leadingIcon={<SlidersHorizontal size={18} aria-hidden="true" />}
          aria-haspopup="dialog"
          className="shrink-0 px-4"
        >
          Filters
          {filterCount > 0 && (
            <span className="ml-0.5 inline-flex size-6 items-center justify-center rounded-pill bg-primary text-caption font-bold text-on-primary">
              {filterCount}
              <span className="sr-only"> active</span>
            </span>
          )}
        </Button>
      </div>
    </div>
  )
}
