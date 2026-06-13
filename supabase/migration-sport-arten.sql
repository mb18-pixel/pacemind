-- Migration: Sportarten-Unterstützung
-- Fügt sport_art Feld zu runs und training_plan hinzu

-- runs Tabelle: sport_art Spalte hinzufügen
ALTER TABLE public.runs 
ADD COLUMN IF NOT EXISTS sport_art text DEFAULT 'laufen';

-- training_plan Tabelle: sport_art Spalte hinzufügen  
ALTER TABLE public.training_plan
ADD COLUMN IF NOT EXISTS sport_art text DEFAULT 'laufen';

-- Index für bessere Filterung nach Sportart
CREATE INDEX IF NOT EXISTS idx_runs_sport_art ON public.runs(sport_art);
CREATE INDEX IF NOT EXISTS idx_training_plan_sport_art ON public.training_plan(sport_art);

-- Kommentar hinzufügen
COMMENT ON COLUMN public.runs.sport_art IS 'Art der Sportaktivität: laufen, radfahren, schwimmen, crosstrainer, fussball, krafttraining';
COMMENT ON COLUMN public.training_plan.sport_art IS 'Art der geplanten Aktivität: laufen, radfahren, schwimmen, crosstrainer, fussball, krafttraining';