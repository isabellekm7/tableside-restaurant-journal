import { useCallback } from 'react'
import type { Child } from '../../data/types'
import { track } from '../../lib/analytics/logger'
import { useProfileStore } from '../../store/profileStore'

/** Saving or skipping the child profile, with the matching analytics events. */
export function useProfileActions() {
  const setChildren = useProfileStore((s) => s.setChildren)
  const skipOnboarding = useProfileStore((s) => s.skipOnboarding)

  /** Save from first-run onboarding (logs onboarding_completed the first time only). */
  const completeOnboarding = useCallback(
    (children: Child[], source: 'onboarding' | 'header') => {
      const firstTime = useProfileStore.getState().onboarding === 'pending'
      setChildren(children)
      track({
        type: 'children_set',
        source,
        bands: children.map((c) => c.band),
        ages: children.map((c) => c.ageYears ?? null),
      })
      if (firstTime) {
        track({
          type: 'onboarding_completed',
          childCount: children.length,
          bands: children.map((c) => c.band),
          exactAges: children.some((c) => c.ageYears !== undefined),
        })
      }
    },
    [setChildren],
  )

  const skip = useCallback(() => {
    if (useProfileStore.getState().onboarding === 'pending') track({ type: 'onboarding_skipped' })
    skipOnboarding()
  }, [skipOnboarding])

  return { saveChildren: completeOnboarding, skip }
}
