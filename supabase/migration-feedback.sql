CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nachricht text NOT NULL,
  seite text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'feedback'
      AND policyname = 'Nutzer können Feedback senden'
  ) THEN
    CREATE POLICY "Nutzer können Feedback senden"
    ON public.feedback FOR INSERT
    WITH CHECK (true);
  END IF;
END $$;
