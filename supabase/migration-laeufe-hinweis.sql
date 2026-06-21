-- Läufe-Hinweis-Feld für profiles-Tabelle
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS laeufe_hinweis_gesehen boolean DEFAULT false;
