import { useCallback, useEffect, useState } from 'react'
import { repository, type ParentFeedback } from '../../data'

/** The reports this device (or signed-in account) has submitted for one restaurant. */
export function useOwnFeedback(restaurantId: string): { own: ParentFeedback[]; add: (feedback: ParentFeedback) => void } {
  const [state, setState] = useState<{ forId: string; list: ParentFeedback[] }>({ forId: restaurantId, list: [] })

  useEffect(() => {
    let cancelled = false
    repository
      .listFeedback(restaurantId)
      .then((list) => {
        if (!cancelled) setState({ forId: restaurantId, list })
      })
      .catch(() => undefined) // having no history is fine
    return () => {
      cancelled = true
    }
  }, [restaurantId])

  const add = useCallback(
    (feedback: ParentFeedback) =>
      setState((s) => ({ forId: restaurantId, list: [...(s.forId === restaurantId ? s.list : []), feedback] })),
    [restaurantId],
  )

  return { own: state.forId === restaurantId ? state.list : [], add }
}
