import { Button } from '../../components/ui/Button'
import { ChoiceChips } from '../../components/ui/ChoiceChips'
import { Chip } from '../../components/ui/Chip'
import { Sheet } from '../../components/ui/Sheet'
import { DIETARY_DISCLAIMER, DIETARY_LABELS, DIETARY_TAGS, type DietaryTag, type PriceLevel } from '../../data'
import {
  DISTANCE_OPTIONS_MILES,
  PRICE_LABELS,
  SORT_LABELS,
  activeFilterCount,
  type Filters,
  type SortMode,
} from '../../lib/discovery/filters'

export interface FiltersSheetProps {
  open: boolean
  onClose: () => void
  filters: Filters
  sort: SortMode
  onSortChange: (sort: SortMode) => void
  cuisines: readonly string[]
  /** How many places the current filters leave, shown on the close button. */
  resultCount: number
  onChange: (patch: Partial<Filters>, meta: { filter: string; value: string | number | boolean }) => void
  onClear: () => void
}

const ANY = 'any'

const priceOptions = [
  { value: ANY, label: 'Any' },
  ...([1, 2, 3, 4] as const).map((level) => ({ value: String(level), label: `${PRICE_LABELS[level]} or less` })),
]

const distanceOptions = [
  { value: ANY, label: 'Any' },
  ...DISTANCE_OPTIONS_MILES.map((miles) => ({ value: String(miles), label: `${miles} mi` })),
]

function toggle<T>(list: readonly T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
}

/** Price, distance, cuisine and dietary filters. Changes apply live. "Open now" lives on the page itself. */
export function FiltersSheet({ open, onClose, filters, sort, onSortChange, cuisines, resultCount, onChange, onClear }: FiltersSheetProps) {
  const count = activeFilterCount(filters)
  return (
    <Sheet open={open} onClose={onClose} title="Filters">
      <div className="flex flex-col gap-6">
        <ChoiceChips
          legend="Sort by"
          options={(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => ({ value: mode, label: SORT_LABELS[mode] }))}
          value={sort}
          onChange={(v) => onSortChange(v === 'distance' ? 'distance' : 'fit')}
        />

        <ChoiceChips
          legend="Price"
          options={priceOptions}
          value={filters.maxPrice === null ? ANY : String(filters.maxPrice)}
          onChange={(v) => {
            const maxPrice = v === ANY ? null : (Number(v) as PriceLevel)
            onChange({ maxPrice }, { filter: 'price', value: maxPrice ?? 'any' })
          }}
        />

        <ChoiceChips
          legend="Distance"
          options={distanceOptions}
          value={filters.maxDistanceMiles === null ? ANY : String(filters.maxDistanceMiles)}
          onChange={(v) => {
            const maxDistanceMiles = v === ANY ? null : Number(v)
            onChange({ maxDistanceMiles }, { filter: 'distance_miles', value: maxDistanceMiles ?? 'any' })
          }}
        />

        <fieldset className="min-w-0">
          <legend className="mb-2 text-small font-semibold">Cuisine</legend>
          <div className="flex flex-wrap gap-2">
            {cuisines.map((cuisine) => (
              <Chip
                key={cuisine}
                selected={filters.cuisines.includes(cuisine)}
                onClick={() => {
                  const next = toggle(filters.cuisines, cuisine)
                  onChange({ cuisines: next }, { filter: 'cuisine', value: cuisine })
                }}
              >
                {cuisine}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset className="min-w-0">
          <legend className="text-small font-semibold">Dietary options</legend>
          <p className="mt-0.5 mb-2 text-small text-text-muted">{DIETARY_DISCLAIMER}</p>
          <div className="flex flex-wrap gap-2">
            {DIETARY_TAGS.map((tag: DietaryTag) => (
              <Chip
                key={tag}
                selected={filters.dietary.includes(tag)}
                onClick={() => onChange({ dietary: toggle(filters.dietary, tag) }, { filter: 'dietary', value: tag })}
              >
                {DIETARY_LABELS[tag]}
              </Chip>
            ))}
          </div>
        </fieldset>

        <div className="sticky bottom-0 z-10 -mx-5 -mb-5 flex flex-col gap-2 border-t border-line bg-surface px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <Button size="lg" fullWidth onClick={onClose}>
            {resultCount === 1 ? 'Show 1 place' : `Show ${resultCount} places`}
          </Button>
          {count > 0 && (
            <Button variant="ghost" onClick={onClear}>
              Clear all filters
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  )
}
