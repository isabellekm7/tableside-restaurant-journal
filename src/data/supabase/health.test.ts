import { createClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { clearFallbackIncidents, getFallbackIncidents, recordFallback } from '../backendStatus'
import { checkSupabaseConnection } from './health'

function clientWith(handler: (url: URL, method: string) => Response | Promise<Response>) {
  const calls: Array<{ method: string; path: string }> = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    calls.push({ method: init?.method ?? 'GET', path: url.pathname })
    return handler(url, init?.method ?? 'GET')
  })
  const client = createClient('https://test.supabase.co', 'sb_publishable_test', {
    global: { fetch: fetchMock },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  return { client, calls }
}

const counted = (n: number) => new Response(null, { status: 200, headers: { 'content-range': `*/${n}` } })

describe('checkSupabaseConnection', () => {
  it('reports row counts without downloading data, creating an account or writing anything', async () => {
    const { client, calls } = clientWith((url) => counted(url.pathname.endsWith('/cities') ? 2 : 28))
    const result = await checkSupabaseConnection(client)
    expect(result).toMatchObject({ ok: true, restaurants: 28, cities: 2 })
    expect(calls.map((c) => c.method).sort()).toEqual(['HEAD', 'HEAD'])
    expect(calls.some((c) => c.path.startsWith('/auth/'))).toBe(false)
  })

  it('reports a server-side failure', async () => {
    const { client } = clientWith(() => new Response(JSON.stringify({ message: 'permission denied for table restaurants' }), { status: 401, headers: { 'Content-Type': 'application/json' } }))
    const result = await checkSupabaseConnection(client)
    expect(result.ok).toBe(false)
    expect(result.restaurants).toBeNull()
  })

  it('reports an unreachable backend instead of throwing', async () => {
    const { client } = clientWith(() => {
      throw new TypeError('Failed to fetch')
    })
    const result = await checkSupabaseConnection(client)
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('measures elapsed time with the clock it is given', async () => {
    let t = 1000
    let first = true
    const { client } = clientWith(() => {
      if (first) t += 250 // two requests run in parallel; the check should take as long as the slowest
      first = false
      return counted(1)
    })
    expect((await checkSupabaseConnection(client, () => t)).ms).toBe(250)
  })
})

describe('fallback incident log', () => {
  it('records newest first, with a cap, and can be cleared', () => {
    clearFallbackIncidents()
    for (let i = 0; i < 25; i++) recordFallback(`op${i}`, new Error(`boom ${i}`), () => new Date(2026, 10, 7, 12, 0, i))
    const incidents = getFallbackIncidents()
    expect(incidents).toHaveLength(20)
    expect(incidents[0]).toMatchObject({ operation: 'op24', message: 'boom 24' })
    clearFallbackIncidents()
    expect(getFallbackIncidents()).toEqual([])
  })

  it('copes with non-Error values', () => {
    clearFallbackIncidents()
    recordFallback('x', 'plain string')
    expect(getFallbackIncidents()[0]?.message).toBe('plain string')
    clearFallbackIncidents()
  })
})
