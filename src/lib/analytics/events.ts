import type { AgeBand } from '../../data/types'

/**
 * Every event the prototype can record. Later phases call `track()` with these
 * shapes; adding an event means adding it here so the /debug export stays typed.
 *
 * Privacy: events stay on the device (console + localStorage). They contain no
 * names, no precise location, and no free text: only age bands/ages the parent
 * chose, restaurant ids, and filter choices.
 */
export type AppEvent =
  | { type: 'app_open' }
  | { type: 'onboarding_completed'; childCount: number; bands: AgeBand[]; exactAges: boolean }
  | { type: 'onboarding_skipped' }
  | { type: 'children_set'; source: 'onboarding' | 'header'; bands: AgeBand[]; ages: Array<number | null> }
  | { type: 'filter_used'; filter: string; value: string | number | boolean }
  | { type: 'right_now_used' }
  | { type: 'restaurant_viewed'; restaurantId: string }
  /** The 60-second metric ends here: the parent committed to a place. */
  | { type: 'restaurant_selected'; restaurantId: string; via: 'going_here' | 'directions' }
  | { type: 'bail_out_used'; fromRestaurantId: string; toRestaurantId: string | null }
  | { type: 'feedback_submitted'; restaurantId: string }
  | { type: 'list_saved'; restaurantId: string }

export type AppEventType = AppEvent['type']

/** An event as stored, with the context added by the logger. */
export type StoredEvent = AppEvent & {
  /** Increasing counter, stable within a device. */
  id: number
  /** Epoch milliseconds. */
  ts: number
  /** One per page load (a "session" for the 60-second metric). */
  sessionId: string
  /** Milliseconds since this page load began, i.e. since "app open". */
  msSinceOpen: number
}
