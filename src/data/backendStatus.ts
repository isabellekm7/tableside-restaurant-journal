/**
 * Remembers when the app silently fell back to on-device data, so /debug can say
 * "you are NOT really talking to the backend" instead of letting it go unnoticed.
 */
export interface FallbackIncident {
  at: string
  operation: string
  message: string
}

const MAX_INCIDENTS = 20
let incidents: FallbackIncident[] = []

export function recordFallback(operation: string, error: unknown, now: () => Date = () => new Date()): void {
  const message = error instanceof Error ? error.message : String(error)
  incidents = [{ at: now().toISOString(), operation, message }, ...incidents].slice(0, MAX_INCIDENTS)
}

export const getFallbackIncidents = (): FallbackIncident[] => [...incidents]
export const clearFallbackIncidents = (): void => {
  incidents = []
}
