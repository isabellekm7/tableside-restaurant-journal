import { isAuthRetryableFetchError, type AuthError, type Session, type SupabaseClient, type User } from '@supabase/supabase-js'
import type { AccountUser, AuthErrorCode, AuthResult, AuthService, SimpleAuthResult } from './types'
import { normalizeEmail, validateEmail, validateNewPassword } from './validation'

function toAccountUser(user: User | null | undefined): AccountUser | null {
  if (!user) return null
  return { id: user.id, email: user.email ?? null, isAnonymous: user.is_anonymous === true }
}

interface Mapped {
  code: AuthErrorCode
  message: string
}

/** Friendly, non-leaky wording for the errors people actually hit. */
function mapError(error: AuthError): Mapped {
  if (isAuthRetryableFetchError(error) || error.name === 'AuthRetryableFetchError') {
    return { code: 'network', message: 'We couldn’t reach the server. Check your connection and try again.' }
  }
  switch (error.code) {
    case 'weak_password':
      return { code: 'weak_password', message: 'That password is too easy to guess. Try a longer one, or a mix of words and numbers.' }
    case 'user_already_exists':
    case 'email_exists':
      return { code: 'already_registered', message: 'An account with that email may already exist. Try signing in, or reset your password.' }
    case 'invalid_credentials':
      return { code: 'invalid_credentials', message: 'That email and password don’t match. Check them and try again.' }
    case 'email_not_confirmed':
      return { code: 'email_not_confirmed', message: 'Please confirm your email first. Check your inbox for the link.' }
    case 'email_address_invalid':
    case 'validation_failed':
      return { code: 'email_invalid', message: 'We can’t use that email address. Try a different one.' }
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
    case 'over_sms_send_rate_limit':
      return { code: 'rate_limited', message: 'Too many attempts. Please wait a minute and try again.' }
    case 'signup_disabled':
    case 'email_provider_disabled':
      return { code: 'signup_disabled', message: 'Sign-ups are turned off right now.' }
    default:
      return { code: 'unknown', message: 'Something went wrong. Please try again.' }
  }
}

const failure = (error: AuthError) => ({ status: 'error' as const, ...mapError(error) })
const invalid = (message: string) => ({ status: 'error' as const, code: 'invalid_input' as const, message })

export interface SupabaseAuthOptions {
  /** Where confirmation and reset links bring people back to. Must be in the project's redirect allow-list. */
  redirectUrl: () => string
}

/** AuthService backed by Supabase Auth (email + password). */
export function createSupabaseAuth(client: SupabaseClient, options: SupabaseAuthOptions): AuthService {
  const accountOf = (session: Session | null): AccountUser | null => toAccountUser(session?.user)

  return {
    available: true,

    async getUser() {
      const { data } = await client.auth.getSession()
      return accountOf(data.session)
    },

    async signUp(email, password): Promise<AuthResult> {
      const emailProblem = validateEmail(email)
      if (emailProblem) return invalid(emailProblem)
      const passwordProblem = validateNewPassword(password, email)
      if (passwordProblem) return invalid(passwordProblem)

      const clean = normalizeEmail(email)
      const { data, error } = await client.auth.signUp({ email: clean, password, options: { emailRedirectTo: options.redirectUrl() } })
      if (error) return failure(error)
      const user = accountOf(data.session)
      if (data.session && user) return { status: 'signed_in', user }
      // No session means the project wants the email confirmed first. This is also what an
      // already-registered address looks like, so the screen never reveals which it was.
      return { status: 'confirm_email', email: clean }
    },

    async signIn(email, password): Promise<AuthResult> {
      const emailProblem = validateEmail(email)
      if (emailProblem) return invalid(emailProblem)
      if (!password) return invalid('Enter your password.')
      const { data, error } = await client.auth.signInWithPassword({ email: normalizeEmail(email), password })
      if (error) return failure(error)
      const user = accountOf(data.session)
      return user ? { status: 'signed_in', user } : { status: 'error', code: 'unknown', message: 'Something went wrong. Please try again.' }
    },

    async signOut() {
      await client.auth.signOut()
    },

    async resendConfirmation(email): Promise<SimpleAuthResult> {
      const problem = validateEmail(email)
      if (problem) return invalid(problem)
      const { error } = await client.auth.resend({ type: 'signup', email: normalizeEmail(email), options: { emailRedirectTo: options.redirectUrl() } })
      return error ? failure(error) : { status: 'ok' }
    },

    async requestPasswordReset(email): Promise<SimpleAuthResult> {
      const problem = validateEmail(email)
      if (problem) return invalid(problem)
      const { error } = await client.auth.resetPasswordForEmail(normalizeEmail(email), { redirectTo: options.redirectUrl() })
      // Only transport/rate-limit problems are reported; whether the account exists is never revealed.
      return error && mapError(error).code !== 'unknown' ? failure(error) : { status: 'ok' }
    },

    async updatePassword(password): Promise<SimpleAuthResult> {
      const problem = validateNewPassword(password)
      if (problem) return invalid(problem)
      const { error } = await client.auth.updateUser({ password })
      return error ? failure(error) : { status: 'ok' }
    },

    onChange(listener) {
      const { data } = client.auth.onAuthStateChange((event, session) => {
        const mapped =
          event === 'SIGNED_IN' ? 'signed_in'
          : event === 'SIGNED_OUT' ? 'signed_out'
          : event === 'PASSWORD_RECOVERY' ? 'password_recovery'
          : event === 'INITIAL_SESSION' ? 'initial'
          : 'updated'
        listener({ user: accountOf(session), event: mapped })
      })
      return () => data.subscription.unsubscribe()
    },
  }
}

/** Used when no backend is configured: the app works, there just are no accounts. */
export function createDisabledAuth(): AuthService {
  const unavailable = { status: 'error' as const, code: 'unavailable' as const, message: 'Accounts need the backend, which isn’t configured here.' }
  return {
    available: false,
    getUser: () => Promise.resolve(null),
    signUp: () => Promise.resolve(unavailable),
    signIn: () => Promise.resolve(unavailable),
    signOut: () => Promise.resolve(),
    resendConfirmation: () => Promise.resolve(unavailable),
    requestPasswordReset: () => Promise.resolve(unavailable),
    updatePassword: () => Promise.resolve(unavailable),
    onChange: () => () => undefined,
  }
}
