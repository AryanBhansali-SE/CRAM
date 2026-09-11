-- Cram — freemium tiers: paid flag + question usage tracking
--
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- It is idempotent: re-running it is safe.
--
-- Nothing here touches documents, chunks, the vector(768) columns, or
-- match_chunks. It only adds the two tables the gating logic reads.
--
-- Everything below lives in the `public` schema and needs no ownership of
-- `auth.users`. An earlier draft hung a trigger off auth.users to pre-create
-- profile rows; that needs table ownership, and because the SQL editor runs a
-- script as ONE transaction, the permission error rolled the whole migration
-- back — tables included. A missing profile row simply means "not paid", so the
-- trigger bought nothing that was worth that failure mode.

-- ---------------------------------------------------------------------------
-- profiles: the entitlement flag, one row per paying user.
--
-- A row is only needed once someone is actually upgraded — getUsage() treats an
-- absent row as the free tier, so signups need nothing done to them.
--
-- Deliberately NO insert/update/delete policy for users: they may read their own
-- row and nothing else. If a user could write this table they would simply set
-- is_paid = true and grant themselves Pro. The flag is set out-of-band — the SQL
-- editor, the service role, or scripts/set-paid.mjs — and later by the Whop
-- webhook.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  is_paid    boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- question_events: one row per answered question. Counting rows IS the usage
-- meter — there is no counter column to drift out of sync, and no reset job to
-- run, because "used today" is just a count over a time window.
--
-- Note there is deliberately no delete policy and no update policy: a user who
-- could delete their own events could reset their daily allowance at will.
-- Insert-and-read-own is all the app needs.
-- ---------------------------------------------------------------------------
create table if not exists public.question_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.question_events enable row level security;

drop policy if exists "question_events_select_own" on public.question_events;
create policy "question_events_select_own"
  on public.question_events for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "question_events_insert_own" on public.question_events;
create policy "question_events_insert_own"
  on public.question_events for insert
  to authenticated
  with check (auth.uid() = user_id);

-- The usage query is always "my events, newest first, within a window".
create index if not exists question_events_user_created_idx
  on public.question_events (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Flipping a user to paid (for testing, and until Whop billing is wired up)
--
--   insert into public.profiles (id, is_paid)
--   select u.id, true from auth.users u where u.email = 'you@example.com'
--   on conflict (id) do update set is_paid = true;
--
-- Or, from the repo root:  node scripts/set-paid.mjs you@example.com
--
-- Anonymous trial users have no email; they are identified by
-- auth.users.is_anonymous = true and are never paid.
-- ---------------------------------------------------------------------------
