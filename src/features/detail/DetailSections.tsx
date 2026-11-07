import { CircleCheck, CircleHelp, CircleX, ImageIcon, Minus, TriangleAlert, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card } from '../../components/ui/Card'
import { FitBadge } from '../../components/ui/FitBadge'
import { WaitBadge } from '../../components/ui/WaitBadge'
import { ATTRIBUTE_LABELS, DIETARY_DISCLAIMER, DIETARY_LABELS, type City, type KidAttributes, type Restaurant, type WaitEstimate } from '../../data'
import { cx } from '../../lib/cx'
import type { ChildFit, KidFitResult } from '../../lib/scoring'
import { breakdownForBand, formatAttributeValue, type BreakdownRow, type BreakdownStatus } from '../../lib/scoring/breakdown'
import { activeKidWindow } from '../../lib/time/hours'
import { describeConfirmed, formatDays, formatTimeRange } from '../../lib/time/format'
import { ATTRIBUTE_GROUPS } from './attributeGroups'

export function Section({ id, title, children, note }: { id: string; title: string; children: ReactNode; note?: string }) {
  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3">
      <h2 id={`${id}-title`} className="text-title">
        {title}
      </h2>
      {note && <p className="-mt-1 text-small text-text-muted">{note}</p>}
      {children}
    </section>
  )
}

// ───────────── Kid-fit breakdown by age ─────────────

const STATUS: Record<BreakdownStatus, { icon: ReactNode; word: string; tone: string }> = {
  good: { icon: <CircleCheck size={18} aria-hidden="true" />, word: 'Works', tone: 'text-fit-great-fg' },
  okay: { icon: <Minus size={18} aria-hidden="true" />, word: 'So-so', tone: 'text-fit-mixed-fg' },
  poor: { icon: <CircleX size={18} aria-hidden="true" />, word: 'Doesn’t work', tone: 'text-fit-poor-fg' },
  unknown: { icon: <CircleHelp size={18} aria-hidden="true" />, word: 'Not reported', tone: 'text-text-subtle' },
}
const MATTERS = { high: 'Matters a lot', medium: 'Matters', low: 'Matters a little' } as const

function BreakdownList({ rows }: { rows: readonly BreakdownRow[] }) {
  return (
    <ul className="divide-y divide-line">
      {rows.map((row) => {
        const status = STATUS[row.status]
        return (
          <li key={row.key} className="flex items-start gap-3 py-2.5">
            <span className={cx('mt-0.5 flex shrink-0 items-center gap-1', status.tone)}>
              {status.icon}
              <span className="sr-only">{status.word}:</span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {row.label}
                {row.value && <span className="font-normal text-text-muted"> · {row.value}</span>}
              </p>
              <p className="text-small text-text-muted">
                {row.phrase ? `${row.phrase.charAt(0).toUpperCase()}${row.phrase.slice(1)}. ` : ''}
                {row.status === 'unknown' ? 'Parents haven’t reported this yet. ' : ''}
                {MATTERS[row.importance]} for this age.
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** One expandable breakdown per child, with the child who set the score open first. */
export function FitBreakdown({ restaurant, fit }: { restaurant: Restaurant; fit: KidFitResult }) {
  if (fit.perChild.length === 0) {
    return (
      <Card>
        <p className="mb-2 text-small text-text-muted">Showing a general family fit. Add your kids’ ages for a breakdown that’s specific to them.</p>
        <BreakdownList rows={breakdownForBand(restaurant.attributes, 'generic')} />
      </Card>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      {fit.perChild.map((child: ChildFit) => (
        <Card key={child.childId} padding="none">
          <details open={child.childId === fit.drivingChildId || fit.perChild.length === 1} className="group">
            <summary className="flex min-h-(--size-touch) cursor-pointer list-none flex-wrap items-center justify-between gap-2 p-4">
              <span className="font-semibold">
                {`Your ${child.description}`}
                {child.childId === fit.drivingChildId && fit.perChild.length > 1 && (
                  <span className="ml-2 text-small font-normal text-text-muted">(sets the score)</span>
                )}
              </span>
              <FitBadge size="sm" level={child.level} score={child.level === 'unknown' ? undefined : child.score} />
            </summary>
            <div className="border-t border-line px-4 pb-3">
              <p className="py-3 text-small">{child.summary}</p>
              <BreakdownList rows={breakdownForBand(restaurant.attributes, child.band)} />
            </div>
          </details>
        </Card>
      ))}
    </div>
  )
}

// ───────────── Honest downsides ─────────────

export function WatchOuts({ items, forFamily }: { items: readonly string[]; forFamily: readonly string[] }) {
  if (items.length === 0 && forFamily.length === 0) return <p className="text-text-muted">Parents haven’t flagged anything.</p>
  const list = (texts: readonly string[]) => (
    <ul className="flex flex-col gap-2">
      {texts.map((text) => (
        <li key={text} className="flex items-start gap-2 rounded-md bg-fit-mixed-bg px-3 py-2 text-small font-medium text-fit-mixed-fg">
          <TriangleAlert size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
          {text.charAt(0).toUpperCase() + text.slice(1)}
        </li>
      ))}
    </ul>
  )
  return (
    <div className="flex flex-col gap-4">
      {forFamily.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-sans text-small font-semibold text-text-muted">For your family</h3>
          {list(forFamily)}
        </div>
      )}
      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-sans text-small font-semibold text-text-muted">Parents flag</h3>
          {list(items)}
        </div>
      )}
    </div>
  )
}

// ───────────── Hours, quiet times and waits ─────────────

export function HoursAndWaits({ restaurant, city, wait, now }: { restaurant: Restaurant; city: City; wait: WaitEstimate | null; now: Date }) {
  const quietNow = activeKidWindow(restaurant.kidWindows, city.timeZone, now)
  return (
    <div className="flex flex-col gap-4">
      {wait && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-small font-semibold">Right now:</span>
          <WaitBadge estimate={wait} />
        </div>
      )}

      <div>
        <h3 className="font-sans text-body font-semibold">Quietest, kid-friendliest times</h3>
        {restaurant.kidWindows.length === 0 ? (
          <p className="text-small text-text-muted">No kid-friendly window reported.</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1">
            {restaurant.kidWindows.map((w) => (
              <li key={`${w.start}-${w.note}`} className="text-small">
                <strong>{formatTimeRange(w.start, w.end)}</strong>, {formatDays(w.days).toLowerCase()}. <span className="text-text-muted">{w.note}</span>
                {quietNow === w && <span className="ml-2 rounded-pill bg-fit-great-bg px-2 py-0.5 text-caption font-semibold text-fit-great-fg">Now</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {restaurant.waitProfile.peaks.length > 0 && (
        <div>
          <h3 className="font-sans text-body font-semibold">Busiest times</h3>
          <ul className="mt-1 flex flex-col gap-1 text-small">
            {restaurant.waitProfile.peaks.map((p) => (
              <li key={`${p.start}-${p.extraMinutes}-${p.days.join()}`}>
                <strong>{formatTimeRange(p.start, p.end)}</strong>, {formatDays(p.days).toLowerCase()}.{' '}
                <span className="text-text-muted">About {p.extraMinutes} min longer than usual (simulated).</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="font-sans text-body font-semibold">Opening hours</h3>
        <ul className="mt-1 flex flex-col gap-1 text-small">
          {restaurant.hours.map((h) => (
            <li key={`${h.open}-${h.days.join()}`}>
              <strong>{formatDays(h.days)}</strong>: {formatTimeRange(h.open, h.close)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ───────────── Parent-confirmed facts with provenance ─────────────

export function ConfirmedFacts({ attributes, now }: { attributes: Partial<KidAttributes>; now: Date }) {
  return (
    <div className="flex flex-col gap-4">
      {ATTRIBUTE_GROUPS.map((group) => (
        <Card key={group.title} padding="none">
          <h3 className="border-b border-line px-4 py-3 font-sans text-small font-semibold tracking-wide text-text-muted uppercase">{group.title}</h3>
          <dl className="divide-y divide-line">
            {group.keys.map((key) => {
              const attribute = attributes[key]
              const confirmed = attribute ? describeConfirmed(attribute.lastConfirmedAt, now) : null
              return (
                <div key={key} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 px-4 py-2.5">
                  <dt className="font-medium">{ATTRIBUTE_LABELS[key]}</dt>
                  <dd className="text-right font-semibold">{attribute ? formatAttributeValue(attribute.value) : <span className="font-normal text-text-subtle">Not reported yet</span>}</dd>
                  {attribute && confirmed && (
                    <dd className="col-span-2 text-caption text-text-muted">
                      {attribute.confirmationCount} {attribute.confirmationCount === 1 ? 'parent' : 'parents'} · last confirmed {confirmed.label} ({confirmed.ago})
                      {confirmed.stale && <span className="ml-1 font-semibold text-fit-mixed-fg">Older report: worth double-checking</span>}
                    </dd>
                  )}
                </div>
              )
            })}
          </dl>
        </Card>
      ))}
    </div>
  )
}

// ───────────── Menu, dietary, parent reports, photos ─────────────

export function MenuAndDietary({ restaurant }: { restaurant: Restaurant }) {
  const tags = Object.entries(restaurant.dietary).filter(([, a]) => a?.value === true).map(([tag]) => tag as keyof typeof DIETARY_LABELS)
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-2">
        {restaurant.menuHighlights.map((item) => (
          <li key={item} className="rounded-pill border border-line bg-surface px-3 py-1.5 text-small">
            {item}
          </li>
        ))}
      </ul>
      {tags.length > 0 && (
        <p className="text-small">
          <span className="font-semibold">Parents report: </span>
          {tags.map((t) => DIETARY_LABELS[t].toLowerCase()).join(', ')}. <span className="text-text-muted">{DIETARY_DISCLAIMER}</span>
        </p>
      )}
    </div>
  )
}

export function ParentReports({ restaurant }: { restaurant: Restaurant }) {
  const { reportCount, wouldReturnCount, notForUsCount } = restaurant.parentSignals
  if (reportCount < 5) {
    return <p className="text-small text-text-muted">Only {reportCount} parent {reportCount === 1 ? 'report' : 'reports'} so far, so we can’t say much yet.</p>
  }
  const pct = Math.round((wouldReturnCount / reportCount) * 100)
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-small">
      <Users size={16} aria-hidden="true" className="text-text-muted" />
      <span>
        <strong>{reportCount} parents</strong> reported · <strong>{pct}%</strong> would return with kids ·{' '}
        <strong className={notForUsCount > 0 ? 'text-fit-poor-fg' : undefined}>{notForUsCount}</strong> said they felt unwelcome.
      </span>
      <span className="text-text-muted">(Sample counts.)</span>
    </p>
  )
}

export function PhotoPlaceholders({ name }: { name: string }) {
  return (
    <div>
      <ul className="grid grid-cols-3 gap-2" aria-label={`Photo placeholders for ${name}`}>
        {['Front', 'Inside', 'Menu'].map((label) => (
          <li key={label} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md bg-surface-sunken text-text-subtle">
            <ImageIcon size={24} aria-hidden="true" />
            <span className="text-caption">{label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-caption text-text-subtle">Photo placeholders. Parent photos aren’t part of this prototype.</p>
    </div>
  )
}

