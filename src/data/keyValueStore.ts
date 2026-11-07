/** The slice of the Web Storage API the repository needs. localStorage satisfies it. */
export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function createMemoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value)
    },
  }
}

/** localStorage when usable (it can throw in private windows), otherwise memory. */
export function getBrowserStore(): KeyValueStore {
  try {
    const probe = '__tableside_probe__'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return window.localStorage
  } catch {
    return createMemoryStore()
  }
}
