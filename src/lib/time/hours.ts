import type { ClockTime, KidWindow, OpeningPeriod, Weekday } from '../../data/types'
import { localParts, parseClock, previousDay, type LocalParts } from './localTime'

interface DayWindow {
  days: readonly Weekday[]
  start: ClockTime
  end: ClockTime
}

/**
 * Whether a local time falls in a recurring window. A window whose end is at or
 * before its start runs past midnight into the next day.
 */
export function windowContains(window: DayWindow, local: LocalParts): boolean {
  const start = parseClock(window.start)
  const end = parseClock(window.end)
  if (end > start) return window.days.includes(local.weekday) && local.minutes >= start && local.minutes < end
  return (
    (window.days.includes(local.weekday) && local.minutes >= start) ||
    (window.days.includes(previousDay(local.weekday)) && local.minutes < end)
  )
}

export function isOpenAt(hours: readonly OpeningPeriod[], timeZone: string, at: Date): boolean {
  const local = localParts(at, timeZone)
  return hours.some((p) => windowContains({ days: p.days, start: p.open, end: p.close }, local))
}

/** The kid-friendly window active right now, if any. */
export function activeKidWindow(windows: readonly KidWindow[], timeZone: string, at: Date): KidWindow | null {
  const local = localParts(at, timeZone)
  return windows.find((w) => windowContains(w, local)) ?? null
}

/** The closing time ("21:00") of the period that's open right now, or null if closed. */
export function currentClosingTime(hours: readonly OpeningPeriod[], timeZone: string, at: Date): ClockTime | null {
  const local = localParts(at, timeZone)
  return hours.find((p) => windowContains({ days: p.days, start: p.open, end: p.close }, local))?.close ?? null
}

/** Minutes until the restaurant closes, or null if it's closed now. */
export function minutesUntilClose(hours: readonly OpeningPeriod[], timeZone: string, at: Date): number | null {
  const local = localParts(at, timeZone)
  for (const p of hours) {
    if (!windowContains({ days: p.days, start: p.open, end: p.close }, local)) continue
    const close = parseClock(p.close)
    const delta = close - local.minutes
    return delta > 0 ? delta : delta + 24 * 60
  }
  return null
}
