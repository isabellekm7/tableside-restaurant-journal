/** An account holder. Anonymous Supabase sessions are NOT accounts: `isAnonymous` is true for them. */
export interface AccountUser {
  id: string
  email: string | null
  isAnonymous: boolean
}

export type AuthErrorCode =
  | 'invalid_input'
  | 'weak_password'
  | 'already_registered'
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'email_invalid'
  | 'rate_limited'
  | 'signup_disabled'
  | 'network'
  | 'unavailable'
  | 'unknown'

export type AuthResult =
  | { status: 'signed_in'; user: AccountUser }
  /** Sign-up worked but the project requires the email to be confirmed first. */
  | { status: 'confirm_email'; email: string }
  | { status: 'error'; code: AuthErrorCode; message: string }

export type SimpleAuthResult = { status: 'ok' } | { status: 'error'; code: AuthErrorCode; message: string }

export type AuthEvent = 'initial' | 'signed_in' | 'signed_out' | 'password_recovery' | 'updated'

export interface AuthState {
  user: AccountUser | null
  event: AuthEvent
}

/**
 * Accounts, behind an interface like the data repository: the UI never touches
 * Supabase directly. Passwords are passed straight through and never stored,
 * logged or sent to analytics.
 */
export interface AuthService {
  /** False when no backend is configured: the app runs on sample data with no accounts. */
  readonly available: boolean
  getUser(): Promise<AccountUser | null>
  signUp(email: string, password: string): Promise<AuthResult>
  signIn(email: string, password: string): Promise<AuthResult>
  signOut(): Promise<void>
  /** Re-send the confirmation email for a sign-up that hasn't been confirmed yet. */
  resendConfirmation(email: string): Promise<SimpleAuthResult>
  /** Ask for a password-reset email. Always reports "ok" for well-formed addresses (no account enumeration). */
  requestPasswordReset(email: string): Promise<SimpleAuthResult>
  /** Set a new password for the signed-in (e.g. recovering) user. */
  updatePassword(password: string): Promise<SimpleAuthResult>
  /** Subscribe to sign-in/out and recovery events. Returns an unsubscribe function. */
  onChange(listener: (state: AuthState) => void): () => void
}
