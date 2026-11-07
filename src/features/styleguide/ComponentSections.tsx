import { Bookmark, Navigation, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Button, ButtonLink, IconButton } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Chip } from '../../components/ui/Chip'
import { ChoiceChips } from '../../components/ui/ChoiceChips'
import { Notice } from '../../components/ui/Notice'
import { FitBadge } from '../../components/ui/FitBadge'
import { SampleDataTag } from '../../components/ui/SampleDataTag'
import { WaitBadge } from '../../components/ui/WaitBadge'
import { Skeleton } from '../../components/ui/Skeleton'
import { StateMessage } from '../../components/ui/StateMessage'
import { TextField } from '../../components/ui/TextField'
import { FIT_LEVELS } from '../../lib/fit'
import { fitSolidClass } from '../../components/ui/fitStyles'
import { StyleguideSection, Subheading } from './StyleguideSection'

const DEMO_CHIPS = ['Open now', 'Under $$', 'Outdoor seating', 'Quiet'] as const

function ButtonsDemo() {
  return (
    <StyleguideSection id="buttons" title="Buttons" description="Minimum 44px tall; 52px for the primary action on a screen.">
      <Subheading>Variants</Subheading>
      <div className="flex flex-wrap items-center gap-3">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="accent" leadingIcon={<Navigation size={18} aria-hidden="true" />}>
          Accent
        </Button>
        <Button disabled>Disabled</Button>
      </div>
      <Subheading>Sizes</Subheading>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="md">Medium (44px)</Button>
        <Button size="lg">Large (52px)</Button>
      </div>
      <Subheading>Link and icon buttons</Subheading>
      <div className="flex flex-wrap items-center gap-3">
        <ButtonLink to="/">Link styled as button</ButtonLink>
        <IconButton label="Save restaurant" icon={<Bookmark size={22} aria-hidden="true" />} />
        <IconButton label="Refresh" icon={<RefreshCw size={22} aria-hidden="true" />} />
      </div>
      <Subheading>Full width (mobile primary action)</Subheading>
      <div className="max-w-sm">
        <Button size="lg" fullWidth>
          We need to eat soon
        </Button>
      </div>
    </StyleguideSection>
  )
}

function ChipsDemo() {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set(['Open now']))
  const toggle = (label: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  return (
    <StyleguideSection id="chips" title="Chips" description="Filter toggles. Selected state uses a check mark and a heavier border, not colour alone.">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Demo filters">
        {DEMO_CHIPS.map((label) => (
          <Chip key={label} selected={selected.has(label)} onClick={() => toggle(label)}>
            {label}
          </Chip>
        ))}
      </div>
    </StyleguideSection>
  )
}

function FitDemo() {
  return (
    <StyleguideSection
      id="fit"
      title="Kid-fit badges and pins"
      description="Always an icon plus words; the score number is optional. Pins reuse the solid colours with the number inside."
    >
      <Subheading>Badges · medium</Subheading>
      <div className="flex flex-wrap gap-3">
        {FIT_LEVELS.map((level) => (
          <FitBadge key={level} level={level} />
        ))}
      </div>
      <Subheading>Badges · small, with score and custom wording</Subheading>
      <div className="flex flex-wrap gap-3">
        <FitBadge size="sm" level="great" label="Great for toddlers" score={92} />
        <FitBadge size="sm" level="mixed" label="Mixed for infants" score={54} />
        <FitBadge size="sm" level="poor" label="Not for your 2-year-old" score={21} />
      </div>
      <Subheading>Wait badges (simulated in this prototype)</Subheading>
      <div className="flex flex-wrap gap-3">
        {([[0, 'short'], [10, 'short'], [20, 'moderate'], [45, 'long']] as const).map(([minutes, level]) => (
          <WaitBadge key={minutes} estimate={{ minutes, level, source: 'simulated', asOf: '2026-11-07T19:00:00Z' }} />
        ))}
      </div>
      <Subheading>Map pin style</Subheading>
      <div className="flex flex-wrap gap-3">
        {FIT_LEVELS.map((level, i) => (
          <span
            key={level}
            className={`flex size-10 items-center justify-center rounded-pill border-2 border-white text-small font-bold shadow-raised tabular-nums ${fitSolidClass[level]}`}
            role="img"
            aria-label={`Pin sample: ${level}`}
          >
            {level === 'unknown' ? '?' : 95 - i * 18}
          </span>
        ))}
      </div>
    </StyleguideSection>
  )
}

function CardsDemo() {
  const [selected, setSelected] = useState(false)
  return (
    <StyleguideSection id="cards" title="Cards" description="The container for restaurants, reasons and warnings.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card as="article" aria-labelledby="demo-card-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="demo-card-1" className="text-title">
                Juniper &amp; Pine Kitchen
              </h3>
              <p className="text-small text-text-muted">Neighbourhood Italian · $$ · 0.4 mi</p>
            </div>
            <FitBadge size="sm" level="great" score={91} />
          </div>
          <p className="mt-3 text-small">Good for toddlers: 4 high chairs, fast kitchen. Less ideal for infants: no changing table.</p>
          <p className="mt-3">
            <SampleDataTag />
          </p>
        </Card>
        <Card
          as="article"
          interactive
          selected={selected}
          onClick={() => setSelected((s) => !s)}
          aria-label="Selectable demo card"
          className="cursor-pointer"
        >
          <h3 className="text-title">Selectable card</h3>
          <p className="mt-1 text-small text-text-muted">
            Click to toggle the selected state used for list ↔ map sync. Selected: {selected ? 'yes' : 'no'}.
          </p>
        </Card>
      </div>
    </StyleguideSection>
  )
}

function NoticesDemo() {
  const [price, setPrice] = useState('any')
  return (
    <StyleguideSection id="notices" title="Notices and choice chips" description="Inline banners (always icon + words) and single-choice pills built on real radio inputs.">
      <div className="flex max-w-xl flex-col gap-3">
        <Notice>Showing a general family fit. Add your kids’ ages for a score that’s specific to them.</Notice>
        <Notice tone="warning" action={<Button variant="secondary">Clear filters</Button>}>
          No great fit nearby. The closest compromises are listed first.
        </Notice>
        <Notice tone="offline">You’re offline. Sample restaurants still work; the map may not load.</Notice>
      </div>
      <ChoiceChips
        legend="Price"
        value={price}
        onChange={setPrice}
        options={[
          { value: 'any', label: 'Any' },
          { value: '1', label: '$ or less' },
          { value: '2', label: '$$ or less' },
        ]}
      />
    </StyleguideSection>
  )
}

function LoadingDemo() {
  return (
    <StyleguideSection id="loading" title="Loading skeletons" description="Shimmer is disabled when reduced motion is requested.">
      <div role="status" aria-label="Loading restaurants" className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <Skeleton className="h-7 w-24 rounded-pill" />
            </div>
            <Skeleton className="mt-4 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-5/6" />
          </Card>
        ))}
        <span className="sr-only">Loading restaurants…</span>
      </div>
    </StyleguideSection>
  )
}

function FieldsDemo() {
  const [value, setValue] = useState('')
  return (
    <StyleguideSection id="fields" title="Form fields">
      <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
        <TextField
          label="Search a city"
          placeholder="Portland, OR"
          hint="Or use your location from the Explore screen."
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <TextField label="Child’s age" defaultValue="13" error="We support ages 0 to 12 for now." inputMode="numeric" />
      </div>
    </StyleguideSection>
  )
}

function StatesDemo() {
  return (
    <StyleguideSection id="states" title="Empty, error and offline states" description="Every dead end says what happened and offers a next step.">
      <div className="grid gap-4 md:grid-cols-3">
        <Card padding="none">
          <StateMessage kind="empty" title="No great fit nearby" action={<Button variant="secondary">Show closest compromise</Button>}>
            Nothing open right now suits all your kids. Here is the nearest compromise.
          </StateMessage>
        </Card>
        <Card padding="none">
          <StateMessage kind="error" title="Couldn’t load restaurants" action={<Button>Try again</Button>}>
            Something went wrong on our side. Your saved list is still available.
          </StateMessage>
        </Card>
        <Card padding="none">
          <StateMessage kind="offline" title="You’re offline" action={<ButtonLink to="/saved" variant="secondary">Open saved list</ButtonLink>}>
            Maps and live waits need a connection. Saved restaurants still work.
          </StateMessage>
        </Card>
      </div>
    </StyleguideSection>
  )
}

export function ComponentSections() {
  return (
    <>
      <ButtonsDemo />
      <ChipsDemo />
      <FitDemo />
      <CardsDemo />
      <NoticesDemo />
      <LoadingDemo />
      <FieldsDemo />
      <StatesDemo />
    </>
  )
}
