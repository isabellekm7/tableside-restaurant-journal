import type { ClockTime, Weekday } from '../../data/types'
import { WEEKDAYS } from '../../data/types'

export interface LocalParts {
  weekday: Weekday
  /** Minutes since local midnight. */
  minutes: number
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    formatters.set(timeZone, f)
  }
  return f
}

/** The weekday and clock time at `timeZone` for a given instant. */
export function localParts(at: Date, timeZone: string): LocalParts {
  const parts = formatterFor(timeZone).formatToParts(at)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const weekday = get('weekday').slice(0, 3).toLowerCase()
  const found = WEEKDAYS.find((d) => d === weekday)
  if (!found) throw new Error(`Could not read weekday for ${timeZone}`)
  return { weekday: found, minutes: Number(get('hour')) * 60 + Number(get('minute')) }
}

/** "17:30" → 1050. */
export function parseClock(time: ClockTime): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time)
  const h = Number(match?.[1])
  const m = Number(match?.[2])
  if (!match || h > 24 || m > 59) throw new Error(`Invalid time "${time}", expected HH:MM`)
  return h * 60 + m
}

/** 1050 → "5:30 pm". */
export function formatClock(time: ClockTime): string {
  const total = parseClock(time) % (24 * 60)
  const h24 = Math.floor(total / 60)
  const m = total % 60
  const suffix = h24 >= 12 ? 'pm' : 'am'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

export function previousDay(day: Weekday): Weekday {
  const i = WEEKDAYS.indexOf(day)
  return WEEKDAYS[(i + 6) % 7] ?? day
}
