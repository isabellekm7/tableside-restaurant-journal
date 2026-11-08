import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../app/routes'
import { repository } from '../../data'
import { logger } from '../../lib/analytics/logger'
import { childFromAge } from '../../lib/scoring/ageBands'
import { useProfileStore } from '../../store/profileStore'

const SATURDAY_MIDDAY = new Date('2026-11-07T19:00:00Z')
const ID = 'pdx-little-fern-kitchen'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(SATURDAY_MIDDAY)
  useProfileStore.getState().setChildren([childFromAge('child-1', 2), childFromAge('child-2', 5)])
})
afterEach(() => {
  vi.useRealTimers()
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
})

async function openForm() {
  const router = createMemoryRouter(routes, { initialEntries: [`/restaurant/${ID}`] })
  render(<RouterProvider router={router} />)
  const user = userEvent.setup()
  await screen.findByRole('heading', { level: 1, name: 'Little Fern Kitchen' })
  await user.click(screen.getByRole('button', { name: 'Been here? Share how it went' }))
  const dialog = await screen.findByRole('dialog', { name: 'How did it go at Little Fern Kitchen?' })
  return { user, dialog: within(dialog) }
}

const events = (type: string) => logger.getEvents().filter((e) => e.type === type)

describe('feedback form', () => {
  it('opens from the detail page, pre-tagged with your kids’ age bands, and says how long it takes', async () => {
    const { dialog } = await openForm()
    expect(dialog.getByRole('button', { name: /Toddler/, pressed: true })).toBeInTheDocument()
    expect(dialog.getByRole('button', { name: /Preschool/, pressed: true })).toBeInTheDocument()
    expect(dialog.getByRole('button', { name: /Infant/, pressed: false })).toBeInTheDocument()
    expect(dialog.getByText(/about 20 seconds/i)).toBeInTheDocument()
  })

  it('asks the quick-tap questions from the brief, and no free text', async () => {
    const { dialog } = await openForm()
    for (const q of ['Did your child have a high chair?', 'Were the staff welcoming?', 'How long did you wait?', 'How was the noise?', 'Would you go back with your kids?']) {
      expect(dialog.getByText(q)).toBeInTheDocument()
    }
    expect(dialog.queryByRole('textbox')).not.toBeInTheDocument()
    expect(dialog.getByText('Not for us')).toBeInTheDocument()
  })

  it('cannot be sent until every question is answered, and shows progress', async () => {
    const { dialog } = await openForm()
    expect(dialog.getByRole('button', { name: 'Send report' })).toBeDisabled()
    expect(dialog.getByText('1 of 6 answered')).toBeInTheDocument()
  })

  it('cannot be sent without saying which kids were there', async () => {
    const { user, dialog } = await openForm()
    await user.click(dialog.getByRole('button', { name: /Toddler/ }))
    await user.click(dialog.getByRole('button', { name: /Preschool/ }))
    expect(dialog.getByText('0 of 6 answered')).toBeInTheDocument()
  })

  it('saves a complete report tagged by age band, thanks the parent, and shows it under "Your reports"', async () => {
    const { user, dialog } = await openForm()
    const pick = async (legend: string, option: string) => user.click(within(dialog.getByText(legend).closest('fieldset') as HTMLElement).getByRole('radio', { name: option }))
    await pick('Did your child have a high chair?', 'Yes')
    await pick('Were the staff welcoming?', 'Somewhat')
    await pick('How long did you wait?', 'About 10 min')
    await pick('How was the noise?', 'Loud')
    await pick('Would you go back with your kids?', 'Yes')
    expect(dialog.getByText('6 of 6 answered')).toBeInTheDocument()
    await user.click(dialog.getByRole('button', { name: 'Send report' }))

    expect(await dialog.findByText('Thank you')).toBeInTheDocument()
    expect(dialog.getByText(/don’t change anyone’s scores yet/)).toBeInTheDocument()
    const saved = await repository.listFeedback(ID)
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({ reporterBands: ['toddler', 'preschool'], hadHighChair: 'yes', staffWelcoming: 'somewhat', waitMinutes: 10, noise: 'loud', wouldReturn: true, notForUs: false })
    expect(events('feedback_submitted')).toMatchObject([{ restaurantId: ID }])

    await user.click(dialog.getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const reports = screen.getByRole('heading', { name: 'Your reports' }).parentElement as HTMLElement
    expect(within(reports).getByText(/Toddler, Preschool/)).toBeInTheDocument()
    expect(within(reports).getByText(/Waited ~10 min/)).toBeInTheDocument()
  })

  it('the "Not for us" signal is optional, and is recorded when tapped', async () => {
    const { user, dialog } = await openForm()
    const pick = async (legend: string, option: string) => user.click(within(dialog.getByText(legend).closest('fieldset') as HTMLElement).getByRole('radio', { name: option }))
    await pick('Did your child have a high chair?', 'No')
    await pick('Were the staff welcoming?', 'No')
    await pick('How long did you wait?', '30 min or more')
    await pick('How was the noise?', 'Quiet')
    await pick('Would you go back with your kids?', 'No')
    await user.click(dialog.getByRole('button', { name: 'We felt unwelcome here' }))
    await user.click(dialog.getByRole('button', { name: 'Send report' }))
    await dialog.findByText('Thank you')

    expect((await repository.listFeedback(ID))[0]).toMatchObject({ notForUs: true, wouldReturn: false, waitMinutes: 35 })
    await user.click(dialog.getByRole('button', { name: 'Done' }))
    expect(screen.getByText(/You marked this “Not for us”/)).toBeInTheDocument()
  })

  it('counts your report in YOUR numbers only, and labels it', async () => {
    const { user, dialog } = await openForm()
    expect(screen.getByText(/34 parents/)).toBeInTheDocument()
    expect(screen.queryByText(/includes your report/)).not.toBeInTheDocument()
    const pick = async (legend: string, option: string) => user.click(within(dialog.getByText(legend).closest('fieldset') as HTMLElement).getByRole('radio', { name: option }))
    await pick('Did your child have a high chair?', 'Yes')
    await pick('Were the staff welcoming?', 'Yes')
    await pick('How long did you wait?', 'No wait')
    await pick('How was the noise?', 'Moderate')
    await pick('Would you go back with your kids?', 'Yes')
    await user.click(dialog.getByRole('button', { name: 'Send report' }))
    await dialog.findByText('Thank you')
    await user.click(dialog.getByRole('button', { name: 'Done' }))

    expect(screen.getByText(/35 parents/)).toBeInTheDocument()
    expect(screen.getByText(/includes your report/)).toBeInTheDocument()
  })

  it('tells you plainly when you are offline and the report stays on the device', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    const { user, dialog } = await openForm()
    const pick = async (legend: string, option: string) => user.click(within(dialog.getByText(legend).closest('fieldset') as HTMLElement).getByRole('radio', { name: option }))
    await pick('Did your child have a high chair?', 'Yes')
    await pick('Were the staff welcoming?', 'Yes')
    await pick('How long did you wait?', 'About 5 min')
    await pick('How was the noise?', 'Moderate')
    await pick('Would you go back with your kids?', 'Yes')
    await user.click(dialog.getByRole('button', { name: 'Send report' }))
    expect(await dialog.findByText(/saved on this device only/)).toBeInTheDocument()
  })

  it('keeps the form open with a clear message if saving fails', async () => {
    const { user, dialog } = await openForm()
    vi.spyOn(repository, 'addFeedback').mockRejectedValueOnce(new Error('nope'))
    const pick = async (legend: string, option: string) => user.click(within(dialog.getByText(legend).closest('fieldset') as HTMLElement).getByRole('radio', { name: option }))
    await pick('Did your child have a high chair?', 'Yes')
    await pick('Were the staff welcoming?', 'Yes')
    await pick('How long did you wait?', 'About 5 min')
    await pick('How was the noise?', 'Moderate')
    await pick('Would you go back with your kids?', 'Yes')
    await user.click(dialog.getByRole('button', { name: 'Send report' }))
    expect(await dialog.findByRole('alert')).toHaveTextContent(/couldn’t save that/)
    expect(dialog.getByRole('button', { name: 'Send report' })).toBeEnabled() // still answered, ready to retry
    await user.click(dialog.getByRole('button', { name: 'Send report' }))
    expect(await dialog.findByText('Thank you')).toBeInTheDocument()
  })

  it('Cancel closes without saving anything', async () => {
    const { user, dialog } = await openForm()
    await user.click(dialog.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await repository.listFeedback(ID)).toEqual([])
  })

  it('starts fresh each time it opens', async () => {
    const { user, dialog } = await openForm()
    await user.click(dialog.getByRole('button', { name: /Infant/ }))
    await user.click(dialog.getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Been here? Share how it went' }))
    const again = within(await screen.findByRole('dialog'))
    expect(again.getByRole('button', { name: /Infant/, pressed: false })).toBeInTheDocument()
    await waitFor(() => expect(again.getByText('1 of 6 answered')).toBeInTheDocument())
  })
})

