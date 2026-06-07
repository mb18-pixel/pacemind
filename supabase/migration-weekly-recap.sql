-- Migration: Weekly Progress Recaps
-- Führe diesen SQL-Code im Supabase SQL Editor aus.

CREATE TABLE IF NOT EXISTS public.weekly_recaps (
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
CREATE INDEX IF NOT EXISTS weekly_recaps_user_id_woche_start_idx
  ON public.weekly_recaps (user_id, woche_start DESC);

-- Row Level Security für weekly_recaps aktivieren
ALTER TABLE public.weekly_recaps ENABLE ROW LEVEL SECURITY;

-- Select Richtlinie für User
CREATE POLICY "Users read own weekly recaps"
  ON public.weekly_recaps FOR SELECT
  USING (auth.uid() = user_id);
