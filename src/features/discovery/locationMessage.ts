import type { City } from '../../data'
import type { LocationStatus } from './useUserLocation'

/** The sentence shown under the city box after "Near me" (null when nothing to say). */
export function locationMessage(status: LocationStatus, city: City): string | null {
  switch (status.kind) {
    case 'locating':
      return 'Finding you…'
    case 'ok':
      return `Showing places near you in ${status.city.name}.`
    case 'outside':
      return `You’re outside our sample cities, so we’re showing ${city.name} from its centre.`
    case 'denied':
      return `Location is off for this site, so distances are from the centre of ${city.name}. You can pick a city above.`
    case 'unavailable':
      return `We couldn’t find your location, so distances are from the centre of ${city.name}.`
    default:
      return null
  }
}
