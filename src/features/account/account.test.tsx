import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../app/routes'
import type { AccountUser, AuthResult, AuthService, AuthState, SimpleAuthResult } from '../../data'
import { useAuthStore } from '../../store/authStore'
import { useProfileStore } from '../../store/profileStore'

const priya: AccountUser = { id: 'user-1', email: 'priya@example.com', isAnonymous: false }

/** A controllable stand-in for the auth backend. Emits change events like the real one does. */
function fakeAuth(initial: AccountUser | null = null) {
  let current = initial
  const listeners = new Set<(s: AuthState) => void>()
  const emit = (user: AccountUser | null, event: AuthState['event']) => {
    current = user
    listeners.forEach((l) => l({ user, event }))
  }
  const service = {
    available: true,
    getUser: vi.fn(async () => current),
    signUp: vi.fn(async (_email: string, _password: string): Promise<AuthResult> => ({ status: 'confirm_email', email: 'priya@example.com' })),
    signIn: vi.fn(async (_email: string, _password: string): Promise<AuthResult> => {
      emit(priya, 'signed_in')
      return { status: 'signed_in', user: priya }
    }),
    signOut: vi.fn(async () => emit(null, 'signed_out')),
    resendConfirmation: vi.fn(async (_email: string): Promise<SimpleAuthResult> => ({ status: 'ok' })),
    requestPasswordReset: vi.fn(async (_email: string): Promise<SimpleAuthResult> => ({ status: 'ok' })),
    updatePassword: vi.fn(async (_password: string): Promise<SimpleAuthResult> => ({ status: 'ok' })),
    onChange: vi.fn((listener: (s: AuthState) => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }),
  } satisfies AuthService
  return { service, emit }
}

function renderAccount(fake = fakeAuth()) {
  useAuthStore.setState({ service: fake.service })
  const router = createMemoryRouter(routes, { initialEntries: ['/account'] })
  render(<RouterProvider router={router} />)
  return { ...fake, user: userEvent.setup() }
}

/** The form's submit button (the mode toggle has the same words, so select by type). */
const submitButton = () => {
  const button = document.querySelector<HTMLElement>('form button[type="submit"]')
  if (!button) throw new Error('no submit button')
  return button
}
const emailBox = () => screen.getByLabelText('Email')
const passwordBox = () => screen.getByLabelText('Password')

beforeEach(() => {
  useProfileStore.getState().skipOnboarding() // so the first-run gate doesn't redirect
})

describe('without a backend', () => {
  it('explains that accounts are unavailable instead of showing a form that cannot work', () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/account'] })
    render(<RouterProvider router={router} />) // default service: disabled
    expect(screen.getByText('Accounts aren’t available here')).toBeInTheDocument()
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
  })

  it('is still reachable from the navigation', () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/'] })
    render(<RouterProvider router={router} />)
    expect(screen.getAllByRole('link', { name: 'Account' }).length).toBeGreaterThan(0)
  })
})

describe('create account', () => {
  it('is the first thing a visitor sees, and says accounts are optional', async () => {
    renderAccount()
    expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
    expect(screen.getByText(/Optional: an account syncs your saved lists/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create account', pressed: true })).toBeInTheDocument()
  })

  it('validates in the form, field by field, before calling the server', async () => {
    const { service, user } = renderAccount()
    await screen.findByRole('heading', { name: 'Create your account' })

    await user.click(submitButton())
    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument()
    expect(screen.getByText('Choose a password.')).toBeInTheDocument()

    await user.type(emailBox(), 'priya@example.com')
    await user.type(passwordBox(), 'short')
    await user.click(submitButton())
    expect(await screen.findByText('Use at least 8 characters.')).toBeInTheDocument()
    expect(service.signUp).not.toHaveBeenCalled()
  })

  it('sends the details and moves to "check your email" when confirmation is required', async () => {
    const { service, user } = renderAccount()
    await screen.findByRole('heading', { name: 'Create your account' })
    await user.type(emailBox(), 'priya@example.com')
    await user.type(passwordBox(), 'correct horse battery')
    await user.click(submitButton())

    expect(service.signUp).toHaveBeenCalledWith('priya@example.com', 'correct horse battery')
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
    expect(screen.getByText('priya@example.com')).toBeInTheDocument()
  })

  it('lets you resend the email after a cooldown, or go back to use a different one', async () => {
    const { service, user } = renderAccount()
    await screen.findByRole('heading', { name: 'Create your account' })
    await user.type(emailBox(), 'priya@example.com')
    await user.type(passwordBox(), 'correct horse battery')
    await user.click(submitButton())

    const resend = await screen.findByRole('button', { name: /Resend email in \d+s/ })
    expect(resend).toBeDisabled() // no hammering the mail server
    expect(service.resendConfirmation).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Use a different email' }))
    expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
  })

  it('shows server errors in plain words, and keeps what was typed', async () => {
    const fake = fakeAuth()
    fake.service.signUp.mockResolvedValueOnce({ status: 'error', code: 'weak_password', message: 'That password is too easy to guess.' })
    const { user } = renderAccount(fake)
    await screen.findByRole('heading', { name: 'Create your account' })
    await user.type(emailBox(), 'priya@example.com')
    await user.type(passwordBox(), 'password1234')
    await user.click(submitButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('That password is too easy to guess.')
    expect(emailBox()).toHaveValue('priya@example.com')
  })

  it('can show and hide the password', async () => {
    const { user } = renderAccount()
    await screen.findByRole('heading', { name: 'Create your account' })
    expect(passwordBox()).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(passwordBox()).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(passwordBox()).toHaveAttribute('type', 'password')
  })

  it('uses the right autofill hints so password managers can help', async () => {
    const { user } = renderAccount()
    await screen.findByRole('heading', { name: 'Create your account' })
    expect(passwordBox()).toHaveAttribute('autocomplete', 'new-password')
    await user.click(screen.getByRole('button', { name: 'Sign in', pressed: false }))
    expect(passwordBox()).toHaveAttribute('autocomplete', 'current-password')
  })
})

describe('sign in and out', () => {
  it('signs in and shows the signed-in account', async () => {
    const { service, user } = renderAccount()
    await screen.findByRole('heading', { name: 'Create your account' })
    await user.click(screen.getByRole('button', { name: 'Sign in', pressed: false }))
    await user.type(emailBox(), 'priya@example.com')
    await user.type(passwordBox(), 'correct horse battery')
    await user.click(submitButton())

    expect(service.signIn).toHaveBeenCalledWith('priya@example.com', 'correct horse battery')
    expect(await screen.findByRole('heading', { name: 'Your account' })).toBeInTheDocument()
    expect(screen.getByText('priya@example.com')).toBeInTheDocument()
    expect(screen.getByText(/saved lists now sync/)).toBeInTheDocument()
  })

  it('clears the password after a wrong one, but keeps the email', async () => {
    const fake = fakeAuth()
    fake.service.signIn.mockResolvedValueOnce({ status: 'error', code: 'invalid_credentials', message: 'That email and password don’t match.' })
    const { user } = renderAccount(fake)
    await screen.findByRole('heading', { name: 'Create your account' })
    await user.click(screen.getByRole('button', { name: 'Sign in', pressed: false }))
    await user.type(emailBox(), 'priya@example.com')
    await user.type(passwordBox(), 'wrong password')
    await user.click(submitButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('don’t match')
    expect(passwordBox()).toHaveValue('')
    expect(emailBox()).toHaveValue('priya@example.com')
  })

  it('remembers a signed-in user across visits', async () => {
    renderAccount(fakeAuth(priya))
    expect(await screen.findByRole('heading', { name: 'Your account' })).toBeInTheDocument()
  })

  it('signs out and returns to the sign-up form', async () => {
    const { service, user } = renderAccount(fakeAuth(priya))
    await screen.findByRole('heading', { name: 'Your account' })
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(service.signOut).toHaveBeenCalled()
    expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
  })

  it('does not treat an anonymous session as a signed-in account', async () => {
    renderAccount(fakeAuth({ id: 'anon-1', email: null, isAnonymous: true }))
    expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
  })

  it('reacts when the session changes elsewhere (another tab, or a confirmation link)', async () => {
    const { emit } = renderAccount()
    await screen.findByRole('heading', { name: 'Create your account' })
    act(() => emit(priya, 'signed_in'))
    expect(await screen.findByRole('heading', { name: 'Your account' })).toBeInTheDocument()
  })
})

describe('forgot password', () => {
  it('sends a reset link and gives the same answer whether or not the account exists', async () => {
    const { service, user } = renderAccount()
    await screen.findByRole('heading', { name: 'Create your account' })
    await user.click(screen.getByRole('button', { name: 'Sign in', pressed: false }))
    await user.click(screen.getByRole('button', { name: 'Forgot your password?' }))
    await user.type(emailBox(), 'anyone@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(service.requestPasswordReset).toHaveBeenCalledWith('anyone@example.com')
    expect(await screen.findByText(/If an account exists for anyone@example.com/)).toBeInTheDocument()
  })

  it('validates the address first', async () => {
    const { service, user } = renderAccount()
    await screen.findByRole('heading', { name: 'Create your account' })
    await user.click(screen.getByRole('button', { name: 'Sign in', pressed: false }))
    await user.click(screen.getByRole('button', { name: 'Forgot your password?' }))
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument()
    expect(service.requestPasswordReset).not.toHaveBeenCalled()
  })
})

describe('following a password-reset link', () => {
  it('asks for a new password, validates it, saves it, and finishes signed in', async () => {
    const { service, emit, user } = renderAccount()
    await screen.findByRole('heading', { name: 'Create your account' })
    act(() => emit(priya, 'password_recovery'))

    expect(await screen.findByRole('heading', { name: 'Choose a new password' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('New password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Save password' }))
    expect(await screen.findByText('Use at least 8 characters.')).toBeInTheDocument()
    expect(service.updatePassword).not.toHaveBeenCalled()

    await user.clear(screen.getByLabelText('New password'))
    await user.type(screen.getByLabelText('New password'), 'a brand new password')
    await user.click(screen.getByRole('button', { name: 'Save password' }))
    expect(service.updatePassword).toHaveBeenCalledWith('a brand new password')
    expect(await screen.findByRole('heading', { name: 'Your account' })).toBeInTheDocument()
  })
})

describe('privacy copy', () => {
  it('tells people what the email is for and that kids’ ages stay local', async () => {
    renderAccount()
    await screen.findByRole('heading', { name: 'Create your account' })
    expect(screen.getByText(/only to sign you in\. Your kids’ ages stay on this device/)).toBeInTheDocument()
    expect(within(screen.getByRole('main')).queryByText(/password/i, { selector: 'script' })).toBeNull()
  })
})

