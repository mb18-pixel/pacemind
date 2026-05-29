-- Push Subscriptions (PWA)
-- Tabelle für Browser-Push-Subscriptions pro Nutzer.

create table if not exists public.push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamp with time zone default now()
);

-- Optional empfohlen (damit Upsert möglich ist, und pro User nur eine aktive Subscription bleibt):
-- create unique index if not exists push_subscriptions_user_id_unique on public.push_subscriptions(user_id);

