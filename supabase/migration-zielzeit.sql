ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS zielzeit text,
ADD COLUMN IF NOT EXISTS aktuelle_trainingsfrequenz text,
ADD COLUMN IF NOT EXISTS aktuelle_distanz text,
ADD COLUMN IF NOT EXISTS zielzeit_berechnet boolean default false;
