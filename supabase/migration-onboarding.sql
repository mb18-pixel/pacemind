-- Onboarding-Felder für bestehende Projekte
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_abgeschlossen boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS vorname text,
  ADD COLUMN IF NOT EXISTS geschlecht text,
  ADD COLUMN IF NOT EXISTS alter_jahre integer,
  ADD COLUMN IF NOT EXISTS gewicht_kg numeric(5, 1),
  ADD COLUMN IF NOT EXISTS koerperfettanteil numeric(4, 1),
  ADD COLUMN IF NOT EXISTS stadt text,
  ADD COLUMN IF NOT EXISTS land text,
  ADD COLUMN IF NOT EXISTS latitude numeric(9, 6),
  ADD COLUMN IF NOT EXISTS longitude numeric(9, 6),
  ADD COLUMN IF NOT EXISTS fitnesslevel text,
  ADD COLUMN IF NOT EXISTS ziel text,
  ADD COLUMN IF NOT EXISTS ziel_datum date,
  ADD COLUMN IF NOT EXISTS trainingstage text;
