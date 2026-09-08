-- Cram — Row Level Security for documents and chunks
--
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- It is idempotent: re-running it is safe.
--
-- Context: documents.user_id is TEXT (it held the literal 'test-user' before
-- auth existed), while auth.uid() returns UUID — hence the ::text casts below.
-- Nothing here touches the vector(768) columns or the match_chunks function.

-- ---------------------------------------------------------------------------
-- documents: a row belongs to exactly one user.
-- ---------------------------------------------------------------------------
alter table public.documents enable row level security;

drop policy if exists "documents_select_own" on public.documents;
create policy "documents_select_own"
  on public.documents for select
  to authenticated
  using (auth.uid()::text = user_id);

drop policy if exists "documents_insert_own" on public.documents;
create policy "documents_insert_own"
  on public.documents for insert
  to authenticated
  with check (auth.uid()::text = user_id);

drop policy if exists "documents_update_own" on public.documents;
create policy "documents_update_own"
  on public.documents for update
  to authenticated
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

drop policy if exists "documents_delete_own" on public.documents;
create policy "documents_delete_own"
  on public.documents for delete
  to authenticated
  using (auth.uid()::text = user_id);

-- ---------------------------------------------------------------------------
-- chunks: no user_id column of its own, so ownership is inherited from the
-- parent document.
-- ---------------------------------------------------------------------------
alter table public.chunks enable row level security;

drop policy if exists "chunks_select_own" on public.chunks;
create policy "chunks_select_own"
  on public.chunks for select
  to authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = chunks.document_id
        and d.user_id = auth.uid()::text
    )
  );

drop policy if exists "chunks_insert_own" on public.chunks;
create policy "chunks_insert_own"
  on public.chunks for insert
  to authenticated
  with check (
    exists (
      select 1 from public.documents d
      where d.id = chunks.document_id
        and d.user_id = auth.uid()::text
    )
  );

drop policy if exists "chunks_delete_own" on public.chunks;
create policy "chunks_delete_own"
  on public.chunks for delete
  to authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = chunks.document_id
        and d.user_id = auth.uid()::text
    )
  );

-- Speeds up the ownership checks above and the per-user document listing.
create index if not exists documents_user_id_idx on public.documents (user_id);
create index if not exists chunks_document_id_idx on public.chunks (document_id);

-- ---------------------------------------------------------------------------
-- Notes
--
-- * No policy is granted to the `anon` role, so signed-out requests read
--   nothing at all.
-- * The service-role key still bypasses RLS by design. Nothing in the request
--   path uses it — see lib/supabase/admin.ts.
-- * Rows left over from before auth (user_id = 'test-user') match no real
--   account and are therefore invisible to every user. To adopt them into your
--   account after signing up, run:
--
--     update public.documents
--        set user_id = '<your-auth-user-id>'
--      where user_id = 'test-user';
-- ---------------------------------------------------------------------------
