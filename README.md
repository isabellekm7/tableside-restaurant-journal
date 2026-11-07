# Tableside

A high-fidelity prototype that helps parents answer one question: **"Will this work for my kids, right now?"**
All restaurants are **fictional sample data**. Runs on bundled sample data, or on a Supabase back end when configured (see below).

> Work in progress. Phases 1 to 5 (foundation, data and scoring, onboarding, discovery, detail/bail-out/Right now) are complete, plus optional accounts. The full README (scoring, swapping the data source, known
> limitations) lands in Phase 7.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run test       # Vitest
npm run typecheck  # tsc -b
npm run build
```

## Where things are

| Path | What |
|---|---|
| `src/styles/tokens.css` | **Design tokens: the single source of truth** (colour, type, radius, shadow, motion, sizing) |
| `src/styles/contrastPairs.ts` | Colour pairs that must stay WCAG AA; enforced by a unit test |
| `src/components/ui/` | Core components (Button, Chip, FitBadge, Card, Skeleton, StateMessage, TextField…) |
| `src/components/layout/` | App shell, navigation, wordmark |
| `src/features/` | Feature modules (styleguide now; onboarding, discovery, etc. later) |
| `src/app/routes.tsx` | Route table |
| `src/data/types.ts` | Domain model (restaurant, kid-fit attributes, feedback, trip lists) |
| `src/data/repository.ts` | The data-access interface the UI depends on |
| `src/data/localRepository.ts` | Local implementation: bundled sample data + localStorage for user data |
| `src/data/supabase/` | Supabase implementation: config, defensive row parsers, repository |
| `src/data/resilientRepository.ts` | Backend first, device always (offline fallback and list sync) |
| `supabase/` | SQL migrations and the generated sample-data seed |
| `src/data/seed/` | 28 **fictional** restaurants in Portland and Chicago |
| `src/lib/scoring/` | Pure kid-fit scoring; **all weights and thresholds are in `config.ts`** |

| `src/features/onboarding/` | "Who's eating?" form shared by first-run onboarding and the header-chip editor |
| `src/features/discovery/` | Explore screen: ranked list, synced map, filters, city search, "near me" |
| `src/components/map/` | `MapView`: the only file that knows about Leaflet (props-only interface) |
| `src/lib/discovery/` | Pure ranking, filter and city-matching logic |
| `src/features/detail/` | Restaurant detail page, per-age breakdown, and the bail-out sheet |
| `src/features/rightNow/` | "We need to eat soon" mode |
| `src/features/account/` | Optional accounts: sign up, sign in, reset password |
| `src/store/` | Zustand stores (kids profile persisted to localStorage; transient UI state) |
| `src/lib/analytics/` | Local event logger and the 60-second metric |

Internal routes (not linked in the UI): `/styleguide`, `/debug`.

## Stack

React 19, TypeScript (strict), Vite, Tailwind CSS v4 (theme defined in `tokens.css`), React Router, Zustand,
Leaflet (planned), Vitest + Testing Library.

## Kid-fit scoring (short version)

`scoreRestaurant(restaurant, children[]) → { score, level, label, summary, reasons, warnings, perChild, drivingChildId }`

1. Each child is scored for their own age band by weighting the attributes the restaurant reports (unreported ones are skipped, never counted as "no").
2. Hard requirements cap a score (e.g. no high chairs for a toddler caps it at 40).
3. The family score is the **lowest** child score, and the summary names the child who drove it.
4. Only `attributes` and `parentSignals` are read, so paid placement cannot influence a score (a test enforces this).

Age bands are by completed years: infant under 1, toddler 1-2, preschool 3-5, school-age 6-12.

## Backend (Supabase)

The UI only imports from `src/data` (the `RestaurantRepository` interface and types), so the data source is one decision
in `src/data/index.ts`.

**Turn it on:** copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, then
restart `npm run dev`. Leave them blank to run on the bundled sample data only. Only the publishable key belongs in a
`VITE_` variable (it is designed for browsers); the app refuses an `sb_secret_` key. `.env.local` is git-ignored.

**Schema** (`supabase/migrations`, row-level security on every table, least-privilege grants):

| Table | Who can do what |
|---|---|
| `cities`, `restaurants`, `restaurant_attributes`, `restaurant_dietary` | Anyone can read. Nobody can write through the API. |
| `feedback` | Anyone can **insert** (validated by constraints). Nobody can read others' rows; signed-in users can read their own. |
| `trip_lists` | Private to each (anonymous) signed-in user. |

- **Feedback does not affect scores.** Reports are stored for review only. Without accounts or moderation, letting them
  move scores would be easy to game. The scorer still uses the catalog's `parentSignals`.
- **Accounts are optional** (`/account`): email + password sign-up, sign-in, forgot/reset password and sign-out. A signed-in
  user's trip lists sync to their account; everyone else's stay on the device. Passwords go straight to Supabase Auth and are
  never stored, logged or sent to analytics. Sign-up and reset responses never reveal whether an email already has an account.
- **Auth settings live in your Supabase dashboard, not in this repo.** If "Confirm email" is on, sign-up shows "check your
  email" with a resend button; if it's off, people are signed in immediately. Password-reset (and confirmation) links return to
  `/account`, so add your app's address (e.g. `http://localhost:5173/account` and your deployed URL) under Authentication, URL
  Configuration, Redirect URLs. Anonymous sign-ins are not needed.
- **Offline-first:** if the backend can't be reached, catalog reads fall back to the bundled data; feedback and lists are
  saved on the device first and pushed to the backend later. Library-level retries are off so offline users don't wait.
- **Sample data:** `npm run db:seed-sql` regenerates `supabase/seed.sql` from `src/data/seed`, so the database and the
  app can't drift. It is idempotent (upserts) and never touches feedback or lists.

**Known limitations:** the whole (small) catalog is fetched once and filtered in the browser; a list deleted while offline can
reappear from the backend; anonymous feedback can't be rate-limited without accounts.

## Usability testing: `/debug`

Open `/debug` (not linked anywhere) to see recorded sessions, the **60-second metric** (app open to first
`restaurant_selected`, also shown excluding onboarding time), and to export the event log as JSON. Events stay on the
device (console + localStorage) and carry no names or free text. Use **Reset kids and onboarding** between participants
so the next person sees first-run onboarding. A "session" is one page load.

## Discovery (Explore screen)

- **Ranking:** `rankRestaurants` scores each place for the family's kids, then sorts open places first, then by fit
  (places with "not enough info" last), then by distance. "Nearest first" is available under Filters.
- **Map and list stay in sync** through one `selectedId` in `store/discoveryStore.ts`. Phones show one at a time
  (List/Map toggle); wide screens show both. Pins are real buttons with the score inside, coloured by fit.
- **Filters:** open now, price, distance, cuisine and dietary options, all applied through the repository
  (distance is applied after ranking, from the chosen origin). Dietary results are always labelled "reported by parents,
  verify with the restaurant".
- **Location:** "Near me" picks the nearest sample city and measures distances from you. Outside the sample cities, or
  if location is denied or unavailable, the app falls back to the city centre. Coordinates are never stored or logged.
- **Only the chosen city persists.** Filters, search and location reset on reload so each test participant starts clean.
- **Map tiles** come from the public OpenStreetMap tile server with attribution, which is fine for a prototype but not for
  production traffic (use your own tile provider then). Tiles are not cached offline; the list works without them.

## Detail page, bail-out and "Right now"

- **Detail** (`/restaurant/:id`): the verdict in a sentence, then a per-child breakdown (every factor with an icon, the words,
  and how much it matters for that age; gaps show as "not reported"), honest "watch out for" items, quiet and busy times,
  each parent-confirmed fact with *how many parents* and *when last confirmed* (old reports are flagged), kid menu
  highlights, dietary options with a verify-with-the-restaurant note, photo placeholders, and directions.
- **"We're going here"** (and tapping Directions) logs `restaurant_selected`: the end of the 60-second metric.
- **Bail-out** ("This isn't working. Show the nearest quick alternative"): `lib/bailout/findAlternative.ts`. Distances are
  measured from the restaurant you're at. It offers the nearest place that is open, within a short trip, has a fast kitchen,
  a short wait and a good fit for every child. If none qualifies it offers the nearest decent option and says where it
  falls short; if nothing is close it says so rather than sending you on a long drive.
- **Right now** (`/right-now`): `lib/rightNow/recommend.ts`. Strict first (open with time to eat, short wait, close by, good
  fit), ranked by fit minus waiting and travelling. If nothing qualifies it shows the closest compromises with each one's
  shortfalls spelled out. All thresholds are in `DEFAULT_RIGHT_NOW_CONFIG`.
- **Waits are simulated.** They come from `repository.getWait()`, so a real source replaces them with no UI change, and every
  wait is labelled "(simulated)" on screen.
