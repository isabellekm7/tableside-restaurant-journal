import { Check, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Button, IconButton } from '../../components/ui/Button'
import { SelectField } from '../../components/ui/SelectField'
import { cx } from '../../lib/cx'
import { AGE_BANDS, type Child } from '../../data/types'
import { BAND_AGE_RANGE, BAND_LABEL, MAX_CHILDREN, agesForBand } from '../../lib/scoring/ageBands'
import {
  addDraft,
  canAddDraft,
  childrenFromDrafts,
  draftsFromChildren,
  isComplete,
  removeDraft,
  setAge,
  setBand,
  type Draft,
} from './draft'

export interface ChildProfileFormProps {
  initialChildren: readonly Child[]
  onSubmit: (children: Child[]) => void
  submitLabel: string
  /** Secondary actions shown under the submit button (skip, clear, …). */
  secondaryActions?: ReactNode
  /** Keep Save reachable while scrolling a tall list (inside a sheet). */
  stickyActions?: boolean
}

function BandPicker({ draft, label, onPick }: { draft: Draft; label: string; onPick: (band: (typeof AGE_BANDS)[number]) => void }) {
  return (
    <div role="radiogroup" aria-label={`${label} age group`} className="grid grid-cols-2 gap-2">
      {AGE_BANDS.map((band) => (
        <label key={band} className="relative block cursor-pointer">
          <input
            type="radio"
            name={`band-${draft.key}`}
            value={band}
            checked={draft.band === band}
            onChange={() => onPick(band)}
            className="peer sr-only"
          />
          <span
            className={
              'flex min-h-(--size-touch-lg) flex-col justify-center rounded-md border-2 border-line-strong bg-surface px-3 py-2 ' +
              'transition-colors duration-(--duration-fast) hover:bg-surface-sunken ' +
              'peer-checked:border-primary peer-checked:bg-primary-soft ' +
              'peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus'
            }
          >
            <span className="font-semibold">{BAND_LABEL[band]}</span>
            <span className="text-small text-text-muted">{BAND_AGE_RANGE[band]}</span>
          </span>
          <Check
            size={18}
            strokeWidth={3}
            aria-hidden="true"
            className="absolute top-2 right-2 hidden text-primary peer-checked:block"
          />
        </label>
      ))}
    </div>
  )
}

/**
 * "Who's eating?": 1-4 children, each by age group (fast path) with an optional
 * exact age. Shared by first-run onboarding and the header-chip editor.
 */
export function ChildProfileForm({ initialChildren, onSubmit, submitLabel, secondaryActions, stickyActions = false }: ChildProfileFormProps) {
  const [drafts, setDrafts] = useState<Draft[]>(() => draftsFromChildren(initialChildren))
  const formRef = useRef<HTMLFormElement>(null)
  const previousCount = useRef(drafts.length)
  const complete = isComplete(drafts)

  // After "Add another child", move focus to the new row so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (drafts.length > previousCount.current) {
      const newest = drafts[drafts.length - 1]
      formRef.current?.querySelector<HTMLInputElement>(`input[name="band-${newest?.key}"]`)?.focus()
    }
    previousCount.current = drafts.length
  }, [drafts])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (complete) onSubmit(childrenFromDrafts(drafts))
  }

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <ol className="flex flex-col gap-4">
        {drafts.map((draft, index) => {
          const label = `Child ${index + 1}`
          const ages = draft.band ? agesForBand(draft.band) : []
          return (
            <li key={draft.key} className="rounded-lg border border-line bg-surface p-4 shadow-card">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-sans text-body font-semibold">{label}</h3>
                {drafts.length > 1 && (
                  <IconButton
                    label={`Remove ${label.toLowerCase()}`}
                    icon={<Trash2 size={20} aria-hidden="true" />}
                    onClick={() => setDrafts((d) => removeDraft(d, draft.key))}
                    className="-my-2 -mr-2"
                  />
                )}
              </div>
              <BandPicker draft={draft} label={label} onPick={(band) => setDrafts((d) => setBand(d, draft.key, band))} />
              {ages.length > 1 && (
                <SelectField
                  className="mt-3"
                  label={`${label} exact age (optional)`}
                  value={draft.ageYears === null ? '' : String(draft.ageYears)}
                  onChange={(e) => setDrafts((d) => setAge(d, draft.key, e.target.value === '' ? null : Number(e.target.value)))}
                >
                  <option value="">Just the age group</option>
                  {ages.map((age) => (
                    <option key={age} value={age}>
                      {age} {age === 1 ? 'year' : 'years'}
                    </option>
                  ))}
                </SelectField>
              )}
            </li>
          )
        })}
      </ol>

      <Button
        variant="secondary"
        leadingIcon={<Plus size={18} aria-hidden="true" />}
        disabled={!canAddDraft(drafts)}
        onClick={() => setDrafts((d) => addDraft(d))}
      >
        {canAddDraft(drafts) ? 'Add another child' : `Up to ${MAX_CHILDREN} children`}
      </Button>

      <div
        className={cx(
          'flex flex-col gap-2',
          // Spans the sheet's full width and sits above its bottom safe-area padding.
          stickyActions &&
            'sticky bottom-0 z-10 -mx-5 -mb-5 border-t border-line bg-surface px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]',
        )}
      >
        {!complete && (
          <p id="profile-incomplete" className="text-small text-text-muted">
            Choose an age group for each child to continue.
          </p>
        )}
        <Button type="submit" size="lg" fullWidth disabled={!complete} aria-describedby={complete ? undefined : 'profile-incomplete'}>
          {submitLabel}
        </Button>
        {secondaryActions}
      </div>
    </form>
  )
}
