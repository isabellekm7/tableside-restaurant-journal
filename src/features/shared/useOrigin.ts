import type { City, LatLng } from '../../data'
import { useDiscoveryStore } from '../../store/discoveryStore'

/** Where distances are measured from: the user's shared location, else the chosen city's centre. */
export function useOrigin(city: City | undefined): { point: LatLng | null; label: string } {
  const origin = useDiscoveryStore((s) => s.origin)
  if (origin.kind === 'geo') return { point: origin.point, label: 'your location' }
  return { point: city?.center ?? null, label: city ? `the centre of ${city.name}` : 'the city centre' }
}
