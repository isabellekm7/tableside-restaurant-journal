import { CircleCheck } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { ChoiceChips } from '../../components/ui/ChoiceChips'
import { Chip } from '../../components/ui/Chip'
import { Sheet } from '../../components/ui/Sheet'
import { AGE_BANDS, repository, type AgeBand, type HighChairAnswer, type NoiseLevel, type ParentFeedback, type WelcomeAnswer } from '../../data'
import { track } from '../../lib/analytics/logger'
import {
  REQUIRED_QUESTIONS,
  WAIT_CHOICES,
  answeredCount,
  bandsFromChildren,
  emptyDraft,
  isComplete,
  toNewFeedback,
  toggleBand,
  type FeedbackDraft,
} from '../../lib/feedback/form'
import { BAND_AGE_RANGE, BAND_LABEL } from '../../lib/scoring/ageBands'
import { useProfileStore } from '../../store/profileStore'

export interface FeedbackSheetProps {
  open: boolean
  onClose: () => void
  restaurantId: string
  restaurantName: string
  onSubmitted: (feedback: ParentFeedback) => void
}

const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
]

function FeedbackForm({ restaurantId, restaurantName, onClose, onSubmitted }: Omit<FeedbackSheetProps, 'open'>) {
  const children = useProfileStore((s) => s.children)
  const [draft, setDraft] = useState<FeedbackDraft>(() => emptyDraft(bandsFromChildren(children)))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const set = (patch: Partial<FeedbackDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const answered = answeredCount(draft)

  const submit = async () => {
    const feedback = toNewFeedback(restaurantId, draft)
    if (!feedback) return
    setPending(true)
    setError(null)
    try {
      const saved = await repository.addFeedback(feedback)
      track({ type: 'feedback_submitted', restaurantId })
      onSubmitted(saved)
      setDone(true)
    } catch {
      setError('We couldn’t save that just now. Please try again.')
    } finally {
      setPending(false)
    }
  }

  if (done) {
    const offline = typeof navigator !== 'undefined' && !navigator.onLine
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <span className="flex size-14 items-center justify-center rounded-pill bg-primary-soft text-primary">
          <CircleCheck size={28} aria-hidden="true" />
        </span>
        <p role="status" className="text-title">
          Thank you
        </p>
        <p className="text-text-muted">
          {offline
            ? 'You’re offline, so your report is saved on this device only.'
            : `Your report on ${restaurantName} is saved.`}{' '}
          Reports are kept for review and don’t change anyone’s scores yet.
        </p>
        <Button size="lg" fullWidth onClick={onClose}>
          Done
        </Button>
      </div>
    )
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
      className="flex flex-col gap-6"
    >
      <p className="-mt-2 text-text-muted">Takes about 20 seconds: tap one answer for each. No typing, no personal details.</p>

      <fieldset className="min-w-0">
        <legend className="mb-2 text-small font-semibold">Who was with you?</legend>
        <div className="flex flex-wrap gap-2">
          {AGE_BANDS.map((band: AgeBand) => (
            <Chip key={band} selected={draft.bands.includes(band)} onClick={() => set({ bands: toggleBand(draft.bands, band) })}>
              {BAND_LABEL[band]} <span className="font-normal text-text-muted">({BAND_AGE_RANGE[band]})</span>
            </Chip>
          ))}
        </div>
        <p className="mt-1 text-small text-text-muted">This lets scores become specific to each age.</p>
      </fieldset>

      <ChoiceChips
        legend="Did your child have a high chair?"
        value={draft.hadHighChair ?? ''}
        onChange={(v) => set({ hadHighChair: v as HighChairAnswer })}
        options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'notNeeded', label: 'Didn’t need one' }]}
      />
      <ChoiceChips
        legend="Were the staff welcoming?"
        value={draft.staffWelcoming ?? ''}
        onChange={(v) => set({ staffWelcoming: v as WelcomeAnswer })}
        options={[{ value: 'yes', label: 'Yes' }, { value: 'somewhat', label: 'Somewhat' }, { value: 'no', label: 'No' }]}
      />
      <ChoiceChips
        legend="How long did you wait?"
        value={draft.waitMinutes === null ? '' : String(draft.waitMinutes)}
        onChange={(v) => set({ waitMinutes: Number(v) })}
        options={WAIT_CHOICES.map((w) => ({ value: String(w.value), label: w.label }))}
      />
      <ChoiceChips
        legend="How was the noise?"
        value={draft.noise ?? ''}
        onChange={(v) => set({ noise: v as NoiseLevel })}
        options={[{ value: 'quiet', label: 'Quiet' }, { value: 'moderate', label: 'Moderate' }, { value: 'loud', label: 'Loud' }]}
      />
      <ChoiceChips
        legend="Would you go back with your kids?"
        value={draft.wouldReturn === null ? '' : draft.wouldReturn ? 'yes' : 'no'}
        onChange={(v) => set({ wouldReturn: v === 'yes' })}
        options={YES_NO}
      />

      <div className="rounded-lg border border-line bg-surface-sunken p-4">
        <p className="font-semibold">Not for us</p>
        <p className="mt-1 mb-3 text-small text-text-muted">
          Tap this if your family was made to feel unwelcome. It’s the most important signal we collect, and it’s optional.
        </p>
        <Chip selected={draft.notForUs} onClick={() => set({ notForUs: !draft.notForUs })}>
          We felt unwelcome here
        </Chip>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-small font-medium text-danger">
          {error}
        </p>
      )}

      <div className="sticky bottom-0 z-10 -mx-5 -mb-5 flex flex-col gap-2 border-t border-line bg-surface px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <p role="status" aria-live="polite" className="text-small text-text-muted">
          {answered} of {REQUIRED_QUESTIONS} answered
        </p>
        <Button type="submit" size="lg" fullWidth disabled={!isComplete(draft) || pending}>
          {pending ? 'Sending…' : 'Send report'}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

/** "How did it go?": a quick-tap report, tagged with the age bands of the children who were there. */
export function FeedbackSheet({ open, onClose, restaurantId, restaurantName, onSubmitted }: FeedbackSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={`How did it go at ${restaurantName}?`}>
      <FeedbackForm restaurantId={restaurantId} restaurantName={restaurantName} onClose={onClose} onSubmitted={onSubmitted} />
    </Sheet>
  )
}
