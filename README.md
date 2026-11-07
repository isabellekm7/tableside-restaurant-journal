# Tableside

A high-fidelity prototype that helps parents answer one question: **"Will this work for my kids, right now?"**
All restaurants are **fictional sample data**. Front end only for now; a Supabase back end comes later.

> Work in progress. Phases 1 (foundation), 2 (data and scoring) and 3 (onboarding and child profile) are complete. The full README (scoring, swapping the data source, known
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
| `src/data/seed/` | 28 **fictional** restaurants in Portland and Chicago |
| `src/lib/scoring/` | Pure kid-fit scoring; **all weights and thresholds are in `config.ts`** |

| `src/features/onboarding/` | "Who's eating?" form shared by first-run onboarding and the header-chip editor |
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

## Swapping the data source

The UI only imports from `src/data` (the `RestaurantRepository` interface and types). To use Supabase, implement that
interface and change the one line in `src/data/index.ts` that creates `repository`.

## Usability testing: `/debug`

Open `/debug` (not linked anywhere) to see recorded sessions, the **60-second metric** (app open to first
`restaurant_selected`, also shown excluding onboarding time), and to export the event log as JSON. Events stay on the
device (console + localStorage) and carry no names or free text. Use **Reset kids and onboarding** between participants
so the next person sees first-run onboarding. A "session" is one page load.
