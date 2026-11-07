# Tableside

A high-fidelity prototype that helps parents answer one question: **"Will this work for my kids, right now?"**
All restaurants are **fictional sample data**. Front end only for now; a Supabase back end comes later.

> Work in progress. Phase 1 (foundation) is complete. The full README (scoring, swapping the data source, known
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

Internal routes (not linked in the UI): `/styleguide`, `/debug`.

## Stack

React 19, TypeScript (strict), Vite, Tailwind CSS v4 (theme defined in `tokens.css`), React Router, Zustand,
Leaflet (planned), Vitest + Testing Library.
