import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../app/routes'
import { ATTR_KEYS } from '../../data'
import { logger } from '../../lib/analytics/logger'
import { childFromAge } from '../../lib/scoring/ageBands'
import { useProfileStore } from '../../store/profileStore'
import { ATTRIBUTE_GROUPS } from './attributeGroups'
import { directionsUrl } from './directions'

// Saturday 2026-11-07, 11:00 in Portland.
const SATURDAY_MIDDAY = new Date('2026-11-07T19:00:00Z')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(SATURDAY_MIDDAY)
  useProfileStore.getState().setChildren([childFromAge('child-1', 2)])
})
afterEach(() => vi.useRealTimers())

function renderDetail(id = 'pdx-little-fern-kitchen') {
  const router = createMemoryRouter(routes, { initialEntries: [`/restaurant/${id}`] })
  render(<RouterProvider router={router} />)
  return { router, user: userEvent.setup() }
}

const events = (type: string) => logger.getEvents().filter((e) => e.type === type)

describe('restaurant detail', () => {
  it('shows the restaurant, an age-specific verdict in a sentence, and the sample-data label', async () => {
    renderDetail()
    expect(await screen.findByRole('heading', { level: 1, name: 'Little Fern Kitchen' })).toBeInTheDocument()
    // The verdict appears in the header and again at the top of the breakdown.
    expect(screen.getAllByText(/^Great for your 2-year-old/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sample data').length).toBeGreaterThan(0)
    expect(screen.getByText(/This restaurant is fictional/)).toBeInTheDocument()
  })

  it('has every section the brief asks for', async () => {
    renderDetail()
    await screen.findByRole('heading', { level: 1, name: 'Little Fern Kitchen' })
    for (const name of ['Will it work for your kids?', 'Watch out for', 'Quiet times and hours', 'What parents have confirmed', 'Menu highlights for kids', 'What parents say', 'Photos', 'Where']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
    }
  })

  it('shows honest downsides, from parents and from the scoring', async () => {
    renderDetail()
    await screen.findByRole('heading', { level: 1, name: 'Little Fern Kitchen' })
    const watch = within(screen.getByRole('heading', { name: 'Watch out for' }).closest('section') as HTMLElement)
    expect(watch.getByText('No changing table; parents use the restroom bench')).toBeInTheDocument()
    expect(watch.getByText('For your family')).toBeInTheDocument() // e.g. "no changing table" from the toddler score
  })

  it('breaks the fit down per child, with the child who sets the score open', async () => {
    useProfileStore.getState().setChildren([childFromAge('child-1', 0), childFromAge('child-2', 8)])
    renderDetail()
    await screen.findByRole('heading', { level: 1, name: 'Little Fern Kitchen' })
    const section = within(screen.getByRole('heading', { name: 'Will it work for your kids?' }).closest('section') as HTMLElement)
    const details = section.getAllByText(/^Your /, { selector: 'summary span' }).map((el) => el.closest('details'))
    expect(details).toHaveLength(2)
    expect(details[0]).toHaveAttribute('open') // the baby sets the score
    expect(details[1]).not.toHaveAttribute('open')
    expect(section.getByText('(sets the score)')).toBeInTheDocument()
    expect(section.getByText('Changing table')).toBeInTheDocument()
  })

  it('falls back to a general breakdown without a profile', async () => {
    useProfileStore.getState().setChildren([])
    renderDetail()
    await screen.findByRole('heading', { level: 1, name: 'Little Fern Kitchen' })
    expect(screen.getByText(/Showing a general family fit/)).toBeInTheDocument()
  })

  it('shows each parent-confirmed fact with how many parents and when, and says so when nobody has reported', async () => {
    renderDetail()
    await screen.findByRole('heading', { level: 1, name: 'Little Fern Kitchen' })
    expect(screen.getAllByText(/31 parents · last confirmed Oct 11, 2026 \(27 days ago\)/).length).toBeGreaterThan(0)
    expect(screen.getByText(/9 parents · last confirmed Aug 2, 2026/)).toBeInTheDocument() // changing table, confirmed less recently
    expect(screen.getAllByText('Not reported yet').length).toBeGreaterThan(0)
  })

  it('warns when a report is old', async () => {
    renderDetail('pdx-velvet-ladle') // confirmed July 30: over three months ago
    await screen.findByRole('heading', { level: 1, name: 'The Velvet Ladle' })
    expect(screen.getAllByText('Older report: worth double-checking').length).toBeGreaterThan(0)
  })

  it('shows quiet times, busy times and opening hours in plain words', async () => {
    renderDetail()
    await screen.findByRole('heading', { level: 1, name: 'Little Fern Kitchen' })
    expect(screen.getByText('8–9:30 am')).toBeInTheDocument()
    expect(screen.getByText(/Quietest: before the brunch rush/)).toBeInTheDocument()
    expect(screen.getByText('Every day')).toBeInTheDocument() // opening hours
    expect(screen.getByText('8 am – 3 pm', { exact: false })).toBeInTheDocument()
  })

  it('labels the wait as simulated', async () => {
    renderDetail()
    await screen.findByRole('heading', { level: 1, name: 'Little Fern Kitchen' })
    expect(screen.getAllByText('(simulated)').length).toBeGreaterThan(0)
  })

  it('lists kid menu highlights, and dietary options with the verify warning', async () => {
    renderDetail()
    await screen.findByRole('heading', { level: 1, name: 'Little Fern Kitchen' })
    expect(screen.getByText('Mini pancake stacks')).toBeInTheDocument()
    expect(screen.getByText(/Parents report:/).parentElement).toHaveTextContent(/vegetarian options, gluten-free options/i)
    expect(screen.getByText(/Always verify with the restaurant/)).toBeInTheDocument()
  })

  it('gives a directions link that opens safely in a new tab', async () => {
    renderDetail()
    await screen.findByRole('heading', { level: 1, name: 'Little Fern Kitchen' })
    const link = screen.getByRole('link', { name: 'Directions' })
    expect(link).toHaveAttribute('href', 'https://www.google.com/maps/dir/?api=1&destination=45.5593,-122.6471')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('records that the restaurant was viewed', async () => {
    renderDetail()
    await screen.findByRole('heading', { level: 1, name: 'Little Fern Kitchen' })
    expect(events('restaurant_viewed')).toMatchObject([{ restaurantId: 'pdx-little-fern-kitchen' }])
  })

  it('"We’re going here" ends the 60-second clock and switches to directions', async () => {
    const { user } = renderDetail()
    await screen.findByRole('heading', { level: 1, name: 'Little Fern Kitchen' })
    await user.click(screen.getByRole('button', { name: 'We’re going here' }))

    expect(events('restaurant_selected')).toMatchObject([{ restaurantId: 'pdx-little-fern-kitchen', via: 'going_here' }])
    expect(screen.getByText(/You’re heading to Little Fern Kitchen/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'We’re going here' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Directions' })).toBeInTheDocument()
  })

  it('tapping Directions also counts as choosing the place', async () => {
    const { user } = renderDetail()
    await screen.findByRole('heading', { level: 1, name: 'Little Fern Kitchen' })
    await user.click(screen.getByRole('link', { name: 'Directions' }))
    expect(events('restaurant_selected')).toMatchObject([{ via: 'directions' }])
  })

  it('has a friendly not-found state', async () => {
    renderDetail('nope')
    expect(await screen.findByText('We can’t find that restaurant')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Explore' })).toHaveAttribute('href', '/')
  })

  it('links back to Explore', async () => {
    renderDetail()
    await screen.findByRole('heading', { level: 1, name: 'Little Fern Kitchen' })
    // (The navigation bars have "Explore" links too; this is the page's own back link.)
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Explore' })).toHaveAttribute('href', '/')
  })
})

describe('bail-out', () => {
  it('is a clear button with the full wording, near the top of the page', async () => {
    renderDetail()
    await screen.findByRole('heading', { level: 1, name: 'Little Fern Kitchen' })
    const button = screen.getByRole('button', { name: /This isn’t working/ })
    expect(button).toHaveTextContent('Show the nearest quick alternative')
  })

  it('finds a nearby quick alternative, never the same restaurant, with why it is quick', async () => {
    const { user } = renderDetail()
    await screen.findByRole('heading', { level: 1, name: 'Little Fern Kitchen' })
    await user.click(screen.getByRole('button', { name: /This isn’t working/ }))

    const dialog = await screen.findByRole('dialog', { name: 'Nearest quick alternative' })
    const name = await within(dialog).findByRole('heading', { level: 3 })
    expect(name).not.toHaveTextContent('Little Fern Kitchen')
    expect(within(dialog).getByRole('list', { name: /Why it's a quick option/ })).toBeInTheDocument()
    expect(within(dialog).getByText(/from Little Fern Kitchen/)).toBeInTheDocument() // measured from where you are
    expect(events('bail_out_used')).toMatchObject([{ fromRestaurantId: 'pdx-little-fern-kitchen', toRestaurantId: null }])
  })

  it('"Take me there" goes to the alternative, already chosen, and records the selection', async () => {
    const { user, router } = renderDetail()
    await screen.findByRole('heading', { level: 1, name: 'Little Fern Kitchen' })
    await user.click(screen.getByRole('button', { name: /This isn’t working/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Nearest quick alternative' })
    const altName = (await within(dialog).findByRole('heading', { level: 3 })).textContent ?? ''
    await user.click(within(dialog).getByRole('button', { name: 'Take me there' }))

    await waitFor(() => expect(router.state.location.pathname).not.toBe('/restaurant/pdx-little-fern-kitchen'))
    expect(await screen.findByRole('heading', { level: 1, name: altName })).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`You’re heading to ${altName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))).toBeInTheDocument()
    expect(events('restaurant_selected')).toHaveLength(1)
    expect(events('restaurant_selected')[0]).toMatchObject({ via: 'going_here' })
  })

  it('"Stay here" closes it without going anywhere', async () => {
    const { user, router } = renderDetail()
    await screen.findByRole('heading', { level: 1, name: 'Little Fern Kitchen' })
    await user.click(screen.getByRole('button', { name: /This isn’t working/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Nearest quick alternative' })
    await within(dialog).findByRole('heading', { level: 3 })
    await user.click(within(dialog).getByRole('button', { name: 'Stay here' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/restaurant/pdx-little-fern-kitchen')
  })

  it('searches fresh each time it opens', async () => {
    const { user } = renderDetail()
    await screen.findByRole('heading', { level: 1, name: 'Little Fern Kitchen' })
    for (let i = 0; i < 2; i++) {
      await user.click(screen.getByRole('button', { name: /This isn’t working/ }))
      const dialog = await screen.findByRole('dialog', { name: 'Nearest quick alternative' })
      await within(dialog).findByRole('heading', { level: 3 })
      await user.click(within(dialog).getByRole('button', { name: 'Stay here' }))
    }
    expect(events('bail_out_used')).toHaveLength(2)
  })
})

describe('supporting modules', () => {
  it('builds a directions URL from coordinates', () => {
    expect(directionsUrl({ location: { lat: 41.9, lng: -87.7 } })).toBe('https://www.google.com/maps/dir/?api=1&destination=41.9,-87.7')
  })

  it('groups every kid-fit attribute exactly once', () => {
    const grouped = ATTRIBUTE_GROUPS.flatMap((g) => g.keys)
    expect([...grouped].sort()).toEqual([...ATTR_KEYS].sort())
    expect(new Set(grouped).size).toBe(grouped.length)
  })
})
