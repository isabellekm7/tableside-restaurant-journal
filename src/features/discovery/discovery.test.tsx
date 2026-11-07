import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../app/routes'
import type { MapViewProps } from '../../components/map/MapView'
import { repository } from '../../data'
import { logger } from '../../lib/analytics/logger'
import { childFromAge } from '../../lib/scoring/ageBands'
import { useDiscoveryStore } from '../../store/discoveryStore'
import { useProfileStore } from '../../store/profileStore'

// The real map needs a browser layout engine. Replace it with a stand-in that exposes
// each pin as a button, which is exactly the contract the page relies on.
vi.mock('../../components/map/MapView', () => ({
  MapView: ({ markers, selectedId, onSelect, label }: MapViewProps) => (
    <div role="region" aria-label={label}>
      {markers.map((m) => (
        <button key={m.id} type="button" aria-label={m.ariaLabel} aria-pressed={m.id === selectedId} onClick={() => onSelect(m.id)}>
          {m.label}
        </button>
      ))}
    </div>
  ),
}))

// Saturday 2026-11-07, 11:00 in Portland (PST), 13:00 in Chicago (CST).
const SATURDAY_MIDDAY = new Date('2026-11-07T19:00:00Z')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(SATURDAY_MIDDAY)
  useProfileStore.getState().setChildren([childFromAge('child-1', 2)])
})

afterEach(() => {
  vi.useRealTimers()
  Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true })
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
})

function renderExplore() {
  const router = createMemoryRouter(routes, { initialEntries: ['/'] })
  render(<RouterProvider router={router} />)
  return { router, user: userEvent.setup() }
}

const restaurantList = () => screen.findByRole('list', { name: 'Restaurants' })
const names = (list: HTMLElement) => within(list).getAllByRole('article').map((a) => within(a).getByRole('heading').textContent)
const filterEvents = () => logger.getEvents().filter((e) => e.type === 'filter_used')

async function openFilters(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^Filters/ }))
  return screen.getByRole('dialog', { name: 'Filters' })
}

describe('Explore: the list', () => {
  it('shows a loading state, then Portland’s restaurants ranked for the family, open ones first', async () => {
    renderExplore()
    expect(screen.getByRole('status', { name: 'Loading restaurants' })).toBeInTheDocument()

    const list = await restaurantList()
    expect(screen.getByText('14 places')).toBeInTheDocument()
    const order = names(list)
    expect(order).toContain('Little Fern Kitchen')
    // Saturday 11 am: Little Fern is open, The Velvet Ladle (evenings only) is not.
    expect(order.indexOf('Little Fern Kitchen')).toBeLessThan(order.indexOf('The Velvet Ladle'))
    expect(within(list).getAllByText('Closed now').length).toBeGreaterThan(0)
  })

  it('puts the age-specific reason on every card', async () => {
    renderExplore()
    const fern = within(await screen.findByRole('article', { name: 'Little Fern Kitchen' }))
    expect(fern.getByText(/^Great for your 2-year-old/)).toBeInTheDocument()
    expect(fern.getByText('Sample data')).toBeInTheDocument()
    expect(fern.getByText(/Open until 3 pm/)).toBeInTheDocument()
  })

  it('shows "not enough info" without a made-up number', async () => {
    renderExplore()
    const harbor = within(await screen.findByRole('article', { name: 'Harbor & Hearth Noodle Bar' }))
    expect(harbor.getByText('Not enough info')).toBeInTheDocument()
    expect(harbor.queryByText(/^· \d+$/)).not.toBeInTheDocument()
  })

  it('links each card to its detail page', async () => {
    renderExplore()
    const link = within(await screen.findByRole('article', { name: 'Little Fern Kitchen' })).getByRole('link', { name: 'Little Fern Kitchen' })
    expect(link).toHaveAttribute('href', '/restaurant/pdx-little-fern-kitchen')
  })

  it('invites kid-less visitors to add ages', async () => {
    useProfileStore.getState().setChildren([])
    const { user } = renderExplore()
    await restaurantList()
    const main = within(screen.getByRole('main'))
    expect(main.getByText(/Showing a general family fit/)).toBeInTheDocument()
    await user.click(main.getByRole('button', { name: 'Add your kids' }))
    expect(screen.getByRole('dialog', { name: 'Who’s eating?' })).toBeInTheDocument()
  })
})

describe('Explore: filters', () => {
  it('"Open now" hides closed places and is recorded', async () => {
    const { user } = renderExplore()
    await restaurantList()
    await user.click(screen.getByRole('button', { name: 'Open now' }))

    await waitFor(() => expect(screen.getByText('7 places')).toBeInTheDocument()) // hand-checked for Sat 11:00 PT
    expect(screen.queryByText('Closed now')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open now' })).toHaveAttribute('aria-pressed', 'true')
    expect(filterEvents()).toMatchObject([{ filter: 'open_now', value: true }])
  })

  it('filters by price and shows how many filters are active', async () => {
    const { user } = renderExplore()
    await restaurantList()
    const dialog = await openFilters(user)
    await user.click(within(dialog).getByRole('radio', { name: '$ or less' }))
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Show 4 places' })).toBeInTheDocument())
    await user.click(within(dialog).getByRole('button', { name: 'Show 4 places' }))

    expect(screen.getByText('4 places')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Filters\s*1\s*active/ })).toBeInTheDocument()
    expect(filterEvents()).toMatchObject([{ filter: 'price', value: 1 }])
  })

  it('filters by cuisine', async () => {
    const { user } = renderExplore()
    await restaurantList()
    const dialog = await openFilters(user)
    await user.click(within(dialog).getByRole('button', { name: 'Mexican' }))
    await user.click(within(dialog).getByRole('button', { name: /^Show 1 place$/ }))
    expect(names(await restaurantList())).toEqual(['Rosewater Taqueria'])
  })

  it('dietary filter says "reported by parents" and tells you to verify', async () => {
    const { user } = renderExplore()
    await restaurantList()
    const dialog = await openFilters(user)
    expect(within(dialog).getByText(/Reported by parents\. Always verify with the restaurant/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Nut-allergy aware' }))
    await user.click(within(dialog).getByRole('button', { name: /^Show 1 place$/ }))

    const list = await restaurantList()
    expect(names(list)).toEqual(['Marlow & Finch Bistro']) // the one place that reports it; Saltbox reports "no"
    expect(within(list).getByText(/Parents report:/).parentElement).toHaveTextContent(/nut-allergy aware/i)
    expect(within(list).getByText(/Always verify with the restaurant/)).toBeInTheDocument()
  })

  it('sorts nearest first', async () => {
    const { user } = renderExplore()
    await restaurantList()
    const dialog = await openFilters(user)
    await user.click(within(dialog).getByRole('radio', { name: 'Nearest first' }))
    await user.click(within(dialog).getByRole('button', { name: /^Show \d+ places/ }))
    expect(names(await restaurantList())[0]).toBe('Marlow & Finch Bistro')
  })

  it('searches by name or cuisine without logging what was typed', async () => {
    const { user } = renderExplore()
    await restaurantList()
    await user.type(screen.getByLabelText('Search restaurants'), 'pizza')

    await waitFor(() => expect(names(screen.getByRole('list', { name: 'Restaurants' }))).toEqual(['Tinderbox Pizza Yard']))
    expect(filterEvents()).toMatchObject([{ filter: 'search', value: true }])
    expect(JSON.stringify(logger.getEvents())).not.toMatch(/pizza/i)
  })

  it('offers the closest compromise when filters leave nothing, and can clear them', async () => {
    const { user } = renderExplore()
    await restaurantList()
    const dialog = await openFilters(user)
    await user.click(within(dialog).getByRole('radio', { name: '0.5 mi' })) // nothing is that close to the centre
    await user.click(within(dialog).getByRole('button', { name: /^Show 0 places$/ }))

    expect(await screen.findByText('Nothing matches those filters')).toBeInTheDocument()
    expect(screen.getByText(/No great fit nearby\. Here’s the closest compromise/)).toBeInTheDocument()
    const compromises = screen.getByRole('list', { name: 'Closest compromises' })
    expect(within(compromises).getAllByRole('article')).toHaveLength(3)

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(await screen.findByText('14 places')).toBeInTheDocument()
  })

  it('warns when the best available is still not a good fit', async () => {
    const { user } = renderExplore()
    await restaurantList()
    const dialog = await openFilters(user)
    await user.click(within(dialog).getByRole('button', { name: 'Tasting-menu French' }))
    await user.click(within(dialog).getByRole('button', { name: /^Show 1 place$/ }))

    expect(await screen.findByText(/No great fit nearby\. The closest compromises are listed first/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(await screen.findByText('14 places')).toBeInTheDocument()
  })
})

describe('Explore: city and location', () => {
  it('switches city by typing, and remembers it', async () => {
    const { user } = renderExplore()
    await restaurantList()
    const input = screen.getByLabelText('City')
    expect(input).toHaveValue('Portland, OR')

    await user.clear(input)
    await user.type(input, 'chi{Enter}')

    expect(await screen.findByText('14 places')).toBeInTheDocument()
    expect(screen.getByText(/in Chicago/)).toBeInTheDocument()
    expect(input).toHaveValue('Chicago, IL')
    expect(input).toHaveFocus() // switching city must not drop keyboard focus
    expect(useDiscoveryStore.getState().cityId).toBe('chicago')
    expect(filterEvents()).toMatchObject([{ filter: 'city', value: 'chicago' }])
    expect(await screen.findByRole('article', { name: 'Fiddlehead Family Table' })).toBeInTheDocument()
  })

  it('is honest about the cities it has', async () => {
    const { user } = renderExplore()
    await restaurantList()
    const input = screen.getByLabelText('City')
    await user.clear(input)
    await user.type(input, 'Austin{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('We only have sample restaurants in Portland and Chicago.')
    expect(useDiscoveryStore.getState().cityId).toBe('portland')
  })

  function mockGeolocation(result: { lat: number; lng: number } | { denied: true }) {
    const getCurrentPosition = vi.fn((success: PositionCallback, error?: PositionErrorCallback | null) => {
      if ('denied' in result) {
        error?.({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: 'denied' })
      } else {
        success({ coords: { latitude: result.lat, longitude: result.lng } } as GeolocationPosition)
      }
    })
    Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true })
  }

  it('"Near me" picks the nearest sample city and measures from the user', async () => {
    mockGeolocation({ lat: 41.9, lng: -87.7 })
    const { user } = renderExplore()
    await restaurantList()
    await user.click(screen.getByRole('button', { name: 'Use my location' }))

    expect(await screen.findByText('Showing places near you in Chicago.')).toBeInTheDocument()
    expect(screen.getByLabelText('City')).toHaveValue('Chicago, IL')
    expect(screen.getByText(/distances from your location/)).toBeInTheDocument()
    expect(logger.getEvents().at(-1)).toMatchObject({ type: 'location_requested', outcome: 'ok' })
    // Privacy: coordinates are never logged or stored.
    expect(JSON.stringify(logger.getEvents())).not.toContain('41.9')
    expect(localStorage.getItem('tableside.v1.discovery') ?? '').not.toContain('41.9')

    await user.click(screen.getByRole('button', { name: 'Use city centre' }))
    expect(screen.getByText(/distances from the centre of Chicago/)).toBeInTheDocument()
  })

  it('falls back to the city centre when the user is outside the sample cities', async () => {
    mockGeolocation({ lat: 30.27, lng: -97.74 }) // Austin
    const { user } = renderExplore()
    await restaurantList()
    await user.click(screen.getByRole('button', { name: 'Use my location' }))
    expect(await screen.findByText(/outside our sample cities/)).toBeInTheDocument()
    expect(screen.getByLabelText('City')).toHaveValue('Portland, OR')
    expect(screen.getByText('14 places')).toBeInTheDocument()
  })

  it('falls back gracefully when location is denied or unsupported', async () => {
    mockGeolocation({ denied: true })
    const { user } = renderExplore()
    await restaurantList()
    await user.click(screen.getByRole('button', { name: 'Use my location' }))
    expect(await screen.findByText(/Location is off for this site/)).toBeInTheDocument()
    expect(logger.getEvents().at(-1)).toMatchObject({ outcome: 'denied' })
    expect(screen.getByText('14 places')).toBeInTheDocument()
  })

  it('says so when the browser has no location support', async () => {
    const { user } = renderExplore()
    await restaurantList()
    await user.click(screen.getByRole('button', { name: 'Use my location' }))
    expect(await screen.findByText(/couldn’t find your location/)).toBeInTheDocument()
  })
})

describe('Explore: list and map stay in sync', () => {
  it('shows one at a time on phones, with the same results and scores on both', async () => {
    const { user } = renderExplore()
    await restaurantList()
    expect(screen.queryByRole('region', { name: 'Map of restaurants in Portland' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Map' }))
    expect(screen.getByRole('region', { name: 'Map of restaurants in Portland' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Restaurants' })).not.toBeInTheDocument()

    // Every pin carries the same score words as its card; unknown shows "?".
    expect(screen.getByRole('button', { name: /^Little Fern Kitchen, Great fit \d+$/ })).toBeInTheDocument()
    const unknown = screen.getByRole('button', { name: 'Harbor & Hearth Noodle Bar, Not enough info' })
    expect(unknown).toHaveTextContent('?')
    expect(screen.getAllByRole('button', { name: /, (Great|Good|Mixed|Not a|Not enough)/ })).toHaveLength(14)
  })

  it('selecting a pin previews it, and the list highlights it when you switch back', async () => {
    const { user } = renderExplore()
    await restaurantList()
    await user.click(screen.getByRole('button', { name: 'Map' }))
    await user.click(screen.getByRole('button', { name: /^Little Fern Kitchen, Great fit/ }))

    expect(useDiscoveryStore.getState().selectedId).toBe('pdx-little-fern-kitchen')
    expect(screen.getByRole('article', { name: 'Little Fern Kitchen' })).toHaveAttribute('aria-current', 'true')

    await user.click(screen.getByRole('button', { name: 'Dismiss preview' }))
    expect(useDiscoveryStore.getState().selectedId).toBeNull()

    await user.click(screen.getByRole('button', { name: /^Little Fern Kitchen, Great fit/ }))
    await user.click(screen.getByRole('button', { name: 'List' }))
    const card = await screen.findByRole('article', { name: 'Little Fern Kitchen' })
    expect(card).toHaveAttribute('aria-current', 'true')
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })

  it('"Show on map" on a card jumps to the map with that pin selected', async () => {
    const { user } = renderExplore()
    await restaurantList()
    await user.click(screen.getByRole('button', { name: 'Show Little Fern Kitchen on the map' }))

    expect(screen.getByRole('region', { name: 'Map of restaurants in Portland' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Little Fern Kitchen, Great fit/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('drops the selection when filters remove the selected place', async () => {
    const { user } = renderExplore()
    await restaurantList()
    await user.click(screen.getByRole('button', { name: 'Show Velvet Ladle on the map'.replace('Velvet', 'The Velvet') }))
    await user.click(screen.getByRole('button', { name: 'List' }))
    await user.click(screen.getByRole('button', { name: 'Open now' })) // Velvet Ladle is closed
    await waitFor(() => expect(useDiscoveryStore.getState().selectedId).toBeNull())
  })
})

describe('Explore: error and offline states', () => {
  it('shows an error with a retry, then recovers', async () => {
    vi.spyOn(repository, 'listRestaurants').mockRejectedValueOnce(new Error('boom'))
    const { user } = renderExplore()
    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t load restaurants')

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await restaurantList()).toBeInTheDocument()
  })

  it('tells the user when they are offline, while the sample data keeps working', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    renderExplore()
    expect(await screen.findByText(/You’re offline\. Sample restaurants still work/)).toBeInTheDocument()
    expect(await restaurantList()).toBeInTheDocument()
  })
})
