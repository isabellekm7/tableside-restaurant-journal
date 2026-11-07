import { useEffect } from 'react'

/** Sets document.title so screen readers announce route changes. */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = title === 'Tableside' ? title : `${title} · Tableside`
  }, [title])
}
