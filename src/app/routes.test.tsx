import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { routes } from './routes'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(<RouterProvider router={router} />)
}

describe('app shell and routing', () => {
  it('renders landmarks and the sample-data label on every screen', () => {
    renderAt('/')
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getAllByRole('navigation', { name: 'Primary' }).length).toBeGreaterThan(0)
    expect(within(screen.getByRole('banner')).getByText('Sample data')).toBeInTheDocument()
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

  it('serves the styleguide, with every contrast pair passing', () => {
    renderAt('/styleguide')
    expect(screen.getByRole('heading', { level: 1, name: 'Styleguide' })).toBeInTheDocument()
    const table = screen.getByRole('table', { name: /contrast ratios/i })
    expect(within(table).queryAllByText('Fail')).toHaveLength(0)
    expect(within(table).getAllByText('Pass').length).toBeGreaterThan(10)
  })

  it('serves the hidden debug route', () => {
    renderAt('/debug')
    expect(screen.getByRole('heading', { name: 'Debug' })).toBeInTheDocument()
  })
})
