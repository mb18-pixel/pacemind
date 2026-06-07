-- Tutorial-Status für neue Nutzer (nur einmal anzeigen)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tutorial_abgeschlossen boolean default false;

