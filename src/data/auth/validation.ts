/**
 * Client-side checks for instant feedback. They are a convenience only: the server
 * is the authority (it also enforces its own password policy).
 */
export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 72 // bcrypt silently ignores anything past 72 bytes

// Deliberately simple: something@something.tld. Real validation is "can we email it".
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** An error message, or null when fine. */
export function validateEmail(email: string): string | null {
  const value = email.trim()
  if (!value) return 'Enter your email address.'
  if (value.length > 254 || !EMAIL.test(value)) return 'That doesn’t look like an email address.'
  return null
}

export function validateNewPassword(password: string, email = ''): string | null {
  if (!password) return 'Choose a password.'
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_LENGTH) return `Use ${MAX_PASSWORD_LENGTH} characters or fewer.`
  if (email && password.toLowerCase() === normalizeEmail(email)) return 'Your password can’t be your email address.'
  return null
}
