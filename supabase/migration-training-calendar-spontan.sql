alter table public.training_plan
  add column if not exists uhrzeit_start text,
  add column if not exists uhrzeit_ende text,
  add column if not exists ist_spontan boolean not null default false;

alter table public.training_slots
  add column if not exists wochentag_name text;

create unique index if not exists training_slots_user_id_wochentag_uidx
  on public.training_slots (user_id, wochentag);

create unique index if not exists training_plan_user_id_datum_uidx
  on public.training_plan (user_id, datum);
