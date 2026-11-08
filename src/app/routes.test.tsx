import { act, cleanup, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useProfileStore } from '../store/profileStore'
import { routes } from './routes'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

describe('first-run gate', () => {
  it('sends a brand-new visitor to onboarding, remembering where they were going', () => {
    const router = renderAt('/saved')
    expect(router.state.location.pathname).toBe('/welcome')
    expect(router.state.location.state).toEqual({ from: '/saved' })
    expect(screen.getByRole('heading', { level: 1, name: 'Who’s eating?' })).toBeInTheDocument()
  })

  it('does not gate the internal /styleguide and /debug routes', () => {
    expect(renderAt('/styleguide').state.location.pathname).toBe('/styleguide')
  })

  it('does not gate anyone who has finished or skipped onboarding', () => {
    useProfileStore.getState().skipOnboarding()
    expect(renderAt('/saved').state.location.pathname).toBe('/saved')
  })
})

describe('offline banner', () => {
  beforeEach(() => {
    useProfileStore.getState().skipOnboarding()
  })
  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  })

  it('appears on every screen when offline, and says what still works', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    for (const path of ['/', '/saved', '/right-now', '/account']) {
      renderAt(path)
      expect(screen.getByText(/You’re offline\. Your saved lists and the sample restaurants still work/)).toBeInTheDocument()
      cleanup()
    }
  })

  it('shows and hides as the connection changes, without a reload', () => {
    renderAt('/saved')
    expect(screen.queryByText(/You’re offline/)).not.toBeInTheDocument()
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.getByText(/You’re offline/)).toBeInTheDocument()
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.queryByText(/You’re offline/)).not.toBeInTheDocument()
  })
})

describe('app shell and routing', () => {
  beforeEach(() => {
    useProfileStore.getState().skipOnboarding()
  })

  it('renders landmarks and the sample-data label on every screen', () => {
    renderAt('/')
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getAllByRole('navigation', { name: 'Primary' }).length).toBeGreaterThan(0)
    expect(within(screen.getByRole('banner')).getByText('Sample data')).toBeInTheDocument()
  })

  it('shows the kids chip in the header on every screen', () => {
    renderAt('/saved')
    expect(within(screen.getByRole('banner')).getByRole('button', { name: /add your kids/i })).toBeInTheDocument()
  })

  it('has a skip link to the main content', () => {
    renderAt('/')
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main')
  })

  it('shows a friendly not-found state with a way back', () => {
    renderAt('/nope')
    expect(screen.getByRole('heading', { name: /can't find that page/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Explore' })).toHaveAttribute('href', '/')
  })

  it('serves the styleguide, with every contrast pair passing', async () => {
    renderAt('/styleguide')
    expect(await screen.findByRole('heading', { level: 1, name: 'Styleguide' })).toBeInTheDocument()
    const table = screen.getByRole('table', { name: /contrast ratios/i })
    expect(within(table).queryAllByText('Fail')).toHaveLength(0)
    expect(within(table).getAllByText('Pass').length).toBeGreaterThan(10)
  })

  it('serves the hidden debug route', async () => {
    renderAt('/debug')
    expect(await screen.findByRole('heading', { level: 1, name: 'Debug' })).toBeInTheDocument()
  })
})
