import { WEEKDAYS, type ClockTime, type Weekday } from '../../data/types'
import { parseClock } from './localTime'

const SHORT: Record<Weekday, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** "Every day", "Weekdays", "Weekends", or compact runs like "Tue–Sun" / "Wed, Fri–Sun". */
export function formatDays(days: readonly Weekday[]): string {
  const set = new Set(days)
  const ordered = WEEKDAYS.filter((d) => set.has(d))
  if (ordered.length === 7) return 'Every day'
  if (ordered.length === 5 && ordered.every((d, i) => d === WEEKDAYS[i])) return 'Weekdays'
  if (ordered.length === 2 && ordered[0] === 'sat' && ordered[1] === 'sun') return 'Weekends'

  const runs: Weekday[][] = []
  for (const day of ordered) {
    const last = runs[runs.length - 1]
    const lastDay = last?.[last.length - 1]
    if (last && lastDay && WEEKDAYS.indexOf(day) === WEEKDAYS.indexOf(lastDay) + 1) last.push(day)
    else runs.push([day])
  }
  return runs
    .map((run) => {
      const first = run[0]
      const last = run[run.length - 1]
      if (!first || !last) return ''
      if (run.length >= 3) return `${SHORT[first]}–${SHORT[last]}`
      return run.map((d) => SHORT[d]).join(', ')
    })
    .join(', ')
}

function parts(time: ClockTime): { h: number; m: number; suffix: 'am' | 'pm' } {
  const total = parseClock(time) % (24 * 60)
  const hour = Math.floor(total / 60)
  return { h: hour % 12 === 0 ? 12 : hour % 12, m: total % 60, suffix: hour >= 12 ? 'pm' : 'am' }
}

const clock = (p: { h: number; m: number }) => (p.m === 0 ? `${p.h}` : `${p.h}:${String(p.m).padStart(2, '0')}`)

/** "8–9:30 am" when both ends share am/pm, otherwise "11:30 am – 1 pm". */
export function formatTimeRange(start: ClockTime, end: ClockTime): string {
  const a = parts(start)
  const b = parts(end)
  return a.suffix === b.suffix ? `${clock(a)}–${clock(b)} ${b.suffix}` : `${clock(a)} ${a.suffix} – ${clock(b)} ${b.suffix}`
}

function parseIsoDate(date: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date)
  if (!match) return null
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
}

export const STALE_AFTER_DAYS = 90

export interface ConfirmedInfo {
  /** "Oct 11, 2026" */
  label: string
  /** "today", "yesterday", "27 days ago", "4 months ago" */
  ago: string
  /** Older than ~3 months: worth double-checking. */
  stale: boolean
}

/** How recently a parent last confirmed something, in plain words. Dates are whole days (UTC). */
export function describeConfirmed(date: string, now: Date): ConfirmedInfo {
  const then = parseIsoDate(date)
  if (!then) return { label: date, ago: '', stale: false }
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const days = Math.max(0, Math.round((today - then.getTime()) / 86_400_000))
  const ago =
    days === 0 ? 'today' : days === 1 ? 'yesterday' : days < 60 ? `${days} days ago` : `${Math.round(days / 30)} months ago`
  return {
    label: `${MONTHS[then.getUTCMonth()]} ${then.getUTCDate()}, ${then.getUTCFullYear()}`,
    ago,
    stale: days > STALE_AFTER_DAYS,
  }
}
