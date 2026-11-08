import { createMemoryStore, getBrowserStore, type KeyValueStore } from '../../data/keyValueStore'
import type { AppEvent, StoredEvent } from './events'

export const EVENTS_STORAGE_KEY = 'tableside.v1.events'
/** Oldest events are dropped beyond this, so storage can't grow without bound. */
export const MAX_STORED_EVENTS = 1000

export interface EventLoggerOptions {
  store?: KeyValueStore
  now?: () => number
  sessionId?: string
  /** Console sink. Pass a no-op in tests. */
  log?: (event: StoredEvent) => void
}

export interface EventLogger {
  track: (event: AppEvent) => StoredEvent
  getEvents: () => StoredEvent[]
  clear: () => void
  /** Pretty JSON of every stored event, for the /debug export. */
  exportJson: () => string
  readonly sessionId: string
  readonly openedAt: number
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

function isStoredEvent(v: unknown): v is StoredEvent {
  return (
    isRecord(v) &&
    typeof v.type === 'string' &&
    typeof v.id === 'number' &&
    typeof v.ts === 'number' &&
    typeof v.sessionId === 'string' &&
    typeof v.msSinceOpen === 'number'
  )
}

/**
 * Events are meant to be anonymous. This is a last line of defence: any text value that
 * looks like an email address (contains "@") is replaced before it is stored or logged,
 * so a future mistake can't leak one into the exportable log.
 */
export function redact<T extends AppEvent>(event: T): T {
  const clean = Object.fromEntries(
    Object.entries(event).map(([key, value]) => [key, typeof value === 'string' && value.includes('@') ? '[redacted]' : value]),
  )
  return clean as T
}

function makeSessionId(now: number): string {
  return `${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/** Local, privacy-respecting event log. Created once per page load. */
export function createEventLogger(options: EventLoggerOptions = {}): EventLogger {
  const store = options.store ?? createMemoryStore()
  const now = options.now ?? Date.now
  const openedAt = now()
  const sessionId = options.sessionId ?? makeSessionId(openedAt)
  const log = options.log ?? ((event: StoredEvent) => console.debug('[tableside]', event))

  const read = (): StoredEvent[] => {
    try {
      const raw = store.getItem(EVENTS_STORAGE_KEY)
      const parsed: unknown = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed.filter(isStoredEvent) : []
    } catch {
      return []
    }
  }

  const write = (events: StoredEvent[]): void => {
    try {
      store.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events))
    } catch {
      // Storage full or blocked: logging must never break the app.
    }
  }

  return {
    sessionId,
    openedAt,
    track(event) {
      const existing = read()
      const ts = now()
      const lastId = existing[existing.length - 1]?.id ?? 0
      const stored: StoredEvent = { ...redact(event), id: lastId + 1, ts, sessionId, msSinceOpen: ts - openedAt }
      write([...existing, stored].slice(-MAX_STORED_EVENTS))
      log(stored)
      return stored
    },
    getEvents: read,
    clear() {
      write([])
    },
    exportJson: () => JSON.stringify(read(), null, 2),
  }
}

/** The app-wide logger. */
export const logger: EventLogger = createEventLogger({ store: getBrowserStore() })

export const track = logger.track
