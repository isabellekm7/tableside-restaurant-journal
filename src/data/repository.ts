import type {
  City,
  CityId,
  DietaryTag,
  LatLng,
  NewFeedback,
  ParentFeedback,
  PriceLevel,
  Restaurant,
  TripList,
  WaitEstimate,
} from './types'

/*
 * The data-access contract. UI code depends on THIS interface and the types in
 * ./types, never on the seed files. To move to Supabase or a places API,
 * write a class that implements RestaurantRepository and change the one line in
 * ./index.ts that creates the repository. Methods are async so a network
 * implementation needs no UI changes.
 */

export interface RestaurantQuery {
  cityId?: CityId
  /** Case-insensitive match on name, cuisine or neighbourhood. */
  text?: string
  maxPriceLevel?: PriceLevel
  /** Exact cuisine names (see listCuisines). Matches any. */
  cuisines?: readonly string[]
  /** Parents report these options. Requires all listed. Never a safety guarantee. */
  dietary?: readonly DietaryTag[]
  /** Only restaurants open at this instant, in their local time. */
  openAt?: Date
}

export interface NearbyOptions {
  cityId?: CityId
  limit?: number
  maxKm?: number
  openAt?: Date
}

export interface NearbyResult {
  restaurant: Restaurant
  distanceKm: number
}

/**
 * Source of wait estimates. The prototype ships a simulated provider; a real
 * integration (reservation or waitlist API) implements this and returns
 * `source: "live"`.
 */
export interface WaitProvider {
  getWait(restaurant: Restaurant, at: Date): Promise<WaitEstimate | null>
}

export interface RestaurantRepository {
  listCities(): Promise<City[]>
  listCuisines(cityId?: CityId): Promise<string[]>
  listRestaurants(query?: RestaurantQuery): Promise<Restaurant[]>
  getRestaurant(id: string): Promise<Restaurant | null>
  /** Nearest first. */
  findNearby(origin: LatLng, options?: NearbyOptions): Promise<NearbyResult[]>
  getWait(restaurantId: string, at?: Date): Promise<WaitEstimate | null>

  listFeedback(restaurantId: string): Promise<ParentFeedback[]>
  addFeedback(feedback: NewFeedback): Promise<ParentFeedback>

  listTripLists(): Promise<TripList[]>
  saveTripList(list: TripList): Promise<TripList>
  deleteTripList(id: string): Promise<void>
}
