import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { routes } from '../../app/routes'
import { logger } from '../../lib/analytics/logger'
import { useProfileStore } from '../../store/profileStore'

function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return { router, user: userEvent.setup() }
}

const continueButton = () => screen.getByRole('button', { name: 'Find restaurants' })
const chip = () => within(screen.getByRole('banner')).getByRole('button', { name: /kid|add your kids/i })
const eventTypes = () => logger.getEvents().map((e) => e.type)

describe('onboarding: Who’s eating?', () => {
  it('cannot continue until every child has an age group, and says why', () => {
    renderApp()
    expect(continueButton()).toBeDisabled()
    expect(screen.getByText('Choose an age group for each child to continue.')).toBeInTheDocument()
    expect(continueButton()).toHaveAccessibleDescription('Choose an age group for each child to continue.')
  })

  it('saves one child by age group and lands on the page the user was heading to', async () => {
    const { router, user } = renderApp('/saved')
    await user.click(screen.getByRole('radio', { name: /preschool/i }))
    expect(continueButton()).toBeEnabled()
    await user.click(continueButton())

    expect(router.state.location.pathname).toBe('/saved')
    expect(useProfileStore.getState().children).toEqual([{ id: 'child-1', band: 'preschool' }])
    expect(chip()).toHaveTextContent('1 kid: preschool')
  })

  it('offers an exact age that matches the chosen band, and records it', async () => {
    const { user } = renderApp()
    await user.click(screen.getByRole('radio', { name: /toddler/i }))

    const select = screen.getByRole('combobox', { name: /exact age/i })
    const options = within(select).getAllByRole('option').map((o) => o.textContent)
    expect(options).toEqual(['Just the age group', '1 year', '2 years'])

    await user.selectOptions(select, '2')
    await user.click(continueButton())
    expect(useProfileStore.getState().children).toEqual([{ id: 'child-1', band: 'toddler', ageYears: 2 }])
    expect(chip()).toHaveTextContent('1 kid: 2y')
  })

  it('does not ask for an exact age for infants (there is only one choice)', async () => {
    const { user } = renderApp()
    await user.click(screen.getByRole('radio', { name: /infant/i }))
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('clears the exact age when the age group changes to one it no longer fits', async () => {
    const { user } = renderApp()
    await user.click(screen.getByRole('radio', { name: /toddler/i }))
    await user.selectOptions(screen.getByRole('combobox', { name: /exact age/i }), '2')
    await user.click(screen.getByRole('radio', { name: /preschool/i }))
    expect(screen.getByRole('combobox', { name: /exact age/i })).toHaveValue('')
  })

  it('supports several children at once and shows them all in the chip', async () => {
    const { user } = renderApp()
    await user.click(screen.getByRole('radio', { name: /toddler/i }))
    await user.selectOptions(screen.getByRole('combobox', { name: /exact age/i }), '2')
    await user.click(screen.getByRole('button', { name: 'Add another child' }))

    const second = screen.getByRole('radiogroup', { name: 'Child 2 age group' })
    await user.click(within(second).getByRole('radio', { name: /preschool/i }))
    await user.selectOptions(screen.getByRole('combobox', { name: /child 2 exact age/i }), '5')
    await user.click(continueButton())

    expect(chip()).toHaveTextContent('2 kids: 2y, 5y')
  })

  it('moves focus to the new row when a child is added', async () => {
    const { user } = renderApp()
    await user.click(screen.getByRole('button', { name: 'Add another child' }))
    const second = screen.getByRole('radiogroup', { name: 'Child 2 age group' })
    expect(within(second).getAllByRole('radio')[0]).toHaveFocus()
  })

  it('allows at most four children', async () => {
    const { user } = renderApp()
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: 'Add another child' }))
    expect(screen.getAllByRole('radiogroup')).toHaveLength(4)
    expect(screen.getByRole('button', { name: 'Up to 4 children' })).toBeDisabled()
  })

  it('removes a child, but never the last one', async () => {
    const { user } = renderApp()
    expect(screen.queryByRole('button', { name: /remove child/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add another child' }))
    await user.click(screen.getByRole('button', { name: 'Remove child 2' }))
    expect(screen.getAllByRole('radiogroup')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /remove child/i })).not.toBeInTheDocument()
  })

  it('can be skipped, leaving general fit and an invitation to add kids later', async () => {
    const { router, user } = renderApp()
    await user.click(screen.getByRole('button', { name: 'Skip for now' }))
    expect(router.state.location.pathname).toBe('/')
    expect(useProfileStore.getState()).toMatchObject({ children: [], onboarding: 'skipped' })
    expect(chip()).toHaveTextContent('Add your kids')
  })

  it('records instrumentation events without personal data', async () => {
    const { user } = renderApp()
    await user.click(screen.getByRole('radio', { name: /toddler/i }))
    await user.selectOptions(screen.getByRole('combobox', { name: /exact age/i }), '2')
    await user.click(continueButton())

    expect(eventTypes()).toEqual(['children_set', 'onboarding_completed'])
    expect(logger.getEvents()[0]).toMatchObject({ source: 'onboarding', bands: ['toddler'], ages: [2] })
    expect(logger.getEvents()[1]).toMatchObject({ childCount: 1, exactAges: true })
  })

  it('records a skip', async () => {
    const { user } = renderApp()
    await user.click(screen.getByRole('button', { name: 'Skip for now' }))
    expect(eventTypes()).toEqual(['onboarding_skipped'])
  })
})
