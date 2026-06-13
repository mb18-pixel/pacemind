-- PaceMind Supabase Schema
-- Im Supabase SQL Editor ausführen

-- Profile (Einwilligung)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  privacy_accepted_at timestamptz,
  age_confirmed_at timestamptz,
  onboarding_abgeschlossen boolean default false,
  tutorial_abgeschlossen boolean default false,
  vorname text,
  geschlecht text,
  alter_jahre integer,
  gewicht_kg numeric(5, 1),
  koerperfettanteil numeric(4, 1),
  stadt text,
  land text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  fitnesslevel text,
  ziel text,
  zielpace text,
  zieldistanz text,
  trainingstage text,
  nachrichten_heute integer default 0,
  nachrichten_reset_datum date default current_date,
  nachrichten_limit integer default 20,
  created_at timestamptz default now()
);

-- Läufe
create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  distanz_km numeric(6, 2) not null,
  pace text not null,
  herzfrequenz integer,
  herzfrequenz_max integer,
  befinden integer not null check (befinden >= 1 and befinden <= 5),
  notizen text default '',
  created_at timestamptz default now()
);

create index if not exists runs_user_id_created_at_idx
  on public.runs (user_id, created_at desc);

-- Feedback
create table if not exists public.feedback (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete set null,
  nachricht text not null,
  seite text,
  created_at timestamp with time zone default now()
);

-- Profil bei Registrierung anlegen
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.runs enable row level security;
alter table public.feedback enable row level security;

create policy "Users read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users read own runs"
  on public.runs for select
  using (auth.uid() = user_id);

create policy "Users insert own runs"
  on public.runs for insert
  with check (auth.uid() = user_id);

create policy "Nutzer können Feedback senden"
  on public.feedback for insert
  with check (true);

  using (auth.uid() = user_id);

-- Wöchentliche Fortschritts-Recaps
create table if not exists public.weekly_recaps (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  woche_start date not null,
  gelaufene_km numeric(6, 2) not null default 0.00,
  geplante_km numeric(6, 2) not null default 0.00,
  anzahl_läufe integer not null default 0,
  durchschnittspace text not null default '-',
  streak_wochen integer not null default 0,
  coach_kommentar text,
  created_at timestamp with time zone default now()
);

-- Index für schnelleren Zugriff auf Recaps pro User geordnet nach Datum
create index if not exists weekly_recaps_user_id_woche_start_idx
  on public.weekly_recaps (user_id, woche_start desc);

-- Row Level Security für weekly_recaps
alter table public.weekly_recaps enable row level security;

create policy "Users read own weekly recaps"
  on public.weekly_recaps for select
  using (auth.uid() = user_id);
