import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { routes } from '../../app/routes'
import { logger } from '../../lib/analytics/logger'
import { useProfileStore } from '../../store/profileStore'

function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return { router, user: userEvent.setup() }
}

const header = () => within(screen.getByRole('banner'))
const dialog = () => screen.getByRole('dialog', { name: 'Who’s eating?' })

describe('header chip and editor', () => {
  beforeEach(() => {
    useProfileStore.getState().setChildren([
      { id: 'child-1', band: 'toddler', ageYears: 2 },
      { id: 'child-2', band: 'preschool', ageYears: 5 },
    ])
  })

  it('shows who the scores are for, like "2 kids: 2y, 5y"', () => {
    renderApp()
    expect(header().getByRole('button', { name: /2 kids: 2y, 5y/ })).toBeInTheDocument()
  })

  it('opens an editor pre-filled with the current kids', async () => {
    const { user } = renderApp()
    await user.click(header().getByRole('button', { name: /2 kids/ }))

    const group1 = within(dialog()).getByRole('radiogroup', { name: 'Child 1 age group' })
    const group2 = within(dialog()).getByRole('radiogroup', { name: 'Child 2 age group' })
    expect(within(group1).getByRole('radio', { name: /toddler/i })).toBeChecked()
    expect(within(group2).getByRole('radio', { name: /preschool/i })).toBeChecked()
    expect(within(dialog()).getByRole('combobox', { name: /child 1 exact age/i })).toHaveValue('2')
  })

  it('saves edits and updates the chip', async () => {
    const { user } = renderApp()
    await user.click(header().getByRole('button', { name: /2 kids/ }))
    const group2 = within(dialog()).getByRole('radiogroup', { name: 'Child 2 age group' })
    await user.click(within(group2).getByRole('radio', { name: /school-age/i }))
    await user.click(within(dialog()).getByRole('button', { name: 'Save' }))

    // The exact age (5) no longer fits school-age, so it falls back to the band.
    expect(header().getByRole('button', { name: /2 kids: 2y, school-age/ })).toBeInTheDocument()
    expect(dialog).toThrow() // closed
  })

  it('keeps stable child ids across edits and logs the change with its source', async () => {
    const { user } = renderApp()
    await user.click(header().getByRole('button', { name: /2 kids/ }))
    await user.click(within(dialog()).getByRole('button', { name: 'Save' }))
    expect(useProfileStore.getState().children.map((c) => c.id)).toEqual(['child-1', 'child-2'])
    expect(logger.getEvents().at(-1)).toMatchObject({ type: 'children_set', source: 'header', bands: ['toddler', 'preschool'] })
  })

  it('can add a third child from the editor', async () => {
    const { user } = renderApp()
    await user.click(header().getByRole('button', { name: /2 kids/ }))
    await user.click(within(dialog()).getByRole('button', { name: 'Add another child' }))
    const group3 = within(dialog()).getByRole('radiogroup', { name: 'Child 3 age group' })
    await user.click(within(group3).getByRole('radio', { name: /infant/i }))
    await user.click(within(dialog()).getByRole('button', { name: 'Save' }))
    expect(header().getByRole('button', { name: /3 kids: 2y, 5y, infant/ })).toBeInTheDocument()
  })

  it('can remove all kids', async () => {
    const { user } = renderApp()
    await user.click(header().getByRole('button', { name: /2 kids/ }))
    await user.click(within(dialog()).getByRole('button', { name: 'Remove all kids' }))
    expect(header().getByRole('button', { name: /add your kids/i })).toBeInTheDocument()
    expect(useProfileStore.getState().children).toEqual([])
  })

  it('closes without saving, and starts fresh next time it opens', async () => {
    const { user } = renderApp()
    await user.click(header().getByRole('button', { name: /2 kids/ }))
    const group1 = within(dialog()).getByRole('radiogroup', { name: 'Child 1 age group' })
    await user.click(within(group1).getByRole('radio', { name: /infant/i }))
    await user.click(within(dialog()).getByRole('button', { name: 'Close' }))

    expect(useProfileStore.getState().children[0]).toMatchObject({ band: 'toddler' })
    await user.click(header().getByRole('button', { name: /2 kids/ }))
    const again = within(dialog()).getByRole('radiogroup', { name: 'Child 1 age group' })
    expect(within(again).getByRole('radio', { name: /toddler/i })).toBeChecked()
  })
})

describe('kid-fit follows the profile', () => {
  const littleFern = () => screen.findByRole('article', { name: 'Little Fern Kitchen' })

  it('shows the same restaurant as great for a toddler and poor for a baby', async () => {
    useProfileStore.getState().setChildren([{ id: 'child-1', band: 'toddler', ageYears: 2 }])
    renderApp()
    expect(await within(await littleFern()).findByText(/^Great for your 2-year-old/)).toBeInTheDocument()

    act(() => useProfileStore.getState().setChildren([{ id: 'child-1', band: 'infant' }]))
    expect(await within(await littleFern()).findByText(/^Not a good fit for your baby/)).toBeInTheDocument()
  })

  it('explains which child holds a restaurant back when there are several', async () => {
    useProfileStore.getState().setChildren([
      { id: 'child-1', band: 'infant' },
      { id: 'child-2', band: 'schoolAge', ageYears: 8 },
    ])
    renderApp()
    const card = await within(await screen.findByRole('article', { name: 'Little Fern Kitchen' }))
    expect(card.getByText(/Held back by your baby/)).toBeInTheDocument()
    // Per-child badges make the split visible.
    expect(card.getByText(/baby · Not a fit/)).toBeInTheDocument()
  })

  it('falls back to a general read with an invitation when there are no kids', async () => {
    useProfileStore.getState().skipOnboarding()
    renderApp()
    expect(await within(await littleFern()).findByText(/Add your kids’ ages/)).toBeInTheDocument()
  })
})

describe('/debug', () => {
  it('lists recorded events and can reset onboarding for the next test participant', async () => {
    useProfileStore.getState().setChildren([{ id: 'child-1', band: 'toddler' }])
    logger.track({ type: 'app_open' })
    logger.track({ type: 'restaurant_selected', restaurantId: 'x', via: 'going_here' })
    const { user } = renderApp('/debug')

    expect(screen.getByRole('heading', { name: '60-second metric' })).toBeInTheDocument()
    expect(screen.getByText('restaurant_selected')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reset kids and onboarding' }))
    expect(useProfileStore.getState()).toMatchObject({ children: [], onboarding: 'pending' })
  })
})
