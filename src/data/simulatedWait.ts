import { estimateWait } from '../lib/wait/estimateWait'
import type { WaitProvider } from './repository'
import type { City } from './types'

/** Prototype wait source. Clearly labelled "simulated" so the UI never presents it as live. */
export function createSimulatedWaitProvider(cities: readonly City[]): WaitProvider {
  return {
    getWait(restaurant, at) {
      const city = cities.find((c) => c.id === restaurant.cityId)
      if (!city) return Promise.resolve(null)
      return Promise.resolve(estimateWait(restaurant.waitProfile, city.timeZone, at, restaurant.id))
    },
  }
}
