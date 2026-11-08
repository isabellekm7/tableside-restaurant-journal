import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../app/routes'
import { repository } from '../../data'
import { logger } from '../../lib/analytics/logger'
import { buildShareUrl } from '../../lib/share/shareLink'
import { useProfileStore } from '../../store/profileStore'
import { useTripStore } from '../../store/tripStore'

const SATURDAY_MIDDAY = new Date('2026-11-07T19:00:00Z')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(SATURDAY_MIDDAY)
  useProfileStore.getState().skipOnboarding()
})
afterEach(() => {
  vi.useRealTimers()
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
})

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return { router, user: userEvent.setup() }
}

describe('saving from Explore and the detail page', () => {
  it('saves with one tap on a card and announces it', async () => {
    const { user } = renderAt('/')
    const card = within(await screen.findByRole('article', { name: 'Little Fern Kitchen' }))
    await user.click(card.getByRole('button', { name: 'Save Little Fern Kitchen to My trip' }))

    expect(await card.findByRole('button', { name: 'Saved. Remove Little Fern Kitchen from My trip', pressed: true })).toBeInTheDocument()
    expect(screen.getByText('Saved to My trip.')).toBeInTheDocument()
    expect(logger.getEvents().filter((e) => e.type === 'list_saved')).toMatchObject([{ restaurantId: 'pdx-little-fern-kitchen' }])
    expect((await repository.listTripLists())[0]?.restaurantIds).toEqual(['pdx-little-fern-kitchen'])
  })

  it('tapping again removes it', async () => {
    const { user } = renderAt('/')
    const card = within(await screen.findByRole('article', { name: 'Little Fern Kitchen' }))
    await user.click(card.getByRole('button', { name: /^Save Little Fern Kitchen/ }))
    await user.click(await card.findByRole('button', { name: /^Saved\. Remove/ }))
    expect(await card.findByRole('button', { name: /^Save Little Fern Kitchen/, pressed: false })).toBeInTheDocument()
    expect(screen.getByText('Removed from My trip.')).toBeInTheDocument()
  })

  it('has a Save button on the detail page that shares state with the cards', async () => {
    const { user } = renderAt('/restaurant/pdx-little-fern-kitchen')
    await screen.findByRole('heading', { level: 1, name: 'Little Fern Kitchen' })
    await user.click(screen.getByRole('button', { name: /^Save Little Fern Kitchen to My trip/ }))
    expect(await screen.findByRole('button', { name: /^Saved\./ })).toHaveTextContent('Saved')
  })
})

describe('Saved page', () => {
  it('invites you to start a shortlist when there is nothing yet', async () => {
    renderAt('/saved')
    expect(await screen.findByText('Nothing saved yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Find a restaurant' })).toHaveAttribute('href', '/')
  })

  it('shows what you saved, scored for your kids, in the order you saved it', async () => {
    await useTripStore.getState().createList('Portland', ['pdx-velvet-ladle', 'pdx-little-fern-kitchen'])
    renderAt('/saved')
    expect(await screen.findByRole('heading', { level: 2, name: 'Portland' })).toBeInTheDocument()
    const items = within(await screen.findByRole('list', { name: 'Places in this list' }))
    const names = items.getAllByRole('article').map((a) => within(a).getByRole('heading').textContent)
    expect(names).toEqual(['The Velvet Ladle', 'Little Fern Kitchen'])
    expect(screen.getByText('2 places · new saves go here')).toBeInTheDocument()
  })

  it('says so when a saved place no longer exists, and can clear it', async () => {
    await useTripStore.getState().createList('Old', ['pdx-little-fern-kitchen', 'gone-forever'])
    const { user } = renderAt('/saved')
    expect(await screen.findByText(/1 saved place is no longer available/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear it' }))
    await waitFor(() => expect(screen.queryByText(/no longer available/)).not.toBeInTheDocument())
  })

  it('removes a place from a list', async () => {
    await useTripStore.getState().createList('Trip', ['pdx-little-fern-kitchen', 'pdx-velvet-ladle'])
    const { user } = renderAt('/saved')
    await user.click(await screen.findByRole('button', { name: 'Remove Little Fern Kitchen from this list' }))
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Little Fern Kitchen' })).not.toBeInTheDocument())
    expect(screen.getByRole('article', { name: 'The Velvet Ladle' })).toBeInTheDocument()
  })

  it('renames a list', async () => {
    await useTripStore.getState().createList('Trip', ['pdx-little-fern-kitchen'])
    const { user } = renderAt('/saved')
    await user.click(await screen.findByRole('button', { name: 'Rename' }))
    const box = screen.getByLabelText('List name')
    await user.clear(box)
    await user.type(box, 'Chicago weekend')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Chicago weekend' })).toBeInTheDocument()
  })

  it('asks before deleting a list, and keeps it if you change your mind', async () => {
    await useTripStore.getState().createList('Trip', ['pdx-little-fern-kitchen'])
    const { user } = renderAt('/saved')
    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('button', { name: /Yes, delete “Trip”/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Trip' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: /Yes, delete/ }))
    expect(await screen.findByText('Nothing saved yet')).toBeInTheDocument()
    expect(await repository.listTripLists()).toEqual([])
  })

  it('creates a new list and switches between lists', async () => {
    await useTripStore.getState().createList('Portland', ['pdx-little-fern-kitchen'])
    const { user } = renderAt('/saved')
    await user.type(await screen.findByLabelText('New list'), 'Chicago')
    await user.click(screen.getByRole('button', { name: 'Create' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Chicago' })).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Portland (1)' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Portland' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save new places here' }))
    expect(screen.getByText(/new saves go here/)).toBeInTheDocument()
  })

  it('works offline and says so', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    await useTripStore.getState().createList('Trip', ['pdx-little-fern-kitchen'])
    renderAt('/saved')
    expect(await screen.findByText(/You’re offline\. Your lists are on this device and still work/)).toBeInTheDocument()
    expect(await screen.findByRole('article', { name: 'Little Fern Kitchen' })).toBeInTheDocument()
  })

  it('prints through the browser', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    await useTripStore.getState().createList('Trip', ['pdx-little-fern-kitchen'])
    const { user } = renderAt('/saved')
    await user.click(await screen.findByRole('button', { name: 'Print' }))
    expect(print).toHaveBeenCalledTimes(1)
  })
})

describe('sharing', () => {
  it('copies a link that holds only the list name and places', async () => {
    const writeText = vi.fn(async () => undefined)
    await useTripStore.getState().createList('Weekend', ['pdx-little-fern-kitchen', 'chi-saffron-table'])
    const { user } = renderAt('/saved')
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await user.click(await screen.findByRole('button', { name: 'Share' }))
    await user.click(screen.getByRole('button', { name: 'Copy share link' }))

    const url = buildShareUrl(window.location.origin, { name: 'Weekend', restaurantIds: ['pdx-little-fern-kitchen', 'chi-saffron-table'] })
    expect(writeText).toHaveBeenCalledWith(url)
    expect(await screen.findByRole('button', { name: 'Link copied' })).toBeInTheDocument()
    expect(screen.getByText(/Nothing else about you is included/)).toBeInTheDocument()
  })

  it('shows the link to copy by hand when the clipboard is blocked', async () => {
    await useTripStore.getState().createList('Weekend', ['pdx-little-fern-kitchen'])
    const { user } = renderAt('/saved')
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(async () => Promise.reject(new Error('denied'))) }, configurable: true })
    await user.click(await screen.findByRole('button', { name: 'Share' }))
    await user.click(screen.getByRole('button', { name: 'Copy share link' }))
    expect(((await screen.findByLabelText('Share link')) as HTMLInputElement).value).toContain('/shared?n=Weekend')
  })
})

describe('shared summary page', () => {
  const link = '/shared?n=Weekend%20in%20Portland&r=pdx-little-fern-kitchen,pdx-velvet-ladle'

  it('shows the shared places, scored for the VIEWER’s kids', async () => {
    renderAt(link)
    expect(await screen.findByRole('heading', { level: 1, name: 'Weekend in Portland' })).toBeInTheDocument()
    expect(screen.getByText(/Fit is shown for/)).toHaveTextContent('your kids')
    expect(await screen.findByRole('article', { name: 'Little Fern Kitchen' })).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'The Velvet Ladle' })).toBeInTheDocument()
  })

  it('is read-only: no remove buttons', async () => {
    renderAt(link)
    await screen.findByRole('article', { name: 'Little Fern Kitchen' })
    expect(screen.queryByRole('button', { name: /Remove .* from this list/ })).not.toBeInTheDocument()
  })

  it('saves a copy into your own lists', async () => {
    const { user, router } = renderAt(link)
    await user.click(await screen.findByRole('button', { name: 'Save a copy to my lists' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/saved'))
    expect(await screen.findByRole('heading', { level: 2, name: 'Weekend in Portland' })).toBeInTheDocument()
    expect((await repository.listTripLists())[0]?.restaurantIds).toEqual(['pdx-little-fern-kitchen', 'pdx-velvet-ladle'])
  })

  it('handles a broken or empty link gracefully', async () => {
    renderAt('/shared?n=Oops')
    expect(await screen.findByText('This link doesn’t have a list in it')).toBeInTheDocument()
  })

  it('ignores junk in the link and shows what is valid', async () => {
    renderAt('/shared?n=T&r=pdx-little-fern-kitchen,<img src=x onerror=alert(1)>')
    expect(await screen.findByRole('article', { name: 'Little Fern Kitchen' })).toBeInTheDocument()
    expect(document.querySelector('img[src="x"]')).toBeNull()
  })

  it('renders a hostile list name as plain text', async () => {
    renderAt(`/shared?n=${encodeURIComponent('<b>bold</b>')}&r=pdx-little-fern-kitchen`)
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('<b>bold</b>')
    expect(document.querySelector('h1 b')).toBeNull()
  })
})

