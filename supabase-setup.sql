-- CADET LOUNGE FOOSBALL — SUPABASE SETUP
-- Paste this entire file into Supabase > SQL Editor and click Run once.

create extension if not exists pgcrypto;

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  constraint players_name_length check (char_length(trim(name)) between 2 and 32),
  constraint players_name_trimmed check (name = trim(name))
);

create unique index if not exists players_name_case_insensitive_idx
  on public.players (lower(name));

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  player_one_id uuid not null references public.players(id) on delete restrict,
  player_two_id uuid not null references public.players(id) on delete restrict,
  winner_id uuid not null references public.players(id) on delete restrict,
  played_at timestamptz not null default now(),
  constraint games_different_players check (player_one_id <> player_two_id),
  constraint games_valid_winner check (winner_id = player_one_id or winner_id = player_two_id)
);

create index if not exists games_played_at_idx on public.games (played_at desc);
create index if not exists games_player_one_idx on public.games (player_one_id);
create index if not exists games_player_two_idx on public.games (player_two_id);

alter table public.players enable row level security;
alter table public.games enable row level security;

revoke all on table public.players from anon, authenticated;
revoke all on table public.games from anon, authenticated;
grant select, insert on table public.players to anon, authenticated;
grant select, insert on table public.games to anon, authenticated;

drop policy if exists "Public can view players" on public.players;
drop policy if exists "Public can add players" on public.players;
drop policy if exists "Public can view games" on public.games;
drop policy if exists "Public can record games" on public.games;

create policy "Public can view players"
  on public.players for select to anon, authenticated using (true);
create policy "Public can add players"
  on public.players for insert to anon, authenticated with check (true);
create policy "Public can view games"
  on public.games for select to anon, authenticated using (true);
create policy "Public can record games"
  on public.games for insert to anon, authenticated with check (true);

-- Add both tables to Realtime, safely even if this script is re-run.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'players'
  ) then
    alter publication supabase_realtime add table public.players;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'games'
  ) then
    alter publication supabase_realtime add table public.games;
  end if;
end $$;

-- Browser users cannot update or delete anything. Corrections can be made by
-- the project owner in Supabase's Table Editor.
