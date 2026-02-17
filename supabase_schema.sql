-- Community corpus table for "Red ma Kärntnerisch!"

create table if not exists public.corpus_entries (
  id text primary key,
  hd text not null,
  dialect text not null,
  source text,
  created timestamptz not null default now(),
  likes int not null default 0,
  liked_by text[] not null default '{}'::text[]
);

create index if not exists corpus_entries_created_idx on public.corpus_entries (created desc);
create index if not exists corpus_entries_likes_idx on public.corpus_entries (likes desc);

-- Optional (only if you want to use Supabase ANON key + RLS policies)
-- If you use SUPABASE_SERVICE_ROLE_KEY in Vercel, RLS is bypassed anyway.
--
-- alter table public.corpus_entries enable row level security;
--
-- create policy "public read" on public.corpus_entries
--   for select using (true);
--
-- create policy "public insert" on public.corpus_entries
--   for insert with check (true);
--
-- create policy "public update" on public.corpus_entries
--   for update using (true) with check (true);
