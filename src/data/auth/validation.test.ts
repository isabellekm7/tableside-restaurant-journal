import { describe, expect, it } from 'vitest'
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, normalizeEmail, validateEmail, validateNewPassword } from './validation'

describe('validateEmail', () => {
  it.each(['a@b.co', 'priya.raman+kids@example.com', '  spaced@example.com  ', 'x@sub.domain.org'])('accepts %s', (email) => {
    expect(validateEmail(email)).toBeNull()
  })

  it.each(['', '   ', 'no-at-sign', '@no-user.com', 'no-domain@', 'two@@example.com', 'spa ce@example.com', 'a@b', 'a@b.c'])('rejects %j', (email) => {
    expect(validateEmail(email)).not.toBeNull()
  })

  it('rejects absurdly long addresses', () => {
    expect(validateEmail(`${'a'.repeat(250)}@example.com`)).not.toBeNull()
  })
})

describe('validateNewPassword', () => {
  it('requires a minimum length but no silly composition rules', () => {
    expect(validateNewPassword('short')).toMatch(new RegExp(`${MIN_PASSWORD_LENGTH}`))
    expect(validateNewPassword('a'.repeat(MIN_PASSWORD_LENGTH))).toBeNull()
    expect(validateNewPassword('correct horse battery staple')).toBeNull() // passphrases are welcome
  })

  it('rejects an empty password', () => {
    expect(validateNewPassword('')).toBe('Choose a password.')
  })

  it('rejects passwords longer than bcrypt can use, counting bytes not characters', () => {
    expect(validateNewPassword('a'.repeat(MAX_PASSWORD_LENGTH))).toBeNull()
    expect(validateNewPassword('a'.repeat(MAX_PASSWORD_LENGTH + 1))).not.toBeNull()
    expect(validateNewPassword('é'.repeat(40))).not.toBeNull() // 80 bytes
  })

  it('rejects using the email address as the password', () => {
    expect(validateNewPassword('Priya@Example.com', ' priya@example.com ')).toMatch(/email/i)
    expect(validateNewPassword('Priya@Example.com', 'someone@else.com')).toBeNull()
  })
})

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Priya@Example.COM ')).toBe('priya@example.com')
  })
})
