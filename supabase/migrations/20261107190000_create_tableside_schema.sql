-- Tableside schema.
--
--   * Catalog (cities, restaurants, attributes, dietary): readable by everyone, writable by no one
--     through the API (changes go through migrations / the service role).
--   * feedback: anonymous, INSERT-only. People can submit reports; nobody can read other people's.
--     Reports are stored for review and deliberately NOT used in public scores.
--   * trip_lists: private to each (anonymous) signed-in user.
--
-- Every table has row-level security enabled, and grants are the minimum the app needs.

-- ───────────── Catalog ─────────────

create table public.cities (
  id text primary key,
  name text not null,
  region text not null,
  center_lat double precision not null check (center_lat between -90 and 90),
  center_lng double precision not null check (center_lng between -180 and 180),
  zoom smallint not null check (zoom between 1 and 19),
  time_zone text not null
);

create table public.restaurants (
  id text primary key,
  city_id text not null references public.cities (id),
  name text not null,
  cuisine text not null,
  price_level smallint not null check (price_level between 1 and 4),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  neighborhood text not null,
  address_note text not null,
  blurb text not null,
  -- Recurring windows: [{ "days": ["mon", …], "open": "08:00", "close": "15:00" }, …]
  hours jsonb not null default '[]'::jsonb,
  kid_windows jsonb not null default '[]'::jsonb,
  -- Simulated wait model: { "baseMinutes": 10, "peaks": [{ "days", "start", "end", "extraMinutes" }] }
  wait_profile jsonb not null default '{"baseMinutes": 10, "peaks": []}'::jsonb,
  menu_highlights text[] not null default '{}',
  watch_outs text[] not null default '{}',
  report_count integer not null default 0 check (report_count >= 0),
  would_return_count integer not null default 0,
  not_for_us_count integer not null default 0,
  -- Commercial metadata. Never read by scoring (see the app's tests); present for future B2B ideas.
  listing_kind text check (listing_kind in ('organic', 'sponsored', 'affiliate')),
  listing_partner text,
  is_sample boolean not null default true,
  constraint restaurants_signal_counts_valid
    check (would_return_count between 0 and report_count and not_for_us_count between 0 and report_count)
);

create index restaurants_city_id_idx on public.restaurants (city_id);

-- Parent-reported facts, each with provenance ("last confirmed", "how many parents").
create table public.restaurant_attributes (
  restaurant_id text not null references public.restaurants (id) on delete cascade,
  key text not null check (
    key in (
      'highChairs', 'boosterSeats', 'changingTable', 'strollerSpace', 'nursingFriendly', 'carrierRoom',
      'quietCorner', 'kidsMenu', 'activities', 'customizableDishes', 'sippyCupFriendly', 'outdoorSpace',
      'nearbyPark', 'foodSpeed', 'noiseLevel', 'messTolerance', 'menuVariety', 'staffWelcome'
    )
  ),
  value jsonb not null,
  last_confirmed_at date not null,
  confirmation_count integer not null check (confirmation_count >= 1),
  primary key (restaurant_id, key)
);

create table public.restaurant_dietary (
  restaurant_id text not null references public.restaurants (id) on delete cascade,
  tag text not null check (tag in ('glutenFree', 'dairyFree', 'nutAllergyAware', 'vegetarian', 'vegan')),
  value boolean not null,
  last_confirmed_at date not null,
  confirmation_count integer not null check (confirmation_count >= 1),
  primary key (restaurant_id, tag)
);

-- ───────────── Parent feedback (anonymous, insert-only) ─────────────

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  restaurant_id text not null references public.restaurants (id) on delete cascade,
  -- Set automatically for anonymous-signed-in users; null for plain anon requests.
  user_id uuid default auth.uid () references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Age bands of the reporter's children at the visit, so scores can be age-specific.
  reporter_bands text[] not null check (
    cardinality(reporter_bands) between 1 and 4
    and reporter_bands <@ array['infant', 'toddler', 'preschool', 'schoolAge']::text[]
  ),
  had_high_chair text not null check (had_high_chair in ('yes', 'no', 'notNeeded')),
  staff_welcoming text not null check (staff_welcoming in ('yes', 'somewhat', 'no')),
  wait_minutes integer not null check (wait_minutes between 0 and 240),
  noise text not null check (noise in ('quiet', 'moderate', 'loud')),
  would_return boolean not null,
  -- The "Not for us" signal: the family felt unwelcome.
  not_for_us boolean not null
);

create index feedback_restaurant_id_idx on public.feedback (restaurant_id);
create index feedback_user_id_idx on public.feedback (user_id);

-- ───────────── Trip lists (private per user) ─────────────

create table public.trip_lists (
  user_id uuid not null default auth.uid () references auth.users (id) on delete cascade,
  -- Client-generated, unique per user.
  id text not null check (char_length(id) between 1 and 100),
  name text not null check (char_length(name) between 1 and 100),
  restaurant_ids text[] not null default '{}' check (cardinality(restaurant_ids) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ───────────── Row-level security ─────────────

alter table public.cities enable row level security;
alter table public.restaurants enable row level security;
alter table public.restaurant_attributes enable row level security;
alter table public.restaurant_dietary enable row level security;
alter table public.feedback enable row level security;
alter table public.trip_lists enable row level security;

-- Catalog: public read, nothing else.
create policy "Catalog is public: cities" on public.cities for select to anon, authenticated using (true);
create policy "Catalog is public: restaurants" on public.restaurants for select to anon, authenticated using (true);
create policy "Catalog is public: attributes" on public.restaurant_attributes for select to anon, authenticated using (true);
create policy "Catalog is public: dietary" on public.restaurant_dietary for select to anon, authenticated using (true);

-- Feedback: anyone may submit, only as themselves (or anonymously); you can read back only your own.
create policy "Anyone can submit feedback" on public.feedback
  for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid ()));

create policy "People can read their own feedback" on public.feedback
  for select to authenticated
  using (user_id = (select auth.uid ()));

-- Trip lists: owner only.
create policy "Owners read their lists" on public.trip_lists for select to authenticated using (user_id = (select auth.uid ()));
create policy "Owners create their lists" on public.trip_lists for insert to authenticated with check (user_id = (select auth.uid ()));
create policy "Owners update their lists" on public.trip_lists for update to authenticated
  using (user_id = (select auth.uid ())) with check (user_id = (select auth.uid ()));
create policy "Owners delete their lists" on public.trip_lists for delete to authenticated using (user_id = (select auth.uid ()));

-- ───────────── Least-privilege grants ─────────────

revoke all on table
  public.cities, public.restaurants, public.restaurant_attributes, public.restaurant_dietary,
  public.feedback, public.trip_lists
from anon, authenticated;

grant select on public.cities, public.restaurants, public.restaurant_attributes, public.restaurant_dietary
  to anon, authenticated;
grant insert on public.feedback to anon, authenticated;
grant select on public.feedback to authenticated;
grant select, insert, update, delete on public.trip_lists to authenticated;
