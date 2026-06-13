ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nachrichten_heute integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nachrichten_reset_datum date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS nachrichten_limit integer DEFAULT 20;
