# Tableside

A high-fidelity, working prototype that helps parents answer one question: **"Will this work for my kids, right now?"**

It scores every restaurant for the specific ages of *your* children, explains the score in a sentence, shows what's open and
quick right now, and offers an escape hatch ("This isn't working. Show the nearest quick alternative") for when a meal goes badly.

> **Every restaurant in this prototype is fictional sample data**, clearly labelled on screen. Waits are simulated and
> labelled as such. Nothing here should be mistaken for real listings.

**Success criterion:** a parent can decide where to eat in **under 60 seconds** and trust the answer. The app measures this
(see [Running usability tests](#running-usability-tests)).

---

## Quick start

Requires a current Node (20.19+ or 22+).

```bash
npm install
npm run dev          # http://localhost:5173
```

It runs fully on the bundled sample data with no setup. To use a Supabase backend as well, see [Backend](#backend-supabase).

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm test` | All tests (unit, component, accessibility audits) |
| `npm run typecheck` | Strict TypeScript |
| `npm run lint` | Lint (`oxlint`) |
| `npm run build` | Production build, including the offline service worker |
| `npm run preview` | Serve the production build (needed to try offline mode) |
| `npm run db:seed-sql` | Regenerate `supabase/seed.sql` from the sample data |

**Internal pages** (not linked from the UI): `/styleguide` (design tokens and components, rendered from the real source) and
`/debug` (usability-test results and backend status).

---

## What's in it

| Brief | Where |
|---|---|
| **A. Child profile and age filter** | First-run "Who's eating?" (1-4 kids, by age band or exact age, skippable), and a persistent header chip like "2 kids: 2y, 5y" to edit any time. |
| **B. Discovery: map + list** | `/` Ranked list and a synced Leaflet map (pins show the score), filters (open now, price, distance, cuisine, dietary), city search and "Near me" with graceful fallbacks. |
| **C. "Right now" mode** | `/right-now`, reached from the prominent "We need to eat soon" button. Open, close, short wait, good fit; falls back to honest compromises. |
| **D. Restaurant detail** | `/restaurant/:id` Per-age breakdown, parent-confirmed facts with "last confirmed", watch-outs, quiet times, directions, and the **bail-out** button. |
| **E. Parent-verified feedback** | "Been here? Share how it went": six quick taps plus an optional **Not for us**, tagged by the reporter's child age bands. |
| **F. Saved lists** | `/saved` Trip lists that work offline, a shareable link, and a print view. |
| **Instrumentation** | Local event log and the 60-second metric at `/debug`. |
| **Beyond the brief** | Optional accounts (`/account`) so lists sync across devices. |

**Explicitly out of scope** (per the brief): payments, reservations, paid listings. **Design principle:** no paid placement may
ever influence scores or badges. The scorer reads only `attributes` and `parentSignals`, so commercial metadata can't reach it,
and a test checks that a "sponsored" listing scores identically to an organic one.

---

## How kid-fit scoring works

`scoreRestaurant(restaurant, children[]) → { score, level, label, summary, reasons, warnings, perChild, drivingChildId }`
in `src/lib/scoring/` (pure, unit-tested). **Every weight, threshold and cap lives in one file:
[`src/lib/scoring/config.ts`](src/lib/scoring/config.ts)**, so the product's opinion is easy to tweak.

1. **Each child is scored for their own age band** (infant, toddler, preschool, school-age). Each band weights the attributes
   differently: an infant cares about a changing table and stroller room; a toddler about high chairs and a fast kitchen; a
   preschooler about a kids' menu and booster seats; a school-age child about menu variety and outdoor space.
2. **Unreported attributes are skipped, not counted as "no".** If too little is reported (under half of what matters for that
   band) the result is **"Not enough info"** and no number is shown.
3. **Hard requirements cap a score.** No high chairs caps a toddler at 40; no changing table caps an infant at 64; staff who
   may not welcome families cap *every* band at 40; and if enough parents say they felt unwelcome ("Not for us") the score is
   capped at 50.
4. **The family score is the strictest child's score**, and the summary names who held it back:
   *"Held back by your 2-year-old: no high chairs. Works well for your 5-year-old."* Per-child badges show the split.
5. **Noise is judged per age**: a loud room suits a toddler (nobody notices) and is bad for an infant.
6. **Always explainable in a sentence**, with no black-box numbers.

Levels: **great** ≥ 80, **good** ≥ 65, **mixed** ≥ 45, otherwise **poor**.

---

## Data and the repository seam

UI code never imports the sample data or Supabase directly. It uses one interface, `RestaurantRepository`
([`src/data/repository.ts`](src/data/repository.ts)), and the domain types in `src/data/types.ts`.

- **28 fictional restaurants** in Portland and Chicago ([`src/data/seed/`](src/data/seed)), deliberately varied: great for
  toddlers but poor for infants (and the reverse), great for school-age kids but loud, good restaurants that merely tolerate
  kids, clear bad fits, and new listings with too little data. Coordinates are placed in real neighbourhoods, so a pin may sit
  near a real business; addresses are deliberately vague.
- **To swap the data source** (a places API, another backend): write a class that implements `RestaurantRepository` and change
  the one place it's chosen, [`src/data/index.ts`](src/data/index.ts). Methods are async, so a network source needs no UI changes.
- **Waits** come from `repository.getWait()` via a `WaitProvider`. The prototype ships a simulated provider; a real waitlist
  integration implements the same interface and returns `source: "live"`.

### Backend (Supabase)

Optional. Copy `.env.example` to `.env.local` (git-ignored) and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`,
then restart the dev server. Only the **publishable** key belongs in a `VITE_` variable; the app refuses a secret key.

The schema is in [`supabase/migrations`](supabase/migrations); row-level security is on for every table:

| Table | Who can do what |
|---|---|
| `cities`, `restaurants`, `restaurant_attributes`, `restaurant_dietary` | Anyone can read; nobody can write through the API |
| `feedback` | Anyone can **insert** (validated by constraints); nobody can read others' rows |
| `trip_lists` | Private to each signed-in user |

- **Check it's really connected:** open `/debug` and press **Run connection check**. It counts rows with read-only requests (no
  account, no writes) and lists any time the app silently fell back to on-device data.
- **Offline-first:** if the backend is unreachable the app falls back to the bundled data; feedback and lists are saved on the
  device first and lists sync later.
- **Sample data in the database** is generated from the TypeScript sample data (`npm run db:seed-sql`), so the two can't drift.
- **Auth settings live in your Supabase dashboard**, not this repo. Password-reset links return to `/account`, so add your app's
  address (e.g. `http://localhost:5173/account` and your deployed URL) under Authentication, URL Configuration, Redirect URLs.
  Whether "Confirm email" is on is your choice: the sign-up screen handles both.

---

## Running usability tests

**The 60-second metric** is the time from **app open** to the first **`restaurant_selected`** event: the parent tapping
**"We're going here"** or **Directions** (including from Right now, or after a bail-out). It is recorded per **session = one page load**.

Events are recorded on the device only (console + localStorage), contain no names, free text or coordinates, and any text that
looks like an email address is redacted before storage. They include: `app_open`, onboarding completed/skipped, children set
(age bands and ages only), filters used (never what was typed), `right_now_used`, `restaurant_viewed`, `restaurant_selected`,
`bail_out_used`, `feedback_submitted`, `list_saved`, `location_requested` (outcome only).

**At `/debug`** you'll find per-session time to decision, the same time **excluding onboarding**, whether it met 60 s,
bail-out and Right now usage, **Export JSON** / **Copy JSON**, and **Reset kids and onboarding**.

A suggested session:

1. Open `/debug`, press **Reset kids and onboarding**, then open `/` in a fresh tab (this starts the clock).
2. Give the scenario: *"You're in an unfamiliar city with a 2-year-old and a 5-year-old, you're hungry now. Pick a place."*
3. Don't coach. Note hesitation, what they tap first, and whether they trust the answer ("Why did it say that?").
4. Afterwards, check `/debug` and export the JSON. Don't reload mid-task: a reload starts a new session and a new clock.
5. For the bail-out, ask them to pretend the place isn't working out and see whether they find the button.

---

## Quality

- **Strict TypeScript, no `any`.** The few lint suppressions are documented where they occur.
- **Tests** (`npm test`): the pure scoring/ranking logic, the data layer, the Supabase layer (against a mocked network), every
  screen and flow, and the guarantees below.
- **Accessibility:** every screen and sheet is audited with axe-core in the test suite. A reusable **in-browser audit**
  ([`scripts/browser-audit.js`](scripts/browser-audit.js)) also measures what jsdom can't: real colour contrast, touch targets
  under 44 px, and horizontal overflow. Run it in the browser console with the dev server going:
  `const { auditRoutes } = await import('/scripts/browser-audit.js'); console.table(await auditRoutes(['/', '/right-now', '/saved']))`.
- **Colour contrast is a build-time guarantee:** the colour pairs the UI uses are listed in `src/styles/contrastPairs.ts` and
  checked against WCAG AA by a unit test, so editing a colour token that breaks contrast fails the tests.
- **Reduced motion** is honoured globally (animations and transitions collapse), and a test fails if anyone adds a looping
  animation or press-scale effect without `motion-safe:`.
- **Touch targets** are at least 44 px (52 px for primary actions); focus rings are 3 px on every keyboard-focused element;
  sheets trap focus, close on Esc, and return focus to the button that opened them.
- **States everywhere:** loading skeletons, empty results ("No great fit nearby. Here's the closest compromise."), errors with a
  retry, and a global offline banner that says what still works.
- **Performance:** the map (Leaflet), the styleguide and `/debug` are loaded on demand.

### Design tokens

[`src/styles/tokens.css`](src/styles/tokens.css) is the single source of truth for colour, type, radius, shadow, motion and sizing
(Tailwind v4 reads it directly). **Edit values there and everything, including `/styleguide`, updates.** The palette is a warm
cream with pine green and clay accents; headings use Fraunces and the interface uses Inter, both self-hosted. There is a light
theme only; the tokens are structured so a dark theme could be added by overriding the semantic colours.

### Offline

A service worker (production builds only) precaches the app, so every screen opens with no connection and saved lists keep
working. To try it: `npm run build && npm run preview`, open the app once, stop the server, and reload. Map tiles aren't cached,
and the map shows a notice when they can't load.

---

## Project structure

```
src/
  app/            Route table, and the cross-cutting tests (accessibility audit, quality guarantees)
  components/     ui/ (Button, Chip, FitBadge, Sheet, …), layout/ (shell, nav), map/ (Leaflet wrapper)
  features/       discovery, detail, rightNow, onboarding, profile, feedback, saved, account, debug, styleguide
  lib/            scoring/, discovery/ (ranking), rightNow/, bailout/, feedback/, trips/, share/, geo/, time/, analytics/, tokens/
  data/           types, repository interface, local + Supabase implementations, seed data, auth
  store/          Zustand stores (profile, discovery, trips, auth, UI)
  styles/         tokens.css, base.css, map.css
supabase/         SQL migrations and the generated seed
scripts/          seed generator, in-browser audit
```

---

## Known limitations

- **No real data.** All restaurants, hours, counts and "last confirmed" dates are invented. Waits are simulated.
- **Map tiles** use the public OpenStreetMap server, fine for a prototype but not production traffic. They aren't available offline.
- **Feedback can't be moderated or rate-limited** (there is no admin tooling, and accounts are optional), which is why it never
  changes anyone's scores. A report made offline stays on that device.
- **A list deleted while offline can reappear** from the backend when you reconnect.
- **The catalog is fetched whole and filtered in the browser.** Fine for dozens of places; a large catalog needs server-side
  filtering (the repository interface already allows it).
- **US-style only:** miles, US time zones, English.
- **Home-screen icon** is the SVG logo only (iOS wants a PNG).
- **Light theme only.** No photos (placeholders are labelled). No real reservations, payments, or paid listings.

---

## Assumptions to validate with real parents

This is a hypothesis-stage prototype, and the persona is not validated. These choices matter most for trust and accuracy:

1. **Age bands are by completed years** (infant under 1, toddler 1-2, preschool 3-5, school-age 6-12). The brief's ranges overlapped
   at 1 and 3. *Do parents think of their 2-year-old as a "toddler"?*
2. **The family score is the strictest child's.** This can hide good news ("great for the 5-year-old") behind one hard need, so
   per-child badges are shown. *Do parents read the "held back by your 2-year-old" explanation, and do they trust it?*
3. **Is a number helpful, or is the word enough?** Scores show as "Great fit · 85". *Does the number add trust or false precision?*
4. **The weights and caps in `scoring/config.ts` are opinions**, not research. *Which factors do parents actually care about at each age?*
5. **Fabricated confirmation counts look precise.** "31 parents, last confirmed 27 days ago" is sample data but reads as fact.
   Participants may over-trust it. Consider telling them before the test.
6. **"Right now" thresholds are guesses:** a wait under 15 minutes is "short", a trip under 15 minutes is "close", and at least 45
   minutes before closing. *What do hungry parents consider acceptable?*
7. **Bail-out thresholds are guesses:** a "quick" alternative has a fast kitchen, a wait under 10 minutes, and is within a
   20-minute trip. *Is the bail-out button discoverable and credible in the moment?*
8. **Open places sort first**, even if a closed place fits better. This favours "eat now" over planning ahead.
9. **Dietary information is only ever "reported by parents, verify with the restaurant"**, never "safe". *Is that enough, or too weak to be useful?*
10. **"Not for us"** is optional and prominent, and caps scores when enough parents report feeling unwelcome. *Do parents see it as
    a trustworthy signal, or as a way to pile on?*
11. **Your own report counts in your own numbers** (labelled), but changes no one else's. *Is that understandable?*
12. **The 60-second clock includes onboarding on a first run.** `/debug` also shows the time without it; decide which one counts.
13. **Ages 13+ and more than four children aren't supported**, per the brief.
14. **Accounts are optional**, though the brief listed accounts as out of scope. They exist only to sync saved lists.
