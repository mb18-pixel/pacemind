-- Für bestehende Projekte im Supabase SQL Editor ausführen

ALTER TABLE public.runs
  ADD COLUMN IF NOT EXISTS herzfrequenz_max integer;

-- Nur falls herzfrequenz noch jsonb ist (alte Schema-Version):
-- UPDATE public.runs SET herzfrequenz_max = (herzfrequenz->>'max')::integer, herzfrequenz = (herzfrequenz->>'avg')::integer WHERE jsonb_typeof(herzfrequenz) = 'object';
-- ALTER TABLE public.runs ALTER COLUMN herzfrequenz TYPE integer USING herzfrequenz::integer;
