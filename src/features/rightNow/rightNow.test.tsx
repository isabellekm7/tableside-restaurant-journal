import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../app/routes'
import { logger } from '../../lib/analytics/logger'
import { childFromAge } from '../../lib/scoring/ageBands'
import { useProfileStore } from '../../store/profileStore'

const SATURDAY_MIDDAY = new Date('2026-11-07T19:00:00Z') // 11:00 in Portland
const THREE_AM = new Date('2026-11-07T11:00:00Z') // 03:00 in Portland

function setClock(at: Date) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(at)
}

beforeEach(() => {
  setClock(SATURDAY_MIDDAY)
  useProfileStore.getState().setChildren([childFromAge('child-1', 2)])
})
afterEach(() => vi.useRealTimers())

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return { router, user: userEvent.setup() }
}

const events = (type: string) => logger.getEvents().filter((e) => e.type === type)
const picks = async () => within(await screen.findByRole('list', { name: /Where to eat right now/ })).getAllByRole('article')

describe('Explore → Right now', () => {
  it('has a prominent "We need to eat soon" button at the top of Explore', async () => {
    renderAt('/')
    const link = await screen.findByRole('link', { name: /We need to eat soon/ })
    expect(link).toHaveAttribute('href', '/right-now')
    expect(link).toHaveTextContent('Open now · close by · short wait')
  })
})

describe('Right now', () => {
  it('recommends a few open places with fit, wait, travel time and closing time', async () => {
    renderAt('/right-now')
    const cards = await picks()
    expect(cards.length).toBeGreaterThan(0)
    expect(cards.length).toBeLessThanOrEqual(3)
    const first = within(cards[0] as HTMLElement)
    expect(first.getByText('Best right now')).toBeInTheDocument()
    expect(first.getByText(/\bmin (walk|ride)\b/)).toBeInTheDocument()
    expect(first.getByText(/Open until/)).toBeInTheDocument()
    expect(first.getByText(/wait/i, { selector: 'li span' })).toBeInTheDocument()
    expect(first.getByText('Sample data')).toBeInTheDocument()
  })

  it('says plainly that waits are simulated', async () => {
    renderAt('/right-now')
    await picks()
    expect(screen.getAllByText('(simulated)').length).toBeGreaterThan(0)
    expect(screen.getByText(/Wait times are simulated in this prototype/)).toBeInTheDocument()
  })

  it('records that Right now was used', async () => {
    renderAt('/right-now')
    await picks()
    expect(events('right_now_used')).toHaveLength(1)
  })

  it('is personalised: the answer for a toddler is not the answer for a baby', async () => {
    renderAt('/right-now')
    const forToddler = (await picks()).map((c) => within(c).getByRole('heading', { level: 2 }).textContent)
    document.body.innerHTML = ''
    useProfileStore.getState().setChildren([childFromAge('child-1', 0)])
    renderAt('/right-now')
    const forBaby = (await picks()).map((c) => within(c).getByRole('heading', { level: 2 }).textContent)
    expect(forToddler).not.toEqual(forBaby)
  })

  it('"We’re going here" records the choice and opens the place, already chosen', async () => {
    const { user, router } = renderAt('/right-now')
    const cards = await picks()
    const name = within(cards[0] as HTMLElement).getByRole('heading', { level: 2 }).textContent ?? ''
    await user.click(within(cards[0] as HTMLElement).getByRole('button', { name: 'We’re going here' }))

    expect(events('restaurant_selected')).toMatchObject([{ via: 'going_here' }])
    expect(router.state.location.pathname).toMatch(/^\/restaurant\//)
    expect(await screen.findByRole('heading', { level: 1, name })).toBeInTheDocument()
    expect(screen.getByText(/You’re heading to/)).toBeInTheDocument()
  })

  it('offers directions on each card', async () => {
    renderAt('/right-now')
    const cards = await picks()
    expect(within(cards[0] as HTMLElement).getByRole('link', { name: /Directions/ })).toHaveAttribute('href', expect.stringContaining('google.com/maps/dir'))
  })

  it('is honest when nothing is ideal, saying where each place falls short', async () => {
    useProfileStore.getState().setChildren([childFromAge('a', 0), childFromAge('b', 2), childFromAge('c', 4), childFromAge('d', 9)])
    renderAt('/right-now')
    await picks()
    // A demanding family from the city centre: strict criteria can't all be met.
    expect(screen.getByText(/No great fit with a short wait nearby right now/)).toBeInTheDocument()
    expect(screen.getAllByText(/longer than we’d like|Not a great fit|closes soon/).length).toBeGreaterThan(0)
  })

  it('says so when nothing is open at all', async () => {
    setClock(THREE_AM)
    renderAt('/right-now')
    expect(await screen.findByText('Nothing is open right now')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'See all restaurants' })).toHaveAttribute('href', '/')
  })

  it('lets the user improve accuracy by sharing their location', async () => {
    renderAt('/right-now')
    await picks()
    expect(screen.getByText(/Distances from the centre of Portland/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use my location' })).toBeInTheDocument()
  })

  it('shows a loading state first', () => {
    renderAt('/right-now')
    expect(screen.getByRole('status', { name: 'Loading restaurants' })).toBeInTheDocument()
  })
})
