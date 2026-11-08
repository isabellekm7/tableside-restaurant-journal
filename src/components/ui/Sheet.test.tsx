import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Sheet } from './Sheet'

function Harness({ onClosed }: { onClosed?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open it</button>
      <Sheet
        open={open}
        title="Settings"
        onClose={() => {
          setOpen(false)
          onClosed?.()
        }}
      >
        <button>Inside</button>
      </Sheet>
    </>
  )
}

describe('Sheet', () => {
  it('only renders its content while open, so every opening starts fresh', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(screen.queryByRole('button', { name: 'Inside' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open it' }))
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Inside' })).toBeInTheDocument()
  })

  it('closes from the Close button', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open it' }))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes when Esc is pressed (the cancel event), without waiting for the later close event', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open it' }))
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('can be reopened straight after Esc, even if the browser has not delivered the close event yet', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open it' }))
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    await user.click(screen.getByRole('button', { name: 'Open it' }))
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument()
  })

  it('closes when the backdrop (the dialog itself) is clicked, but not when its contents are', async () => {
    const user = userEvent.setup()
    const onClosed = vi.fn()
    render(<Harness onClosed={onClosed} />)
    await user.click(screen.getByRole('button', { name: 'Open it' }))
    await user.click(screen.getByRole('button', { name: 'Inside' }))
    expect(onClosed).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClosed).toHaveBeenCalled()
  })

  it('locks page scrolling while open and always releases it', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(document.body.style.overflow).toBe('')
    await user.click(screen.getByRole('button', { name: 'Open it' }))
    expect(document.body.style.overflow).toBe('hidden')
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(document.body.style.overflow).toBe('')
  })
})
