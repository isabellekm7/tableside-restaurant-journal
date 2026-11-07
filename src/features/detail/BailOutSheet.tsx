import { Clock, Zap } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { FitBadge } from '../../components/ui/FitBadge'
import { Notice } from '../../components/ui/Notice'
import { Sheet } from '../../components/ui/Sheet'
import { Skeleton } from '../../components/ui/Skeleton'
import { WaitBadge } from '../../components/ui/WaitBadge'
import type { BailOutPick, BailOutShortfall } from '../../lib/bailout/findAlternative'
import { formatTravel } from '../../lib/geo/format'
import { formatClock } from '../../lib/time/localTime'
import type { Child, City, Restaurant } from '../../data'
import { useBailOut } from './useBailOut'

const SHORTFALL_TEXT: Record<BailOutShortfall, string> = {
  notFast: 'The kitchen isn’t known to be fast',
  wait: 'The wait may be longer than we’d like',
  fit: 'It’s not a great fit for your kids',
}

function Alternative({ pick, fromName }: { pick: BailOutPick; fromName: string }) {
  const { item, wait } = pick.candidate
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-title">{item.restaurant.name}</h3>
          <p className="text-small text-text-muted">
            {item.restaurant.cuisine} · {item.restaurant.neighborhood}
          </p>
        </div>
        <FitBadge size="sm" level={item.fit.level} score={item.fit.level === 'unknown' ? undefined : item.fit.score} className="shrink-0" />
      </div>
      <p className="text-small">{item.fit.summary}</p>
      <ul className="flex flex-wrap items-center gap-2 text-small" aria-label="Why it's a quick option">
        <li className="rounded-pill bg-primary-soft px-2.5 py-1 text-caption font-semibold text-primary">
          <span className="inline-flex items-center gap-1">
            <Zap size={14} aria-hidden="true" />
            {pick.fastKitchen ? 'Fast kitchen' : 'Kitchen speed unknown'}
          </span>
        </li>
        {wait && <li><WaitBadge estimate={wait} /></li>}
        <li className="inline-flex items-center gap-1 text-text-muted">
          <Clock size={14} aria-hidden="true" />
          {item.closesAt ? `Open until ${formatClock(item.closesAt)}` : 'Open now'}
        </li>
      </ul>
      <p className="text-small font-semibold">
        {formatTravel(item.travel)} from {fromName}
      </p>
      {pick.shortfalls.length > 0 && (
        <ul className="list-disc pl-5 text-small text-fit-mixed-fg">
          {pick.shortfalls.map((s) => (
            <li key={s}>{SHORTFALL_TEXT[s]}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export interface BailOutSheetProps {
  open: boolean
  onClose: () => void
  restaurant: Restaurant
  city: City
  children_: readonly Child[]
  /** The family chose this alternative. */
  onTake: (pick: BailOutPick) => void
}

function BailOutContent({ restaurant, city, kids, onClose, onTake }: { restaurant: Restaurant; city: City; kids: readonly Child[]; onClose: () => void; onTake: (pick: BailOutPick) => void }) {
  const { state, retry } = useBailOut({ restaurant, city, children: kids })
  const [index, setIndex] = useState(0)
  const fromName = restaurant.name
  const picks = state.status === 'ready' ? state.result.picks : []
  const pick = picks[index % Math.max(picks.length, 1)]

  return (
    <>
      {state.status === 'loading' && (
        <div role="status" aria-label="Finding an alternative" className="flex flex-col gap-3">
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <span className="sr-only">Finding the nearest quick alternative…</span>
        </div>
      )}

      {state.status === 'error' && (
        <div className="flex flex-col gap-3">
          <p role="alert">We couldn’t look for alternatives just now.</p>
          <Button onClick={retry}>Try again</Button>
        </div>
      )}

      {state.status === 'ready' && !pick && (
        <div className="flex flex-col gap-3">
          <p role="status">Nothing else nearby is open and suitable right now. You could stay put, or try a short ride.</p>
          <Button variant="secondary" onClick={onClose}>
            Back to {fromName}
          </Button>
        </div>
      )}

      {state.status === 'ready' && pick && (
        <div className="flex flex-col gap-4">
          {state.result.relaxed && <Notice tone="warning">No quick, well-suited place is close by. This is the nearest decent option.</Notice>}
          <Alternative pick={pick} fromName={fromName} />
          <div className="flex flex-col gap-2">
            <Button size="lg" fullWidth onClick={() => onTake(pick)}>
              Take me there
            </Button>
            {picks.length > 1 && (
              <Button variant="secondary" onClick={() => setIndex((i) => (i + 1) % picks.length)}>
                Show another option ({(index % picks.length) + 1} of {picks.length})
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              Stay here
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

/** "This isn't working": the nearest quick, well-suited alternative, with a way to see the next one. */
export function BailOutSheet({ open, onClose, restaurant, city, children_, onTake }: BailOutSheetProps) {
  // Sheet mounts its children only while open, so each opening runs the search fresh.
  return (
    <Sheet open={open} onClose={onClose} title="Nearest quick alternative">
      <BailOutContent restaurant={restaurant} city={city} kids={children_} onClose={onClose} onTake={onTake} />
    </Sheet>
  )
}
