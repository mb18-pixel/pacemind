-- Training Calendar Migration
-- Trainingslots - wann der Nutzer trainieren kann
create table if not exists public.training_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  wochentag integer not null check (wochentag >= 0 and wochentag <= 6), -- 0=Mo, 6=So
  wochentag_name text, -- "Montag", "Dienstag", etc.
  verfuegbar boolean not null default true,
  uhrzeit_start text, -- Format: "HH:MM"
  uhrzeit_ende text, -- Format: "HH:MM"
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists training_slots_user_id_idx on public.training_slots(user_id);

-- Training Plan - geplante Trainingseinheiten
create table if not exists public.training_plan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  datum date not null,
  trainingstyp text not null, -- intervall, tempo, locker, pause, langlauf
  dauer_minuten integer,
  distanz_km numeric(6, 2),
  beschreibung text,
  uhrzeit_start text, -- Format: "HH:MM"
  uhrzeit_ende text, -- Format: "HH:MM"
  status text not null default 'geplant' check (status in ('geplant', 'abgeschlossen', 'uebersprungen')),
  erstellt_von_ai boolean default false,
  ist_spontan boolean default false, -- Spontanes Training außerhalb der Zeitslots
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists training_plan_user_id_datum_idx on public.training_plan(user_id, datum);

-- Row Level Security
alter table public.training_slots enable row level security;
alter table public.training_plan enable row level security;

create policy "Users read own training slots"
  on public.training_slots for select
  using (auth.uid() = user_id);

create policy "Users insert own training slots"
  on public.training_slots for insert
  with check (auth.uid() = user_id);

create policy "Users update own training slots"
  on public.training_slots for update
  using (auth.uid() = user_id);

create policy "Users delete own training slots"
  on public.training_slots for delete
  using (auth.uid() = user_id);

create policy "Users read own training plan"
  on public.training_plan for select
  using (auth.uid() = user_id);

create policy "Users insert own training plan"
  on public.training_plan for insert
  with check (auth.uid() = user_id);

create policy "Users update own training plan"
  on public.training_plan for update
  using (auth.uid() = user_id);

create policy "Users delete own training plan"
  on public.training_plan for delete
  using (auth.uid() = user_id);

-- Trigger für updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger training_slots_updated_at before update on public.training_slots
  for each row execute function update_updated_at_column();

create trigger training_plan_updated_at before update on public.training_plan
  for each row execute function update_updated_at_column();
