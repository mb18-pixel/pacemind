-- PaceMind Supabase Schema
-- Im Supabase SQL Editor ausführen

-- Profile (Einwilligung)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  privacy_accepted_at timestamptz,
  age_confirmed_at timestamptz,
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

create policy "Users delete own runs"
  on public.runs for delete
  using (auth.uid() = user_id);
