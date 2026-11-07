import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'
import { Chip } from './Chip'
import { FitBadge } from './FitBadge'
import { TextField } from './TextField'

describe('Button', () => {
  it('fires onClick and defaults to type=button', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Go</Button>)
    const button = screen.getByRole('button', { name: 'Go' })
    expect(button).toHaveAttribute('type', 'button')
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not fire when disabled', async () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Go
      </Button>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('Chip', () => {
  it('exposes pressed state to assistive tech', () => {
    const { rerender } = render(<Chip>Open now</Chip>)
    expect(screen.getByRole('button', { name: 'Open now' })).toHaveAttribute('aria-pressed', 'false')
    rerender(<Chip selected>Open now</Chip>)
    expect(screen.getByRole('button', { name: 'Open now' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('FitBadge', () => {
  it('always shows words, not just colour', () => {
    render(<FitBadge level="poor" />)
    expect(screen.getByText('Not a fit')).toBeInTheDocument()
  })

  it('shows custom wording and a rounded score', () => {
    render(<FitBadge level="great" label="Great for toddlers" score={91.4} />)
    expect(screen.getByText('Great for toddlers')).toBeInTheDocument()
    expect(screen.getByText('· 91')).toBeInTheDocument()
  })
})

describe('TextField', () => {
  it('labels the input and links the error message', () => {
    render(<TextField label="Child’s age" error="Ages 0 to 12 only" />)
    const input = screen.getByLabelText('Child’s age')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Ages 0 to 12 only')
  })
})
