import { describe, expect, it } from 'vitest'
import { createMemoryStore } from '../../data/keyValueStore'
import type { AppEvent, StoredEvent } from './events'
import { EVENTS_STORAGE_KEY, MAX_STORED_EVENTS, createEventLogger } from './logger'
import { formatDuration, goalRate, summarizeSessions } from './metrics'

function makeLogger(start = 1_000_000) {
  let clock = start
  const store = createMemoryStore()
  const logged: StoredEvent[] = []
  const logger = createEventLogger({ store, now: () => clock, sessionId: 's1', log: (e) => logged.push(e) })
  return { logger, store, logged, advance: (ms: number) => (clock += ms) }
}

describe('event logger', () => {
  it('stamps events with an id, time, session and time-since-open', () => {
    const { logger, advance } = makeLogger()
    advance(1500)
    const event = logger.track({ type: 'right_now_used' })
    expect(event).toMatchObject({ id: 1, type: 'right_now_used', sessionId: 's1', msSinceOpen: 1500, ts: 1_001_500 })
  })

  it('persists events, mirrors them to the console sink, and increments ids', () => {
    const { logger, logged } = makeLogger()
    logger.track({ type: 'app_open' })
    logger.track({ type: 'filter_used', filter: 'price', value: 2 })
    expect(logger.getEvents().map((e) => e.id)).toEqual([1, 2])
    expect(logged).toHaveLength(2)
  })

  it('keeps only the newest events beyond the cap', () => {
    const { logger } = makeLogger()
    for (let i = 0; i < MAX_STORED_EVENTS + 5; i++) logger.track({ type: 'right_now_used' })
    const events = logger.getEvents()
    expect(events).toHaveLength(MAX_STORED_EVENTS)
    expect(events[0]?.id).toBe(6)
  })

  it('exports valid JSON and can be cleared', () => {
    const { logger } = makeLogger()
    logger.track({ type: 'app_open' })
    expect(JSON.parse(logger.exportJson())).toHaveLength(1)
    logger.clear()
    expect(logger.getEvents()).toEqual([])
  })

  it('shrugs off corrupt storage', () => {
    const { logger, store } = makeLogger()
    store.setItem(EVENTS_STORAGE_KEY, '{nope')
    expect(logger.getEvents()).toEqual([])
    logger.track({ type: 'app_open' })
    expect(logger.getEvents()).toHaveLength(1)
  })

  it('never throws when storage is unavailable', () => {
    const logger = createEventLogger({
      store: { getItem: () => null, setItem: () => { throw new Error('quota') }, removeItem: () => undefined },
      log: () => undefined,
    })
    expect(() => logger.track({ type: 'app_open' })).not.toThrow()
  })

  it('redacts anything that looks like an email address, as a last line of defence', () => {
    const { logger } = makeLogger()
    const event = logger.track({ type: 'filter_used', filter: 'search', value: 'priya@example.com' })
    expect(event).toMatchObject({ value: '[redacted]' })
    expect(JSON.stringify(logger.getEvents())).not.toContain('priya@example.com')
    expect(logger.track({ type: 'filter_used', filter: 'price', value: 2 })).toMatchObject({ value: 2 })
  })

  it('records no personal data: child events carry only bands and ages', () => {
    const { logger } = makeLogger()
    const event = logger.track({ type: 'children_set', source: 'onboarding', bands: ['toddler'], ages: [2] })
    expect(Object.keys(event).sort()).toEqual(['ages', 'bands', 'id', 'msSinceOpen', 'sessionId', 'source', 'ts', 'type'])
  })
})

// ───────────── The 60-second metric ─────────────

let nextId = 1
const ev = (sessionId: string, ts: number, event: AppEvent): StoredEvent => ({
  ...event,
  id: nextId++,
  ts,
  sessionId,
  msSinceOpen: 0,
})

describe('summarizeSessions', () => {
  const events: StoredEvent[] = [
    // A: decided in 45s, 20s of which was onboarding.
    ev('A', 0, { type: 'app_open' }),
    ev('A', 20_000, { type: 'onboarding_completed', childCount: 1, bands: ['toddler'], exactAges: true }),
    ev('A', 30_000, { type: 'filter_used', filter: 'openNow', value: true }),
    ev('A', 40_000, { type: 'bail_out_used', fromRestaurantId: 'x', toRestaurantId: 'y' }),
    ev('A', 45_000, { type: 'restaurant_selected', restaurantId: 'y', via: 'going_here' }),
    // B: never decided.
    ev('B', 100_000, { type: 'app_open' }),
    ev('B', 110_000, { type: 'right_now_used' }),
    // C: decided too slowly.
    ev('C', 200_000, { type: 'app_open' }),
    ev('C', 275_000, { type: 'restaurant_selected', restaurantId: 'z', via: 'directions' }),
  ]
  const [c, b, a] = summarizeSessions(events) // newest first

  it('measures app open → first restaurant selected', () => {
    expect(a?.msToDecision).toBe(45_000)
    expect(a?.metGoal).toBe(true)
    expect(c?.msToDecision).toBe(75_000)
    expect(c?.metGoal).toBe(false)
  })

  it('reports no decision when none was made', () => {
    expect(b?.msToDecision).toBeNull()
    expect(b?.metGoal).toBeNull()
    expect(b?.rightNowUsed).toBe(true)
  })

  it('lets you subtract onboarding time', () => {
    expect(a?.onboardingMs).toBe(20_000)
    expect(a?.msToDecisionExcludingOnboarding).toBe(25_000)
  })

  it('counts bail-outs and filters', () => {
    expect(a?.bailOuts).toBe(1)
    expect(a?.filtersUsed).toBe(1)
  })

  it('computes the share of decided sessions within 60s', () => {
    expect(goalRate(summarizeSessions(events))).toBe(0.5)
    expect(goalRate([])).toBeNull()
  })

  it('formats durations', () => {
    expect(formatDuration(null)).toBe('–')
    expect(formatDuration(45_000)).toBe('45s')
    expect(formatDuration(125_000)).toBe('2m 05s')
  })
})
