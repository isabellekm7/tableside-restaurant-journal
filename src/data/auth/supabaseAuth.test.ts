import { createClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { createDisabledAuth, createSupabaseAuth } from './supabaseAuth'
import type { AuthState } from './types'

/*
 * These tests drive the REAL Supabase client against a mocked network, so they exercise the exact
 * requests the app would send, without ever contacting a server or creating an account.
 */

const REDIRECT = 'https://app.example/account'
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const userJson = (over: Record<string, unknown> = {}) => ({
  id: 'user-1', aud: 'authenticated', role: 'authenticated', email: 'priya@example.com', is_anonymous: false,
  app_metadata: {}, user_metadata: {}, identities: [{ id: 'i1' }], created_at: '2026-11-07T00:00:00Z', ...over,
})
const sessionJson = (over: Record<string, unknown> = {}) => ({
  access_token: 'access.token.value', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'refresh-token', user: userJson(over),
})
const authError = (status: number, error_code: string, msg: string) => json({ code: status, error_code, msg }, status)

interface Call { method: string; path: string; search: string; body: Record<string, unknown> | null }

function setup(respond: (call: Call) => Response) {
  const calls: Call[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    const call: Call = { method: init?.method ?? 'GET', path: url.pathname, search: url.search, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null }
    calls.push(call)
    return respond(call)
  })
  const client = createClient('https://test.supabase.co', 'sb_publishable_test', {
    global: { fetch: fetchMock },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  return { service: createSupabaseAuth(client, { redirectUrl: () => REDIRECT }), calls }
}

describe('signUp', () => {
  it('asks the user to confirm their email when the project requires it', async () => {
    const { service, calls } = setup(() => json(userJson({ identities: [{ id: 'i1' }] })))
    const result = await service.signUp('  Priya@Example.com ', 'correct horse battery')
    expect(result).toEqual({ status: 'confirm_email', email: 'priya@example.com' })
    expect(calls[0]?.path).toBe('/auth/v1/signup')
    expect(calls[0]?.body).toMatchObject({ email: 'priya@example.com', password: 'correct horse battery' })
    expect(decodeURIComponent(calls[0]?.search ?? '')).toContain(`redirect_to=${REDIRECT}`)
    expect(await service.getUser()).toBeNull() // not signed in until confirmed
  })

  it('signs straight in when the project auto-confirms', async () => {
    const { service } = setup(() => json(sessionJson()))
    const result = await service.signUp('priya@example.com', 'correct horse battery')
    expect(result).toEqual({ status: 'signed_in', user: { id: 'user-1', email: 'priya@example.com', isAnonymous: false } })
    expect(await service.getUser()).toMatchObject({ id: 'user-1' })
  })

  it('looks identical for an already-registered address, so it never reveals who has an account', async () => {
    // With confirmation on, Supabase answers a repeat sign-up with a user that has no identities.
    const { service } = setup(() => json(userJson({ identities: [] })))
    expect(await service.signUp('priya@example.com', 'correct horse battery')).toEqual({ status: 'confirm_email', email: 'priya@example.com' })
  })

  it.each([
    [422, 'weak_password', 'weak_password'],
    [422, 'user_already_exists', 'already_registered'],
    [422, 'email_exists', 'already_registered'],
    [400, 'email_address_invalid', 'email_invalid'],
    [429, 'over_email_send_rate_limit', 'rate_limited'],
    [429, 'over_request_rate_limit', 'rate_limited'],
    [422, 'signup_disabled', 'signup_disabled'],
    [400, 'something_new', 'unknown'],
    [503, 'unexpected_failure', 'network'], // 5xx is treated as "couldn’t reach the server, try again"
  ])('maps server error %i %s to %s with a friendly message', async (status, errorCode, code) => {
    const { service } = setup(() => authError(status, errorCode, 'raw server text that should not be shown'))
    const result = await service.signUp('priya@example.com', 'correct horse battery')
    expect(result).toMatchObject({ status: 'error', code })
    if (result.status === 'error') expect(result.message).not.toMatch(/raw server text/)
  })

  it('reports an unreachable server as a network problem', async () => {
    const { service } = setup(() => {
      throw new TypeError('Failed to fetch')
    })
    expect(await service.signUp('priya@example.com', 'correct horse battery')).toMatchObject({ status: 'error', code: 'network' })
  })

  it('rejects bad input without touching the network', async () => {
    const { service, calls } = setup(() => json({}))
    expect(await service.signUp('not-an-email', 'correct horse battery')).toMatchObject({ status: 'error', code: 'invalid_input' })
    expect(await service.signUp('priya@example.com', 'short')).toMatchObject({ code: 'invalid_input' })
    expect(await service.signUp('priya@example.com', 'priya@example.com')).toMatchObject({ code: 'invalid_input' })
    expect(calls).toHaveLength(0)
  })
})

describe('signIn', () => {
  it('signs in with a password grant', async () => {
    const { service, calls } = setup(() => json(sessionJson()))
    const result = await service.signIn(' Priya@Example.com', 'correct horse battery')
    expect(result.status).toBe('signed_in')
    expect(calls[0]?.path).toBe('/auth/v1/token')
    expect(calls[0]?.search).toContain('grant_type=password')
    expect(calls[0]?.body).toMatchObject({ email: 'priya@example.com' })
  })

  it('says only "doesn’t match" for a bad password or unknown email (no enumeration)', async () => {
    const { service } = setup(() => authError(400, 'invalid_credentials', 'Invalid login credentials'))
    const result = await service.signIn('nobody@example.com', 'wrong password')
    expect(result).toMatchObject({ status: 'error', code: 'invalid_credentials' })
    if (result.status === 'error') expect(result.message).toMatch(/don’t match/)
  })

  it('tells someone with an unconfirmed email to confirm it', async () => {
    const { service } = setup(() => authError(400, 'email_not_confirmed', 'Email not confirmed'))
    expect(await service.signIn('priya@example.com', 'correct horse battery')).toMatchObject({ code: 'email_not_confirmed' })
  })

  it('validates before sending', async () => {
    const { service, calls } = setup(() => json({}))
    expect(await service.signIn('', 'x')).toMatchObject({ code: 'invalid_input' })
    expect(await service.signIn('priya@example.com', '')).toMatchObject({ code: 'invalid_input' })
    expect(calls).toHaveLength(0)
  })

  it('does not echo the password back in any result', async () => {
    const { service } = setup(() => authError(400, 'invalid_credentials', 'bad'))
    expect(JSON.stringify(await service.signIn('priya@example.com', 'hunter2-secret-pass'))).not.toContain('hunter2')
  })
})

describe('session handling', () => {
  it('signs out via the server', async () => {
    const { service, calls } = setup((c) => (c.path.endsWith('/logout') ? new Response(null, { status: 204 }) : json(sessionJson())))
    await service.signIn('priya@example.com', 'correct horse battery')
    await service.signOut()
    expect(calls.some((c) => c.path === '/auth/v1/logout')).toBe(true)
    expect(await service.getUser()).toBeNull()
  })

  it('treats an anonymous session as a visitor, not an account', async () => {
    const { service } = setup(() => json(sessionJson({ is_anonymous: true, email: undefined })))
    await service.signIn('x@example.com', 'correct horse battery')
    expect(await service.getUser()).toMatchObject({ isAnonymous: true, email: null })
  })

  it('announces sign-in and sign-out to listeners', async () => {
    const { service } = setup((c) => (c.path.endsWith('/logout') ? new Response(null, { status: 204 }) : json(sessionJson())))
    const seen: AuthState[] = []
    const stop = service.onChange((s) => seen.push(s))
    await service.signIn('priya@example.com', 'correct horse battery')
    await service.signOut()
    stop()
    const events = seen.map((s) => s.event)
    expect(events).toContain('signed_in')
    expect(events).toContain('signed_out')
    expect(seen.find((s) => s.event === 'signed_in')?.user?.email).toBe('priya@example.com')
    expect(seen.find((s) => s.event === 'signed_out')?.user).toBeNull()
  })
})

describe('confirmation and password reset', () => {
  it('re-sends the confirmation email', async () => {
    const { service, calls } = setup(() => json({}))
    expect(await service.resendConfirmation('Priya@Example.com')).toEqual({ status: 'ok' })
    expect(calls[0]?.path).toBe('/auth/v1/resend')
    expect(calls[0]?.body).toMatchObject({ type: 'signup', email: 'priya@example.com' })
  })

  it('surfaces rate limits when resending', async () => {
    const { service } = setup(() => authError(429, 'over_email_send_rate_limit', 'rate limited'))
    expect(await service.resendConfirmation('priya@example.com')).toMatchObject({ status: 'error', code: 'rate_limited' })
  })

  it('requests a reset link and always says ok for a well-formed address', async () => {
    const { service, calls } = setup(() => json({}))
    expect(await service.requestPasswordReset('priya@example.com')).toEqual({ status: 'ok' })
    expect(calls[0]?.path).toBe('/auth/v1/recover')
    expect(decodeURIComponent(calls[0]?.search ?? '')).toContain(`redirect_to=${REDIRECT}`)
  })

  it('never reveals whether the account exists, even if the server errors in an unexpected way', async () => {
    const { service } = setup(() => authError(404, 'user_not_found', 'no such user'))
    expect(await service.requestPasswordReset('ghost@example.com')).toEqual({ status: 'ok' })
  })

  it('does report real problems with a reset request, such as rate limits or no connection', async () => {
    expect(await setup(() => authError(429, 'over_email_send_rate_limit', 'x')).service.requestPasswordReset('a@example.com')).toMatchObject({ code: 'rate_limited' })
    const offline = setup(() => {
      throw new TypeError('Failed to fetch')
    })
    expect(await offline.service.requestPasswordReset('a@example.com')).toMatchObject({ code: 'network' })
  })

  it('validates the address first', async () => {
    const { service, calls } = setup(() => json({}))
    expect(await service.requestPasswordReset('nope')).toMatchObject({ code: 'invalid_input' })
    expect(calls).toHaveLength(0)
  })

  it('sets a new password for the signed-in (recovering) user', async () => {
    const { service, calls } = setup((c) => (c.method === 'PUT' ? json(userJson()) : json(sessionJson())))
    await service.signIn('priya@example.com', 'old password here')
    expect(await service.updatePassword('a brand new password')).toEqual({ status: 'ok' })
    const update = calls.find((c) => c.method === 'PUT')
    expect(update?.path).toBe('/auth/v1/user')
    expect(update?.body).toMatchObject({ password: 'a brand new password' })
  })

  it('rejects a weak new password locally and maps a server rejection', async () => {
    const { service, calls } = setup((c) => (c.method === 'PUT' ? authError(422, 'weak_password', 'weak') : json(sessionJson())))
    expect(await service.updatePassword('short')).toMatchObject({ code: 'invalid_input' })
    expect(calls).toHaveLength(0)
    await service.signIn('priya@example.com', 'old password here')
    expect(await service.updatePassword('password1234')).toMatchObject({ status: 'error', code: 'weak_password' })
  })
})

describe('disabled auth (no backend configured)', () => {
  it('reports itself as unavailable and never pretends to sign anyone in', async () => {
    const service = createDisabledAuth()
    expect(service.available).toBe(false)
    expect(await service.getUser()).toBeNull()
    expect(await service.signUp('a@example.com', 'correct horse battery')).toMatchObject({ status: 'error', code: 'unavailable' })
    expect(await service.signIn('a@example.com', 'x')).toMatchObject({ code: 'unavailable' })
    expect(() => service.onChange(() => undefined)()).not.toThrow()
  })
})
