-- Cram — freemium tiers: paid flag + question usage tracking
--
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- It is idempotent: re-running it is safe.
--
-- Nothing here touches documents, chunks, the vector(768) columns, or
-- match_chunks. It only adds the two tables the gating logic reads.

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, holding the entitlement flag.
--
-- Deliberately NO insert/update/delete policy for users. A user may read their
-- own row and nothing more — if they could update it they would simply set
-- is_paid = true and grant themselves the paid tier. Rows are created by the
-- trigger below (which runs as the definer, bypassing RLS) and the flag is
-- flipped out-of-band: the SQL editor, the service role, or scripts/set-paid.mjs.
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
-- Give every new signup a profile row automatically, so the app never has to
-- create one from the request path (which RLS would refuse anyway).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill anyone who signed up before this migration.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

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
--   update public.profiles p
--      set is_paid = true
--     from auth.users u
--    where u.id = p.id
--      and u.email = 'you@example.com';
--
-- Or, from the repo root:  node scripts/set-paid.mjs you@example.com true
--
-- Anonymous trial users have no email; they are identified by
-- auth.users.is_anonymous = true and are never paid.
-- ---------------------------------------------------------------------------
