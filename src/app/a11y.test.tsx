import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthService } from '../data'
import { auditAccessibility } from '../test/axe'
import { childFromAge } from '../lib/scoring/ageBands'
import { useAuthStore } from '../store/authStore'
import { useProfileStore } from '../store/profileStore'
import { useTripStore } from '../store/tripStore'
import { routes } from './routes'

/*
 * Every screen, and every sheet, must pass axe-core's rules (labels, roles, landmarks,
 * names, ARIA validity, duplicate ids, …). Failures print exactly what and where.
 */

vi.mock('../components/map/MapView', () => ({
  MapView: ({ label }: { label: string }) => <div role="region" aria-label={label} />,
}))

const SATURDAY_MIDDAY = new Date('2026-11-07T19:00:00Z')

const availableAuth: AuthService = {
  available: true,
  getUser: async () => null,
  signUp: async () => ({ status: 'confirm_email', email: 'a@example.com' }),
  signIn: async () => ({ status: 'error', code: 'invalid_credentials', message: 'x' }),
  signOut: async () => undefined,
  resendConfirmation: async () => ({ status: 'ok' }),
  requestPasswordReset: async () => ({ status: 'ok' }),
  updatePassword: async () => ({ status: 'ok' }),
  onChange: () => () => undefined,
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(SATURDAY_MIDDAY)
  useProfileStore.getState().setChildren([childFromAge('child-1', 2), childFromAge('child-2', 5)])
})
afterEach(() => vi.useRealTimers())

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return userEvent.setup()
}

async function expectAccessible() {
  expect(await auditAccessibility(), 'accessibility violations').toEqual([])
}

describe('accessibility: screens', () => {
  it('Explore', async () => {
    renderAt('/')
    await screen.findByRole('list', { name: 'Restaurants' })
    await expectAccessible()
  })

  it('Explore: empty state with compromises', async () => {
    const user = renderAt('/')
    await screen.findByRole('list', { name: 'Restaurants' })
    await user.click(screen.getByRole('button', { name: /^Filters/ }))
    await user.click(within(screen.getByRole('dialog')).getByRole('radio', { name: '0.5 mi' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^Show 0 places/ }))
    await screen.findByText('Nothing matches those filters')
    await expectAccessible()
  })

  it('Explore: map view', async () => {
    const user = renderAt('/')
    await screen.findByRole('list', { name: 'Restaurants' })
    await user.click(screen.getByRole('button', { name: 'Map' }))
    await screen.findByRole('region', { name: /Map of restaurants/ })
    await expectAccessible()
  })

  it('Onboarding', async () => {
    useProfileStore.getState().reset()
    renderAt('/welcome')
    await screen.findByRole('heading', { name: 'Who’s eating?' })
    await expectAccessible()
  })

  it('Restaurant detail', async () => {
    renderAt('/restaurant/pdx-little-fern-kitchen')
    await screen.findByRole('heading', { level: 1, name: 'Little Fern Kitchen' })
    await expectAccessible()
  })

  it('Restaurant detail with no kids profile', async () => {
    useProfileStore.getState().setChildren([])
    renderAt('/restaurant/chi-fiddlehead-family-table')
    await screen.findByRole('heading', { level: 1, name: 'Fiddlehead Family Table' })
    await expectAccessible()
  })

  it('Restaurant not found', async () => {
    renderAt('/restaurant/nope')
    await screen.findByText('We can’t find that restaurant')
    await expectAccessible()
  })

  it('Right now', async () => {
    renderAt('/right-now')
    await screen.findByRole('list', { name: /Where to eat right now/ })
    await expectAccessible()
  })

  it('Saved: empty and with a list', async () => {
    renderAt('/saved')
    await screen.findByText('Nothing saved yet')
    await expectAccessible()
  })

  it('Saved: with places', async () => {
    await useTripStore.getState().createList('Trip', ['pdx-little-fern-kitchen', 'chi-saffron-table'])
    renderAt('/saved')
    await screen.findByRole('article', { name: 'Little Fern Kitchen' })
    await expectAccessible()
  })

  it('Shared list', async () => {
    renderAt('/shared?n=Weekend&r=pdx-little-fern-kitchen,chi-saffron-table')
    await screen.findByRole('article', { name: 'Little Fern Kitchen' })
    await expectAccessible()
  })

  it('Account: unavailable, sign up, sign in, forgot password', async () => {
    renderAt('/account')
    await screen.findByText('Accounts aren’t available here')
    await expectAccessible()
  })

  it('Account forms', async () => {
    useAuthStore.setState({ service: availableAuth })
    const user = renderAt('/account')
    await screen.findByRole('heading', { name: 'Create your account' })
    await expectAccessible()
    await user.click(screen.getByRole('button', { name: 'Sign in', pressed: false }))
    await expectAccessible()
    await user.click(screen.getByRole('button', { name: 'Forgot your password?' }))
    await screen.findByRole('heading', { name: 'Reset your password' })
    await expectAccessible()
  })

  it('Debug and Styleguide', async () => {
    renderAt('/debug')
    await screen.findByRole('heading', { level: 1, name: 'Debug' })
    await expectAccessible()
  })

  it('Styleguide', async () => {
    renderAt('/styleguide')
    await screen.findByRole('heading', { level: 1, name: 'Styleguide' })
    await expectAccessible()
  })

  it('Not found', async () => {
    renderAt('/nope')
    await screen.findByText('We can\'t find that page', { exact: false })
    await expectAccessible()
  })
})

describe('accessibility: sheets and dialogs', () => {
  it('Filters', async () => {
    const user = renderAt('/')
    await screen.findByRole('list', { name: 'Restaurants' })
    await user.click(screen.getByRole('button', { name: /^Filters/ }))
    await screen.findByRole('dialog', { name: 'Filters' })
    await expectAccessible()
  })

  it('Who’s eating? editor', async () => {
    const user = renderAt('/')
    await screen.findByRole('list', { name: 'Restaurants' })
    await user.click(within(screen.getByRole('banner')).getByRole('button', { name: /2 kids/ }))
    await screen.findByRole('dialog', { name: 'Who’s eating?' })
    await expectAccessible()
  })

  it('Feedback form', async () => {
    const user = renderAt('/restaurant/pdx-little-fern-kitchen')
    await screen.findByRole('heading', { level: 1, name: 'Little Fern Kitchen' })
    await user.click(screen.getByRole('button', { name: 'Been here? Share how it went' }))
    await screen.findByRole('dialog')
    await expectAccessible()
  })

  it('Bail-out', async () => {
    const user = renderAt('/restaurant/pdx-little-fern-kitchen')
    await screen.findByRole('heading', { level: 1, name: 'Little Fern Kitchen' })
    await user.click(screen.getByRole('button', { name: /This isn’t working/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Nearest quick alternative' })
    await within(dialog).findByRole('heading', { level: 3 })
    await waitFor(() => expect(within(dialog).queryByRole('status', { name: 'Finding an alternative' })).not.toBeInTheDocument())
    await expectAccessible()
  })
})
